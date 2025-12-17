const { saveMessage, getLastMessages, getImageHistory } = require('./services/message');
const { generateAIResponse } = require('./services/ai');
const { analyzeImage } = require('./services/visionService');
const { sendUnifiedMessage } = require('./services/responseService');
const BusinessConfig = require('./models/BusinessConfig');

const MAX_HISTORY = 30;

// Função auxiliar para verificar horário
function isWithinOperatingHours(businessConfig) {
  if (businessConfig.operatingHours && businessConfig.operatingHours.active === false) {
    return false;
  }
  if (!businessConfig.operatingHours || !businessConfig.operatingHours.opening) return true;

  const now = new Date();
  const hours = now.getUTCHours() - 3; // Ajuste BRT
  const currentHour = hours < 0 ? hours + 24 : hours;
  
  const [openH] = businessConfig.operatingHours.opening.split(':').map(Number);
  const [closeH] = businessConfig.operatingHours.closing.split(':').map(Number);

  return currentHour >= openH && currentHour < closeH;
}

// ==========================================
// 🚀 HANDLER UNIFICADO (MULTI-TENANT + MENU + CATÁLOGO)
// ==========================================
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

    // Fallback de segurança para prompts
    if (!businessConfig.prompts) {
        businessConfig.prompts = { chatSystem: "...", visionSystem: "..." }; 
    }

    // 3. VISÃO COMPUTACIONAL
    if (type === 'image' && mediaData) {
      console.log(`📸 Analisando imagem...`);
      try {
        const visionPrompt = businessConfig.prompts?.visionSystem || "Descreva esta imagem.";
        visionResult = await analyzeImage(mediaData, visionPrompt);
      } catch (visionError) {
        console.error("Erro na análise de visão:", visionError.message);
      }

      if (visionResult) {
        userMessage = `${userMessage}\n\n[VISÃO]: ${visionResult}`.trim();
      } else {
        userMessage = `${userMessage} [Imagem enviada, mas não processada]`.trim();
      }
    }

    if (!userMessage) userMessage = `[Arquivo de ${type === 'audio' ? 'Áudio' : 'Mídia'}]`;

    // 4. Salvar Mensagem do Usuário
    await saveMessage(from, 'user', userMessage, type, visionResult, activeBusinessId);

    // 5. Verificar Horário de Funcionamento
    if (!isWithinOperatingHours(businessConfig)) {
      console.log(`zzz Fora do horário.`);
      await sendUnifiedMessage(from, businessConfig.awayMessage, provider);
      return; // Para aqui se estiver fechado
    }

    // =========================================================================
    // 🆕 NOVIDADE 1: MENU DE RESPOSTAS RÁPIDAS (Palavras-Chave)
    // =========================================================================
    // Verifica se a mensagem contém alguma palavra-chave cadastrada (ex: "pix")
    if (businessConfig.menuOptions && businessConfig.menuOptions.length > 0) {
        const lowerMsg = userMessage.toLowerCase();
        
        // Procura uma opção onde a palavra-chave esteja contida na mensagem do usuário
        const matchedOption = businessConfig.menuOptions.find(opt => 
            lowerMsg.includes(opt.keyword.toLowerCase())
        );

        if (matchedOption) {
            console.log(`⚡ Resposta Rápida acionada: ${matchedOption.keyword}`);
            
            // Envia a resposta cadastrada
            await sendUnifiedMessage(from, matchedOption.response, provider);
            await saveMessage(from, 'bot', matchedOption.response, 'text', null, activeBusinessId);
            
            // Se requer humano, poderíamos notificar aqui (futuro)
            return; // 🛑 INTERROMPE AQUI (Não gasta IA)
        }
    }

    // 6. Histórico de Conversa
    const history = await getLastMessages(from, MAX_HISTORY, activeBusinessId);
    const historyText = history.reverse()
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Atendente'}: ${m.content}`)
      .join('\n');

    // 7. Histórico de Imagens
    const imageLog = await getImageHistory(from, activeBusinessId);
    let imageContext = "";
    if (imageLog.length > 0) {
      imageContext = "\nRESUMO DAS IMAGENS ENVIADAS ANTERIORMENTE:\n" +
        imageLog.map(img => `- (Data: ${img.timestamp.toISOString().split('T')[0]}): ${img.aiAnalysis.description}`).join('\n');
    }

    // =========================================================================
    // 🆕 NOVIDADE 2: INJETAR CATÁLOGO DE PRODUTOS NO CÉREBRO DA IA
    // =========================================================================
    let catalogContext = "";
    if (businessConfig.products && businessConfig.products.length > 0) {
        catalogContext = "\n--- TABELA DE PREÇOS E SERVIÇOS (Use estes dados para orçar) ---\n";
        catalogContext += businessConfig.products
            .map(p => `- ${p.name}: R$ ${p.price} (${p.description})`)
            .join('\n');
    }

    // 8. Montagem do Prompt Final (Agora com Catálogo!)
    const finalSystemPrompt = `
${businessConfig.prompts.chatSystem}
---
${catalogContext}
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

    // 10. Enviar e Salvar
    if (aiResponse) {
      await sendUnifiedMessage(from, aiResponse, provider);
      await saveMessage(from, 'bot', aiResponse, 'text', null, activeBusinessId);
    }

  } catch (error) {
    console.error('💥 Erro Handler:', error);
  }
}

module.exports = { handleIncomingMessage };