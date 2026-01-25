const axios = require('axios');

async function callDeepSeek(messages) {
    try {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        const apiUrl = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
        const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

        console.log('🔍 [DEEPSEEK PROMPT]', JSON.stringify(messages, null, 2));

        const response = await axios.post(
            apiUrl,
            {
                model: model,
                messages: messages,
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
