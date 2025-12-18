require('dotenv').config();
const cors = require('cors');
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const connectDB = require('./services/database');
const { startScheduler } = require('./services/scheduler');
const CustomPrompt = require('./models/CustomPrompt');

// --- IMPORTS DE SERVIÇOS ---
const { adaptTwilioMessage } = require('./services/providerAdapter');
const { handleIncomingMessage } = require('./messageHandler');

// IMPORTANTE: Importação atualizada para suportar Multi-sessão
const {
  initializeWWebJS,
  startSession,
  stopSession,
  getSessionStatus,
  getSessionQR,
  closeAllSessions
} = require('./services/wwebjsService');

// 1. Carregar Schemas (para garantir registro no Mongoose)
require('./models/SystemUser');
require('./models/Contact');
require('./models/BusinessConfig');
require('./models/IndustryPreset'); // <--- NOVO
require('./models/CustomPrompt');

// 2. Importar Models para uso nas rotas
const SystemUser = require('./models/SystemUser');
const BusinessConfig = require('./models/BusinessConfig');
const IndustryPreset = require('./models/IndustryPreset');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// --- CONFIGURAÇÃO DO SOCKET.IO ---
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
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

// Middleware de Autenticação JWT
const authenticateToken = (req, res, next) => {
  const token = req.cookies.auth_token || req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token necessário' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user; // { userId: '...' }
    next();
  });
};

// --- SOCKET.IO: LOGICA DE SALAS (MULTI-TENANT) ---
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado ao Socket:', socket.id);

  // O Frontend deve emitir este evento logo após conectar
  socket.on('join_session', (userId) => {
    if (!userId) return;

    // Entra na "sala" exclusiva deste usuário
    console.log(`👤 Socket ${socket.id} entrou na sala do usuário: ${userId}`);
    socket.join(userId);

    // Envia o status ATUAL desta sessão específica
    const status = getSessionStatus(userId);
    socket.emit('wwebjs_status', status);

    // Se tiver QR Code pendente na memória, envia também
    const qr = getSessionQR(userId);
    if (qr) socket.emit('wwebjs_qr', qr);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

// ==========================================
// ROTAS DA API
// ==========================================

// 1. Webhook Twilio (Mantido para compatibilidade futura)
app.post('/api/webhook', async (req, res) => {
  try {
    res.status(200).send('<Response></Response>');
    if (req.body.Body || req.body.NumMedia) {
      const normalizedMsg = adaptTwilioMessage(req.body);
      // Nota: Twilio precisa de lógica extra para identificar o BusinessID pelo número de destino 'To'
      // Por enquanto, focamos no WWebJS que já está resolvido.
      await handleIncomingMessage(normalizedMsg, null);
    }
  } catch (error) {
    console.error('💥 Erro Webhook Twilio:', error);
  }
});

// 2. Rotas de Auth (Login/Registro)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
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
    console.error('Erro login:', error);
    res.status(500).json({ message: 'Erro interno' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, company } = req.body;
    if (await SystemUser.findOne({ email })) return res.status(400).json({ message: 'Email existe' });

    const user = await SystemUser.create({ name, email, password, company: company || 'Meu Negócio' });

    // Cria a configuração inicial padrão
    await BusinessConfig.create({
      userId: user._id,
      businessName: company || 'Novo Negócio',
      prompts: {
        chatSystem: "Você é um assistente virtual útil.",
        visionSystem: "Descreva o que vê."
      }
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

// 3. Rotas Dashboard (Configurações Gerais)
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

// 4. ROTAS DE CONTROLE DO WHATSAPP (SAAS / MULTI-TENANT)
// ======================================================

// Verifica status (agora busca do mapa de sessões)
app.get('/api/whatsapp-status', authenticateToken, (req, res) => {
  const status = getSessionStatus(req.user.userId);
  // Retorna se está conectado baseado no status do serviço
  const isConnected = (status === 'ready' || status === 'authenticated');
  res.json({ isConnected, mode: status || 'disconnected' });
});

// Inicia a sessão (Botão "Conectar")
app.post('/api/whatsapp-start', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`▶️ Iniciando sessão manual para: ${userId}`);
    await startSession(userId);
    res.json({ message: 'Inicializando sessão...' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao iniciar sessão' });
  }
});

// Encerra a sessão (Botão "Desconectar")
app.post('/api/whatsapp-logout', authenticateToken, async (req, res) => {
  try {
    await stopSession(req.user.userId);
    res.json({ message: 'Desconectado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desconectar' });
  }
});

// 5. ROTAS DE PRESETS (INTELIGÊNCIA / NICHO)
// ==========================================

app.get('/api/presets', authenticateToken, async (req, res) => {
  try {
    const presets = await IndustryPreset.find({}).select('key name icon').sort({ name: 1 });
    res.json(presets);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar presets' });
  }
});

app.post('/api/apply-preset', authenticateToken, async (req, res) => {
  try {
    const { presetKey } = req.body;
    if (!presetKey) return res.status(400).json({ message: 'Preset Key obrigatória' });

    const preset = await IndustryPreset.findOne({ key: presetKey });
    if (!preset) return res.status(404).json({ message: 'Modelo não encontrado' });

    // Atualiza apenas os campos de inteligência e comportamento
    const updatedConfig = await BusinessConfig.findOneAndUpdate(
      { userId: req.user.userId },
      {
        $set: {
          'prompts.chatSystem': preset.prompts.chatSystem,
          'prompts.visionSystem': preset.prompts.visionSystem,
          followUpSteps: preset.followUpSteps
        }
      },
      { new: true }
    );

    res.json({ message: 'Personalidade aplicada!', config: updatedConfig });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao aplicar preset' });
  }
});

// === 6. ROTAS DE PROMPTS PERSONALIZADOS (MEUS MODELOS) ===
// Listar meus modelos
app.get('/api/custom-prompts', authenticateToken, async (req, res) => {
  try {
    const prompts = await CustomPrompt.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar modelos personalizados' });
  }
});

// Criar novo modelo (Salvar o que está na tela)
app.post('/api/custom-prompts', authenticateToken, async (req, res) => {
  try {
    const { name, prompts } = req.body;
    if (!name || !prompts) return res.status(400).json({ message: 'Dados incompletos' });

    const newPrompt = await CustomPrompt.create({
      userId: req.user.userId,
      name,
      prompts
    });
    res.json(newPrompt);
  } catch (error) {
    // Tratamento de erro de duplicação
    if (error.code === 11000) return res.status(400).json({ message: 'Já existe um modelo com esse nome.' });
    res.status(500).json({ message: 'Erro ao salvar modelo' });
  }
});

// Deletar modelo
app.delete('/api/custom-prompts/:id', authenticateToken, async (req, res) => {
  try {
    await CustomPrompt.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    res.json({ message: 'Modelo removido' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar' });
  }
});

// --- INICIALIZAÇÃO ---
async function start() {
  try {
    await connectDB();
    startScheduler();
    initializeWWebJS(io);

    server.listen(PORT, () => {
      console.log(`\n🚀 SERVIDOR SAAS ONLINE NA PORTA ${PORT}`);
      console.log(`📡 Aguardando conexões Multi-tenant...`);
    });
  } catch (error) {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  }
}

const cleanup = async () => {
  console.log('\n🛑 Recebido sinal de encerramento. Fechando navegadores...');
  await closeAllSessions();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

start();