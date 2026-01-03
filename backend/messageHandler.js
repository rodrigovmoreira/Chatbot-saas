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

  const timeZone = businessConfig.operatingHours.timezone || 'America/Sao_Paulo';

  // Get current time in target timezone
  const now = new Date();
  const localDateString = now.toLocaleString('en-US', { timeZone, hour12: false });
  const localDate = new Date(localDateString);
  const currentHour = localDate.getHours();
  // const currentMinute = localDate.getMinutes(); // Optional if you need minute precision later

  const [openH, openM] = businessConfig.operatingHours.opening.split(':').map(Number);
  const [closeH, closeM] = businessConfig.operatingHours.closing.split(':').map(Number);

  const currentMinutes = currentHour * 60 + localDate.getMinutes();
  const openMinutes = openH * 60 + (openM || 0);
  const closeMinutes = closeH * 60 + (closeM || 0);

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

// ==========================================
// 🚀 PROCESSADOR DE MENSAGENS BUFFERIZADAS
// ==========================================
async function processBufferedMessages(uniqueKey) {
  const bufferData = messageBuffer.get(uniqueKey);
  if (!bufferData) return;

  // Limpa o buffer para novas mensagens
  messageBuffer.delete(uniqueKey);

  const { messages, from, name, activeBusinessId, provider, channel, resolve } = bufferData;
  const userMessage = messages.join('\n');

  try {
    if (!activeBusinessId) {
        if (resolve) resolve({ success: false, error: 'No active business ID' });
        return;
    }
    const businessConfig = await BusinessConfig.findById(activeBusinessId);
    if (!businessConfig) {
        if (resolve) resolve({ success: false, error: 'Business config not found' });
        return;
    }
    if (!businessConfig.prompts) businessConfig.prompts = { chatSystem: "...", visionSystem: "..." };

    // Salva a mensagem combinada como 'user'
    await saveMessage(from, 'user', userMessage, 'text', null, activeBusinessId, channel);

    // 4. HORÁRIO
    if (!isWithinOperatingHours(businessConfig)) {
      const awayMsg = businessConfig.awayMessage;

      // FIX: Prevent 'Away Message' Loop
      const lastMessages = await getLastMessages(from, 1, activeBusinessId, channel);
      if (lastMessages && lastMessages.length > 0) {
          const lastMsg = lastMessages[0];
          if (lastMsg.role === 'bot' && lastMsg.content === awayMsg) {
             console.log(`🔕 Away Message suprimida para ${from} (loop prevent).`);
             if (channel === 'web' && resolve) resolve({ text: "" });
             return;
          }
      }

      // FIX: Save the away message to history so conversation isn't empty
      await saveMessage(from, 'bot', awayMsg, 'text', null, activeBusinessId, channel);

      if (channel === 'web' && resolve) {
          resolve({ text: awayMsg });
      } else {
          await sendUnifiedMessage(from, awayMsg, provider, businessConfig.userId);
      }
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
          humanPauseMap.set(uniqueKey, Date.now() + HUMAN_PAUSE_TIME);
        }

        if (channel === 'web' && resolve) {
            resolve({ text: finalResponse });
        } else {
            await sendUnifiedMessage(from, finalResponse, provider, businessConfig.userId);
        }
        await saveMessage(from, 'bot', finalResponse, 'text', null, activeBusinessId, channel);
        return;
      }
    }

    // =========================================================================
    // 🧠 CÉREBRO DA IA + AGENDA (AGORA COM DEEPSEEK)
    // =========================================================================

    // A. Contexto Temporal
    const timeZone = businessConfig.operatingHours?.timezone || 'America/Sao_Paulo';
    const now = new Date();

    // Force timezone in formatting
    const todayStr = now.toLocaleDateString('pt-BR', {
        timeZone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const timeStr = now.toLocaleTimeString('pt-BR', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit'
    });

    let catalogContext = "";
    if (businessConfig.products?.length > 0) {
      const allTags = new Set();
      businessConfig.products.forEach(p => {
          if (p.tags && Array.isArray(p.tags)) {
              p.tags.forEach(t => allTags.add(t));
          }
      });
      const uniqueTags = Array.from(allTags).join(', ');

      if (uniqueTags) {
          catalogContext = `CONTEXT: You have a database of products related to: [${uniqueTags}]. DO NOT guess prices. If the user asks about a product, you MUST use the search_catalog tool to find it.`;
      }
    }

    // B. System Prompt
    const { instagram, website, portfolio } = businessConfig.socialMedia || {};

    const systemInstruction = `
STYLE: WhatsApp Chat. Short messages (max 2 sentences). No formal introductions. Use emojis sparingly.
BEHAVIOR: Answer ONLY what was asked. Do not offer help unless necessary.

Instruction: "CONTEXT AWARENESS: Before answering, check the last message sent by 'assistant' in the history. If you have already explained the business focus or pricing in the last turn, DO NOT repeat it. Answer only the specific new question (e.g., 'No, we don't have that option'). Be direct and conversational."

--- AUDIO & IMAGE HANDLING ---
1. If you receive text marked as \`[Transcrição do Áudio]: "..."\`, it means the user sent a voice message that has been converted to text for you.
   - TREAT THIS AS DIRECT USER INPUT.
   - DO NOT say "I cannot listen to audio" or "I cannot play messages".
   - Answer the content of the transcription naturally.
2. If you receive \`[VISÃO DA IMAGEM]\`, treat it as what the user is showing you.
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
Você tem acesso total à agenda e ao catálogo visual.
CRITICAL PROTOCOL FOR ACTIONS:
1. **SILENT EXECUTION:** When you have enough information to Schedule, Check Availability, or Search, **DO NOT** write conversational filler like "Just a moment", "I will check", or "Let me see".
2. **IMMEDIATE JSON:** Output **ONLY** the JSON command immediately. The system will process it and show the result to you.
3. **Format:**
   - Verificar: {"action": "check", "start": "YYYY-MM-DDTHH:mm", "end": "YYYY-MM-DDTHH:mm"}
   - Agendar: {"action": "book", "clientName": "Nome", "start": "YYYY-MM-DDTHH:mm", "title": "Serviço"}
   - Buscar Fotos: {"action": "search_catalog", "keywords": ["tag1", "tag2"]}

Example of CORRECT behavior:
User: "I want 9am tomorrow."
Assistant: {"action": "book", "clientName": "Rodrigo", "start": "2026-01-01T09:00:00", "title": "Corte"}

Example of WRONG behavior (Do NOT do this):
Assistant: "Ok, I will schedule that for you. {"action": "book"...}" (Do not add text before JSON)
`;

    // C. Montagem do Histórico
    const dbHistory = await getLastMessages(from, MAX_HISTORY, activeBusinessId, channel);
    
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
      console.log('--- 🧠 DEEPSEEK FULL PROMPT ---');
      console.log(JSON.stringify(messages, null, 2));
      console.log('-------------------------------');

      const responseText = await callDeepSeek(messages);

      const cleanResponse = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        try {
          const command = JSON.parse(jsonMatch[0]);
          let toolResult = "";

          if (command.action === 'check') {
            const endT = command.end || new Date(new Date(command.start).getTime() + 60 * 60000).toISOString();
            const check = await aiTools.checkAvailability(businessConfig.userId, command.start, endT);
            toolResult = check.available 
              ? "O horário está LIVRE. Pode oferecer." 
              : `O horário está OCUPADO. Motivo: ${check.reason}.`;
          }

          if (command.action === 'book') {
            const endT = command.end || new Date(new Date(command.start).getTime() + 60 * 60000).toISOString();

            const booking = await aiTools.createAppointmentByAI(businessConfig.userId, {
              clientName: command.clientName || name || "Cliente",
              clientPhone: from,
              title: command.title || "Agendamento via IA",
              start: command.start,
              end: endT
            });

            if (booking.success) {
                toolResult = `SUCESSO: Agendamento salvo no banco de dados (ID: ${booking.data._id}). Pode confirmar ao cliente.`;
            } else {
                toolResult = `ERRO CRÍTICO: O agendamento FALHOU. Motivo: ${booking.error}. NÃO confirme o agendamento. Peça desculpas e tente novamente.`;
            }
          }

          if (command.action === 'search_catalog') {
            const products = await aiTools.searchProducts(businessConfig.userId, command.keywords);

            if (products.length > 0) {
              let count = 0;
              for (const p of products) {
                if (count >= 5) break;

                const caption = `${p.name} - R$ ${p.price}\n${p.description || ''}`;

                if (p.imageUrls && p.imageUrls.length > 0) {
                   if (channel === 'web') {
                       // For web, we might just append links or JSON logic.
                       // For now, let's just append the info to the text response
                       // Or maybe we can handle rich responses later.
                       // For MVP, just return text description.
                   } else {
                       await wwebjsService.sendImage(businessConfig.userId, from, p.imageUrls[0], caption);
                       for (let i = 1; i < p.imageUrls.length; i++) {
                          await wwebjsService.sendImage(businessConfig.userId, from, p.imageUrls[i], "");
                       }
                   }
                   count++;
                } else {
                    if (channel !== 'web') {
                        await sendUnifiedMessage(from, caption, provider, businessConfig.userId);
                    }
                }
              }
              toolResult = `Encontrei ${products.length} produtos e já enviei ${count} com fotos para o cliente.`;
            } else {
              toolResult = "Nenhum produto encontrado com essas palavras-chave.";
            }
          }

          messages.push({ role: "assistant", content: cleanResponse });
          messages.push({ role: "user", content: `[SISTEMA]: Resultado da ação: ${toolResult}. Agora responda ao cliente confirmando ou oferecendo outra opção.` });

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
      if (resolve) resolve({ success: false, error: 'AI Error' });
      return; 
    }

    if (channel !== 'web') {
        const delay = Math.floor(Math.random() * (HUMAN_DELAY_MAX - HUMAN_DELAY_MIN + 1)) + HUMAN_DELAY_MIN;
        await sleep(delay);
        await sendUnifiedMessage(from, finalResponseText, provider, businessConfig.userId);
    } else {
        // For web, no artificial delay needed (or maybe small one?)
        if (resolve) resolve({ text: finalResponseText });
    }

    await saveMessage(from, 'bot', finalResponseText, 'text', null, activeBusinessId, channel);

  } catch (error) {
    console.error('💥 Erro Buffer Process:', error);
    if (resolve) resolve({ success: false, error: error.message });
  }
}

