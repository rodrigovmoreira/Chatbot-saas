const BusinessConfig = require('../../models/BusinessConfig');
const { checkAvailability } = require('../../services/aiTools');
const mongoose = require('mongoose');

describe('AI Tools - checkAvailability', () => {
    let businessConfigMock;

    beforeEach(() => {
        businessConfigMock = {
            userId: new mongoose.Types.ObjectId(),
            minSchedulingNoticeMinutes: 60,
            timezone: 'America/Sao_Paulo',
            operatingHours: {
                opening: '09:00',
                closing: '18:00',
                timezone: 'America/Sao_Paulo'
            }
        };

        // Mock BusinessConfig.findOne
        jest.spyOn(BusinessConfig, 'findOne').mockResolvedValue(businessConfigMock);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should reject if start time is within buffer period', async () => {
        // Mock Date.now() to a fixed time: 2023-10-27 10:00:00 UTC
        // But wait, the code uses new Date() inside. We can spy on Date or just use relative times.
        // Let's rely on relative times.

        const now = new Date();
        const bufferMinutes = 60;

        // Try to book for 30 mins from now
        const startTime = new Date(now.getTime() + 30 * 60000);
        const endTime = new Date(now.getTime() + 90 * 60000);

        const result = await checkAvailability(businessConfigMock.userId, startTime, endTime);

        expect(result.available).toBe(false);
        expect(result.reason).toContain(`Necessário agendar com no mínimo ${bufferMinutes} minutos de antecedência`);
    });

    test('should allow if start time is after buffer period', async () => {
        const now = new Date();
        // Try to book for 120 mins from now
        const startTime = new Date(now.getTime() + 120 * 60000);
        const endTime = new Date(now.getTime() + 180 * 60000);

        // We also need to make sure this time is within operating hours.
        // Since we didn't mock operating hours check fully (it parses hours),
        // we might fail there if 'now' + 2h is night time.
        // Let's mock operating hours to be always open for this test or bypass it.
        // Or better, let's mock Date.now to be 10:00 AM business time.

        // Complex to mock Date.now globally cleanly in this env.
        // Instead, let's ensure the time we pick is likely working hours or mock the config to be 24h.
        businessConfigMock.operatingHours = { opening: '00:00', closing: '23:59', timezone: 'UTC' };

        // Mock appointment findOne to return null (no conflict)
        const Appointment = require('../../models/Appointment');
        jest.spyOn(Appointment, 'findOne').mockResolvedValue(null);

        const result = await checkAvailability(businessConfigMock.userId, startTime, endTime);
        expect(result.available).toBe(true);
    });
});
