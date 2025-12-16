// Arquivo: backend/migrateContacts.js
require('dotenv').config();
const mongoose = require('mongoose');
const Contact = require('../models/Contact');
const BusinessConfig = require('../models/BusinessConfig');

const mongoUri = process.env.MONGO_URI;

mongoose.connect(mongoUri).then(async () => {
    console.log('🔌 Conectado para migração...');

    // 1. Pega a sua empresa (assumindo que só tem uma por enquanto)
    const myBusiness = await BusinessConfig.findOne({});
    
    if (!myBusiness) {
        console.error("❌ Nenhuma empresa encontrada em BusinessConfigs. Crie uma primeiro.");
        process.exit(1);
    }

    console.log(`🏢 Vinculando contatos à empresa: ${myBusiness.businessName} (ID: ${myBusiness._id})`);

    // 2. Atualiza todos os contatos que não tem businessId
    const result = await Contact.updateMany(
        { businessId: { $exists: false } }, // Filtro
        { $set: { businessId: myBusiness._id } } // Ação
    );

    console.log(`✅ Resultado: ${result.modifiedCount} contatos migrados.`);
    
    mongoose.disconnect();
}).catch(err => console.error(err));