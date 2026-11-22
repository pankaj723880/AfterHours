import mongoose from 'mongoose';

const cachedSongSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300
  },
  artist: {
    type: String,
    default: 'Unknown Artist',
    trim: true,
    index: true,
    maxlength: 200
  },
  channel: {
    type: String,
    default: '',
    trim: true,
    maxlength: 200
  },
  thumbnail: {
    type: String,
    default: '',
    trim: true
  },
  durationSec: {
    type: Number,
    default: 0,
    index: true
  },
  durationStr: {
    type: String,
    default: ''
  },
  genre: {
    type: String,
    default: 'Bollywood',
    trim: true,
    index: true
  },
  mood: {
    type: String,
    default: 'Melodic',
    trim: true,
    index: true
  },
  language: {
    type: String,
    default: 'hindi',
    trim: true,
    index: true
  },
  tags: {
    type: [String],
    default: []
  },
  playCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  isCleanSingleSong: {
    type: Boolean,
    default: true,
    index: true
  },
  lastPlayedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

cachedSongSchema.index({ artist: 1, durationSec: 1 });
cachedSongSchema.index({ language: 1, durationSec: 1 });
cachedSongSchema.index({ isCleanSingleSong: 1, durationSec: 1 });

export default mongoose.model('CachedSong', cachedSongSchema);
