const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  // VÍNCULO DE SEGURANÇA (Multi-tenant)
  businessId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'BusinessConfig', 
    required: true, // Agora é obrigatório
    index: true 
  },

  phone: { type: String, required: true },
  name: { type: String },
  
  // Funil e Status
  followUpStage: { type: Number, default: 0 },
  lastInteraction: { type: Date, default: Date.now },
  lastSender: { type: String, enum: ['user', 'bot', 'agent'] },
  
  totalMessages: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Índice Composto: O mesmo telefone pode existir em empresas diferentes,
// mas não pode ser duplicado DENTRO da mesma empresa.
contactSchema.index({ businessId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('Contact', contactSchema);