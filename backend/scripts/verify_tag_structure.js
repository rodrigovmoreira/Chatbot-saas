
const mongoose = require('mongoose');

// Run this script from backend/

try {
    const wwebjsService = require('../services/wwebjsService');
    const tagService = require('../services/tagService');
    const tagController = require('../controllers/tagController');
    const Tag = require('../models/Tag');

    console.log('--- Verifying wwebjsService ---');
    const requiredWwebjsMethods = ['getLabels', 'createLabel', 'updateLabel', 'deleteLabel', 'setChatLabels', 'getChatLabels'];
    requiredWwebjsMethods.forEach(method => {
        if (typeof wwebjsService[method] !== 'function') {
            console.error(`❌ wwebjsService missing method: ${method}`);
            process.exit(1);
        } else {
            console.log(`✅ ${method} exists`);
        }
    });

    console.log('\n--- Verifying tagService ---');
    const requiredTagServiceMethods = ['syncWithWhatsapp', 'createTag', 'updateTag', 'deleteTag'];
    requiredTagServiceMethods.forEach(method => {
        if (typeof tagService[method] !== 'function') {
            console.error(`❌ tagService missing method: ${method}`);
            process.exit(1);
        } else {
            console.log(`✅ ${method} exists`);
        }
    });

    console.log('\n--- Verifying tagController ---');
    const requiredControllerMethods = ['syncTags', 'createTag', 'updateTag', 'deleteTag'];
    requiredControllerMethods.forEach(method => {
        if (typeof tagController[method] !== 'function') {
            console.error(`❌ tagController missing method: ${method}`);
            process.exit(1);
        } else {
            console.log(`✅ ${method} exists`);
        }
    });

    console.log('\n--- Verifying Tag Model ---');
    const tagSchema = Tag.schema.paths;
    if (!tagSchema.whatsappId) {
        console.error('❌ Tag model missing whatsappId field');
        process.exit(1);
    }
    console.log('✅ whatsappId field exists');

    console.log('\n✅ ALL CHECKS PASSED');
    process.exit(0);

} catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
}
