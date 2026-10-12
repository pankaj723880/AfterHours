import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  status: { type: String, enum: ['active', 'suspended', 'deactivated'], default: 'active', index: true },
  lastLogin: { type: Date, default: Date.now },
  likedSongs: { type: Array, default: [] },
  history: { type: Array, default: [] },
  playlists: { type: Array, default: [] },
  queue: { type: Array, default: [] }
}, { timestamps: true });

userSchema.index({ createdAt: -1 });

export default mongoose.model('User', userSchema);
