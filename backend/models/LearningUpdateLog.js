import mongoose from 'mongoose';

const learningUpdateLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  batchId: {
    type: String,
    required: true,
    trim: true
  },
  modelVersion: {
    type: String,
    default: '1.0.0-passive',
    trim: true
  },
  eventsProcessedCount: {
    type: Number,
    default: 0
  },
  eventTypes: {
    type: [String],
    default: []
  },
  processingDurationMs: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'partial'],
    default: 'success'
  },
  changesSummary: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  errorMessage: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'learning_update_logs'
});

learningUpdateLogSchema.index({ userId: 1, timestamp: -1 });
learningUpdateLogSchema.index({ timestamp: -1 });
learningUpdateLogSchema.index({ status: 1 });

export default mongoose.models.LearningUpdateLog || mongoose.model('LearningUpdateLog', learningUpdateLogSchema);
