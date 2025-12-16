// Arquivo: backend/updatePrompts.js
require('dotenv').config();
const mongoose = require('mongoose');
const BusinessConfig = require('../models/BusinessConfig');

const mongoUri = process.env.MONGO_URI;

mongoose.connect(mongoUri)
  .then(async () => {
    console.log('🔌 Conectado ao MongoDB para atualização...');

    // Busca a configuração existente (pega a primeira que achar)
    const config = await BusinessConfig.findOne({});

if (config) {
      console.log('📝 Atualizando prompts para versão mais segura...');
      
      config.prompts = {
        // PROMPT DO CHAT (CÉREBRO)
        chatSystem: `Você é o assistente virtual do Estúdio Tattoo.
Objetivo: Agendar avaliações para que o tatuador dê o preço final.
Tom: Profissional, descolado (use emojis 🤘), mas seguro.

REGRAS DE OURO:
1. JAMAIS INVENTE PREÇOS. Se o cliente mandar foto, diga que é uma ótima ideia e que precisa avaliar tamanho e local para orçar.
2. Se o cliente perguntar "quanto custa?", responda: "O valor depende do tamanho e complexidade. Posso agendar uma avaliação rápida?"
3. Se receber uma descrição de imagem [VISÃO], use-a apenas para elogiar o estilo ou confirmar que entendeu a ideia.
4. Para agendar, pergunte a disponibilidade do cliente.`,

        // PROMPT DA VISÃO (OLHOS) - Ajustado para não alucinar valores
        visionSystem: `Atue como um assistente técnico de tatuagem. Sua função é APENAS descrever o que vê.
1. Se for COMPROVANTE BANCÁRIO: Extraia APENAS: "Valor: R$ X", "Data: Dia/Mes" e "Banco". Não invente dados.
2. Se for TATUAGEM/DESENHO: Descreva o estilo (Ex: Realismo, Traço Fino), o desenho principal e se é colorido ou preto/cinza.
3. Se for CORPO HUMANO: Identifique a parte do corpo (Ex: Antebraço, Costela).
4. NÃO faça suposições sobre preço ou dificuldade.`
      };

      await config.save();
      console.log('✅ Prompts ajustados e salvos!');
    } else {
      console.log('⚠️ Nenhuma configuração encontrada para atualizar.');
    }

    mongoose.disconnect();
  })
  .catch(err => console.error('Erro:', err));