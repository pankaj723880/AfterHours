import mongoose from 'mongoose';

const actionMemorySchema = new mongoose.Schema({
  userPhrase: {
    type: String,
    required: true,
    trim: true
  },
  normalizedPhrase: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  intent: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  actionType: {
    type: String,
    required: true,
    enum: ['NAVIGATE', 'OPEN_STATS', 'PLAY_TRACK', 'PAUSE', 'RESUME', 'NEXT', 'PREV', 'VOLUME', 'LIKE', 'UNLIKE', 'AVATAR_ACTION', 'NONE'],
    default: 'NONE'
  },
  target: {
    type: String,
    default: null
  },
  query: {
    type: String,
    default: null
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  handler: {
    type: String,
    default: null
  },
  successCount: {
    type: Number,
    default: 1
  },
  failureCount: {
    type: Number,
    default: 0
  },
  confidenceScore: {
    type: Number,
    default: 0.85,
    min: 0,
    max: 1.0,
    index: true
  },
  verified: {
    type: Boolean,
    default: true,
    index: true
  },
  userId: {
    type: String,
    default: 'global',
    index: true
  },
  lastExecutedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  versionKey: false
});

actionMemorySchema.index({ normalizedPhrase: 1, userId: 1 });
actionMemorySchema.index({ confidenceScore: -1, verified: 1 });

const ActionMemory = mongoose.models.ActionMemory || mongoose.model('ActionMemory', actionMemorySchema);

export default ActionMemory;