// ==========================================
// 🚀 HANDLER PRINCIPAL (AGORA COM BUFFER)
// ==========================================
async function handleIncomingMessage(normalizedMsg, activeBusinessId) {
  const { from, body, name, type, mediaData, provider, channel = 'whatsapp' } = normalizedMsg;

  if (!body && type === 'text') return;

  const uniqueKey = `${activeBusinessId}_${from}`;

  // 1. VERIFICA PAUSA
  const pauseUntil = humanPauseMap.get(uniqueKey);
  if (pauseUntil && Date.now() < pauseUntil) {
    return { text: "Atendimento pausado para intervenção humana." };
  }

  // 2. RATE LIMIT
  if (!checkRateLimit(uniqueKey)) {
      return { error: "Rate limit exceeded" };
  }

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
  if (!textToBuffer) return { error: "Empty message" };

  // 4. ATUALIZA BUFFER
  let buffer = messageBuffer.get(uniqueKey);

  // For Web, we want to return the result of this batch.
  let responsePromise = null;

  if (buffer) {
      clearTimeout(buffer.timer);
      buffer.messages.push(textToBuffer);
      buffer.lastActiveBusinessId = activeBusinessId;
      // Do NOT overwrite promise/resolve. The original request waits for the result.
      // Subsequent requests in the same burst return null (immediate ack).
  } else {
      buffer = {
          messages: [textToBuffer],
          from,
          name,
          activeBusinessId,
          provider,
          channel,
          timer: null,
          resolve: null // Will be set for Web
      };

      if (channel === 'web') {
          // We create a promise ONLY for the first message that initializes the buffer
          responsePromise = new Promise((resolve) => {
              buffer.resolve = resolve;
          });
      }
  }

  // Define novo timer
  // For web, maybe shorter buffer? Or same?
  // User might type multiple sentences. 11s is long for a chat.
  // Maybe 2-3 seconds for web?
  const delay = channel === 'web' ? 3000 : BUFFER_DELAY;

  buffer.timer = setTimeout(() => {
      processBufferedMessages(uniqueKey);
  }, delay);

  messageBuffer.set(uniqueKey, buffer);

  if (channel === 'web') {
      return responsePromise;
  }
}

module.exports = { handleIncomingMessage };
