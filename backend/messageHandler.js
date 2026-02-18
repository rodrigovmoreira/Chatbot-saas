const axios = require('axios');
const { saveMessage, getLastMessages } = require('./services/message');
const { analyzeImage } = require('./services/visionService');
const { transcribeAudio } = require('./services/transcriptionService');
const { sendUnifiedMessage } = require('./services/responseService');
const wwebjsService = require('./services/wwebjsService');
const BusinessConfig = require('./models/BusinessConfig');
const Contact = require('./models/Contact'); // Import Contact model
const aiTools = require('./services/aiTools');
const { callDeepSeek, buildSystemPrompt, getFunnelStagePrompt, formatHistoryText } = require('./services/aiService');
const { fromZonedTime, format } = require('date-fns-tz');

const MAX_HISTORY = 15; // Increased history fetch

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

// Aggressive cleaner for <thinking> tags
const stripThinking = (text) => {
    if (!text) return "";
    let clean = text;

    // 1. Remove Markdown de código (```json, ```)
    clean = clean.replace(/```json/g, '').replace(/```/g, '');

    // 2. Remove blocos <thinking> completos
    clean = clean.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    // 3. SEGURANÇA CRÍTICA: Se a IA cortou o texto e deixou um <thinking> aberto,
    // nós cortamos tudo dali para frente para não vazar o pensamento incompleto.
    if (clean.includes('<thinking>')) {
        clean = clean.split('<thinking>')[0];
    }

    // 4. Remove tags de fechamento órfãs
    clean = clean.replace(/<\/thinking>/gi, '');

    return clean.trim();
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
        let contactQuery = { businessId: activeBusinessId };
        if (channel === 'web') contactQuery.sessionId = from;
        else contactQuery.phone = from;

        const contact = await Contact.findOne(contactQuery);

        // --- LAZY PROCESSING LOGIC ---
        // Determines if we should process media or keep it generic
        let shouldProcessMedia = true;
        let blockReason = null; // 'handover', 'global', 'audience', 'hours'

        // 1. Handover
        if (contact && contact.isHandover) {
            shouldProcessMedia = false;
            blockReason = 'handover';
        }

        // 2. Global Disabled
        if (shouldProcessMedia && businessConfig.aiGlobalDisabled) {
            shouldProcessMedia = false;
            blockReason = 'global';
        }

        // 3. Audience Filter
        if (shouldProcessMedia) {
            const aiMode = businessConfig.aiResponseMode || 'all';
            let audienceBlocked = false;

            if (aiMode === 'new_contacts') {
                if (contact) {
                    const hasPriorHistory = contact.totalMessages > 0;
                    const isOld = (Date.now() - new Date(contact.createdAt).getTime()) > 24 * 60 * 60 * 1000;
                    if (hasPriorHistory || isOld) audienceBlocked = true;
                }
                // If !contact, it's new.
            } else {
                const contactTags = getTagNames(contact ? contact.tags : []);
                const whitelist = getTagNames(businessConfig.aiWhitelistTags || []);
                const blacklist = getTagNames(businessConfig.aiBlacklistTags || []);

                if (aiMode === 'whitelist') {
                    const hasTag = contactTags.some(t => whitelist.includes(t));
                    if (!hasTag) audienceBlocked = true;
                } else if (aiMode === 'blacklist') {
                    if (blacklist.length > 0) {
                        const hasBadTag = contactTags.some(t => blacklist.includes(t));
                        if (hasBadTag) audienceBlocked = true;
                    }
                }
            }

            if (audienceBlocked) {
                shouldProcessMedia = false;
                blockReason = 'audience';
            }
        }

        // 4. Operating Hours
        if (shouldProcessMedia && !isWithinOperatingHours(businessConfig)) {
            shouldProcessMedia = false;
            blockReason = 'hours';
        }

        // --- PROCESS MESSAGES ---
        const finalMessages = [];
        for (const msg of messages) {
            let content = msg.body;

            if (msg.type === 'image' && msg.mediaData) {
                if (shouldProcessMedia) {
                    const visionPrompt = businessConfig.prompts?.visionSystem || "Descreva esta imagem.";
                    try {
                        const desc = await analyzeImage(msg.mediaData, visionPrompt);
                        const caption = desc ? `[VISÃO]: ${desc}` : "[Imagem]";
                        content = content ? `${content}\n${caption}` : caption;
                    } catch (e) {
                        console.error("Erro Visão:", e);
                        content = content ? `${content}\n[Erro na análise de imagem]` : "[Erro na análise de imagem]";
                    }
                } else {
                    content = content ? `${content} [Imagem recebida]` : "[Imagem recebida]";
                }
            } else if (msg.type === 'audio' && msg.mediaData) {
                if (shouldProcessMedia) {
                    try {
                        const trans = await transcribeAudio(msg.mediaData);
                        const caption = trans ? `[Áudio]: "${trans}"` : "[Áudio]";
                        content = content ? `${content}\n${caption}` : caption;
                    } catch (e) {
                        console.error("Erro Transcrição:", e);
                        content = "[Erro ao processar áudio]";
                    }
                } else {
                    content = "[Áudio recebido]";
                }
            } else if (msg.type !== 'text') {
                // Outros tipos de mídia
                const mediaDesc = `[Mídia: ${msg.type}]`;
                content = content ? `${content}\n${mediaDesc}` : mediaDesc;
            }

            if (content) finalMessages.push(content);
        }

        const userMessage = finalMessages.join('\n');

        // Salva a mensagem combinada como 'user'
        await saveMessage(from, 'user', userMessage, 'text', null, activeBusinessId, channel, name);

        // --- EXECUTE BLOCKS (Responses/Logging) ---
        if (blockReason === 'handover') {
            console.log(`🛑 Handover ativo para ${from}. Robô silenciado.`);
            if (channel === 'web' && resolve) resolve({ text: "" });
            return;
        }

        if (blockReason === 'global') {
            console.log(`🛑 AI Global Disabled (Observer Mode) for business ${activeBusinessId}.`);
            if (channel === 'web' && resolve) resolve({ text: "" });
            return;
        }

        if (blockReason === 'audience') {
            console.log(`🛑 AI Audience Filter: Ignored (Mode: ${businessConfig.aiResponseMode}).`);
            if (channel === 'web' && resolve) resolve({ text: "" });
            return;
        }

        if (blockReason === 'hours') {
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
        const formattedDateTime = new Intl.DateTimeFormat('pt-BR', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(now);

        const todayStr = formattedDateTime.split(' ')[0];
        const timeStr = formattedDateTime.split(' ')[1];

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

        // B. System Prompt (Identity + Brain)
        const { instagram, website, portfolio } = businessConfig.socialMedia || {};
        const basePrompt = await buildSystemPrompt(activeBusinessId);

        // C. Funnel Stage Injection
        const contactTags = getTagNames(contact ? contact.tags : []);
        const funnelSteps = businessConfig.funnelSteps || [];
        const stageContext = getFunnelStagePrompt(funnelSteps, contactTags);

        // D. History Formatting (Text Block Strategy)
        const rawDbHistory = await getLastMessages(from, MAX_HISTORY, activeBusinessId, channel);
        const historyText = formatHistoryText(rawDbHistory, businessConfig.botName);

        const toolsInstruction = `
--- FERRAMENTAS DISPONÍVEIS (Use JSON para agir) ---
Você tem acesso a funções do sistema. Para usá-las, responda APENAS com o JSON correspondente.

1. **VERIFICAR DISPONIBILIDADE (Agenda)**
   - Use quando o cliente perguntar horários ou quiser agendar.
   - JSON: {"action": "check", "start": "YYYY-MM-DD HH:mm", "end": "YYYY-MM-DD HH:mm"}
   - Obs: Se o cliente não der data, use a data de hoje/amanhã no contexto.

2. **AGENDAR (Confirmar Reserva)**
   - Use APENAS quando o cliente confirmar explicitamente um horário LIVRE.
   - JSON: {"action": "book", "clientName": "Nome", "start": "YYYY-MM-DD HH:mm", "title": "Serviço"}

3. **BUSCAR NO CATÁLOGO**
   - Use quando o cliente perguntar preço, foto ou detalhes de algo que vendemos.
   - JSON: {"action": "search_catalog", "keywords": ["termo1", "termo2"]}
   - NUNCA invente preços. Busque no catálogo primeiro.

Se não precisar de ferramentas, responda com texto normal seguindo o Tom de Voz.
`;

        const systemInstruction = `
${basePrompt}

${stageContext}

${toolsInstruction}

${historyText}

--- CONTEXTO TÉCNICO ---
Data/Hora: ${contextDateTime}
${catalogContext}
Links: Insta=${instagram || 'N/A'}, Site=${website || 'N/A'}

--- PROTOCOLO DE RACIOCÍNIO ---
1. **ANALISE:** Veja o histórico. Se já saudou, NÃO repita a saudação.
2. **PENSE:** Use <thinking>...</thinking> para planejar a resposta.
3. **RESPONDA:** A resposta final para o cliente deve vir DEPOIS da tag </thinking>.

--- FORMATO DE SAÍDA ---
- Texto normal: Apenas a resposta.
- Ações: Use JSON puro ({"action": "..."}).
`;

        const aiMessages = [
            { role: "system", content: systemInstruction },
            { role: "user", content: userMessage }
        ];

        let finalResponseText = "";

        try {
            // 1. Chamada inicial à IA
            const rawResponseText = await callDeepSeek(aiMessages);

            const thoughtMatch = rawResponseText.match(/<thinking>([\s\S]*?)<\/thinking>/i);
            if (thoughtMatch) console.log(`🧠 [IA PENSOU]: ${thoughtMatch[1].substring(0, 100)}...`);

            // 2. Limpeza de pensamento
            let cleanResponse = stripThinking(rawResponseText);

            // 🛡️ TRAVA DE SEGURANÇA 1: Fallback se a resposta ficar vazia
            if (!cleanResponse || cleanResponse.trim() === "") {
                console.warn("⚠️ IA gerou resposta vazia após limpeza. Usando Fallback.");
                cleanResponse = "Entendi. Poderia me dar mais detalhes?";
            }

            // Preparação para verificar JSON
            const jsonText = cleanResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                try {
                    const command = JSON.parse(jsonMatch[0]);
                    let toolResult = "";

                    // --- LÓGICA DE FERRAMENTAS ---
                    if (command.action === 'check') {
                        const startZoned = fromZonedTime(command.start, timeZone);
                        let endZoned = command.end ? fromZonedTime(command.end, timeZone) : new Date(startZoned.getTime() + 60 * 60000);
                        const check = await aiTools.checkAvailability(businessConfig.userId, startZoned, endZoned);
                        toolResult = check.available ? "O horário está LIVRE. Pode oferecer." : `O horário está INDISPONÍVEL. Motivo: ${check.reason}.`;
                    }

                    if (command.action === 'book') {
                        const startZoned = fromZonedTime(command.start, timeZone);
                        let endZoned = command.end ? fromZonedTime(command.end, timeZone) : new Date(startZoned.getTime() + 60 * 60000);
                        const booking = await aiTools.createAppointmentByAI(businessConfig.userId, {
                            clientName: command.clientName || name || "Cliente",
                            clientPhone: from,
                            title: command.title || "Agendamento via IA",
                            start: startZoned,
                            end: endZoned
                        });
                        toolResult = booking.success
                            ? `SUCESSO: Agendamento salvo (ID: ${booking.data._id}). Pode confirmar.`
                            : `ERRO CRÍTICO: Falhou. Motivo: ${booking.error}. Peça desculpas.`;
                    }

                    if (command.action === 'search_catalog') {
                        const products = await aiTools.searchProducts(businessConfig.userId, command.keywords);
                        if (products.length > 0) {
                            let count = 0;
                            for (const p of products) {
                                if (count >= 5) break;
                                const caption = `${p.name} - R$ ${p.price}\n${p.description || ''}`;
                                if (p.imageUrls && p.imageUrls.length > 0) {
                                    if (channel === 'web') { /* Logica web */ }
                                    else {
                                        await wwebjsService.sendImage(businessConfig.userId, from, p.imageUrls[0], caption);
                                        for (let i = 1; i < p.imageUrls.length; i++) {
                                            await wwebjsService.sendImage(businessConfig.userId, from, p.imageUrls[i], "");
                                        }
                                    }
                                    count++;
                                } else {
                                    if (channel !== 'web') await sendUnifiedMessage(from, caption, provider, businessConfig.userId);
                                }
                            }
                            toolResult = `Encontrei ${products.length} produtos e já enviei ${count} com fotos.`;
                        } else {
                            toolResult = "Nenhum produto encontrado.";
                        }
                    }

                    // --- RECURSIVIDADE ---
                    aiMessages.push({ role: "assistant", content: rawResponseText });
                    aiMessages.push({ role: "user", content: `[SISTEMA]: Resultado da ação: ${toolResult}. Agora responda ao cliente.` });

                    const rawFinalResponse = await callDeepSeek(aiMessages);

                    // 🛡️ TRAVA DE SEGURANÇA 2: Limpar pensamento TAMBÉM na resposta pós-ação
                    finalResponseText = stripThinking(rawFinalResponse);

                    if (!finalResponseText || finalResponseText.trim() === "") {
                        finalResponseText = "Certo, verifiquei aqui.";
                    }

                } catch (jsonErr) {
                    console.error("Erro JSON IA:", jsonErr);
                    finalResponseText = cleanResponse;
                }
            } else {
                finalResponseText = cleanResponse;
            }

        } catch (aiErr) {
            console.error("Erro Geração IA:", aiErr);
            if (resolve) resolve({ success: false, error: 'AI Error' });
            return;
        }

        // 🛡️ TRAVA DE SEGURANÇA 3: Verificação Final Global
        if (!finalResponseText || finalResponseText.trim() === "") {
            console.error("❌ Erro: Mensagem final vazia detectada. Abortando para evitar crash no banco.");
            if (resolve) resolve({ success: false });
            return;
        }

        if (channel !== 'web') {
            const delay = Math.floor(Math.random() * (HUMAN_DELAY_MAX - HUMAN_DELAY_MIN + 1)) + HUMAN_DELAY_MIN;
            await sleep(delay);
            await sendUnifiedMessage(from, finalResponseText, provider, businessConfig.userId);
        } else {
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

    // 🛡️ IRON GATE: Redundant Safety Block
    if (from) {
        const isInvalidSource =
            from.includes('@g.us') ||
            from.includes('status@broadcast') ||
            from.includes('@newsletter');

        const numericPart = from.replace(/\D/g, '');
        const isTooLong = numericPart.length > 15;

        if (isInvalidSource || isTooLong) {
            console.warn(`🚫 Handler Blocked: Invalid source ${from}`);
            return { error: "Blocked Source (Group/Channel/Invalid)" };
        }
    }

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

    // 3. PREPARA ITEM DO BUFFER (NOVO: Objeto em vez de String)
    const msgItem = {
        type: type,
        body: body ? body.trim() : "",
        mediaData: mediaData
    };

    // Ignora mensagens vazias
    if (msgItem.type === 'text' && !msgItem.body) return { error: "Empty message" };

    // 4. ATUALIZA BUFFER
    let buffer = messageBuffer.get(uniqueKey);

    // For Web, we want to return the result of this batch.
    let responsePromise = null;

    if (buffer) {
        clearTimeout(buffer.timer);
        buffer.messages.push(msgItem);
        buffer.lastActiveBusinessId = activeBusinessId;
    } else {
        buffer = {
            messages: [msgItem], // Array de objetos
            from,
            name,
            activeBusinessId,
            provider,
            channel,
            timer: null,
            resolve: null // Will be set for Web
        };

        if (channel === 'web') {
            responsePromise = new Promise((resolve) => {
                buffer.resolve = resolve;
            });
        }
    }

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
