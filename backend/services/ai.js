const axios = require('axios');

async function generateAIResponse(message, context = '') {
  console.time('⏳ Tempo IA');
  console.log('🧠 Iniciando geração de resposta IA...');

  try {
    // ✅ CORREÇÃO: Verificar variáveis de ambiente
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('❌ DEEPSEEK_API_KEY não configurada no .env');
      console.timeEnd('⏳ Tempo IA');
      return "🤖 No momento não consigo processar mensagens. Sistema em configuração.";
    }

    if (!process.env.DEEPSEEK_API_URL) {
      console.error('❌ DEEPSEEK_API_URL não configurada no .env');
      console.timeEnd('⏳ Tempo IA');
      return "🤖 Configuração de IA incompleta. Contate o suporte.";
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const apiUrl = process.env.DEEPSEEK_API_URL;
    const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

    console.log('🔑 API Key presente:', apiKey ? 'SIM' : 'NÃO');
    console.log('🌐 API URL:', apiUrl);
    console.log('🤖 Modelo:', model);

    const prompt = `
Você é o Moreira Bot, uma IA que gosta de conversar.
Responda como se estivesse conversando no WhatsApp, com uma linguagem informal e clara.
Se você não souber a resposta ou não tiver certeza absoluta, diga que não sabe.
NUNCA de uma resposta que não tenha certeza absoluta.
Use emoji com moderação, só quando fizer sentido.
E deixe as respostas mais curtas.

Contexto da conversa:
${context}

Usuário: ${message}
Moreira Bot:
`.trim();

    console.log('📤 Enviando requisição para API da DeepSeek...');
    console.log('📝 Prompt length:', prompt.length);
    console.log('📝 Context length:', context.length);

    // ✅ CORREÇÃO: Configuração melhorada do axios
    const response = await axios.post(
      apiUrl,
      {
        model: model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7, // ✅ Aumentado para respostas mais criativas
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'ChatBot-Platform/1.0'
        },
        timeout: 30000, // ✅ 30 segundos timeout
        validateStatus: function (status) {
          return status < 500; // ✅ Aceita apenas status codes < 500
        }
      }
    );

    console.log('📥 Resposta recebida da API. Status:', response.status);

    // ✅ CORREÇÃO: Validação robusta da resposta
    if (response.status !== 200) {
      console.error('❌ Erro na API. Status:', response.status);
      console.error('❌ Detalhes do erro:', response.data);
      
      if (response.status === 401) {
        throw new Error('API Key inválida ou expirada');
      } else if (response.status === 429) {
        throw new Error('Limite de requisições excedido');
      } else if (response.status === 400) {
        throw new Error('Requisição inválida para a API');
      } else {
        throw new Error(`Erro da API: ${response.status} - ${JSON.stringify(response.data)}`);
      }
    }

    // ✅ CORREÇÃO: Validação da estrutura da resposta
    if (!response.data || !response.data.choices || !Array.isArray(response.data.choices) || response.data.choices.length === 0) {
      console.error('❌ Estrutura da resposta inválida:', response.data);
      throw new Error('Resposta da API em formato inválido');
    }

    const firstChoice = response.data.choices[0];
    if (!firstChoice.message || !firstChoice.message.content) {
      console.error('❌ Conteúdo da resposta inválido:', firstChoice);
      throw new Error('Conteúdo da resposta da API inválido');
    }

    const aiResponse = firstChoice.message.content.trim();
    
    console.log('✅ Resposta da IA gerada com sucesso');
    console.log('📄 Resposta:', aiResponse.substring(0, 100) + (aiResponse.length > 100 ? '...' : ''));
    console.timeEnd('⏳ Tempo IA');

    return aiResponse;

  } catch (error) {
    console.error('💥 ERRO na geração de resposta IA:');
    
    // ✅ CORREÇÃO: Logs mais detalhados do erro
    if (error.response) {
      // Erro da API
      console.error('❌ Status:', error.response.status);
      console.error('❌ Data:', error.response.data);
      console.error('❌ Headers:', error.response.headers);
    } else if (error.request) {
      // Sem resposta da API
      console.error('❌ Sem resposta da API. Request:', error.request);
      console.error('❌ Possível problema de conexão ou timeout');
    } else {
      // Outro erro
      console.error('❌ Erro de configuração:', error.message);
    }

    console.error('❌ Stack trace:', error.stack);
    console.timeEnd('⏳ Tempo IA');

    // ✅ CORREÇÃO: Mensagens de erro mais específicas
    if (error.code === 'ECONNABORTED') {
      return "🤖 A consulta está demorando muito. Pode tentar novamente?";
    } else if (error.message.includes('API Key')) {
      return "🤖 Problema de configuração do sistema. Contate o suporte.";
    } else if (error.message.includes('Limite')) {
      return "🤖 Muitas consultas no momento. Tente novamente em alguns instantes.";
    } else if (error.message.includes('timeout')) {
      return "🤖 Tempo esgotado. Pode reformular sua pergunta?";
    } else {
      return "🤖 Estou com dificuldades técnicas no momento. Pode tentar novamente ou falar com um atendente humano?";
    }
  }
}

module.exports = { generateAIResponse };