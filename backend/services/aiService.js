const axios = require('axios');
const BusinessConfig = require('../models/BusinessConfig');

function sanitizeContext(messages) {
    return messages.filter(msg => {
        // 1. Remove massive repeated character strings
        const spamRegex = /(.)\1{5,}/;
        if (msg.role === 'assistant' && spamRegex.test(msg.content)) {
            console.log('🗑️ Dropped Spam Message from Context:', msg.content.substring(0, 20) + '...');
            return false;
        }
        return true;
    });
}

/**
 * Builds the base system prompt including Identity, Tone, Products, and Brain.
 * @param {string} businessId
 * @returns {Promise<string>}
 */
async function buildSystemPrompt(businessId) {
    try {
        const config = await BusinessConfig.findById(businessId);
        if (!config) return "You are a helpful assistant.";

        const botName = config.botName || "Assistente";
        const businessName = config.businessName || "Empresa";

        // 1. TONE: Direct injection (No if/else)
        const toneInstruction = config.toneOfVoice || config.tone || "Natural e prestativo.";

        // 2. IDENTITY HIERARCHY
        let prompt = `
--- IDENTIDADE MESTRA ---
Nome: ${botName}
Empresa: ${businessName}
Tom de Voz: ${toneInstruction}

IMPORTANTE: O nome da empresa é apenas a entidade legal.
A SUA PERSONALIDADE, NICHO E REGRAS DE ATUAÇÃO SÃO DEFINIDAS EXCLUSIVAMENTE PELO "CÉREBRO" ABAIXO.
IGNORE qualquer implicação semântica do nome da empresa se contradizer o Cérebro.
`;

        if (config.products && config.products.length > 0) {
            prompt += `\n--- CATÁLOGO RÁPIDO ---\n`;
            config.products.forEach(p => {
                prompt += `- ${p.name}: R$ ${p.price}\n`;
            });
        }

        // 3. THE BRAIN
        prompt += `\n--- CÉREBRO (MANDAMENTOS DO NEGÓCIO) ---\n`;
        prompt += config.customInstructions || config.prompts?.chatSystem || "";

        return prompt;
    } catch (error) {
        console.error("Error building prompt:", error);
        return "You are a helpful assistant.";
    }
}

/**
 * Gets the funnel stage prompt based on contact tags.
 * @param {Array} funnelSteps - The funnel steps from config.
 * @param {Array} contactTags - The tags of the contact.
 * @returns {string} - The funnel stage prompt or empty string.
 */
function getFunnelStagePrompt(funnelSteps, contactTags) {
    if (!funnelSteps || funnelSteps.length === 0 || !contactTags || contactTags.length === 0) {
        return "";
    }

    const lowerTags = contactTags.map(t => (t && t.name ? t.name : t).toString().toLowerCase().trim());

    // Find highest priority step matching user tags
    const activeStep = funnelSteps
        .filter(step => lowerTags.includes(step.tag.toLowerCase()))
        .sort((a, b) => b.order - a.order)[0]; // Sort by order desc (most advanced stage)

    if (activeStep) {
        return `
--- FASE ATUAL DO FUNIL: "${activeStep.label}" ---
O cliente está nesta etapa. Siga ESTA instrução específica para agora:
"${activeStep.prompt || 'Siga o roteiro padrão.'}"
`;
    }

    return "";
}

/**
 * Formats history messages into a numbered text block.
 * @param {Array} historyMessages - Array of {role, content} objects.
 * @param {string} botName - The name of the bot.
 * @returns {string} - The formatted history text.
 */
function formatHistoryText(historyMessages, botName) {
    if (!historyMessages || historyMessages.length === 0) return "";

    const uniqueHistory = [];
    const seenContent = new Set();

    // Deduplicate & Clean
    for (const msg of historyMessages) {
        if (!msg.content || !msg.content.trim()) continue;
        const key = `${msg.role}:${msg.content.trim()}`;
        if (!seenContent.has(key)) {
            uniqueHistory.push(msg);
            seenContent.add(key);
        }
    }

    // Sort Oldest to Newest for the Prompt
    const sortedHistory = uniqueHistory.reverse();

    let historyText = "\n--- HISTÓRICO DE CONVERSA (Contexto) ---\n";
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

        // 1. Sanitize History
        let finalMessages = sanitizeContext(messages);

        // 2. Inject Circuit Breaker
        // Only if not strictly defined by prompt logic already
        // In this new architecture, 'messages' should already be [system, user].
        // Adding a system message at the end might confuse some models, but usually it's fine.
        // Let's keep it for now as safeguard against repetition loops if any.
        finalMessages.push({
            role: 'system',
            content: '[SYSTEM URGENT: Be concise, serious, and direct. Do not repeat previous talks.]'
        });

        //console.log('🔍 [DEEPSEEK PROMPT]', JSON.stringify(finalMessages, null, 2));

        const response = await axios.post(
            apiUrl,
            {
                model: model,
                messages: finalMessages,
                max_tokens: 1200,
                temperature: 0.7,
                stream: false,
                response_format: { type: 'text' },
                frequency_penalty: 0.8,
                presence_penalty: 0.6
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

/**
 * Generates a campaign message using the AI.
 * @param {string} promptText - The user's prompt (e.g., "Tell a joke")
 * @param {object} context - Context object containing { name: 'Contact Name' }
 * @returns {Promise<string>} - The generated message
 */
async function generateCampaignMessage(promptText, context) {
    try {
        const systemPrompt = `
SYSTEM: You are a helpful assistant writing a message for a marketing campaign.
CONTEXT:
Recipient Name: ${context.name || 'Cliente'}

INSTRUCTION: Write a short message based on the following request: "${promptText}".
Personalize it using the recipient's name if appropriate. Don't repeat yourself, see the history role system and avoid repeat the same message multiple times. Be concise and engaging.
Do not add "Subject:" or any other headers. Just the message body.
`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptText }
        ];

        console.log(`🤖 Generating Campaign Message for ${context.name}...`);
        const content = await callDeepSeek(messages);
        return content.trim();
    } catch (error) {
        console.error('Error generating campaign message:', error);
        return promptText; // Fallback to prompt text if AI fails? Or return error?
        // Prompt says: "If true, DO NOT send campaign.message directly... Send the result returned by the AI."
        // If AI fails, fallback to promptText might be safe, or empty string.
        // I'll return the prompt text as fallback so *something* is sent.
    }
}

module.exports = {
    callDeepSeek,
    buildSystemPrompt,
    generateCampaignMessage,
    getFunnelStagePrompt,
    formatHistoryText
};
