const axios = require('axios');
const { saveMessage, getLastMessages } = require('./services/message');
const { analyzeImage } = require('./services/visionService');
const { transcribeAudio } = require('./services/transcriptionService');
const { sendUnifiedMessage } = require('./services/responseService');
const wwebjsService = require('./services/wwebjsService');
const BusinessConfig = require('./models/BusinessConfig');
const Contact = require('./models/Contact'); // Import Contact model
const aiTools = require('./services/aiTools');
const { callDeepSeek, buildSystemPrompt } = require('./services/aiService');
const { fromZonedTime, format } = require('date-fns-tz');

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

// Helper: Normalize Tags (Strings or Objects)
const getTagNames = (tags) => {
    if (!Array.isArray(tags)) return [];
    return tags.map(t => {
        // If it's an object with a name property, use that. If it's a string, use it directly.
        return (t && t.name ? t.name : t).toString().toLowerCase().trim();
    });
};

// === FUNÇÃO DE LIMPEZA DE HISTÓRICO (O FAXINEIRO) ===
const cleanMessageHistory = (history) => {
    if (!history || history.length === 0) return [];

    const uniqueHistory = [];
    let lastContent = null;
    
    // 1. Mantém a System Message sempre (se existir no array, mas geralmente ela é injetada depois)
    // Se o histórico vier do banco, ele não tem system message ainda.
    
    for (let i = 0; i < history.length; i++) {
        const msg = history[i];
        
        // Regra A: Ignora mensagens vazias
        if (!msg.content || msg.content.trim() === "") continue;

        // Regra B: Ignora duplicatas exatas consecutivas (O Loop "E aí guerreiro")
        if (msg.content === lastContent) continue;

        uniqueHistory.push(msg);
        lastContent = msg.content;
    }

    return uniqueHistory;
};

