const { GoogleGenAI } = require("@google/genai");
const axios = require('axios');

// Inicializa o Gemini
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// Função auxiliar para baixar imagem (Twilio)
async function downloadImage(mediaUrl) {
    console.log('🌐 Baixando imagem da URL (Twilio)...');
    try {
        const response = await axios({
            method: 'GET',
            url: mediaUrl,
            responseType: 'arraybuffer'
        });
        return {
            inlineData: {
                data: Buffer.from(response.data).toString('base64'),
                mimeType: response.headers['content-type']
            }
        };
    } catch (error) {
        console.error("❌ Erro ao baixar imagem URL:", error.message);
        throw new Error("Falha no download da imagem");
    }
}

/**
 * Analisa imagem vinda de URL (Twilio) ou Base64 (WWebJS)
 */
async function analyzeImage(mediaInput, customPrompt) {
    // 1. Log de Diagnóstico (Vital para entender o que chega)
    console.log("👁️ VisionService Iniciado. Tipo de input:", typeof mediaInput);
    if (typeof mediaInput === 'object') {
        console.log("📦 Dados recebidos:", { 
            temData: !!mediaInput.data, 
            mimetype: mediaInput.mimetype,
            tamanhoAprox: mediaInput.data ? mediaInput.data.length : 0 
        });
    }

    try {
        // CORREÇÃO PRINCIPAL: O modelo correto é gemini-1.5-flash
        const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview" });
        
        let imagePart;

        // 2. Verifica se é URL (Twilio) ou Objeto (WWebJS)
        if (typeof mediaInput === 'string' && mediaInput.startsWith('http')) {
            imagePart = await downloadImage(mediaInput);
        } else if (typeof mediaInput === 'object' && mediaInput.data) {
            // WWebJS já entrega em Base64
            // Importante: mimeType (camelCase) é o que o Google espera
            // mimetype (lowercase) é o que o WWebJS envia
            imagePart = {
                inlineData: {
                    data: mediaInput.data,
                    mimeType: mediaInput.mimetype || 'image/jpeg' 
                }
            };
        } else {
            console.error("❌ Formato de imagem desconhecido ou dados vazios:", mediaInput);
            return null;
        }

        // 3. Usa o prompt do banco ou um fallback
        const finalPrompt = customPrompt || "Descreva esta imagem com detalhes.";
        console.log("🚀 Enviando para API Gemini...");

        const result = await model.generateContent([finalPrompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        console.log("✅ Resposta Gemini Recebida (Preview):", text.substring(0, 30) + "...");
        return text;

    } catch (error) {
        console.error("💥 Erro CRÍTICO na visão do Gemini:", error);
        // Se for erro de API Key ou Cota, ele vai aparecer aqui agora
        return null; 
    }
}

module.exports = { analyzeImage };