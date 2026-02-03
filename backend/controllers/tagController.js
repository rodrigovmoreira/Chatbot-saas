const Tag = require('../models/Tag');
const Contact = require('../models/Contact');
const BusinessConfig = require('../models/BusinessConfig');

// Helper to get Business ID
const getBusinessId = async (userId) => {
    const config = await BusinessConfig.findOne({ userId });
    return config ? config._id : null;
};

// Helper to escape Regex characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// 1. Sync Logic (Migration)
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

        // 1. Fetch all unique tags from Contacts (Optimized DB-level distinct)
        const uniqueTagStrings = await Contact.distinct('tags', { businessId });

        // 2. Fetch existing Tags to compare in memory (avoids N+1 queries)
        const existingTags = await Tag.find({ businessId }).select('name');
        const existingTagSet = new Set(existingTags.map(t => t.name.toLowerCase()));

        const stats = { created: 0, skipped: 0 };

        // 3. Loop and Check
        for (const tagName of uniqueTagStrings) {
            if (!tagName || typeof tagName !== 'string') continue;

            const lowerName = tagName.toLowerCase();

            if (!existingTagSet.has(lowerName)) {
                // Create new
                await Tag.create({
                    businessId,
                    name: tagName, // Keep original casing from contact
                    color: '#A0AEC0' // Default Gray
                });
                existingTagSet.add(lowerName); // Prevent duplicates within same run
                stats.created++;
            } else {
                stats.skipped++;
            }
        }

        if (res) {
            res.json({ message: 'Sync completed', ...stats });
        }
        return stats;

    } catch (error) {
        console.error('Error syncing tags:', error);
        if (res) res.status(500).json({ message: 'Error syncing tags' });
    }
};

// Global Sync for Startup
const runGlobalTagSync = async () => {
    console.log('🔄 Starting Global Tag Sync...');
    try {
        const configs = await BusinessConfig.find({});
        for (const config of configs) {
            // Pass mock req object
            await syncTags({ businessId: config._id }, null);
        }
        console.log('✅ Global Tag Sync Completed.');
    } catch (error) {
        console.error('❌ Global Tag Sync Failed:', error);
    }
};

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
