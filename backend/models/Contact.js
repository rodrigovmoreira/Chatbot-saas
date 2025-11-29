const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true // Já cria o índice necessário automaticamente
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

// REMOVIDO: contactSchema.index({ phone: 1 }); <-- Isso causava o aviso duplicado
contactSchema.index({ lastInteraction: -1 });
contactSchema.index({ assignedTo: 1 });

contactSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Contact', contactSchema);