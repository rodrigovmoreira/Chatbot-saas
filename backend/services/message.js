const mongoose = require('mongoose');

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

  // === NOVO: METADADOS DE INTELIGÊNCIA ===
  aiAnalysis: {
    isAnalyzed: { type: Boolean, default: false },
    description: { type: String }, // O que o Gemini viu
    detectedIntent: { type: String }, // Ex: "pagamento", "orçamento" (Futuro)
    confidenceScore: { type: Number }, // (Futuro)
    modelUsed: { type: String } // Ex: "gemini-2.5-flash"
  },
  // ======================================

  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('ChatMessage', messageSchema);

// Atualizei a função saveMessage para aceitar a análise
async function saveMessage(phone, role, content, messageType = 'text', analysisData = null) {
  try {
    let contact = await mongoose.model('Contact').findOne({ phone });
    
    if (!contact) {
      contact = await mongoose.model('Contact').create({ phone, totalMessages: 0 });
    }

    contact.totalMessages += 1;
    contact.lastInteraction = new Date();
    contact.lastSender = role;
    contact.followUpStage = 0; // Reseta funil se houver interação
    await contact.save();

    const msgData = { 
      contactId: contact._id,
      phone, 
      role, 
      content,
      messageType
    };

    // Se tiver análise de imagem, salva junto
    if (analysisData) {
      msgData.aiAnalysis = {
        isAnalyzed: true,
        description: analysisData,
        modelUsed: 'gemini-vision'
      };
    }

    await Message.create(msgData);
    
  } catch (error) {
    console.error('💥 Erro ao salvar mensagem:', error);
  }
}

// Função para buscar histórico focado em imagens (O que você pediu)
async function getImageHistory(phone) {
  try {
    const contact = await mongoose.model('Contact').findOne({ phone });
    if (!contact) return [];

    // Busca apenas mensagens que tenham análise de IA
    return await Message.find({ 
      contactId: contact._id,
      'aiAnalysis.isAnalyzed': true 
    })
    .sort({ timestamp: -1 })
    .limit(5)
    .select('content aiAnalysis timestamp')
    .lean();
  } catch (error) {
    return [];
  }
}

async function getLastMessages(phone, limit = 15) {
  try {
    const contact = await mongoose.model('Contact').findOne({ phone });
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