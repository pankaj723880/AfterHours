import mongoose from 'mongoose';

const configuredReviewsSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'default_configured_reviews',
    unique: true
  },
  enabled: {
    type: Boolean,
    default: false
  },
  displayRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  displayCount: {
    type: Number,
    default: 0,
    min: 0
  },
  distribution: {
    count1: { type: Number, default: 0, min: 0 },
    count2: { type: Number, default: 0, min: 0 },
    count3: { type: Number, default: 0, min: 0 },
    count4: { type: Number, default: 0, min: 0 },
    count5: { type: Number, default: 0, min: 0 }
  },
  editorialLabel: {
    type: String,
    default: 'Curated Editorial Highlights',
    trim: true
  },
  updatedBy: {
    type: String,
    default: 'admin'
  }
}, { timestamps: true });

export default mongoose.models.ConfiguredReviewsSettings || mongoose.model('ConfiguredReviewsSettings', configuredReviewsSettingsSchema);
