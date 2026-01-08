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
    const { name, targetTags, type, message, isActive, schedule } = req.body;

    // Basic validation
    if (!name || !type || !message || !schedule || !schedule.time) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const campaign = new Campaign({
      userId: req.user.userId,
      name,
      targetTags,
      type,
      message,
      isActive,
      schedule
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
