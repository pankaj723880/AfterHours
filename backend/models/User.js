import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  status: { type: String, enum: ['active', 'suspended', 'deactivated'], default: 'active', index: true },
  lastLogin: { type: Date, default: Date.now },
  likedSongs: { type: Array, default: [] },
  history: { type: Array, default: [] },
  searchHistory: { type: [String], default: [] },
  playlists: { type: Array, default: [] },
  queue: { type: Array, default: [] },
  
  // Profile & Social Extensions
  displayName: { type: String, default: '', trim: true, maxlength: 60 },
  avatarUrl: { type: String, default: '', trim: true },
  bio: { type: String, default: '', trim: true, maxlength: 300 },
  favoriteGenres: { type: [String], default: [] },
  isPublic: { type: Boolean, default: true },
  shareListeningActivity: { type: Boolean, default: false },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Rating & Review popup status
  ratingPopupStatus: {
    hasRated: { type: Boolean, default: false },
    hasDismissed: { type: Boolean, default: false },
    lastDismissedAt: { type: Date, default: null },
    ratedAt: { type: Date, default: null }
  }
}, { timestamps: true });

userSchema.index({ createdAt: -1 });

export default mongoose.model('User', userSchema);
