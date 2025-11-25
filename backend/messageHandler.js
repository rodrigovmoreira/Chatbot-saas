const { saveMessage, getLastMessages } = require('./services/message');
const Session = require('./models/Session');
const { simulateTyping } = require('./utils/chatUtils');
const { generateAIResponse } = require('./services/ai');
const BusinessConfig = require('./models/BusinessConfig');

// Configurações
const MAX_HISTORY = 10;
const ERROR_MESSAGE = '⚠️ Ops! Tive um problema. Pode tentar novamente?';

const whatsappUserMap = new Map();

async function getUserBusinessConfig(phone) {
  try {
    // Primeiro tenta encontrar pelo mapeamento direto
    const userId = whatsappUserMap.get(phone);

    if (userId) {
      console.log('🔍 Buscando configuração para usuário mapeado:', userId);
      const config = await BusinessConfig.findOne({ userId }).populate('userId');
      if (config) return config;
    }

    // Se não encontrou, busca a primeira configuração (fallback para single user)
    console.log('🔍 Buscando primeira configuração disponível (fallback)');
    const config = await BusinessConfig.findOne({}).populate('userId');

    // Se encontrou, mapeia para futuras consultas
    if (config && config.userId) {
      whatsappUserMap.set(phone, config.userId._id);
      console.log('✅ Mapeado telefone', phone, 'para usuário:', config.userId._id);
    }

    return config;
  } catch (error) {
    console.error('💥 Erro ao buscar configuração do usuário:', error);
    return null;
  }
}

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
    const phone = msg.from;

    // Ignora mensagens vazias
    if (!userMessage) {
      console.log('❌ Mensagem vazia ignorada');
      return;
    }

    console.log('🔍 Buscando configuração do negócio...');

    // ✅ CORREÇÃO: Buscar configuração de forma mais robusta
    let businessConfig;
    try {
      businessConfig = await getUserBusinessConfig(phone);

      if (!businessConfig) {
        console.log('❌ Nenhuma configuração de negócio encontrada no banco');
        await client.sendMessage(msg.from, '🤖 Olá! No momento estou em configuração. Por favor, aguarde.');
        return;
      }

      console.log('✅ Configuração do negócio encontrada:', {
        business: businessConfig.businessName,
        user: businessConfig.userId?._id || 'N/A',
        menuOptions: businessConfig.menuOptions?.length || 0,
        products: businessConfig.products?.length || 0
      });

    } catch (error) {
      console.error('💥 Erro ao buscar configuração:', error);
      await client.sendMessage(msg.from, '🤖 Estou com problemas técnicos. Tente novamente em alguns instantes.');
      return;
    }

    // Verificar horário de funcionamento
    if (!isWithinOperatingHours(businessConfig)) {
      console.log('🌙 Fora do horário de funcionamento, enviando mensagem de ausência.');
      await client.sendMessage(msg.from, businessConfig.awayMessage);
      await saveMessage(msg.from, 'bot', businessConfig.awayMessage);
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
    console.log('📋 Verificando se é comando do menu...');
    const menuResponse = await processMenuCommand(userMessage, businessConfig);

    if (menuResponse) {
      console.log('✅ Comando do menu reconhecido, enviando resposta do menu');
      await client.sendMessage(msg.from, menuResponse);
      await saveMessage(msg.from, 'bot', menuResponse);
      return; // PARA AQUI - não chama IA
    }

    console.log('❌ Não é comando de menu, usando IA como fallback...');

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
    console.log('📋 Mostrando menu principal personalizado para:', phone);

    const menuOptions = businessConfig.menuOptions || [];

    if (menuOptions.length === 0) {
      const defaultMenu = `🤖 *${businessConfig.businessName || 'Nosso Atendimento'}*

Olá! Sou o assistente virtual da ${businessConfig.businessName}. 

Como posso ajudar você hoje? Pode me perguntar diretamente ou digitar:

*1* - Falar com atendente humano
*2* - Horário de funcionamento
*3* - Conhecer nossos produtos/serviços

Ou simplesmente digite sua dúvida!`;

      await client.sendMessage(phone, defaultMenu);
      await saveMessage(phone, 'bot', defaultMenu);
      return;
    }

    // Menu personalizado com as opções cadastradas
    const menuText = `🤖 *${businessConfig.businessName || 'Menu Principal'}*

${businessConfig.welcomeMessage || 'Como posso ajudar você hoje?'}

*ESCOLHA UMA OPÇÃO:*\n\n` +
      menuOptions.map((opt, index) =>
        `*${index + 1}️⃣* - *${opt.keyword}*: ${opt.description}`
      ).join('\n') +
      `\n\n💡 *Dica:* Digite o *número* ou *palavra-chave* da opção desejada.`;

    await client.sendMessage(phone, menuText);
    await saveMessage(phone, 'bot', menuText);
    console.log('✅ Menu principal personalizado enviado');
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

    // ✅ MELHORIA: Busca mais inteligente - por número, palavra-chave EXATA ou sinônimos comuns
    const option = menuOptions.find((opt, index) => {
      const matchByNumber = lowerMessage === (index + 1).toString();
      const matchByExactKeyword = opt.keyword && lowerMessage === opt.keyword.toLowerCase();
      const matchByContains = opt.keyword && lowerMessage.includes(opt.keyword.toLowerCase());

      // Sinônimos comuns para melhor UX
      const synonyms = {
        'horario': ['horário', 'funcionamento', 'hora', 'aberto', 'fechado', 'atendimento'],
        'produtos': ['produto', 'catalogo', 'catálogo', 'serviços', 'servicos', 'o que tem'],
        'preco': ['preço', 'valor', 'custo', 'quanto custa'],
        'atendente': ['humano', 'pessoa', 'vendedor', 'corretor', 'consultor']
      };

      const hasSynonyms = synonyms[opt.keyword]?.some(synonym =>
        lowerMessage.includes(synonym)
      );

      return matchByNumber || matchByExactKeyword || matchByContains || hasSynonyms;
    });

    if (option) {
      console.log('✅ Opção do menu encontrada:', option.keyword);

      // ✅ MELHORIA: Formatação melhor da resposta
      if (option.requiresHuman) {
        return `👨‍💼 ${option.response}\n\n*Um de nossos atendentes entrará em contato em breve!* ⏳`;
      }

      return `✅ ${option.response}`;
    }

    console.log('❌ Nenhuma opção do menu correspondente');
    return null;
  } catch (error) {
    console.error('💥 Erro ao processar comando do menu:', error);
    return null;
  }
}

