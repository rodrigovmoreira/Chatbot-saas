const axios = require('axios');
const { saveMessage, getLastMessages } = require('./services/message');
const { analyzeImage } = require('./services/visionService');
const { transcribeAudio } = require('./services/transcriptionService');
const { sendUnifiedMessage } = require('./services/responseService');
const wwebjsService = require('./services/wwebjsService');
const BusinessConfig = require('./models/BusinessConfig');
const aiTools = require('./services/aiTools');

const MAX_HISTORY = 30;

// === CONTROLE DE PAUSA (ATENDIMENTO HUMANO) ===
const humanPauseMap = new Map();
const HUMAN_PAUSE_TIME = 30 * 60 * 1000;

// === CONTROLE DE PROTEÇÃO (ANTI-LOOP) ===
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_MSGS_PER_WINDOW = 5;
const COOLDOWN_TIME = 10 * 60 * 1000;
const HUMAN_DELAY_MIN = 5000;
const HUMAN_DELAY_MAX = 15000;

// === BUFFER DE MENSAGENS ===
const messageBuffer = new Map();
const BUFFER_DELAY = 11000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --- FUNÇÃO AUXILIAR: CHAMADA AO DEEPSEEK ---
async function callDeepSeek(messages) {
    try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        const apiUrl = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
        const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

        const response = await axios.post(
            apiUrl,
            {
                model: model,
                messages: messages,
                max_tokens: 500,
                temperature: 0.7,
                stream: false,
                response_format: { type: 'text' }
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("❌ Erro DeepSeek API:", error.response?.data || error.message);
        throw error;
    }
}

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
// 🚀 PROCESSADOR DE MENSAGENS BUFFERIZADAS
// ==========================================
async function processBufferedMessages(uniqueKey) {
  const bufferData = messageBuffer.get(uniqueKey);
  if (!bufferData) return;

  // Limpa o buffer para novas mensagens
  messageBuffer.delete(uniqueKey);

  const { messages, from, name, activeBusinessId, provider } = bufferData;
  const userMessage = messages.join('\n');

  console.log(`📨 Processando buffer para ${name} (${from}):\n"${userMessage}"`);

  try {
    if (!activeBusinessId) return;
    const businessConfig = await BusinessConfig.findById(activeBusinessId);
    if (!businessConfig) return;
    if (!businessConfig.prompts) businessConfig.prompts = { chatSystem: "...", visionSystem: "..." };

    // Salva a mensagem combinada como 'user'
    await saveMessage(from, 'user', userMessage, 'text', null, activeBusinessId);

    // 4. HORÁRIO
    if (!isWithinOperatingHours(businessConfig)) {
      await sendUnifiedMessage(from, businessConfig.awayMessage, provider, businessConfig.userId);
      return;
    }

    // =========================================================================
    // ⚡ MENU DE RESPOSTAS RÁPIDAS
    // =========================================================================
    if (businessConfig.menuOptions && businessConfig.menuOptions.length > 0) {
      const lowerMsg = userMessage.toLowerCase();
      const matchedOption = businessConfig.menuOptions.find(opt => {
        const keywords = opt.keyword.split(',').map(k => k.trim().toLowerCase());
        return keywords.some(k => k && lowerMsg.includes(k));
      });

      if (matchedOption) {
        console.log(`⚡ Resposta Rápida: "${matchedOption.description}"`);
        let finalResponse = matchedOption.response;

        if (matchedOption.useAI) {
          const menuPrompt = `
${businessConfig.prompts.chatSystem}
---
INSTRUÇÃO: O usuário perguntou sobre "${matchedOption.keyword}".
A informação oficial é: "${matchedOption.response}".
Responda de forma natural usando APENAS a informação oficial.
Cliente: ${userMessage}`;

          try {
            finalResponse = await callDeepSeek([
                { role: "user", content: menuPrompt }
            ]);
          } catch (e) { console.error("Erro IA Menu:", e); }
        }

        if (matchedOption.requiresHuman) {
          console.log(`🛑 Atendimento Humano solicitado.`);
          humanPauseMap.set(uniqueKey, Date.now() + HUMAN_PAUSE_TIME);
        }

        await sendUnifiedMessage(from, finalResponse, provider, businessConfig.userId);
        await saveMessage(from, 'bot', finalResponse, 'text', null, activeBusinessId);
        return;
      }
    }

    // =========================================================================
    // 🧠 CÉREBRO DA IA + AGENDA (AGORA COM DEEPSEEK)
    // =========================================================================

    // A. Contexto Temporal
    const now = new Date();
    const todayStr = now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let catalogContext = "";
    if (businessConfig.products?.length > 0) {
      catalogContext = "REFERENCE ONLY: Use this catalog to answer questions. Do not list these items unless asked.\n\n--- TABELA DE PREÇOS ---\n" + businessConfig.products.map(p => `- ${p.name}: R$ ${p.price}`).join('\n');

      const allTags = new Set();
      businessConfig.products.forEach(p => {
          if (p.tags && Array.isArray(p.tags)) {
              p.tags.forEach(t => allTags.add(t));
          }
      });
      const uniqueTags = Array.from(allTags).join(', ');

      if (uniqueTags) {
          catalogContext += `\n\nCONTEXT: You have a product catalog containing items related to: [${uniqueTags}]. If the user's intent matches these, ALWAYS use the search_catalog tool.`;
      }
    }

    // B. System Prompt
    const { instagram, website, portfolio } = businessConfig.socialMedia || {};

    const systemInstruction = `
Instruction: "CONTEXT AWARENESS: Before answering, check the last message sent by 'assistant' in the history. If you have already explained the business focus or pricing in the last turn, DO NOT repeat it. Answer only the specific new question (e.g., 'No, we don't have that option'). Be direct and conversational."

--- AUDIO & IMAGE HANDLING ---
1. If you receive text marked as `[Transcrição do Áudio]: "..."`, it means the user sent a voice message that has been converted to text for you.
   - TREAT THIS AS DIRECT USER INPUT.
   - DO NOT say "I cannot listen to audio" or "I cannot play messages".
   - Answer the content of the transcription naturally.
2. If you receive `[VISÃO DA IMAGEM]`, treat it as what the user is showing you.

${businessConfig.prompts.chatSystem}

--- CONTEXTO ATUAL ---
Hoje é: ${todayStr}.
Hora atual: ${timeStr}.

${catalogContext}

--- LINKS & CONTATOS ---
Se o usuário pedir pelo site, portfólio ou instagram, responda imediatamente com os links abaixo:
Instagram: ${instagram || 'Não informado'}
Site: ${website || 'Não informado'}
Portfólio: ${portfolio || 'Não informado'}

--- FERRAMENTAS DE AGENDA E CATÁLOGO ---
Você tem acesso total à agenda e ao catálogo visual. Siga este protocolo:
1. Se o usuário perguntar disponibilidade, VERIFIQUE a agenda antes de responder.
2. Para agendar, confirme o nome e o horário.
3. Se o cliente pedir para ver exemplos, fotos, portfólio ou produtos, USE a busca de catálogo.
   - Ao buscar produtos, tente identificar categorias gerais (ex: 'promoção', 'opções') na intenção do usuário, não apenas nomes de objetos específicos.
4. Para executar ações, responda APENAS um JSON puro (sem markdown) no formato:
   - Verificar: {"action": "check", "start": "YYYY-MM-DDTHH:mm", "end": "YYYY-MM-DDTHH:mm"}
   - Agendar: {"action": "book", "clientName": "Nome", "start": "YYYY-MM-DDTHH:mm", "title": "Serviço"}
   - Buscar Fotos: {"action": "search_catalog", "keywords": ["tag1", "tag2"]}
5. Se for conversa normal, responda apenas o texto.
`;

    // C. Montagem do Histórico
    const dbHistory = await getLastMessages(from, MAX_HISTORY, activeBusinessId);
    
    const messages = [
        { role: "system", content: systemInstruction }
    ];

    dbHistory.reverse().forEach(m => {
        if (m.content && m.content.trim()) {
            messages.push({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content
            });
        }
    });

    messages.push({ role: "user", content: userMessage });

    let finalResponseText = "";

    try {
      console.log("🤖 Enviando para DeepSeek...");
      const responseText = await callDeepSeek(messages);

      const cleanResponse = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        try {
          const command = JSON.parse(jsonMatch[0]);
          let toolResult = "";

          if (command.action === 'check') {
            console.log(`🔍 IA verificando agenda: ${command.start}`);
            const endT = command.end || new Date(new Date(command.start).getTime() + 60 * 60000).toISOString();
            const check = await aiTools.checkAvailability(businessConfig.userId, command.start, endT);
            toolResult = check.available 
              ? "O horário está LIVRE. Pode oferecer." 
              : `O horário está OCUPADO. Motivo: ${check.reason}.`;
          }

          if (command.action === 'book') {
            console.log(`📅 IA tentando agendar: ${command.start} para ${command.clientName}`);
            const endT = command.end || new Date(new Date(command.start).getTime() + 60 * 60000).toISOString();

            const booking = await aiTools.createAppointmentByAI(businessConfig.userId, {
              clientName: command.clientName || name || "Cliente",
              clientPhone: from,
              title: command.title || "Agendamento via IA",
              start: command.start,
              end: endT
            });

            console.log("📅 Resultado do agendamento:", booking);

            if (booking.success) {
                toolResult = `SUCESSO: Agendamento salvo no banco de dados (ID: ${booking.data._id}). Pode confirmar ao cliente.`;
            } else {
                toolResult = `ERRO CRÍTICO: O agendamento FALHOU. Motivo: ${booking.error}. NÃO confirme o agendamento. Peça desculpas e tente novamente.`;
            }
          }

          if (command.action === 'search_catalog') {
            console.log(`🖼️ IA buscando catálogo: ${command.keywords}`);
            const products = await aiTools.searchProducts(businessConfig.userId, command.keywords);

            if (products.length > 0) {
              let count = 0;
              for (const p of products) {
                if (count >= 5) break;

                const caption = `${p.name} - R$ ${p.price}\n${p.description || ''}`;

                if (p.imageUrls && p.imageUrls.length > 0) {
                   await wwebjsService.sendImage(businessConfig.userId, from, p.imageUrls[0], caption);
                   for (let i = 1; i < p.imageUrls.length; i++) {
                      await wwebjsService.sendImage(businessConfig.userId, from, p.imageUrls[i], "");
                   }
                   count++;
                } else {
                    await sendUnifiedMessage(from, caption, provider, businessConfig.userId);
                }
              }
              toolResult = `Encontrei ${products.length} produtos e já enviei ${count} com fotos para o cliente.`;
            } else {
              toolResult = "Nenhum produto encontrado com essas palavras-chave.";
            }
          }

          messages.push({ role: "assistant", content: cleanResponse });
          messages.push({ role: "user", content: `[SISTEMA]: Resultado da ação: ${toolResult}. Agora responda ao cliente confirmando ou oferecendo outra opção.` });

          console.log("🤖 Enviando resultado da ferramenta para DeepSeek...");
          finalResponseText = await callDeepSeek(messages);

        } catch (jsonErr) {
          console.error("Erro JSON IA:", jsonErr);
          finalResponseText = responseText;
        }
      } else {
        finalResponseText = responseText;
      }

    } catch (aiErr) {
      console.error("Erro Geração IA:", aiErr);
      return; 
    }

    const delay = Math.floor(Math.random() * (HUMAN_DELAY_MAX - HUMAN_DELAY_MIN + 1)) + HUMAN_DELAY_MIN;
    console.log(`⏱️ Aguardando ${delay}ms antes de responder...`);
    await sleep(delay);

    await sendUnifiedMessage(from, finalResponseText, provider, businessConfig.userId);
    await saveMessage(from, 'bot', finalResponseText, 'text', null, activeBusinessId);

  } catch (error) {
    console.error('💥 Erro Buffer Process:', error);
  }
}

