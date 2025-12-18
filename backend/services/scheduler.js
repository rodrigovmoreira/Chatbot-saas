const cron = require('node-cron');
const BusinessConfig = require('../models/BusinessConfig');
const Contact = require('../models/Contact');
const { saveMessage } = require('./message');
const { sendUnifiedMessage } = require('./responseService');

function startScheduler() {
  console.log('⏰ Agendador de Follow-up (Multi-tenant) iniciado...');

  // Roda a cada minuto
  cron.schedule('* * * * *', async () => {
    try {
      // 1. Pega TODAS as empresas ativas
      const configs = await BusinessConfig.find({});

      for (const config of configs) {
        // Se não tiver passos configurados ou userId, pula
        if (!config.followUpSteps || config.followUpSteps.length === 0 || !config.userId) continue;

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
            console.log(`🎣 [${config.businessName}] Disparando Estágio ${nextStep.stage} para: ${contact.phone}`);

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