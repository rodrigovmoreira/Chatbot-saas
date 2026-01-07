const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const BusinessConfig = require('../models/BusinessConfig');
const SystemUser = require('../models/SystemUser');
const axios = require('axios');

async function verifyRouting() {
  console.log('🧪 Iniciando Verificação de Roteamento de Webhook...');

  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI não definida.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado ao MongoDB');

    // Criar Usuário Dummy (necessário para BusinessConfig)
    let user = await SystemUser.findOne({ email: 'test_webhook@example.com' });
    if (!user) {
        user = await SystemUser.create({
            email: 'test_webhook@example.com',
            password: 'password123',
            name: 'Webhook Tester'
        });
    }

    // Criar BusinessConfig 1 (Alvo Específico)
    const phone1 = '+5511999990001';
    let businessA = await BusinessConfig.findOne({ phoneNumber: phone1 });
    if (!businessA) {
        businessA = await BusinessConfig.create({
            userId: user._id,
            businessName: 'Business A (Specific)',
            phoneNumber: phone1,
            whatsappProvider: 'twilio'
        });
    }
    console.log(`🏢 Business A criado/encontrado: ${businessA._id} (Phone: ${phone1})`);

    // Criar BusinessConfig 2 (Outro)
    const phone2 = '+5511999990002';
    let businessB = await BusinessConfig.findOne({ phoneNumber: phone2 });
    if (!businessB) {
        businessB = await BusinessConfig.create({
            userId: user._id,
            businessName: 'Business B (Other)',
            phoneNumber: phone2,
            whatsappProvider: 'twilio'
        });
    }
    console.log(`🏢 Business B criado/encontrado: ${businessB._id} (Phone: ${phone2})`);

    // Esperar um pouco para garantir consistência
    await new Promise(r => setTimeout(r, 1000));

    // Teste 1: Enviar Webhook direcionado ao Business A
    console.log('\n📡 Enviando Webhook para Business A...');
    try {
        await axios.post('http://localhost:3001/api/webhook', {
            To: `whatsapp:${phone1}`,
            From: 'whatsapp:+5511988888888',
            Body: 'Teste Roteamento A',
            NumMedia: '0'
        });
        console.log('✅ Request enviado.');
    } catch (e) {
        console.error('❌ Falha no request:', e.message);
    }

    // Teste 2: Enviar Webhook direcionado ao Business B
    console.log('\n📡 Enviando Webhook para Business B...');
    try {
        await axios.post('http://localhost:3001/api/webhook', {
            To: `whatsapp:${phone2}`,
            From: 'whatsapp:+5511988888888',
            Body: 'Teste Roteamento B',
            NumMedia: '0'
        });
        console.log('✅ Request enviado.');
    } catch (e) {
        console.error('❌ Falha no request:', e.message);
    }

    // Teste 3: Enviar Webhook sem destino conhecido (Fallback)
    console.log('\n📡 Enviando Webhook Desconhecido (Fallback)...');
    try {
        await axios.post('http://localhost:3001/api/webhook', {
            To: `whatsapp:+5511000000000`, // Número inexistente
            From: 'whatsapp:+5511988888888',
            Body: 'Teste Fallback',
            NumMedia: '0'
        });
        console.log('✅ Request enviado.');
    } catch (e) {
        console.error('❌ Falha no request:', e.message);
    }

    console.log('\n⚠️ VERIFIQUE OS LOGS DO SERVIDOR PARA CONFIRMAR O ROTEAMENTO (Procure por "🎯 Webhook roteado..." ou "⚠️ Webhook: Fallback...")');

    // Cleanup
    await BusinessConfig.deleteOne({ _id: businessA._id });
    await BusinessConfig.deleteOne({ _id: businessB._id });
    await SystemUser.deleteOne({ _id: user._id });

    console.log('🧹 Limpeza concluída.');
    await mongoose.connection.close();

  } catch (error) {
    console.error('💥 Erro no script:', error);
    process.exit(1);
  }
}

verifyRouting();
