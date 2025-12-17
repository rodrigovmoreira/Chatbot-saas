// Arquivo: backend/fixIndexes.js
require('dotenv').config();
const mongoose = require('mongoose');
const Contact = require('../models/Contact'); // Certifique-se do caminho

const mongoUri = process.env.MONGO_URI;

mongoose.connect(mongoUri)
  .then(async () => {
    console.log('🔌 Conectado para corrigir índices...');

    const collection = mongoose.connection.collection('contacts');

    try {
        // 1. Listar índices atuais para ver o problema
        const indexes = await collection.indexes();
        console.log('📋 Índices Atuais:', indexes.map(i => i.name));

        // 2. Apagar o índice problemático (phone_1)
        // Se ele existir, vamos derrubar
        if (indexes.find(i => i.name === 'phone_1')) {
            console.log('🔥 Apagando índice antigo "phone_1"...');
            await collection.dropIndex('phone_1');
            console.log('✅ Índice antigo removido.');
        }

        // 3. Forçar o Mongoose a criar o novo índice composto
        // (businessId: 1, phone: 1)
        console.log('🏗️ Sincronizando novos índices do Schema...');
        await Contact.syncIndexes();
        
        console.log('✨ Tudo limpo! O banco agora aceita o mesmo telefone em empresas diferentes.');

    } catch (error) {
        console.error('💥 Erro ao manipular índices:', error.message);
    }

    mongoose.disconnect();
  })
  .catch(err => console.error(err));