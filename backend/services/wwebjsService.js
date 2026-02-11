const fs = require('fs');
const path = require('path');
const { Client, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const mongoose = require('mongoose');
//const { MongoStore } = require('wwebjs-mongo');
const UnifiedMongoStore = require('./UnifiedMongoStore');

const { adaptWWebJSMessage } = require('./providerAdapter');
const BusinessConfig = require('../models/BusinessConfig');

// MAPAS DE ESTADO
const sessions = new Map();
const qrCodes = new Map();
const statuses = new Map();
const timeouts = new Map();

let ioInstance;

const initializeWWebJS = async (io) => {
  ioInstance = io;
};

const cleanUpTempFolders = (userId) => {
  const authPath = path.resolve('./.wwebjs_auth'); // Ou o caminho que você configurou

  // Se a pasta base não existir, não tem o que limpar
  if (!fs.existsSync(authPath)) return;

  try {
    const files = fs.readdirSync(authPath);

    files.forEach(file => {
      // Procura por pastas que começam com 'wwebjs_temp_session' e pertencem ao usuario (opcional)
      // O padrão do erro é 'wwebjs_temp_session_REMOTEAUTH-ID...'
      if (file.startsWith('wwebjs_temp_session_') && file.includes(userId)) {
        const fullPath = path.join(authPath, file);
        console.log(`🧹 [Auto-Limpeza] Removendo lixo temporário: ${file}`);

        // Força a remoção recursiva
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    });
  } catch (err) {
    console.error(`⚠️ Erro na auto-limpeza de arquivos temporários: ${err.message}`);
  }
};

const startSession = async (userIdRaw) => {
  // 0. NORMALIZAÇÃO DE ID (CRÍTICO)
  // Garante que seja sempre string para evitar duplicidade entre ObjectId vs String
  const userId = userIdRaw.toString();

  cleanUpTempFolders(userId);

  // 1. BLINDAGEM CONTRA DUPLICIDADE
  if (sessions.has(userId)) {
    console.log(`🛡️ Sessão ${userId} já está online. Ignorando start duplicado.`);
    return sessions.get(userId);
  }

  // 2. BLINDAGEM CONTRA RACE CONDITION
  if (statuses.get(userId) === 'initializing') {
    console.log(`🛡️ Sessão ${userId} já está inicializando. Chamada duplicada ignorada.`);
    return;
  }

  // 3. A TRAVA DE SEGURANÇA
  updateStatus(userId, 'initializing');
  console.log(`▶️ Iniciando sessão BLINDADA para: ${userId}`);

  // --- RESTO DO CÓDIGO (SEGUE IGUAL) ---

  const authPath = './.wwebjs_auth';
  if (!fs.existsSync(authPath)) {
    try {
      fs.mkdirSync(authPath, { recursive: true });
    } catch (err) {
      console.error('❌ Falha ao criar pasta .wwebjs_auth:', err);
    }
  }

  const config = await BusinessConfig.findOne({ userId });
  if (!config) {
    console.error(`❌ Config não encontrada para UserID: ${userId}`);
    updateStatus(userId, 'error');
    return;
  }

  // 4. The 'QR Timeout' Safety Valve
  if (timeouts.has(userId)) {
    clearTimeout(timeouts.get(userId));
    timeouts.delete(userId);
  }

  // Set new timeout (120 seconds)
  const timeoutId = setTimeout(async () => {
    const currentStatus = statuses.get(userId);
    console.log(`⏱️ Timeout de conexão para User ${userId}. Status atual: ${currentStatus}`);

    if (currentStatus === 'initializing' || currentStatus === 'qrcode') {
      console.warn(`⚠️ Forçando destruição por timeout (User ${userId})`);

      const clientToDestroy = sessions.get(userId);
      if (clientToDestroy) {
        try {
          await clientToDestroy.destroy();
        } catch (e) {
          console.error(`Erro ao destruir por timeout: ${e.message}`);
        }
      }

      cleanupSession(userId);

      if (ioInstance) {
        ioInstance.to(userId).emit('connection_timeout', { message: 'Tempo limite excedido. Tente novamente.' });
        ioInstance.to(userId).emit('wwebjs_status', 'disconnected');
      }
    }
  }, 120000); // 2 minutes

  timeouts.set(userId, timeoutId);

  const client = new Client({
    authStrategy: new RemoteAuth({
      clientId: userId,
      store: new UnifiedMongoStore({ mongoose: mongoose }),
      backupSyncIntervalMs: 300000,
      dataPath: './.wwebjs_auth'
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
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--mute-audio',
        '--no-default-browser-check',
        '--autoplay-policy=user-gesture-required',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-notifications',
        '--disable-background-networking',
        '--disable-breakpad',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--disable-sync',
        '--disable-remote-fonts',
        '--blink-settings=imagesEnabled=false',
        '--disable-software-rasterizer',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      executablePath: process.env.CHROME_BIN || undefined
    }
  });

  sessions.set(userId, client);

  client.on('qr', (qr) => {
    qrCodes.set(userId, qr);
    updateStatus(userId, 'qrcode');
    if (ioInstance) ioInstance.to(userId).emit('wwebjs_qr', qr);
  });

  client.on('ready', () => {
    if (timeouts.has(userId)) {
      clearTimeout(timeouts.get(userId));
      timeouts.delete(userId);
    }
    updateStatus(userId, 'ready');
    qrCodes.delete(userId);
  });

  client.on('authenticated', () => {
    if (timeouts.has(userId)) {
      clearTimeout(timeouts.get(userId));
      timeouts.delete(userId);
    }
    updateStatus(userId, 'authenticated');
    qrCodes.delete(userId);
  });

  client.on('auth_failure', () => {
    console.error(`❌ Falha de autenticação para: ${config.businessName}`);
    updateStatus(userId, 'disconnected');
  });

  client.on('message', async (msg) => {
    // 🛡️ IRON GATE: Global Block for Non-Contact Messages
    // 1. Block Groups (@g.us)
    // 2. Block Status Updates (status@broadcast)
    // 3. Block Channels/Newsletters (@newsletter)
    const isInvalidSource =
      msg.from.includes('@g.us') ||
      msg.from === 'status@broadcast' ||
      msg.from.includes('@newsletter');

    // 4. Block Technical/Community IDs (Length Check)
    // Standard phone numbers (even international) are rarely > 15 digits.
    // Community/Technical IDs (like 120363335026718801) are usually 18+ digits.
    const numericPart = msg.from.replace(/\D/g, '');
    const isTooLong = numericPart.length > 15;

    if (isInvalidSource || isTooLong) {
      // console.log(`🚫 Iron Gate: Blocked message from ${msg.from}`);
      return; // STOP execution immediately.
    }

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
    await stopSession(userId);
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
    } catch (e) {
      console.warn(`⚠️ Erro ao destruir cliente (não crítico): ${e.message}`);
    }
  }

  // 3. LIMPEZA DE MEMÓRIA (Essencial para não vazar memória)
  cleanupSession(userId);
};

const cleanupSession = (userId) => {
  if (timeouts.has(userId)) {
    clearTimeout(timeouts.get(userId));
    timeouts.delete(userId);
  }
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

    // FIX: Pass { sendSeen: false } to prevent crash on 'markedUnread'
    await client.sendMessage(formattedNumber, message, { sendSeen: false });
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
    // FIX: Pass { sendSeen: false } to prevent crash on 'markedUnread'
    await client.sendMessage(formattedNumber, media, { caption: caption || "", sendSeen: false });
    return true;

  } catch (error) {
    console.error(`💥 Erro ao enviar imagem (User ${userId}):`, error.message);
    return false;
  }
};

// --- LABEL MANAGEMENT (Stage 1 Refactor) ---

const getLabels = async (userId) => {
  const client = sessions.get(userId.toString());
  if (!client || !client.info) {
    console.warn(`⚠️ getLabels falhou: Sessão ${userId} não pronta.`);
    return [];
  }
  try {
    // Returns Promise<Label[]>
    return await client.getLabels();
  } catch (error) {
    console.error(`💥 Erro ao obter labels (User ${userId}):`, error.message);
    return [];
  }
};

const createLabel = async (userId, name) => {
  const client = sessions.get(userId.toString());
  if (!client || !client.info) {
    throw new Error(`Sessão ${userId} não pronta.`);
  }
  // Creates label and returns the Label object
  return await client.createLabel(name);
};

const updateLabel = async (userId, labelId, name, hexColor) => {
  const client = sessions.get(userId.toString());
  if (!client || !client.info) {
    throw new Error(`Sessão ${userId} não pronta.`);
  }

  const labels = await client.getLabels();
  const label = labels.find(l => l.id === labelId);

  if (!label) {
    throw new Error(`Label ${labelId} não encontrada.`);
  }

  // Update properties
  label.name = name;
  label.hexColor = hexColor;

  // Persist changes if method exists (Standard WWebJS Label)
  if (typeof label.save === 'function') {
    await label.save();
  } else {
    console.warn(`⚠️ Label.save() não disponível para User ${userId}. Tentando fallback de edição...`);
    // Fallback logic if needed, but assuming standard support per request
  }
  return label;
};

const deleteLabel = async (userId, labelId) => {
  const client = sessions.get(userId.toString());
  if (!client || !client.info) throw new Error(`Sessão ${userId} não pronta.`);

  const labels = await client.getLabels();
  const label = labels.find(l => l.id === labelId);

  if (label && typeof label.delete === 'function') {
    await label.delete();
  } else {
    throw new Error(`Label ${labelId} não encontrada ou não deletável.`);
  }
};

const setChatLabels = async (userId, chatId, labelIds) => {
  const client = sessions.get(userId.toString());
  if (!client || !client.info) throw new Error(`Sessão ${userId} não pronta.`);

  const chat = await client.getChatById(chatId);
  if (chat && typeof chat.changeLabels === 'function') {
    await chat.changeLabels(labelIds);
  } else {
    console.warn(`⚠️ Chat ${chatId} não suporta changeLabels ou não encontrado.`);
  }
};

const getChatLabels = async (userId, chatId) => {
  const client = sessions.get(userId.toString());
  if (!client || !client.info) throw new Error(`Sessão ${userId} não pronta.`);

  const chat = await client.getChatById(chatId);
  if (chat && typeof chat.getLabels === 'function') {
    return await chat.getLabels();
  } else {
    console.warn(`⚠️ Chat ${chatId} não suporta getLabels ou não encontrado.`);
    return [];
  }
};

const closeAllSessions = async () => {
  for (const [userId, client] of sessions.entries()) {
    try {
      // No shutdown do servidor, usamos destroy() em vez de logout()
      // para não perder a conexão (QR Code) na próxima reinicialização
      await client.destroy();
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
  closeAllSessions,
  getLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  setChatLabels,
  getChatLabels
};