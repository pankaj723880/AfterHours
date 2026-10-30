import mongoose from 'mongoose';

const userListeningSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  startedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  activeListeningDurationSeconds: {
    type: Number,
    default: 0,
    min: 0
  },
  songsPlayed: {
    type: Number,
    default: 0,
    min: 0
  },
  tracks: [{
    trackId: { type: String, required: true },
    videoId: { type: String, default: '' },
    title: { type: String, default: 'Unknown Track' },
    artist: { type: String, default: 'Unknown Artist' },
    artworkUrl: { type: String, default: '' },
    listenedSeconds: { type: Number, default: 0 },
    completed: { type: Boolean, default: false }
  }],
  deviceType: {
    type: String,
    default: 'desktop'
  },
  platform: {
    type: String,
    default: 'web'
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'abandoned'],
    default: 'active',
    index: true
  }
}, { timestamps: true });

userListeningSessionSchema.index({ userId: 1, startedAt: -1 });
userListeningSessionSchema.index({ userId: 1, status: 1 });

export default mongoose.models.UserListeningSession || mongoose.model('UserListeningSession', userListeningSessionSchema);

