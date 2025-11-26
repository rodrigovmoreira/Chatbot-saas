const { saveMessage, getLastMessages } = require('./services/message');
const { generateAIResponse } = require('./services/ai');
const { sendWhatsAppMessage } = require('./services/twilioService');
const BusinessConfig = require('./models/BusinessConfig');

// Configurações
const MAX_HISTORY = 10;

// ==========================================
// 🛠️ FUNÇÕES AUXILIARES
// ==========================================

/**
 * Remove o prefixo 'whatsapp:' para salvar no banco de dados limpo
 * Ex: 'whatsapp:+551199999999' -> '+551199999999'
 */
const normalizePhone = (twilioPhone) => {
  return twilioPhone ? twilioPhone.replace('whatsapp:', '') : '';
};

/**
 * Busca a configuração da empresa.
 * No futuro, isso pode buscar baseado no número de destino (To) para Multi-Tenant.
 */
async function getUserBusinessConfig(botNumber) {
  try {
    // Tenta pegar a primeira configuração disponível (Fallback para Single Tenant/Sandbox)
    // Se você tiver múltiplos clientes no futuro, aqui você filtraria pelo 'botNumber'
    const config = await BusinessConfig.findOne({}).populate('userId');
    
    if (config) {
      // console.log(`🏢 Configuração carregada: ${config.businessName}`);
      return config;
    }
    return null;
  } catch (error) {
    console.error('💥 Erro ao buscar configuração:', error);
    return null;
  }
}

/**
 * Verifica se está dentro do horário de funcionamento
 */
function isWithinOperatingHours(businessConfig) {
  if (!businessConfig.operatingHours || !businessConfig.operatingHours.opening || !businessConfig.operatingHours.closing) {
    return true; // Se não configurado, assume 24h
  }

  // Ajuste de Fuso Horário (Brasil -3)
  // O servidor pode estar em UTC, então forçamos o ajuste se necessário
  const now = new Date();
  // Se o servidor estiver em UTC e quisermos horário de SP:
  // now.setHours(now.getHours() - 3); 

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeVal = currentHour * 60 + currentMinute;

  const [openH, openM] = businessConfig.operatingHours.opening.split(':').map(Number);
  const [closeH, closeM] = businessConfig.operatingHours.closing.split(':').map(Number);
  
  const openTimeVal = openH * 60 + openM;
  const closeTimeVal = closeH * 60 + closeM;

  return currentTimeVal >= openTimeVal && currentTimeVal <= closeTimeVal;
}

// ==========================================
// 🚀 HANDLER PRINCIPAL (WEBHOOK TWILIO)
// ==========================================

async function handleTwilioMessage(twilioData) {
  const { Body, From, To, ProfileName } = twilioData;

  // 1. Validação Básica
  if (!Body || !From) return;

  const userPhone = normalizePhone(From); // Formato para o Banco (+55...)
  const userMessage = Body.trim();

  // Log discreto para não poluir
  console.log(`📩 Msg de ${ProfileName || userPhone}: "${userMessage.substring(0, 50)}..."`);

  try {
    // 2. Carregar Configuração do Negócio
    const businessConfig = await getUserBusinessConfig(To);

    if (!businessConfig) {
      console.log('⚠️ Nenhuma configuração encontrada. Bot inativo.');
      // Opcional: Avisar o admin ou responder mensagem genérica
      return;
    }

    // 3. Verificar Horário (Se fechado, responde e para)
    if (!isWithinOperatingHours(businessConfig)) {
      console.log('🌙 Fora do horário. Enviando msg de ausência.');
      await sendWhatsAppMessage(From, businessConfig.awayMessage);
      // Não salvamos mensagem de ausência como interação de bot para não quebrar fluxo
      return;
    }

    // 4. Salvar mensagem do Usuário no Banco
    // (Importante salvar ANTES de processar para garantir ordem no histórico)
    await saveMessage(userPhone, 'user', userMessage);

    // 5. Verificar Menu (Lógica Determinística - Rápida)
    const menuResponse = await processMenuCommand(userMessage, businessConfig);
    
    if (menuResponse) {
      console.log('✅ Comando de menu detectado.');
      await sendWhatsAppMessage(From, menuResponse);
      await saveMessage(userPhone, 'bot', menuResponse);
      return; // Encerra aqui, economiza token de IA
    }

    // 6. Inteligência Artificial (Fallback Contextual)
    // Se não for comando exato, deixa a IA responder
    
    // Carregar histórico recente
    const history = await getLastMessages(userPhone, MAX_HISTORY);
    
    // Montar contexto
    const context = createBusinessContext(history, businessConfig);
    
    // Gerar resposta
    const aiResponse = await generateBusinessAIResponse(userMessage, context, businessConfig);

    if (aiResponse) {
      await sendWhatsAppMessage(From, aiResponse);
      await saveMessage(userPhone, 'bot', aiResponse);
    } else {
      // Fallback finalíssimo
      await sendWhatsAppMessage(From, "🤖 Desculpe, não entendi. Pode tentar escolher uma opção do menu?");
    }

  } catch (error) {
    console.error('💥 Erro crítico no handleTwilioMessage:', error);
    // Tenta enviar mensagem de erro amigável se possível
    try {
      await sendWhatsAppMessage(From, "⚠️ Tive um pequeno problema técnico. Tente novamente em instantes.");
    } catch (e) { /* Ignora erro de envio de erro */ }
  }
}

