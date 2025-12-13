const normalizePhone = (phone) => {
    return phone ? phone.replace(/\D/g, '') : '';
};

// --- TRADUTOR DO TWILIO (Mantido igual) ---
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
        mediaData: MediaUrl0 || null,
        provider: 'twilio',
        originalEvent: twilioBody
    };
};

// --- TRADUTOR DO WHATSAPP-WEB.JS (CORRIGIDO) ---
const adaptWWebJSMessage = async (msg) => {
    let name = 'Cliente';
    try {
        const contact = await msg.getContact();
        name = contact.pushname || contact.name || 'Cliente';
    } catch (e) { console.warn('Erro contato WWebJS'); }
    
    // LOG DE DIAGNÓSTICO (RAIO-X)
    console.log(`🔍 [ADAPTER] Msg recebida. Type: ${msg.type}, hasMedia: ${msg.hasMedia}`);

    let type = 'text';
    let mediaData = null;

    // Forçamos a verificação: Se o WWebJS diz que é imagem/audio OU tem a flag hasMedia
    const isMedia = msg.hasMedia || msg.type === 'image' || msg.type === 'ptt' || msg.type === 'audio';

    if (isMedia) {
        try {
            console.log('📥 Tentando baixar mídia do WWebJS...');
            const media = await msg.downloadMedia();
            
            if (media) {
                console.log(`✅ Mídia baixada! Mime: ${media.mimetype}, Tamanho: ${media.data.length} chars`);
                
                if (media.mimetype.startsWith('image/')) type = 'image';
                if (media.mimetype.startsWith('audio/')) type = 'audio';
                
                mediaData = {
                    mimetype: media.mimetype,
                    data: media.data,
                    filename: media.filename
                };
            } else {
                console.warn('⚠️ msg.downloadMedia() retornou null/undefined');
            }
        } catch (error) {
            console.error('❌ Erro FATAL ao baixar mídia:', error.message);
        }
    } else {
        // Se não é mídia, mantém o tipo original do texto
        type = 'text';
    }

    // SEGURANÇA FINAL: Se marcou como imagem mas não baixou nada, reverte para texto
    // Isso evita que o MessageHandler tente analisar 'null'
    if (type === 'image' && !mediaData) {
        console.warn('⚠️ Marcado como imagem mas sem dados. Revertendo para text.');
        type = 'text';
        msg.body = `${msg.body || ''} [Erro ao baixar imagem]`;
    }

    return {
        from: normalizePhone(msg.from),
        body: msg.body || '',
        name: name,
        type: type, // Aqui garantimos que só é 'image' se tiver mediaData
        mediaData: mediaData,
        provider: 'wwebjs',
        msgInstance: msg,
        originalEvent: msg
    };
};

module.exports = { adaptTwilioMessage, adaptWWebJSMessage };