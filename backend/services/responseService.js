const { sendWhatsAppMessage } = require('./twilioService'); // Seu serviço antigo do Twilio
const { getWWebJSClient } = require('./wwebjsService'); // Novo serviço do WWebJS

/**
 * Envia mensagem pelo canal correto (Twilio ou WWebJS)
 * @param {string} to - Número do destinatário (formato padrão: 5511999999999)
 * @param {string} message - Texto da mensagem
 * @param {string} provider - 'twilio' ou 'wwebjs'
 * @param {object} options - Opções extras (ex: originalMsg para reply)
 */
async function sendUnifiedMessage(to, message, provider = 'wwebjs', options = {}) {
  console.log(`📤 Enviando via [${provider.toUpperCase()}] para ${to} ${Date()}`);

  try {
    if (provider === 'twilio') {
      // Chama sua função existente do Twilio
      // Nota: o sendWhatsAppMessage já trata o prefixo 'whatsapp:' internamente
      return await sendWhatsAppMessage(to, message);
    } 
    
    else if (provider === 'wwebjs') {
      const client = getWWebJSClient();
      
      // Verifica se o cliente está pronto
      if (!client || !client.info) {
        console.error('❌ WWebJS não está pronto para enviar mensagens.');
        return null;
      }

      // Formata o número para o padrão do WWebJS (55119...@c.us)
      // Se já vier formatado (do Adapter), usa direto. Se for apenas números, formata.
      let chatId = to;
      if (!chatId.includes('@c.us')) {
        chatId = `${to}@c.us`;
      }

      // Envia
      return await client.sendMessage(chatId, message);
    }

  } catch (error) {
    console.error(`💥 Erro ao enviar mensagem via ${provider}:`, error);
    return null;
  }
}

module.exports = { sendUnifiedMessage };