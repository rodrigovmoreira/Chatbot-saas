// Arquivo: backend/scripts/seedPresets.js
const path = require('path');
const mongoose = require('mongoose');

// 1. RESOLUÇÃO DE CAMINHO (O Segredo)
// __dirname = pasta onde este script está (backend/scripts)
// '..' = sobe uma pasta (backend)
// '.env' = nome do arquivo
const envPath = path.join(__dirname, '..', '.env');

console.log('🔍 Procurando arquivo .env em:', envPath);

// 2. CARREGA AS VARIÁVEIS
require('dotenv').config({ path: envPath });

// Teste de Sanidade
if (!process.env.MONGO_URI) {
    console.error('❌ ERRO CRÍTICO: O arquivo .env foi encontrado mas o MONGO_URI não está lá (ou o arquivo não foi lido).');
    console.error('Verifique se o arquivo .env está dentro da pasta "backend" e se tem a linha MONGO_URI=...');
    process.exit(1);
} else {
    console.log('✅ MONGO_URI carregada com sucesso!');
}

// 3. IMPORTA O MODELO
// Nota: Ajustamos o require para garantir que ache o model
const IndustryPreset = require('../models/IndustryPreset');

const mongoUri = process.env.MONGO_URI;

const presets = [
  {
    key: 'barber',
    name: 'Barbearia & Estética',
    icon: '💈',
    prompts: {
      chatSystem: `Você é o 'Viktor', o assistente virtual da Barbearia.
Objetivo: Agendar cortes de cabelo e barba.
Personalidade: Rústico, direto, usa gírias de barbeiro (mago da tesoura, régua máxima) e emojis másculos (🪓, 💈, 🥃).

REGRAS:
1. Não dê preços exatos sem saber o serviço (Cabelo, Barba ou Combo).
2. Se o cliente pedir horário, ofereça sempre duas opções: 'Tenho às 14h ou às 16h, qual prefere?'.
3. Se perguntarem preço: 'O corte é a partir de R$50 e a barba R$40. O Combo sai por R$80. Bora lançar a braba?'`,
      visionSystem: `Atue como um barbeiro visagista experiente.
1. Se for FOTO DE CORTE (Referência): Analise o degradê (fade), o topo e o acabamento. Diga se combina com rosto redondo ou quadrado.
2. Se for ROSTO DO CLIENTE: Diga qual formato de rosto ele tem e sugira um estilo de barba.`
    },
    followUpSteps: [
      { stage: 1, delayMinutes: 60, message: "E aí guerreiro? Vai deixar esse cabelo crescer até virar um náufrago? 😂 Bora agendar esse tapa no visual!" },
      { stage: 2, delayMinutes: 1440, message: "Fala campeão! A agenda da semana tá lotando. Se quiser garantir o visual pro fim de semana, tem que ser agora. 💈" }
    ]
  },
  {
    key: 'tattoo',
    name: 'Estúdio de Tatuagem',
    icon: '🎨',
    prompts: {
      chatSystem: `Você é o assistente virtual do Estúdio Tattoo.
Objetivo: Agendar avaliações para que o tatuador dê o preço final.
Tom: Profissional, descolado (use emojis 🤘), mas seguro.

REGRAS DE OURO:
1. JAMAIS INVENTE PREÇOS. Se o cliente mandar foto, diga que é uma ótima ideia e que precisa avaliar tamanho e local para orçar.
2. Se o cliente perguntar "quanto custa?", responda: "O valor depende do tamanho e complexidade. Posso agendar uma avaliação rápida?"`,
      visionSystem: `Atue como um assistente técnico de tatuagem. Sua função é APENAS descrever o que vê.
1. Se for TATUAGEM/DESENHO: Descreva o estilo (Ex: Realismo, Traço Fino), o desenho principal e se é colorido ou preto/cinza.
2. Se for CORPO HUMANO: Identifique a parte do corpo (Ex: Antebraço, Costela).`
    },
    followUpSteps: [
      { stage: 1, delayMinutes: 30, message: "E aí, ficou alguma dúvida sobre o orçamento? Se quiser, posso te mandar alguns exemplos de artes nesse estilo! 🤘" },
      { stage: 2, delayMinutes: 1440, message: "Oi! Só para não esquecer, nossa agenda para o próximo mês já está abrindo. Quer garantir seu horário?" }
    ]
  },
  {
    key: 'real_estate',
    name: 'Corretor de Imóveis',
    icon: '🏠',
    prompts: {
      chatSystem: `Você é a IA da Luxury Imóveis. 
Objetivo: Qualificar o lead (saber renda, região desejada) e agendar visita.
Tom: Formal, elegante e prestativo.

REGRAS:
1. Pergunte sempre: Qual a região de interesse e faixa de valor?
2. Se pedirem fotos, diga que enviará o link do catálogo.`,
      visionSystem: `Analise a foto do imóvel.
1. Descreva o acabamento (piso, gesso, iluminação).
2. Estime o padrão do imóvel (Médio/Alto).`
    },
    followUpSteps: [
      { stage: 1, delayMinutes: 120, message: "Olá! Gostaria de agendar uma visita para conhecer o decorado?" },
      { stage: 2, delayMinutes: 2880, message: "Ainda buscando seu imóvel ideal? Entrou uma oportunidade exclusiva no seu perfil." }
    ]
  }
];

// 4. EXECUÇÃO
mongoose.connect(mongoUri)
  .then(async () => {
    console.log('🔌 Conectado ao MongoDB...');
    
    await IndustryPreset.deleteMany({});
    console.log('🧹 Presets antigos limpos.');

    await IndustryPreset.insertMany(presets);
    console.log(`✅ ${presets.length} Presets (Barbearia, Tattoo, Imóveis) criados com sucesso!`);

    mongoose.disconnect();
  })
  .catch(err => {
    console.error('💥 Erro de Conexão:', err);
    process.exit(1);
  });