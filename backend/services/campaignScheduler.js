const cron = require('node-cron');
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const CampaignLog = require('../models/CampaignLog');
const Contact = require('../models/Contact');
const Appointment = require('../models/Appointment');
const BusinessConfig = require('../models/BusinessConfig');
const { callDeepSeek } = require('./aiService');
const { sendUnifiedMessage } = require('./responseService');
const { getLastMessages } = require('./message');

const SCHEDULE_INTERVAL = '0 0-23 * * *'; // Every hour? No, prompt says "Runs every minute".
// Cron pattern for every minute: '* * * * *'
const CRON_EXPRESSION = '* * * * *';

async function processCampaigns() {
  //console.log('🔄 [CampaignScheduler] Checking active campaigns...');

  try {
    const campaigns = await Campaign.find({ isActive: true });

    for (const campaign of campaigns) {
      try {
        if (campaign.triggerType === 'time') {
          await processTimeCampaign(campaign);
        } else if (campaign.triggerType === 'event') {
          await processEventCampaign(campaign);
        }
      } catch (err) {
        console.error(`❌ Error processing campaign ${campaign._id}:`, err);
      }
    }
  } catch (error) {
    console.error('❌ Error in CampaignScheduler:', error);
  }
}

async function processTimeCampaign(campaign) {
  const config = await BusinessConfig.findOne({ userId: campaign.userId });
  const timeZone = config?.operatingHours?.timezone || 'America/Sao_Paulo';
  const now = new Date();
  let shouldTrigger = false;

  const frequency = campaign.schedule?.frequency;

  if (['minutes_30', 'hours_1', 'hours_6', 'hours_12'].includes(frequency)) {
    // INTERVAL LOGIC
    const lastRun = campaign.stats?.lastRun ? new Date(campaign.stats.lastRun) : null;
    let intervalMs = 0;

    switch (frequency) {
      case 'minutes_30': intervalMs = 30 * 60 * 1000; break;
      case 'hours_1': intervalMs = 60 * 60 * 1000; break;
      case 'hours_6': intervalMs = 6 * 60 * 60 * 1000; break;
      case 'hours_12': intervalMs = 12 * 60 * 60 * 1000; break;
    }

    if (!lastRun || (now.getTime() - lastRun.getTime()) >= intervalMs) {
      shouldTrigger = true;
      // Update lastRun immediately to prevent double firing in next tick
      await Campaign.updateOne({ _id: campaign._id }, { 'stats.lastRun': now });
    }
  } else {
    // CLOCK TIME LOGIC (Daily, Weekly, Monthly, Once)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short', // Sun, Mon, Tue...
      hour12: false
    });

    const parts = formatter.formatToParts(now);
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const weekdayStr = parts.find(p => p.type === 'weekday').value; // 'Sun', 'Mon' etc.

    const currentHM = `${hour}:${minute}`;

    // Map weekday string to index (0-6)
    const daysMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const currentDay = daysMap[weekdayStr];

    // Debug for Testing
    if (process.env.NODE_ENV === 'test') {
      console.log(`[DEBUG] Time Check: Campaign=${campaign.name}, Schedule=${campaign.schedule.time}, Current=${currentHM}, Day=${currentDay}`);
    }

    // Check Days
    if (campaign.schedule.days.length > 0 && !campaign.schedule.days.includes(currentDay)) {
      return; // Not today
    }

    // Check Time
    if (campaign.schedule.time === currentHM) {
      shouldTrigger = true;
      // For clock-based, we also update lastRun to track history, though logic uses clock time
      await Campaign.updateOne({ _id: campaign._id }, { 'stats.lastRun': now });
    }
  }

  if (!shouldTrigger) {
    return;
  }

  console.log(`🎯 Triggering TIME campaign: ${campaign.name} (${campaign._id})`);

  // 2. Find Targets
  // Only users with phone numbers
  const contacts = await Contact.find({
    businessId: config._id,
    tags: { $in: campaign.targetTags },
    isHandover: false,
    phone: { $exists: true, $ne: null }
  });

  console.log(`👥 Found ${contacts.length} potential targets for campaign ${campaign.name}`);

  for (const contact of contacts) {
    await dispatchCampaign(campaign, contact, null, config);
  }
}

