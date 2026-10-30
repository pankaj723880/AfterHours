import mongoose from 'mongoose';

const userAssistantRecommendationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  trackId: {
    type: String,
    required: true,
    index: true
  },
  videoId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  artist: {
    type: String,
    default: ''
  },
  canonicalKey: {
    type: String,
    required: true,
    index: true
  },
  queryContext: {
    type: String,
    default: ''
  },
  recommendedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

userAssistantRecommendationSchema.index({ userId: 1, recommendedAt: -1 });
userAssistantRecommendationSchema.index({ userId: 1, canonicalKey: 1 });

export default mongoose.models.UserAssistantRecommendation ||
  mongoose.model('UserAssistantRecommendation', userAssistantRecommendationSchema);

