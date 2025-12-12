require('dotenv').config();
const cors = require('cors');
const express = require('express');
const path = require('path');
const http = require('http'); // Necessário para o Socket.io
const { Server } = require("socket.io"); // <--- NOVO: Import do Socket.io
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const connectDB = require('./services/database');
const { startScheduler } = require('./services/scheduler');

// --- NOVOS IMPORTS DA ARQUITETURA HÍBRIDA ---
const { adaptTwilioMessage } = require('./services/providerAdapter'); // Adaptador
const { handleIncomingMessage } = require('./messageHandler'); // Handler Genérico
const { initializeWWebJS, getCurrentQR, getCurrentStatus, logoutWWebJS } = require('./services/wwebjsService'); // Serviço do WWebJS

// 1. Carregar Schemas
require('./models/SystemUser');
require('./models/Contact');
require('./models/BusinessConfig');

// 2. Importar Models
const SystemUser = require('./models/SystemUser');
const BusinessConfig = require('./models/BusinessConfig');
// OBS: removemos o 'handleTwilioMessage' antigo aqui, pois usaremos o handleIncomingMessage

const app = express();
const server = http.createServer(app); // Cria o server HTTP manualmente
const PORT = process.env.PORT || 3001;

// --- CONFIGURAÇÃO DO SOCKET.IO (NOVO) ---
// Isso permite enviar o QR Code do backend para o frontend em tempo real
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // URL do seu React
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Middleware de Autenticação (MANTIDO IGUAL)
const authenticateToken = (req, res, next) => {
  const token = req.cookies.auth_token || req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token necessário' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user;
    next();
  });
};

// --- SOCKET.IO EVENTOS (NOVO) ---
io.on('connection', (socket) => {
  console.log('🔌 Cliente React conectado ao Socket:', socket.id);

  const status = getCurrentStatus();
  socket.emit('wwebjs_status', status);

  const pendingQR = getCurrentQR();
  if (pendingQR) {
    console.log('📦 Enviando QR Code em cache para novo cliente');
    socket.emit('wwebjs_qr', pendingQR);
  }
  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

// --- ROTAS ---

// 1. Webhook Twilio (ATUALIZADO PARA O NOVO ADAPTER)
app.post('/api/webhook', async (req, res) => {
  try {
    res.status(200).send('<Response></Response>');

    // Se vier mensagem, adaptamos e passamos para o handler único
    if (req.body.Body || req.body.NumMedia) {
      const normalizedMsg = adaptTwilioMessage(req.body);
      await handleIncomingMessage(normalizedMsg);
    }
  } catch (error) {
    console.error('💥 Erro Webhook Twilio:', error);
  }
});

// 2. Rotas de Auth (MANTIDAS IGUAIS)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`Tentativa de login para: ${email}`);

    const user = await SystemUser.findOne({ email }).select('+password');

    if (!user || !(await user.correctPassword(password))) {
      return res.status(400).json({ message: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Erro detalhado no login:', error);
    res.status(500).json({ message: 'Erro interno no servidor' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, company } = req.body;
    if (await SystemUser.findOne({ email })) return res.status(400).json({ message: 'Email existe' });

    const user = await SystemUser.create({ name, email, password, company: company || 'Meu Negócio' });

    await BusinessConfig.create({
      userId: user._id,
      businessName: company || 'Novo Negócio',
      // businessType removido pois não estava no schema enviado anteriormente, 
      // mas se estiver no seu schema, pode manter.
      systemPrompt: "Você é um assistente virtual..."
    });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('auth_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Erro registro:', error);
    res.status(500).json({ message: 'Erro registro' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logout realizado' });
});

// 3. Rotas Dashboard (MANTIDAS IGUAIS)
app.get('/api/whatsapp-status', authenticateToken, (req, res) => {
  // Futuramente podemos integrar isso com o status real do WWebJS
  res.json({ isConnected: true, mode: 'Híbrido', status: 'active' });
});

app.get('/api/business-config', authenticateToken, async (req, res) => {
  try {
    let config = await BusinessConfig.findOne({ userId: req.user.userId });
    if (!config) config = await BusinessConfig.create({ userId: req.user.userId, businessName: 'Meu Negócio' });
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Erro config' });
  }
});

app.put('/api/business-config', authenticateToken, async (req, res) => {
  try {
    const config = await BusinessConfig.findOneAndUpdate(
      { userId: req.user.userId },
      { ...req.body, updatedAt: new Date() },
      { new: true, upsert: true }
    );
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Erro update config' });
  }
});

app.post('/api/whatsapp-logout', authenticateToken, async (req, res) => {
  try {
    await logoutWWebJS();
    res.json({ message: 'Desconectado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desconectar' });
  }
});

// --- INICIALIZAÇÃO ---
async function start() {
  try {
    await connectDB();

    startScheduler();

    // INICIA O MOTOR DO WHATSAPP WEB E PASSA O SOCKET.IO
    initializeWWebJS(io);

    // Importante: Usar server.listen em vez de app.listen para o Socket funcionar
    server.listen(PORT, () => {
      console.log(`\n🚀 SERVIDOR HÍBRIDO ONLINE NA PORTA ${PORT}`);
      console.log(`📡 Aguardando mensagens (Twilio + WWebJS)...`);
    });
  } catch (error) {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  }
}

start();