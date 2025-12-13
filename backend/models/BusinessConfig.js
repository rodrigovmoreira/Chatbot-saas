const mongoose = require('mongoose');

const businessConfigSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemUser',
    required: true
  },

  businessName: { type: String, default: 'Estúdio Tattoo' },
  whatsappProvider: { type: String, enum: ['twilio', 'wwebjs'], default: 'wwebjs' },

  // === NOVO: CENTRAL DE PROMPTS (O CÉREBRO) ===
  prompts: {
    // 1. Personalidade do Chat (DeepSeek)
    chatSystem: {
      type: String,
      default: `Você é o assistente virtual do Estúdio. Seja descolado, use emojis e foque em agendar.`
    },

    // 2. Olhos do Robô (Gemini)
    visionSystem: {
      type: String,
      default: `
        Atue como um especialista em tatuagem e anatomia.
        1. Se for COMPROVANTE: Extraia valor, data e banco.
        2. Se for TATUAGEM: Descreva estilo (Old School, Realismo, etc), cores e local do corpo.
        3. Se for PELE/CORPO: Indique o local e se serve para cobertura.
        Seja técnico e direto.`
    }
  },

  // (Mantivemos os outros campos para compatibilidade)
  operatingHours: {
    active: { type: Boolean, default: true },
    opening: { type: String, default: '00:01' },
    closing: { type: String, default: '23:59' },
    timezone: { type: String, default: 'America/Sao_Paulo' }
  },

  awayMessage: { type: String, default: 'Estamos fechados agora! Já já respondemos.' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BusinessConfig', businessConfigSchema);