// Verificar horário de funcionamento
function isWithinOperatingHours(businessConfig) {
  if (!businessConfig.operatingHours || !businessConfig.operatingHours.opening || !businessConfig.operatingHours.closing) {
    return true; // Se não configurado, considera sempre aberto
  }

  const now = new Date();
  const opening = new Date();
  const closing = new Date();

  const [openingHour, openingMinute] = businessConfig.operatingHours.opening.split(':');
  opening.setHours(openingHour, openingMinute, 0);

  const [closingHour, closingMinute] = businessConfig.operatingHours.closing.split(':');
  closing.setHours(closingHour, closingMinute, 0);

  return now >= opening && now <= closing;
}

// Criar contexto para IA com informações do negócio
function createBusinessContext(history, businessConfig) {
  try {
    if (!businessConfig) {
      return 'Informações da empresa não disponíveis.';
    }

    const businessInfo = `
*EMPRESA:* ${businessConfig.businessName || 'Não configurado'}
*SEGMENTO:* ${businessConfig.businessType || 'Não especificado'}
*HORÁRIO DE ATENDIMENTO:* ${businessConfig.operatingHours?.opening || '09:00'} às ${businessConfig.operatingHours?.closing || '18:00'}
*MENSAGEM DE BOAS-VINDAS:* "${businessConfig.welcomeMessage || 'Olá! Como posso ajudar?'}"
`.trim();

    const productsInfo = businessConfig.products && businessConfig.products.length > 0
      ? `*PRODUTOS/SERVIÇOS:*\n${businessConfig.products.map(p =>
        `- ${p.name}: R$ ${p.price || 'consultar'} | ${p.description || 'Sem descrição'}`
      ).join('\n')}`
      : '*PRODUTOS:* Nenhum produto cadastrado.';

    const menuInfo = businessConfig.menuOptions && businessConfig.menuOptions.length > 0
      ? `*OPÇÕES DE MENU CADASTRADAS:*\n${businessConfig.menuOptions.map((opt, index) =>
        `${index + 1}. ${opt.keyword} - ${opt.description}`
      ).join('\n')}`
      : '*MENU:* Nenhuma opção de menu configurada';

    const conversationHistory = history
      .reverse()
      .map(m => `${m.role === 'user' ? '👤 Cliente' : '🤖 Bot'}: ${m.content}`)
      .join('\n');

    return `${businessInfo}\n\n${productsInfo}\n\n${menuInfo}\n\n*HISTÓRICO:*\n${conversationHistory || 'Nenhuma conversa anterior'}`;
  } catch (error) {
    console.error('💥 Erro ao criar contexto:', error);
    return 'Informações da empresa não disponíveis.';
  }
}

