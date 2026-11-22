import mongoose from 'mongoose';

const roomSongSchema = new mongoose.Schema({
  id: { type: String, required: true },
  videoId: { type: String, default: '' },
  title: { type: String, required: true, trim: true },
  channel: { type: String, default: 'Unknown Artist', trim: true },
  artist: { type: String, default: '' },
  thumbnail: { type: String, default: '' },
  duration: { type: String, default: '' },
  addedBy: {
    userId: { type: String, default: '' },
    username: { type: String, default: 'Listener' },
    displayName: { type: String, default: '' }
  },
  votes: { type: [String], default: [] }, // Array of userIds who upvoted
  addedAt: { type: Date, default: Date.now }
}, { _id: false });

const roomPlaylistSchema = new mongoose.Schema({
  id: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', trim: true, maxlength: 300 },
  createdBy: {
    userId: { type: String, default: '' },
    username: { type: String, default: 'Listener' }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  songs: { type: [roomSongSchema], default: [] }
}, { _id: false });

const roomMemberSchema = new mongoose.Schema({
  userId: { type: String, default: '' },
  username: { type: String, default: 'Listener' },
  displayName: { type: String, default: '' },
  avatar: { type: String, default: '' },
  role: { type: String, enum: ['host', 'co-host', 'listener', 'owner', 'admin', 'member'], default: 'listener' },
  joinedAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now }
}, { _id: false });

const roomActivitySchema = new mongoose.Schema({
  id: { type: String, default: () => `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` },
  type: { type: String, default: 'info' }, // 'song_added', 'song_removed', 'vote', 'role_changed', 'member_joined', 'member_left'
  text: { type: String, required: true },
  user: {
    userId: { type: String, default: '' },
    username: { type: String, default: '' },
    displayName: { type: String, default: '' }
  },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const roomChatMessageSchema = new mongoose.Schema({
  id: { type: String, default: () => `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` },
  text: { type: String, required: true, trim: true, maxlength: 300 },
  user: {
    userId: { type: String, default: '' },
    username: { type: String, default: 'Listener' },
    displayName: { type: String, default: 'Listener' },
    avatar: { type: String, default: '' }
  },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const collaborativeRoomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  code: {
    type: String,
    index: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  createdBy: {
    userId: { type: String, default: '' },
    username: { type: String, default: 'Host' },
    displayName: { type: String, default: 'Host' }
  },
  members: {
    type: [roomMemberSchema],
    default: []
  },
  playlists: {
    type: [roomPlaylistSchema],
    default: []
  },
  currentSong: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  isPlaying: {
    type: Boolean,
    default: false
  },
  seekTime: {
    type: Number,
    default: 0
  },
  playbackUpdatedAt: {
    type: Date,
    default: Date.now
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  activities: {
    type: [roomActivitySchema],
    default: []
  },
  chatMessages: {
    type: [roomChatMessageSchema],
    default: []
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

collaborativeRoomSchema.index({ updatedAt: -1 });

export default mongoose.model('CollaborativeRoom', collaborativeRoomSchema);
