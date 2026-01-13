const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const BusinessConfig = require('../models/BusinessConfig');
const authenticateToken = require('../middleware/auth');

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

module.exports = router;
