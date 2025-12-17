const { saveMessage, getLastMessages, getImageHistory } = require('./services/message');
const { generateAIResponse } = require('./services/ai');
const { analyzeImage } = require('./services/visionService');
const { sendUnifiedMessage } = require('./services/responseService');
const BusinessConfig = require('./models/BusinessConfig');

const MAX_HISTORY = 30;

// Função auxiliar para verificar horário usando a config carregada
function isWithinOperatingHours(businessConfig) {
  if (businessConfig.operatingHours && businessConfig.operatingHours.active === false) {
    return false;
  }
  if (!businessConfig.operatingHours || !businessConfig.operatingHours.opening) return true;

  const now = new Date();
  const hours = now.getUTCHours() - 3; // Ajuste manual para BRT (ou usar lib de timezone no futuro)
  const currentHour = hours < 0 ? hours + 24 : hours;
  
  const [openH] = businessConfig.operatingHours.opening.split(':').map(Number);
  const [closeH] = businessConfig.operatingHours.closing.split(':').map(Number);

  return currentHour >= openH && currentHour < closeH;
}

// ==========================================
// 🚀 HANDLER UNIFICADO (MULTI-TENANT)
// ==========================================
// Recebe activeBusinessId para saber de qual empresa é essa mensagem
async function handleIncomingMessage(normalizedMsg, activeBusinessId) {
  const { from, body, name, type, mediaData, provider } = normalizedMsg;

  // Ignora se vazio e não for imagem
  if (!body && type === 'text') return;

  console.log(`📩 [${provider}] De: ${name} | Tipo: ${type}`);

  let userMessage = body ? body.trim() : "";
  let visionResult = null;

  try {
    // 1. SEGURANÇA SAAS: Verificar BusinessID
    if (!activeBusinessId) {
        console.error("❌ ERRO: Mensagem recebida sem BusinessID vinculado. Ignorando.");
        return;
    }

    // 2. Carregar Configuração DA EMPRESA ESPECÍFICA
    const businessConfig = await BusinessConfig.findById(activeBusinessId);
    
    if (!businessConfig) {
        console.error("❌ ERRO: Configuração da empresa não encontrada no banco.");
        return;
    }

    // Fallback de segurança para prompts se não existirem
    if (!businessConfig.prompts) {
        businessConfig.prompts = { chatSystem: "...", visionSystem: "..." }; 
    }

    // 3. VISÃO COMPUTACIONAL (Com Prompt do Banco)
    if (type === 'image' && mediaData) {
      console.log(`📸 Analisando imagem...`);

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
        userMessage = `${userMessage} [Imagem enviada, mas não processada]`.trim();
      }
    }

    // Fallback para não quebrar o banco se a mensagem ficar vazia
    if (!userMessage) {
      userMessage = `[Arquivo de ${type === 'audio' ? 'Áudio' : 'Mídia'}]`;
    }

    // 4. Salvar Mensagem do Usuário (Com ID da Empresa)
    await saveMessage(from, 'user', userMessage, type, visionResult, activeBusinessId);

    // 5. Verificar Horário de Funcionamento
    if (!isWithinOperatingHours(businessConfig)) {
      console.log(`zzz Fora do horário. Enviando mensagem de ausência.`);
      // Envia mensagem de ausência pelo canal correto
      await sendUnifiedMessage(from, businessConfig.awayMessage, provider);
      // Opcional: Salvar a resposta automática do bot
      // await saveMessage(from, 'bot', businessConfig.awayMessage, 'text', null, activeBusinessId);
      return;
    }

    // 6. Histórico de Conversa (Filtrado pela Empresa)
    const history = await getLastMessages(from, MAX_HISTORY, activeBusinessId);
    const historyText = history.reverse()
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Atendente'}: ${m.content}`)
      .join('\n');

    // 7. Histórico de Imagens (Filtrado pela Empresa)
    const imageLog = await getImageHistory(from, activeBusinessId);
    let imageContext = "";
    if (imageLog.length > 0) {
      imageContext = "\nRESUMO DAS IMAGENS ENVIADAS ANTERIORMENTE:\n" +
        imageLog.map(img => `- (Data: ${img.timestamp.toISOString().split('T')[0]}): ${img.aiAnalysis.description}`).join('\n');
    }

    // 8. Montagem do Prompt Final
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

    // 9. Gerar Resposta IA
    const aiResponse = await generateAIResponse(userMessage, finalSystemPrompt);

    // 10. Enviar e Salvar (Com ID da Empresa)
    if (aiResponse) {
      await sendUnifiedMessage(from, aiResponse, provider);
      await saveMessage(from, 'bot', aiResponse, 'text', null, activeBusinessId);
    }

  } catch (error) {
    console.error('💥 Erro Handler:', error);
  }
}

module.exports = { handleIncomingMessage };