// Gerar resposta da IA contextualizada para o negócio
async function generateBusinessAIResponse(message, context, businessConfig) {
  try {
    console.log('🧠 Preparando prompt para IA com contexto do negócio...');

    // Define o tom de voz com base no tipo de negócio
    const toneOfVoice = {
      'restaurante': 'amigável e convidativo',
      'imoveis': 'profissional e confiável',
      'servicos': 'técnico e solucionador',
      'varejo': 'prestativo e vendedor',
      'outros': 'educado e informativo'
    }[businessConfig.businessType] || 'educado e prestativo';

    // Prepara as informações dinâmicas para o prompt
    const menuOptionsText = businessConfig.menuOptions?.length > 0
      ? businessConfig.menuOptions.map((opt, i) => `*${i + 1}*. ${opt.keyword}: ${opt.description}`).join('\n')
      : 'Nenhuma opção de menu configurada.';

    const historyText = context.includes('*HISTÓRICO:*')
      ? context.split('*HISTÓRICO:*')[1].trim()
      : 'Nenhuma conversa anterior.';

    // Pega o prompt do banco de dados (com o novo campo)
    const basePrompt = businessConfig.prompt || `
Você é um assistente virtual da empresa "{{businessName}}".

**Seu Papel:**
- Atue como um funcionário especialista no segmento de "{{businessType}}".
- Adote um tom de voz que seja {{toneOfVoice}}.
- Sua missão é ajudar os clientes de forma eficiente, usando as informações fornecidas e seguindo as regras abaixo.

**Instruções Críticas:**
1. **Priorize o Menu:** Sempre que a pergunta do cliente puder ser respondida por uma das opções do menu, direcione-o para lá.
2. **Use as Informações da Empresa:** Baseie TODAS as suas respostas nas "INFORMAÇÕES DA EMPRESA" fornecidas.
3. **Não Invente:** NUNCA forneça informações que não estão na sua base de conhecimento (produtos, preços, políticas, etc.). Se não souber a resposta, seja honesto e ofereça ajuda alternativa, como falar com um atendente.
4. **Encaminhe para Atendimento Humano:** Se o cliente demonstrar insatisfação, pedir para falar com uma pessoa, ou se o problema for muito complexo para você, encaminhe-o para o atendimento humano.
5. **Seja Conciso e Claro:** Responda de forma direta e fácil de entender.

**Opções de Atendimento (Menu):**
{{menuOptions}}

**Informações da Empresa:**
{{context}}

**Histórico Recente da Conversa:**
{{history}}

**Mensagem Atual do Cliente:**
"{{message}}"

**Sua Resposta (seja natural, prestativo e siga TODAS as regras):**
`;

    // Substitui os placeholders pelos valores reais
    const finalPrompt = basePrompt
      .replace('{{businessName}}', businessConfig.businessName || 'nossa empresa')
      .replace('{{businessType}}', businessConfig.businessType || 'geral')
      .replace('{{toneOfVoice}}', toneOfVoice)
      .replace('{{welcomeMessage}}', businessConfig.welcomeMessage || 'Olá!')
      .replace('{{menuOptions}}', menuOptionsText)
      .replace('{{context}}', context)
      .replace('{{history}}', historyText)
      .replace('{{message}}', message);

    console.log('📤 Enviando prompt final para IA...');
    const response = await generateAIResponse(finalPrompt);

    if (response && response.trim()) {
      return response.trim();
    } else {
      console.log('❌ IA retornou resposta vazia');
      return "🤖 No momento não consigo responder. Pode tentar uma das opções do menu ou falar com nosso atendente humano?";
    }
  } catch (error) {
    console.error('💥 Erro ao gerar resposta da IA:', error);
    return "🤖 Estou com dificuldades técnicas. Pode tentar novamente ou falar com nosso atendente humano?";
  }
}

module.exports = { handleMessage };