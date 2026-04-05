const Goal           = require('../models/Goal');
const Transaction    = require('../models/Transaction');
const Card           = require('../models/Card');
const SavingsTracker = require('../models/SavingsTracker');

exports.getGoals = async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: goals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createGoal = async (req, res) => {
  try {
    const { name, icon, color, target, deadline, autoSave, autoSaveFrequency } = req.body;
    const goal = await Goal.create({
      user: req.user._id,
      name, icon, color, target, deadline, autoSave, autoSaveFrequency,
    });
    res.status(201).json({ success: true, data: goal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
    res.json({ success: true, data: goal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
    res.json({ success: true, message: 'Goal deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Add funds to a goal
// source: 'balance'      → deduct from default card/total wallet balance
// source: 'microsavings' → deduct from SavingsTracker total
// ─────────────────────────────────────────────────────────────────────────────
exports.addFunds = async (req, res) => {
  try {
    const { amount, source = 'balance' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }
    if (!['balance', 'microsavings'].includes(source)) {
      return res.status(400).json({ success: false, message: 'Invalid source. Use "balance" or "microsavings"' });
    }

    // ── Fetch the goal ───────────────────────────────────────────────────────
    const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id });
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
    if (goal.isCompleted) return res.status(400).json({ success: false, message: 'Goal is already completed' });

    const remaining = goal.target - goal.current;
    const deposit   = parseFloat(Math.min(amount, remaining).toFixed(2));

    let sourceLabel = '';
    let updatedCard    = null;
    let updatedTracker = null;

    // ── Source: wallet balance ───────────────────────────────────────────────
    if (source === 'balance') {
      // Try default card first, otherwise pick any card with enough balance
      let card = await Card.findOne({ user: req.user._id, isDefault: true });

      if (!card) {
        card = await Card.findOne({ user: req.user._id, balance: { $gte: deposit } });
      }

      if (!card) {
        return res.status(400).json({ success: false, message: 'No linked card found. Please add a card to your wallet.' });
      }
      if (card.isFrozen) {
        return res.status(400).json({ success: false, message: `Your card (••••${card.last4}) is frozen.` });
      }
      if (card.balance < deposit) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance on card ••••${card.last4}. Available: $${card.balance.toFixed(2)}`,
        });
      }

      card.balance = parseFloat((card.balance - deposit).toFixed(2));
      await card.save();
      updatedCard = card;
      sourceLabel = `From card ••••${card.last4}`;
    }

    // ── Source: micro-savings ────────────────────────────────────────────────
    if (source === 'microsavings') {
      let tracker = await SavingsTracker.findOne({ user: req.user._id });

      if (!tracker) {
        return res.status(400).json({ success: false, message: 'No micro-savings found. Start saving first!' });
      }
      if (tracker.totalSaved < deposit) {
        return res.status(400).json({
          success: false,
          message: `Insufficient micro-savings. Available: £${tracker.totalSaved.toFixed(2)}`,
        });
      }

      // Record withdrawal
      tracker.withdrawals.push({
        amount:   deposit,
        goalId:   goal._id,
        goalName: goal.name,
        note:     `Transferred to goal: ${goal.name}`,
        createdAt: new Date(),
      });
      await tracker.save();
      updatedTracker = tracker;
      sourceLabel = 'From micro-savings';
    }

    // ── Update goal ──────────────────────────────────────────────────────────
    goal.current = parseFloat((goal.current + deposit).toFixed(2));

    if (goal.current >= goal.target) {
      goal.isCompleted = true;
      goal.completedAt = new Date();
    }
    await goal.save();

    // ── Record transaction ───────────────────────────────────────────────────
    await Transaction.create({
      user:     req.user._id,
      type:     'debit',
      category: 'goal',
      title:    goal.name,
      subtitle: sourceLabel,
      amount:   deposit,
      icon:     goal.icon ?? 'flag-outline',
      status:   'completed',
    });

    // ── Socket events ────────────────────────────────────────────────────────
    const room = req.user._id.toString();
    req.io.to(room).emit('goal:updated',    { goal });
    req.io.to(room).emit('balance:updated', {
      source,
      cardBalance:    updatedCard    ? updatedCard.balance    : null,
      trackerBalance: updatedTracker ? updatedTracker.totalSaved : null,
    });

    res.json({
      success: true,
      data: {
        goal,
        depositedAmount: deposit,
        source,
        sourceLabel,
        updatedCard:    updatedCard    ?? null,
        updatedTracker: updatedTracker ?? null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
