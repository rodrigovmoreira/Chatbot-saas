// Arquivo: backend/fixConfig.js
require('dotenv').config();
const mongoose = require('mongoose');
const BusinessConfig = require('../models/BusinessConfig');

const mongoUri = process.env.MONGO_URI;

// O ID que você me passou no JSON
const TARGET_ID = "6903988744cb619ce7aeb082";

mongoose.connect(mongoUri)
  .then(async () => {
    console.log('🔌 Conectado para correção...');

    // Define os passos de Follow-up (Regra do Tatuador)
    const newFollowUpSteps = [
        {
            stage: 1,
            delayMinutes: 60, 
            message: "E aí, ficou alguma dúvida sobre o orçamento? Se quiser, posso te mandar alguns exemplos de artes nesse estilo! 🤘"
        },
        {
            stage: 2,
            delayMinutes: 1440, // 24h
            message: "Oi! Só para não esquecer, nossa agenda para o próximo mês já está abrindo. Quer garantir seu horário?"
        }
    ];

    // Atualiza o documento específico
    const result = await BusinessConfig.findByIdAndUpdate(
        TARGET_ID,
        {
            // 1. ADICIONA/ATUALIZA O SCHEDULER
            $set: { 
                followUpSteps: newFollowUpSteps,
                whatsappProvider: 'wwebjs' // Garante que o provedor está certo
            },
            
            // 2. REMOVE CAMPOS VELHOS (Limpeza)
            // O 'systemPrompt' antigo sai porque agora usamos 'prompts.chatSystem'
            $unset: { 
                systemPrompt: "", 
                welcomeMessage: "",
                menuOptions: "",
                paymentMethods: "",
                deliveryOptions: "",
                products: ""
            }
        },
        { new: true } // Retorna o documento atualizado para conferência
    );

    if (result) {
        console.log('✅ Configuração corrigida com sucesso!');
        console.log('--- Novo JSON (Resumido) ---');
        console.log(`ID: ${result._id}`);
        console.log(`Steps configurados: ${result.followUpSteps.length}`);
        console.log(`Prompt Chat: ${result.prompts.chatSystem.substring(0, 50)}...`);
    } else {
        console.error('❌ Documento não encontrado com esse ID.');
    }

    mongoose.disconnect();
  })
  .catch(err => console.error('Erro:', err));