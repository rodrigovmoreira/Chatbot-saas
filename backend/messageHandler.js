const { saveMessage, getLastMessages } = require('./services/message');
const Session = require('./models/Session'); // ✅ CORREÇÃO: Import correto
const { simulateTyping } = require('./utils/chatUtils');
const { generateAIResponse } = require('./services/ai');
const BusinessConfig = require('./models/BusinessConfig');

// Configurações
const MAX_HISTORY = 5;
const ERROR_MESSAGE = '⚠️ Ops! Tive um problema. Pode tentar novamente?';

async function handleMessage(client, msg) {
  // ✅ CORREÇÃO: Validação mais robusta
  if (!msg || !msg.from || !msg.body) {
    console.log('❌ Mensagem inválida ignorada');
    return;
  }

  if (msg.from.includes('status') || msg.from.includes('broadcast')) {
    console.log('❌ Mensagem de status/broadcast ignorada');
    return;
  }

  // ✅ CORREÇÃO: Ignorar mensagens de grupos
  if (msg.from.includes('@g.us')) {
    console.log('❌ Mensagem de grupo ignorada:', msg.from);
    return;
  }

  try {
    console.log('📩 Mensagem recebida de:', msg.from.replace('@c.us', ''), 'Conteúdo:', msg.body);

    const chat = await msg.getChat();
    const userMessage = msg.body.trim();

    // Ignora mensagens vazias
    if (!userMessage) {
      console.log('❌ Mensagem vazia ignorada');
      return;
    }

    console.log('🔍 Buscando configuração do negócio...');

    // ✅ CORREÇÃO: Buscar configuração de forma mais robusta
    let businessConfig;
    try {
      businessConfig = await BusinessConfig.findOne({}).populate('userId');
      if (!businessConfig) {
        console.log('❌ Nenhuma configuração de negócio encontrada no banco');
        await client.sendMessage(msg.from, '🤖 Olá! No momento estou em configuração. Por favor, aguarde.');
        return;
      }
      console.log('✅ Configuração do negócio encontrada:', businessConfig.businessName);
    } catch (error) {
      console.error('💥 Erro ao buscar configuração:', error);
      await client.sendMessage(msg.from, '🤖 Estou com problemas técnicos. Tente novamente em alguns instantes.');
      return;
    }

    // ✅ CORREÇÃO: Verificar se é novo cliente de forma mais precisa
    let isNewCustomer = false;
    try {
      const messageCount = await getLastMessages(msg.from, 1);
      isNewCustomer = messageCount.length === 0;
      console.log('👤 É novo cliente?:', isNewCustomer);
    } catch (error) {
      console.error('💥 Erro ao verificar histórico:', error);
      // Continua como se fosse novo cliente em caso de erro
      isNewCustomer = true;
    }

    // ✅ CORREÇÃO: Salvar mensagem do usuário PRIMEIRO
    try {
      await saveMessage(msg.from, 'user', userMessage);
      console.log('💾 Mensagem do usuário salva');
    } catch (error) {
      console.error('💥 Erro ao salvar mensagem do usuário:', error);
    }

    // Mensagem de boas-vindas para novos clientes
    if (isNewCustomer) {
      console.log('🎉 Enviando mensagem de boas-vindas para novo cliente');
      await client.sendMessage(msg.from, businessConfig.welcomeMessage);
      await showMainMenu(client, msg.from, businessConfig);
      await saveMessage(msg.from, 'bot', businessConfig.welcomeMessage);
      return;
    }

    // ✅ CORREÇÃO: Processar comando do menu com mais logs
    console.log('📋 Processando comando do menu...');
    const menuResponse = await processMenuCommand(userMessage, businessConfig);
    if (menuResponse) {
      console.log('✅ Comando do menu reconhecido, enviando resposta:', menuResponse.substring(0, 100) + '...');
      await client.sendMessage(msg.from, menuResponse);
      await saveMessage(msg.from, 'bot', menuResponse);
      return;
    }

    console.log('🧠 Nenhum comando de menu, usando IA...');

    // Se não for comando de menu, usar IA contextual
    let history = [];
    try {
      history = await getLastMessages(msg.from, MAX_HISTORY);
      console.log('📚 Histórico carregado:', history.length, 'mensagens');
    } catch (error) {
      console.error('💥 Erro ao carregar histórico:', error);
    }

    const context = createBusinessContext(history, businessConfig);

    console.log('🔄 Gerando resposta da IA...');
    const aiResponse = await generateBusinessAIResponse(userMessage, context, businessConfig);

    if (aiResponse) {
      console.log('✅ Resposta da IA gerada:', aiResponse.substring(0, 100) + '...');

      // ✅ CORREÇÃO: Simular digitação antes de enviar
      try {
        await simulateTyping(chat);
      } catch (error) {
        console.log('⚠️  Não foi possível simular digitação, continuando...');
      }

      await client.sendMessage(msg.from, aiResponse);
      await saveMessage(msg.from, 'bot', aiResponse);
    } else {
      console.log('❌ IA não retornou resposta, enviando mensagem padrão');
      await client.sendMessage(msg.from, "🤖 Não consegui entender. Pode reformular sua pergunta?");
      await saveMessage(msg.from, 'bot', "🤖 Não consegui entender. Pode reformular sua pergunta?");
    }

  } catch (error) {
    console.error('💥 Erro crítico no handleMessage:', error);
    try {
      await client.sendMessage(msg.from, ERROR_MESSAGE);
    } catch (sendError) {
      console.error('💥 Falha ao enviar mensagem de erro:', sendError);
    }
  }
}

