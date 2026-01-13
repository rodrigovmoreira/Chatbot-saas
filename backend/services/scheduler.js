const cron = require('node-cron');
const BusinessConfig = require('../models/BusinessConfig');
const Contact = require('../models/Contact');
const Appointment = require('../models/Appointment');
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

// === LÓGICA DE PROCESSAMENTO EM LOTE (BATTERY OPTIMIZED) ===
async function processConfigBatch(configs) {
    if (!configs || configs.length === 0) return;

    // 1. Coleta IDs para buscar tudo em 2 queries (vs N queries)
    const userIds = [];
    const businessIds = [];

    // Mapas para acesso rápido O(1)
    const configByUserId = new Map();
    const configByBusinessId = new Map();

    for (const config of configs) {
        if (config.userId) {
            userIds.push(config.userId);
            configByUserId.set(config.userId.toString(), config);
        }
        businessIds.push(config._id);
        configByBusinessId.set(config._id.toString(), config);
    }

    // 2. Busca Agendamentos em Lote (Otimização A)
    const recentStart = new Date();
    recentStart.setDate(recentStart.getDate() - 30); // 30 dias atrás

    // Query unificada
    const allAppointments = await Appointment.find({
        userId: { $in: userIds },
        status: { $in: ['scheduled', 'confirmed', 'completed', 'followup_pending'] },
        start: { $gte: recentStart }
    });

    // Agrupa por userId
    const appointmentsByUserId = new Map();
    for (const appt of allAppointments) {
        const uid = appt.userId.toString();
        if (!appointmentsByUserId.has(uid)) appointmentsByUserId.set(uid, []);
        appointmentsByUserId.get(uid).push(appt);
    }

    // 3. Busca Contatos em Lote (Otimização B)
    // Query unificada
    const allContacts = await Contact.find({
        businessId: { $in: businessIds },
        followUpActive: true,
        lastResponseTime: { $exists: true }
    });

    // Agrupa por businessId
    const contactsByBusinessId = new Map();
    for (const contact of allContacts) {
        const bid = contact.businessId.toString();
        if (!contactsByBusinessId.has(bid)) contactsByBusinessId.set(bid, []);
        contactsByBusinessId.get(bid).push(contact);
    }

    // 4. Itera sobre os Configs e processa usando os dados em memória
    for (const config of configs) {
        if (!config.userId) continue;

        // --- A. NOTIFICAÇÕES (APPOINTMENTS) ---
        if (config.notificationRules && config.notificationRules.length > 0) {
            const appointments = appointmentsByUserId.get(config.userId.toString()) || [];

            for (const appt of appointments) {
                for (const rule of config.notificationRules) {
                    if (!rule.isActive) continue;

                    // Verifica se já enviou esta regra
                    if (appt.notificationHistory && appt.notificationHistory.get(rule.id)) {
                        continue;
                    }

                    const triggerTime = calculateTriggerTime(appt, rule);
                    const now = new Date();

                    if (now >= triggerTime) {
                        const diffHours = (now - triggerTime) / 1000 / 60 / 60;
                        if (diffHours > 24) continue; // Ignora muito antigos

                        const tz = config.operatingHours?.timezone || 'America/Sao_Paulo';
                        const message = formatMessage(rule.messageTemplate, appt, tz);

                        await sendUnifiedMessage(
                            appt.clientPhone,
                            message,
                            config.whatsappProvider,
                            config.userId
                        );

                        if (!appt.notificationHistory) appt.notificationHistory = new Map();
                        appt.notificationHistory.set(rule.id, now);
                        await appt.save();

                        await saveMessage(appt.clientPhone, 'bot', message, 'text', null, config._id);
                    }
                }
            }
        }

        // --- B. FOLLOW-UP (CONTACTS) ---
        if (config.followUpSteps && config.followUpSteps.length > 0) {
            const pendingContacts = contactsByBusinessId.get(config._id.toString()) || [];

            for (const contact of pendingContacts) {
                const now = new Date();
                const lastMsgTime = new Date(contact.lastResponseTime);
                const minutesSinceLastMsg = (now - lastMsgTime) / 1000 / 60;

                const nextStepIndex = contact.followUpStage ? contact.followUpStage : 0;
                const nextStep = config.followUpSteps[nextStepIndex];

                if (!nextStep) {
                    contact.followUpActive = false;
                    await contact.save();
                    continue;
                }

                if (minutesSinceLastMsg >= nextStep.delayMinutes) {
                    await sendUnifiedMessage(
                        contact.phone,
                        nextStep.message,
                        config.whatsappProvider,
                        config.userId
                    );

                    await saveMessage(contact.phone, 'bot', nextStep.message, 'text', null, config._id);

                    contact.followUpStage = nextStepIndex + 1;
                    contact.lastResponseTime = now;

                    await contact.save();
                }
            }
        }
    }
}

async function processSchedulerTick() {
    try {
        const configs = await BusinessConfig.find({
            userId: { $exists: true },
            $or: [
                { notificationRules: { $exists: true, $not: { $size: 0 } } },
                { followUpSteps: { $exists: true, $not: { $size: 0 } } }
            ]
        });

        // Batch Processing: Process 50 businesses at a time to prevent massive memory spikes
        // while solving N+1 query problem.
        const BATCH_SIZE = 50;
        for (let i = 0; i < configs.length; i += BATCH_SIZE) {
            const batch = configs.slice(i, i + BATCH_SIZE);
            await processConfigBatch(batch);
        }

    } catch (error) {
        console.error('💥 Erro no Scheduler:', error);
    }
}

function startScheduler() {
  // Roda a cada minuto
  cron.schedule('* * * * *', () => {
      processSchedulerTick();
  });
}

module.exports = { startScheduler, processSchedulerTick };
