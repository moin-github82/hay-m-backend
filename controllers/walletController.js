const Card        = require('../models/Card');
const Transaction = require('../models/Transaction');

exports.getCards = async (req, res) => {
  try {
    const cards = await Card.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
    res.json({ success: true, data: cards });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addCard = async (req, res) => {
  try {
    // Support both the original field names and the frontend's field names
    const {
      type, bank, last4, holder, expiry, gradient, accountType, accountNumber,
      // Frontend field aliases
      cardNumber, bankName, expiryDate, cardHolder, network,
    } = req.body;

    const resolvedType       = type   || network || 'Visa';
    const resolvedBank       = bank   || bankName;
    const resolvedExpiry     = expiry || expiryDate;
    const resolvedHolder     = holder || cardHolder || 'Card Holder';
    const resolvedRaw        = String(cardNumber || accountNumber || '').replace(/\s/g, '');
    const resolvedLast4      = last4  || resolvedRaw.slice(-4);
    const resolvedAccountNum = accountNumber || cardNumber;

    if (!resolvedBank)   return res.status(400).json({ success: false, message: 'Bank name is required' });
    if (!resolvedLast4)  return res.status(400).json({ success: false, message: 'Card number is required' });
    if (!resolvedExpiry) return res.status(400).json({ success: false, message: 'Expiry date is required' });

    const isFirst = (await Card.countDocuments({ user: req.user._id })) === 0;

    const card = await Card.create({
      user:          req.user._id,
      type:          resolvedType,
      bank:          resolvedBank,
      last4:         resolvedLast4,
      holder:        resolvedHolder,
      expiry:        resolvedExpiry,
      gradient:      gradient || ['#0A1628', '#1C3D6E'],
      accountType:   accountType || 'card',
      accountNumber: resolvedAccountNum,
      isDefault:     isFirst,
      balance:       0,
    });

    res.status(201).json({ success: true, data: card });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.setDefault = async (req, res) => {
  try {
    // Unset all defaults for this user
    await Card.updateMany({ user: req.user._id }, { isDefault: false });

    const card = await Card.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isDefault: true },
      { new: true }
    );
    if (!card) return res.status(404).json({ success: false, message: 'Card not found' });

    res.json({ success: true, data: card });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleFreeze = async (req, res) => {
  try {
    const card = await Card.findOne({ _id: req.params.id, user: req.user._id });
    if (!card) return res.status(404).json({ success: false, message: 'Card not found' });

    card.isFrozen = !card.isFrozen;
    await card.save();

    res.json({ success: true, data: card, frozen: card.isFrozen });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.topUp = async (req, res) => {
  try {
    const { amount } = req.body;
    const deposit = parseFloat(amount);

    if (!deposit || deposit <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const card = await Card.findOne({ _id: req.params.id, user: req.user._id });
    if (!card) return res.status(404).json({ success: false, message: 'Card not found' });
    if (card.isFrozen) {
      return res.status(400).json({ success: false, message: `Card ••••${card.last4} is frozen` });
    }

    card.balance = parseFloat((card.balance + deposit).toFixed(2));
    await card.save();

    await Transaction.create({
      user:     req.user._id,
      type:     'credit',
      category: 'topup',
      title:    'Top Up',
      subtitle: `To card ••••${card.last4}`,
      amount:   deposit,
      icon:     'add-circle-outline',
      status:   'completed',
    });

    req.io.to(req.user._id.toString()).emit('balance:updated', {
      source:      'topup',
      cardId:      card._id,
      cardBalance: card.balance,
    });

    res.json({ success: true, data: card });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCard = async (req, res) => {
  try {
    const card = await Card.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!card) return res.status(404).json({ success: false, message: 'Card not found' });

    // If deleted card was default, set next card as default
    if (card.isDefault) {
      const next = await Card.findOne({ user: req.user._id });
      if (next) { next.isDefault = true; await next.save(); }
    }

    res.json({ success: true, message: 'Card removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
