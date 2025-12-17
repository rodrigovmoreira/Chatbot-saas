const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const { adaptWWebJSMessage } = require('./providerAdapter');
const BusinessConfig = require('../models/BusinessConfig');

let client;
let ioInstance;
let currentQR = null;
let currentStatus = 'initializing';
let activeBusinessId = null;

const initializeWWebJS = async (io) => {
  ioInstance = io;
  console.log('🔄 Inicializando WWebJS...');

  // === NOVO: Carrega o BusinessID desta sessão ===
  try {
    // Como estamos rodando uma instância única, pegamos a primeira empresa encontrada.
    // Num futuro SaaS com múltiplos containers, isso viria via variável de ambiente ou parâmetro.
    const config = await BusinessConfig.findOne({});
    if (config) {
        activeBusinessId = config._id;
        console.log(`🏢 Sessão vinculada à empresa: ${config.businessName} (ID: ${activeBusinessId})`);
    } else {
        console.warn('⚠️ Nenhuma empresa encontrada no banco! O sistema pode falhar ao salvar mensagens.');
    }
  } catch (error) {
    console.error('❌ Erro ao buscar configuração da empresa:', error);
  }
  // ===============================================

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
    currentQR = qr;
    updateStatus('qrcode');
    console.log('📸 QR RECEIVED no Terminal');
    
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
      // Importamos aqui dentro para evitar problemas de dependência circular
      const { handleIncomingMessage } = require('../messageHandler');
      
      const normalizedMsg = await adaptWWebJSMessage(msg);
      
      // === ATENÇÃO: Agora passamos o activeBusinessId junto! ===
      // Se activeBusinessId for null, o handleIncomingMessage deverá tratar o erro
      await handleIncomingMessage(normalizedMsg, activeBusinessId);
      
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
      await client.logout(); 
      
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
const getCurrentStatus = () => currentStatus;

module.exports = { initializeWWebJS, getWWebJSClient, getCurrentQR, getCurrentStatus, logoutWWebJS };