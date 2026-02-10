
const { handleIncomingMessage } = require('../backend/messageHandler');

async function testIronGate() {
    console.log('🛡️ Testing Iron Gate Logic in messageHandler.js...');

    // Mock BusinessConfig findById to prevent crash if it gets there
    const BusinessConfig = require('../backend/models/BusinessConfig');
    BusinessConfig.findById = async () => ({ aiGlobalDisabled: false, operatingHours: { active: false } });

    // Mock saveMessage if needed, but likely we won't get that far for blocked ones.
    // For allowed ones, we might crash on other things, but let's see.

    const testCases = [
        {
            name: 'Valid Contact',
            msg: { from: '5511999999999', body: 'Hello', type: 'text' },
            shouldBlock: false
        },
        {
            name: 'Group Chat',
            msg: { from: '123456789@g.us', body: 'Hello Group', type: 'text' },
            shouldBlock: true
        },
        {
            name: 'Status Broadcast',
            msg: { from: 'status@broadcast', body: 'Status Update', type: 'text' },
            shouldBlock: true
        },
        {
            name: 'Newsletter',
            msg: { from: '123456@newsletter', body: 'News', type: 'text' },
            shouldBlock: true
        },
        {
            name: 'Long Technical ID (Community)',
            msg: { from: '120363335026718801', body: 'Community Msg', type: 'text' }, // 18 digits
            shouldBlock: true
        },
        {
            name: 'Short Number (Valid)',
            msg: { from: '1234567890', body: 'Short', type: 'text' }, // 10 digits
            shouldBlock: false
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of testCases) {
        console.log(`\n--- Test: ${test.name} ---`);
        let result;
        try {
            result = await handleIncomingMessage(test.msg, 'dummy_biz_id');
        } catch (e) {
            console.log(`(Crashed as expected for valid msg: ${e.message.split('\n')[0]})`);
            result = { proceeded: true };
        }

        const isBlockedError = result && result.error === "Blocked Source (Group/Channel/Invalid)";
        const wasBlocked = !!isBlockedError;

        if (test.shouldBlock === wasBlocked) {
            console.log(`✅ Passed. (Expected Block=${test.shouldBlock}, Got=${wasBlocked})`);
            passed++;
        } else {
            console.error(`❌ Failed. (Expected Block=${test.shouldBlock}, Got=${wasBlocked})`);
            console.error('Result was:', result);
            failed++;
        }
    }

    console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
}

testIronGate();
