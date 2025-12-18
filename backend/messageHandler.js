const { saveMessage, getLastMessages, getImageHistory } = require('./services/message');
const { generateAIResponse } = require('./services/ai');
const { analyzeImage } = require('./services/visionService');
const { sendUnifiedMessage } = require('./services/responseService');
const BusinessConfig = require('./models/BusinessConfig');

const MAX_HISTORY = 30;

// === CONTROLE DE PAUSA (ATENDIMENTO HUMANO) ===
// Chave: businessId_telefone -> Valor: Timestamp de quando pode voltar a falar
const humanPauseMap = new Map();
const HUMAN_PAUSE_TIME = 30 * 60 * 1000; // 30 Minutos

// === CONTROLE DE PROTEÇÃO (ANTI-LOOP) ===
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_MSGS_PER_WINDOW = 5;
const COOLDOWN_TIME = 10 * 60 * 1000;
const HUMAN_DELAY_MIN = 3000;
const HUMAN_DELAY_MAX = 8000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function checkRateLimit(key) {
  const now = Date.now();
  let record = rateLimitMap.get(key);
  if (!record) { rateLimitMap.set(key, { count: 1, startTime: now, isBlocked: false }); return true; }
  if (record.isBlocked) { if (now - record.blockedAt > COOLDOWN_TIME) { rateLimitMap.delete(key); return true; } return false; }
  if (now - record.startTime > RATE_LIMIT_WINDOW) { record.count = 1; record.startTime = now; return true; }
  record.count++;
  if (record.count > MAX_MSGS_PER_WINDOW) { record.isBlocked = true; record.blockedAt = now; return false; }
  return true;
}

function isWithinOperatingHours(businessConfig) {
  if (businessConfig.operatingHours && businessConfig.operatingHours.active === false) return false;
  if (!businessConfig.operatingHours || !businessConfig.operatingHours.opening) return true;
  const now = new Date();
  const hours = now.getUTCHours() - 3;
  const currentHour = hours < 0 ? hours + 24 : hours;
  const [openH] = businessConfig.operatingHours.opening.split(':').map(Number);
  const [closeH] = businessConfig.operatingHours.closing.split(':').map(Number);
  return currentHour >= openH && currentHour < closeH;
}

