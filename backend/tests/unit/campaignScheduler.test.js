const mongoose = require('mongoose');
const { processCampaigns } = require('../../services/campaignScheduler');
const Campaign = require('../../models/Campaign');
const CampaignLog = require('../../models/CampaignLog');
const Contact = require('../../models/Contact');
const Appointment = require('../../models/Appointment');
const BusinessConfig = require('../../models/BusinessConfig');
const aiService = require('../../services/aiService');
const responseService = require('../../services/responseService');
const messageService = require('../../services/message');

jest.mock('../../models/Campaign');
jest.mock('../../models/CampaignLog');
jest.mock('../../models/Contact');
jest.mock('../../models/Appointment');
jest.mock('../../models/BusinessConfig');
jest.mock('../../services/aiService');
jest.mock('../../services/responseService');
jest.mock('../../services/message');

describe('CampaignScheduler Performance', () => {
  let consoleSpy;

  beforeAll(() => {
    // Suppress logs
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleSpy.mockRestore();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  test('processTimeCampaign performs O(1) exclusion query', async () => {
    // Setup Data
    const campaignId = new mongoose.Types.ObjectId();
    const businessId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const campaign = {
      _id: campaignId,
      userId: userId,
      triggerType: 'time',
      type: 'broadcast',
      isActive: true,
      targetTags: ['tag1'],
      schedule: {
        frequency: 'once',
        time: '12:00',
        days: []
      },
      message: 'Hello',
      contentMode: 'static',
      delayRange: { min: 0, max: 0 }
    };

    const config = {
      _id: businessId,
      userId: userId,
      operatingHours: { timezone: 'UTC' }
    };

    // 10 contacts
    const contacts = Array.from({ length: 10 }, (_, i) => ({
      _id: new mongoose.Types.ObjectId(),
      businessId,
      phone: `123456789${i}`,
      name: `User ${i}`,
      isHandover: false
    }));

    // Identify which ones "exist" (first 5)
    const existingContacts = contacts.slice(0, 5);
    const newContacts = contacts.slice(5);

    // Mocks
    Campaign.find.mockResolvedValue([campaign]);
    BusinessConfig.findOne.mockResolvedValue(config);

    // Mock CampaignLog.find for pre-fetch
    // It chains .select()
    const mockFindReturn = {
      select: jest.fn().mockResolvedValue(
        existingContacts.map(c => ({ contactId: c._id }))
      )
    };
    CampaignLog.find.mockReturnValue(mockFindReturn);

    // Mock Contact.find
    // It should receive the exclusion list.
    // Ideally we'd verify the arguments, but for now we just return the new contacts
    // assuming the query works as intended (since we mock the return value).
    // Note: The logic passes the result of Contact.find to dispatchCampaign.
    // If the query is correct, it returns only newContacts.
    Contact.find.mockImplementation(async (query) => {
      // Basic simulation of the query
      if (query._id && query._id.$nin) {
        const excludedIds = query._id.$nin.map(id => id.toString());
        return contacts.filter(c => !excludedIds.includes(c._id.toString()));
      }
      return contacts; // Fallback if no exclusion (should not happen with fix)
    });

    // Simulate current time 12:00
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

    // Mock CampaignLog.exists
    // Should NOT be called for broadcast/recurring if optimized
    CampaignLog.exists.mockResolvedValue(false);

    CampaignLog.create.mockResolvedValue({});
    responseService.sendUnifiedMessage.mockResolvedValue(true);

    // Run
    await processCampaigns();

    // Verification

    // CampaignLog.find called 1 time (Pre-fetch)
    expect(CampaignLog.find).toHaveBeenCalledTimes(1);

    // Contact.find called once
    expect(Contact.find).toHaveBeenCalledTimes(1);

    // CampaignLog.exists called 0 times (Optimized!)
    // Previously was 10 times.
    expect(CampaignLog.exists).toHaveBeenCalledTimes(0);

    // sendUnifiedMessage called 5 times (only for new contacts)
    expect(responseService.sendUnifiedMessage).toHaveBeenCalledTimes(5);

    // Verify the arguments to sendUnifiedMessage confirm we sent to the correct people
    // (users 5, 6, 7, 8, 9)
    const calls = responseService.sendUnifiedMessage.mock.calls;
    expect(calls.length).toBe(5);
    expect(calls[0][0]).toBe(contacts[5].phone); // First sent is User 5
  });
});
