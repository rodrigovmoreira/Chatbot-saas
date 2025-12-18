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
  // Evita iniciar se já estiver rodando
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
        '--disable-gpu',
        // === CORREÇÃO 1: Desativa o log do Chrome para evitar EBUSY no Windows ===
        '--disable-logging',
        '--log-level=3' 
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
    // Não chamamos cleanupSession direto aqui para evitar loop se o disconnect vier de um logout manual
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

// === CORREÇÃO 2: Logout Blindado contra EBUSY ===
const stopSession = async (userId) => {
  console.log(`🛑 Solicitado encerramento para UserID: ${userId}`);
  const client = sessions.get(userId);
  
  if (client) {
    try {
        // Tenta fazer o logout oficial (limpa dados)
        // O Try/Catch aqui é essencial: se o Windows travar o arquivo, 
        // nós pegamos o erro e não deixamos o servidor cair.
        await client.logout();
        console.log(`✅ Logout realizado para UserID: ${userId}`);
    } catch (e) {
        // Se der erro EBUSY, ignoramos, pois o importante é que a sessão morreu na memória
        if (e.message && e.message.includes('EBUSY')) {
            console.warn(`⚠️ Aviso: Arquivo de sessão preso (EBUSY) no Windows. Ignorando limpeza física.`);
        } else {
            console.error(`Erro ao fazer logout da sessão ${userId}:`, e.message);
        }
        
        // Se o logout falhar, forçamos o destroy para garantir que o Chrome feche
        try { await client.destroy(); } catch (err) {}
    }
  }
  cleanupSession(userId);
};

const sendWWebJSMessage = async (userId, to, message) => {
    const client = sessions.get(userId.toString());

    if (!client) {
        console.warn(`⚠️ Envio falhou: User ${userId} não tem sessão ativa.`);
        return false;
    }

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

const closeAllSessions = async () => {
    console.log(`🛑 Fechando ${sessions.size} sessões ativas...`);
    for (const [userId, client] of sessions.entries()) {
        try {
            // No shutdown do servidor, usamos destroy() em vez de logout()
            // para não perder a conexão (QR Code) na próxima reinicialização
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