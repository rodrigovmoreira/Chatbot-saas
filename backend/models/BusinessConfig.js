const mongoose = require('mongoose');

const businessConfigSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'SystemUser', required: true },
  businessName: { type: String, required: true },
  businessType: { 
    type: String, 
    enum: ['varejo', 'servicos', 'restaurante', 'imoveis', 'outros'],
    required: true 
  },
  
  // Configurações de atendimento
  welcomeMessage: { type: String, default: 'Olá! Bem-vindo à nossa loja. Como posso ajudar?' },
  operatingHours: {
    opening: { type: String, default: '09:00' },
    closing: { type: String, default: '18:00' },
    timezone: { type: String, default: 'America/Sao_Paulo' }
  },
  awayMessage: { type: String, default: 'No momento estamos fechados. Horário de atendimento: 09h às 18h.' },
  
  // Menu de opções
  menuOptions: [{
    keyword: String,
    description: String,
    response: String,
    requiresHuman: { type: Boolean, default: false }
  }],
  
  // Catálogo de produtos
  products: [{
    name: String,
    category: String,
    price: Number,
    description: String,
    imageUrl: String,
    available: { type: Boolean, default: true }
  }],
  
  // Configurações de venda
  paymentMethods: [String],
  deliveryOptions: [String],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BusinessConfig', businessConfigSchema);