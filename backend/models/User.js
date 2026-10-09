import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  likedSongs: { type: Array, default: [] },
  history: { type: Array, default: [] },
  playlists: { type: Array, default: [] }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
