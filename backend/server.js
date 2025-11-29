require('dotenv').config();
const cors = require('cors');
const express = require('express');
const path = require('path');
const http = require('http');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const connectDB = require('./services/database'); 

// 1. Carregar Schemas (Evita MissingSchemaError)
require('./models/SystemUser');
require('./models/Contact');
require('./models/BusinessConfig');

// 2. Importar Models para uso nas Rotas (Evita ReferenceError)
const SystemUser = require('./models/SystemUser');
const BusinessConfig = require('./models/BusinessConfig');
const { handleTwilioMessage } = require('./messageHandler');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001; 

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use(cookieParser());

app.use(cors({ 
  origin: 'http://localhost:3000', 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

const authenticateToken = (req, res, next) => {
  const token = req.cookies.auth_token || req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token necessário' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user;
    next();
  });
};

// --- ROTAS ---

app.post('/api/webhook', async (req, res) => {
  try {
    res.status(200).send('<Response></Response>'); 
    if (req.body.Body) {
      await handleTwilioMessage(req.body);
    }
  } catch (error) {
    console.error('💥 Erro Webhook:', error);
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`Tentativa de login para: ${email}`);
    
    // Agora 'SystemUser' existe porque definimos a const lá em cima
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
        businessType: 'servicos',
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

// Rotas Dashboard
app.get('/api/whatsapp-status', authenticateToken, (req, res) => {
  res.json({ isConnected: true, mode: 'Twilio Cloud', status: 'active' });
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

// Inicialização
async function start() {
    try {
        await connectDB();
        server.listen(PORT, () => {
            console.log(`\n🚀 SERVIDOR ONLINE NA PORTA ${PORT}`);
            console.log(`📡 Aguardando mensagens...`);
        });
    } catch (error) {
        console.error('💥 Erro fatal:', error);
        process.exit(1);
    }
}

start();