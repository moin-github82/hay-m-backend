const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:       { type: String, required: true },
  icon:       { type: String, default: 'flag-outline' },
  color:      { type: String, default: '#00D4A1' },
  target:     { type: Number, required: true },
  current:    { type: Number, default: 0 },
  deadline:   { type: Date },
  autoSave:   { type: Number, default: 0 },
  autoSaveFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'none'], default: 'none' },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
}, { timestamps: true });

goalSchema.virtual('progress').get(function () {
  return this.target > 0 ? Math.round((this.current / this.target) * 100) : 0;
});

goalSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Goal', goalSchema);