// ==========================================
// 🚀 HANDLER PRINCIPAL
// ==========================================
async function handleIncomingMessage(normalizedMsg, activeBusinessId) {
  const { from, body, name, type, mediaData, provider } = normalizedMsg;
  if (!body && type === 'text') return;

  const uniqueKey = `${activeBusinessId}_${from}`;

  // 1. VERIFICA SE ESTÁ EM PAUSA (ATENDIMENTO HUMANO)
  const pauseUntil = humanPauseMap.get(uniqueKey);
  if (pauseUntil && Date.now() < pauseUntil) {
    console.log(`🔇 Bot pausado para ${from} (Aguardando Humano)...`);
    return; // Não responde nada
  }

  // 2. CHECK DE RATE LIMIT
  if (!checkRateLimit(uniqueKey)) return;

  console.log(`📩 [${provider}] De: ${name} | Tipo: ${type}`);
  
  let userMessage = body ? body.trim() : "";
  let visionResult = null;

  try {
    if (!activeBusinessId) return;
    const businessConfig = await BusinessConfig.findById(activeBusinessId);
    if (!businessConfig) return;
    if (!businessConfig.prompts) businessConfig.prompts = { chatSystem: "...", visionSystem: "..." };

    // 3. VISÃO COMPUTACIONAL
    if (type === 'image' && mediaData) {
      // ... (Lógica de visão mantém igual) ...
      try {
        const visionPrompt = businessConfig.prompts?.visionSystem || "Descreva esta imagem.";
        visionResult = await analyzeImage(mediaData, visionPrompt);
        if (visionResult) userMessage = `${userMessage}\n\n[VISÃO]: ${visionResult}`.trim();
      } catch (e) { console.error(e); }
    }
    if (!userMessage) userMessage = `[Arquivo de ${type === 'audio' ? 'Áudio' : 'Mídia'}]`;

    // Salva msg do usuário
    await saveMessage(from, 'user', userMessage, type, visionResult, activeBusinessId);

    // 4. HORÁRIO
    if (!isWithinOperatingHours(businessConfig)) {
      await sendUnifiedMessage(from, businessConfig.awayMessage, provider, businessConfig.userId);
      return;
    }

    // =========================================================================
    // 🆕 LÓGICA DE RESPOSTAS RÁPIDAS (ATUALIZADA)
    // =========================================================================
    if (businessConfig.menuOptions && businessConfig.menuOptions.length > 0) {
        const lowerMsg = userMessage.toLowerCase();
        
        // Procura opção batendo as keywords (separadas por vírgula)
        const matchedOption = businessConfig.menuOptions.find(opt => {
            const keywords = opt.keyword.split(',').map(k => k.trim().toLowerCase());
            return keywords.some(k => k && lowerMsg.includes(k));
        });

        if (matchedOption) {
            console.log(`⚡ Resposta Rápida: "${matchedOption.description}"`);
            
            let finalResponse = matchedOption.response;

            // A. SE PRECISAR DE IA PARA PERSONALIZAR
            if (matchedOption.useAI) {
                console.log("🤖 Usando IA para personalizar resposta rápida...");
                const promptContext = `
${businessConfig.prompts.chatSystem}
---
INSTRUÇÃO ESPECIAL:
O usuário perguntou sobre: "${matchedOption.keyword}".
A informação oficial da empresa é: "${matchedOption.response}".
Sua tarefa: Responda ao usuário de forma natural e educada usando APENAS a informação oficial acima. Não invente dados.
---
Cliente: ${userMessage}
`;
                // Gera resposta curta e rápida
                const aiGen = await generateAIResponse(userMessage, promptContext);
                if (aiGen) finalResponse = aiGen;
            }

            // B. SE FOR ATENDIMENTO HUMANO -> PAUSA O BOT
            if (matchedOption.requiresHuman) {
                console.log(`🛑 Atendimento Humano solicitado. Pausando bot por 30min para ${from}`);
                humanPauseMap.set(uniqueKey, Date.now() + HUMAN_PAUSE_TIME);
                // Adiciona aviso ao final da mensagem se não for IA (opcional)
                // finalResponse += "\n\n(Um atendente humano foi notificado)";
            }

            // Envia e Salva
            await sendUnifiedMessage(from, finalResponse, provider, businessConfig.userId);
            await saveMessage(from, 'bot', finalResponse, 'text', null, activeBusinessId);
            return; // 🛑 Fim do processamento
        }
    }

    // 5. Histórico e IA Padrão (Se não caiu no menu)
    const history = await getLastMessages(from, MAX_HISTORY, activeBusinessId);
    const historyText = history.reverse().map(m => `${m.role === 'user' ? 'Cliente' : 'Atendente'}: ${m.content}`).join('\n');
    
    // ... (Lógica de Catálogo e Imagem mantém igual) ...
    let catalogContext = "";
    if (businessConfig.products?.length > 0) {
        catalogContext = "\n--- TABELA DE PREÇOS ---\n" + businessConfig.products.map(p => `- ${p.name}: R$ ${p.price}`).join('\n');
    }

    const finalSystemPrompt = `${businessConfig.prompts.chatSystem}\n---\n${catalogContext}\n---\nDADOS: ${name}\nHISTÓRICO:\n${historyText}`;

    const aiResponse = await generateAIResponse(userMessage, finalSystemPrompt);

    if (aiResponse) {
      const delay = Math.floor(Math.random() * (HUMAN_DELAY_MAX - HUMAN_DELAY_MIN + 1)) + HUMAN_DELAY_MIN;
      await sleep(delay);
      await sendUnifiedMessage(from, aiResponse, provider, businessConfig.userId);
      await saveMessage(from, 'bot', aiResponse, 'text', null, activeBusinessId);
    }

  } catch (error) {
    console.error('💥 Erro Handler:', error);
  }
}

module.exports = { handleIncomingMessage };