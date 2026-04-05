const router = require('express').Router();
const { getTracker, updateLimits, addSurplus, addRoundUp } = require('../controllers/savingsTrackerController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/',            getTracker);
router.patch('/limits',    updateLimits);
router.post('/surplus',    addSurplus);
router.post('/roundup',    addRoundUp);

module.exports = router;
