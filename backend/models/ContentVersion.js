import mongoose from 'mongoose';

const contentVersionSchema = new mongoose.Schema({
  versionNumber: { type: Number, required: true },
  contentType: { 
    type: String, 
    enum: ['SITE_CONFIG', 'CURATED_COLLECTIONS'], 
    required: true,
    index: true 
  },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  publishedBy: { type: String, required: true },
  changeSummary: { type: String, default: 'CMS Content published' },
  createdAt: { type: Date, default: Date.now, index: true }
});

contentVersionSchema.index({ contentType: 1, versionNumber: -1 });

export default mongoose.model('ContentVersion', contentVersionSchema);
