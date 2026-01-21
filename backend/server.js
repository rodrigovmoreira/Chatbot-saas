// ==================== TRATAMENTO GLOBAL DE ERROS (CRASH SHIELD) ====================
process.on('uncaughtException', (err) => {
  if (err.code === 'EBUSY' || (err.message && err.message.includes('EBUSY'))) {
    console.warn(`🛡️ BLINDAGEM: Erro de arquivo travado (EBUSY) ignorado.`);
    return;
  }
  console.error('💥 ERRO CRÍTICO NÃO TRATADO:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Rejeição de Promise não tratada:', reason);
});
// ===================================================================================

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const mongoSanitize = require('./middleware/mongoSanitize');

// Config do Passport
require('./config/passport');

// Serviços e Banco de Dados
const connectDB = require('./services/database');
const { startScheduler } = require('./services/scheduler');
const { initScheduler: initCampaignScheduler } = require('./services/campaignScheduler');
const { adaptTwilioMessage } = require('./services/providerAdapter');
const { handleIncomingMessage } = require('./messageHandler');
const { 
  initializeWWebJS, 
  getSessionStatus, 
  getSessionQR, 
  closeAllSessions 
} = require('./services/wwebjsService');

// --- IMPORTAÇÃO DOS NOVOS PLUGINS (ROTAS) ---
const authRoutes = require('./routes/authRoutes');
const businessRoutes = require('./routes/businessRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const publicChatRoutes = require('./routes/publicChatRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const contactRoutes = require('./routes/contactRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// Carregar Models (Garantia de registro)
require('./models/SystemUser');
const BusinessConfig = require('./models/BusinessConfig');
require('./models/Appointment');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Configuração de CORS e Socket
const allowedOrigins = [
  "http://localhost:3000",
  "https://mindful-happiness-production.up.railway.app"
];

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"], credentials: true }
});

// Middlewares Globais
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: false // Allows the chat widget to be embedded via iframe
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(mongoSanitize);
app.use(cors({ origin: allowedOrigins, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(passport.initialize());

// Middleware para injetar IO nas rotas
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ==========================================
// 🔌 CONEXÃO DOS PLUGINS (ROTAS)
// ==========================================

// 1. Autenticação (Login, Register, Logout)
app.use('/api/auth', authRoutes);

// 2. Negócio (Config, Presets, Custom Prompts)
app.use('/api/business', businessRoutes);

// 3. WhatsApp (Status, Start, Stop)
app.use('/api/whatsapp', whatsappRoutes);

// 4. Agendamentos (Calendário)
app.use('/api/appointments', appointmentRoutes);

// 5. Chat Público (Web)
app.use('/api/chat', publicChatRoutes);

// 6. Campanhas (Active CRM)
app.use('/api/campaigns', campaignRoutes);

// 7. Contatos (Active CRM)
app.use('/api/contacts', contactRoutes);

// 8. Dashboard (Visão Geral)
app.use('/api/dashboard', dashboardRoutes);

// 9. Webhook (Mantido aqui por ser externo)
app.post('/api/webhook', async (req, res) => {
  try {
    res.status(200).send('<Response></Response>');
    if (req.body.Body || req.body.NumMedia) {
      const normalizedMsg = adaptTwilioMessage(req.body);

      // FIX: Fallback to first BusinessConfig for Webhooks if ID is missing
      // In production, this should map the 'To' number to a BusinessConfig

      // 1. Tenta mapear pelo número 'To' (destino)
      let targetPhone = req.body.To ? req.body.To.replace('whatsapp:', '') : null;
      let businessConfig = null;

      if (targetPhone) {
        businessConfig = await BusinessConfig.findOne({ phoneNumber: targetPhone });
        if (businessConfig) {
           console.log(`🎯 Webhook roteado para BusinessConfig: ${businessConfig._id} (Phone: ${targetPhone})`);
        }
      }

      // 2. Fallback: Se não achou (ou não veio 'To'), pega o primeiro (modo single-tenant/dev)
      if (!businessConfig) {
        businessConfig = await BusinessConfig.findOne();
        if (businessConfig) {
           console.log(`⚠️ Webhook: Fallback para primeira BusinessConfig encontrada: ${businessConfig._id}`);
        }
      }

      if (businessConfig) {
         await handleIncomingMessage(normalizedMsg, businessConfig._id);
      } else {
         console.error('❌ Webhook Ignorado: Nenhuma BusinessConfig encontrada.');
      }
    }
  } catch (error) {
    console.error('💥 Erro Webhook:', error);
  }
});

// ==========================================
// SOCKET.IO (MULTI-TENANT)
// ==========================================
io.on('connection', (socket) => {
  // 1. Visitante do Chat Público
  const visitorId = socket.handshake.query.visitorId;
  if (visitorId) {
    socket.join(visitorId);
    // console.log(`🔌 Visitor connected: ${visitorId}`);
  }

  // 2. Admin do Dashboard
  socket.on('join_session', (userId) => {
    if (!userId) return;
    socket.join(userId);

    // Envia estado atual imediato
    const status = getSessionStatus(userId);
    socket.emit('wwebjs_status', status);

    const qr = getSessionQR(userId);
    if (qr) socket.emit('wwebjs_qr', qr);
  });
});

// ==========================================
// INICIALIZAÇÃO
// ==========================================
async function start() {
  try {
    if (process.env.NODE_ENV !== 'test') {
      await connectDB();
    }
    startScheduler();
    initCampaignScheduler(); // Initialize the new Campaign Scheduler
    
    // Passamos o IO para o serviço WWebJS poder emitir eventos
    initializeWWebJS(io);

    server.listen(PORT, () => {
      console.log(`\n🚀 SERVIDOR SAAS ONLINE NA PORTA ${PORT}`);
    });
  } catch (error) {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  }
}

const cleanup = async () => {
  console.log('\n🛑 Encerrando servidor...');
  await closeAllSessions();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

if (require.main === module) {
  start();
}

module.exports = { app, server, start };