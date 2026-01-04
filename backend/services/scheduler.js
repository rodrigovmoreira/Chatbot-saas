const cron = require('node-cron');
const BusinessConfig = require('../models/BusinessConfig');
const Contact = require('../models/Contact');
const Appointment = require('../models/Appointment'); // <--- Importado
const { saveMessage } = require('./message');
const { sendUnifiedMessage } = require('./responseService');

// === HELPER: Calcular Data Alvo ===
function calculateTriggerTime(appointment, rule) {
    const baseTime = rule.triggerDirection === 'before' ? new Date(appointment.start) : new Date(appointment.end);
    const offset = rule.triggerOffset;

    // Clona a data base para não mutar o objeto original
    const target = new Date(baseTime);

    if (rule.triggerDirection === 'before') {
        // Subtrai tempo
        if (rule.triggerUnit === 'minutes') target.setMinutes(target.getMinutes() - offset);
        if (rule.triggerUnit === 'hours') target.setHours(target.getHours() - offset);
        if (rule.triggerUnit === 'days') target.setDate(target.getDate() - offset);
    } else {
        // Adiciona tempo (after)
        if (rule.triggerUnit === 'minutes') target.setMinutes(target.getMinutes() + offset);
        if (rule.triggerUnit === 'hours') target.setHours(target.getHours() + offset);
        if (rule.triggerUnit === 'days') target.setDate(target.getDate() + offset);
    }

    return target;
}

// === HELPER: Formatar Mensagem ===
function formatMessage(template, appointment, timezone = 'America/Sao_Paulo') {
    let msg = template;
    const dateStr = new Date(appointment.start).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: timezone
    });

    msg = msg.replace(/{clientName}/g, appointment.clientName || 'Cliente');
    msg = msg.replace(/{appointmentTime}/g, dateStr);
    msg = msg.replace(/{serviceName}/g, appointment.title || 'Agendamento');

    return msg;
}

function startScheduler() {
  // Roda a cada minuto
  cron.schedule('* * * * *', async () => {
    try {
      // 1. Pega APENAS as empresas ativas com regras configuradas
      const configs = await BusinessConfig.find({
        userId: { $exists: true },
        $or: [
          { notificationRules: { $exists: true, $not: { $size: 0 } } },
          { followUpSteps: { $exists: true, $not: { $size: 0 } } }
        ]
      });

      for (const config of configs) {
        if (!config.userId) continue;

        // ============================================================
        // A. ENGINE DE NOTIFICAÇÕES DE AGENDAMENTO (NOVO)
        // ============================================================
        if (config.notificationRules && config.notificationRules.length > 0) {
            // Busca agendamentos relevantes (Agendados ou Concluídos recentemente)
            // Otimização: Pegamos do passado recente até o futuro distante
            const recentStart = new Date();
            recentStart.setDate(recentStart.getDate() - 30); // Olha 30 dias pra trás (pra pegar follow-ups "after")

            const appointments = await Appointment.find({
                userId: config.userId,
                status: { $in: ['scheduled', 'confirmed', 'completed', 'followup_pending'] },
                start: { $gte: recentStart }
            });

            for (const appt of appointments) {
                for (const rule of config.notificationRules) {
                    if (!rule.isActive) continue;

                    // Verifica se já enviou esta regra
                    if (appt.notificationHistory && appt.notificationHistory.get(rule.id)) {
                        continue;
                    }

                    const triggerTime = calculateTriggerTime(appt, rule);
                    const now = new Date();

                    // Se JÁ PASSOU da hora de disparar (com tolerância de, digamos, 1 hora para não disparar coisas muito velhas se o servidor cair)
                    // Mas para garantir entrega, vamos disparar se now >= triggerTime.
                    // Para evitar disparar coisas de meses atrás se criarmos a regra hoje, poderiamos checar se triggerTime > now - 1h.
                    // PROMPT DIZ: "If CurrentTime >= TargetTime AND RuleID not in history"

                    if (now >= triggerTime) {
                        // Verificação de segurança para não disparar alertas muito antigos (ex: servidor ficou off 1 dia)
                        // Vamos aceitar disparos com até 24h de atraso. Se for mais que isso, ignora (assumimos que perdeu o timing).
                        const diffHours = (now - triggerTime) / 1000 / 60 / 60;
                        if (diffHours > 24) continue;

                        const tz = config.operatingHours?.timezone || 'America/Sao_Paulo';
                        const message = formatMessage(rule.messageTemplate, appt, tz);

                        // Envia
                        await sendUnifiedMessage(
                            appt.clientPhone,
                            message,
                            config.whatsappProvider,
                            config.userId
                        );

                        // Marca como enviado
                        if (!appt.notificationHistory) appt.notificationHistory = new Map();
                        appt.notificationHistory.set(rule.id, now);
                        await appt.save();

                        // Salva no histórico de chat também
                        await saveMessage(appt.clientPhone, 'bot', message, 'text', null, config._id);
                    }
                }
            }
        }

        // ============================================================
        // B. SISTEMA ANTIGO DE FOLLOW-UP (CRM / LEADS)
        // ============================================================
        // Se não tiver passos configurados, pula parte B
        if (!config.followUpSteps || config.followUpSteps.length === 0) continue;

        // 2. Para cada empresa, busca contatos pendentes
        // Regra: lastResponseTime existe (já falou) AND followUpActive é true
        const pendingContacts = await Contact.find({
          businessId: config._id,
          followUpActive: true,
          lastResponseTime: { $exists: true }
        });

        for (const contact of pendingContacts) {
          const now = new Date();
          const lastMsgTime = new Date(contact.lastResponseTime);
          const minutesSinceLastMsg = (now - lastMsgTime) / 1000 / 60;

          // Descobre qual o próximo passo
          const nextStepIndex = contact.followUpStage ? contact.followUpStage : 0;
          const nextStep = config.followUpSteps[nextStepIndex];

          // Se acabou os passos, desativa
          if (!nextStep) {
            contact.followUpActive = false;
            await contact.save();
            continue;
          }

          // 3. VERIFICA SE É HORA DE DISPARAR
          if (minutesSinceLastMsg >= nextStep.delayMinutes) {
            // === A CORREÇÃO ESTÁ AQUI ===
            // Passamos config.userId para que o WWebJS saiba qual sessão usar
            await sendUnifiedMessage(
                contact.phone, 
                nextStep.message, 
                config.whatsappProvider, 
                config.userId // <--- O PULO DO GATO
            );

            // Salva no histórico como mensagem do BOT
            await saveMessage(contact.phone, 'bot', nextStep.message, 'text', null, config._id);

            // Atualiza o contato para o próximo estágio
            contact.followUpStage = nextStepIndex + 1;
            // IMPORTANTE: Não atualizamos o lastResponseTime para não resetar o ciclo, 
            // ou atualizamos se a lógica for "tempo entre mensagens".
            // Geralmente em funil, conta-se do silêncio. Vamos manter sem atualizar lastResponseTime 
            // para que o próximo delay conte a partir da última interação real, 
            // OU atualizamos para contar delay entre follow-ups.
            // Para funil simples, atualizar o time evita disparo em massa.
            contact.lastResponseTime = now; 
            
            await contact.save();
          }
        }
      }
    } catch (error) {
      console.error('💥 Erro no Scheduler:', error);
    }
  });
}

module.exports = { startScheduler };