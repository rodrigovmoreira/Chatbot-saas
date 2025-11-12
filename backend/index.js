require('dotenv').config();
const { Client } = require('whatsapp-web.js');
const { handleMessage } = require('./messageHandler');
const dbConnect = require('./services/database'); // Já carrega .env e conecta
const { startServer } = require('./server');

console.log('🚀 Iniciando ChatBot Platform...');

// Inicializações - database.js já cuida da conexão
console.log('🔄 Conectando ao banco de dados...');
dbConnect(); // Esta função já usa process.env.MONGO_URI

console.log('📱 Inicializando cliente WhatsApp...');
const client = new Client();

// Configuração do WhatsApp Client
client.on('ready', () => {
  console.log('✅ Bot conectado ao WhatsApp com sucesso!');
});

client.on('qr', (qr) => {
  console.log('📱 QR Code gerado - Aguardando escaneamento...');
});

client.on('authenticated', () => {
  console.log('✅ WhatsApp autenticado!');
});

client.on('auth_failure', (error) => {
  console.error('💥 Falha na autenticação do WhatsApp:', error);
});

client.on('disconnected', (reason) => {
  console.log('❌ WhatsApp desconectado:', reason);
});

client.on('message', async msg => {
  console.log('📩 Mensagem recebida de:', msg.from, '- Conteúdo:', msg.body);
  await handleMessage(client, msg);
});

// Inicia tanto o servidor web quanto o WhatsApp client
console.log('🌐 Iniciando servidor web...');
startServer(client);

console.log('🔄 Inicializando cliente WhatsApp...');
client.initialize();

console.log('✅ Sistema inicializado completamente!');