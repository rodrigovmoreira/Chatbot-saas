// ATENÇÃO: Usando a sintaxe da biblioteca nova @google/genai (v0.1.0+)
const { GoogleGenAI } = require("@google/genai");
const axios = require('axios');

// Inicializa o cliente com a chave de API
// O exemplo que você mandou usa new GoogleGenAI({}), assumindo que a chave vem do ambiente ou config
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Função auxiliar para baixar imagem (Twilio)
async function downloadImage(mediaUrl) {
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
 * Analisa imagem usando a SDK @google/genai (Nova)
 */
async function analyzeImage(mediaInput, customPrompt) {
    try {
        let imagePart;

        // 1. Prepara o objeto da imagem (inlineData)
        if (typeof mediaInput === 'string' && mediaInput.startsWith('http')) {
            imagePart = await downloadImage(mediaInput);
        } else if (typeof mediaInput === 'object' && mediaInput.data) {
            // WWebJS (Base64)
            imagePart = {
                inlineData: {
                    data: mediaInput.data,
                    mimeType: mediaInput.mimetype || 'image/jpeg' 
                }
            };
        } else {
            console.error("❌ Formato inválido:", mediaInput);
            return null;
        }

        // 2. Monta o array 'contents' conforme a nova documentação
        const promptText = customPrompt || "Descreva esta imagem.";
        
        const contents = [
            imagePart,           // A imagem entra como um objeto do array
            { text: promptText } // O texto entra como outro objeto
        ];

        // 3. Chamada Correta para a SDK @google/genai
        const response = await genAI.models.generateContent({
            model: "gemini-2.5-flash", // Ou "gemini-2.0-flash-exp" se tiver acesso
            contents: contents,
            config: {
                temperature: 0.4 // Opcional: reduz alucinações
            }
        });

        // Na nova SDK, o texto costuma vir direto em response.text (propriedade) ou response.text()
        // O seu exemplo mostra console.log(response.text), então vamos assumir propriedade.
        // Por segurança, verificamos se é função ou propriedade.
        const finalText = typeof response.text === 'function' ? response.text() : response.text;

        return finalText;

    } catch (error) {
        console.error("💥 Erro CRÍTICO na visão do Gemini:", error);
        return null; 
    }
}

module.exports = { analyzeImage };