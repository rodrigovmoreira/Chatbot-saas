const axios = require('axios');
const BusinessConfig = require('../models/BusinessConfig');

function sanitizeContext(messages) {
    return messages.filter(msg => {
        // Remove repetições massivas de caracteres (spam da IA)
        const spamRegex = /(.)\1{5,}/;
        if (msg.role === 'assistant' && spamRegex.test(msg.content)) {
            return false;
        }
        return true;
    });
}

/**
 * Constrói o Prompt do Sistema com Identidade, Tom, Catálogo e Regras de Humanização.
 */
async function buildSystemPrompt(businessId) {
    try {
        const config = await BusinessConfig.findById(businessId);
        if (!config) return "You are a helpful assistant.";

        const botName = config.botName || "Assistente";
        const businessName = config.businessName || "Empresa";
        
        // 1. TOM DE VOZ (Aceita qualquer string)
        const toneInstruction = config.toneOfVoice || config.tone || "Natural, brasileiro e prestativo.";

        // 2. IDENTIDADE MESTRA
        let prompt = `
--- IDENTIDADE ---
Nome: ${botName}
Empresa: ${businessName}
Tom de Voz: ${toneInstruction}

--- DIRETRIZES DE HUMANIZAÇÃO (ANTI-ROBÔ) ---
1. **PROIBIDO MARKDOWN:** NUNCA use negrito (**texto**), itálico, ou headers (##). O WhatsApp Web não renderiza isso bem.
2. **PROIBIDO LISTAS:** NUNCA use hífens (-) ou asteriscos (*) para listar. Escreva em parágrafos fluidos ou use quebras de linha.
3. **PROIBIDO REPETIR SAUDAÇÃO:** Se o histórico mostra que já nos falamos hoje, NÃO diga "Olá" de novo. Vá direto ao assunto.
4. **NATURALIDADE:** Use linguagem natural de chat. Use espaçamento duplo entre parágrafos para facilitar a leitura.
`;

        if (config.products && config.products.length > 0) {
            prompt += `\n--- CATÁLOGO RÁPIDO (Referência Interna) ---\n`;
            config.products.forEach(p => {
                prompt += `Item: ${p.name} | Preço: R$ ${p.price}\n`;
            });
        }

        // 3. CÉREBRO (Regras do Negócio)
        prompt += `\n--- REGRAS DO NEGÓCIO (CÉREBRO) ---\n`;
        prompt += config.customInstructions || config.prompts?.chatSystem || "";

        return prompt;
    } catch (error) {
        console.error("Error building prompt:", error);
        return "You are a helpful assistant.";
    }
}

function getFunnelStagePrompt(funnelSteps, contactTags) {
    if (!funnelSteps || funnelSteps.length === 0 || !contactTags || contactTags.length === 0) {
        return "";
    }
    const lowerTags = contactTags.map(t => (t && t.name ? t.name : t).toString().toLowerCase().trim());

    const activeStep = funnelSteps
        .filter(step => lowerTags.includes(step.tag.toLowerCase()))
        .sort((a, b) => b.order - a.order)[0];

    if (activeStep) {
        return `
--- FASE ATUAL DO FUNIL: "${activeStep.label}" ---
O cliente está nesta etapa. Siga ESTA instrução específica:
"${activeStep.prompt || 'Siga o fluxo natural.'}"
`;
    }
    return "";
}

function formatHistoryText(historyMessages, botName) {
    if (!historyMessages || historyMessages.length === 0) return "";

    const uniqueHistory = [];
    const seenContent = new Set();

    for (const msg of historyMessages) {
        if (!msg.content || !msg.content.trim()) continue;
        // Limpeza extra para remover JSONs antigos do histórico visual
        const cleanContent = msg.content.replace(/\{"action":.*\}/g, '[AÇÃO DO SISTEMA EXECUTADA]');
        
        const key = `${msg.role}:${cleanContent.trim()}`;
        if (!seenContent.has(key)) {
            uniqueHistory.push({ ...msg, content: cleanContent });
            seenContent.add(key);
        }
    }

    const sortedHistory = uniqueHistory.reverse();

    let historyText = "\n--- HISTÓRICO RECENTE (Contexto) ---\n";
    sortedHistory.forEach((msg, index) => {
        const roleName = msg.role === 'user' ? 'Cliente' : (botName || 'Assistente');
        historyText += `${index + 1} - ${roleName}: "${msg.content.replace(/\n/g, ' ')}"\n`;
    });
    historyText += "----------------------------------------\n";

    return historyText;
}

async function callDeepSeek(messages) {
    try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        const apiUrl = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
        const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

        let finalMessages = sanitizeContext(messages);

        // System message de segurança (sem forçar tom robótico)
        finalMessages.push({
            role: 'system',
            content: '[SYSTEM: Output plain text only. No Markdown. No bold (**). No lists (-).]'
        });

        const response = await axios.post(
            apiUrl,
            {
                model: model,
                messages: finalMessages,
                max_tokens: 900,
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

// Mantido para compatibilidade com Campanhas
async function generateCampaignMessage(promptText, context) {
    // ... (Código original da campanha mantido igual) ...
    try {
        const systemPrompt = `SYSTEM: Write a short marketing message. Recipient: ${context.name || 'Cliente'}. No Markdown.`;
        const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: promptText }];
        const content = await callDeepSeek(messages);
        return content.trim();
    } catch (e) { return promptText; }
}

module.exports = {
    callDeepSeek,
    buildSystemPrompt,
    generateCampaignMessage,
    getFunnelStagePrompt,
    formatHistoryText
};