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

        // 2. Fetch Labels from WhatsApp (Safe Mode)
        let waLabels = [];
        try {
            waLabels = await wwebjsService.getLabels(userId);
        } catch (e) {
            console.warn("WhatsApp not ready for tags, skipping wwebjs sync.", e.message);
            // Don't throw, just return what we have or empty stats if critical
            return { error: "WhatsApp offline or not ready", synced: 0 };
        }

        if (!waLabels) waLabels = [];

        const stats = { created: 0, updated: 0, synced: waLabels.length };

        // 3. Update/Create Tags based on WA Labels
        for (const label of waLabels) {
            // Label structure: { id, name, hexColor }
            const { id: whatsappId, name, hexColor } = label;
            const finalColor = hexColor || label.color || '#A0AEC0'; // Fallback Color

            // Try to find by whatsappId first
            let tag = await Tag.findOne({ businessId, whatsappId });

            if (tag) {
                // Update if changed
                if (tag.name !== name || tag.color !== finalColor) {
                    tag.name = name;
                    tag.color = finalColor;
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
                     tag.color = finalColor; // Enforce WA color
                     await tag.save();
                     stats.updated++;
                 } else {
                     // Create new
                     await Tag.create({
                         businessId,
                         whatsappId,
                         name,
                         color: finalColor
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

        // 1. Create on WhatsApp (Safe Fail)
        const config = await BusinessConfig.findById(businessId);
        if (!config || !config.userId) throw new Error('Business Config not found');

        let waLabel = null;
        let whatsappId = null;
        let finalColor = color || '#A0AEC0';

        try {
            // Check if service function exists
            if (typeof wwebjsService.createLabel === 'function') {
                waLabel = await wwebjsService.createLabel(config.userId, name);
            } else {
                 // Fallback if service wrapper is missing method (e.g. mock or old version)
                const client = wwebjsService.getClientSession(config.userId);
                if (client && typeof client.createLabel === 'function') {
                     waLabel = await client.createLabel(name);
                }
            }

            if (waLabel && waLabel.id) {
                whatsappId = waLabel.id;
                // Update color on WA if needed
                if (color && waLabel.hexColor !== color) {
                     try {
                        if (typeof wwebjsService.updateLabel === 'function') {
                             const updated = await wwebjsService.updateLabel(config.userId, whatsappId, name, color);
                             if(updated) finalColor = updated.hexColor || color;
                        }
                     } catch (e) { console.warn('Failed to update color on WA:', e.message); }
                } else if (waLabel.hexColor) {
                    finalColor = waLabel.hexColor;
                }
            }
        } catch (error) {
             console.warn(`⚠️ WA Label creation skipped: ${error.message}. Creating in CRM only.`);
        }

        // 2. Create in Mongo (Always proceed)
        const escapedName = escapeRegExp(name);
        let tag = await Tag.findOne({ businessId, name: { $regex: new RegExp(`^${escapedName}$`, 'i') } });

        if (tag) {
            if (whatsappId) tag.whatsappId = whatsappId;
            tag.color = finalColor;
            await tag.save();
        } else {
            tag = await Tag.create({
                businessId,
                name: waLabel ? waLabel.name : name, // Use WA name if available, else requested name
                whatsappId,
                color: finalColor
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
