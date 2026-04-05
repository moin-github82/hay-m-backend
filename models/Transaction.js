const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:      { type: String, enum: ['credit', 'debit'], required: true },
  category:  { type: String, enum: ['salary', 'transfer', 'investment', 'goal', 'subscription', 'payment', 'refund', 'topup', 'other'], default: 'other' },
  title:     { type: String, required: true },
  subtitle:  { type: String },
  amount:    { type: Number, required: true },
  icon:      { type: String, default: 'cash-outline' },
  status:    { type: String, enum: ['completed', 'pending', 'failed'], default: 'completed' },
  toUser:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  note:      { type: String },
  cardId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Card', default: null },
}, { timestamps: true });

transactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
