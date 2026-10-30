import mongoose from 'mongoose';

const recommendationTrackSchema = new mongoose.Schema({
  id: { type: String, required: true },
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  artist: { type: String, default: 'Unknown Artist' },
  channel: { type: String, default: '' },
  thumbnail: { type: String, default: '' },
  duration: { type: String, default: '3:30' },
  reason: { type: String, default: '' },
  source: { type: String, default: 'catalog' }
}, { _id: false });

const userRecommendationCacheSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  recommendations: {
    madeForYou: { type: [recommendationTrackSchema], default: [] },
    dailyMix: { type: [recommendationTrackSchema], default: [] },
    discover: { type: [recommendationTrackSchema], default: [] },
    becauseYouListenedTo: {
      baseTrack: { type: recommendationTrackSchema, default: null },
      recommendations: { type: [recommendationTrackSchema], default: [] }
    },
    favouriteArtists: { type: [recommendationTrackSchema], default: [] },
    moreLikeRecent: { type: [recommendationTrackSchema], default: [] }
  },
  insights: {
    dominantMood: { type: String, default: 'Chill & Melodic' },
    topGenres: { type: [String], default: [] },
    summary: { type: String, default: '' }
  },
  source: {
    type: String,
    enum: ['gemini', 'hybrid', 'catalog_fallback', 'discovery_starter'],
    default: 'catalog_fallback'
  },
  modelUsed: {
    type: String,
    default: 'none'
  },
  eventsCountAtGeneration: {
    type: Number,
    default: 0
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, { timestamps: true });

// Ensure records are indexed by userId and expiry for quick cache checks
userRecommendationCacheSchema.index({ userId: 1, expiresAt: 1 });

export default mongoose.model('UserRecommendationCache', userRecommendationCacheSchema);

