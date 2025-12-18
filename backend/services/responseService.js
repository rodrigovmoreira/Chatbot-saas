// IMPORTANTE: Importe a função SEGURA de envio, não o getClientSession
const { sendWWebJSMessage } = require('./wwebjsService');
const { sendWhatsAppMessage } = require('./twilioService'); // Se tiver o Twilio

/* Envia uma mensagem unificada, independente do provedor.
   @param {string} to - Número de destino (ex: 5511999999999)
   @param {string} message - Texto da mensagem
   @param {string} provider - 'wwebjs' ou 'twilio'
   @param {string} userId - ID do dono do bot (obrigatório para WWebJS)
 */
async function sendUnifiedMessage(to, message, provider, userId) {
  try {
    // console.log(`📤 Enviando via [${provider.toUpperCase()}] para ${to}`);

    if (provider === 'wwebjs') {
      if (!userId) {
        console.error('❌ Erro: Tentativa de envio WWebJS sem userId definido.');
        return false;
      }
      return await sendWWebJSMessage(userId, to, message);
    } 
    else if (provider === 'twilio') {
       return await sendWhatsAppMessage(to, message);
    }
  } catch (error) {
    console.error(`💥 Erro ao enviar mensagem unificada (${provider}):`, error.message);
    return false; // Retorna false para quem chamou saber que falhou
  }
}

module.exports = { sendUnifiedMessage };