const Appointment = require('../models/Appointment');
const BusinessConfig = require('../models/BusinessConfig');
const { toZonedTime, fromZonedTime } = require('date-fns-tz');

// 1. FERRAMENTA: Verificar Disponibilidade
// Verifica se um horário específico está livre
const checkAvailability = async (userId, start, end) => {
    try {
        const startTime = new Date(start);
        const endTime = new Date(end);
        const now = new Date();

        // 0. Verifica Antecedência Mínima (Buffer)
        const config = await BusinessConfig.findOne({ userId });

        if (config) {
            const bufferMinutes = config.minSchedulingNoticeMinutes || 60;
            const minStart = new Date(now.getTime() + bufferMinutes * 60000);

            if (startTime < minStart) {
                return {
                    available: false,
                    reason: `Necessário agendar com no mínimo ${bufferMinutes} minutos de antecedência.`
                };
            }
        }

        // 1. Verifica horário de funcionamento (COM TIMEZONE)
        if (config && config.operatingHours) {
            const timeZone = config.timezone || config.operatingHours.timezone || 'America/Sao_Paulo';

            // Converte o startTime (que é UTC no objeto Date, mas queremos saber a hora LOCAL do negócio)
            const zonedStart = toZonedTime(startTime, timeZone);

            const openHour = parseInt(config.operatingHours.opening.split(':')[0]);
            const closeHour = parseInt(config.operatingHours.closing.split(':')[0]);
            
            const reqHour = zonedStart.getHours();

            // Validação simples de hora cheia. Para minutos, seria necessário mais detalhe.
            if (reqHour < openHour || reqHour >= closeHour) {
                return { available: false, reason: "Fora do horário de funcionamento." };
            }
        }

        // 2. Verifica conflitos na agenda
        const conflito = await Appointment.findOne({
            userId,
            status: { $in: ['scheduled', 'confirmed'] },
            $or: [
                { start: { $lt: endTime, $gte: startTime } },
                { end: { $gt: startTime, $lte: endTime } }
            ]
        });

        if (conflito) {
            return { available: false, reason: "Horário já ocupado." };
        }

        return { available: true };
    } catch (error) {
        console.error("Erro ao checar disponibilidade:", error);
        return { available: false, reason: "Erro interno." };
    }
};

// 2. FERRAMENTA: Criar Agendamento (Usado pela IA)
const createAppointmentByAI = async (userId, data) => {
    try {
        // data deve conter: { clientName, clientPhone, start, end, title }
        
        // start e end já devem chegar aqui como objetos Date (UTC) ou strings ISO corretas

        // Dupla checagem de disponibilidade
        const check = await checkAvailability(userId, data.start, data.end);
        if (!check.available) return { success: false, message: check.reason };

        const newAppt = await Appointment.create({
            userId,
            ...data,
            type: 'servico', // Padrão
            status: 'scheduled'
        });

        return { success: true, data: newAppt };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// 3. FERRAMENTA: Listar Horários Livres (Sugestão Inteligente)
// Retorna lista de horários livres no dia solicitado
const getFreeSlots = async (userId, dateStr) => {
    // Implementação simplificada: Verifica hora em hora das 09:00 as 18:00
    // No futuro, pegar do BusinessConfig
    const slots = [];
    const baseDate = new Date(dateStr); // Data que o cliente quer (ex: "2023-10-25")
    
    // Simulação: Horário comercial 9h as 18h
    for (let hour = 9; hour < 18; hour++) {
        const slotStart = new Date(baseDate);
        slotStart.setHours(hour, 0, 0, 0);
        
        const slotEnd = new Date(baseDate);
        slotEnd.setHours(hour + 1, 0, 0, 0);

        const check = await checkAvailability(userId, slotStart, slotEnd);
        if (check.available) {
            slots.push(`${hour}:00`);
        }
    }
    return slots;
};

// 4. FERRAMENTA: Buscar Produtos (Novo - Changelog 3)
const searchProducts = async (userId, keywords = []) => {
    try {
        const config = await BusinessConfig.findOne({ userId });
        if (!config || !config.products) return [];

        // Normaliza keywords para lowercase e trim
        const searchTerms = keywords.map(k => k.trim().toLowerCase()).filter(k => k.length > 0);

        if (searchTerms.length === 0) return [];

        // Filtra os produtos com Fuzzy Match (parcial)
        const results = config.products.filter(p => {
            const productName = p.name.trim().toLowerCase();
            const productTags = (p.tags || []).map(t => t.trim().toLowerCase());

            // Verifica se algum termo de busca está contido no nome OU nas tags
            return searchTerms.some(term => {
                const inName = productName.includes(term);
                const inTags = productTags.some(tag => tag.includes(term));
                return inName || inTags;
            });
        });

        // Retorna formato simplificado
        return results.map(p => ({
            name: p.name,
            price: p.price,
            description: p.description,
            imageUrls: p.imageUrls || []
        }));
    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        return [];
    }
};

module.exports = {
    checkAvailability,
    createAppointmentByAI,
    getFreeSlots,
    searchProducts
};