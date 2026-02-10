const BusinessConfig = require('../models/BusinessConfig');
const Tag = require('../models/Tag');
const Contact = require('../models/Contact');
const wwebjsService = require('./wwebjsService');

// Helper to escape Regex characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Migrates legacy tags from BusinessConfig.availableTags to the Tag collection.
 * Helper for syncWithWhatsapp.
 * @param {string} businessId
 */
const migrateLegacyTags = async (businessId) => {
    try {
        const config = await BusinessConfig.findById(businessId);
        if (!config || !config.availableTags || config.availableTags.length === 0) {
            return { migrated: 0 };
        }

        let migratedCount = 0;
        for (const tagName of config.availableTags) {
            if (!tagName || typeof tagName !== 'string') continue;

            const escapedName = escapeRegExp(tagName);
            const existing = await Tag.findOne({
                businessId,
                name: { $regex: new RegExp(`^${escapedName}$`, 'i') }
            });

            if (!existing) {
                // Determine if this should be synced to WA?
                // For now just create in DB, syncWithWhatsapp will handle WA linking if it exists there.
                await Tag.create({
                    businessId,
                    name: tagName,
                    color: '#CBD5E0'
                });
                migratedCount++;
            }
        }
        return { migrated: migratedCount };
    } catch (error) {
        console.error(`Error migrating legacy tags for business ${businessId}:`, error);
        throw error;
    }
};

/**
 * Syncs tags from WhatsApp to the Tag collection.
 * @param {string} businessId
 */
const syncWithWhatsapp = async (businessId) => {
    try {
        if (!businessId) {
            throw new Error('Business ID is required for tag sync.');
        }

        // 1. Get userId to call WWebJS
        const config = await BusinessConfig.findById(businessId);
        if (!config || !config.userId) {
            throw new Error(`Business Config or UserID not found for ${businessId}`);
        }
        const userId = config.userId;

        // 2. Fetch Labels from WhatsApp
        const waLabels = await wwebjsService.getLabels(userId);

        const stats = { created: 0, updated: 0, synced: waLabels.length };

        // 3. Update/Create Tags based on WA Labels
        for (const label of waLabels) {
            // Label structure: { id, name, hexColor }
            const { id: whatsappId, name, hexColor } = label;

            // Try to find by whatsappId first
            let tag = await Tag.findOne({ businessId, whatsappId });

            if (tag) {
                // Update if changed
                if (tag.name !== name || tag.color !== hexColor) {
                    tag.name = name;
                    tag.color = hexColor;
                    await tag.save();
                    stats.updated++;
                }
            } else {
                // Try to find by name (legacy migration linkage)
                 const escapedName = escapeRegExp(name);
                 tag = await Tag.findOne({
                    businessId,
                    name: { $regex: new RegExp(`^${escapedName}$`, 'i') }
                 });

                 if (tag) {
                     // Link legacy tag to WhatsApp ID
                     tag.whatsappId = whatsappId;
                     tag.name = name; // Enforce WA name case
                     tag.color = hexColor; // Enforce WA color
                     await tag.save();
                     stats.updated++;
                 } else {
                     // Create new
                     await Tag.create({
                         businessId,
                         whatsappId,
                         name,
                         color: hexColor || '#A0AEC0'
                     });
                     stats.created++;
                 }
            }
        }

        return stats;

    } catch (error) {
        console.error('Error syncing tags with WhatsApp:', error);
        throw error; // Controller should handle this
    }
};

const createTag = async (businessId, tagData) => {
    try {
        const { name, color } = tagData;

        // 1. Create on WhatsApp
        const config = await BusinessConfig.findById(businessId);
        if (!config || !config.userId) throw new Error('Business Config not found');

        // Note: wwebjs createLabel typically only takes name.
        const waLabel = await wwebjsService.createLabel(config.userId, name);

        if (!waLabel || !waLabel.id) {
            throw new Error('Failed to create label on WhatsApp');
        }

        // If we want to set color immediately and it differs from default:
        if (color && waLabel.hexColor !== color) {
            try {
               // Update color on WA
               const updatedLabel = await wwebjsService.updateLabel(config.userId, waLabel.id, name, color);
               if(updatedLabel) waLabel.hexColor = updatedLabel.hexColor || color;
            } catch (e) {
                console.warn('Failed to update color on WA after creation', e);
            }
        }

        // 2. Create in Mongo
        // Check for existing tag with same name to avoid duplicates (should have been synced, but race condition check)
        const escapedName = escapeRegExp(name);
        let tag = await Tag.findOne({ businessId, name: { $regex: new RegExp(`^${escapedName}$`, 'i') } });

        if (tag) {
            tag.whatsappId = waLabel.id;
            tag.color = waLabel.hexColor || color;
            await tag.save();
        } else {
            tag = await Tag.create({
                businessId,
                name: waLabel.name,
                whatsappId: waLabel.id,
                color: waLabel.hexColor || color || '#A0AEC0'
            });
        }

        return tag;
    } catch (error) {
        console.error('Error in createTag service:', error);
        throw error;
    }
};

const updateTag = async (businessId, tagId, updateData) => {
    try {
        const { name, color } = updateData;
        const tag = await Tag.findOne({ _id: tagId, businessId });
        if (!tag) throw new Error('Tag not found');

        // 1. Update WhatsApp
        if (tag.whatsappId) {
            const config = await BusinessConfig.findById(businessId);
            if (config && config.userId) {
                await wwebjsService.updateLabel(config.userId, tag.whatsappId, name, color);
            }
        }

        // 2. Update Mongo
        tag.name = name;
        tag.color = color;
        await tag.save();

        return tag;
    } catch (error) {
         console.error('Error in updateTag service:', error);
         throw error;
    }
};

const deleteTag = async (businessId, tagId) => {
    try {
        const tag = await Tag.findOne({ _id: tagId, businessId });
        if (!tag) throw new Error('Tag not found');

        // 1. Delete from WhatsApp
        if (tag.whatsappId) {
             const config = await BusinessConfig.findById(businessId);
             if (config && config.userId) {
                 try {
                    await wwebjsService.deleteLabel(config.userId, tag.whatsappId);
                 } catch (e) {
                     console.warn(`Failed to delete label on WA: ${e.message}`);
                 }
             }
        }

        // 2. Delete from Mongo
        await Tag.deleteOne({ _id: tagId });
        return { message: 'Tag deleted' };

    } catch (error) {
         console.error('Error in deleteTag service:', error);
         throw error;
    }
};

// Main export to replace syncTags but kept name if needed,
// though refactor plan says 'syncWithWhatsapp'.
const syncTags = syncWithWhatsapp;

const runGlobalTagSync = async () => {
    console.log('🔄 Starting Global Tag Sync...');
    try {
        const configs = await BusinessConfig.find({});
        for (const config of configs) {
            try {
                await syncWithWhatsapp(config._id);
            } catch (e) {
                console.error(`Failed to sync business ${config.businessName}: ${e.message}`);
            }
        }
        console.log('✅ Global Tag Sync Completed.');
    } catch (error) {
        console.error('❌ Global Tag Sync Failed:', error);
    }
};

module.exports = {
    syncWithWhatsapp,
    syncTags,
    createTag,
    updateTag,
    deleteTag,
    runGlobalTagSync
};
