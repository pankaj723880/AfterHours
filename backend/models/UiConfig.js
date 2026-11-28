import mongoose from 'mongoose';

/**
 * UiConfig Schema
 * Stores key-value boolean visibility flags for all buttons, sections, cards, and navigation items.
 * Uses Mixed type to support dot-separated element keys (e.g. 'nav.discover': true, 'btn.listenTogether': false)
 * without triggering Mongoose "Mongoose maps do not support keys that contain '.'" validation errors.
 */
const uiConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'global_ui_visibility',
      unique: true
    },
    // Map of element ID to boolean visibility state (e.g. 'nav.home': true, 'btn.listenTogether': false)
    visibility: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    updatedBy: {
      type: String,
      default: 'system'
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    minimize: false
  }
);

// Force re-compilation of model so schema changes take effect immediately across imports
if (mongoose.models.UiConfig) {
  delete mongoose.models.UiConfig;
}

const UiConfig = mongoose.model('UiConfig', uiConfigSchema);

export default UiConfig;
