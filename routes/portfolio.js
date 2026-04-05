const router = require('express').Router();
const { getPortfolio, addHolding, updatePrices, removeHolding } = require('../controllers/portfolioController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getPortfolio);
router.post('/holdings', addHolding);
router.patch('/prices', updatePrices);
router.delete('/holdings/:holdingId', removeHolding);

module.exports = router;
