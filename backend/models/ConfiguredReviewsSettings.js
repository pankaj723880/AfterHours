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
    default: 4.9,
    min: 1,
    max: 5
  },
  displayCount: {
    type: Number,
    default: 1250,
    min: 0
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

