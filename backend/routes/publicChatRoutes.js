const express = require('express');
const router = express.Router();
const BusinessConfig = require('../models/BusinessConfig');
const { handleIncomingMessage } = require('../messageHandler');

router.post('/send', async (req, res) => {
  try {
    const { businessId, sessionId, message } = req.body;

    // Validate inputs
    if (!businessId || !sessionId || !message) {
      return res.status(400).json({ error: 'Missing required fields: businessId, sessionId, message' });
    }

    // Verify BusinessConfig exists
    const businessConfig = await BusinessConfig.findById(businessId);
    if (!businessConfig) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Construct Normalized Message
    const normalizedMsg = {
      from: sessionId,
      name: 'Visitante', // Default name for now, could be passed in body
      body: message,
      type: 'text',
      channel: 'web',
      provider: 'web'
    };

    // Call Handler and Wait for Response
    const response = await handleIncomingMessage(normalizedMsg, businessId);

    // Return the response
    if (response && response.text) {
        return res.json({ response: response.text });
    } else if (response && response.error) {
        return res.status(500).json({ error: response.error });
    } else {
        // Fallback if no response text (should not happen with current logic)
        return res.json({ response: "" });
    }

  } catch (error) {
    console.error('Error in Public Chat API:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET Public Business Info (for the chat header)
router.get('/config/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const businessConfig = await BusinessConfig.findById(businessId).select('businessName operatingHours');
    if (!businessConfig) {
      return res.status(404).json({ error: 'Business not found' });
    }
    res.json(businessConfig);
  } catch (error) {
    console.error('Error fetching business config:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
