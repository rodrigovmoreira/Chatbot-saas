const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SystemUser = require('../models/SystemUser');
const BusinessConfig = require('../models/BusinessConfig');
const authenticateToken = require('../middleware/auth');
const { stopSession } = require('../services/wwebjsService');

// ROTA: /api/auth/login
router.post('/login', async (req, res) => {
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

// ROTA: /api/auth/register
router.post('/register', async (req, res) => {
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
    res.status(500).json({ message: 'Erro registro', error: error.message });
  }
});

// ROTA: /api/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`🚪 Usuário ${userId} fazendo logout. Encerrando bot...`);

    // Encerra sessão do WhatsApp para economizar recursos
    await stopSession(userId);

    res.clearCookie('auth_token');
    res.json({ message: 'Logout realizado e bot desligado.' });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.clearCookie('auth_token');
    res.json({ message: 'Logout realizado (erro ao fechar bot).' });
  }
});

module.exports = router;