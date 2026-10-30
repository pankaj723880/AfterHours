import mongoose from 'mongoose';

const websiteUsageSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  loginAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  logoutAt: {
    type: Date
  },
  activeDurationSeconds: {
    type: Number,
    default: 0,
    min: 0
  },
  pagesVisited: [{
    type: String,
    trim: true
  }],
  deviceType: {
    type: String,
    default: 'desktop',
    trim: true
  },
  userAgent: {
    type: String,
    default: '',
    trim: true
  },
  sessionStatus: {
    type: String,
    enum: ['active', 'idle', 'closed'],
    default: 'active',
    index: true
  }
}, { timestamps: true });

websiteUsageSessionSchema.index({ userId: 1, loginAt: -1 });
websiteUsageSessionSchema.index({ userId: 1, lastActiveAt: -1 });
websiteUsageSessionSchema.index({ userId: 1, sessionStatus: 1 });

export default mongoose.models.WebsiteUsageSession || mongoose.model('WebsiteUsageSession', websiteUsageSessionSchema);

