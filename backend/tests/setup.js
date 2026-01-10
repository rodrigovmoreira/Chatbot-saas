// Mock Firebase Admin BEFORE any other imports
// This prevents 'config/upload.js' from crashing when it calls admin.storage().bucket()
jest.mock('firebase-admin', () => {
  const mockBucket = {
    file: jest.fn(() => ({
      save: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(true),
      makePublic: jest.fn().mockResolvedValue(true),
      publicUrl: jest.fn().mockReturnValue('https://mock-storage.com/file.jpg'),
    })),
  };

  return {
    credential: {
      cert: jest.fn().mockReturnValue({}),
    },
    initializeApp: jest.fn(),
    apps: [],
    storage: jest.fn(() => ({
      bucket: jest.fn(() => mockBucket),
    })),
  };
});

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Increase timeout for download of mongo memory server
jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  process.env.MONGO_URI_TEST = mongoUri;
  process.env.MONGO_URI = mongoUri;

  // Mock Google Credentials for Passport
  process.env.GOOGLE_CLIENT_ID = 'mock_client_id';
  process.env.GOOGLE_CLIENT_SECRET = 'mock_client_secret';

  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Helper to clear database between tests
async function clearDatabase() {
  if (mongoose.connection.readyState === 0) return;

  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
}

module.exports = { clearDatabase };
