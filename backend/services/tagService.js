const BusinessConfig = require('../models/BusinessConfig');
const Tag = require('../models/Tag');
const Contact = require('../models/Contact');

// Helper to escape Regex characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Migrates legacy tags from BusinessConfig.availableTags to the Tag collection.
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

            // Check existence (Case insensitive)
            const escapedName = escapeRegExp(tagName);
            const existing = await Tag.findOne({
                businessId,
                name: { $regex: new RegExp(`^${escapedName}$`, 'i') }
            });

            if (!existing) {
                await Tag.create({
                    businessId,
                    name: tagName,
                    color: '#CBD5E0' // Default color for migrated tags
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
 * Syncs tags from Contacts and BusinessConfig to the Tag collection.
 * @param {string} businessId
 */
const syncTags = async (businessId) => {
    try {
        if (!businessId) {
            throw new Error('Business ID is required for tag sync.');
        }

        // 1. Run Legacy Migration First
        const migrationStats = await migrateLegacyTags(businessId);

        // 2. Fetch all unique tags from Contacts (Optimized DB-level distinct)
        const uniqueTagStrings = await Contact.distinct('tags', { businessId });

        // 3. Fetch existing Tags to compare in memory (avoids N+1 queries)
        const existingTags = await Tag.find({ businessId }).select('name');
        const existingTagSet = new Set(existingTags.map(t => t.name.toLowerCase()));

        const stats = { created: 0, skipped: 0, migrated: migrationStats.migrated };

        // 4. Loop and Check Contacts Tags
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

        return stats;

    } catch (error) {
        console.error('Error syncing tags:', error);
        throw error;
    }
};

/**
 * Runs tag sync for all businesses. intended for startup.
 */
const runGlobalTagSync = async () => {
    console.log('🔄 Starting Global Tag Sync...');
    try {
        const configs = await BusinessConfig.find({});
        for (const config of configs) {
            await syncTags(config._id);
        }
        console.log('✅ Global Tag Sync Completed.');
    } catch (error) {
        console.error('❌ Global Tag Sync Failed:', error);
    }
};

module.exports = {
    migrateLegacyTags,
    syncTags,
    runGlobalTagSync
};
