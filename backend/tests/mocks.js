const mockWWebJS = {
  initializeWWebJS: jest.fn(),
  getSessionStatus: jest.fn(() => ({ status: 'CONNECTED' })),
  getSessionQR: jest.fn(),
  closeAllSessions: jest.fn(),
  sendMessage: jest.fn(() => Promise.resolve(true)),
};

const mockAIService = {
  callDeepSeek: jest.fn(() => Promise.resolve('Mocked AI Response')),
};

const mockResponseService = {
  sendUnifiedMessage: jest.fn(() => Promise.resolve(true)),
};

module.exports = { mockWWebJS, mockAIService, mockResponseService };
