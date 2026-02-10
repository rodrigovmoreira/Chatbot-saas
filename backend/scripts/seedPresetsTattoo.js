// Arquivo: backend/scripts/seedPresets.js
const path = require('path');
const mongoose = require('mongoose');

// 1. RESOLUÇÃO DE CAMINHO
const envPath = path.join(__dirname, '..', '..', '.env');
console.log('🔍 Procurando arquivo .env em:', envPath);

// 2. CARREGA AS VARIÁVEIS
require('dotenv').config({ path: envPath });

if (!process.env.MONGO_URI) {
    console.error('❌ ERRO CRÍTICO: MONGO_URI não encontrada.');
    process.exit(1);
}

// 3. IMPORTA O MODELO
const IndustryPreset = require('../models/IndustryPreset');
const mongoUri = process.env.MONGO_URI;

// --- DEFINIÇÃO DOS PRESETS AVANÇADOS ---
const presets = [
  // 1. Tattoo (Melhorado)
  {
    key: 'tattoo',
    name: 'Tattoo & Estética corporal',
    icon: '🪞',
    botName: 'Robson',
    toneOfVoice: 'Camarada, direto e especialista. Use gírias leves do nicho ',
    customInstructions: `CONTEXTO:
Você é o ... virtual da 'Tatuaria Calango'. Seu ambiente é um estúdio de tatuagem moderno, descolado e acolhedor.`,
    prompts: {
      chatSystem: "", // Deprecated: Decomposed into botName, toneOfVoice, customInstructions
      visionSystem: `...`
    },
    followUpSteps: [
      { stage: 1, delayMinutes: 45, message: "E aí guerreiro? Vai deixar passar a chance de dar aquele trato no visual hoje? 👊 A agenda tá correndo!" },
      { stage: 2, delayMinutes: 2880, message: "Fala irmão! Fim de semana chegando. Bora garantir seu horário antes que lote tudo? 💈" }
    ]
  }
];

// 4. EXECUÇÃO
mongoose.connect(mongoUri)
  .then(async () => {
    console.log('🔌 Conectado ao MongoDB...');
    
    // Opcional: Limpar coleção anterior
    await IndustryPreset.deleteMany({});
    console.log('🧹 Presets antigos limpos.');

    await IndustryPreset.insertMany(presets);
    console.log(`✅ ${presets.length} Presets criados com sucesso:`);
    presets.forEach(p => console.log(`   - ${p.icon} ${p.name}`));

    mongoose.disconnect();
  })
  .catch(err => {
    console.error('💥 Erro de Conexão:', err);
    process.exit(1);
  });
