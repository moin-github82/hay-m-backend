const mongoose = require('mongoose');

const roundUpSchema = new mongoose.Schema({
  merchant:    { type: String, required: true },
  category:    { type: String, default: 'other' },
  icon:        { type: String, default: 'storefront-outline' },
  spentAmount: { type: Number, required: true },
  savedAmount: { type: Number, required: true },
  note:        { type: String },
  createdAt:   { type: Date, default: Date.now },
});

const surplusSchema = new mongoose.Schema({
  amount:    { type: Number, required: true },
  note:      { type: String, default: 'Manual deposit' },
  createdAt: { type: Date, default: Date.now },
});

// Tracks money withdrawn from micro-savings to fund a goal
const withdrawalSchema = new mongoose.Schema({
  amount:    { type: Number, required: true },
  goalId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Goal' },
  goalName:  { type: String },
  note:      { type: String, default: 'Goal transfer' },
  createdAt: { type: Date, default: Date.now },
});

const savingsTrackerSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  dailyLimit:   { type: Number, default: 5 },
  monthlyLimit: { type: Number, default: 100 },
  roundUps:    [roundUpSchema],
  surplus:     [surplusSchema],
  withdrawals: [withdrawalSchema],   // ← NEW: goal transfers out
}, { timestamps: true });

// Total saved = round-ups + surplus − withdrawals
savingsTrackerSchema.virtual('totalSaved').get(function () {
  const r = this.roundUps.reduce((s, t) => s + t.savedAmount, 0);
  const p = this.surplus.reduce((s, t) => s + t.amount, 0);
  const w = this.withdrawals.reduce((s, t) => s + t.amount, 0);
  return parseFloat(Math.max(r + p - w, 0).toFixed(2));
});

// Today's savings (deposits only — withdrawals don't affect today's count)
savingsTrackerSchema.virtual('todaySaved').get(function () {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const r = this.roundUps.filter(t => new Date(t.createdAt) >= start).reduce((s, t) => s + t.savedAmount, 0);
  const p = this.surplus.filter(t => new Date(t.createdAt) >= start).reduce((s, t) => s + t.amount, 0);
  return parseFloat((r + p).toFixed(2));
});

// This month's savings (deposits only)
savingsTrackerSchema.virtual('monthSaved').get(function () {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const r = this.roundUps.filter(t => new Date(t.createdAt) >= start).reduce((s, t) => s + t.savedAmount, 0);
  const p = this.surplus.filter(t => new Date(t.createdAt) >= start).reduce((s, t) => s + t.amount, 0);
  return parseFloat((r + p).toFixed(2));
});

savingsTrackerSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('SavingsTracker', savingsTrackerSchema);
