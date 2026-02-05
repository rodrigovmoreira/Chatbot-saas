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

        const contacts = await Contact.find({ businessId }).sort({ lastInteraction: -1 }).lean();
        res.json(contacts);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ message: 'Error fetching contacts' });
    }
});

// Get all unique tags for the business (DEPRECATED - Use /api/tags)
router.get('/tags', authenticateToken, async (req, res) => {
    // Redirect logic could go here, but for now we maintain backward compatibility
    // by fetching from the new Source of Truth (Tags collection)
    try {
        const businessId = await getBusinessId(req.user.userId);
        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        // Return just the names to maintain API contract with legacy frontends
        const Tag = require('../models/Tag');
        const tags = await Tag.find({ businessId }).sort({ name: 1 }).lean();
        res.json(tags.map(t => t.name));
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ message: 'Error fetching tags' });
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

        const contact = await Contact.findOne({ _id: id, businessId }).lean();
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

        // Process Rows
        for (const row of rows) {
             // Normalize keys helper
             const getField = (r, key) => r[key] || r[key.toLowerCase()] || r[key.toUpperCase()];

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

             // Find or Create
             let contact = await Contact.findOne({ businessId, phone });

             if (contact) {
                 // Update
                 if (name) contact.name = name;
                 if (email) contact.email = email;
                 if (tagsRaw) {
                     const newTags = String(tagsRaw).split(',').map(t => t.trim()).filter(t => t);
                     // Merge unique
                     contact.tags = [...new Set([...contact.tags, ...newTags])];
                 }
                 await contact.save();
                 stats.updated++;
             } else {
                 // Create
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
});

module.exports = router;
