import mongoose from 'mongoose';

const userListeningEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  trackId: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  artist: {
    type: String,
    default: 'Unknown Artist',
    trim: true,
    maxlength: 150
  },
  channel: {
    type: String,
    default: '',
    trim: true,
    maxlength: 150
  },
  thumbnail: {
    type: String,
    default: '',
    trim: true
  },
  eventType: {
    type: String,
    enum: ['play_start', 'progress', 'completed', 'skip', 'like', 'dislike', 'repeat'],
    required: true,
    index: true
  },
  duration: {
    type: Number,
    default: 0
  },
  listenedDuration: {
    type: Number,
    default: 0
  },
  completionPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  source: {
    type: String,
    default: 'player',
    trim: true,
    maxlength: 50
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

// Compound indexes for performant query aggregation
userListeningEventSchema.index({ userId: 1, timestamp: -1 });
userListeningEventSchema.index({ userId: 1, trackId: 1, eventType: 1 });
userListeningEventSchema.index({ userId: 1, eventType: 1, timestamp: -1 });

export default mongoose.model('UserListeningEvent', userListeningEventSchema);