async function processEventCampaign(campaign) {
  // 1. Calculate Time Window
  // targetTime = appointment.start - offset
  // trigger if targetTime is NOW (within this minute)
  // So: appointment.start = NOW + offset

  const now = new Date();
  const offsetMinutes = campaign.eventOffset || 0;

  // We want appointments starting in [now + offset, now + offset + 1min]
  const startRange = new Date(now.getTime() + offsetMinutes * 60000);
  const endRange = new Date(startRange.getTime() + 60000); // +1 minute window

  // Find appointments
  const appointments = await Appointment.find({
    userId: campaign.userId,
    status: { $in: campaign.eventTargetStatus },
    start: {
      $gte: startRange,
      $lt: endRange
    }
  });

  if (appointments.length > 0) {
      console.log(`📅 Found ${appointments.length} appointments for EVENT campaign: ${campaign.name}`);
  }

  const config = await BusinessConfig.findOne({ userId: campaign.userId });

  for (const appt of appointments) {
    // Find contact by phone
    const contact = await Contact.findOne({
      businessId: config._id,
      phone: appt.clientPhone // Assuming exact match. formatToE164 should be used on creation
    });

    if (contact && contact.isHandover) continue; // Skip if human is talking

    // If contact not found but we have phone, we can still send?
    // The prompt says "Use the contact associated...".
    // If no contact doc exists, we might create a temp one or just send if we have the number?
    // Dispatch logic expects a contact object for filtering history etc.
    // If no contact, we can construct a minimal one.
    const targetContact = contact || {
      _id: null,
      phone: appt.clientPhone,
      name: appt.clientName,
      businessId: config._id
    };

    await dispatchCampaign(campaign, targetContact, appt, config);
  }
}

async function dispatchCampaign(campaign, contact, appointment, config) {
  // 1. Exclusion Logic (Already Sent?)

  // For Broadcast: Check if ANY log exists for this campaign + contact
  if (campaign.type === 'broadcast') {
    const exists = await CampaignLog.exists({
      campaignId: campaign._id,
      contactId: contact._id
    });
    if (exists) return; // Already sent
  }

  // For Recurring: Check if sent TODAY
  if (campaign.type === 'recurring') {
    const today = new Date();
    today.setHours(0,0,0,0);
    const exists = await CampaignLog.exists({
      campaignId: campaign._id,
      contactId: contact._id,
      sentAt: { $gte: today }
    });
    if (exists) return; // Already sent today
  }

  // For Event: Check if sent for this APPOINTMENT
  if (campaign.triggerType === 'event' && appointment) {
    const exists = await CampaignLog.exists({
        campaignId: campaign._id,
        relatedId: appointment._id.toString()
    });
    if (exists) return; // Already sent for this appointment
  }

  // 2. Content Logic
  let messageToSend = campaign.message;

  if (campaign.contentMode === 'ai_prompt') {
    // AI Generation
    try {
      const history = contact._id
        ? await getLastMessages(contact.phone, 10, contact.businessId, 'whatsapp')
        : [];

      const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n');

      const prompt = `
SYSTEM: You are an assistant sending a campaign message.
CAMPAIGN GOAL: ${campaign.message}
CONTEXT:
Client Name: ${contact.name}
Appointment: ${appointment ? `${appointment.title} at ${appointment.start}` : 'N/A'}
Chat History:
${historyText}

INSTRUCTION: Generate a short, friendly WhatsApp message based on the CAMPAIGN GOAL.
Do not be repetitive.
If there is an appointment, mention it naturally.
OUTPUT: Only the message text.
`;
      const aiResponse = await callDeepSeek([{ role: 'user', content: prompt }]);
      messageToSend = aiResponse.trim();
    } catch (e) {
      console.error('Campaign AI generation failed, falling back to static:', e);
      // Fallback to static message? Or fail? Prompt says "Use AI's output".
      // If AI fails, maybe better to skip or use static.
      // I'll use static as fallback to ensure delivery.
    }
  } else {
    // Static mode: Replace variables if needed?
    // Prompt doesn't specify variable replacement for static, but it's good practice.
    // "Use campaign.message directly" -> Okay.

    // Minimal replacement for Event
    if (appointment) {
        messageToSend = messageToSend
            .replace('{{name}}', appointment.clientName)
            .replace('{{time}}', new Date(appointment.start).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}));
    }
  }

  // 3. Humanized Dispatch
  const minDelay = (campaign.delayRange?.min || 0) * 1000;
  const maxDelay = (campaign.delayRange?.max || 5) * 1000; // Default 5s if 0
  let delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

  if (process.env.NODE_ENV === 'test') {
    delay = 0;
  }

  console.log(`⏳ Scheduling send to ${contact.phone} in ${delay}ms`);

  const executeDispatch = async () => {
    try {
      const sent = await sendUnifiedMessage(contact.phone, messageToSend, 'wwebjs', campaign.userId);

      const logStatus = sent ? 'sent' : 'failed';

      await CampaignLog.create({
        campaignId: campaign._id,
        contactId: contact._id || new mongoose.Types.ObjectId(), // Handle temp contact
        relatedId: appointment ? appointment._id.toString() : null,
        messageContent: messageToSend,
        status: logStatus,
        sentAt: new Date()
      });

    } catch (err) {
      console.error(`💥 Failed to send campaign message to ${contact.phone}:`, err);
      await CampaignLog.create({
        campaignId: campaign._id,
        contactId: contact._id || new mongoose.Types.ObjectId(),
        status: 'failed',
        error: err.message
      });
    }
  };

  if (delay === 0) {
    await executeDispatch();
  } else {
    setTimeout(executeDispatch, delay);
  }
}

function initScheduler() {
  // Start the cron job
  cron.schedule(CRON_EXPRESSION, processCampaigns);
  console.log('🚀 Campaign Scheduler initialized (runs every minute).');
}

module.exports = { initScheduler, processCampaigns };
