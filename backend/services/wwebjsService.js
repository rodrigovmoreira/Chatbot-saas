const { Client, LocalAuth } = require('whatsapp-web.js');
const { adaptWWebJSMessage } = require('./providerAdapter');
const BusinessConfig = require('../models/BusinessConfig');

// === MAPAS DE ESTADO (Multi-tenant) ===
// Armazenam dados de VÁRIOS clientes simultaneamente
// Chave: userId (String) -> Valor: Instância do Client, QR Code, Status
const sessions = new Map();
const qrCodes = new Map();
const statuses = new Map();

let ioInstance;

/**
 * Inicializa o serviço globalmente e tenta restaurar sessões salvas
 * Chamado uma vez no server.js
 */
const initializeWWebJS = async (io) => {
  ioInstance = io;
  console.log('🔄 Serviço WWebJS Multi-tenant iniciado...');

  // RESTAURAÇÃO AUTOMÁTICA:
  // Ao reiniciar o servidor, busca no banco quem usa 'wwebjs' e sobe a sessão de novo.
  await restoreSessions();
};

const restoreSessions = async () => {
  try {
    const configs = await BusinessConfig.find({ whatsappProvider: 'wwebjs' });
    console.log(`📂 Verificando restauração para ${configs.length} empresas...`);
    
    for (const config of configs) {
      if (config.userId) {
        // Inicia a sessão para cada usuário encontrado
        // Não esperamos o await aqui para não travar o boot do servidor (faz em paralelo)
        startSession(config.userId.toString()).catch(err => 
            console.error(`Erro ao restaurar sessão de ${config.businessName}:`, err)
        );
      }
    }
  } catch (error) {
    console.error('Erro ao restaurar sessões:', error);
  }
};

/**
 * Inicia (ou recupera) uma sessão específica para um usuário
 * @param {string} userId - ID do usuário (dono da sessão)
 */
const startSession = async (userId) => {
  // 1. Se a sessão já existe e está rodando, retorna ela
  if (sessions.has(userId)) {
    const currentStatus = statuses.get(userId);
    if (currentStatus === 'ready' || currentStatus === 'authenticated') {
        console.log(`♻️ Sessão já ativa para UserID: ${userId}`);
        return sessions.get(userId);
    }
  }

  console.log(`🚀 Iniciando motor WWebJS para UserID: ${userId}`);
  updateStatus(userId, 'initializing');

  // 2. Busca configuração para pegar o ID da empresa (BusinessID)
  const config = await BusinessConfig.findOne({ userId });
  if (!config) {
    console.error(`❌ Config não encontrada para UserID: ${userId}. Sessão abortada.`);
    updateStatus(userId, 'error');
    return;
  }
  const businessId = config._id; // <--- Este ID será passado para o Handler

  // 3. Cria o Cliente com ISOLAMENTO DE DADOS (clientId)
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId }), // Cria pasta .wwebjs_auth/session-{userId}
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Otimização de memória para docker/servidores
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  // 4. Configura Eventos (Contextualizados para este UserID)

  client.on('qr', (qr) => {
    console.log(`📸 QR Code gerado para ${config.businessName} (User: ${userId})`);
    qrCodes.set(userId, qr);
    updateStatus(userId, 'qrcode');
    
    // Emite o QR Code APENAS para a sala do Socket deste usuário
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

  // RECEBIMENTO DE MENSAGENS
  client.on('message', async (msg) => {
    // Ignora status e notificações
    if (msg.type === 'e2e_notification' || msg.type === 'notification_template') return;
    
    try {
      // Import dinâmico para evitar dependência circular
      const { handleIncomingMessage } = require('../messageHandler');
      
      const normalizedMsg = await adaptWWebJSMessage(msg);
      
      // 🔥 O PULO DO GATO:
      // Passamos o businessId desta sessão específica para o Handler
      // Assim o bot sabe qual prompt usar e onde salvar a mensagem
      await handleIncomingMessage(normalizedMsg, businessId);
      
    } catch (error) {
      console.error(`Erro ao processar mensagem de ${config.businessName}:`, error);
    }
  });

  client.on('disconnected', (reason) => {
    console.log(`⚠️ Sessão desconectada (${config.businessName}):`, reason);
    cleanupSession(userId);
  });

  // 5. Inicializa e guarda no mapa
  try {
    client.initialize();
    sessions.set(userId, client);
  } catch (e) {
    console.error(`Erro fatal ao iniciar cliente ${userId}:`, e);
    updateStatus(userId, 'error');
  }
};

/**
 * Encerra a sessão de um usuário específico
 */
const stopSession = async (userId) => {
  console.log(`🛑 Solicitado encerramento para UserID: ${userId}`);
  const client = sessions.get(userId);
  
  if (client) {
    try {
      await client.destroy(); // Fecha o navegador
      console.log(`✅ Navegador fechado para UserID: ${userId}`);
    } catch (e) {
      console.error(`Erro ao destruir sessão ${userId}:`, e);
    }
  }
  cleanupSession(userId);
};

// Função auxiliar de limpeza
const cleanupSession = (userId) => {
  sessions.delete(userId);
  qrCodes.delete(userId);
  statuses.delete(userId);
  updateStatus(userId, 'disconnected');
};

// Função auxiliar para notificar o Frontend via Socket
const updateStatus = (userId, status) => {
  statuses.set(userId, status);
  if (ioInstance) {
    // Envia status APENAS para a sala do usuário
    ioInstance.to(userId).emit('wwebjs_status', status);
  }
};

// Getters
const getSessionStatus = (userId) => statuses.get(userId) || 'disconnected';
const getSessionQR = (userId) => qrCodes.get(userId);

const getClientSession = (userId) => {
  return sessions.get(userId.toString());
};
module.exports = { 
  initializeWWebJS, 
  startSession, 
  stopSession, 
  getSessionStatus, 
  getSessionQR,
  getClientSession
};