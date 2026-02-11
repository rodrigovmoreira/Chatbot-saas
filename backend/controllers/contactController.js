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
        const userId = req.user.userId;
        const config = await BusinessConfig.findOne({ userId });

        if (!config) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        const businessId = config._id;
        const client = wwebjsService.getClientSession(userId);

        if (!client || !client.info) {
             return res.status(503).json({ message: 'WhatsApp session not ready or disconnected.' });
        }

        // Fetch Chats
        const chats = await client.getChats();

        const stats = { totalChatsFound: chats.length, contactsImported: 0, groupsIgnored: 0 };

        for (const chat of chats) {
            // 🛡️ IRON GATE: Filter out Groups, Channels, Newsletters, and System Users
            if (chat.isGroup ||
                chat.id.user === 'status' ||
                chat.id.user === '0' ||
                chat.id.user.includes('newsletter') ||
                chat.id._serialized.includes('@newsletter') ||
                chat.id.user.length > 15
            ) {
                stats.groupsIgnored++;
                continue;
            }

            // 2. Data Enrichment
            let contact = null;
            try {
                contact = await chat.getContact();
            } catch (e) {
                console.warn(`Failed to get contact info for chat ${chat.id._serialized}`, e.message);
            }

            // Name Priority: Saved Name -> Pushname -> Number
            let name = contact?.name || contact?.pushname || contact?.number || chat.name;
            // Clean name if it's just the number
            if (name && name.replace(/\D/g,'') === chat.id.user) {
                // If name is just the number, try to use pushname if distinct, else keep it.
                if (contact?.pushname) name = contact.pushname;
            }

            let profilePicUrl = null;
            try {
                if (contact) {
                    profilePicUrl = await contact.getProfilePicUrl();
                }
            } catch (e) {
                // Profile pic might fail if privacy settings block it or 404
                // console.warn(`No profile pic for ${chat.id.user}`);
            }

            // 3. Database Upsert
            const phone = chat.id.user; // Pure number part for @c.us

            const updateData = {
                name: name || 'Desconhecido',
                isGroup: false,
                lastInteraction: new Date(chat.timestamp * 1000),
                // Only update pushname/profilePic if we have them, don't overwrite with null if existing?
                // Actually, if they removed it, we might want to remove it too.
                // But let's be safe and only set if truthy or explicitly handle it.
                // The prompt says "Fields to Update: name, profilePicUrl, pushname".
            };

            if (profilePicUrl) updateData.profilePicUrl = profilePicUrl;
            if (contact?.pushname) updateData.pushname = contact.pushname;

            // Use findOneAndUpdate with Upsert
            await Contact.findOneAndUpdate(
                { businessId, phone },
                {
                    $set: updateData,
                    $setOnInsert: {
                        channel: 'whatsapp',
                        followUpStage: 0,
                        dealValue: 0,
                        funnelStage: 'new',
                        totalMessages: chat.unreadCount // Maybe? Or just 0
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            stats.contactsImported++;
        }

        res.json(stats);

    } catch (error) {
        console.error('Error syncing contacts from WhatsApp:', error);
        res.status(500).json({ message: 'Error syncing contacts', error: error.message });
    }
};

module.exports = {
    getContacts,
    getContact,
    updateContact,
    importContacts,
    syncContacts
};
