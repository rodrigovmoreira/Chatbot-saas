const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
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
  
  console.log('🛡️ Modo Econômico: Sessões iniciam apenas manualmente.');
};

const startSession = async (userId) => {
  // 1. BLINDAGEM CONTRA DUPLICIDADE
  if (sessions.has(userId)) {
    console.log(`⚠️ Sessão para ${userId} já existe na memória. Retornando instância atual.`);
    return sessions.get(userId);
  }

  // Se o status diz que está iniciando, aborta para não criar condição de corrida
  if (statuses.get(userId) === 'initializing') {
    console.log(`⚠️ Sessão para ${userId} já está em processo de inicialização.`);
    return;
  }

  console.log(`🚀 Iniciando motor WWebJS para UserID: ${userId}`);
  updateStatus(userId, 'initializing');

  const config = await BusinessConfig.findOne({ userId });
  if (!config) {
    console.error(`❌ Config não encontrada para UserID: ${userId}`);
    updateStatus(userId, 'error');
    return;
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: userId,
      dataPath: './.wwebjs_auth' // Define explicitamente a pasta para organização
    }),
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
        '--disable-logging', // Desativa logs para evitar EBUSY no chrome_debug.log
        '--log-level=3'
      ]
    }
  });

  // Salva referência IMEDIATAMENTE para evitar duplicidade se o frontend chamar de novo rápido
  sessions.set(userId, client);

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
      await handleIncomingMessage(normalizedMsg, config._id);
    } catch (error) {
      console.error(`Erro message:`, error);
    }
  });

  client.on('disconnected', async (reason) => {
    console.log(`⚠️ Sessão desconectada (${config.businessName}):`, reason);
    await stopSession(userId); // Usa a função centralizada de stop
  });

  try {
    await client.initialize();
  } catch (e) {
    console.error(`Erro fatal ao iniciar cliente ${userId}:`, e.message);
    sessions.delete(userId);
    updateStatus(userId, 'error');
  }
};

// 2. FUNÇÃO DE PARADA BLINDADA (A Mágica acontece aqui)
const stopSession = async (userId) => {
  const client = sessions.get(userId.toString());
  
  if (client) {
    console.log(`🛑 Encerrando sessão de ${userId}...`);
    
    // Atualiza status para evitar que o usuário tente reconectar enquanto fecha
    updateStatus(userId, 'disconnecting');

    try {
        // Tenta logout limpo (pode falhar no Windows por EBUSY)
        await client.logout(); 
    } catch (e) {
        // Ignora erros de logout, pois vamos destruir o cliente de qualquer jeito
    }

    try {
        // Força o fechamento do navegador (Libera RAM)
        await client.destroy();
        console.log(`✅ Navegador destruído para ${userId}`);
    } catch (e) {
        console.warn(`⚠️ Erro ao destruir cliente (não crítico): ${e.message}`);
    }
  }

  // 3. LIMPEZA DE MEMÓRIA (Essencial para não vazar memória)
  cleanupSession(userId);
  console.log(`🧹 Memória limpa para ${userId}`);
};

const cleanupSession = (userId) => {
  sessions.delete(userId);
  qrCodes.delete(userId);
  statuses.delete(userId);
  updateStatus(userId, 'disconnected');
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

// 4. FUNÇÃO DE ENVIO DE IMAGEM (Novo - Changelog 4)
const sendImage = async (userId, to, imageUrl, caption) => {
  const client = sessions.get(userId.toString());

  if (!client || !client.info) {
    console.warn(`⚠️ Envio de imagem falhou: Sessão ${userId} indisponível.`);
    return false;
  }

  try {
    // Formata número
    let formattedNumber = to.replace(/\D/g, '');
    if (!formattedNumber.includes('@c.us')) formattedNumber = `${formattedNumber}@c.us`;

    // Baixa e prepara a mídia
    const media = await MessageMedia.fromUrl(imageUrl);

    // Envia com legenda (se houver)
    await client.sendMessage(formattedNumber, media, { caption: caption || "" });
    console.log(`🖼️ Imagem enviada por ${userId} para ${formattedNumber}`);
    return true;

  } catch (error) {
    console.error(`💥 Erro ao enviar imagem (User ${userId}):`, error.message);
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
  sendImage,
  closeAllSessions
};