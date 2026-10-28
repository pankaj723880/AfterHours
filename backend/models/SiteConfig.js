import mongoose from 'mongoose';

const siteConfigSchema = new mongoose.Schema({
  configType: { type: String, enum: ['published', 'draft'], required: true, unique: true },
  version: { type: Number, default: 1 },
  
  branding: {
    siteName: { type: String, default: 'Loopra' },
    tagline: { type: String, default: 'AfterHours Mehfil Music' },
    logoUrl: { type: String, default: '/loopra-logo.png' },
    faviconUrl: { type: String, default: '/loopra-logo.png' },
    description: { type: String, default: 'Endless retro Hindi, Bollywood nostalgia, and high-energy desi soundtracks without subscriptions.' }
  },

  theme: {
    type: {
      accentColor: { type: String, default: '#f59e0b' },
      themeMode: { type: String, enum: ['dark', 'midnight', 'neon'], default: 'dark' },
      glassmorphism: { type: Boolean, default: true },
      meshGradient: { type: Boolean, default: true },
      particles: { type: Boolean, default: true }
    },
    default: () => ({
      accentColor: '#f59e0b',
      themeMode: 'dark',
      glassmorphism: true,
      meshGradient: true,
      particles: true
    })
  },

  announcement: {
    enabled: { type: Boolean, default: false },
    message: { type: String, default: 'Welcome to Loopra! Enjoy uninterrupted retro Bollywood and curated hits.' },
    type: { type: String, enum: ['info', 'warning', 'promo', 'alert'], default: 'info' },
    linkUrl: { type: String, default: '' },
    linkText: { type: String, default: '' },
    dismissible: { type: Boolean, default: true }
  },

  banner: {
    enabled: { type: Boolean, default: false },
    title: { type: String, default: 'Nostalgic Radio Stations Now Live' },
    subtitle: { type: String, default: 'Listen to 90s Saloon FM, Highway Truck Melodies, and Theka Session nonstop.' },
    imageUrl: { type: String, default: '' },
    actionText: { type: String, default: 'Tune In Now' },
    actionUrl: { type: String, default: '/station/barber' }
  },

  maintenance: {
    enabled: { type: Boolean, default: false },
    title: { type: String, default: 'Loopra Under Scheduled Maintenance' },
    message: { type: String, default: 'We are currently tuning our audio streaming nodes. Audio service will resume shortly.' },
    allowedRoles: { type: [String], default: ['admin'] }
  },

  sections: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    displayLimit: { type: Number, default: 12 }
  }],

  stations: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    badge: { type: String, default: '' },
    artwork: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    bgImages: { type: [String], default: [] },
    queries: { type: [String], default: [] }
  }],

  navigation: [{
    id: { type: String, required: true },
    label: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    isCore: { type: Boolean, default: false },
    badge: { type: String, default: '' },
    icon: { type: String, default: '' }
  }],

  playerDefaults: {
    defaultVolume: { type: Number, default: 80, min: 0, max: 100 },
    autoPlayNext: { type: Boolean, default: true },
    visualizerEnabled: { type: Boolean, default: true }
  },

  searchPage: {
    heading: { type: String, default: 'Explore Global Music Catalog' },
    subheading: { type: String, default: 'Instant playback from millions of YouTube tracks, albums, and live sessions' },
    placeholder: { type: String, default: 'Search songs, artists, nostalgic gems, or paste YouTube link...' },
    helperText: { type: String, default: 'Tip: Try searching for "90s Kumar Sanu" or "Desi Punjabi Dhol"' }
  },

  footer: {
    copyright: { type: String, default: '© 2026 Loopra / AfterHours. All rights reserved.' },
    contactEmail: { type: String, default: 'pankajsss7238@gmail.com' },
    disclaimerText: { type: String, default: 'Audio plays through YouTube embedded player API. Loopra does not host copyrighted files directly.' },
    infoPages: [{
      title: { type: String },
      slug: { type: String },
      content: { type: String }
    }]
  },

  lastModifiedBy: { type: String, default: 'system' },
  publishedAt: { type: Date }
}, { timestamps: true });

export default mongoose.model('SiteConfig', siteConfigSchema);
