/**
 * PADRONIZADOR DE MENSAGENS (ADAPTER PATTERN)
 * Objetivo: Transformar qualquer input (Twilio/WWebJS) em um objeto padrão.
 * * Formato Padrão de Saída:
 * {
 * from: '5511999999999', // Apenas números
 * body: 'Texto da mensagem',
 * name: 'Nome do Usuário',
 * type: 'text' | 'image' | 'audio',
 * mediaUrl: 'url_ou_base64' (opcional),
 * provider: 'twilio' | 'wwebjs',
 * originalEvent: (objeto original para debug)
 * }
 */

const normalizePhone = (phone) => {
    return phone ? phone.replace(/\D/g, '') : '';
};

// --- TRADUTOR DO TWILIO ---
const adaptTwilioMessage = (twilioBody) => {
    const { Body, From, ProfileName, NumMedia, MediaUrl0, MediaContentType0 } = twilioBody;

    let type = 'text';
    if (parseInt(NumMedia) > 0) {
        if (MediaContentType0 && MediaContentType0.startsWith('image/')) type = 'image';
        else if (MediaContentType0 && MediaContentType0.startsWith('audio/')) type = 'audio';
    }

    return {
        from: normalizePhone(From),
        body: Body || '',
        name: ProfileName || 'Cliente',
        type: type,
        mediaUrl: MediaUrl0 || null,
        provider: 'twilio',
        originalEvent: twilioBody
    };
};

// --- TRADUTOR DO WHATSAPP-WEB.JS ---
const adaptWWebJSMessage = async (msg) => {
    const contact = await msg.getContact();
    const chat = await msg.getChat();
    
    let type = 'text';
    let mediaData = null;

    if (msg.hasMedia) {
        // Nota: O download de mídia do WWebJS é pesado, faremos sob demanda no futuro.
        // Por enquanto, marcamos que é imagem.
        if (msg.type === 'image') type = 'image';
        if (msg.type === 'ptt' || msg.type === 'audio') type = 'audio';
    }

    return {
        from: normalizePhone(msg.from), // WWebJS manda '551199...@c.us'
        body: msg.body || '',
        name: contact.pushname || contact.name || 'Cliente',
        type: type,
        mediaUrl: null, // WWebJS não dá URL pública, precisamos tratar diferente depois
        isWWebJSMedia: msg.hasMedia, // Flag para o handler saber que precisa baixar a mídia
        msgInstance: msg, // Passamos a instância original para poder responder/baixar mídia
        provider: 'wwebjs',
        originalEvent: msg
    };
};

module.exports = { adaptTwilioMessage, adaptWWebJSMessage };