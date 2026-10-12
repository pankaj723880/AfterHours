import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  adminId: { type: String, required: true },
  adminUsername: { type: String, required: true },
  action: { type: String, required: true },
  targetId: { type: String },
  targetUsername: { type: String },
  details: { type: Object, default: {} },
  ip: { type: String, default: 'unknown' },
  status: { type: String, enum: ['SUCCESS', 'FAILED'], default: 'SUCCESS' },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ adminId: 1 });
auditLogSchema.index({ action: 1 });

export default mongoose.model('AuditLog', auditLogSchema);
