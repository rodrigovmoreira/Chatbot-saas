const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  // VÍNCULO DE SEGURANÇA (Multi-tenant)
  businessId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'BusinessConfig', 
    required: true, 
    index: true 
  },

  phone: { type: String, required: true },
  name: { type: String },
  
  // === CAMPOS DO FUNIL (Faltavam estes!) ===
  followUpStage: { type: Number, default: 0 },
  
  // Controle de Ativação (Importante para o Scheduler)
  followUpActive: { type: Boolean, default: false }, 
  
  // O relógio para contar o tempo (Importante para o Scheduler)
  lastResponseTime: { type: Date }, 

  // Histórico básico
  lastInteraction: { type: Date, default: Date.now },
  lastSender: { type: String, enum: ['user', 'bot', 'agent'] },
  
  totalMessages: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Índice Composto
contactSchema.index({ businessId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('Contact', contactSchema);