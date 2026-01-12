const request = require('supertest');
const { clearDatabase } = require('./setup');
const { mockWWebJS, mockAIService, mockResponseService } = require('./mocks');

// Mock dependencies
jest.mock('../services/wwebjsService', () => mockWWebJS);
jest.mock('../services/aiService', () => mockAIService);
jest.mock('../services/responseService', () => mockResponseService);

const app = require('../server');
const SystemUser = require('../models/SystemUser');
const Contact = require('../models/Contact');
const BusinessConfig = require('../models/BusinessConfig');

describe('CRM & Tags Flow', () => {
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
    userId = registerRes.body.user._id;

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

  it('should create a contact and add tags correctly', async () => {
    // 2. Create a new Contact
    const contactData = {
      phone: '5511999999999',
      name: 'John Doe',
      origin: 'manual'
    };

    let contact = await Contact.create({
      ...contactData,
      businessId,
      followUpActive: true
    });

    // 3. Call PUT /api/contacts/:id to add tags
    const tagsToAdd = ['Hot Lead', 'Investor'];
    const updateRes = await request(app)
      .put(`/api/contacts/${contact._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        tags: tagsToAdd
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.tags).toEqual(expect.arrayContaining(tagsToAdd));

    // 4. Assertion: Verify database state
    const updatedContact = await Contact.findById(contact._id);
    expect(updatedContact.tags).toEqual(expect.arrayContaining(tagsToAdd));
    expect(updatedContact.tags.length).toBe(2);
  });
});
