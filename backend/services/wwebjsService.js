const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const { adaptWWebJSMessage } = require('./providerAdapter');

let client;
let ioInstance;
let currentQR = null;
let currentStatus = 'initializing';

const initializeWWebJS = (io) => {
  ioInstance = io;
  console.log('🔄 Inicializando WWebJS...');

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  const updateStatus = (status) => {
    currentStatus = status;
    if (ioInstance) ioInstance.emit('wwebjs_status', status);
  };

  client.on('qr', (qr) => {
    currentQR = qr; // <--- NOVO: Salva o QR Code na memória
    updateStatus('qrcode');
    console.log('📸 QR RECEIVED no Terminal');
    //qrcodeTerminal.generate(qr, { small: true });

    if (ioInstance) {
      ioInstance.emit('wwebjs_qr', qr);
      ioInstance.emit('wwebjs_status', 'qrcode');
    }
  });

  client.on('authenticated', () => {
    console.log('✅ WWebJS Autenticado!');
    currentQR = null;
    updateStatus('authenticated');
    if (ioInstance) ioInstance.emit('wwebjs_status', 'authenticated');
  });

  client.on('ready', () => {
    console.log('🚀 WWebJS Pronto para receber mensagens!');
    currentQR = null;
    updateStatus('ready');
    if (ioInstance) ioInstance.emit('wwebjs_status', 'ready');
  });

  client.on('message', async (msg) => {
    if (msg.type === 'e2e_notification' || msg.type === 'notification_template') return;
    try {
      const { handleIncomingMessage } = require('../messageHandler');
      const normalizedMsg = await adaptWWebJSMessage(msg);
      await handleIncomingMessage(normalizedMsg);
    } catch (error) {
      console.error('Erro ao processar mensagem WWebJS:', error);
    }
  });

  client.on('disconnected', (reason) => {
    console.log('⚠️ Cliente desconectado:', reason);
    if (ioInstance) ioInstance.emit('wwebjs_status', 'disconnected');
  });

  client.initialize();
};

const logoutWWebJS = async () => {
  try {
    if (client) {
      console.log('🚪 Executando Logout do WWebJS...');
      await client.logout(); // Isso limpa a sessão do LocalAuth
      // Precisamos reiniciar o cliente para gerar novo QR Code
      setTimeout(() => {
        client.initialize();
        currentStatus = 'initializing';
      }, 1000);
    }
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
  }
};

const getWWebJSClient = () => client;
const getCurrentQR = () => currentQR;
const getCurrentStatus = () => currentStatus; // <--- Exporta o status atual

module.exports = { initializeWWebJS, getWWebJSClient, getCurrentQR, getCurrentStatus, logoutWWebJS };