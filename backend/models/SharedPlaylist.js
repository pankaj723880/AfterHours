import mongoose from 'mongoose';

const sharedPlaylistSchema = new mongoose.Schema({
  shareId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  creator: {
    id: { type: String, default: '' },
    username: { type: String, default: 'Loopra Listener' },
    displayName: { type: String, default: '' }
  },
  songs: {
    type: Array,
    default: []
  },
  songsCount: {
    type: Number,
    default: 0
  },
  viewsCount: {
    type: Number,
    default: 0
  },
  savesCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

sharedPlaylistSchema.index({ createdAt: -1 });

export default mongoose.model('SharedPlaylist', sharedPlaylistSchema);
