require('dotenv').config();
const cors = require('cors');
const express = require('express');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const path = require('path');
const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const SystemUser = require('./models/SystemUser');
const Contact = require('./models/Contact');
const BusinessConfig = require('./models/BusinessConfig');

function startServer(whatsappClient) {
  const app = express();
  const server = http.createServer(app);
  const io = socketIO(server);
  const PORT = process.env.PORT || 3001;

  console.log('🔄 Iniciando servidor...');

  // Middlewares
  app.use(express.json());
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(cors({origin: 'http://localhost:3000', credentials: true}));

  // Verificar se JWT_SECRET existe
  if (!process.env.JWT_SECRET) {
    console.error('💥 ERRO CRÍTICO: JWT_SECRET não definido no .env');
    process.exit(1);
  }

  // ✅ CORREÇÃO: Middleware para verificar se já está autenticado (para login)
  const redirectIfAuthenticated = (req, res, next) => {
    const token = req.cookies.auth_token;
    if (token) {
      jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (!err) {
          console.log('✅ Usuário já autenticado, redirecionando para dashboard');
          return res.redirect('/admin/dashboard');
        }
        next();
      });
    } else {
      next();
    }
  };

  // Middleware de autenticação para APIs (header)
  const authenticateToken = (req, res, next) => {
    const token = req.cookies.auth_token || req.headers['authorization']?.split(' ')[1];
    console.log('🔐 Verificando token para API:', token ? 'Token presente' : 'Token ausente');

    if (!token) {
      return res.status(401).json({ message: 'Token de acesso necessário' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        console.log('❌ Token inválido:', err.message);
        return res.status(403).json({ message: 'Token inválido' });
      }
      req.user = user;
      console.log('✅ Token válido para usuário:', user.userId);
      next();
    });
  };

  // Middleware para autenticação de páginas EJS (via cookie) - APENAS PARA DASHBOARD
  // const authenticateCookie = (req, res, next) => {
  //   const token = req.cookies.auth_token;
  //   console.log('🔐 Verificando token (Cookie):', token ? 'Token presente' : 'Token ausente');

  //   if (!token) {
  //     console.log('❌ Token ausente para página, redirecionando para login');
  //     return res.redirect('/admin/login');
  //   }

  //   jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
  //     if (err) {
  //       console.log('❌ Token inválido para página:', err.message);
  //       return res.redirect('/admin/login');
  //     }
  //     req.user = user;
  //     console.log('✅ Token válido para página, usuário:', user.userId);
  //     next();
  //   });
  // };

  // ✅ MELHORIA: Estado global do WhatsApp
  let whatsappState = {
    isConnected: false,
    isAuthenticated: false,
    lastQr: null,
    connectionTime: null
  };

  // Rotas de Autenticação
  app.post('/api/register', async (req, res) => {
    try {
      console.log('📝 Iniciando registro:', { ...req.body, password: '***' });
      const { name, email, password, company } = req.body;

      // Validação básica
      if (!name || !email || !password) {
        console.log('❌ Dados incompletos no registro');
        return res.status(400).json({ message: 'Nome, email e senha são obrigatórios' });
      }

      console.log('🔍 Verificando usuário existente:', email);
      const existingUser = await SystemUser.findOne({ email });
      if (existingUser) {
        console.log('❌ Usuário já existe:', email);
        return res.status(400).json({ message: 'Usuário já existe com este email' });
      }

      console.log('👤 Criando novo usuário...');
      const user = await SystemUser.create({
        name,
        email,
        password,
        company: company || 'Meu Negócio'
      });
      console.log('✅ Usuário criado com ID:', user._id);

      console.log('🏢 Criando configuração padrão do negócio...');
      await BusinessConfig.create({
        userId: user._id,
        businessName: company || 'Meu Negócio',
        businessType: 'outros',
        menuOptions: [
          {
            keyword: 'produtos',
            description: 'Ver produtos',
            response: 'Aqui estão nossos produtos principais...'
          },
          {
            keyword: 'horario',
            description: 'Horário de funcionamento',
            response: 'Funcionamos de segunda a sexta, das 9h às 18h.'
          }
        ]
      });
      console.log('✅ Configuração de negócio criada');

      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // ✅ SETAR COOKIE
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      });

      console.log('✅ Registro concluído com sucesso para:', email);
      res.status(201).json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          company: user.company
        }
      });

    } catch (error) {
      console.error('💥 ERRO NO REGISTRO:', error);
      res.status(500).json({
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      console.log('🔐 Tentativa de login:', req.body.email);
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios' });
      }

      console.log('🔍 Buscando usuário:', email);
      const user = await SystemUser.findOne({ email }).select('+password');

      if (!user) {
        console.log('❌ Usuário não encontrado:', email);
        return res.status(400).json({ message: 'Credenciais inválidas' });
      }

      console.log('🔑 Verificando senha...');
      const validPassword = await user.correctPassword(password);
      if (!validPassword) {
        console.log('❌ Senha incorreta para:', email);
        return res.status(400).json({ message: 'Credenciais inválidas' });
      }

      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // ✅ SETAR COOKIE
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      });

      console.log('✅ Login bem-sucedido para:', email);
      res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          company: user.company
        }
      });

    } catch (error) {
      console.error('💥 ERRO NO LOGIN:', error);
      res.status(500).json({
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  });

  // ✅ Rota de logout
  app.post('/api/logout', (req, res) => {
    console.log('🚪 Realizando logout...');
    res.clearCookie('auth_token');
    res.json({ message: 'Logout realizado com sucesso' });
  });

  // ✅ NOVA ROTA: Status do WhatsApp
  app.get('/api/whatsapp-status', authenticateToken, (req, res) => {
    res.json({
      isConnected: whatsappState.isConnected,
      isAuthenticated: whatsappState.isAuthenticated,
      connectionTime: whatsappState.connectionTime
    });
  });

  // Rotas do Business Config
  app.get('/api/business-config', authenticateToken, async (req, res) => {
    try {
      console.log('📋 Buscando configuração para usuário:', req.user.userId);
      const config = await BusinessConfig.findOne({ userId: req.user.userId });

      if (!config) {
        console.log('❌ Configuração não encontrada, criando padrão...');
        const newConfig = await BusinessConfig.create({
          userId: req.user.userId,
          businessName: 'Meu Negócio',
          businessType: 'outros'
        });
        return res.json(newConfig);
      }

      res.json(config);
    } catch (error) {
      console.error('💥 ERRO ao buscar configuração:', error);
      res.status(500).json({ message: 'Erro ao buscar configuração' });
    }
  });

  app.put('/api/business-config', authenticateToken, async (req, res) => {
    try {
      console.log('📝 Atualizando configuração para usuário:', req.user.userId);
      const config = await BusinessConfig.findOneAndUpdate(
        { userId: req.user.userId },
        { ...req.body, updatedAt: new Date() },
        { new: true, upsert: true }
      );
      res.json(config);
    } catch (error) {
      console.error('💥 ERRO ao atualizar configuração:', error);
      res.status(500).json({ message: 'Erro ao atualizar configuração' });
    }
  });

  // ✅ CORREÇÃO: Rotas de visualização - LOGIN SEM autenticação
  // app.get('/', (req, res) => {
  //   console.log('🏠 Redirecionando raiz para login...');
  //   res.redirect('/admin/login');
  // });

  // // ✅ LOGIN: SEM authenticateCookie, COM redirectIfAuthenticated
  // app.get('/admin/login', redirectIfAuthenticated, (req, res) => {
  //   console.log('🔐 Servindo página de login...');
  //   res.render('admin/login', { title: 'Login - ChatBot Platform' });
  // });

  // // ✅ DASHBOARD: COM authenticateCookie
  // app.get('/admin/dashboard', authenticateCookie, (req, res) => {
  //   console.log('📊 Servindo dashboard para usuário:', req.user.userId);
  //   res.render('admin/dashboard', {
  //     title: 'Dashboard - ChatBot Platform'
  //   });
  // });

  // ✅ MELHORIA: Função para emitir QR Code
  const generateAndEmitQr = async (io, qr) => {
    try {
      console.log('🎨 Convertendo QR Code para imagem...');
      const qrImageUrl = await qrcode.toDataURL(qr);
      console.log('📤 Emitindo QR Code via Socket.IO');
      io.emit('qr', qrImageUrl);
      io.emit('status', 'Escaneie o QR Code no WhatsApp');
    } catch (error) {
      console.error('💥 ERRO ao gerar QR Code:', error);
    }
  };

  // ✅ MELHORIA: Eventos do WhatsApp otimizados
  whatsappClient.on('qr', (qr) => {
    if (!whatsappState.isConnected) {
      console.log('📱 QR Code gerado pelo WhatsApp');
      whatsappState.lastQr = qr;
      generateAndEmitQr(io, qr);
    }
  });

  whatsappClient.on('authenticated', () => {
    console.log('✅ WhatsApp autenticado!');
    whatsappState.isAuthenticated = true;
    io.emit('status', 'Autenticado - Conectando...');
  });

  whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp conectado e pronto!');
    whatsappState.isConnected = true;
    whatsappState.isAuthenticated = true;
    whatsappState.connectionTime = new Date();
    whatsappState.lastQr = null;

    io.emit('status', 'Conectado com sucesso! O bot está pronto para receber mensagens.');
    io.emit('whatsapp_ready', true);

    console.log('🕒 Tempo de conexão:', whatsappState.connectionTime.toLocaleString());
  });

  whatsappClient.on('disconnected', (reason) => {
    console.log('❌ WhatsApp desconectado:', reason);
    whatsappState.isConnected = false;
    whatsappState.isAuthenticated = false;
    whatsappState.connectionTime = null;

    io.emit('status', `Desconectado: ${reason} - Reinicie o servidor`);
    io.emit('whatsapp_ready', false);
  });

  whatsappClient.on('auth_failure', (error) => {
    console.error('💥 Falha na autenticação do WhatsApp:', error);
    whatsappState.isConnected = false;
    whatsappState.isAuthenticated = false;

    io.emit('status', 'Falha na autenticação - Recarregue a página e tente novamente');
    io.emit('whatsapp_ready', false);
  });

  whatsappClient.on('change_state', (state) => {
    console.log('🔄 Mudança de estado do WhatsApp:', state);
    // CONNECTED, DISCONNECTED, etc.
  });

  // ✅ MELHORIA: Socket.IO com autenticação e tratamento melhorado
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    console.log('🔐 Autenticando socket, token presente:', !!token);

    if (!token) {
      console.log('❌ Socket sem token - rejeitando');
      return next(new Error('Autenticação necessária'));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log('❌ Token de socket inválido:', err.message);
        return next(new Error('Token inválido'));
      }
      socket.userId = decoded.userId;
      console.log('✅ Socket autenticado para usuário:', decoded.userId);
      next();
    });
  });

  io.on('connection', (socket) => {
    console.log('🔌 Novo cliente conectado via Socket.IO, usuário:', socket.userId);
    console.log('🔗 Socket ID:', socket.id);
    console.log('📡 Transporte:', socket.conn.transport.name);

    // ✅ MELHORIA: Enviar status atual do WhatsApp para o novo cliente
    if (whatsappState.isConnected) {
      console.log('📱 WhatsApp está conectado, enviando status de sucesso');
      socket.emit('whatsapp_ready', true);
      socket.emit('status', 'Conectado com sucesso!');
    } else if (whatsappState.lastQr) {
      console.log('📱 Enviando QR Code existente para novo cliente');
      generateAndEmitQr(socket, whatsappState.lastQr);
    } else {
      console.log('⏳ Aguardando geração do QR Code...');
      socket.emit('status', 'Aguardando geração do QR Code...');
    }

    socket.on('disconnect', (reason) => {
      console.log('🔌 Cliente desconectado:', socket.userId, 'Razão:', reason);
    });

    // ✅ NOVO: Evento para forçar nova geração de QR Code
    socket.on('request_qr', () => {
      console.log('🔄 Cliente solicitou novo QR Code');
      if (!whatsappState.isConnected && whatsappState.lastQr) {
        generateAndEmitQr(socket, whatsappState.lastQr);
      }
    });
  });

  server.listen(PORT, () => {
    console.log('✅ Aguardando conexão do WhatsApp...');
  });

  return server;
}

module.exports = { startServer };
