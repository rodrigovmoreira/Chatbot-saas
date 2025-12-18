const { Client, LocalAuth } = require('whatsapp-web.js');
const { adaptWWebJSMessage } = require('./providerAdapter');
const BusinessConfig = require('../models/BusinessConfig');

// MAPAS DE ESTADO
const sessions = new Map();
const qrCodes = new Map();
const statuses = new Map();

let ioInstance;

const initializeWWebJS = async (io) => {
  ioInstance = io;
  console.log('🔄 Serviço WWebJS Multi-tenant iniciado...');
  await restoreSessions();
};

const restoreSessions = async () => {
  try {
    const configs = await BusinessConfig.find({ whatsappProvider: 'wwebjs' });
    for (const config of configs) {
      if (config.userId) {
        startSession(config.userId.toString()).catch(err => 
            console.error(`Erro ao restaurar sessão de ${config.businessName}:`, err)
        );
      }
    }
  } catch (error) {
    console.error('Erro ao restaurar sessões:', error);
  }
};

const startSession = async (userId) => {
  if (sessions.has(userId)) {
    const currentStatus = statuses.get(userId);
    if (currentStatus === 'ready' || currentStatus === 'authenticated') {
        return sessions.get(userId);
    }
  }

  console.log(`🚀 Iniciando motor WWebJS para UserID: ${userId}`);
  updateStatus(userId, 'initializing');

  const config = await BusinessConfig.findOne({ userId });
  if (!config) {
    console.error(`❌ Config não encontrada para UserID: ${userId}`);
    updateStatus(userId, 'error');
    return;
  }
  const businessId = config._id;

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', (qr) => {
    console.log(`📸 QR Code gerado para ${config.businessName}`);
    qrCodes.set(userId, qr);
    updateStatus(userId, 'qrcode');
    if (ioInstance) ioInstance.to(userId).emit('wwebjs_qr', qr);
  });

  client.on('ready', () => {
    console.log(`✅ Sessão PRONTA para: ${config.businessName}`);
    updateStatus(userId, 'ready');
    qrCodes.delete(userId);
  });

  client.on('authenticated', () => {
    console.log(`🔐 Autenticado: ${config.businessName}`);
    updateStatus(userId, 'authenticated');
    qrCodes.delete(userId);
  });

  client.on('auth_failure', () => {
    console.error(`❌ Falha de autenticação para: ${config.businessName}`);
    updateStatus(userId, 'disconnected');
  });

  client.on('message', async (msg) => {
    if (msg.type === 'e2e_notification' || msg.type === 'notification_template') return;
    try {
      const { handleIncomingMessage } = require('../messageHandler');
      const normalizedMsg = await adaptWWebJSMessage(msg);
      await handleIncomingMessage(normalizedMsg, businessId);
    } catch (error) {
      console.error(`Erro message:`, error);
    }
  });

  client.on('disconnected', (reason) => {
    console.log(`⚠️ Sessão desconectada (${config.businessName}):`, reason);
    cleanupSession(userId);
  });

  try {
    client.initialize();
    sessions.set(userId, client);
  } catch (e) {
    console.error(`Erro fatal ao iniciar cliente ${userId}:`, e);
    updateStatus(userId, 'error');
  }
};

// === CORREÇÃO: Função stopSession Blindada contra EBUSY ===
const stopSession = async (userId) => {
  console.log(`🛑 Solicitado encerramento para UserID: ${userId}`);
  const client = sessions.get(userId);
  
  if (client) {
    try {
      // 1. Destroi o navegador (libera arquivos)
      await client.destroy(); 
      // 2. Espera o Windows liberar o arquivo (Evita EBUSY)
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log(`✅ Navegador fechado para UserID: ${userId}`);
    } catch (e) {
      console.error(`Erro ao destruir sessão ${userId}:`, e.message);
    }
  }
  cleanupSession(userId);
};

// === NOVA FUNÇÃO: Envio Seguro (Para o Scheduler) ===
const sendWWebJSMessage = async (userId, to, message) => {
    // Garante que userId seja string para busca no Map
    const client = sessions.get(userId.toString());

    if (!client) {
        console.warn(`⚠️ Envio falhou: User ${userId} não tem sessão ativa.`);
        return false;
    }

    // Proteção Anti-Crash: Verifica se o WhatsApp Web carregou
    if (!client.info) {
        console.warn(`⚠️ Envio falhou: WhatsApp do User ${userId} ainda não está pronto.`);
        return false;
    }

    try {
        let formattedNumber = to.replace(/\D/g, '');
        if (!formattedNumber.includes('@c.us')) formattedNumber = `${formattedNumber}@c.us`;
        
        await client.sendMessage(formattedNumber, message);
        console.log(`📤 Mensagem enviada por ${userId} para ${formattedNumber}`);
        return true;
    } catch (error) {
        console.error(`💥 Erro envio WWebJS (User ${userId}):`, error.message);
        return false;
    }
};

// === NOVA FUNÇÃO: Limpeza Geral (Para reiniciar servidor) ===
const closeAllSessions = async () => {
    console.log(`🛑 Fechando ${sessions.size} sessões ativas...`);
    for (const [userId, client] of sessions.entries()) {
        try {
            await client.destroy();
            console.log(`-> Sessão ${userId} fechada.`);
        } catch (e) {
            console.error(`-> Erro ao fechar ${userId}:`, e.message);
        }
    }
    sessions.clear();
};

const cleanupSession = (userId) => {
  sessions.delete(userId);
  qrCodes.delete(userId);
  statuses.delete(userId);
  updateStatus(userId, 'disconnected');
};

const updateStatus = (userId, status) => {
  statuses.set(userId, status);
  if (ioInstance) {
    ioInstance.to(userId).emit('wwebjs_status', status);
  }
};

const getSessionStatus = (userId) => statuses.get(userId) || 'disconnected';
const getSessionQR = (userId) => qrCodes.get(userId);
const getClientSession = (userId) => sessions.get(userId.toString());

module.exports = { 
  initializeWWebJS, 
  startSession, 
  stopSession,
  getSessionStatus, 
  getSessionQR,
  getClientSession,
  sendWWebJSMessage, 
  closeAllSessions   
};