import mongoose from 'mongoose';

const mediaAssetSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  originalName: { type: String, default: '' },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true }, // in bytes
  url: { type: String, required: true }, // Data URL or storage URI
  category: { 
    type: String, 
    enum: ['logo', 'banner', 'artwork', 'icon', 'background', 'other'], 
    default: 'artwork',
    index: true 
  },
  altText: { type: String, default: '' },
  uploadedBy: { type: String, default: 'admin' }
}, { timestamps: true });

mediaAssetSchema.index({ createdAt: -1 });

export default mongoose.model('MediaAsset', mediaAssetSchema);
