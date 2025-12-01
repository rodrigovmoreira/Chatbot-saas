const { saveMessage, getLastMessages } = require('./services/message');
const { generateAIResponse } = require('./services/ai'); 
const { analyzeImage } = require('./services/visionService');
const { sendWhatsAppMessage } = require('./services/twilioService');
const BusinessConfig = require('./models/BusinessConfig');

const MAX_HISTORY = 15;

const normalizePhone = (twilioPhone) => {
  return twilioPhone? twilioPhone.replace('whatsapp:', '') : '';
};

async function getMVPConfig() {
  try {
    const config = await BusinessConfig.findOne({});
    if (config) return config;
    console.error('⚠️ NENHUMA CONFIGURAÇÃO ENCONTRADA NO BANCO!');
    return null;
  } catch (error) {
    console.error('💥 Erro ao buscar configuração:', error);
    return null;
  }
}

function isWithinOperatingHours(businessConfig) {
  if (businessConfig.operatingHours && businessConfig.operatingHours.active === false) {
    return false;
  }
  if (!businessConfig.operatingHours ||!businessConfig.operatingHours.opening) return true;

  const now = new Date();
  const hours = now.getUTCHours() - 3; 
  const currentHour = hours < 0? hours + 24 : hours;
  const [openH] = businessConfig.operatingHours.opening.split(':').map(Number);
  const [closeH] = businessConfig.operatingHours.closing.split(':').map(Number);

  return currentHour >= openH && currentHour < closeH;
}

// ==========================================
// 🚀 HANDLER PRINCIPAL ATUALIZADO
// ==========================================
async function handleTwilioMessage(twilioData) {
  const { Body, From, ProfileName, NumMedia, MediaUrl0 } = twilioData;

  // Ignora se não tem nada (nem texto nem imagem)
  if (!Body && (!NumMedia || NumMedia === '0')) return;

  const userPhone = normalizePhone(From);
  let userMessage = Body? Body.trim() : ""; // Começa com o texto ou vazio

  console.log(`📩 De: ${ProfileName || userPhone} | Txt: "${userMessage}" | Mídia: ${NumMedia}`);

  try {
    // 1. LÓGICA DE VISÃO
    if (parseInt(NumMedia) > 0 && MediaUrl0) {
        console.log(`📸 Imagem detectada. Analisando...`);
        // Opcional: Feedback visual de "processando"
        // await sendWhatsAppMessage(From, "👀 Analisando sua imagem...");

        const imageDescription = await analyzeImage(MediaUrl0);

        if (imageDescription) {
            // Sucesso: Adiciona a descrição ao texto
            console.log("✅ Descrição Gemini:", imageDescription.substring(0, 50) + "...");
            userMessage = `${userMessage}\n\n: ${imageDescription}`.trim();
        } else {
            // Falha na IA de Visão:
            console.log("⚠️ Falha na análise da imagem.");
            // Se o usuário mandou SÓ imagem e a análise falhou, precisamos avisar a IA ou o usuário
            if (!userMessage) {
                userMessage = "[O cliente enviou uma imagem, mas não consegui visualizá-la por um erro técnico. Peça para ele descrever ou reenviar.]";
            }
        }
    }

    // 2. Se depois de tudo a mensagem ainda estiver vazia (ex: erro na imagem e sem legenda), aborta
    if (!userMessage) return;

    // 3. Carregar Configuração
    const businessConfig = await getMVPConfig();
    if (!businessConfig) return;

    // 4. Verificar Horário
    if (!isWithinOperatingHours(businessConfig)) {
      await sendWhatsAppMessage(From, businessConfig.awayMessage);
      return;
    }

    // 5. Salvar Mensagem (Com a descrição da imagem se houver)
    await saveMessage(userPhone, 'user', userMessage);

    // 6. Histórico e Prompt
    const history = await getLastMessages(userPhone, MAX_HISTORY);
    const historyText = history
    .reverse()
    .map(m => `${m.role === 'user'? 'Cliente' : 'Tatuador'}: ${m.content}`)
    .join('\n');

    const finalSystemPrompt = `
${businessConfig.systemPrompt}
---
DADOS DO SISTEMA:
Nome do Cliente: ${ProfileName || 'Cliente'}
Histórico:
${historyText}
---
`;

    // 7. Gerar Resposta IA
    const aiResponse = await generateAIResponse(userMessage, finalSystemPrompt);

    // 8. Enviar e Salvar Resposta
    if (aiResponse) {
      console.log(`🤖 Resposta enviada para ${userPhone}`);
      await sendWhatsAppMessage(From, aiResponse);
      await saveMessage(userPhone, 'bot', aiResponse);
    } else {
      console.error("❌ DeepSeek retornou vazio");
    }

  } catch (error) {
    console.error('💥 Erro fatal no handleTwilioMessage:', error);
  }
}

module.exports = { handleTwilioMessage };