// ==========================================
// 🧠 LÓGICA DE NEGÓCIO E IA
// ==========================================

async function processMenuCommand(message, businessConfig) {
  try {
    const lowerMessage = message.toLowerCase().trim();
    const menuOptions = businessConfig.menuOptions || [];

    // Busca inteligente (Número, Palavra-chave ou Sinônimos)
    const option = menuOptions.find((opt, index) => {
      // 1. Número exato (ex: "1")
      const matchByNumber = lowerMessage === (index + 1).toString();
      
      // 2. Palavra-chave exata ou contida (ex: "pix")
      const matchByKeyword = opt.keyword && (
        lowerMessage === opt.keyword.toLowerCase() || 
        lowerMessage.includes(opt.keyword.toLowerCase())
      );

      // 3. Sinônimos Comuns (Hardcoded para melhorar UX)
      const synonyms = {
        'horario': ['horário', 'funcionamento', 'hora', 'aberto', 'fechado'],
        'produtos': ['produto', 'catalogo', 'catálogo', 'serviço', 'serviços', 'preço', 'valor'],
        'atendente': ['humano', 'pessoa', 'falar com gente', 'suporte'],
        'pix': ['pagamento', 'pagar', 'conta', 'transferencia']
      };

      let matchBySynonym = false;
      if (opt.keyword && synonyms[opt.keyword]) {
        matchBySynonym = synonyms[opt.keyword].some(s => lowerMessage.includes(s));
      }

      return matchByNumber || matchByKeyword || matchBySynonym;
    });

    if (option) {
      let response = option.response;
      if (option.requiresHuman) {
        response = `👨‍💼 ${response}\n\n*Um atendente foi notificado e falará com você em breve.*`;
      }
      return response;
    }
    return null;
  } catch (error) {
    console.error('Erro ao processar menu:', error);
    return null;
  }
}

function createBusinessContext(history, businessConfig) {
  const businessInfo = `
*EMPRESA:* ${businessConfig.businessName || 'Empresa'}
*SEGMENTO:* ${businessConfig.businessType || 'Geral'}
*HORÁRIO:* ${businessConfig.operatingHours?.opening} às ${businessConfig.operatingHours?.closing}
*BOAS-VINDAS:* "${businessConfig.welcomeMessage}"
`.trim();

  // Formata produtos para a IA entender preços
  const productsInfo = businessConfig.products && businessConfig.products.length > 0
    ? `*CATÁLOGO (Use estes preços):*\n${businessConfig.products.map(p => `- ${p.name}: R$ ${p.price} (${p.description || ''})`).join('\n')}`
    : 'Nenhum produto cadastrado.';

  const menuInfo = businessConfig.menuOptions && businessConfig.menuOptions.length > 0
    ? `*MENU DO SISTEMA:*\n${businessConfig.menuOptions.map((opt, i) => `${i+1}. ${opt.keyword} - ${opt.description}`).join('\n')}`
    : '';

  // Formata histórico
  const conversationHistory = history
    .reverse()
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`)
    .join('\n');

  return `${businessInfo}\n\n${productsInfo}\n\n${menuInfo}\n\n*HISTÓRICO RECENTE:*\n${conversationHistory}`;
}

async function generateBusinessAIResponse(message, context, businessConfig) {
  // Montagem do Prompt System (Instruções para a IA)
  const prompt = `
Você é o assistente virtual da ${businessConfig.businessName}.
Seu tom deve ser: ${businessConfig.businessType === 'advocacia' ? 'formal' : 'amigável, prestativo e informal'}.

REGRAS:
1. Responda de forma curta (máximo 3 frases), como no WhatsApp.
2. Se perguntarem preço, use APENAS o Catálogo acima. Se não estiver lá, diga que não sabe.
3. Se o assunto for algo do MENU, sugira a opção do menu.
4. Jamais invente dados da empresa.
5. Use emojis moderadamente.

DADOS DA EMPRESA E CONTEXTO:
${context}

CLIENTE: "${message}"
RESPOSTA:
`.trim();

  // Chama o serviço de IA (ai.js)
  return await generateAIResponse(prompt); 
}

module.exports = { handleTwilioMessage };