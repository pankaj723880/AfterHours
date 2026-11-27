import mongoose from 'mongoose';

const userLocationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    sessionId: {
      type: String,
      default: null
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },
    accuracyMeters: {
      type: Number,
      default: null
    },
    city: {
      type: String,
      default: ''
    },
    state: {
      type: String,
      default: ''
    },
    country: {
      type: String,
      default: ''
    },
    formattedAddress: {
      type: String,
      default: ''
    },
    consentGiven: {
      type: Boolean,
      default: true
    },
    source: {
      type: String,
      default: 'browser_geolocation'
    }
  },
  {
    timestamps: true
  }
);

userLocationSchema.index({ createdAt: -1 });
userLocationSchema.index({ country: 1, state: 1, city: 1 });

const UserLocation = mongoose.models.UserLocation || mongoose.model('UserLocation', userLocationSchema);
export default UserLocation;
