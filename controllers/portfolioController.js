const Portfolio = require('../models/Portfolio');

// ─── Seed holdings shown for every new / empty portfolio ───────────────────
const SEED_HOLDINGS = [
  { name: 'Apple Inc.',       ticker: 'AAPL',  type: 'stock',  shares: 15,   avgBuyPrice: 165.00, currentPrice: 189.50, color: '#3B82F6' },
  { name: 'Microsoft Corp.',  ticker: 'MSFT',  type: 'stock',  shares: 8,    avgBuyPrice: 310.00, currentPrice: 378.90, color: '#00D4A1' },
  { name: 'NVIDIA Corp.',     ticker: 'NVDA',  type: 'stock',  shares: 3,    avgBuyPrice: 480.00, currentPrice: 875.20, color: '#A855F7' },
  { name: 'Tesla Inc.',       ticker: 'TSLA',  type: 'stock',  shares: 5,    avgBuyPrice: 245.00, currentPrice: 198.40, color: '#EF4444' },
  { name: 'Amazon.com Inc.',  ticker: 'AMZN',  type: 'stock',  shares: 4,    avgBuyPrice: 165.00, currentPrice: 185.60, color: '#10B981' },
  { name: 'Vanguard S&P 500', ticker: 'VOO',   type: 'etf',    shares: 10,   avgBuyPrice: 395.00, currentPrice: 462.30, color: '#F59E0B' },
  { name: 'Invesco QQQ ETF',  ticker: 'QQQ',   type: 'etf',    shares: 6,    avgBuyPrice: 360.00, currentPrice: 432.10, color: '#06B6D4' },
  { name: 'Bitcoin',          ticker: 'BTC',   type: 'crypto', shares: 0.05, avgBuyPrice: 42000,  currentPrice: 68500,  color: '#F97316' },
  { name: 'Ethereum',         ticker: 'ETH',   type: 'crypto', shares: 0.8,  avgBuyPrice: 2200,   currentPrice: 3450,   color: '#8B5CF6' },
  { name: 'Alphabet Inc.',    ticker: 'GOOGL', type: 'stock',  shares: 6,    avgBuyPrice: 135.00, currentPrice: 168.90, color: '#F4A261' },
];

// Generate 60 daily history snapshots for a seeded portfolio
function buildSeedHistory() {
  const history = [];
  const baseValue = 18500;
  const now = Date.now();
  for (let i = 60; i >= 0; i--) {
    const noise = (Math.sin(i * 0.4) * 800) + (Math.cos(i * 0.7) * 400) + (i < 30 ? 1200 : 0);
    history.push({ date: new Date(now - i * 86400000), value: parseFloat((baseValue + noise).toFixed(2)) });
  }
  return history;
}

exports.getPortfolio = async (req, res) => {
  try {
    let portfolio = await Portfolio.findOne({ user: req.user._id });

    if (!portfolio) {
      portfolio = await Portfolio.create({
        user: req.user._id,
        holdings: SEED_HOLDINGS,
        history: buildSeedHistory(),
      });
    } else if (portfolio.holdings.length === 0) {
      portfolio.holdings = SEED_HOLDINGS;
      portfolio.history  = buildSeedHistory();
      await portfolio.save();
    }

    const totalCost = portfolio.holdings.reduce(
      (sum, h) => sum + h.shares * h.avgBuyPrice, 0
    );

    res.json({ success: true, data: { ...portfolio.toJSON(), totalCost: parseFloat(totalCost.toFixed(2)) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addHolding = async (req, res) => {
  try {
    // Accept both frontend aliases (symbol/assetType/avgPrice) and native field names
    const body = req.body;
    const ticker       = (body.ticker   || body.symbol   || '').toUpperCase();
    const name         = body.name      || ticker;
    const type         = body.type      || body.assetType || 'stock';
    const shares       = parseFloat(body.shares);
    const avgBuyPrice  = parseFloat(body.avgBuyPrice  || body.avgPrice);
    const currentPrice = parseFloat(body.currentPrice || body.avgBuyPrice || body.avgPrice);
    const color        = body.color || '#00D4A1';

    if (!ticker || isNaN(shares) || isNaN(avgBuyPrice)) {
      return res.status(400).json({ success: false, message: 'ticker, shares and avgPrice are required' });
    }

    const portfolio = await Portfolio.findOne({ user: req.user._id });
    if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });

    // If holding already exists, update shares
    const existingIdx = portfolio.holdings.findIndex(h => h.ticker === ticker);
    if (existingIdx > -1) {
      const existing = portfolio.holdings[existingIdx];
      const totalShares = existing.shares + shares;
      const newAvg = ((existing.avgBuyPrice * existing.shares) + (avgBuyPrice * shares)) / totalShares;
      portfolio.holdings[existingIdx].shares       = totalShares;
      portfolio.holdings[existingIdx].avgBuyPrice  = parseFloat(newAvg.toFixed(4));
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
