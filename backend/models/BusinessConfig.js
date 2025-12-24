const mongoose = require('mongoose');

const businessConfigSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemUser',
    required: true
  },

  businessName: { type: String, default: 'Estúdio Tattoo' },
  businessType: { type: String }, // <--- ADICIONADO: Identifica o nicho (ex: Barber, Tattoo)
  whatsappProvider: { type: String, enum: ['twilio', 'wwebjs'], default: 'wwebjs' },

  // === NOVO: CENTRAL DE PROMPTS (O CÉREBRO) ===
  prompts: {
    // 1. Personalidade do Chat (DeepSeek)
    chatSystem: {
      type: String,
      default: `Você é um assistente virtual buscando ajudar as pessoas e conversar de forma amigável.`
    },

    // 2. Olhos do Robô (Gemini)
    visionSystem: {
      type: String,
      default: `Você é um assistente virtual que pode ver imagens enviadas pelos usuários. Descreva as imagens de forma clara e objetiva.`
    }
  },

  // === ADICIONADO: MENU DE RESPOSTAS RÁPIDAS ===
  menuOptions: [
    {
      keyword: { type: String, required: true }, // ex: "pix"
      description: { type: String },             // ex: "Chave Pix" (interno)
      response: { type: String, required: true },// ex: "Nossa chave é..."
      requiresHuman: { type: Boolean, default: false },
      useAI: { type: Boolean, default: false }
    }
  ],

  // === ADICIONADO: CATÁLOGO DE PRODUTOS ===
  products: [
    {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      description: { type: String },
      imageUrls: { type: [String], default: [] },
      tags: { type: [String], default: [] }
    }
  ],

  socialMedia: {
    instagram: { type: String },
    website: { type: String },
    portfolio: { type: String }
  },

  followUpSteps: [
    {
      stage: { type: Number },
      delayMinutes: { type: Number },
      message: { type: String }
    }
  ],

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
