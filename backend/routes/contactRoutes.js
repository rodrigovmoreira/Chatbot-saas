const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const BusinessConfig = require('../models/BusinessConfig');
const authenticateToken = require('../middleware/auth');
const multer = require('multer');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const { Readable } = require('stream');

const upload = multer({ storage: multer.memoryStorage() });

// Middleware helper to get Business Config ID
const getBusinessId = async (userId) => {
    const config = await BusinessConfig.findOne({ userId });
    return config ? config._id : null;
};

// List all contacts for the business
router.get('/', authenticateToken, async (req, res) => {
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
});

// Update contact (tags, handover, name, funnelStage)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tags, name, isHandover, funnelStage, dealValue, notes } = req.body; // Expanded allow-list

    const businessId = await getBusinessId(req.user.userId);
    if (!businessId) {
        return res.status(404).json({ message: 'Business configuration not found' });
    }

    // Ensure the contact belongs to the business
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
});

// Get a single contact details (Optional, but useful)
router.get('/:id', authenticateToken, async (req, res) => {
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
});

// Import Contacts (CSV/XLSX)
router.post('/import', authenticateToken, upload.single('file'), async (req, res) => {
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

        // Phase 1: Deduplication & Validation in Memory
        const processingMap = new Map(); // phone -> { name, email, tags: Set }

        // Normalize keys helper
        const getField = (r, key) => r[key] || r[key.toLowerCase()] || r[key.toUpperCase()];

        for (const row of rows) {
             let phone = getField(row, 'phone') || getField(row, 'Phone') || getField(row, 'telefone') || getField(row, 'Celular');
             const name = getField(row, 'name') || getField(row, 'Name') || getField(row, 'nome');
             const email = getField(row, 'email') || getField(row, 'Email');
             const tagsRaw = getField(row, 'tags') || getField(row, 'Tags');

             if (!phone) {
                 stats.failed++;
                 continue;
             }

             // Sanitize Phone (Basic) - remove spaces, dashes, parens
             phone = String(phone).replace(/\D/g, '');

             if (phone.length < 8) {
                 stats.failed++;
                 continue;
             }

             // Parse new tags
             const newTags = tagsRaw ? String(tagsRaw).split(',').map(t => t.trim()).filter(t => t) : [];

             if (processingMap.has(phone)) {
                 // Merge logic for duplicates in file
                 const entry = processingMap.get(phone);
                 if (name) entry.name = name; // Overwrite name if present
                 if (email) entry.email = email; // Overwrite email if present
                 newTags.forEach(t => entry.tags.add(t));
             } else {
                 processingMap.set(phone, {
                     name,
                     email,
                     tags: new Set(newTags)
                 });
             }
        }

        if (processingMap.size === 0) {
            return res.json(stats);
        }

        // Phase 2: Bulk Fetch Existing Contacts
        const phonesToProcess = Array.from(processingMap.keys());
        const existingContacts = await Contact.find({
            businessId,
            phone: { $in: phonesToProcess }
        }).select('phone _id');

        const existingMap = new Map(); // phone -> _id
        existingContacts.forEach(c => existingMap.set(c.phone, c._id));

        // Phase 3: Prepare Bulk Operations
        const bulkOps = [];

        for (const [phone, entry] of processingMap) {
            const tagsArray = Array.from(entry.tags);

            if (existingMap.has(phone)) {
                // Update
                const updateFields = {};
                if (entry.name) updateFields.name = entry.name;
                if (entry.email) updateFields.email = entry.email;

                const op = {
                    updateOne: {
                        filter: { _id: existingMap.get(phone) },
                        update: {
                            $addToSet: { tags: { $each: tagsArray } }
                        }
                    }
                };

                // Only add $set if there are fields to update
                if (Object.keys(updateFields).length > 0) {
                    op.updateOne.update.$set = updateFields;
                }

                bulkOps.push(op);
                stats.updated++;
            } else {
                // Insert
                bulkOps.push({
                    insertOne: {
                        document: {
                            businessId,
                            phone,
                            name: entry.name || 'Desconhecido',
                            email: entry.email,
                            tags: tagsArray,
                            channel: 'whatsapp',
                            followUpStage: 0,
                            dealValue: 0,
                            funnelStage: 'new',
                            notes: '',
                            followUpActive: false,
                            isHandover: false,
                            totalMessages: 0,
                            createdAt: new Date(),
                            lastInteraction: new Date()
                        }
                    }
                });
                stats.imported++;
            }
        }

        // Phase 4: Execute Bulk Write
        if (bulkOps.length > 0) {
            await Contact.bulkWrite(bulkOps);
        }

        res.json(stats);

    } catch (error) {
        console.error('Error importing contacts:', error);
        res.status(500).json({ message: 'Error processing import file' });
    }
});

module.exports = router;