// Mostrar menu principal
async function showMainMenu(client, phone, businessConfig) {
  try {
    console.log('📋 Mostrando menu principal para:', phone);

    const menuOptions = businessConfig.menuOptions || [];
    if (menuOptions.length === 0) {
      console.log('⚠️  Nenhuma opção de menu configurada');
      return;
    }

    const menuText = `🗂️ *Menu Principal*:\n\n` +
      menuOptions.map((opt, index) =>
        `${index + 1}️⃣ *${opt.keyword}* - ${opt.description}`
      ).join('\n') +
      `\n\nDigite o número ou palavra-chave da opção desejada.`;

    await client.sendMessage(phone, menuText);
    await saveMessage(phone, 'bot', menuText);
    console.log('✅ Menu principal enviado');
  } catch (error) {
    console.error('💥 Erro ao mostrar menu principal:', error);
  }
}

// Processar comandos do menu
async function processMenuCommand(message, businessConfig) {
  try {
    const lowerMessage = message.toLowerCase().trim();
    console.log('🔍 Procurando comando no menu:', lowerMessage);

    const menuOptions = businessConfig.menuOptions || [];

    // Buscar opção por número ou palavra-chave
    const option = menuOptions.find((opt, index) => {
      const matchByNumber = lowerMessage === (index + 1).toString();
      const matchByKeyword = opt.keyword && lowerMessage.includes(opt.keyword.toLowerCase());
      return matchByNumber || matchByKeyword;
    });

    if (option) {
      console.log('✅ Opção do menu encontrada:', option.keyword);
      if (option.requiresHuman) {
        return `👨‍💼 ${option.response}\n\nUm de nossos vendedores entrará em contato em breve!`;
      }
      return option.response;
    }

    console.log('❌ Nenhuma opção do menu correspondente');
    return null;
  } catch (error) {
    console.error('💥 Erro ao processar comando do menu:', error);
    return null;
  }
}

// Criar contexto para IA com informações do negócio
function createBusinessContext(history, businessConfig) {
  try {
    const businessInfo = `
Empresa: ${businessConfig.businessName || 'Não configurado'}
Segmento: ${businessConfig.businessType || 'Não especificado'}
Horário: ${businessConfig.operatingHours?.opening || '09:00'} às ${businessConfig.operatingHours?.closing || '18:00'}
    `.trim();

    const productsInfo = businessConfig.products && businessConfig.products.length > 0
      ? `Produtos: ${businessConfig.products.map(p => p.name).join(', ')}`
      : 'Produtos: Nenhum produto cadastrado';

    const conversationHistory = history
      .reverse()
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`)
      .join('\n');

    return `Informações da Empresa:\n${businessInfo}\n${productsInfo}\n\nHistórico da Conversa:\n${conversationHistory || 'Nenhum histórico anterior'}`;
  } catch (error) {
    console.error('💥 Erro ao criar contexto:', error);
    return 'Informações da empresa não disponíveis.';
  }
}

// Gerar resposta da IA contextualizada para o negócio
async function generateBusinessAIResponse(message, context, businessConfig) {
  try {
    console.log('🧠 Preparando prompt para IA...');

    const prompt = `
Você é um atendente virtual da empresa "${businessConfig.businessName || 'nossa empresa'}", que atua no segmento de ${businessConfig.businessType || 'vários serviços'}.

INSTRUÇÕES IMPORTANTES:
- Seja prestativo e educado
- Mantenha respostas curtas e objetivas (máximo 2-3 frases)
- Use emojis moderadamente (1-2 por resposta)
- Fale como se estivesse no WhatsApp
- NÃO invente informações sobre produtos ou preços
- Se não souber a resposta, diga que vai consultar e peça para falar com humano
- Encaminhe para atendimento humano quando necessário

INFORMAÇÕES DA EMPRESA:
${context}

PRODUTOS DISPONÍVEIS:
${(businessConfig.products || []).map(p => `- ${p.name}: R$ ${p.price || 'consultar'} | ${p.description || 'Sem descrição'}`).join('\n') || 'Nenhum produto cadastrado'}

MENSAGEM DO CLIENTE:
${message}

SUA RESPOSTA (seja natural, direto e útil):`.trim();

    console.log('📤 Enviando prompt para IA...');
    const response = await generateAIResponse(prompt);

    if (response && response.trim()) {
      return response.trim();
    } else {
      console.log('❌ IA retornou resposta vazia');
      return "🤖 No momento não consigo responder. Pode entrar em contato com nosso atendente humano?";
    }
  } catch (error) {
    console.error('💥 Erro ao gerar resposta da IA:', error);
    return "🤖 Estou com dificuldades técnicas. Pode tentar novamente ou falar com nosso atendente humano?";
  }
}

module.exports = { handleMessage };