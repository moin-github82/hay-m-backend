const Portfolio = require('../models/Portfolio');

exports.getPortfolio = async (req, res) => {
  try {
    let portfolio = await Portfolio.findOne({ user: req.user._id });
    if (!portfolio) {
      portfolio = await Portfolio.create({ user: req.user._id, holdings: [], history: [] });
    }
    res.json({ success: true, data: portfolio });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addHolding = async (req, res) => {
  try {
    const { name, ticker, type, shares, avgBuyPrice, currentPrice, color } = req.body;

    const portfolio = await Portfolio.findOne({ user: req.user._id });
    if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });

    // If holding already exists, update shares
    const existingIdx = portfolio.holdings.findIndex(h => h.ticker === ticker.toUpperCase());
    if (existingIdx > -1) {
      const existing = portfolio.holdings[existingIdx];
      const totalShares = existing.shares + shares;
      const avgPrice = ((existing.avgBuyPrice * existing.shares) + (avgBuyPrice * shares)) / totalShares;
      portfolio.holdings[existingIdx].shares = totalShares;
      portfolio.holdings[existingIdx].avgBuyPrice = parseFloat(avgPrice.toFixed(4));
      portfolio.holdings[existingIdx].currentPrice = currentPrice;
    } else {
      portfolio.holdings.push({ name, ticker, type, shares, avgBuyPrice, currentPrice, color });
    }

    // Snapshot portfolio value to history
    portfolio.history.push({ date: new Date(), value: portfolio.totalValue });

    await portfolio.save();

    req.io.to(req.user._id.toString()).emit('portfolio:updated', { portfolio });

    res.json({ success: true, data: portfolio });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePrices = async (req, res) => {
  try {
    const { prices } = req.body; // { AAPL: 178.5, TSLA: 251.2, ... }

    const portfolio = await Portfolio.findOne({ user: req.user._id });
    if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });

    portfolio.holdings.forEach(h => {
      if (prices[h.ticker] !== undefined) {
        h.currentPrice = prices[h.ticker];
      }
    });

    portfolio.history.push({ date: new Date(), value: portfolio.totalValue });
    await portfolio.save();

    req.io.to(req.user._id.toString()).emit('portfolio:pricesUpdated', { portfolio });

    res.json({ success: true, data: portfolio });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeHolding = async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.user._id });
    if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });

    portfolio.holdings = portfolio.holdings.filter(h => h._id.toString() !== req.params.holdingId);
    await portfolio.save();

    res.json({ success: true, data: portfolio });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
