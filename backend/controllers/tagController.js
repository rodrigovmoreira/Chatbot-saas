const Tag = require('../models/Tag');
const BusinessConfig = require('../models/BusinessConfig');
const tagService = require('../services/tagService');

// Helper to get Business ID
const getBusinessId = async (userId) => {
    const config = await BusinessConfig.findOne({ userId });
    return config ? config._id : null;
};

// Helper to escape Regex characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// 1. Sync Logic (Delegated to Service)
const syncTags = async (req, res) => {
    try {
        let businessId;

        // If called internally or via script, businessId might be passed directly
        if (req && req.businessId) {
            businessId = req.businessId;
        } else if (req && req.user) {
            businessId = await getBusinessId(req.user.userId);
        }

        if (!businessId) {
            return res ? res.status(404).json({ message: 'Business not found' }) : null;
        }

        const stats = await tagService.syncTags(businessId);

        if (res) {
            res.json({ message: 'Sync completed', ...stats });
        }
        return stats;

    } catch (error) {
        console.error('Error syncing tags:', error);
        if (res) res.status(500).json({ message: 'Error syncing tags' });
    }
};

// Re-export for server startup, though server.js could import directly.
// Keeping this for backward compatibility if other modules use it.
const runGlobalTagSync = tagService.runGlobalTagSync;

// 2. Get Tags
const getTags = async (req, res) => {
    try {
        const businessId = await getBusinessId(req.user.userId);
        if (!businessId) return res.status(404).json({ message: 'Business not found' });

        const tags = await Tag.find({ businessId }).sort({ name: 1 });
        res.json(tags);
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ message: 'Error fetching tags' });
    }
};

// 3. Create Tag
const createTag = async (req, res) => {
    try {
        const { name, color } = req.body;
        if (!name) return res.status(400).json({ message: 'Tag name is required' });

        const businessId = await getBusinessId(req.user.userId);
        if (!businessId) return res.status(404).json({ message: 'Business not found' });

        // Check existence (Safe Regex)
        const escapedName = escapeRegExp(name);
        const existing = await Tag.findOne({
            businessId,
            name: { $regex: new RegExp(`^${escapedName}$`, 'i') }
        });

        if (existing) {
            return res.status(409).json({ message: 'Tag already exists', tag: existing });
        }

        const newTag = await Tag.create({
            businessId,
            name,
            color: color || '#A0AEC0' // Default if not provided
        });

        res.status(201).json(newTag);
    } catch (error) {
        console.error('Error creating tag:', error);
        res.status(500).json({ message: 'Error creating tag' });
    }
};

module.exports = {
    syncTags,
    runGlobalTagSync,
    getTags,
    createTag
};
