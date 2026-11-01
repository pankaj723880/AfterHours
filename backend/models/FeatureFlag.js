import mongoose from 'mongoose';

const featureFlagSchema = new mongoose.Schema({
  featureKey: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  globalRollout: {
    type: Boolean,
    default: false
  },
  adminAccess: {
    type: Boolean,
    default: true
  },
  updatedBy: {
    type: String,
    default: 'system'
  },
  updatedByUsername: {
    type: String,
    default: 'System'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  auditHistory: [
    {
      adminId: { type: String },
      adminUsername: { type: String },
      previousState: { type: Object },
      newState: { type: Object },
      ip: { type: String },
      timestamp: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

export default mongoose.model('FeatureFlag', featureFlagSchema);

