// Arquivo: backend/updateSchedulerConfig.js
require('dotenv').config();
const mongoose = require('mongoose');
const BusinessConfig = require('../models/BusinessConfig');

const mongoUri = process.env.MONGO_URI;

mongoose.connect(mongoUri)
  .then(async () => {
    console.log('🔌 Conectado para migração do Scheduler...');

    const config = await BusinessConfig.findOne({});

    if (config) {
      console.log('📝 Atualizando regras de Follow-up no Banco...');
      
      // Aqui inserimos a lógica que antes estava "chumbada" no código
      config.followUpSteps = [
        {
            stage: 1,
            delayMinutes: 30, // Ex: 30 min (ajustei para teste, antes era 1)
            message: "E aí, ficou alguma dúvida sobre o orçamento? Se quiser, posso te mandar alguns exemplos de artes nesse estilo! 🤘"
        },
        {
            stage: 2,
            delayMinutes: 120, // 2 horas depois do anterior
            message: "Oi! Só para não esquecer, nossa agenda para o próximo mês já está abrindo. Quer garantir seu horário?"
        },
        {
            stage: 3,
            delayMinutes: 1440, // 24 horas depois
            message: "Última chamada por aqui! Vou encerrar seu atendimento por enquanto, mas se decidir tatuar é só chamar. Abraço!"
        }
      ];

      await config.save();
      console.log('✅ Follow-ups migrados com sucesso!');
    } else {
      console.log('⚠️ Nenhuma configuração encontrada.');
    }

    mongoose.disconnect();
  })
  .catch(err => console.error(err));