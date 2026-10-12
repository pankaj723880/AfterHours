import mongoose from 'mongoose';

const systemMetricSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, default: 0 },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('SystemMetric', systemMetricSchema);
