require('dotenv').config();
const cors = require('cors');
const express = require('express');
const path = require('path');
const http = require('http');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('./models/SystemUser');
require('./models/Contact'); // <--- Essa linha resolve o erro MissingSchemaError
require('./models/BusinessConfig');

// Importaremos a nova função de tratamento de mensagens
const { handleTwilioMessage } = require('./messageHandler');

function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT || 3001;

  console.log('🔄 Iniciando servidor Express...');

  // --- Middlewares ---
  app.use(express.json());
  // ⚠️ IMPORTANTE: Twilio envia dados como 'application/x-www-form-urlencoded'
  app.use(express.urlencoded({ extended: true })); 
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));
  
  // CORS configurado para seu frontend
  app.use(cors({ 
    origin: 'http://localhost:3000', 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }));

  // Verificar JWT Secret
  if (!process.env.JWT_SECRET) {
    console.error('💥 ERRO CRÍTICO: JWT_SECRET não definido no .env');
    process.exit(1);
  }

  // Middleware de Autenticação
  const authenticateToken = (req, res, next) => {
    const token = req.cookies.auth_token || req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Token de acesso necessário' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ message: 'Token inválido' });
      }
      req.user = user;
      next();
    });
  };

  // === ROTA WEBHOOK (O Coração do Twilio) ===
  app.post('/api/webhook', async (req, res) => {
    try {
      // 1. O Twilio exige uma resposta rápida (200 OK) ou TwiML.
      // Respondemos vazio para confirmar recebimento e não travar o Twilio.
      res.status(200).send('<Response></Response>');

      const messageData = req.body;
      
      // Logs para debug (ver o que o Twilio mandou)
      // console.log('📨 Payload do Twilio:', JSON.stringify(messageData, null, 2));

      // 2. Processamos a mensagem de forma assíncrona
      // Se der erro aqui dentro, não afeta a resposta 200 que já foi enviada
      if (messageData.Body) {
        await handleTwilioMessage(messageData);
      }

    } catch (error) {
      console.error('💥 Erro no endpoint do Webhook:', error);
      // Se o erro for antes do envio da resposta, garantimos que não fique pendente
      if (!res.headersSent) res.status(500).end();
    }
  });

  // === ROTAS DE API (Login, Registro, Config) ===
  // Mantidas idênticas à sua lógica original, apenas limpas

  app.post('/api/register', async (req, res) => {
    try {
      const { name, email, password, company } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Dados incompletos' });
      }

      const existingUser = await SystemUser.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Usuário já existe' });
      }

      const user = await SystemUser.create({
        name, email, password, company: company || 'Meu Negócio'
      });

      // Cria config padrão
      await BusinessConfig.create({
        userId: user._id,
        businessName: company || 'Meu Negócio',
        businessType: 'outros',
        menuOptions: [
           { keyword: 'ajuda', description: 'Ver opções', response: 'Como posso ajudar?' }
        ]
      });

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      });

      res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
      console.error('Erro no registro:', error);
      res.status(500).json({ message: 'Erro interno' });
    }
  });

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
      console.error('Erro no login:', error);
      res.status(500).json({ message: 'Erro interno' });
    }
  });

  app.post('/api/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ message: 'Logout realizado' });
  });

  // Rota de Status (Adaptada para Twilio)
  // Como não temos mais conexão física via socket, o status é sempre "ativo" se o server estiver rodando.
  app.get('/api/whatsapp-status', authenticateToken, (req, res) => {
    res.json({
      isConnected: true, 
      isAuthenticated: true,
      connectionTime: new Date(),
      mode: 'Twilio Cloud'
    });
  });

  // Configurações do Negócio
  app.get('/api/business-config', authenticateToken, async (req, res) => {
    try {
      let config = await BusinessConfig.findOne({ userId: req.user.userId });
      if (!config) {
        // Fallback se não existir
        config = await BusinessConfig.create({ userId: req.user.userId, businessName: 'Meu Negócio', businessType: 'outros' });
      }
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao buscar configuração' });
    }
  });

  app.put('/api/business-config', authenticateToken, async (req, res) => {
    try {
      const updateData = { ...req.body, userId: req.user.userId, updatedAt: new Date() };
      const config = await BusinessConfig.findOneAndUpdate(
        { userId: req.user.userId },
        updateData,
        { new: true, upsert: true, runValidators: true }
      );
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao atualizar configuração' });
    }
  });

  // Iniciar Servidor
  server.listen(PORT, () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
    console.log(`📡 Rota de Webhook ativa em: /api/webhook`);
  });

  return server;
}

module.exports = { startServer };