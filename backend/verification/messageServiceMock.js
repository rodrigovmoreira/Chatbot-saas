// Mock for messageService to avoid DB calls in mocked environment
module.exports = {
  getLastMessages: async () => [],
  saveMessage: async () => {}
};
