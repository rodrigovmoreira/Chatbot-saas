const request = require('supertest');

describe('Security Middleware - NoSQL Injection Prevention', () => {
  it('should sanitize input containing $ signs in keys', async () => {
    const express = require('express');
    const mongoSanitize = require('express-mongo-sanitize');
    const testApp = express();
    testApp.use(express.json());
    testApp.use(mongoSanitize());

    testApp.post('/test-sanitize', (req, res) => {
      res.json(req.body);
    });

    const response = await request(testApp)
      .post('/test-sanitize')
      .send({
        email: { "$ne": "something" },
        password: "password"
      });

    // With sanitization, keys starting with $ are removed by default.
    // So 'email' should be an empty object {} or similar, but definitely NOT have '$ne'.

    if (response.body.email) {
        expect(response.body.email).not.toHaveProperty('$ne');
    } else {
        // If the key was removed entirely, that's also safe.
        expect(response.body.email).toBeUndefined();
    }
  });
});
