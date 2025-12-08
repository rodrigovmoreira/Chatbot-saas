const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, default: null },

  isBusiness: { type: Boolean, default: false },

  lastSender: { type: String, enum: ['user', 'bot'], default: 'user' }, // Quem falou por último?
  followUpStage: { type: Number, default: 0 },

  lastInteraction: { type: Date, default: Date.now },
  totalMessages: { type: Number, default: 0 },

  tags: [{ type: String }],

  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'SystemUser', default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

contactSchema.index({ lastInteraction: -1 });
contactSchema.index({ assignedTo: 1 });

contactSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Contact', contactSchema);