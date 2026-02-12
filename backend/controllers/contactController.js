const Contact = require('../models/Contact');
const BusinessConfig = require('../models/BusinessConfig');
const Tag = require('../models/Tag'); // Kept if needed for future expansions
const wwebjsService = require('../services/wwebjsService');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Helper to get Business ID
const getBusinessId = async (userId) => {
    const config = await BusinessConfig.findOne({ userId });
    return config ? config._id : null;
};

// --- 1. CORE CRUD OPERATIONS (Refactored from Routes) ---

const getContacts = async (req, res) => {
    try {
        const businessId = await getBusinessId(req.user.userId);
        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        const contacts = await Contact.find({ businessId }).sort({ lastInteraction: -1 });
        res.json(contacts);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ message: 'Error fetching contacts' });
    }
};

const getContact = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = await getBusinessId(req.user.userId);

        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        const contact = await Contact.findOne({ _id: id, businessId });
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }

        res.json(contact);
    } catch (error) {
        console.error('Error fetching contact:', error);
        res.status(500).json({ message: 'Error fetching contact' });
    }
};

const updateContact = async (req, res) => {
    try {
        const { id } = req.params;
        const { tags, name, isHandover, funnelStage, dealValue, notes } = req.body;

        const businessId = await getBusinessId(req.user.userId);
        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        const contact = await Contact.findOne({ _id: id, businessId });
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }

        if (tags !== undefined) contact.tags = tags;
        if (name !== undefined) contact.name = name;
        if (isHandover !== undefined) contact.isHandover = isHandover;
        if (funnelStage !== undefined) contact.funnelStage = funnelStage;
        if (dealValue !== undefined) contact.dealValue = Number(dealValue);
        if (notes !== undefined) contact.notes = notes;

        await contact.save();
        res.json(contact);
    } catch (error) {
        console.error('Error updating contact:', error);
        res.status(500).json({ message: 'Error updating contact' });
    }
};

// --- 2. CSV IMPORT (Moved from Routes) ---

const importContacts = async (req, res) => {
    try {
        const businessId = await getBusinessId(req.user.userId);
        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const stats = { imported: 0, updated: 0, failed: 0 };
        let rows = [];

        // Parse File
        if (req.file.mimetype.includes('csv') || req.file.originalname.endsWith('.csv')) {
            await new Promise((resolve, reject) => {
                const stream = Readable.from(req.file.buffer);
                stream
                    .pipe(csv())
                    .on('data', (data) => rows.push(data))
                    .on('end', resolve)
                    .on('error', reject);
            });
        } else {
             // XLSX
             const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
             const sheetName = workbook.SheetNames[0];
             const sheet = workbook.Sheets[sheetName];
             rows = xlsx.utils.sheet_to_json(sheet);
        }

        // Process Rows
        for (const row of rows) {
             const getField = (r, key) => r[key] || r[key.toLowerCase()] || r[key.toUpperCase()];

             let phone = getField(row, 'phone') || getField(row, 'Phone') || getField(row, 'telefone') || getField(row, 'Celular');
             const name = getField(row, 'name') || getField(row, 'Name') || getField(row, 'nome');
             const email = getField(row, 'email') || getField(row, 'Email');
             const tagsRaw = getField(row, 'tags') || getField(row, 'Tags');

             if (!phone) {
                 stats.failed++;
                 continue;
             }

             phone = String(phone).replace(/\D/g, '');

             if (phone.length < 8) {
                 stats.failed++;
                 continue;
             }

             let contact = await Contact.findOne({ businessId, phone });

             if (contact) {
                 if (name) contact.name = name;
                 if (email) contact.email = email;
                 if (tagsRaw) {
                     const newTags = String(tagsRaw).split(',').map(t => t.trim()).filter(t => t);
                     contact.tags = [...new Set([...contact.tags, ...newTags])];
                 }
                 await contact.save();
                 stats.updated++;
             } else {
                 const tags = tagsRaw ? String(tagsRaw).split(',').map(t => t.trim()).filter(t => t) : [];
                 await Contact.create({
                     businessId,
                     phone,
                     name: name || 'Desconhecido',
                     email,
                     tags,
                     channel: 'whatsapp',
                     followUpStage: 0,
                     dealValue: 0,
                     funnelStage: 'new'
                 });
                 stats.imported++;
             }
        }

        res.json(stats);

    } catch (error) {
        console.error('Error importing contacts:', error);
        res.status(500).json({ message: 'Error processing import file' });
    }
};

// --- 3. WHATSAPP SYNC (New Feature) ---

const syncContacts = async (req, res) => {
    try {
        const { userId } = req.user;
        const client = wwebjsService.getClientSession(userId);

        if (!client || !client.info) {
             return res.status(503).json({ message: 'WhatsApp não está pronto. Aguarde.' });
        }

        // 1. Fetch Chats (Wrap in try/catch to handle Puppeteer errors)
        let chats = [];
        try {
            chats = await client.getChats();
        } catch (e) {
            console.error("Puppeteer getChats failed:", e);
            return res.status(500).json({ message: 'Erro de comunicação com o WhatsApp. Tente reiniciar a conexão.' });
        }

        // 2. FILTER & SORT: Top 15 Recent Active Chats Only
        // Sort descending by timestamp (newest first)
        const recentChats = chats
            .filter(chat => !chat.isGroup && !chat.id.user.includes('newsletter') && !chat.id.user.includes('status'))
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 15); // Strict limit

        const config = await BusinessConfig.findOne({ userId });
        if (!config) {
             return res.status(404).json({ message: 'Business configuration not found' });
        }
        const businessId = config._id;

        let imported = 0;
        console.log(`🔄 Syncing top ${recentChats.length} chats (Text Only)...`);

        for (const chat of recentChats) {
            try {
                // LIGHTWEIGHT SYNC: NO Profile Pic fetch
                // We rely on data already present in the Chat object or lightweight Contact fetch
                const contact = await chat.getContact();

                const phone = chat.id.user;
                // Use existing name or format number
                // Fallback name logic: Saved Name -> Pushname -> Number
                let name = contact.name || contact.pushname || contact.number || `Client ${phone.slice(-4)}`;

                // Clean name if it's just the number
                if (name && name.replace(/\D/g,'') === chat.id.user) {
                     if (contact.pushname) name = contact.pushname;
                }

                await Contact.findOneAndUpdate(
                    { businessId, phone },
                    {
                        $set: {
                            name: name || 'Desconhecido',
                            pushname: contact.pushname, // Save pushname if available
                            isGroup: false,
                            lastInteraction: new Date(chat.timestamp * 1000),
                            // profilePicUrl: null // Don't overwrite if exists, just skip fetching
                        },
                        $setOnInsert: {
                            channel: 'whatsapp',
                            followUpStage: 0,
                            dealValue: 0,
                            funnelStage: 'new',
                            profilePicUrl: null, // Default for new
                            totalMessages: chat.unreadCount || 0
                        }
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                imported++;
            } catch (err) {
                console.warn(`Skipped ${chat.id.user}: ${err.message}`);
            }
        }

        res.json({
            message: 'Sincronização Rápida Concluída (Top 15)',
            totalFound: chats.length,
            imported: imported
        });

    } catch (error) {
        console.error('Critical Sync Error:', error);
        res.status(500).json({ message: 'Falha crítica na sincronização.' });
    }
};

module.exports = {
    getContacts,
    getContact,
    updateContact,
    importContacts,
    syncContacts
};
