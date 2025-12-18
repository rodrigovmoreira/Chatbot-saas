const { saveMessage, getLastMessages, getImageHistory } = require('./services/message');
const { generateAIResponse } = require('./services/ai');
const { analyzeImage } = require('./services/visionService');
const { sendUnifiedMessage } = require('./services/responseService');
const BusinessConfig = require('./models/BusinessConfig');

const MAX_HISTORY = 30;

// ==========================================
// 🛡️ CONFIGURAÇÕES DE PROTEÇÃO (ANTI-LOOP)
// ==========================================
// Mapa em memória para contar mensagens: Chave = businessId_telefone
const rateLimitMap = new Map();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 Minuto
const MAX_MSGS_PER_WINDOW = 5;       // Máximo 5 msgs por minuto antes de bloquear
const COOLDOWN_TIME = 10 * 60 * 1000; // 10 Minutos de "castigo" se estourar
const HUMAN_DELAY_MIN = 3000; // 3 segundos
const HUMAN_DELAY_MAX = 8000; // 8 segundos

// Função auxiliar de Delay (Pausa)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Função auxiliar para verificar abuso/loop
function checkRateLimit(key) {
  const now = Date.now();
  let record = rateLimitMap.get(key);

  // 1. Novo registro
  if (!record) {
    rateLimitMap.set(key, { count: 1, startTime: now, isBlocked: false });
    return true; // Pode passar
  }

  // 2. Verifica se está bloqueado
  if (record.isBlocked) {
    if (now - record.blockedAt > COOLDOWN_TIME) {
      rateLimitMap.delete(key); // Perdoa o usuário após o tempo de castigo
      return true;
    }
    return false; // Continua bloqueado
  }

  // 3. Verifica janela de tempo (reset)
  if (now - record.startTime > RATE_LIMIT_WINDOW) {
    record.count = 1;
    record.startTime = now;
    return true;
  }

  // 4. Incrementa e verifica estouro
  record.count++;
  if (record.count > MAX_MSGS_PER_WINDOW) {
    console.warn(`🚫 LOOP DETECTADO: Bloqueando ${key} por 10 minutos.`);
    record.isBlocked = true;
    record.blockedAt = now;
    return false; // Bloqueia!
  }

  return true;
}

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
// 🚀 HANDLER UNIFICADO (MULTI-TENANT + MENU + CATÁLOGO + PROTEÇÃO)
// ==========================================
async function handleIncomingMessage(normalizedMsg, activeBusinessId) {
  const { from, body, name, type, mediaData, provider } = normalizedMsg;

  // Ignora se vazio e não for imagem
  if (!body && type === 'text') return;

  // 🛡️ 1. CHECK DE RATE LIMIT (Circuit Breaker)
  const limitKey = `${activeBusinessId}_${from}`;
  if (!checkRateLimit(limitKey)) {
    console.log(`🛑 Mensagem ignorada de ${from} (Rate Limit/Loop Ativo)`);
    return; // Encerra aqui: Não gasta IA, não responde, quebra o loop.
  }

  console.log(`📩 [${provider}] De: ${name} | Tipo: ${type}`);

  let userMessage = body ? body.trim() : "";
  let visionResult = null;

  try {
    // 2. SEGURANÇA SAAS: Verificar BusinessID
    if (!activeBusinessId) {
        console.error("❌ ERRO: Mensagem recebida sem BusinessID vinculado. Ignorando.");
        return;
    }

    // 3. Carregar Configuração DA EMPRESA ESPECÍFICA
    const businessConfig = await BusinessConfig.findById(activeBusinessId);
    
    if (!businessConfig) {
        console.error("❌ ERRO: Configuração da empresa não encontrada no banco.");
        return;
    }

    // Fallback de segurança para prompts
    if (!businessConfig.prompts) {
        businessConfig.prompts = { chatSystem: "...", visionSystem: "..." }; 
    }

    // 4. VISÃO COMPUTACIONAL
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

    // 5. Salvar Mensagem do Usuário
    await saveMessage(from, 'user', userMessage, type, visionResult, activeBusinessId);

    // 6. Verificar Horário de Funcionamento
    if (!isWithinOperatingHours(businessConfig)) {
      console.log(`zzz Fora do horário.`);
      await sendUnifiedMessage(from, businessConfig.awayMessage, provider, businessConfig.userId);
      return; // Para aqui se estiver fechado
    }

    // =========================================================================
    // 🆕 NOVIDADE 1: MENU DE RESPOSTAS RÁPIDAS (Palavras-Chave)
    // =========================================================================
    if (businessConfig.menuOptions && businessConfig.menuOptions.length > 0) {
        const lowerMsg = userMessage.toLowerCase();
        
        // Procura uma opção onde a palavra-chave esteja contida na mensagem do usuário
        const matchedOption = businessConfig.menuOptions.find(opt => 
            lowerMsg.includes(opt.keyword.toLowerCase())
        );

        if (matchedOption) {
            console.log(`⚡ Resposta Rápida acionada: ${matchedOption.keyword}`);
            
            // Envia a resposta cadastrada (Menu geralmente responde rápido, sem delay humanizado)
            await sendUnifiedMessage(from, matchedOption.response, provider, businessConfig.userId);
            await saveMessage(from, 'bot', matchedOption.response, 'text', null, activeBusinessId);
            
            return; // 🛑 INTERROMPE AQUI (Não gasta IA)
        }
    }

    // 7. Histórico de Conversa
    const history = await getLastMessages(from, MAX_HISTORY, activeBusinessId);
    const historyText = history.reverse()
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Atendente'}: ${m.content}`)
      .join('\n');

    // 8. Histórico de Imagens
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

    // 9. Montagem do Prompt Final
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

    // 10. Gerar Resposta IA
    const aiResponse = await generateAIResponse(userMessage, finalSystemPrompt);

    // 11. Enviar e Salvar (COM DELAY HUMANIZADO)
    if (aiResponse) {
      // Gera um delay aleatório entre 3s e 8s
      const delay = Math.floor(Math.random() * (HUMAN_DELAY_MAX - HUMAN_DELAY_MIN + 1)) + HUMAN_DELAY_MIN;
      console.log(`⏳ Digitando... (Aguardando ${delay}ms para parecer humano e evitar loops)`);
      
      await sleep(delay); // <--- AQUI ESTÁ A PROTEÇÃO CONTRA LOOP RÁPIDO

      await sendUnifiedMessage(from, aiResponse, provider, businessConfig.userId);
      await saveMessage(from, 'bot', aiResponse, 'text', null, activeBusinessId);
    }

  } catch (error) {
    console.error('💥 Erro Handler:', error);
  }
}

module.exports = { handleIncomingMessage };