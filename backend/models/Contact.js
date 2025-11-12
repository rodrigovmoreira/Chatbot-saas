const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true // Isso cria o índice único no phone
  },
  name: {
    type: String,
    default: null
  },
  isBusiness: {
    type: Boolean,
    default: false
  },
  lastInteraction: {
    type: Date,
    default: Date.now
  },
  totalMessages: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String
  }],
  // Referência opcional ao usuário do sistema (se for um vendedor/atendente)
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemUser',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para performance
contactSchema.index({ phone: 1 });
contactSchema.index({ lastInteraction: -1 });
contactSchema.index({ assignedTo: 1 });

// Atualizar updatedAt antes de salvar
contactSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Contact', contactSchema);