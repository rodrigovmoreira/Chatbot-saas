const mongoose = require('mongoose');
// Importamos o Contact para garantir que o Mongoose conheça o Schema antes de usar
// Certifique-se de que o arquivo models/Contact.js existe conforme criamos no passo anterior
const Contact = require('../models/Contact');

const messageSchema = new mongoose.Schema({
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  phone: { type: String, required: true },
  role: { type: String, enum: ['user', 'bot', 'agent'], required: true },
  content: { type: String, required: true }, // Texto visível

  messageType: {
    type: String,
    enum: ['text', 'image', 'audio', 'document', 'video'],
    default: 'text'
  },

  // === METADADOS DE INTELIGÊNCIA ===
  aiAnalysis: {
    isAnalyzed: { type: Boolean, default: false },
    description: { type: String }, // O que o Gemini viu
    detectedIntent: { type: String },
    confidenceScore: { type: Number },
    modelUsed: { type: String }
  },
  // =================================

  timestamp: { type: Date, default: Date.now }
});

// Verifica se o model já existe para evitar erro de re-compilação em hot-reload
const Message = mongoose.models.ChatMessage || mongoose.model('ChatMessage', messageSchema);

/*
 * Salva uma mensagem no banco vinculada à empresa correta.
 * @param {string} phone - Telefone do contato
 * @param {string} role - Quem enviou ('user', 'bot')
 * @param {string} content - Conteúdo do texto
 * @param {string} messageType - Tipo da mensagem
 * @param {string|null} visionResult - Resultado da análise de imagem (se houver)
 * @param {string} businessId - ID da empresa (Obrigatório para SaaS)
 */
async function saveMessage(phone, role, content, messageType = 'text', visionResult = null, businessId) {
  try {
    if (!businessId) {
      console.error("❌ ERRO GRAVE: Tentativa de salvar mensagem sem businessId!");
      return;
    }

    // 1. Busca contato ESPECÍFICO desta empresa
    let contact = await Contact.findOne({ phone, businessId });

    // 2. Se não existe, cria vinculado à empresa
    if (!contact) {
      contact = await Contact.create({
        phone,
        businessId, // <--- Vínculo de segurança
        totalMessages: 0,
        followUpStage: 0
      });
    }

    // 3. Atualiza estatísticas do contato
    contact.totalMessages += 1;
    contact.lastInteraction = new Date();
    contact.lastSender = role;

    // Se o cliente respondeu, zera o funil de vendas (regra de negócio)
    if (role === 'user') {
      contact.followUpStage = 0;
    }
    await contact.save();

    // 4. Prepara dados da mensagem
    const msgData = {
      contactId: contact._id,
      phone,
      role,
      content,
      messageType
    };

    // Se tiver análise de imagem, salva junto
    if (visionResult) {
      msgData.aiAnalysis = {
        isAnalyzed: true,
        description: visionResult,
        modelUsed: 'gemini-2.5-flash'
      };
    }

    // 5. Cria a mensagem
    await Message.create(msgData);

  } catch (error) {
    console.error('💥 Erro ao salvar mensagem:', error);
  }
}

// Função para buscar histórico focado em imagens
async function getImageHistory(phone, businessId) {
  try {
    if (!businessId) return [];

    const contact = await Contact.findOne({ phone, businessId });
    if (!contact) return [];

    // Busca apenas mensagens que tenham análise de IA deste contato
    return await Message.find({
      contactId: contact._id,
      'aiAnalysis.isAnalyzed': true
    })
      .sort({ timestamp: -1 })
      .limit(5)
      .select('content aiAnalysis timestamp')
      .lean();
  } catch (error) {
    console.error('Erro ao buscar histórico de imagens:', error);
    return [];
  }
}

// Busca histórico geral de texto
async function getLastMessages(phone, limit = 15, businessId) {
  try {
    if (!businessId) return [];

    const contact = await Contact.findOne({ phone, businessId });
    if (!contact) return [];

    return await Message.find({ contactId: contact._id })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (error) {
    console.error('💥 Erro ao buscar mensagens:', error);
    return [];
  }
}

module.exports = { saveMessage, getImageHistory, getLastMessages };