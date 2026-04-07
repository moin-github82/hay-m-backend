const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:      { type: String, enum: ['Visa', 'Mastercard', 'Amex', 'Discover'], required: true },
  bank:      { type: String, required: true },
  last4:     { type: String, required: true, length: 4 },
  holder:    { type: String, required: true },
  expiry:    { type: String, default: '' },
  balance:   { type: Number, default: 0 },
  gradient:  { type: [String], default: ['#0A1628', '#1C3D6E'] },
  isDefault: { type: Boolean, default: false },
  isFrozen:  { type: Boolean, default: false },
  accountType: { type: String, enum: ['card', 'bank'], default: 'card' },
  accountNumber: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Card', cardSchema);
