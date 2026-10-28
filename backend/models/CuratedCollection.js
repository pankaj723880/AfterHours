import mongoose from 'mongoose';

const trackItemSchema = new mongoose.Schema({
  id: { type: String, required: true }, // YouTube videoId or unique key
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  artist: { type: String, default: 'Unknown Artist' },
  album: { type: String, default: '' },
  duration: { type: String, default: '' },
  thumbnail: { type: String, default: '' },
  url: { type: String, default: '' },
  isHidden: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 }
}, { _id: false });

const curatedCollectionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  category: { 
    type: String, 
    enum: ['featured', 'trending', 'station', 'albums', 'radio', 'playlist', 'custom'], 
    default: 'featured',
    index: true 
  },
  description: { type: String, default: '' },
  coverArt: { type: String, default: '' },
  isPublished: { type: Boolean, default: true, index: true },
  isFeaturedOnHome: { type: Boolean, default: false, index: true },
  sortOrder: { type: Number, default: 0 },
  tracks: { type: [trackItemSchema], default: [] },
  createdBy: { type: String, default: 'admin' },
  updatedBy: { type: String, default: 'admin' }
}, { timestamps: true });

curatedCollectionSchema.index({ category: 1, sortOrder: 1 });
curatedCollectionSchema.index({ isFeaturedOnHome: 1, sortOrder: 1 });

export default mongoose.model('CuratedCollection', curatedCollectionSchema);
