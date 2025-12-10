const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const { adaptWWebJSMessage } = require('./providerAdapter');
// REMOVA ESTA LINHA DO TOPO:
// const { handleIncomingMessage } = require('../messageHandler'); 

let client;
let ioInstance;

const initializeWWebJS = (io) => {
  ioInstance = io;
  console.log('🔄 Inicializando WWebJS...');

  client = new Client({
    authStrategy: new LocalAuth(), // Removemos o clientId fixo para simplificar testes
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    console.log('📸 QR RECEIVED no Terminal');
    qrcodeTerminal.generate(qr, { small: true });
    if (ioInstance) {
      ioInstance.emit('wwebjs_qr', qr);
      ioInstance.emit('wwebjs_status', 'qrcode');
    }
  });

  client.on('authenticated', () => {
    console.log('✅ WWebJS Autenticado!');
    if (ioInstance) ioInstance.emit('wwebjs_status', 'authenticated');
  });

  client.on('ready', () => {
    console.log('🚀 WWebJS Pronto para receber mensagens!');
    if (ioInstance) ioInstance.emit('wwebjs_status', 'ready');
  });

  client.on('message', async (msg) => {
    if (msg.type === 'e2e_notification' || msg.type === 'notification_template') return;

    try {
      // === CORREÇÃO DO LOOP: IMPORTAÇÃO TARDIA ===
      // Importamos o handler APENAS quando uma mensagem chega.
      // Isso quebra o ciclo de dependência na inicialização do servidor.
      const { handleIncomingMessage } = require('../messageHandler');
      
      const normalizedMsg = await adaptWWebJSMessage(msg);
      await handleIncomingMessage(normalizedMsg);
    } catch (error) {
      console.error('Erro ao processar mensagem WWebJS:', error);
    }
  });
  
  // Adicione tratamento de desconexão para limpar a sessão se necessário
  client.on('disconnected', (reason) => {
     console.log('⚠️ Cliente desconectado:', reason);
     if (ioInstance) ioInstance.emit('wwebjs_status', 'disconnected');
  });

  client.initialize();
};

const getWWebJSClient = () => client;

module.exports = { initializeWWebJS, getWWebJSClient };