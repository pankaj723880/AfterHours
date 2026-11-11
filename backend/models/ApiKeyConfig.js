import mongoose from 'mongoose';

const ApiKeySchema = new mongoose.Schema({
  service: { type: String, required: true },
  key: { type: String, required: true, trim: true },
  label: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Exhausted', 'Suspended'], default: 'Active' },
  isExhausted: { type: Boolean, default: false },
  failureCount: { type: Number, default: 0 },
  lastUsedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// CommonJS support for legacy imports if needed
ApiKeySchema.statics.getModel = function() {
  return mongoose.models.ApiKey || mongoose.model('ApiKey', ApiKeySchema);
};

export default mongoose.models.ApiKey || mongoose.model('ApiKey', ApiKeySchema);

