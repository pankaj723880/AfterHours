import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  username: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  displayName: {
    type: String,
    default: '',
    trim: true,
    maxlength: 60
  },
  avatarUrl: {
    type: String,
    default: '',
    trim: true
  },
  type: { 
    type: String, 
    enum: ['listen', 'like', 'playlist_create', 'playlist_update'], 
    required: true,
    index: true 
  },
  track: {
    id: { type: String },
    videoId: { type: String },
    title: { type: String },
    channel: { type: String },
    artist: { type: String },
    thumbnail: { type: String },
    duration: { type: String }
  },
  playlist: {
    id: { type: String },
    name: { type: String },
    songsCount: { type: Number }
  },
  isPublic: { 
    type: Boolean, 
    default: true, 
    index: true 
  }
}, { timestamps: true });

// Compound indexes for performant feeds
activitySchema.index({ isPublic: 1, createdAt: -1 });
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ 'track.id': 1, userId: 1, type: 1 });

export default mongoose.model('Activity', activitySchema);
