const express = require('express');
const router = express.Router();
const BusinessConfig = require('../models/BusinessConfig');
const IndustryPreset = require('../models/IndustryPreset');
const CustomPrompt = require('../models/CustomPrompt');
const authenticateToken = require('../middleware/auth');
const messageService = require('../services/message'); // <--- IMPORTEI O SERVICE
const { upload, bucket } = require('../config/upload'); // Destructuring to get bucket too
const { deleteFromFirebase } = require('../utils/firebaseHelper');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

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
    // 1. Antes de salvar, buscamos a config antiga para comparar imagens
    const oldConfig = await BusinessConfig.findOne({ userId: req.user.userId });

    if (oldConfig && oldConfig.products && req.body.products) {
      // Coletar todas as URLs de imagens que existiam
      const oldImages = new Set();
      oldConfig.products.forEach(p => {
        if (p.imageUrls && Array.isArray(p.imageUrls)) {
          p.imageUrls.forEach(url => oldImages.add(url));
        }
      });

      // Coletar todas as URLs que estão chegando agora
      const newImages = new Set();
      req.body.products.forEach(p => {
        if (p.imageUrls && Array.isArray(p.imageUrls)) {
          p.imageUrls.forEach(url => newImages.add(url));
        }
      });

      // Encontrar as que sumiram (foram deletadas)
      const imagesToDelete = [...oldImages].filter(url => !newImages.has(url));

      // Deletar do Firebase
      if (imagesToDelete.length > 0) {
        console.log(`🗑️ Detectada exclusão de ${imagesToDelete.length} imagens. Limpando Storage...`);
        // Não esperamos o delete para não travar a resposta da API (Fire & Forget ou Promise.allSettled)
        Promise.allSettled(imagesToDelete.map(url => deleteFromFirebase(url)));
      }
    }

    const config = await BusinessConfig.findOneAndUpdate(
      { userId: req.user.userId },
      { ...req.body, updatedAt: new Date() },
      { new: true, upsert: true }
    );
    res.json(config);
  } catch (error) {
    console.error('Erro update config:', error);
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
    const { name, prompts, followUpSteps } = req.body;
    const newPrompt = await CustomPrompt.create({ userId: req.user.userId, name, prompts, followUpSteps });
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
// 🔔 ROTAS DE REGRAS DE NOTIFICAÇÃO (Fase 2)
// ==========================================

// POST /api/business/config/notifications
router.post('/config/notifications', authenticateToken, async (req, res) => {
  try {
    const config = await BusinessConfig.findOne({ userId: req.user.userId });
    if (!config) return res.status(404).json({ message: 'Configuração não encontrada' });

    const newRule = {
      id: uuidv4(),
      ...req.body // name, triggerOffset, etc.
    };

    if (!config.notificationRules) config.notificationRules = [];
    config.notificationRules.push(newRule);

    await config.save();
    res.json(newRule);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao adicionar regra');
  }
});

// PUT /api/business/config/notifications/:ruleId
router.put('/config/notifications/:ruleId', authenticateToken, async (req, res) => {
  try {
    const config = await BusinessConfig.findOne({ userId: req.user.userId });
    if (!config) return res.status(404).json({ message: 'Configuração não encontrada' });

    if (!config.notificationRules) config.notificationRules = [];
    const ruleIndex = config.notificationRules.findIndex(r => r.id === req.params.ruleId);

    if (ruleIndex === -1) return res.status(404).json({ message: 'Regra não encontrada' });

    // Atualiza campos permitidos
    const fields = ['name', 'triggerOffset', 'triggerUnit', 'triggerDirection', 'messageTemplate', 'isActive'];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        config.notificationRules[ruleIndex][f] = req.body[f];
      }
    });

    await config.save();
    res.json(config.notificationRules[ruleIndex]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao editar regra');
  }
});

// DELETE /api/business/config/notifications/:ruleId
router.delete('/config/notifications/:ruleId', authenticateToken, async (req, res) => {
  try {
    const config = await BusinessConfig.findOne({ userId: req.user.userId });
    if (!config) return res.status(404).json({ message: 'Configuração não encontrada' });

    if (config.notificationRules) {
        config.notificationRules = config.notificationRules.filter(r => r.id !== req.params.ruleId);
        await config.save();
    }

    res.json({ message: 'Regra removida' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao remover regra');
  }
});

// ==========================================
// 📸 ROTA DE UPLOAD DE IMAGEM (FIREBASE)
// ==========================================
router.post('/upload-image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhuma imagem enviada.' });
    }

    // 1. Processar imagem com Sharp (Redimensionar e converter para JPEG)
    const processedBuffer = await sharp(req.file.buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .toFormat('jpeg', { quality: 80 })
      .toBuffer();

    // 2. Criar nome único e referência no Storage
    // SEPARAR AVATARES DE PRODUTOS
    const type = req.body.type === 'avatar' ? 'avatars' : 'products';
    const filename = `${type}/${uuidv4()}.jpg`;

    const file = bucket.file(filename);

    // 3. Upload Stream para Firebase
    const stream = file.createWriteStream({
      metadata: {
        contentType: 'image/jpeg'
      }
    });

    stream.on('error', (err) => {
      console.error('Erro no stream de upload:', err);
      res.status(500).json({ message: 'Erro ao fazer upload da imagem.' });
    });

    stream.on('finish', async () => {
      try {
        // 4. Tornar público e gerar URL
        await file.makePublic();

        // URL Pública Padrão (Firebase/GCS)
        // https://storage.googleapis.com/BUCKET_NAME/products/filename.jpg
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

        console.log('✅ Upload Firebase realizado:', publicUrl);
        res.json({ imageUrl: publicUrl });
      } catch (err) {
         console.error('Erro ao tornar público:', err);
         res.status(500).json({ message: 'Erro ao finalizar upload.' });
      }
    });

    stream.end(processedBuffer);

  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({ message: 'Erro interno no upload.' });
  }
});

// ==========================================
// 💬 ROTAS DO ADMIN CHAT (Fase 3)
// ==========================================

// GET /conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    // Busca a config do usuário para pegar o ID do Negócio
    const config = await BusinessConfig.findOne({ userId: req.user.userId });
    if (!config) return res.json([]); // Se não tem negócio, não tem conversas

    // Passa o ID do Negócio, pois os Contatos estão vinculados a ele
    const conversations = await messageService.getConversations(config._id);
    res.json(conversations);
  } catch (error) {
    console.error('Erro GET /conversations:', error);
    res.status(500).json({ message: 'Erro ao buscar conversas' });
  }
});

// GET /conversations/:contactId/messages
router.get('/conversations/:contactId/messages', authenticateToken, async (req, res) => {
  try {
    const config = await BusinessConfig.findOne({ userId: req.user.userId });
    if (!config) return res.status(404).json({ message: 'Negócio não encontrado' });

    const messages = await messageService.getMessagesForContact(req.params.contactId, config._id);
    res.json(messages);
  } catch (error) {
    console.error('Erro GET /messages:', error);
    res.status(500).json({ message: 'Erro ao buscar mensagens' });
  }
});

// DELETE /api/business/delete-image
router.post('/delete-image', authenticateToken, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ message: 'URL da imagem não fornecida.' });

    await deleteFromFirebase(imageUrl);
    res.json({ message: 'Imagem removida com sucesso.' });
  } catch (error) {
    console.error('Erro delete-image:', error);
    res.status(500).json({ message: 'Erro ao deletar imagem.' });
  }
});

module.exports = router;
