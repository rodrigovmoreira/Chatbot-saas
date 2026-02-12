const BusinessConfig = require('../../models/BusinessConfig');
const Contact = require('../../models/Contact');
const { analyzeImage } = require('../../services/visionService');
const { transcribeAudio } = require('../../services/transcriptionService');
const { saveMessage, getLastMessages } = require('../../services/message');
const { callDeepSeek, buildSystemPrompt } = require('../../services/aiService');
const { sendUnifiedMessage } = require('../../services/responseService');

// Mock dependencies with factories to prevent module loading execution
jest.mock('../../models/BusinessConfig', () => ({
    findById: jest.fn()
}));
jest.mock('../../models/Contact', () => ({
    findOne: jest.fn(),
    create: jest.fn()
}));
jest.mock('../../services/visionService', () => ({
    analyzeImage: jest.fn()
}));
jest.mock('../../services/transcriptionService', () => ({
    transcribeAudio: jest.fn()
}));
jest.mock('../../services/message', () => ({
    saveMessage: jest.fn(),
    getLastMessages: jest.fn()
}));
jest.mock('../../services/aiService', () => ({
    callDeepSeek: jest.fn(),
    buildSystemPrompt: jest.fn()
}));
jest.mock('../../services/responseService', () => ({
    sendUnifiedMessage: jest.fn()
}));
jest.mock('../../services/wwebjsService', () => ({
    sendImage: jest.fn()
}));

// Also mock potentially troublesome external libs if they leak through
jest.mock('@google/genai', () => ({ GoogleGenAI: class {} }), { virtual: true });

// Require the module under test AFTER mocks are set up
const { handleIncomingMessage, processBufferedMessages } = require('../../messageHandler');

// Mock timers for buffer processing
jest.useFakeTimers();

describe('Lazy Media Processing in MessageHandler', () => {
    const mockBusinessId = 'biz123';
    const mockFrom = '5511999999999';
    const mockBufferKey = `${mockBusinessId}_${mockFrom}`;

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mocks
        BusinessConfig.findById.mockResolvedValue({
            _id: mockBusinessId,
            aiGlobalDisabled: false,
            operatingHours: null, // No operating hours = Always Open
            prompts: { visionSystem: 'Vision Prompt' }
        });

        Contact.findOne.mockResolvedValue({
            isHandover: false,
            tags: []
        });

        getLastMessages.mockResolvedValue([]);
        callDeepSeek.mockResolvedValue("AI Response");
        buildSystemPrompt.mockResolvedValue("System Prompt");
    });

    test('should NOT process media if Handover is active (Lazy Check)', async () => {
        // Setup Handover
        Contact.findOne.mockResolvedValue({ isHandover: true });

        // Simulate Incoming Image (Web Channel avoids sleep delay)
        const mediaData = { data: 'base64image', mimetype: 'image/jpeg' };

        const responsePromise = handleIncomingMessage({
            from: mockFrom,
            body: '',
            type: 'image',
            mediaData,
            provider: 'whatsapp',
            channel: 'web'
        }, mockBusinessId);

        // Fast-forward buffer timer
        jest.runAllTimers();

        // Wait for the promise to resolve (since it's web channel)
        await responsePromise;

        // Expectations
        expect(analyzeImage).not.toHaveBeenCalled(); // Lazy!
        expect(saveMessage).toHaveBeenCalledWith(
            mockFrom, 'user', expect.stringContaining('[Imagem recebida]'), 'text', null, mockBusinessId, 'web', undefined
        );
        expect(callDeepSeek).not.toHaveBeenCalled(); // Handover stops AI
    });

    test('should NOT process media if Global AI Disabled', async () => {
        BusinessConfig.findById.mockResolvedValue({
            _id: mockBusinessId,
            aiGlobalDisabled: true
        });

        const mediaData = { data: 'base64audio', mimetype: 'audio/ogg' };

        const responsePromise = handleIncomingMessage({
            from: mockFrom,
            body: '',
            type: 'audio',
            mediaData,
            provider: 'whatsapp',
            channel: 'web'
        }, mockBusinessId);

        jest.runAllTimers();
        await responsePromise;

        expect(transcribeAudio).not.toHaveBeenCalled();
        expect(saveMessage).toHaveBeenCalledWith(
            mockFrom, 'user', expect.stringContaining('[Áudio recebido]'), 'text', null, mockBusinessId, 'web', undefined
        );
        expect(callDeepSeek).not.toHaveBeenCalled();
    });

    test('should PROCESS media if Bot is Active (Allowed)', async () => {
        // Setup mocks for success
        analyzeImage.mockResolvedValue('A lovely cat');

        const mediaData = { data: 'base64image', mimetype: 'image/jpeg' };

        const responsePromise = handleIncomingMessage({
            from: mockFrom,
            body: 'Look at this',
            type: 'image',
            mediaData,
            provider: 'whatsapp',
            channel: 'web'
        }, mockBusinessId);

        jest.runAllTimers();
        await responsePromise;

        expect(analyzeImage).toHaveBeenCalledWith(mediaData, 'Vision Prompt');

        // Verify saveMessage content includes description
        expect(saveMessage).toHaveBeenCalledWith(
            mockFrom, 'user', expect.stringContaining('[VISÃO]: A lovely cat'), 'text', null, mockBusinessId, 'web', undefined
        );

        // Verify AI called
        expect(callDeepSeek).toHaveBeenCalled();
    });

    test('should PROCESS audio if Bot is Active', async () => {
        transcribeAudio.mockResolvedValue('Hello world');

        const mediaData = { data: 'base64audio', mimetype: 'audio/ogg' };

        const responsePromise = handleIncomingMessage({
            from: mockFrom,
            body: '',
            type: 'audio',
            mediaData,
            provider: 'whatsapp',
            channel: 'web'
        }, mockBusinessId);

        jest.runAllTimers();
        await responsePromise;

        expect(transcribeAudio).toHaveBeenCalledWith(mediaData);
        expect(saveMessage).toHaveBeenCalledWith(
            mockFrom, 'user', expect.stringContaining('[Áudio]: "Hello world"'), 'text', null, mockBusinessId, 'web', undefined
        );
    });

    test('should NOT process media if Audience Filter blocks (Tags)', async () => {
        // Setup Tag Block (Whitelist Mode, Contact has no tags)
        BusinessConfig.findById.mockResolvedValue({
            _id: mockBusinessId,
            aiResponseMode: 'whitelist',
            aiWhitelistTags: ['vip'],
            operatingHours: null
        });

        Contact.findOne.mockResolvedValue({
            tags: [] // No VIP tag
        });

        const mediaData = { data: 'base64image', mimetype: 'image/jpeg' };
        const responsePromise = handleIncomingMessage({
            from: mockFrom,
            body: '',
            type: 'image',
            mediaData,
            provider: 'whatsapp',
            channel: 'web'
        }, mockBusinessId);

        jest.runAllTimers();
        await responsePromise;

        expect(analyzeImage).not.toHaveBeenCalled();
        expect(saveMessage).toHaveBeenCalledWith(
            mockFrom, 'user', expect.stringContaining('[Imagem recebida]'), 'text', null, mockBusinessId, 'web', undefined
        );
    });
});
