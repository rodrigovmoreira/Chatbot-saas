const mongoose = require('mongoose');
const Contact = require('../models/Contact');

const messageSchema = new mongoose.Schema({
  contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', required: true },
  phone: { type: String, required: true },
  role: { type: String, enum: ['user', 'bot', 'agent'], required: true },
  content: { type: String, required: true }, 

  messageType: {
    type: String,
    enum: ['text', 'image', 'audio', 'document', 'video'],
    default: 'text'
  },

  aiAnalysis: {
    isAnalyzed: { type: Boolean, default: false },
    description: { type: String }, 
    detectedIntent: { type: String },
    confidenceScore: { type: Number },
    modelUsed: { type: String }
  },

  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.models.ChatMessage || mongoose.model('ChatMessage', messageSchema);

async function saveMessage(phone, role, content, messageType = 'text', visionResult = null, businessId) {
  try {
    if (!businessId) {
      console.error("❌ ERRO GRAVE: Tentativa de salvar mensagem sem businessId!");
      return;
    }

    // 1. Busca ou Cria contato
    let contact = await Contact.findOne({ phone, businessId });

    if (!contact) {
      contact = await Contact.create({
        phone,
        businessId,
        totalMessages: 0,
        followUpStage: 0,
        followUpActive: false // Começa inativo até a primeira interação
      });
    }

    // 2. Atualiza estatísticas básicas
    contact.totalMessages += 1;
    contact.lastInteraction = new Date();
    contact.lastSender = role;

    // === 3. LÓGICA DO FOLLOW-UP (A CORREÇÃO) ===
    
    if (role === 'user') {
      // CENÁRIO: Cliente falou
      // Ação: O cliente quebrou o silêncio. Paramos de perseguir.
      contact.followUpStage = 0; 
      contact.followUpActive = false; // Desativa o scheduler para este contato
      console.log(`👤 [${phone}] Cliente respondeu. Follow-up pausado.`);
    } 
    else if (role === 'bot') {
      // CENÁRIO: Bot falou (resposta da IA ou mensagem automática)
      // Ação: Começamos a contar o tempo para o cliente responder.
      contact.followUpActive = true; // Ativa o scheduler
      contact.lastResponseTime = new Date(); // O relógio começa AGORA
      console.log(`🤖 [${phone}] Bot respondeu. Follow-up armado.`);
    }

    // Salva as alterações no Contato
    await contact.save();

    // 4. Cria o registro da mensagem no histórico
    const msgData = {
      contactId: contact._id,
      phone,
      role,
      content,
      messageType
    };

    if (visionResult) {
      msgData.aiAnalysis = {
        isAnalyzed: true,
        description: visionResult,
        modelUsed: 'gemini-2.5-flash'
      };
    }

    await Message.create(msgData);

  } catch (error) {
    console.error('💥 Erro ao salvar mensagem:', error);
  }
}

async function getImageHistory(phone, businessId) {
  try {
    if (!businessId) return [];
    const contact = await Contact.findOne({ phone, businessId });
    if (!contact) return [];

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