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
    // Primeiro, encontrar ou criar o contato
    let contact = await mongoose.model('Contact').findOne({ phone });
    if (!contact) {
      contact = await mongoose.model('Contact').create({ 
        phone,
        totalMessages: 1
      });
    } else {
      contact.totalMessages += 1;
      contact.lastInteraction = new Date();
      await contact.save();
    }

    // Salvar a mensagem com referência ao contato
    await Message.create({ 
      contactId: contact._id,
      phone, 
      role, 
      content,
      messageType
    });
    
    console.log('💾 Mensagem salva para contato:', phone);
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