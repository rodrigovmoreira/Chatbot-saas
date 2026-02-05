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

describe('Contact List API (Lean Check)', () => {
  let token;
  let userId;
  let businessId;

  // Increase test timeout
  jest.setTimeout(30000);

  beforeEach(async () => {
    await clearDatabase();

    // 1. Register a user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test List User',
        email: 'listtest@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      });

    token = registerRes.body.token;
    userId = registerRes.body.user.id || registerRes.body.user._id;

    // Wait for BusinessConfig
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
  });

  it('GET /api/contacts returns list of contacts', async () => {
    // Seed contacts
    await Contact.create({
      businessId,
      phone: '5511999990001',
      name: 'Alice',
      tags: ['A'],
      lastInteraction: new Date()
    });

    await Contact.create({
      businessId,
      phone: '5511999990002',
      name: 'Bob',
      tags: ['B'],
      lastInteraction: new Date(Date.now() - 10000)
    });

    const res = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);

    // Verify fields exist (ensures .lean() didn't strip necessary fields)
    const alice = res.body.find(c => c.name === 'Alice');
    expect(alice).toBeDefined();
    expect(alice.phone).toBe('5511999990001');
    expect(alice.tags).toContain('A');
    expect(alice._id).toBeDefined();
  });
});
