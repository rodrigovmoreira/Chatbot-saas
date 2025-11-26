require('dotenv').config();
const dbConnect = require('./services/database');
const { startServer } = require('./server');

console.log('🚀 Iniciando ChatBot SaaS (Versão Twilio)...');

async function init() {
  try {
    // 1. Conectar ao Banco de Dados
    await dbConnect();

    // 2. Iniciar Servidor (API e Webhooks)
    // Não passamos mais nenhum 'client' como argumento
    startServer();

    console.log('✅ Sistema inicializado! Aguardando mensagens do Twilio...');

  } catch (error) {
    console.error('💥 Erro fatal na inicialização:', error);
    process.exit(1);
  }
}

init();