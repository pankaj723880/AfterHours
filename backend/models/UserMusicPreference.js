import mongoose from 'mongoose';

const artistAffinitySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  playCount: { type: Number, default: 0 },
  completedCount: { type: Number, default: 0 },
  skipCount: { type: Number, default: 0 },
  score: { type: Number, default: 0 }
}, { _id: false });

const genreAffinitySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  score: { type: Number, default: 0 }
}, { _id: false });

const moodAffinitySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  score: { type: Number, default: 0 }
}, { _id: false });

const recentTrackSchema = new mongoose.Schema({
  trackId: { type: String, required: true },
  title: { type: String, required: true },
  artist: { type: String, default: 'Unknown Artist' },
  thumbnail: { type: String, default: '' },
  listenedAt: { type: Date, default: Date.now },
  completed: { type: Boolean, default: false }
}, { _id: false });

const userMusicPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  topArtists: {
    type: [artistAffinitySchema],
    default: []
  },
  topGenres: {
    type: [genreAffinitySchema],
    default: []
  },
  topMoods: {
    type: [moodAffinitySchema],
    default: []
  },
  favouriteTrackIds: {
    type: [String],
    default: []
  },
  repeatTrackIds: {
    type: [String],
    default: []
  },
  skippedTrackIds: {
    type: [String],
    default: []
  },
  dislikedTrackIds: {
    type: [String],
    default: []
  },
  recentTracks: {
    type: [recentTrackSchema],
    default: []
  },
  totalPlays: {
    type: Number,
    default: 0
  },
  totalCompletedListens: {
    type: Number,
    default: 0
  },
  totalSkips: {
    type: Number,
    default: 0
  },
  recommendationsEnabled: {
    type: Boolean,
    default: true
  },
  lastCalculatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model('UserMusicPreference', userMusicPreferenceSchema);

