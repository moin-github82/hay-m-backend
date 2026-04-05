const router = require('express').Router();
const { getGoals, createGoal, updateGoal, deleteGoal, addFunds } = require('../controllers/goalController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/').get(getGoals).post(createGoal);
router.route('/:id').patch(updateGoal).delete(deleteGoal);
router.post('/:id/funds', addFunds);

module.exports = router;
