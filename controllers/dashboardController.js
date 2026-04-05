const Transaction = require('../models/Transaction');
const Goal = require('../models/Goal');
const Card = require('../models/Card');
const Portfolio = require('../models/Portfolio');

exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const [transactions, goals, cards, portfolio] = await Promise.all([
      Transaction.find({ user: userId }).sort({ createdAt: -1 }).limit(10),
      Goal.find({ user: userId, isCompleted: false }).limit(3),
      Card.find({ user: userId }),
      Portfolio.findOne({ user: userId }),
    ]);

    // Total wallet balance from all cards
    const totalBalance = cards.reduce((sum, c) => sum + c.balance, 0);

    // Total saved across all goals
    const totalSaved = goals.reduce((sum, g) => sum + g.current, 0);

    // Portfolio returns (gain/loss)
    const portfolioValue = portfolio ? portfolio.totalValue : 0;

    // Monthly stats: income vs expense
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTx = await Transaction.find({
      user: userId,
      createdAt: { $gte: startOfMonth },
    });
    const monthlyIncome = monthTx.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const monthlyExpense = monthTx.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

    res.json({
      success: true,
      data: {
        totalBalance,
        totalSaved,
        portfolioValue,
        monthlyIncome,
        monthlyExpense,
        recentTransactions: transactions,
        savingsGoals: goals,
        cards,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
