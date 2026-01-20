const request = require('supertest');
const { app } = require('../../server');
const SystemUser = require('../../models/SystemUser');
const mongoose = require('mongoose');

describe('Security: NoSQL Injection', () => {

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should block NoSQL injection in login', async () => {
    // 1. Create a user
    const email = 'victim@example.com';
    const password = 'StrongPassword123!';

    await SystemUser.deleteMany({ email });
    await SystemUser.create({
        name: 'Victim',
        email,
        password,
        company: 'Victim Corp'
    });

    // 2. Attempt injection with CORRECT password
    // If vulnerable, { $ne: null } matches the user, and password matches, so 200 OK.
    // If secure, { $ne: null } is sanitized to {}, query fails (CastError or null), so 400/500.
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: { $ne: null },
        password: password
      });

    expect(res.status).not.toBe(200);
    expect(res.body).not.toHaveProperty('token');
  });
});
