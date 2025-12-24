const express = require('express');
const router = express.Router();
const BusinessConfig = require('../models/BusinessConfig');
const IndustryPreset = require('../models/IndustryPreset');
const CustomPrompt = require('../models/CustomPrompt');
const authenticateToken = require('../middleware/auth');
const upload = require('../config/upload');

// === CONFIGURAÇÕES GERAIS ===

// GET /api/business/config
router.get('/config', authenticateToken, async (req, res) => {
  try {
    let config = await BusinessConfig.findOne({ userId: req.user.userId });
    // Se não existir, cria um padrão
    if (!config) config = await BusinessConfig.create({ userId: req.user.userId, businessName: 'Meu Negócio' });
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Erro config' });
  }
});

// PUT /api/business/config
router.put('/config', authenticateToken, async (req, res) => {
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

// === PRESETS (NICHOS DE MERCADO) ===

// GET /api/business/presets
router.get('/presets', authenticateToken, async (req, res) => {
  try {
    const presets = await IndustryPreset.find({}).select('key name icon').sort({ name: 1 });
    res.json(presets);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar presets' });
  }
});

// POST /api/business/apply-preset
router.post('/apply-preset', authenticateToken, async (req, res) => {
  try {
    const { presetKey } = req.body;
    const preset = await IndustryPreset.findOne({ key: presetKey });
    
    if (!preset) return res.status(404).json({ message: 'Modelo não encontrado' });

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
    res.status(500).json({ message: 'Erro ao aplicar preset' });
  }
});

// === MEUS MODELOS (CUSTOM PROMPTS) ===

// GET /api/business/custom-prompts
router.get('/custom-prompts', authenticateToken, async (req, res) => {
  try {
    const prompts = await CustomPrompt.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar modelos' });
  }
});

// POST /api/business/custom-prompts
router.post('/custom-prompts', authenticateToken, async (req, res) => {
  try {
    const { name, prompts } = req.body;
    const newPrompt = await CustomPrompt.create({ userId: req.user.userId, name, prompts });
    res.json(newPrompt);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Nome duplicado.' });
    res.status(500).json({ message: 'Erro ao salvar modelo' });
  }
});

// DELETE /api/business/custom-prompts/:id
router.delete('/custom-prompts/:id', authenticateToken, async (req, res) => {
  try {
    await CustomPrompt.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    res.json({ message: 'Modelo removido' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao deletar' });
  }
});

// ==========================================
// 📸 ROTA DE UPLOAD DE IMAGEM
// ==========================================
// O middleware 'upload.single("image")' pega o arquivo enviado e joga pro Cloudinary
router.post('/upload-image', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhuma imagem enviada.' });
    }

    // Se chegou aqui, o Cloudinary já devolveu o link seguro (path)
    console.log('✅ Upload realizado:', req.file.path);
    
    // Devolvemos a URL para o Frontend salvar junto com o produto depois
    res.json({ imageUrl: req.file.path });
  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({ message: 'Erro ao fazer upload da imagem.' });
  }
});

module.exports = router;