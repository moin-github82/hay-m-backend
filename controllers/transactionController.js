const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Card = require('../models/Card');

exports.getTransactions = async (req, res) => {
  try {
    const { type, category, limit = 20, page = 1 } = req.query;
    const filter = { user: req.user._id };
    if (type) filter.type = type;
    if (category) filter.category = category;

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendMoney = async (req, res) => {
  try {
    const { recipientEmail, amount, note, cardId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const recipient = await User.findOne({ email: recipientEmail });
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    if (recipient._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot send money to yourself' });
    }

    // Check card balance if cardId provided
    if (cardId) {
      const card = await Card.findOne({ _id: cardId, user: req.user._id });
      if (!card) return res.status(404).json({ success: false, message: 'Card not found' });
      if (card.balance < amount) return res.status(400).json({ success: false, message: 'Insufficient balance' });
      if (card.isFrozen) return res.status(400).json({ success: false, message: 'Card is frozen' });

      card.balance -= amount;
      await card.save();
    }

    // Create debit transaction for sender
    const sentTx = await Transaction.create({
      user: req.user._id,
      type: 'debit',
      category: 'payment',
      title: recipient.fullName,
      subtitle: note || 'Money transfer',
      amount,
      icon: 'send-outline',
      toUser: recipient._id,
      note,
      cardId: cardId || null,
      status: 'completed',
    });

    // Create credit transaction for recipient
    const receivedTx = await Transaction.create({
      user: recipient._id,
      type: 'credit',
      category: 'transfer',
      title: req.user.fullName,
      subtitle: note || 'Money received',
      amount,
      icon: 'arrow-down-circle-outline',
      toUser: req.user._id,
      note,
      status: 'completed',
    });

    // Real-time notifications
    req.io.to(req.user._id.toString()).emit('transaction:new', { transaction: sentTx });
    req.io.to(recipient._id.toString()).emit('transaction:new', { transaction: receivedTx });
    req.io.to(recipient._id.toString()).emit('payment:received', {
      from: req.user.fullName,
      amount,
      note,
    });

    res.status(201).json({ success: true, data: sentTx });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
