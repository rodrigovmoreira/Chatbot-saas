const { GoogleGenAI } = require("@google/genai");
const axios = require('axios');

// Inicializa o Gemini
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// Baixa a imagem do Twilio e converte para Base64
async function downloadImage(mediaUrl) {
    try {
        const response = await axios({
            method: 'GET',
            url: mediaUrl,
            responseType: 'arraybuffer',
            // Importante: Se o seu Twilio exige Auth para mídia, descomente abaixo:
            auth: {
                username: process.env.TWILIO_ACCOUNT_SID,
                password: process.env.TWILIO_AUTH_TOKEN
            }
        });

        return {
            inlineData: {
                data: Buffer.from(response.data).toString('base64'),
                mimeType: response.headers['content-type']
            }
        };
    } catch (error) {
        console.error("Erro ao baixar imagem do Twilio:", error);
        throw new Error("Falha no download da imagem");
    }
}

//Envia a imagem para o Gemini e retorna a descrição
async function analyzeImage(mediaUrl) {
    try {
        // 1. Usa o modelo Flash (mais rápido e barato)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // 2. Prepara a imagem
        const imagePart = await downloadImage(mediaUrl);

        // 3. Prompt específico para "traduzir" a imagem para o DeepSeek
        const prompt = "Descreva esta imagem em detalhes extremos para que um modelo de IA de texto possa entendê-la. Se houver texto, transcreva-o. Se houver objetos, descreva cor, posição e estado.";

        // 4. Gera o conteúdo
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;

        return response.text();
    } catch (error) {
        console.error("Erro na visão do Gemini:", error);
        return " [Erro: Não foi possível analisar a imagem enviada]";
    }
}

module.exports = { analyzeImage };