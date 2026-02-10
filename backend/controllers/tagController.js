const Tag = require('../models/Tag');
const BusinessConfig = require('../models/BusinessConfig');
const tagService = require('../services/tagService');

// Helper to get Business ID
const getBusinessId = async (userId) => {
    const config = await BusinessConfig.findOne({ userId });
    return config ? config._id : null;
};

// 1. Sync Logic (Refactored to be thin)
const syncTags = async (req, res) => {
    try {
        let businessId;
        if (req && req.businessId) {
            businessId = req.businessId;
        } else if (req && req.user) {
            businessId = await getBusinessId(req.user.userId);
        }

        if (!businessId) {
            return res ? res.status(404).json({ message: 'Business not found' }) : null;
        }

        // Call service method
        const stats = await tagService.syncWithWhatsapp(businessId);

        if (res) {
            res.json({ message: 'Sync completed', ...stats });
        }
        return stats;

    } catch (error) {
        console.error('Error syncing tags:', error);
        if (res) res.status(500).json({ message: 'Error syncing tags', error: error.message });
    }
};

const runGlobalTagSync = tagService.runGlobalTagSync;

// 2. Get Tags (Remains mostly same, read-only)
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

// 3. Create Tag (Delegated)
const createTag = async (req, res) => {
    try {
        const { name, color } = req.body;
        if (!name) return res.status(400).json({ message: 'Tag name is required' });

        const businessId = await getBusinessId(req.user.userId);
        if (!businessId) return res.status(404).json({ message: 'Business not found' });

        const newTag = await tagService.createTag(businessId, { name, color });

        res.status(201).json(newTag);
    } catch (error) {
        console.error('Error creating tag:', error);
        res.status(500).json({ message: 'Error creating tag', error: error.message });
    }
};

// 4. Update Tag (New/Delegated)
const updateTag = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color } = req.body;

        const businessId = await getBusinessId(req.user.userId);
        if (!businessId) return res.status(404).json({ message: 'Business not found' });

        const updatedTag = await tagService.updateTag(businessId, id, { name, color });
        res.json(updatedTag);
    } catch (error) {
        console.error('Error updating tag:', error);
        res.status(500).json({ message: 'Error updating tag', error: error.message });
    }
};

// 5. Delete Tag (New/Delegated)
const deleteTag = async (req, res) => {
    try {
        const { id } = req.params;

        const businessId = await getBusinessId(req.user.userId);
        if (!businessId) return res.status(404).json({ message: 'Business not found' });

        await tagService.deleteTag(businessId, id);
        res.json({ message: 'Tag deleted successfully' });
    } catch (error) {
        console.error('Error deleting tag:', error);
        res.status(500).json({ message: 'Error deleting tag', error: error.message });
    }
};

module.exports = {
    syncTags,
    runGlobalTagSync,
    getTags,
    createTag,
    updateTag,
    deleteTag
};
