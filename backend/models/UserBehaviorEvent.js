import mongoose from 'mongoose';

const userBehaviorEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  eventId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  category: {
    type: String,
    enum: ['music', 'discovery', 'website'],
    required: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  metadata: {
    trackId: { type: String, trim: true },
    videoId: { type: String, trim: true },
    songTitle: { type: String, trim: true },
    artistName: { type: String, trim: true },
    albumName: { type: String, trim: true },
    genre: { type: String, trim: true },
    language: { type: String, trim: true },
    era: { type: String, trim: true },
    mood: { type: String, trim: true },
    searchQuery: { type: String, trim: true },
    featureName: { type: String, trim: true },
    stationName: { type: String, trim: true },
    playlistId: { type: String, trim: true },
    playlistName: { type: String, trim: true },
    durationSeconds: { type: Number, default: 0, min: 0 },
    listenedDurationSeconds: { type: Number, default: 0, min: 0 },
    playbackPositionSeconds: { type: Number, default: 0, min: 0 },
    completionPercent: { type: Number, default: 0, min: 0, max: 100 },
    source: { type: String, default: 'unknown', trim: true },
    hourOfDay: { type: Number, min: 0, max: 23 },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    timeOfDay: { type: String, enum: ['morning', 'afternoon', 'evening', 'night'] },
    sessionId: { type: String, trim: true }
  },
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  processedAt: {
    type: Date
  },
  processingAttempts: {
    type: Number,
    default: 0
  },
  error: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  collection: 'user_behavior_events'
});

// Indexes for high-performance querying and idempotent isolation
userBehaviorEventSchema.index({ userId: 1, createdAt: -1 });
userBehaviorEventSchema.index({ userId: 1, category: 1, createdAt: -1 });
userBehaviorEventSchema.index({ userId: 1, eventType: 1, createdAt: -1 });
userBehaviorEventSchema.index({ processed: 1, createdAt: 1 });
userBehaviorEventSchema.index({ userId: 1, processed: 1 });

export default mongoose.models.UserBehaviorEvent || mongoose.model('UserBehaviorEvent', userBehaviorEventSchema);

