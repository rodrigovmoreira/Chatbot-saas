const mongoose = require('mongoose');

const industryPresetSchema = new mongoose.Schema({
  // Identificação
  key: { type: String, required: true, unique: true }, // ex: 'barber', 'real_estate'
  name: { type: String, required: true }, // ex: 'Barbearia / Salão'
  icon: { type: String, default: '🏢' }, // Para mostrar no frontend

  // Novos campos divididos (Átomo quebrado)
  botName: { type: String, required: true },
  toneOfVoice: { type: String, required: true },
  customInstructions: { type: String, default: '' },

  // Configurações do Robô (O Cérebro) - Legacy / Fallback
  prompts: {
    chatSystem: { type: String, required: false }, // Agora opcional
    visionSystem: { type: String, required: false } // Agora opcional
  },

  // Configurações de Funil (O Comportamento)
  followUpSteps: [
    {
      stage: { type: Number },
      delayMinutes: { type: Number },
      message: { type: String }
    }
  ],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('IndustryPreset', industryPresetSchema);
