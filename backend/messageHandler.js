const axios = require('axios'); // Usaremos Axios direto (padrão DeepSeek/OpenAI)
const { saveMessage, getLastMessages } = require('./services/message');
const { analyzeImage } = require('./services/visionService');
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
const HUMAN_DELAY_MIN = 3000;
const HUMAN_DELAY_MAX = 8000;

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
                temperature: 0.5,
                stream: false,
                response_format: { type: 'text' } // Garante texto puro (nós fazemos o parse do JSON)
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000 // Timeout maior para garantir
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
// 🚀 HANDLER PRINCIPAL
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

  let userMessage = body ? body.trim() : "";
  let visionResult = null;

  try {
    if (!activeBusinessId) return;
    const businessConfig = await BusinessConfig.findById(activeBusinessId);
    if (!businessConfig) return;
    if (!businessConfig.prompts) businessConfig.prompts = { chatSystem: "...", visionSystem: "..." };

    // 3. VISÃO (Mantemos o visionService separado, pois DeepSeek V3 é focado em texto)
    if (type === 'image' && mediaData) {
      try {
        const visionPrompt = businessConfig.prompts?.visionSystem || "Descreva esta imagem.";
        // Nota: O visionService ainda usa Gemini internamente. Se quiser trocar tudo, 
        // precisaria de um modelo de visão alternativo. Por enquanto, mantemos assim.
        visionResult = await analyzeImage(mediaData, visionPrompt);
        if (visionResult) userMessage = `${userMessage}\n\n[VISÃO DA IMAGEM]: ${visionResult}`.trim();
      } catch (e) { console.error("Erro Visão:", e); }
    }
    if (!userMessage) userMessage = `[Arquivo de ${type === 'audio' ? 'Áudio' : 'Mídia'}]`;

    await saveMessage(from, 'user', userMessage, type, visionResult, activeBusinessId);

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
            // Chamada DeepSeek simples para o menu
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
      catalogContext = "\n--- TABELA DE PREÇOS ---\n" + businessConfig.products.map(p => `- ${p.name}: R$ ${p.price}`).join('\n');

      // Extrair tags únicas para contexto
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

    // B. System Prompt (Ajustado para o estilo DeepSeek)
    const { instagram, website, portfolio } = businessConfig.socialMedia || {};

    const systemInstruction = `
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

    // C. Montagem do Histórico (Formato OpenAI/DeepSeek: role 'user' ou 'assistant')
    const dbHistory = await getLastMessages(from, MAX_HISTORY, activeBusinessId);
    
    const messages = [
        { role: "system", content: systemInstruction }
    ];

    // Adiciona histórico do banco
    dbHistory.reverse().forEach(m => {
        if (m.content && m.content.trim()) {
            messages.push({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content
            });
        }
    });

    // Adiciona a mensagem atual do usuário
    messages.push({ role: "user", content: userMessage });

    let finalResponseText = "";

    try {
      // D. Primeira Chamada ao DeepSeek
      console.log("🤖 Enviando para DeepSeek...");
      const responseText = await callDeepSeek(messages);

      // E. Detectar Ferramenta (JSON)
      // O DeepSeek pode mandar ```json ... ```, então limpamos isso
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
              // Envia as imagens
              let count = 0;
              for (const p of products) {
                if (count >= 5) break; // Limite de 5 produtos

                const caption = `${p.name} - R$ ${p.price}\n${p.description || ''}`;

                if (p.imageUrls && p.imageUrls.length > 0) {
                   // 1. Manda a primeira foto com a legenda
                   await wwebjsService.sendImage(businessConfig.userId, from, p.imageUrls[0], caption);

                   // 2. Manda as outras fotos (se houver) sem legenda
                   for (let i = 1; i < p.imageUrls.length; i++) {
                      await wwebjsService.sendImage(businessConfig.userId, from, p.imageUrls[i], "");
                   }
                   count++;
                } else {
                    // Se não tiver imagem, manda só o texto
                    await sendUnifiedMessage(from, caption, provider, businessConfig.userId);
                }
              }
              toolResult = `Encontrei ${products.length} produtos e já enviei ${count} com fotos para o cliente.`;
            } else {
              toolResult = "Nenhum produto encontrado com essas palavras-chave.";
            }
          }

          // F. Segunda Chamada (Feedback da Ferramenta)
          // Adicionamos a resposta JSON do bot e o resultado do sistema ao histórico temporário
          messages.push({ role: "assistant", content: cleanResponse });
          messages.push({ role: "user", content: `[SISTEMA]: Resultado da ação: ${toolResult}. Agora responda ao cliente confirmando ou oferecendo outra opção.` });

          console.log("🤖 Enviando resultado da ferramenta para DeepSeek...");
          finalResponseText = await callDeepSeek(messages);

        } catch (jsonErr) {
          console.error("Erro JSON IA:", jsonErr);
          finalResponseText = responseText; // Manda o texto original se falhar o parse
        }
      } else {
        finalResponseText = responseText;
      }

    } catch (aiErr) {
      console.error("Erro Geração IA:", aiErr);
      // Fallback em caso de erro da API
      return; 
    }

    // G. Delay Humano e Envio
    const delay = Math.floor(Math.random() * (HUMAN_DELAY_MAX - HUMAN_DELAY_MIN + 1)) + HUMAN_DELAY_MIN;
    await sleep(delay);

    await sendUnifiedMessage(from, finalResponseText, provider, businessConfig.userId);
    await saveMessage(from, 'bot', finalResponseText, 'text', null, activeBusinessId);

  } catch (error) {
    console.error('💥 Erro Handler:', error);
  }
}

module.exports = { handleIncomingMessage };