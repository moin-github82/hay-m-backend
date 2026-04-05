const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  ticker:     { type: String, required: true, uppercase: true },
  type:       { type: String, enum: ['stock', 'crypto', 'etf', 'bond', 'cash'], required: true },
  shares:     { type: Number, required: true },
  avgBuyPrice: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  color:      { type: String, default: '#00D4A1' },
});

holdingSchema.virtual('value').get(function () {
  return parseFloat((this.shares * this.currentPrice).toFixed(2));
});

holdingSchema.virtual('gainLoss').get(function () {
  return parseFloat(((this.currentPrice - this.avgBuyPrice) * this.shares).toFixed(2));
});

holdingSchema.virtual('gainLossPct').get(function () {
  return parseFloat((((this.currentPrice - this.avgBuyPrice) / this.avgBuyPrice) * 100).toFixed(2));
});

holdingSchema.set('toJSON', { virtuals: true });

const portfolioSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  holdings: [holdingSchema],
  history:  [{ date: Date, value: Number }],
}, { timestamps: true });

portfolioSchema.virtual('totalValue').get(function () {
  return parseFloat(this.holdings.reduce((sum, h) => sum + h.shares * h.currentPrice, 0).toFixed(2));
});

portfolioSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Portfolio', portfolioSchema);
