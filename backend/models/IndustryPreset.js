const mongoose = require('mongoose');

const industryPresetSchema = new mongoose.Schema({
  // Identificação
  key: { type: String, required: true, unique: true }, // ex: 'barber', 'real_estate'
  name: { type: String, required: true }, // ex: 'Barbearia / Salão'
  icon: { type: String, default: '🏢' }, // Para mostrar no frontend

  // Configurações do Robô (O Cérebro)
  prompts: {
    chatSystem: { type: String, required: true },
    visionSystem: { type: String, required: true }
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