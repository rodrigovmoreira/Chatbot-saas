const cron = require('node-cron');
const Contact = require('../models/Contact');
const { sendWhatsAppMessage } = require('./twilioService');
const { saveMessage } = require('./message');

// CONFIGURAÇÃO DOS ESTÁGIOS DE FOLLOW-UP
// delayMinutes: Quanto tempo esperar APÓS a última interação do bot para mandar esta mensagem
const FOLLOW_UP_STEPS = [
  {
    stage: 1,
    delayMinutes: 1, // 30 min após a última fala do bot
    message: "E aí, ficou alguma dúvida sobre o orçamento? Se quiser, posso te mandar alguns exemplos de artes nesse estilo! 🤘"
  },
  {
    stage: 2,
    delayMinutes: 1, // 2 horas após o PRIMEIRO follow-up (se o bot falou lá)
    message: "Oi! Só para não esquecer, nossa agenda para o próximo mês já está abrindo. Quer garantir seu horário?"
  },
  {
    stage: 3,
    delayMinutes: 1, // 24 horas depois (dia seguinte)
    message: "Última chamada por aqui! Vou encerrar seu atendimento por enquanto, mas se decidir tatuar é só chamar. Abraço!"
  }
];

function startScheduler() {
  console.log('⏰ Agendador de Follow-up Multi-nível iniciado...');

  // Roda a cada 1 minuto
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // 1. BUSCA: Contatos onde o BOT falou por último e ainda não completaram todos os estágios
      // Nota: Não filtramos por tempo aqui no DB para simplificar a query, 
      // pois cada estágio tem um tempo diferente. Filtramos o tempo no JavaScript.
      const activeContacts = await Contact.find({
        lastSender: 'bot',
        followUpStage: { $lt: FOLLOW_UP_STEPS.length }, // Ainda tem etapas para cumprir
        // Opcional: Trava de segurança para não pegar conversas de meses atrás
        lastInteraction: { $gt: new Date(now.getTime() - 48 * 60 * 60000) } 
      });

      if (activeContacts.length > 0) {
        // console.log(`🔎 Analisando ${activeContacts.length} contatos ativos...`);
      }

      for (const contact of activeContacts) {
        // Pega a configuração do PRÓXIMO estágio baseado no número atual do contato
        // Se contact.followUpStage é 0, pegamos o índice 0 (que é o stage 1)
        const nextStepConfig = FOLLOW_UP_STEPS[contact.followUpStage];

        if (!nextStepConfig) continue; // Segurança extra

        // Calcula o momento exato que deveríamos enviar a mensagem
        // LastInteraction + Delay do estágio
        const timeToTrigger = new Date(contact.lastInteraction.getTime() + nextStepConfig.delayMinutes * 60000);

        // Se AGORA já passou do tempo de gatilho
        if (now >= timeToTrigger) {
          console.log(`🎣 Disparando Estágio ${nextStepConfig.stage} para: ${contact.phone}`);

          // 1. Envia mensagem
          await sendWhatsAppMessage(contact.phone, nextStepConfig.message);

          // 2. Salva no histórico
          // IMPORTANTE: Isso vai atualizar o 'lastInteraction' para AGORA.
          // Isso é bom, pois o delay do Estágio 2 começará a contar a partir de AGORA.
          await saveMessage(contact.phone, 'bot', nextStepConfig.message);

          // 3. Incrementa o estágio
          contact.followUpStage += 1;
          
          // O saveMessage já deve ter atualizado o lastInteraction, 
          // mas precisamos salvar o novo followUpStage.
          await contact.save();
        }
      }

    } catch (error) {
      console.error('💥 Erro no Scheduler:', error);
    }
  });
}

module.exports = { startScheduler };