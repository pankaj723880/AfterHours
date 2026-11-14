import mongoose from 'mongoose';
import { maskApiKey } from '../utils/keyEncryption.js';

const ApiKeySchema = new mongoose.Schema({
  service: { 
    type: String, 
    required: true, 
    lowercase: true, 
    trim: true,
    enum: ['youtube', 'gemini']
  },
  // AES-256-GCM Encrypted Storage
  encryptedKey: { type: String, default: '' },
  iv: { type: String, default: '' },
  authTag: { type: String, default: '' },
  
  // Legacy / Transitional Plaintext Key (cleared on save/migration)
  key: { type: String, trim: true },
  
  // Safe Masked Representation (e.g. AIzaSy...1234)
  maskedKey: { type: String, default: '' },
  
  label: { type: String, default: '', trim: true },
  
  // Detailed Operational Status
  status: { 
    type: String, 
    enum: ['Active', 'Exhausted', 'Suspended', 'Invalid', 'Disabled'], 
    default: 'Active' 
  },
  isExhausted: { type: Boolean, default: false },
  isEnabled: { type: Boolean, default: true },
  
  // Reliability, Quota & Error Telemetry
  failureCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  lastUsedAt: { type: Date, default: Date.now },
  lastSuccessAt: { type: Date },
  lastErrorAt: { type: Date },
  lastErrorMessage: { type: String, default: '' },
  lastErrorReason: { type: String, default: '' }, // quotaExceeded, rateLimitExceeded, keyInvalid, 429, etc.
  
  // Quota Recovery Window Tracking
  cooldownUntil: { type: Date, default: null },
  
  createdAt: { type: Date, default: Date.now }
});

// Compound Indexes for high-speed healthy key lookups
ApiKeySchema.index({ service: 1, isEnabled: 1, isExhausted: 1, failureCount: 1 });
ApiKeySchema.index({ service: 1, maskedKey: 1 });

// Helper to format safe client responses
ApiKeySchema.methods.toSafeJSON = function() {
  return {
    _id: this._id,
    service: this.service,
    maskedKey: this.maskedKey || maskApiKey(this.key || ''),
    label: this.label,
    status: this.status,
    isEnabled: this.isEnabled !== false,
    isExhausted: Boolean(this.isExhausted),
    failureCount: this.failureCount || 0,
    successCount: this.successCount || 0,
    lastUsedAt: this.lastUsedAt,
    lastSuccessAt: this.lastSuccessAt,
    lastErrorAt: this.lastErrorAt,
    lastErrorMessage: this.lastErrorMessage,
    lastErrorReason: this.lastErrorReason,
    cooldownUntil: this.cooldownUntil,
    createdAt: this.createdAt
  };
};

ApiKeySchema.statics.getModel = function() {
  return mongoose.models.ApiKey || mongoose.model('ApiKey', ApiKeySchema);
};

export default mongoose.models.ApiKey || mongoose.model('ApiKey', ApiKeySchema);
