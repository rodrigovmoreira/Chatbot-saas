const axios = require('axios');

/**
 * Gera resposta usando DeepSeek ou outra IA compatível
 * @param {string} userMessage - A mensagem atual do usuário
 * @param {string} systemPrompt - A personalidade e regras do bot (Contexto)
 */
async function generateAIResponse(userMessage, systemPrompt) {
  console.time('⏳ Tempo IA');
  
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('❌ DEEPSEEK_API_KEY não configurada');
      return "Estou em manutenção momentânea. Tente em instantes.";
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const apiUrl = process.env.DEEPSEEK_API_URL;
    const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

    // Montamos o array de mensagens conforme padrão OpenAI/DeepSeek
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ];

    const response = await axios.post(
      apiUrl,
      {
        model: model,
        messages: messages,
        max_tokens: 350, // Um pouco maior para explicações de tattoo
        temperature: 0.5, // Criatividade controlada
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000 // Aumentei timeout pois IA pode demorar pensando
      }
    );

    if (response.status !== 200) {
      throw new Error(`Erro API: ${response.status}`);
    }

    const aiResponse = response.data.choices[0].message.content.trim();
    
    console.log('✅ Resposta IA gerada.');
    console.timeEnd('⏳ Tempo IA');

    return aiResponse;

  } catch (error) {
    console.error('💥 ERRO IA:', error.message);
    console.timeEnd('⏳ Tempo IA');
    // Retorna null para o handler tratar com mensagem de erro genérica se quiser
    return null; 
  }
}

module.exports = { generateAIResponse };