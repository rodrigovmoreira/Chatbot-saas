
const mongoose = require('mongoose');

// Need to mock dependencies BEFORE requiring controller
jest.mock('../../services/wwebjsService', () => ({
    getClientSession: jest.fn()
}));

// Mock Contact
jest.mock('../../models/Contact', () => ({
    findOneAndUpdate: jest.fn(),
    find: jest.fn().mockReturnThis(),
    sort: jest.fn(),
    findOne: jest.fn()
}));

// Mock BusinessConfig
jest.mock('../../models/BusinessConfig', () => ({
    findOne: jest.fn()
}));

// Now require controller
const contactController = require('../../controllers/contactController');
const wwebjsService = require('../../services/wwebjsService');
const Contact = require('../../models/Contact');
const BusinessConfig = require('../../models/BusinessConfig');


// Mock Express
const req = {
    user: { userId: 'user123' },
    file: null,
    body: {}
};
const res = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis()
};

describe('Contact Sync Verification', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('syncContacts should filter groups and update contacts', async () => {
        // Setup Mocks
        const mockBusinessId = 'biz123';
        BusinessConfig.findOne.mockResolvedValue({ _id: mockBusinessId });

        const mockClient = {
            info: {},
            getChats: jest.fn().mockResolvedValue([
                {
                    isGroup: true,
                    id: { user: 'group1' }
                },
                {
                    isGroup: false,
                    id: { user: 'status' }
                },
                {
                    isGroup: false,
                    id: { user: '5511999999999' }, // Valid
                    name: 'Saved Name',
                    timestamp: 1700000000,
                    getContact: jest.fn().mockResolvedValue({
                        name: 'Saved Name',
                        pushname: 'Public Name',
                        number: '5511999999999',
                        getProfilePicUrl: jest.fn().mockResolvedValue('http://pic.url')
                    }),
                    unreadCount: 5
                },
                {
                    isGroup: false,
                    id: { user: '5511888888888' }, // Valid, no saved name
                    name: '+55 11 88888-8888',
                    timestamp: 1700000000,
                    getContact: jest.fn().mockResolvedValue({
                        name: undefined,
                        pushname: 'Only Public',
                        number: '5511888888888',
                        getProfilePicUrl: jest.fn().mockRejectedValue(new Error('No pic'))
                    }),
                    unreadCount: 0
                }
            ])
        };

        wwebjsService.getClientSession.mockReturnValue(mockClient);

        // Execute
        await contactController.syncContacts(req, res);

        // Assertions
        expect(res.json).toHaveBeenCalled();
        const result = res.json.mock.calls[0][0];

        console.log('Result:', result);
        expect(result.totalChatsFound).toBe(4);
        expect(result.groupsIgnored).toBe(1); // 1 group
        expect(result.contactsImported).toBe(2); // 2 valid contacts

        // Verify Upserts
        expect(Contact.findOneAndUpdate).toHaveBeenCalledTimes(2);

        // Check Call 1 (Saved Name Priority)
        const call1 = Contact.findOneAndUpdate.mock.calls[0];
        // Ensure arguments match what controller calls
        expect(call1[0]).toEqual({ businessId: mockBusinessId, phone: '5511999999999' });
        expect(call1[1].$set.name).toBe('Saved Name');
        expect(call1[1].$set.pushname).toBe('Public Name');
        expect(call1[1].$set.profilePicUrl).toBe('http://pic.url');
        expect(call1[1].$setOnInsert.totalMessages).toBe(5);

        // Check Call 2 (Pushname Priority)
        const call2 = Contact.findOneAndUpdate.mock.calls[1];
        expect(call2[0]).toEqual({ businessId: mockBusinessId, phone: '5511888888888' });
        expect(call2[1].$set.name).toBe('Only Public');
        // Profile pic failed, so it shouldn't be set
        expect(call2[1].$set.profilePicUrl).toBeUndefined();
    });
});
