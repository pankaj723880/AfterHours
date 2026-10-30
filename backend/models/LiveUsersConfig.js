import mongoose from 'mongoose';

const liveUsersConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'default_live_users_config'
  },
  mode: {
    type: String,
    enum: ['real', 'manual'],
    default: 'real',
    required: true
  },
  minUsers: {
    type: Number,
    default: 500,
    min: 0,
    required: true
  },
  maxUsers: {
    type: Number,
    default: 1000,
    min: 0,
    required: true
  },
  currentDisplayCount: {
    type: Number,
    default: 742,
    min: 0
  },
  lastGeneratedAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: String,
    default: 'system'
  }
}, { timestamps: true });

export default mongoose.model('LiveUsersConfig', liveUsersConfigSchema);

