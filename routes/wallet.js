const router = require('express').Router();
const { getCards, addCard, setDefault, toggleFreeze, deleteCard, topUp } = require('../controllers/walletController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/').get(getCards).post(addCard);
router.patch('/:id/default', setDefault);
router.patch('/:id/freeze', toggleFreeze);
router.post('/:id/topup', topUp);
router.delete('/:id', deleteCard);

module.exports = router;
