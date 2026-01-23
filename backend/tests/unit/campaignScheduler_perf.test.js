const mongoose = require('mongoose');
const { processCampaigns } = require('../../services/campaignScheduler');
const Campaign = require('../../models/Campaign');
const CampaignLog = require('../../models/CampaignLog');
const Contact = require('../../models/Contact');
const BusinessConfig = require('../../models/BusinessConfig');
const responseService = require('../../services/responseService');
const aiService = require('../../services/aiService');

jest.mock('../../models/Campaign');
jest.mock('../../models/CampaignLog');
jest.mock('../../models/Contact');
jest.mock('../../models/BusinessConfig');
jest.mock('../../models/Appointment');
jest.mock('../../services/responseService');
jest.mock('../../services/aiService');
jest.mock('../../services/message', () => ({
  getLastMessages: jest.fn().mockResolvedValue([])
}));

describe('CampaignScheduler Performance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should demonstrate N+1 query problem (or fix) for broadcast campaigns', async () => {
    // Setup Scenerio:
    // 1 Broadcast Campaign
    // 10 Contacts matching tags
    // 5 Already sent (logs exist)

    const campaignId = new mongoose.Types.ObjectId();
    const campaign = {
      _id: campaignId,
      userId: new mongoose.Types.ObjectId(),
      isActive: true,
      triggerType: 'time',
      type: 'broadcast',
      schedule: {
        frequency: 'once', // or handled by clock logic
        time: '12:00', // Matches mock time
        days: [0, 1, 2, 3, 4, 5, 6]
      },
      targetTags: ['tag1'],
      message: 'Hello',
      contentMode: 'static',
      delayRange: { min: 0, max: 0 } // No delay for test
    };

    // Mock BusinessConfig
    BusinessConfig.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      operatingHours: { timezone: 'UTC' }
    });

    // Mock Date to match schedule time
    // We need to match the time logic in processTimeCampaign
    // It uses Intl.DateTimeFormat with 'en-US' and given timezone.
    // If timezone is UTC, and we mock new Date() to 12:00 UTC.

    // Force specific time
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

    // Mock Campaign.find to return our campaign
    Campaign.find.mockResolvedValue([campaign]);

    // Mock Contact.find
    // It should return 10 contacts initially
    const contacts = Array.from({ length: 10 }, (_, i) => ({
      _id: new mongoose.Types.ObjectId(),
      phone: `123456789${i}`,
      businessId: new mongoose.Types.ObjectId(),
      name: `User ${i}`
    }));

    Contact.find.mockImplementation(async (query) => {
      let result = contacts;
      // Simulate MongoDB $nin filtering
      if (query._id && query._id.$nin) {
        const excluded = query._id.$nin.map(id => id.toString());
        result = result.filter(c => !excluded.includes(c._id.toString()));
      }
      return result;
    });

    // Mock CampaignLog.exists
    // 5 contacts have logs. Let's say indices 0-4 have logs.
    const sentContactIds = contacts.slice(0, 5).map(c => c._id.toString());

    CampaignLog.exists.mockImplementation(async (query) => {
      // Logic for "original" check
      if (query.contactId && sentContactIds.includes(query.contactId.toString())) {
        return true;
      }
      return false;
    });

    // Mock CampaignLog.find (for the optimization)
    // Should return logs for the sent contacts
    CampaignLog.find.mockReturnValue({
      select: jest.fn().mockResolvedValue(
        sentContactIds.map(id => ({ contactId: id }))
      )
    });

    // Mock responseService
    responseService.sendUnifiedMessage.mockResolvedValue(true);

    // Run Scheduler
    await processCampaigns();

    // Verify Calls
    const existsCalls = CampaignLog.exists.mock.calls.length;
    const findLogCalls = CampaignLog.find.mock.calls.length;
    const contactFindCalls = Contact.find.mock.calls.length;

    console.log(`[PERF RESULT]
      CampaignLog.exists calls: ${existsCalls}
      CampaignLog.find calls: ${findLogCalls}
      Contact.find calls: ${contactFindCalls}
    `);

    // In unoptimized code:
    // Contact.find called once.
    // CampaignLog.exists called 10 times (once per contact found).
    // Loop runs 10 times.
    // If exists returns true (5 times), dispatch stops.
    // If exists returns false (5 times), dispatch sends and creates log.

    // We expect 10 exists calls in unoptimized code.
    // In optimized code: 1 exists call (maybe 0 if loop doesn't run for excluded).
  });
});
