const axios = require('axios');
const BusinessConfig = require('../models/BusinessConfig');

function sanitizeContext(messages) {
    return messages.filter(msg => {
        // 1. Remove massive repeated character strings (The "Kkkkk" attack)
        // Regex matches 5+ consecutive identical characters (case insensitive)
        const spamRegex = /(.)\1{5,}/;
        if (msg.role === 'assistant' && spamRegex.test(msg.content)) {
            console.log('🗑️ Dropped Spam Message from Context:', msg.content.substring(0, 20) + '...');
            return false;
        }
        return true;
    });
}

async function buildSystemPrompt(businessId) {
    try {
        const config = await BusinessConfig.findById(businessId);
        if (!config) return "You are a helpful assistant.";

        const botName = config.botName || "Assistente";
        const businessName = config.businessName || "Empresa";
        const tone = config.toneOfVoice || config.tone || "friendly";

        let toneInstruction = "";
        if (tone === 'formal') toneInstruction = "Use a formal and professional tone. Avoid slang.";
        if (tone === 'friendly') toneInstruction = "Be friendly, polite, and helpful. Use emojis sparingly.";
        if (tone === 'slang') toneInstruction = "Use casual language, slang, and be very relaxed.";
        if (tone === 'excited') toneInstruction = "Be very enthusiastic and energetic!";

        let prompt = `You are ${botName}, the virtual assistant for ${businessName}.\n`;
        prompt += `TONE: ${toneInstruction}\n\n`;

        if (config.products && config.products.length > 0) {
            prompt += `--- BUSINESS SERVICES / PRODUCTS ---\n`;
            config.products.forEach(p => {
                prompt += `- ${p.name}: R$ ${p.price}`;
                if (p.description) prompt += ` (${p.description})`;
                prompt += `\n`;
            });
            prompt += `\n`;
        }

        prompt += `--- CUSTOM INSTRUCTIONS ---\n`;
        prompt += config.customInstructions || config.prompts?.chatSystem || "";

        return prompt;
    } catch (error) {
        console.error("Error building prompt:", error);
        return "You are a helpful assistant.";
    }
}

async function callDeepSeek(messages) {
    try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        const apiUrl = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
        const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

        // 1. Sanitize History
        let finalMessages = sanitizeContext(messages);

        // 2. Inject Circuit Breaker
        finalMessages.push({
            role: 'system',
            content: '[SYSTEM URGENT: Be concise, serious, and direct. Do not repeat previous talks.]'
        });

        console.log('🔍 [DEEPSEEK PROMPT]', JSON.stringify(finalMessages, null, 2));

        const response = await axios.post(
            apiUrl,
            {
                model: model,
                messages: finalMessages,
                max_tokens: 150,
                temperature: 0.7,
                stream: false,
                response_format: { type: 'text' },
                frequency_penalty: 0.5,
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

module.exports = { callDeepSeek, buildSystemPrompt, generateCampaignMessage };
