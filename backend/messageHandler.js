const { saveMessage, getLastMessages } = require('./services/message');
const { generateAIResponse } = require('./services/ai'); 
const { analyzeImage } = require('./services/visionService');
const { sendUnifiedMessage } = require('./services/responseService'); // <-- VAMOS MUDAR ISSO DEPOIS PARA O ADAPTER DE SAÍDA
const BusinessConfig = require('./models/BusinessConfig');

const MAX_HISTORY = 15;

async function getMVPConfig() {
  // (Mantenha igual ao original)
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
  if (businessConfig.operatingHours && businessConfig.operatingHours.active === false) {
    return false;
  }
  if (!businessConfig.operatingHours ||!businessConfig.operatingHours.opening) return true;

  const now = new Date();
  const hours = now.getUTCHours() - 3; 
  const currentHour = hours < 0? hours + 24 : hours;
  const [openH] = businessConfig.operatingHours.opening.split(':').map(Number);
  const [closeH] = businessConfig.operatingHours.closing.split(':').map(Number);

  return currentHour >= openH && currentHour < closeH;
}

// ==========================================
// 🚀 HANDLER UNIFICADO (AGNOSTICO)
// ==========================================
// Agora recebemos um objeto "normalizedMsg" que veio do Adapter
async function handleIncomingMessage(normalizedMsg) {
  const { from, body, name, type, mediaUrl, provider } = normalizedMsg;

  // Ignora se vazio
  if (!body && type === 'text') return;

  console.log(`📩 [${provider.toUpperCase()}] De: ${name} (${from}) | Tipo: ${type}`);

  let userMessage = body ? body.trim() : "";

  try {
    // 1. LÓGICA DE VISÃO (Adaptada)
    if (type === 'image') {
        console.log(`📸 Imagem detectada.`);
        
        let imageDescription = null;

        if (provider === 'twilio' && mediaUrl) {
            imageDescription = await analyzeImage(mediaUrl);
        } 
        // TODO: Implementar lógica de download de imagem do WWebJS aqui
        else if (provider === 'wwebjs') {
             console.log("⚠️ Visão para WWebJS será implementada na próxima etapa.");
             userMessage += " [O cliente enviou uma imagem, mas o sistema visual ainda está sendo calibrado.]";
        }

        if (imageDescription) {
            console.log("✅ Descrição Gemini:", imageDescription.substring(0, 50) + "...");
            userMessage = `${userMessage}\n\n[Descrição da Imagem Visualizada]: ${imageDescription}`.trim();
        }
    }

    // 2. Carregar Config
    const businessConfig = await getMVPConfig();
    if (!businessConfig) return;

    // 3. Verificar Horário
    if (!isWithinOperatingHours(businessConfig)) {
      // TODO: Usar um OutputAdapter aqui para responder pelo canal certo
      // Por enquanto, só logamos se não for Twilio, pois sendWhatsAppMessage é só Twilio
      if (provider === 'twilio') await sendWhatsAppMessage(from, businessConfig.awayMessage);
      return;
    }

    // 4. Salvar Mensagem
    await saveMessage(from, 'user', userMessage);

    // 5. Histórico e Prompt
    const history = await getLastMessages(from, MAX_HISTORY);
    const historyText = history
    .reverse()
    .map(m => `${m.role === 'user'? 'Cliente' : 'Tatuador'}: ${m.content}`)
    .join('\n');

    const finalSystemPrompt = `
${businessConfig.systemPrompt}
---
DADOS DO SISTEMA:
Nome do Cliente: ${name}
Histórico:
${historyText}
---
`;

    // 6. Gerar Resposta IA
    const aiResponse = await generateAIResponse(userMessage, finalSystemPrompt);

    // 7. Enviar e Salvar Resposta
    if (aiResponse) {
      console.log(`🤖 Resposta gerada: "${aiResponse.substring(0,20)}..."`);
      
      // === ROTEAMENTO DE SAÍDA CORRIGIDO ===
      // Agora usamos a função unificada que sabe lidar com os dois
      await sendUnifiedMessage(from, aiResponse, provider);
      
      await saveMessage(from, 'bot', aiResponse);
    } 

  } catch (error) {
    console.error('💥 Erro fatal no handleIncomingMessage:', error);
  }
}

module.exports = { handleIncomingMessage };