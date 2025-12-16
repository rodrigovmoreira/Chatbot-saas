const { saveMessage, getLastMessages, getImageHistory } = require('./services/message');
const { generateAIResponse } = require('./services/ai');
const { analyzeImage } = require('./services/visionService');
const { sendUnifiedMessage } = require('./services/responseService'); // <-- VAMOS MUDAR ISSO DEPOIS PARA O ADAPTER DE SAÍDA
const BusinessConfig = require('./models/BusinessConfig');

const MAX_HISTORY = 30;

async function getMVPConfig() {
  try {
    const config = await BusinessConfig.findOne({});
    if (config && !config.prompts) {
      config.prompts = { chatSystem: "...", visionSystem: "..." }; // Fallback
    }
    return config;
  } catch (error) { return null; }
}

function isWithinOperatingHours(businessConfig) {
  if (businessConfig.operatingHours && businessConfig.operatingHours.active === false) {
    return false;
  }
  if (!businessConfig.operatingHours || !businessConfig.operatingHours.opening) return true;

  const now = new Date();
  const hours = now.getUTCHours() - 3;
  const currentHour = hours < 0 ? hours + 24 : hours;
  const [openH] = businessConfig.operatingHours.opening.split(':').map(Number);
  const [closeH] = businessConfig.operatingHours.closing.split(':').map(Number);

  return currentHour >= openH && currentHour < closeH;
}

// ==========================================
// 🚀 HANDLER UNIFICADO (AGNOSTICO)
// ==========================================
// Agora recebemos um objeto "normalizedMsg" que veio do Adapter
async function handleIncomingMessage(normalizedMsg) {
  const { from, body, name, type, mediaData, provider } = normalizedMsg;

  // Ignora se vazio e não for imagem
  if (!body && type === 'text') return;

  console.log(`📩 [${provider}] De: ${name} | Tipo: ${type}`);

  let userMessage = body ? body.trim() : "";
  let visionResult = null; // Variável para guardar a análise

  try {
    // 1. Carregar Config (Prompts)
    const businessConfig = await getMVPConfig();
    if (!businessConfig) return;

    // 2. VISÃO COMPUTACIONAL (Com Prompt do Banco)
    if (type === 'image' && mediaData) {
      console.log(`📸 Analisando imagem com prompt do DB...`);

      try {
        const visionPrompt = businessConfig.prompts?.visionSystem || "Descreva esta imagem.";
        visionResult = await analyzeImage(mediaData, visionPrompt);
      } catch (visionError) {
        console.error("Erro na análise de visão:", visionError.message);
      }

      if (visionResult) {
        console.log("✅ Visão OK");
        userMessage = `${userMessage}\n\n[VISÃO]: ${visionResult}`.trim();
      } else {
        // Se a visão falhar, adicionamos um log para o bot saber que houve imagem
        userMessage = `${userMessage} [Imagem enviada, mas não processada]`.trim();
      }
    }

    // === CORREÇÃO DO ERRO DE MONGOOSE ===
    // Se, após tudo, a mensagem ainda estiver vazia (ex: imagem sem legenda e visão falhou),
    // definimos um texto padrão para não quebrar o banco.
    if (!userMessage) {
      userMessage = `[Arquivo de ${type === 'audio' ? 'Áudio' : 'Mídia'}]`;
    }

    // 2. Salvar Mensagem (Agora garantimos que userMessage nunca é null/vazio)
    await saveMessage(from, 'user', userMessage, type, visionResult);

    // 3. Verificar Horário
    if (!isWithinOperatingHours(businessConfig)) {
      // TODO: Usar um OutputAdapter aqui para responder pelo canal certo
      // Por enquanto, só logamos se não for Twilio, pois sendWhatsAppMessage é só Twilio
      if (provider === 'twilio') await sendWhatsAppMessage(from, businessConfig.awayMessage);
      return;
    }

    // 4. Salvar Mensagem
    await saveMessage(from, 'user', userMessage, type, visionResult);

    // 4. Histórico de Conversa (Texto)
    const history = await getLastMessages(from, MAX_HISTORY);
    const historyText = history.reverse()
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Tatuador'}: ${m.content}`)
      .join('\n');

    // 5. Histórico de Imagens (Opcional - Contexto extra para o bot)
    // Se quiser que o bot lembre de fotos antigas, buscamos aqui
    const imageLog = await getImageHistory(from);
    let imageContext = "";
    if (imageLog.length > 0) {
      imageContext = "\nRESUMO DAS IMAGENS ENVIADAS ANTERIORMENTE:\n" +
        imageLog.map(img => `- (Data: ${img.timestamp.toISOString().split('T')[0]}): ${img.aiAnalysis.description}`).join('\n');
    }

    // 6. Montagem do Prompt Final
    const finalSystemPrompt = `
    ${businessConfig.prompts.chatSystem}
    ---
    ${imageContext}
    ---
    DADOS DO CLIENTE:
    Nome: ${name}
    Histórico da Conversa:
    ${historyText}
    ---
    `;

    // 7. Gerar Resposta IA
    const aiResponse = await generateAIResponse(userMessage, finalSystemPrompt);

    // 8. Enviar e Salvar
    if (aiResponse) {
      await sendUnifiedMessage(from, aiResponse, provider);
      await saveMessage(from, 'bot', aiResponse);
    }

  } catch (error) {
    console.error('💥 Erro Handler:', error);
  }
}

module.exports = { handleIncomingMessage };