// ==========================================
// 🚀 HANDLER PRINCIPAL (AGORA COM BUFFER)
// ==========================================
async function handleIncomingMessage(normalizedMsg, activeBusinessId) {
  const { from, body, name, type, mediaData, provider } = normalizedMsg;
  if (!body && type === 'text') return;

  const uniqueKey = `${activeBusinessId}_${from}`;

  // 1. VERIFICA PAUSA
  const pauseUntil = humanPauseMap.get(uniqueKey);
  if (pauseUntil && Date.now() < pauseUntil) {
    console.log(`🔇 Bot pausado para ${from} (Aguardando Humano)...`);
    return;
  }

  // 2. RATE LIMIT
  if (!checkRateLimit(uniqueKey)) return;

  console.log(`📩 [${provider}] De: ${name} | Tipo: ${type}`);

  let textToBuffer = body ? body.trim() : "";

  // 3. PRÉ-PROCESSAMENTO (VISÃO / ÁUDIO)
  if (type === 'image' && mediaData) {
    try {
      const businessConfig = await BusinessConfig.findById(activeBusinessId);
      const visionPrompt = businessConfig?.prompts?.visionSystem || "Descreva esta imagem.";

      const visionResult = await analyzeImage(mediaData, visionPrompt);
      const desc = visionResult ? `[VISÃO DA IMAGEM]: ${visionResult}` : "[IMAGEM ENVIADA]";
      textToBuffer = textToBuffer ? `${textToBuffer}\n${desc}` : desc;
    } catch (e) {
        console.error("Erro Visão:", e);
        textToBuffer = textToBuffer ? `${textToBuffer}\n[IMAGEM COM ERRO]` : "[IMAGEM COM ERRO]";
    }
  } else if (type === 'audio') {
      try {
        const transcription = await transcribeAudio(mediaData);
        const audioDesc = transcription ? `[Transcrição do Áudio]: "${transcription}"` : "[Áudio sem transcrição]";
        textToBuffer = textToBuffer ? `${textToBuffer}\n${audioDesc}` : audioDesc;
      } catch (e) {
        console.error("Erro Transcrição:", e);
        textToBuffer = "[Erro ao processar áudio]";
      }
  } else if (type !== 'text') {
      // Outros tipos de mídia
      const mediaDesc = `[Mídia: ${type}]`;
      textToBuffer = textToBuffer ? `${textToBuffer}\n${mediaDesc}` : mediaDesc;
  }

  // Se não sobrou nada (ex: texto vazio e sem mídia), ignora
  if (!textToBuffer) return;

  // 4. ATUALIZA BUFFER
  let buffer = messageBuffer.get(uniqueKey);

  if (buffer) {
      clearTimeout(buffer.timer);
      buffer.messages.push(textToBuffer);
      // Atualiza metadados se necessário
      buffer.lastActiveBusinessId = activeBusinessId;
  } else {
      buffer = {
          messages: [textToBuffer],
          from,
          name,
          activeBusinessId,
          provider,
          timer: null
      };
  }

  // Define novo timer
  buffer.timer = setTimeout(() => {
      processBufferedMessages(uniqueKey);
  }, BUFFER_DELAY);

  messageBuffer.set(uniqueKey, buffer);
  console.log(`⏳ Mensagem de ${from} bufferizada. (Total: ${buffer.messages.length})`);
}

module.exports = { handleIncomingMessage };
