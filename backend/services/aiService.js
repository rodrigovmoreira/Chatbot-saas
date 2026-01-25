const axios = require('axios');

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
            content: '[SYSTEM URGENT: The assistant MUST stop laughing. Be concise, serious, and direct. Do not repeat previous offers.]'
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

module.exports = { callDeepSeek };
