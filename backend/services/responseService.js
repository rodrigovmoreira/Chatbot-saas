const { getClientSession } = require('./wwebjsService');
// Se usar Twilio futuramente, importe aqui.

/**
 * Envia uma mensagem unificada, independente do provedor.
 * AGORA EXIGE userId PARA O WWEBJS!
 * * @param {string} to - Número de destino (ex: 5511999999999)
 * @param {string} message - Texto da mensagem
 * @param {string} provider - 'wwebjs' ou 'twilio'
 * @param {string} userId - ID do dono do bot (obrigatório para WWebJS)
 */
async function sendUnifiedMessage(to, message, provider, userId) {
  try {
    console.log(`📤 Enviando via [${provider.toUpperCase()}] para ${to}`);

    if (provider === 'wwebjs') {
      if (!userId) {
        throw new Error('UserID é obrigatório para enviar mensagem via WWebJS');
      }

      // 1. Pega a sessão específica desse usuário no "Hotel"
      const client = getClientSession(userId);

      if (!client) {
        console.error(`❌ Sessão WWebJS não encontrada ou inativa para User: ${userId}`);
        return false;
      }

      // 2. Formata o número (WWebJS precisa do sufixo @c.us)
      const chatId = to.includes('@c.us') ? to : `${to}@c.us`;

      // 3. Envia
      await client.sendMessage(chatId, message);
      return true;
    } 
    
    // Futuro: Bloco do Twilio viria aqui
    else if (provider === 'twilio') {
       console.log("⚠️ Twilio ainda não implementado no sendUnifiedMessage");
    }

  } catch (error) {
    console.error(`💥 Erro ao enviar mensagem via ${provider}:`, error.message);
    throw error;
  }
}

module.exports = { sendUnifiedMessage };