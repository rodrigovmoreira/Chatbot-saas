const cron = require('node-cron');
const Contact = require('../models/Contact');
const { sendWhatsAppMessage } = require('./twilioService');
const { saveMessage } = require('./message');

// Configuração: Tempo de espera antes de cobrar (em minutos)
const MINUTES_TO_WAIT = 1; 

function startScheduler() {
  console.log('⏰ Agendador de Follow-up iniciado...');

  // Roda a cada 1 minuto para verificar quem "sumiu"
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      // Calcula o tempo limite (Agora - 30 minutos)
      const timeLimit = new Date(now.getTime() - MINUTES_TO_WAIT * 60000);

      // BUSCA: Contatos onde o BOT falou por último, faz mais de 30min e AINDA NÃO cobramos
      const abandonedContacts = await Contact.find({
        lastSender: 'bot',                // Bot falou e ficou no vácuo
        lastInteraction: { $lt: timeLimit }, // Falou antes do tempo limite
        followUpSent: false,              // Ainda não mandamos o "Oi?"
        // Opcional: Ignorar conversas muito antigas (ex: mais de 24h) para não reviver mortos
        lastInteraction: { $gt: new Date(now.getTime() - 24 * 60 * 60000) } 
      });

      if (abandonedContacts.length > 0) {
        console.log(`🔎 Encontrados ${abandonedContacts.length} contatos para recuperar.`);
      }

      for (const contact of abandonedContacts) {
        // Mensagem de recuperação (Pode vir do BusinessConfig no futuro)
        const recoverMessage = "E aí, ficou alguma dúvida sobre o orçamento? Se quiser, posso te mandar alguns exemplos de artes nesse estilo! 🤘";

        console.log(`🎣 Tentando recuperar: ${contact.phone}`);

        // 1. Envia mensagem
        await sendWhatsAppMessage(contact.phone, recoverMessage);

        // 2. Salva no histórico (importante para manter coerência)
        await saveMessage(contact.phone, 'bot', recoverMessage);

        // 3. Marca como enviado para NÃO enviar de novo (evita loop infinito)
        contact.followUpSent = true;
        // Importante: NÃO mudamos o lastSender aqui, ou mudamos? 
        // Se mudarmos o lastInteraction no saveMessage, o loop reinicia.
        // O saveMessage já atualiza o lastInteraction, então precisamos garantir
        // que o followUpSent = true impeça o próximo envio.
        await contact.save();
      }

    } catch (error) {
      console.error('💥 Erro no Scheduler:', error);
    }
  });
}

module.exports = { startScheduler };