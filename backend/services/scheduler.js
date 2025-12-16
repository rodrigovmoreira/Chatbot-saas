const cron = require('node-cron');
const Contact = require('../models/Contact');
const BusinessConfig = require('../models/BusinessConfig');
const { sendUnifiedMessage } = require('./responseService');
// Importante: Caminho ajustado para a pasta services onde está o message.js atualizado
const { saveMessage } = require('./message'); 

function startScheduler() {
  console.log('⏰ Agendador de Follow-up (Multi-tenant) iniciado...');

  // Roda a cada 1 minuto
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // 1. BUSCA TODAS AS CONFIGURAÇÕES DE EMPRESAS
      // No modelo SaaS, cada documento aqui é uma empresa diferente
      const allConfigs = await BusinessConfig.find({});

      // Loop por cada empresa para processar seus respectivos clientes
      for (const config of allConfigs) {
          
          // Se a empresa não tiver passos de follow-up configurados, pula para a próxima
          if (!config.followUpSteps || config.followUpSteps.length === 0) continue;

          const provider = config.whatsappProvider || 'wwebjs';
          const steps = config.followUpSteps;
          const businessId = config._id; // ID da empresa atual no loop

          // 2. BUSCA CONTATOS DESTA EMPRESA ESPECÍFICA
          // Regras: O bot falou por último, ainda tem etapas e a interação foi recente (48h)
          const activeContacts = await Contact.find({
            businessId: businessId, // <--- FILTRO DE SEGURANÇA (Só pega contatos dessa empresa)
            lastSender: 'bot',
            followUpStage: { $lt: steps.length }, 
            lastInteraction: { $gt: new Date(now.getTime() - 48 * 60 * 60000) }
          });

          // Se tiver contatos para processar nesta empresa
          // if (activeContacts.length > 0) console.log(`🔎 [${config.businessName}] Analisando ${activeContacts.length} contatos...`);

          for (const contact of activeContacts) {
            // Pega a regra baseada no estágio atual do contato
            const nextStepConfig = steps[contact.followUpStage];

            if (!nextStepConfig) continue;

            // Calcula o momento do disparo
            const timeToTrigger = new Date(contact.lastInteraction.getTime() + nextStepConfig.delayMinutes * 60000);

            // Se já passou da hora
            if (now >= timeToTrigger) {
              console.log(`🎣 [${config.businessName}] Disparando Estágio ${contact.followUpStage + 1} para: ${contact.phone}`);

              // A. Envia a mensagem (via Twilio ou WWebJS)
              await sendUnifiedMessage(contact.phone, nextStepConfig.message, provider);

              // B. Salva no banco vinculando à empresa correta
              // Assinatura: saveMessage(phone, role, content, type, visionResult, businessId)
              await saveMessage(contact.phone, 'bot', nextStepConfig.message, 'text', null, businessId);

              // C. Atualiza o estágio do contato
              contact.followUpStage += 1;
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