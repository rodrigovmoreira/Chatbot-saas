const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  // VÍNCULO DE SEGURANÇA (Multi-tenant)
  businessId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'BusinessConfig', 
    required: true, 
    index: true 
  },

  // Identificadores (Um dos dois deve existir)
  phone: { type: String }, // Optional
  sessionId: { type: String }, // For Web Users

  channel: {
    type: String,
    enum: ['whatsapp', 'web'],
    default: 'whatsapp'
  },

  name: { type: String, default: 'Visitante' },
  
  // Tags para segmentação
  tags: {
    type: [String],
    default: [],
    index: true
  },

  // === CAMPOS DO FUNIL ===
  followUpStage: { type: Number, default: 0 },
  
  // Controle de Ativação (Importante para o Scheduler)
  followUpActive: { type: Boolean, default: false }, 
  
  // O relógio para contar o tempo (Importante para o Scheduler)
  lastResponseTime: { type: Date }, 

  // Human Handoff (Kill Switch)
  isHandover: { type: Boolean, default: false },

  // Histórico básico
  lastInteraction: { type: Date, default: Date.now },
  lastSender: { type: String, enum: ['user', 'bot', 'agent'] },
  
  totalMessages: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Índices Parciais para Unicidade
contactSchema.index({ businessId: 1, phone: 1 }, {
  unique: true,
  partialFilterExpression: { phone: { $type: "string" } }
});

contactSchema.index({ businessId: 1, sessionId: 1 }, {
  unique: true,
  partialFilterExpression: { sessionId: { $exists: true } }
});

// TTL Index: Auto-delete Web visitors after 30 days of inactivity
contactSchema.index({ lastInteraction: 1 }, {
  expireAfterSeconds: 2592000, // 30 Days
  partialFilterExpression: { channel: 'web' }
});

module.exports = mongoose.model('Contact', contactSchema);
