const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Referência ao contato
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'bot', 'agent'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'audio', 'document', 'video'],
    default: 'text'
  },
  // Referência ao usuário do sistema se for um agente humano
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemUser',
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Mudar o nome do model para evitar conflito
const Message = mongoose.model('ChatMessage', messageSchema);

async function saveMessage(phone, role, content, messageType = 'text') {
  try {
    // Encontrar ou criar contato
    let contact = await mongoose.model('Contact').findOne({ phone });
    if (!contact) {
      contact = await mongoose.model('Contact').create({ phone, totalMessages: 0 });
    }

    // === ATUALIZAÇÃO PARA MODO ATIVO ===
    contact.totalMessages += 1;
    contact.lastInteraction = new Date();
    contact.lastSender = role; // 'user' ou 'bot'
    
    // Se o USUÁRIO mandou mensagem, resetamos o flag de follow-up
    // para que, se ele sumir de novo, o bot possa cobrar novamente no futuro.
    if (role === 'user') {
        contact.followUpSent = false;
    }
    
    await contact.save();
    // ===================================

    // Salvar a mensagem no histórico
    await mongoose.model('ChatMessage').create({ 
      contactId: contact._id,
      phone, 
      role, 
      content,
      messageType
    });
    
  } catch (error) {
    console.error('💥 Erro ao salvar mensagem:', error);
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

module.exports = { saveMessage, getLastMessages };