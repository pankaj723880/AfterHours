import mongoose from 'mongoose';

const offlineTrackLicenseSchema = new mongoose.Schema({
  trackId: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true,
    index: true 
  },
  title: { type: String, required: true, trim: true },
  artist: { type: String, default: 'Unknown Artist', trim: true },
  channel: { type: String, default: '', trim: true },
  thumbnail: { type: String, default: '' },
  duration: { type: String, default: '' },
  offlineEligible: { 
    type: Boolean, 
    default: false, 
    index: true 
  },
  sourceProvider: { 
    type: String, 
    enum: ['admin_upload', 'direct_license', 'creative_commons', 'jamendo', 'public_domain', 'youtube_embedded'], 
    default: 'youtube_embedded',
    required: true 
  },
  permissionScope: { 
    type: String, 
    enum: ['offline_download_permitted', 'streaming_only', 'educational_only', 'restricted'], 
    default: 'streaming_only' 
  },
  licenseType: { 
    type: String, 
    default: 'YouTube API Terms of Service (Streaming Only)' 
  },
  licenseReference: { 
    type: String, 
    default: 'https://www.youtube.com/t/terms' 
  },
  // Audio file storage: for admin uploads or licensed tracks, can be relative audio path, external authorized URL, or base64 audio data
  audioStorageUrl: { type: String, default: '' },
  audioMimeType: { type: String, default: 'audio/mpeg' },
  audioSizeBytes: { type: Number, default: 0 },
  audioData: { type: Buffer }, // Optional direct binary storage in MongoDB for small authorized audio samples
  verifiedBy: { type: String, default: 'system' },
  verifiedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
  notes: { type: String, default: '' }
}, { timestamps: true });

offlineTrackLicenseSchema.index({ trackId: 1, offlineEligible: 1 });

export default mongoose.model('OfflineTrackLicense', offlineTrackLicenseSchema);

