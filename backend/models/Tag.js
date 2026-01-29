const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  color: {
    type: String, // Hex color
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure unique tag names per business
tagSchema.index({ businessId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Tag', tagSchema);
