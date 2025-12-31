const { handleIncomingMessage } = require('../../messageHandler');
const { sendUnifiedMessage } = require('../../services/responseService');
const { saveMessage, getLastMessages } = require('../../services/message');
const BusinessConfig = require('../../models/BusinessConfig');

// Mocks
jest.mock('../../services/responseService');
jest.mock('../../services/message');
jest.mock('../../models/BusinessConfig');
jest.mock('../../services/aiTools', () => ({
  checkAvailability: jest.fn(),
  createAppointmentByAI: jest.fn(),
  searchProducts: jest.fn()
}));
jest.mock('../../services/visionService', () => ({
  analyzeImage: jest.fn()
}));
jest.mock('../../services/transcriptionService', () => ({
  transcribeAudio: jest.fn()
}));

// Mock Axios for DeepSeek calls
const axios = require('axios');
jest.mock('axios');

describe('Message Flow Integration Test', () => {
  const mockBusinessId = 'biz_123';
  const mockFrom = '5511999998888@c.us';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers(); // Reset to default fake timers (modern)

    // Mock BusinessConfig
    BusinessConfig.findById.mockResolvedValue({
      _id: mockBusinessId,
      userId: 'user_123',
      prompts: { chatSystem: 'You are a helpful assistant.' },
      operatingHours: { active: true, timezone: 'America/Sao_Paulo', opening: '00:00', closing: '23:59' }, // Always open
      socialMedia: {},
      products: []
    });

    // Mock History
    getLastMessages.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should process "Olá" and send a welcome response', async () => {
    jest.setTimeout(5000); // Reduce timeout to fail fast if it hangs
    // 1. Setup Mock for DeepSeek (The Brain)
    axios.post.mockResolvedValue({
      data: {
        choices: [
          { message: { content: 'Olá! Como posso ajudar você hoje?' } }
        ]
      }
    });

    // 2. Simulate Incoming Message
    const incomingMsg = {
      from: mockFrom,
      body: 'Olá',
      name: 'Test User',
      type: 'text',
      provider: 'wwebjs'
    };

    // 3. Trigger Handler
    await handleIncomingMessage(incomingMsg, mockBusinessId);

    // 4. Fast-forward buffer timer (11s)
    // IMPORTANT: We need to advance timers AND wait for the promise chain.
    // The buffer uses setTimeout.
    jest.advanceTimersByTime(12000);

    // 5. Wait for promise queue to clear BEFORE the sleep.
    // We force pending promises to resolve by yielding the event loop.
    // However, when using fake timers, sometimes Promises resolve immediately
    // if they are not waiting on timers, but if they wait on microtasks, we need to yield.
    // "processBufferedMessages" calls "await saveMessage" -> yield
    // calls "getLastMessages" -> yield
    // calls "callDeepSeek" (axios) -> yield

    // Advance time slightly to ensure buffer callback runs
    // jest.advanceTimersByTime(12000); // Already called above

    // Flush promises loop
    // With Modern Fake Timers, "await Promise.resolve()" isn't enough if timers are involved in microtask queue?
    // Actually, "processBufferedMessages" is called by setTimeout(..., 11000).
    // jest.advanceTimersByTime(12000) triggers it.
    // But since it is an async function, the timer callback returns a promise that Jest doesn't await.

    // We need to wait for the internal logic.
    // Since we used `jest.useFakeTimers()`, `setTimeout` is mocked.
    // `await new Promise(r => setTimeout(r, 100))` would normally hang if we don't advance,
    // BUT we are about to advance again or we need to just wait for microtasks.

    // Strategy:
    // The callback is running. It awaits saveMessage.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // It awaits getLastMessages
    await Promise.resolve();
    await Promise.resolve();

    // It awaits callDeepSeek (axios)
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve(); // Extra ticks

    // Now it should be at sleep(delay)
    jest.advanceTimersByTime(20000);

    // It awaits sendUnifiedMessage
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // 7. Verify "saveMessage" was called for the user input
    expect(saveMessage).toHaveBeenCalledWith(
      mockFrom,
      'user',
      'Olá',
      'text',
      null,
      mockBusinessId
    );

    // 7. Verify DeepSeek was called
    expect(axios.post).toHaveBeenCalled();

    // 8. Verify Response was Sent
    expect(sendUnifiedMessage).toHaveBeenCalledWith(
      mockFrom,
      'Olá! Como posso ajudar você hoje?',
      'wwebjs',
      'user_123'
    );
  });
});
