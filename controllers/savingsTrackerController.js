const SavingsTracker = require('../models/SavingsTracker');

// Sample round-up transactions seeded for new users
const SEED_ROUNDUPS = [
  { merchant: 'Costa Coffee',     category: 'food',     icon: 'cafe-outline',          spentAmount: 4.60,  savedAmount: 0.40, note: 'Flat white', createdAt: daysAgo(0) },
  { merchant: 'Pret A Manger',    category: 'food',     icon: 'restaurant-outline',    spentAmount: 7.30,  savedAmount: 0.70, note: 'Lunch deal', createdAt: daysAgo(1) },
  { merchant: 'Uber',             category: 'transport',icon: 'car-outline',           spentAmount: 8.20,  savedAmount: 0.80, note: 'Ride to work', createdAt: daysAgo(1) },
  { merchant: 'Tesco',            category: 'grocery',  icon: 'basket-outline',        spentAmount: 23.45, savedAmount: 0.55, note: 'Weekly shop', createdAt: daysAgo(2) },
  { merchant: 'McDonald\'s',      category: 'food',     icon: 'fast-food-outline',     spentAmount: 6.75,  savedAmount: 0.25, note: 'Meal deal', createdAt: daysAgo(3) },
  { merchant: 'Vue Cinema',       category: 'leisure',  icon: 'film-outline',          spentAmount: 12.50, savedAmount: 0.50, note: 'Movie night', createdAt: daysAgo(4) },
  { merchant: 'Spotify',          category: 'subscript',icon: 'musical-notes-outline', spentAmount: 9.99,  savedAmount: 0.01, note: 'Monthly plan', createdAt: daysAgo(5) },
  { merchant: 'Amazon',           category: 'shopping', icon: 'bag-outline',           spentAmount: 15.30, savedAmount: 0.70, note: 'Online order', createdAt: daysAgo(6) },
  { merchant: 'Nando\'s',         category: 'food',     icon: 'flame-outline',         spentAmount: 34.60, savedAmount: 0.40, note: 'Dinner', createdAt: daysAgo(10) },
  { merchant: 'PureGym',          category: 'health',   icon: 'barbell-outline',       spentAmount: 29.99, savedAmount: 0.01, note: 'Gym membership', createdAt: daysAgo(12) },
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

exports.getTracker = async (req, res) => {
  try {
    let tracker = await SavingsTracker.findOne({ user: req.user._id });

    if (!tracker) {
      // Create with seeded sample data for new users
      tracker = await SavingsTracker.create({
        user: req.user._id,
        dailyLimit: 5,
        monthlyLimit: 100,
        roundUps: SEED_ROUNDUPS,
        surplus: [],
      });
    }

    res.json({ success: true, data: tracker });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEntries = async (req, res) => {
  try {
    const tracker = await SavingsTracker.findOne({ user: req.user._id });
    if (!tracker) return res.json({ success: true, data: [] });

    // Merge round-ups and surplus into one sorted list
    const roundUps = (tracker.roundUps || []).map(e => ({
      _id:       e._id,
      type:      'roundup',
      title:     e.merchant,
      subtitle:  e.note || e.category,
      amount:    e.savedAmount,
      icon:      e.icon || 'storefront-outline',
      category:  e.category,
      createdAt: e.createdAt,
    }));

    const surplus = (tracker.surplus || []).map(e => ({
      _id:       e._id,
      type:      'manual',
      title:     'Manual Deposit',
      subtitle:  e.note || 'Manual deposit',
      amount:    e.amount,
      icon:      'add-circle-outline',
      category:  'manual',
      createdAt: e.createdAt,
    }));

    const entries = [...roundUps, ...surplus]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateLimits = async (req, res) => {
  try {
    const { dailyLimit, monthlyLimit } = req.body;

    if (dailyLimit !== undefined && dailyLimit < 0) {
      return res.status(400).json({ success: false, message: 'Daily limit cannot be negative' });
    }
    if (monthlyLimit !== undefined && monthlyLimit < 0) {
      return res.status(400).json({ success: false, message: 'Monthly limit cannot be negative' });
    }

    const tracker = await SavingsTracker.findOneAndUpdate(
      { user: req.user._id },
      { ...(dailyLimit !== undefined && { dailyLimit }), ...(monthlyLimit !== undefined && { monthlyLimit }) },
      { new: true, upsert: true }
    );

    req.io.to(req.user._id.toString()).emit('savings:limitsUpdated', { dailyLimit: tracker.dailyLimit, monthlyLimit: tracker.monthlyLimit });

    res.json({ success: true, data: tracker });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addSurplus = async (req, res) => {
  try {
    const { amount, note } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const tracker = await SavingsTracker.findOneAndUpdate(
      { user: req.user._id },
      { $push: { surplus: { amount: parseFloat(amount), note: note || 'Manual deposit', createdAt: new Date() } } },
      { new: true, upsert: true }
    );

    req.io.to(req.user._id.toString()).emit('savings:updated', { totalSaved: tracker.totalSaved });

    res.json({ success: true, data: tracker });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addRoundUp = async (req, res) => {
  try {
    const { merchant, category, icon, spentAmount, note } = req.body;

    if (!spentAmount || spentAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid spend amount' });
    }

    // Round up to next whole number
    const savedAmount = parseFloat((Math.ceil(spentAmount) - spentAmount).toFixed(2));
    if (savedAmount === 0) {
      return res.status(400).json({ success: false, message: 'Amount is already a whole number, nothing to round up' });
    }

    const tracker = await SavingsTracker.findOneAndUpdate(
      { user: req.user._id },
      {
        $push: {
          roundUps: {
            merchant, category: category || 'other',
            icon: icon || 'storefront-outline',
            spentAmount, savedAmount, note,
            createdAt: new Date(),
          },
        },
      },
      { new: true, upsert: true }
    );

    req.io.to(req.user._id.toString()).emit('savings:roundUp', { merchant, savedAmount, totalSaved: tracker.totalSaved });

    res.json({ success: true, data: tracker, savedAmount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
