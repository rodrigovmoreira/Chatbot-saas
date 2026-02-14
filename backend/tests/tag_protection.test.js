const mongoose = require('mongoose');
const { clearDatabase } = require('./setup');
const { mockWWebJS } = require('./mocks');
const tagController = require('../controllers/tagController');
const Tag = require('../models/Tag');
const Contact = require('../models/Contact');
const BusinessConfig = require('../models/BusinessConfig');
const SystemUser = require('../models/SystemUser');

jest.mock('../services/wwebjsService', () => mockWWebJS);

describe('Tag Protection Logic', () => {
    let userId;
    let businessId;

    beforeEach(async () => {
        await clearDatabase();
        jest.clearAllMocks();

        // Setup basic data: User & Business
        const user = await SystemUser.create({
            name: 'Tag Tester',
            email: 'tag@test.com',
            password: 'hashedpassword',
            isVerified: true
        });
        userId = user._id;

        const config = await BusinessConfig.create({
            userId,
            businessName: 'Tag Biz',
            funnelSteps: []
        });
        businessId = config._id;
    });

    test('should prevent deletion of funnel step tag', async () => {
        // 1. Create Tag
        const tag = await Tag.create({
            businessId,
            name: 'Funnel Step Tag',
            color: '#000000'
        });

        // 2. Add to Funnel
        await BusinessConfig.findByIdAndUpdate(businessId, {
            $push: { funnelSteps: { tag: tag.name, label: 'Step 1', order: 1, color: '#000' } }
        });

        // 3. Mock Req/Res
        const req = { params: { id: tag._id }, user: { userId } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        // 4. Call Controller
        await tagController.deleteTag(req, res);

        // 5. Expect 400
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('PROIBIDO: Esta tag é uma etapa ativa do Funil')
        }));
    });

    test('should prevent deletion of tag assigned to contact', async () => {
        // 1. Create Tag
        const tag = await Tag.create({
            businessId,
            name: 'Contact Tag',
            color: '#000000'
        });

        // 2. Create Contact with Tag
        await Contact.create({
            businessId,
            phone: '5511999999999',
            tags: [tag.name]
        });

        // 3. Mock Req/Res
        const req = { params: { id: tag._id }, user: { userId } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        // 4. Call Controller
        await tagController.deleteTag(req, res);

        // 5. Expect 400
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('PROIBIDO: Existem 1 contatos com esta tag')
        }));
    });

    test('should allow deletion of unused tag', async () => {
        // 1. Create Tag
        const tag = await Tag.create({
            businessId,
            name: 'Unused Tag',
            color: '#000000'
        });

        // 3. Mock Req/Res
        const req = { params: { id: tag._id }, user: { userId } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        // 4. Call Controller
        await tagController.deleteTag(req, res);

        // 5. Expect 200 (or just success message)
        expect(res.status).not.toHaveBeenCalledWith(400);
        expect(res.status).not.toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Tag excluída com sucesso.'
        }));

        // Check DB
        const deletedTag = await Tag.findById(tag._id);
        expect(deletedTag).toBeNull();
    });
});
