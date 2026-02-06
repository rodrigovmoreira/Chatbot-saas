const mongoose = require('mongoose');
const { clearDatabase } = require('./setup');
const { mockWWebJS, mockAIService, mockResponseService } = require('./mocks');

// Mock dependencies
jest.mock('../services/wwebjsService', () => mockWWebJS);
jest.mock('../services/aiService', () => mockAIService);
jest.mock('../services/responseService', () => mockResponseService);

// Mock message service specifically for saveMessage
const mockSaveMessage = jest.fn().mockResolvedValue(true);
jest.mock('../services/message', () => ({
  saveMessage: mockSaveMessage
}));

const Appointment = require('../models/Appointment');
const Contact = require('../models/Contact');
const BusinessConfig = require('../models/BusinessConfig');
const SystemUser = require('../models/SystemUser');

const { processSchedulerTick } = require('../services/scheduler');

describe('Scheduler Performance Optimization Verification', () => {
  let userId;
  let businessId;

  // Increase test timeout
  jest.setTimeout(60000);

  beforeEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();

    // Setup basic data
    const user = await SystemUser.create({
      name: 'Perf Tester',
      email: 'perf@test.com',
      password: 'hashedpassword',
      isVerified: true
    });
    userId = user._id;

    const config = await BusinessConfig.create({
      userId,
      businessName: 'Perf Biz',
      phone: '5511900000000',
      whatsappProvider: 'wwebjs',
      availableTags: ['Client'],
      // Rules for test
      notificationRules: [{
        id: 'rule-123',
        name: 'Reminder 1h',
        triggerOffset: 60,
        triggerUnit: 'minutes',
        triggerDirection: 'before',
        messageTemplate: 'Reminder: {serviceName} at {appointmentTime}',
        isActive: true
      }],
      followUpSteps: [{
        stage: 0,
        delayMinutes: 30, // 30 mins after last response
        message: 'Hello? Still there?'
      }]
    });
    businessId = config._id;
  });

  test('Scheduler correctly processes Appointments and Contacts', async () => {
    // 1. Setup Appointment (Due for notification)
    const now = new Date();
    // 1 hour from now is the trigger time.
    // If we want it to trigger NOW, the appointment start should be 1 hour from now.
    // But logic checks: now >= triggerTime.
    // triggerTime = start - offset.
    // So if start is in 50 mins, triggerTime was 10 mins ago. now >= triggerTime.
    const startIn50Mins = new Date(now.getTime() + 50 * 60000);

    const appt = await Appointment.create({
      userId,
      clientName: 'Client A',
      clientPhone: '5511999991111',
      title: 'Service A',
      start: startIn50Mins,
      end: new Date(startIn50Mins.getTime() + 60 * 60000),
      status: 'confirmed'
    });

    // 2. Setup Contact (Due for Follow-up)
    // Last response was 40 mins ago. Delay is 30 mins.
    const lastResponse = new Date(now.getTime() - 40 * 60000);
    const contact = await Contact.create({
      businessId,
      phone: '5511999992222',
      name: 'Client B',
      tags: ['Client'],
      followUpActive: true,
      lastResponseTime: lastResponse,
      followUpStage: 0
    });

    // 3. Run Scheduler
    await processSchedulerTick();

    // 4. Verify Appointment Notification
    // Should have sent message
    expect(mockResponseService.sendUnifiedMessage).toHaveBeenCalledWith(
        '5511999991111',
        expect.stringContaining('Reminder'),
        'wwebjs',
        userId
    );

    // Check DB for Notification History
    const updatedAppt = await Appointment.findById(appt._id);
    expect(updatedAppt.notificationHistory.get('rule-123')).toBeDefined();

    // 5. Verify Contact Follow-up
    expect(mockResponseService.sendUnifiedMessage).toHaveBeenCalledWith(
        '5511999992222',
        expect.stringContaining('Still there?'),
        'wwebjs',
        userId
    );

    // Check DB for Follow Up Stage
    const updatedContact = await Contact.findById(contact._id);
    expect(updatedContact.followUpStage).toBe(1);
    // lastResponseTime should be updated to roughly now
    expect(updatedContact.lastResponseTime.getTime()).toBeGreaterThan(lastResponse.getTime());

    // Check saveMessage called
    expect(mockSaveMessage).toHaveBeenCalledTimes(2); // One for appt, one for contact
  });
});
