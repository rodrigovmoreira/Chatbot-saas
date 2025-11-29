const mongoose = require('mongoose');

const businessConfigSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'SystemUser', 
    required: true 
  },
  
  businessName: { 
    type: String, 
    required: true,
    default: 'Estúdio Tattoo'
  },

  // === O CÉREBRO DO BOT (Edite via MongoDB Compass) ===
  // Aqui ficará toda a personalidade e regras (A "Bíblia" do Atendimento).
  // Isso substitui a necessidade de menus complexos hardcoded.
  systemPrompt: { 
    type: String, 
    default: `
Você é o assistente virtual do Estúdio.
Objetivo: Agendar avaliações e tirar dúvidas básicas.
Tom de voz: Profissional, mas descontraído (pode usar emojis).
Regras:
1. Não passe valores exatos sem avaliação. Dê apenas estimativas ("A partir de...").
2. Se o cliente quiser agendar, pergunte a disponibilidade dele.
    `.trim()
  },

  // === Configurações de Horário ===
  operatingHours: {
    active: { type: Boolean, default: true }, // Master switch: false = bot desligado
    opening: { type: String, default: '09:00' },
    closing: { type: String, default: '20:00' },
    timezone: { type: String, default: 'America/Sao_Paulo' }
  },
  
  // Mensagem automática enviada fora do expediente
  awayMessage: { 
    type: String, 
    default: 'Olá! O estúdio está fechado agora. Deixe sua mensagem que respondemos assim que abrirmos!' 
  },
  
  // === Catálogo Simplificado (Opcional) ===
  // Útil para listar estilos que o tatuador faz ou não faz
  services: [{
    name: String,        // Ex: "Realismo", "Old School"
    description: String, // Ex: "Especialidade da casa."
    startPrice: String   // Ex: "Sessões a partir de R$ 800"
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BusinessConfig', businessConfigSchema);