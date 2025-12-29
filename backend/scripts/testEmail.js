const { sendVerificationEmail } = require('../services/emailService');

const run = async () => {
  console.log('🧪 Testing Email Service...');
  // Mock Frontend URL if not set
  if (!process.env.FRONTEND_URL) process.env.FRONTEND_URL = 'http://localhost:3000';

  await sendVerificationEmail('test@example.com', 'dummy-token-12345');
};

run().catch(console.error);
