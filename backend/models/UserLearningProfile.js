import mongoose from 'mongoose';

const learnedGenreSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  score: { type: Number, default: 0 },
  confidence: { type: Number, default: 0, min: 0, max: 1 },
  playCount: { type: Number, default: 0 },
  skipCount: { type: Number, default: 0 },
  lastObserved: { type: Date, default: Date.now }
}, { _id: false });

const favoriteArtistSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  score: { type: Number, default: 0 },
  confidence: { type: Number, default: 0, min: 0, max: 1 },
  playCount: { type: Number, default: 0 },
  completedCount: { type: Number, default: 0 },
  skipCount: { type: Number, default: 0 },
  replayCount: { type: Number, default: 0 },
  liked: { type: Boolean, default: false },
  lastObserved: { type: Date, default: Date.now }
}, { _id: false });

const preferredLanguageSchema = new mongoose.Schema({
  language: { type: String, required: true, trim: true },
  score: { type: Number, default: 0 },
  confidence: { type: Number, default: 0, min: 0, max: 1 },
  count: { type: Number, default: 0 },
  lastObserved: { type: Date, default: Date.now }
}, { _id: false });

const preferredEraSchema = new mongoose.Schema({
  era: { type: String, required: true, trim: true },
  score: { type: Number, default: 0 },
  confidence: { type: Number, default: 0, min: 0, max: 1 },
  count: { type: Number, default: 0 },
  lastObserved: { type: Date, default: Date.now }
}, { _id: false });

const moodPreferenceSchema = new mongoose.Schema({
  mood: { type: String, required: true, trim: true },
  score: { type: Number, default: 0 },
  confidence: { type: Number, default: 0, min: 0, max: 1 },
  count: { type: Number, default: 0 },
  lastObserved: { type: Date, default: Date.now }
}, { _id: false });

const interestItemSchema = new mongoose.Schema({
  topic: { type: String, required: true, trim: true },
  category: { type: String, default: 'general', trim: true },
  weight: { type: Number, default: 1 },
  detectedAt: { type: Date, default: Date.now },
  firstSeen: { type: Date, default: Date.now },
  consistency: { type: Number, default: 0 }
}, { _id: false });

const userLearningProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  modelVersion: {
    type: String,
    default: '1.0.0-passive',
    trim: true
  },
  confidenceScore: {
    type: Number,
    default: 0.0,
    min: 0,
    max: 1,
    index: true
  },
  confidenceLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'very_high'],
    default: 'low'
  },
  totalEventsObserved: {
    type: Number,
    default: 0,
    min: 0
  },
  lastLearnedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  learningStatus: {
    type: String,
    enum: ['active', 'idle', 'updating'],
    default: 'active'
  },
  learnedGenres: {
    type: [learnedGenreSchema],
    default: []
  },
  favoriteArtists: {
    type: [favoriteArtistSchema],
    default: []
  },
  preferredLanguages: {
    type: [preferredLanguageSchema],
    default: []
  },
  preferredEras: {
    type: [preferredEraSchema],
    default: []
  },
  moodPreferences: {
    type: [moodPreferenceSchema],
    default: []
  },
  listeningTimePatterns: {
    hourlyDistribution: {
      type: Map,
      of: Number,
      default: () => ({})
    },
    dayOfWeekDistribution: {
      type: Map,
      of: Number,
      default: () => ({})
    },
    peakTimeOfDay: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night', 'undetermined'],
      default: 'undetermined'
    },
    averageSessionMinutes: {
      type: Number,
      default: 0
    },
    totalListeningHours: {
      type: Number,
      default: 0
    }
  },
  repeatedListening: {
    repeatTrackIds: { type: [String], default: [] },
    repeatArtists: { type: [String], default: [] },
    replayRatio: { type: Number, default: 0 }
  },
  skipPatterns: {
    totalSkips: { type: Number, default: 0 },
    averageSkipTimeSeconds: { type: Number, default: 0 },
    frequentSkipArtists: { type: [String], default: [] },
    skipRate: { type: Number, default: 0 }
  },
  featureUsage: {
    radioLaunches: { type: Number, default: 0 },
    discoverVisits: { type: Number, default: 0 },
    playlistInteractions: { type: Number, default: 0 },
    searchCount: { type: Number, default: 0 },
    mostUsedFeature: { type: String, default: 'player' }
  },
  interests: {
    shortTerm: { type: [interestItemSchema], default: [] },
    longTerm: { type: [interestItemSchema], default: [] }
  },
  signalsSummary: {
    strongSignals: { type: [String], default: [] },
    weakSignals: { type: [String], default: [] },
    uncertainSignals: { type: [String], default: [] }
  }
}, {
  timestamps: true,
  collection: 'user_learning_profiles'
});

userLearningProfileSchema.index({ userId: 1 }, { unique: true });
userLearningProfileSchema.index({ confidenceScore: -1 });
userLearningProfileSchema.index({ lastLearnedAt: -1 });

export default mongoose.models.UserLearningProfile || mongoose.model('UserLearningProfile', userLearningProfileSchema);
