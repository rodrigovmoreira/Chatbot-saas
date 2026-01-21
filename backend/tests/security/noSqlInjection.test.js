const request = require('supertest');
const { clearDatabase } = require('../setup');
const { mockWWebJS, mockAIService, mockResponseService } = require('../mocks');

// Mock dependencies
jest.mock('../../services/wwebjsService', () => mockWWebJS);
jest.mock('../../services/aiService', () => mockAIService);
jest.mock('../../services/responseService', () => mockResponseService);
// Mock email service to prevent console errors
jest.mock('../../services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true)
}));

const { app } = require('../../server');
const SystemUser = require('../../models/SystemUser');

describe('Security: NoSQL Injection', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it('should prevent NoSQL injection in email verification', async () => {
    // 1. Register a user (verification token is generated automatically)
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Attacker User',
        email: 'attacker@example.com',
        password: 'password123',
        company: 'Evil Corp'
      });

    expect(registerRes.status).toBe(201);

    // User should not be verified initially
    let user = await SystemUser.findOne({ email: 'attacker@example.com' });
    expect(user.isVerified).toBe(false);

    // 2. Attempt to verify using NoSQL injection
    // Sending { token: { $ne: null } } which matches any token
    const exploitRes = await request(app)
      .post('/api/auth/verify-email')
      .send({
        token: { $ne: null }
      });

    // If vulnerable, it returns 200 and verifies the user
    // We WANT this to FAIL (400 or 500 or just not verify), but for reproduction we assert state.

    // Refresh user
    user = await SystemUser.findOne({ email: 'attacker@example.com' });

    // This assertion defines what we expect:
    // If we are proving it is vulnerable: expect(user.isVerified).toBe(true);
    // But since I am fixing it, I will write the test to expect it to remain FALSE (after fix).
    // However, currently it will fail.

    // To confirm vulnerability first, I'll check response.
    // If it was successful (vulnerable), response is 200.

    if (exploitRes.status === 200 && user.isVerified === true) {
      throw new Error('VULNERABILITY CONFIRMED: NoSQL Injection successful. User verified without token.');
    }

    expect(exploitRes.status).not.toBe(200);
    expect(user.isVerified).toBe(false);

    // 3. Verify with correct token (Positive Test)
    // Get the actual token from DB (since it's not returned in API)
    const validUser = await SystemUser.findOne({ email: 'attacker@example.com' }).select('+verificationToken');
    const validToken = validUser.verificationToken;

    const verifyRes = await request(app)
      .post('/api/auth/verify-email')
      .send({
        token: validToken
      });

    expect(verifyRes.status).toBe(200);

    const verifiedUser = await SystemUser.findOne({ email: 'attacker@example.com' });
    expect(verifiedUser.isVerified).toBe(true);
  });
});
