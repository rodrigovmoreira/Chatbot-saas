const { saveMessage, getLastMessages } = require('./services/message');
const { generateAIResponse } = require('./services/ai'); // Note que agora usamos a função genérica
const { sendWhatsAppMessage } = require('./services/twilioService');
const BusinessConfig = require('./models/BusinessConfig');

// Configurações
const MAX_HISTORY = 15; // Aumentei um pouco para a IA ter mais contexto

// ==========================================
// 🛠️ FUNÇÕES AUXILIARES
// ==========================================

const normalizePhone = (twilioPhone) => {
  return twilioPhone ? twilioPhone.replace('whatsapp:', '') : '';
};

/**
 * Busca a configuração.
 * Para o MVP, pegamos a primeira configuração que encontrarmos no banco.
 * (Assumindo que só tem o tatuador cadastrado).
 */
async function getMVPConfig() {
  try {
    const config = await BusinessConfig.findOne({});
    if (config) return config;
    
    console.error('⚠️ NENHUMA CONFIGURAÇÃO ENCONTRADA NO BANCO!');
    return null;
  } catch (error) {
    console.error('💥 Erro ao buscar configuração:', error);
    return null;
  }
}

function isWithinOperatingHours(businessConfig) {
  // Se o "master switch" estiver desligado no banco, o bot não responde
  if (businessConfig.operatingHours && businessConfig.operatingHours.active === false) {
    return false;
  }
  
  // Lógica simples de horário (pode ser aprimorada depois)
  if (!businessConfig.operatingHours || !businessConfig.operatingHours.opening) return true;

  const now = new Date();
  // Ajuste fuso horário simples (-3h BRT) se o servidor estiver em UTC
  const hours = now.getUTCHours() - 3; 
  const currentHour = hours < 0 ? hours + 24 : hours; // Ajuste virada do dia
  
  const [openH] = businessConfig.operatingHours.opening.split(':').map(Number);
  const [closeH] = businessConfig.operatingHours.closing.split(':').map(Number);

  return currentHour >= openH && currentHour < closeH;
}

// ==========================================
// 🚀 HANDLER PRINCIPAL
// ==========================================

async function handleTwilioMessage(twilioData) {
  const { Body, From, ProfileName } = twilioData;

  if (!Body || !From) return;

  const userPhone = normalizePhone(From);
  const userMessage = Body.trim();

  console.log(`📩 Msg de ${ProfileName || userPhone}: "${userMessage.substring(0, 30)}..."`);

  try {
    // 1. Carregar Cérebro do Bot (Do Banco de Dados)
    const businessConfig = await getMVPConfig();

    if (!businessConfig) {
      console.log('🛑 Bot inativo (Sem configuração).');
      return;
    }

    // 2. Verificar Horário
    if (!isWithinOperatingHours(businessConfig)) {
      console.log('🌙 Fora do horário. Enviando msg de ausência.');
      // Só envia se for a primeira mensagem recente para não fazer spam, 
      // mas para MVP simples, enviamos sempre.
      await sendWhatsAppMessage(From, businessConfig.awayMessage);
      return;
    }

    // 3. Salvar User Message
    await saveMessage(userPhone, 'user', userMessage);

    // 4. Preparar Contexto para a IA
    const history = await getLastMessages(userPhone, MAX_HISTORY);
    const historyText = history
      .reverse()
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Tatuador'}: ${m.content}`)
      .join('\n');

    // Montar o System Prompt Final
    // Juntamos a "Personalidade" (banco) + "Histórico" (conversa real)
    const finalSystemPrompt = `
${businessConfig.systemPrompt}

---
DADOS DO SISTEMA:
Nome do Cliente: ${ProfileName || 'Cliente'} (User WhatsApp)
Histórico da Conversa:
${historyText}
---
Atenção: Responda a última mensagem do cliente mantendo a personalidade definida acima.
`.trim();

    // 5. Gerar Resposta (IA)
    // Passamos a mensagem do usuário E o prompt do sistema que acabamos de montar
    const aiResponse = await generateAIResponse(userMessage, finalSystemPrompt);

    // 6. Enviar e Salvar
    if (aiResponse) {
      await sendWhatsAppMessage(From, aiResponse);
      await saveMessage(userPhone, 'bot', aiResponse);
    } else {
      // Fallback se a IA falhar
      await sendWhatsAppMessage(From, "Opa, deu uma travada aqui na minha internet. Já te respondo!");
    }

  } catch (error) {
    console.error('💥 Erro no handleTwilioMessage:', error);
  }
}

module.exports = { handleTwilioMessage };