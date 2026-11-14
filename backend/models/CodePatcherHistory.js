import mongoose from 'mongoose';

const patchHistorySchema = new mongoose.Schema({
  executionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  instructionPrompt: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: [
      'Submitted',
      'Analyzing',
      'Generating Patch',
      'Applying Patch',
      'Validating',
      'Completed',
      'Failed',
      'Cancelled',
      'Awaiting Approval'
    ],
    default: 'Submitted',
    index: true
  },
  targetFile: {
    type: String,
    default: 'auto'
  },
  isAutoDetected: {
    type: Boolean,
    default: false
  },
  detectedFile: {
    type: String,
    default: null
  },
  filesInspected: [{
    type: String
  }],
  filesModified: [{
    type: String
  }],
  aiProvider: {
    type: String,
    default: 'Google Gemini'
  },
  aiModel: {
    type: String,
    default: 'gemini-3.8-flash'
  },
  selectedKeyMasked: {
    type: String,
    default: null
  },
  selectedKeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApiKey',
    default: null
  },
  patchInfo: {
    linesBefore: { type: Number, default: 0 },
    linesAfter: { type: Number, default: 0 },
    diffSummary: { type: String, default: '' },
    diff: [{
      type: { type: String }, // 'insert' | 'delete'
      lineNum: { type: Number },
      content: { type: String }
    }]
  },
  gitBranch: {
    type: String,
    default: null
  },
  commitSha: {
    type: String,
    default: null
  },
  prNumber: {
    type: Number,
    default: null
  },
  prUrl: {
    type: String,
    default: null
  },
  executionLogs: [{
    timestamp: { type: Date, default: Date.now },
    level: { type: String, enum: ['info', 'warn', 'error', 'step'], default: 'info' },
    message: { type: String, required: true }
  }],
  errorDetails: {
    message: { type: String, default: null },
    code: { type: String, default: null },
    isQuota: { type: Boolean, default: false }
  },
  validationResults: {
    passed: { type: Boolean, default: true },
    details: { type: String, default: 'Syntax and boundary checks passed' }
  },
  executionDurationMs: {
    type: Number,
    default: 0
  },
  adminUsername: {
    type: String,
    default: 'admin'
  },
  adminId: {
    type: String,
    default: null
  },
  submittedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

patchHistorySchema.index({ status: 1, submittedAt: -1 });

export default mongoose.models.CodePatcherHistory || mongoose.model('CodePatcherHistory', patchHistorySchema);
