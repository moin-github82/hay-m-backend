const router = require('express').Router();
const { getTransactions, sendMoney } = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getTransactions);
router.post('/send', sendMoney);

module.exports = router;
