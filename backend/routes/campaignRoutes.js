const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const authenticateToken = require('../middleware/auth');

// List all campaigns for the logged-in user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const campaigns = await Campaign.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ message: 'Error fetching campaigns' });
  }
});

// Create a new campaign
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name, targetTags, type, message, isActive, schedule, delayRange,
      triggerType, eventOffset, eventTargetStatus
    } = req.body;

    // Basic validation
    if (!name || !type || !message) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate schedule if triggerType is time (or undefined, defaulting to time)
    if ((!triggerType || triggerType === 'time') && (!schedule || !schedule.time)) {
      return res.status(400).json({ message: 'Missing schedule time for time-based campaign' });
    }

    const campaign = new Campaign({
      userId: req.user.userId,
      name,
      targetTags,
      type,
      message,
      isActive,
      schedule,
      delayRange,
      triggerType,
      eventOffset,
      eventTargetStatus
    });

    const savedCampaign = await campaign.save();
    res.status(201).json(savedCampaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ message: 'Error creating campaign' });
  }
});

// Update a campaign
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating userId
    delete updates.userId;

    // Validate schedule if triggerType is time (or undefined, defaulting to time)
    // Note: In PUT, we need to check if triggerType is being updated or if it exists in DB.
    // However, simplest check is: if the update contains schedule data or triggerType changes to time, validate.
    // Ideally we should fetch, merge, and validate, but strict validation might break partial updates if not careful.
    // Given the frontend sends the whole object, we can validate the incoming payload if it looks like a full update.

    // For now, let's allow the update but we should ensure data integrity if possible.
    // The user requested: "Ensure the POST / and PUT /:id validators accept these new fields".
    // Since we use { ...updates }, the new fields are automatically accepted by Mongoose if they are in the Schema.
    // But we should add the same validation logic if triggerType/schedule are involved.

    if (updates.triggerType === 'time' && (!updates.schedule || !updates.schedule.time)) {
        // If switching to time, ensure time is present.
         return res.status(400).json({ message: 'Missing schedule time for time-based campaign' });
    }

    const campaign = await Campaign.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      { ...updates },
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ message: 'Error updating campaign' });
  }
});

// Delete a campaign
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findOneAndDelete({ _id: id, userId: req.user.userId });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ message: 'Error deleting campaign' });
  }
});

module.exports = router;
