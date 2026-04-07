const router = require('express').Router();
const { getTracker, getEntries, updateLimits, addSurplus, addRoundUp } = require('../controllers/savingsTrackerController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/',            getTracker);
router.get('/entries',     getEntries);       // all round-ups + surplus combined
router.patch('/limits',    updateLimits);
router.post('/surplus',    addSurplus);
router.post('/manual',     addSurplus);       // alias — frontend calls /manual
router.post('/roundup',    addRoundUp);

module.exports = router;