function checkRateLimit(key) {
  if (process.env.NODE_ENV === 'test') return true;
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

  // Use Intl.DateTimeFormat for robust timezone handling down to the second
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(new Date());
  const getPart = (type) => parseInt(parts.find(p => p.type === type).value, 10);

  const nowH = getPart('hour');
  const nowM = getPart('minute');
  const nowS = getPart('second');

  // Convert everything to Total Seconds for precision comparison
  const currentTotalSeconds = nowH * 3600 + nowM * 60 + nowS;

  const [openH, openM] = businessConfig.operatingHours.opening.split(':').map(Number);
  const [closeH, closeM] = businessConfig.operatingHours.closing.split(':').map(Number);

  const openTotalSeconds = openH * 3600 + (openM || 0) * 60;
  const closeTotalSeconds = closeH * 3600 + (closeM || 0) * 60;

  console.log(`🕒 OpHours Check (${timeZone}): Now=${nowH}:${nowM}:${nowS} (${currentTotalSeconds}s) | Range=[${openTotalSeconds}, ${closeTotalSeconds})`);

  return currentTotalSeconds >= openTotalSeconds && currentTotalSeconds < closeTotalSeconds;
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

    // 0. VERIFICAÇÃO DE HANDOVER (ATENDIMENTO HUMANO)
    // Precisamos buscar o contato para saber se o robô foi desligado para ele
    let contactQuery = { businessId: activeBusinessId };
    if (channel === 'web') contactQuery.sessionId = from;
    else contactQuery.phone = from;

    const contact = await Contact.findOne(contactQuery);

    // Salva a mensagem combinada como 'user'
    await saveMessage(from, 'user', userMessage, 'text', null, activeBusinessId, channel, name);

    if (contact && contact.isHandover) {
        console.log(`🛑 Handover ativo para ${from}. Robô silenciado.`);
        if (channel === 'web' && resolve) resolve({ text: "" }); // Retorna vazio para o web
        return; // Encerra execução (não chama IA)
    }

    // 1. MODO OBSERVADOR (GLOBAL MASTER SWITCH)
    if (businessConfig.aiGlobalDisabled) {
        console.log(`🛑 AI Global Disabled (Observer Mode) for business ${activeBusinessId}.`);
        if (channel === 'web' && resolve) resolve({ text: "" });
        return;
    }

    // 2. REGRAS DE ENGAJAMENTO (AUDIENCE FILTER)
    const aiMode = businessConfig.aiResponseMode || 'all';

    if (aiMode === 'new_contacts') {
        // Se o contato já existia antes dessa mensagem ser processada
        if (contact) {
            // totalMessages includes current message (so >= 1). We want > 1 to indicate PRIOR history.
            const hasPriorHistory = contact.totalMessages > 1;
            const isOld = (Date.now() - new Date(contact.createdAt).getTime()) > 24 * 60 * 60 * 1000;

            if (hasPriorHistory || isOld) {
                console.log(`🛑 AI Audience Filter: Ignored (Mode: new_contacts). Contact is not new.`);
                if (channel === 'web' && resolve) resolve({ text: "" });
                return;
            }
        }
        // Se !contact, ele foi criado agora pelo saveMessage, então é novo -> Allow
    }
    else {
        // Normalize Tags for Comparison
        const contactTags = getTagNames(contact ? contact.tags : []);
        const whitelist = getTagNames(businessConfig.aiWhitelistTags || []);
        const blacklist = getTagNames(businessConfig.aiBlacklistTags || []);

        console.log(`🤖 AI Check [${aiMode}]: Contact Tags:`, contactTags, '| WL:', whitelist, '| BL:', blacklist);

        if (aiMode === 'whitelist') {
            // Whitelist Logic: Must have at least one tag. If whitelist is empty, nobody matches (Block All).
            const hasTag = contactTags.some(t => whitelist.includes(t));

            if (!hasTag) {
                console.log(`🛑 AI Audience Filter: Ignored (Mode: whitelist). Tags do not match.`);
                if (channel === 'web' && resolve) resolve({ text: "" });
                return;
            }
        }
        else if (aiMode === 'blacklist') {
            if (blacklist.length > 0) {
                const hasBadTag = contactTags.some(t => blacklist.includes(t));

                if (hasBadTag) {
                    console.log(`🛑 AI Audience Filter: Ignored (Mode: blacklist). Contact has blacklisted tag.`);
                    if (channel === 'web' && resolve) resolve({ text: "" });
                    return;
                }
            }
        }
    }

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
    const timeZone = businessConfig.timezone || businessConfig.operatingHours?.timezone || 'America/Sao_Paulo';
    const now = new Date();

    // Force timezone in formatting using date-fns-tz or Intl
    // Ex: "2023-10-27 14:00 (America/Sao_Paulo)"
    const formattedDateTime = new Intl.DateTimeFormat('pt-BR', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(now);

    const todayStr = formattedDateTime.split(' ')[0]; // Retém retrocompatibilidade se necessário
    const timeStr = formattedDateTime.split(' ')[1];  // Retém retrocompatibilidade se necessário

    const contextDateTime = `${formattedDateTime} (${timeZone})`;

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

    const basePrompt = await buildSystemPrompt(activeBusinessId);

    const systemInstruction = `
${basePrompt}

--- AUDIO & IMAGE HANDLING ---
1. If you receive text marked as \`[Transcrição do Áudio]: "..."\`, it means the user sent a voice message that has been converted to text for you.
   - TREAT THIS AS DIRECT USER INPUT.
   - DO NOT say "I cannot listen to audio" or "I cannot play messages".
   - Answer the content of the transcription naturally.
2. If you receive \`[VISÃO DA IMAGEM]\`, treat it as what the user is showing you.

--- CONTEXTO ATUAL ---
Data/Hora Atual: ${contextDateTime}.
IMPORTANTE: Todos os horários que você sugerir ou agendar devem estar baseados nesta data/hora e timezone.
Ao enviar comandos JSON, use o formato ISO (YYYY-MM-DDTHH:mm:ss). Se você enviar "2024-01-01T14:00:00", o sistema entenderá que é 14:00 NO TIMEZONE ${timeZone}.

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

--- REGRAS DE ANTI-REPETIÇÃO ---
1. Seja criativo. NÃO repita a última frase ou saudação que você disse se ela já estiver no histórico recente.
2. Se o usuário insistir em apenas "Oi", varie a resposta (ex: "Olá novamente", "Em que posso ajudar?", "Tudo bem?").
`;

    // C. Montagem do Histórico
    const rawDbHistory = await getLastMessages(from, MAX_HISTORY, activeBusinessId, channel);
    
    // 🔥 APLICA O FAXINEIRO AQUI 🔥
    // Limpa mensagens repetidas e vazias antes de enviar para a IA
    const cleanDbHistory = cleanMessageHistory(rawDbHistory);

    const messages = [
        { role: "system", content: systemInstruction }
    ];

    cleanDbHistory.reverse().forEach(m => {
        // Garantia extra de conteúdo
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
      //console.log('--- 🧠 DEEPSEEK FULL PROMPT ---');
      //console.log(JSON.stringify(messages, null, 2));
      //console.log('-------------------------------');

      const responseText = await callDeepSeek(messages);

      const cleanResponse = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        try {
          const command = JSON.parse(jsonMatch[0]);
          let toolResult = "";

          if (command.action === 'check') {
            // Converte a string da IA (Business Time) para UTC Date real
            const startZoned = fromZonedTime(command.start, timeZone);
            let endZoned;

            if (command.end) {
                endZoned = fromZonedTime(command.end, timeZone);
            } else {
                endZoned = new Date(startZoned.getTime() + 60 * 60000);
            }

            const check = await aiTools.checkAvailability(businessConfig.userId, startZoned, endZoned);
            toolResult = check.available 
              ? "O horário está LIVRE. Pode oferecer." 
              : `O horário está INDISPONÍVEL. Motivo: ${check.reason}.`;
          }

          if (command.action === 'book') {
            // Converte a string da IA (Business Time) para UTC Date real
            const startZoned = fromZonedTime(command.start, timeZone);
            let endZoned;

            if (command.end) {
                endZoned = fromZonedTime(command.end, timeZone);
            } else {
                endZoned = new Date(startZoned.getTime() + 60 * 60000);
            }

            const booking = await aiTools.createAppointmentByAI(businessConfig.userId, {
              clientName: command.clientName || name || "Cliente",
              clientPhone: from,
              title: command.title || "Agendamento via IA",
              start: startZoned,
              end: endZoned
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

module.exports = { handleIncomingMessage, processBufferedMessages };