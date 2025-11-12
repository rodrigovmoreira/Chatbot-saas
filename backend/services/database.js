// services/database.js
require('dotenv').config();
const mongoose = require('mongoose');

module.exports = () => {
  console.log('🔄 Conectando ao MongoDB...');
  
  // Usar MONGO_URI do .env com fallback
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbot-platform';
  console.log('📡 URI do MongoDB:', mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Esconde credenciais no log
  
  // Remover opções deprecated que não são mais necessárias
  mongoose.connect(mongoUri)
  .then(() => console.log('✅ MongoDB conectado com sucesso'))
  .catch(err => {
    console.error('💥 ERRO ao conectar MongoDB:', err);
    console.log('🔄 Tentando reconectar em 5 segundos...');
    setTimeout(() => {
      mongoose.connect(mongoUri);
    }, 5000);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('⚠️  MongoDB desconectado');
  });

  mongoose.connection.on('error', (err) => {
    console.error('💥 Erro na conexão MongoDB:', err);
  });

  mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB conectado');
  });
};