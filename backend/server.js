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
const cookieParser = require('cookie-parser');

// Serviços e Banco de Dados
const connectDB = require('./services/database');
const { startScheduler } = require('./services/scheduler');
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

// Carregar Models (Garantia de registro)
require('./models/SystemUser');
require('./models/BusinessConfig');
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ origin: allowedOrigins, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));

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

// 5. Webhook (Mantido aqui por ser externo)
app.post('/api/webhook', async (req, res) => {
  try {
    res.status(200).send('<Response></Response>');
    if (req.body.Body || req.body.NumMedia) {
      const normalizedMsg = adaptTwilioMessage(req.body);
      await handleIncomingMessage(normalizedMsg, null);
    }
  } catch (error) {
    console.error('💥 Erro Webhook:', error);
  }
});

// ==========================================
// SOCKET.IO (MULTI-TENANT)
// ==========================================
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado ao Socket:', socket.id);

  socket.on('join_session', (userId) => {
    if (!userId) return;
    console.log(`👤 Socket ${socket.id} entrou na sala: ${userId}`);
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
    await connectDB();
    startScheduler();
    
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

start();