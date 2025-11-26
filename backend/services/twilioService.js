const twilio = require('twilio');

// Garante que o cliente só seja iniciado se as chaves existirem
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER; // Ex: whatsapp:+14155238886

let client;

if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
} else {
  console.error('❌ ERRO: Credenciais do Twilio não encontradas no .env');
}

/**
 * Envia uma mensagem de texto via WhatsApp Twilio
 * @param {string} to - Número do destinatário (pode vir como '55119...' ou 'whatsapp:+5511...')
 * @param {string} body - Texto da mensagem
 */
async function sendWhatsAppMessage(to, body) {
  if (!client) {
    console.error('❌ Cliente Twilio não inicializado.');
    return null;
  }

  try {
    // Garante formato E.164 com prefixo whatsapp:
    let formattedTo = to;
    if (!formattedTo.startsWith('whatsapp:')) {
      formattedTo = `whatsapp:${to.replace(/\D/g, '')}`; // Remove chars não numéricos e add prefixo
    }

    // Verifica se o número de origem está configurado
    if (!twilioNumber) {
        throw new Error('TWILIO_WHATSAPP_NUMBER não definido no .env');
    }

    const message = await client.messages.create({
      from: twilioNumber,
      to: formattedTo,
      body: body
    });

    console.log(`📤 Mensagem Twilio enviada: ${message.sid} para ${formattedTo}`);
    return message;
  } catch (error) {
    console.error(`💥 Erro ao enviar mensagem Twilio para ${to}:`, error.message);
    // Não damos throw para não derrubar a execução do bot, apenas logamos
    return null;
  }
}

module.exports = { sendWhatsAppMessage };