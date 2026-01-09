const mongoose = require('mongoose');
const Campaign = require('./models/Campaign');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function verify() {
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { useNewUrlParser: true, useUnifiedTopology: true });

  console.log('Testing Campaign model...');

  try {
    const campaign = new Campaign({
      userId: new mongoose.Types.ObjectId(),
      name: 'Test Campaign',
      type: 'broadcast',
      message: 'Hello',
      contentMode: 'ai_prompt'
    });

    await campaign.validate();
    console.log('SUCCESS: Campaign with contentMode: ai_prompt is valid.');

    if (campaign.contentMode !== 'ai_prompt') {
        throw new Error('contentMode was not set correctly');
    }

  } catch (error) {
    console.error('FAILURE:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

verify();
