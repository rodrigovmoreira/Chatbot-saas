const mongoose = require('mongoose');

const customPromptSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'SystemUser', 
    required: true 
  },
  name: { type: String, required: true }, // Ex: "Meu Tatuador Agressivo"
  prompts: {
    chatSystem: { type: String, default: '' },
    visionSystem: { type: String, default: '' }
  },
  followUpSteps: [{
    delayMinutes: { type: Number, required: true },
    message: { type: String, required: true },
    stage: { type: Number }
  }],
  createdAt: { type: Date, default: Date.now }
});

// Garante que o nome seja único por usuário (opcional, mas bom pra organização)
customPromptSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('CustomPrompt', customPromptSchema);