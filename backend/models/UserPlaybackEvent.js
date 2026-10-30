import mongoose from 'mongoose';

const userPlaybackEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  trackId: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  videoId: {
    type: String,
    default: '',
    trim: true
  },
  songTitle: {
    type: String,
    required: true,
    trim: true,
    maxlength: 250
  },
  artistName: {
    type: String,
    default: 'Unknown Artist',
    trim: true,
    maxlength: 200
  },
  albumName: {
    type: String,
    default: '',
    trim: true,
    maxlength: 200
  },
  artworkUrl: {
    type: String,
    default: '',
    trim: true
  },
  source: {
    type: String,
    default: 'player',
    trim: true,
    maxlength: 60
  },
  eventType: {
    type: String,
    enum: ['play_start', 'progress', 'pause', 'resume', 'seek', 'completed', 'skip', 'stop', 'like', 'dislike', 'repeat'],
    required: true,
    index: true
  },
  startedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  pausedAt: {
    type: Date
  },
  resumedAt: {
    type: Date
  },
  endedAt: {
    type: Date
  },
  listenedDurationSeconds: {
    type: Number,
    default: 0,
    min: 0,
    index: true
  },
  playbackPositionSeconds: {
    type: Number,
    default: 0,
    min: 0
  },
  durationSeconds: {
    type: Number,
    default: 0,
    min: 0
  },
  completionPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  completed: {
    type: Boolean,
    default: false,
    index: true
  },
  deviceType: {
    type: String,
    default: 'desktop',
    trim: true
  },
  platform: {
    type: String,
    default: 'web',
    trim: true
  }
}, { timestamps: true });

// Compound indexes for high-performance aggregations and isolation
userPlaybackEventSchema.index({ userId: 1, startedAt: -1 });
userPlaybackEventSchema.index({ userId: 1, sessionId: 1 });
userPlaybackEventSchema.index({ userId: 1, trackId: 1, eventType: 1 });
userPlaybackEventSchema.index({ userId: 1, eventType: 1, startedAt: -1 });
userPlaybackEventSchema.index({ userId: 1, listenedDurationSeconds: -1 });
userPlaybackEventSchema.index({ userId: 1, completed: 1 });

// Compatibility aliases
userPlaybackEventSchema.virtual('title').get(function() { return this.songTitle; });
userPlaybackEventSchema.virtual('artist').get(function() { return this.artistName; });
userPlaybackEventSchema.virtual('thumbnail').get(function() { return this.artworkUrl; });
userPlaybackEventSchema.virtual('listenedDuration').get(function() { return this.listenedDurationSeconds; });
userPlaybackEventSchema.virtual('duration').get(function() { return this.durationSeconds; });

export default mongoose.models.UserPlaybackEvent || mongoose.model('UserPlaybackEvent', userPlaybackEventSchema);

