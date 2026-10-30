import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  username: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  avatarUrl: {
    type: String,
    default: '',
    trim: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    index: true
  },
  reviewText: {
    type: String,
    default: '',
    trim: true,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['published', 'hidden', 'flagged'],
    default: 'published',
    index: true
  },
  source: {
    type: String,
    enum: ['user', 'editorial'],
    default: 'user',
    index: true
  },
  campaign: {
    type: String,
    default: 'general',
    index: true
  },
  userRole: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

// Prevent duplicate real user ratings per campaign at DB level
reviewSchema.index(
  { userId: 1, campaign: 1, source: 1 },
  { unique: true, partialFilterExpression: { source: 'user', userId: { $exists: true, $ne: null } } }
);

reviewSchema.index({ source: 1, status: 1, submittedAt: -1 });

export default mongoose.models.Review || mongoose.model('Review', reviewSchema);

