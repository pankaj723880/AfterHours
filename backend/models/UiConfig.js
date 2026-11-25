import mongoose from 'mongoose';

/**
 * UiConfig Schema
 * Stores key-value boolean visibility flags for all buttons, sections, cards, and navigation items.
 * Guaranteed to default to true for any non-existent key.
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
      type: Map,
      of: Boolean,
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
    timestamps: true
  }
);

const UiConfig = mongoose.models.UiConfig || mongoose.model('UiConfig', uiConfigSchema);

export default UiConfig;
