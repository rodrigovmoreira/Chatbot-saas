const request = require('supertest');
const { clearDatabase } = require('./setup');
const { mockWWebJS, mockAIService, mockResponseService } = require('./mocks');

// Mock dependencies
jest.mock('../services/wwebjsService', () => mockWWebJS);
jest.mock('../services/aiService', () => mockAIService);
jest.mock('../services/responseService', () => mockResponseService);

const { app } = require('../server');
const Contact = require('../models/Contact');
const BusinessConfig = require('../models/BusinessConfig');

describe('API Optimization Tests', () => {
  let token;
  let userId;
  let businessId;

  // Increase test timeout
  jest.setTimeout(30000);

  beforeEach(async () => {
    await clearDatabase();

    // 1. Register a user (and implicitly create BusinessConfig)
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      });

    expect(registerRes.status).toBe(201);
    token = registerRes.body.token;
    userId = registerRes.body.user.id || registerRes.body.user._id;

    // Retry loop to wait for BusinessConfig creation (async post-hook in controller)
    let attempts = 0;
    while (attempts < 10) {
        const config = await BusinessConfig.findOne({ userId });
        if (config) {
            businessId = config._id;
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (!businessId) {
        throw new Error("Failed to create BusinessConfig after registration");
    }
  });

  it('GET /api/contacts should return contacts with correct structure (lean/json)', async () => {
    // Create contacts
    const contact1 = await Contact.create({
      businessId,
      phone: '5511999999999',
      name: 'John Doe',
      tags: ['A', 'B']
    });

    const contact2 = await Contact.create({
      businessId,
      phone: '5511888888888',
      name: 'Jane Smith',
      tags: ['C']
    });

    // Fetch contacts
    const res = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);

    // Verify structure
    const receivedContact = res.body.find(c => c._id === contact1._id.toString());
    expect(receivedContact).toBeDefined();

    // Check specific fields used by frontend
    expect(receivedContact.name).toBe('John Doe');
    expect(receivedContact.phone).toBe('5511999999999');
    expect(receivedContact.tags).toEqual(expect.arrayContaining(['A', 'B']));

    // Check _id format (should be string in JSON)
    expect(typeof receivedContact._id).toBe('string');

    // Optional: Check if virtuals are missing (expected if using lean)
    // Mongoose default virtual 'id' is usually added unless disabled.
    // If using lean(), 'id' should be undefined.
    // If NOT using lean(), 'id' might be present if toJSON: { virtuals: true } is default (it is NOT by default in Mongoose 5/6 unless configured).
    // Let's just log it to see current behavior.
    // console.log('Contact keys:', Object.keys(receivedContact));
  });
});
