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

describe('Optimization Checks', () => {
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
        name: 'Optimization User',
        email: 'opt@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      });

    expect(registerRes.status).toBe(201);
    token = registerRes.body.token;
    userId = registerRes.body.user.id || registerRes.body.user._id;

    // Retry loop to wait for BusinessConfig creation
    let attempts = 0;
    while (attempts < 20) {
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

  it('GET /api/contacts should return contacts with correct structure', async () => {
    // Create a contact
    const contactData = {
      businessId,
      phone: '5511999998888',
      name: 'Lean User',
      tags: ['Test'],
      isHandover: true
    };
    const contact = await Contact.create(contactData);

    // Fetch contacts
    const res = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);

    const fetchedContact = res.body[0];

    // Check key fields
    expect(fetchedContact._id).toBe(contact._id.toString());
    expect(fetchedContact.name).toBe('Lean User');
    expect(fetchedContact.isHandover).toBe(true);

    // Check if it's a plain object (res.body is always parsed JSON, so it is plain object)
    // But we want to ensure data integrity
  });

  it('GET /api/contacts/:id should return single contact', async () => {
     const contact = await Contact.create({
        businessId,
        phone: '5511977776666',
        name: 'Single User'
     });

     const res = await request(app)
       .get(`/api/contacts/${contact._id}`)
       .set('Authorization', `Bearer ${token}`);

     expect(res.status).toBe(200);
     expect(res.body._id).toBe(contact._id.toString());
     expect(res.body.name).toBe('Single User');
  });
});
