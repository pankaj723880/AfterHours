import SiteConfig from '../models/SiteConfig.js';
import CuratedCollection from '../models/CuratedCollection.js';
import ContentVersion from '../models/ContentVersion.js';
import AuditLog from '../models/AuditLog.js';

export const getDefaultSiteConfig = () => ({
  branding: {
    siteName: 'Loopra',
    tagline: 'AfterHours Mehfil Music',
    logoUrl: '/loopra-logo.png',
    faviconUrl: '/loopra-logo.png',
    description: 'Endless retro Hindi, Bollywood nostalgia, and high-energy desi soundtracks without subscriptions.'
  },
  theme: {
    accentColor: '#f59e0b',
    themeMode: 'dark',
    glassmorphism: true,
    meshGradient: true,
    particles: true
  },
  announcement: {
    enabled: false,
    message: 'Welcome to Loopra! Enjoy uninterrupted retro Bollywood and curated hits.',
    type: 'info',
    linkUrl: '',
    linkText: 'Learn More',
    dismissible: true
  },
  banner: {
    enabled: false,
    title: 'Nostalgic Radio Stations Now Live',
    subtitle: 'Listen to 90s Saloon FM, Highway Truck Melodies, and Theka Session nonstop.',
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1600&auto=format&fit=crop',
    actionText: 'Tune In Now',
    actionUrl: '/station/barber'
  },
  maintenance: {
    enabled: false,
    title: 'Loopra Under Scheduled Maintenance',
    message: 'We are currently tuning our audio nodes. Audio service will resume shortly.',
    allowedRoles: ['admin']
  },
  sections: [
    {
      id: 'trending',
      title: 'Trending songs',
      subtitle: 'The most played hits right now',
      enabled: true,
      order: 1,
      displayLimit: 12
    },
    {
      id: 'artists',
      title: 'Popular artists',
      subtitle: 'Find your favorite singers',
      enabled: true,
      order: 2,
      displayLimit: 18
    },
    {
      id: 'albums',
      title: 'Popular albums and singles',
      subtitle: 'Latest releases & iconic soundtracks',
      enabled: true,
      order: 3,
      displayLimit: 12
    },
    {
      id: 'radio',
      title: 'Popular radio',
      subtitle: 'Live streams and 24/7 continuous audio',
      enabled: true,
      order: 4,
      displayLimit: 12
    },
    {
      id: 'curated_playlists',
      title: 'Curated Featured Collections',
      subtitle: 'Hand-picked mixes by our music editors',
      enabled: true,
      order: 5,
      displayLimit: 8
    }
  ],
  stations: [
    {
      id: 'barber',
      title: 'Saloon FM',
      subtitle: 'Iconic 90s & 2000s Bollywood Melodies, Golden Era Romance & Nostalgic Radio Hits',
      badge: '💈 Saloon FM • 90s/2000s Nostalgia Radio',
      artwork: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1600&auto=format&fit=crop',
      icon: 'scissors',
      accentColor: '#ef4444',
      category: '90s Bollywood',
      language: 'Hindi',
      enabled: true,
      order: 1,
      bgImages: [
        'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=1600&auto=format&fit=crop'
      ],
      queries: ['90s bollywood hit songs kumar sanu Alka Yagnik'],
      tracks: []
    },
    {
      id: 'truck',
      title: 'Horn Ok Please',
      subtitle: 'High-Bass Highway Tracks, Rustic Punjabi Folk/Dhol Beats & Dhabha Anthems',
      badge: '🚛 Horn Ok Please • Highway Dhaba Vibe',
      artwork: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=1600&auto=format&fit=crop',
      icon: 'truck',
      accentColor: '#f59e0b',
      category: 'Road Trips',
      language: 'Hindi & Punjabi',
      enabled: true,
      order: 2,
      bgImages: [
        'https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=1600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1508873696983-2df5c92063c7?q=80&w=1600&auto=format&fit=crop'
      ],
      queries: ['altaf raja best songs hindi highway dhaba hits'],
      tracks: []
    },
    {
      id: 'pauwa',
      title: 'Theka Session',
      subtitle: 'Late-Night Party Anthems, High-Energy Drinking Bangers & Desi Hip-Hop',
      badge: '🍾 Theka Session • Desi Beats & Party Anthems',
      artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop',
      icon: 'beer',
      accentColor: '#10b981',
      category: 'Party Hits',
      language: 'Desi Punjabi & Hindi',
      enabled: true,
      order: 3,
      bgImages: [
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop'
      ],
      queries: [
        'punjabi daru peg songs party hits yo yo honey singh badshah',
        'altaf raja sad songs dard bhare geet wine heartbreak'
      ],
      tracks: []
    }
  ],
  timeMachineEras: [
    {
      id: '1970s',
      title: 'Golden Retro Classics',
      decade: '1970s',
      subtitle: 'Kishore Kumar, RD Burman, Mohammed Rafi, Lata Mangeshkar & 70s Disco',
      description: 'Step into the golden vinyl era of analogue warmth, timeless melodies, and iconic orchestra arrangements.',
      badge: '📻 1970s Vinyl Era',
      artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
      enabled: true,
      order: 1,
      genres: ['Retro Bollywood', 'Disco', 'Classical Melody', 'Acoustic Folk'],
      queries: ['1970s hindi golden hits kishore kumar rd burman rafi', '70s retro bollywood classic disco melodies']
    },
    {
      id: '1980s',
      title: 'Cassette Era & Synth Beats',
      decade: '1980s',
      subtitle: 'Bappi Lahiri, Asha Bhosle, 80s Ghazals, Pop Anthems & Groovy Disco',
      description: 'The golden age of cassette tapes, synthesizer hooks, and soulful late-night ghazals.',
      badge: '📼 1980s Cassette Gold',
      artwork: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=800&auto=format&fit=crop',
      enabled: true,
      order: 2,
      genres: ['Synth Pop', 'Disco Beats', 'Ghazals', 'Romantic Duets'],
      queries: ['1980s bollywood disco hits bappi lahiri asha bhosle', '80s pop synth cassette classics hindi']
    },
    {
      id: '1990s',
      title: '90s Romantic Bollywood',
      decade: '1990s',
      subtitle: 'Kumar Sanu, Alka Yagnik, Udit Narayan, 90s Indipop & Euphoria',
      description: 'The quintessential era of timeless romance, melodious violins, monsoon ballads, and early Indipop waves.',
      badge: '💫 1990s Pure Romance',
      artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop',
      enabled: true,
      order: 3,
      genres: ['90s Romance', 'Monsoon Melodies', 'Indipop', 'Dholak Beats'],
      queries: ['1990s romantic bollywood hits kumar sanu alka yagnik', '90s iconic hindi songs udit narayan']
    },
    {
      id: '2000s',
      title: 'Millennium Pop & Y2K Hits',
      decade: '2000s',
      subtitle: 'KK, Sonu Nigam, Shreya Ghoshal, Sunidhi Chauhan & 2000s Rock-Pop',
      description: 'Unforgettable college rock anthems, soulful acoustic guitars, and legendary Bollywood millennium blockbusters.',
      badge: '💿 2000s Millennium Pop',
      artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop',
      enabled: true,
      order: 4,
      genres: ['2000s Pop', 'College Rock', 'Soulful Ballads', 'Bhangra Pop'],
      queries: ['2000s bollywood superhits kk sonu nigam shreya ghoshal', '2000s pop bangers hindi nostalgia']
    },
    {
      id: '2010s',
      title: 'Modern Desi Chartbusters',
      decade: '2010s',
      subtitle: 'Arijit Singh, Mohit Chauhan, Atif Aslam, Yo Yo Honey Singh & Pritam',
      description: 'Heart-wrenching acoustic ballads, EDM-infused party anthems, and modern indie melodies.',
      badge: '🔥 2010s Era Anthems',
      artwork: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800&auto=format&fit=crop',
      enabled: true,
      order: 5,
      genres: ['Modern Acoustic', 'EDM Fusion', 'Desi Hip-Hop', 'Sufi Rock'],
      queries: ['2010s best bollywood songs arijit singh mohit chauhan atif aslam', '2010s desi hits playlist']
    }
  ],
  navigation: [
    { id: 'home', label: 'Home', enabled: true, order: 1, isCore: true, icon: 'home', badge: '', group: 'main', route: '/' },
    { id: 'discover', label: 'Discover & Search', enabled: true, order: 2, isCore: true, icon: 'discover', badge: '', group: 'main', route: '/discover' },
    { id: 'radio', label: 'Indian Live Radio', enabled: true, order: 3, isCore: false, icon: 'radio', badge: 'Live', group: 'main', route: '/radio' },
    { id: 'mood', label: 'Mood-to-Music AI', enabled: true, order: 4, isCore: false, icon: 'sparkles', badge: 'AI', group: 'discovery', route: '/mood' },
    { id: 'timemachine', label: 'Time Machine Radio', enabled: true, order: 4, isCore: false, icon: 'radio', badge: 'Retro', group: 'discovery', route: '/timemachine' },
    { id: 'activity', label: 'Listening Activity', enabled: true, order: 5, isCore: false, icon: 'flame', badge: '', group: 'discovery', route: '/activity' },
    { id: 'swipe', label: 'Discover Swipe', enabled: true, order: 6, isCore: false, icon: 'swipe', badge: '', group: 'discovery', route: '/swipe' },
    { id: 'barber', label: 'Saloon FM', enabled: true, order: 7, isCore: false, icon: 'scissors', badge: '90s', group: 'stations', route: '/station/barber' },
    { id: 'truck', label: 'Horn Ok Please', enabled: true, order: 8, isCore: false, icon: 'truck', badge: 'Dhaba', group: 'stations', route: '/station/truck' },
    { id: 'pauwa', label: 'Theka Session', enabled: true, order: 9, isCore: false, icon: 'beer', badge: 'Desi', group: 'stations', route: '/station/pauwa' },
    { id: 'library', label: 'Liked Songs Collection', enabled: true, order: 10, isCore: true, icon: 'library', badge: '', group: 'collection', route: '/library' },
    { id: 'history', label: 'Listening History', enabled: true, order: 11, isCore: true, icon: 'history', badge: '', group: 'collection', route: '/history' },
    { id: 'playlists', label: 'Playlists', enabled: true, order: 12, isCore: true, icon: 'list', badge: '', group: 'collection', route: '/playlists' },
    { id: 'stats', label: 'Recap & Stats', enabled: true, order: 13, isCore: false, icon: 'sparkles', badge: '', group: 'collection', route: '/stats' }
  ],
  playerDefaults: {
    defaultVolume: 80,
    autoPlayNext: true,
    visualizerEnabled: true
  },
  searchPage: {
    heading: 'Explore Global Music Catalog',
    subheading: 'Instant playback from millions of YouTube tracks, albums, and live sessions',
    placeholder: 'Search songs, artists, nostalgic gems, or paste YouTube link...',
    helperText: 'Tip: Try searching for "90s Kumar Sanu", "Arijit Singh", or "Kishore Kumar"'
  },
  footer: {
    copyright: '© 2026 Loopra / AfterHours. All rights reserved.',
    contactEmail: 'pankajsss7238@gmail.com',
    disclaimerText: 'Audio plays through YouTube embedded player API. Loopra does not host copyrighted files directly.',
    infoPages: [
      {
        title: 'About Loopra',
        slug: 'about',
        content: 'Loopra is a next-generation retro and modern music streaming sanctuary designed for seamless audio immersion.'
      },
      {
        title: 'Audio Licensing',
        slug: 'licensing',
        content: 'All audio streams are rendered client-side through YouTube IFrame API compliant with all platform developer policies.'
      }
    ]
  }
});

export const STANDARD_NAVIGATION = getDefaultSiteConfig().navigation;

export const normalizeNavigationList = (rawNav) => {
  const defaults = getDefaultSiteConfig().navigation;
  const input = Array.isArray(rawNav) ? rawNav : [];
  const map = new Map();

  // Seed default canonical items
  defaults.forEach((item, index) => {
    map.set(item.id, { ...item, order: index + 1 });
  });

  // Apply customizations from input
  input.forEach(item => {
    if (!item || !item.id) return;

    const existing = map.get(item.id);
    if (existing) {
      let group = existing.group;
      if (['barber', 'truck', 'pauwa'].includes(item.id)) group = 'stations';
      else if (['mood', 'timemachine', 'activity', 'swipe'].includes(item.id)) group = 'discovery';
      else if (['library', 'history', 'playlists', 'stats', 'equalizer', 'profile'].includes(item.id)) group = 'collection';
      else if (['home', 'discover', 'radio'].includes(item.id)) group = 'main';

      let label = item.label || existing.label;

      map.set(item.id, {
        ...existing,
        ...item,
        group,
        label,
        enabled: item.enabled !== false
      });
    } else {
      let group = item.group || 'main';
      if (item.route?.startsWith('/station/') || group === 'stations') group = 'stations';
      map.set(item.id, {
        ...item,
        group,
        enabled: item.enabled !== false
      });
    }
  });

  return Array.from(map.values())
    .sort((a, b) => (a.order || 0) - (b.order || 0));
};

let publicConfigCache = null;
let publicConfigCacheTime = 0;
const CACHE_TTL_MS = 30000; // 30s cache

export const cmsService = {
  // Clear cached public response
  invalidateCache() {
    publicConfigCache = null;
    publicConfigCacheTime = 0;
  },

  // Initialize DB with defaults if not present
  async initDefaults() {
    try {
      // 1. Deduplicate published/draft configs if any redundant documents exist
      const publishedDocs = await SiteConfig.find({ configType: 'published' }).sort({ version: -1, updatedAt: -1 });
      if (publishedDocs.length > 1) {
        const keepId = publishedDocs[0]._id;
        await SiteConfig.deleteMany({ configType: 'published', _id: { $ne: keepId } });
        console.log('[CMS Service] Pruned redundant duplicate published SiteConfigs');
      }

      const draftDocs = await SiteConfig.find({ configType: 'draft' }).sort({ version: -1, updatedAt: -1 });
      if (draftDocs.length > 1) {
        const keepId = draftDocs[0]._id;
        await SiteConfig.deleteMany({ configType: 'draft', _id: { $ne: keepId } });
        console.log('[CMS Service] Pruned redundant duplicate draft SiteConfigs');
      }

      try {
        await SiteConfig.syncIndexes();
      } catch (idxErr) {
        console.warn('[CMS Service] Index sync notice:', idxErr.message);
      }

      let published = await SiteConfig.findOne({ configType: 'published' }).sort({ version: -1, updatedAt: -1 });
      if (!published) {
        const defaults = getDefaultSiteConfig();
        published = await SiteConfig.create({
          configType: 'published',
          version: 1,
          ...defaults,
          lastModifiedBy: 'system',
          publishedAt: new Date()
        });
        console.log('[CMS Service] Initialized default published SiteConfig');
      } else {
        const normalizedNav = normalizeNavigationList(published.navigation);
        await SiteConfig.updateOne({ _id: published._id }, { $set: { navigation: normalizedNav } });
      }

      let draft = await SiteConfig.findOne({ configType: 'draft' }).sort({ version: -1, updatedAt: -1 });
      if (!draft) {
        const defaults = getDefaultSiteConfig();
        draft = await SiteConfig.create({
          configType: 'draft',
          version: published.version || 1,
          ...defaults,
          lastModifiedBy: 'system'
        });
        console.log('[CMS Service] Initialized default draft SiteConfig');
      } else {
        const normalizedNav = normalizeNavigationList(draft.navigation);
        await SiteConfig.updateOne({ _id: draft._id }, { $set: { navigation: normalizedNav } });
      }

      // Seed curated collections if empty
      const curatedCount = await CuratedCollection.countDocuments();
      if (curatedCount === 0) {
        await CuratedCollection.create([
          {
            name: '90s Saloon Nostalgia Hits',
            slug: '90s-saloon-nostalgia-hits',
            category: 'station',
            description: 'Timeless Kumar Sanu, Alka Yagnik, and Udit Narayan romance hits.',
            coverArt: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1600&auto=format&fit=crop',
            isPublished: true,
            isFeaturedOnHome: true,
            sortOrder: 1,
            tracks: [
              {
                id: 'Yqj1_V90KJo',
                videoId: 'Yqj1_V90KJo',
                title: 'Chura Ke Dil Mera',
                artist: 'Kumar Sanu, Alka Yagnik',
                album: 'Main Khiladi Tu Anari',
                duration: '7:34',
                thumbnail: 'https://i.ytimg.com/vi/Yqj1_V90KJo/hqdefault.jpg',
                url: 'https://www.youtube.com/watch?v=Yqj1_V90KJo'
              },
              {
                id: 'KeyfUuXPOcY',
                videoId: 'KeyfUuXPOcY',
                title: 'Dheere Dheere Se Meri Zindagi',
                artist: 'Kumar Sanu, Anuradha Paudwal',
                album: 'Aashiqui',
                duration: '4:56',
                thumbnail: 'https://i.ytimg.com/vi/KeyfUuXPOcY/hqdefault.jpg',
                url: 'https://www.youtube.com/watch?v=KeyfUuXPOcY'
              },
              {
                id: 'cNV5hLSa9H8',
                videoId: 'cNV5hLSa9H8',
                title: 'Tujhe Dekha Toh Yeh Jaana Sanam',
                artist: 'Kumar Sanu, Lata Mangeshkar',
                album: 'DDLJ',
                duration: '5:14',
                thumbnail: 'https://i.ytimg.com/vi/cNV5hLSa9H8/hqdefault.jpg',
                url: 'https://www.youtube.com/watch?v=cNV5hLSa9H8'
              }
            ]
          },
          {
            name: 'Highway Dhaba Anthems',
            slug: 'highway-dhaba-anthems',
            category: 'station',
            description: 'Rustic Punjabi folk, heavy bass, and soulful truck-stop tunes.',
            coverArt: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=1600&auto=format&fit=crop',
            isPublished: true,
            isFeaturedOnHome: true,
            sortOrder: 2,
            tracks: [
              {
                id: 'r0c1f6XxRQg',
                videoId: 'r0c1f6XxRQg',
                title: 'Evergreen Hits of KK Jukebox',
                artist: 'KK, Pritam',
                album: 'Hits Compilation',
                duration: '45:10',
                thumbnail: 'https://i.ytimg.com/vi/r0c1f6XxRQg/hqdefault.jpg',
                url: 'https://www.youtube.com/watch?v=r0c1f6XxRQg'
              }
            ]
          },
          {
            name: 'Theka Party Bangers',
            slug: 'theka-party-bangers',
            category: 'station',
            description: 'Late night desi party tracks and high-energy hip hop beats.',
            coverArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop',
            isPublished: true,
            isFeaturedOnHome: true,
            sortOrder: 3,
            tracks: [
              {
                id: 'cIGd8gm_pYE',
                videoId: 'cIGd8gm_pYE',
                title: 'Diljit Dosanjh Superhits Radio',
                artist: 'Diljit Dosanjh',
                album: 'Superhits',
                duration: '32:15',
                thumbnail: 'https://i.ytimg.com/vi/cIGd8gm_pYE/hqdefault.jpg',
                url: 'https://www.youtube.com/watch?v=cIGd8gm_pYE'
              }
            ]
          }
        ]);
        console.log('[CMS Service] Initialized default CuratedCollections');
      }
    } catch (err) {
      console.warn('[CMS Service Init Warning]:', err.message);
    }
  },

  // Get sanitized public configuration (safe for any user / visitor)
  async getPublicConfig() {
    const now = Date.now();
    if (publicConfigCache && now - publicConfigCacheTime < CACHE_TTL_MS) {
      return publicConfigCache;
    }

    try {
      let config = await SiteConfig.findOne({ configType: 'published' }).sort({ version: -1, updatedAt: -1 }).lean();
      const defaults = getDefaultSiteConfig();
      if (!config) {
        config = defaults;
      }

      // Fetch featured collections for home page
      const featuredCollections = await CuratedCollection.find({
        isPublished: true,
        isFeaturedOnHome: true
      })
        .sort({ sortOrder: 1 })
        .lean();

      const rawTheme = config.theme && typeof config.theme === 'object' ? config.theme : {};
      const safeTheme = {
        accentColor: (typeof rawTheme.accentColor === 'string' && rawTheme.accentColor.trim()) ? rawTheme.accentColor.trim() : defaults.theme.accentColor,
        themeMode: ['dark', 'midnight', 'neon'].includes(rawTheme.themeMode) ? rawTheme.themeMode : defaults.theme.themeMode,
        glassmorphism: typeof rawTheme.glassmorphism === 'boolean' ? rawTheme.glassmorphism : defaults.theme.glassmorphism,
        meshGradient: typeof rawTheme.meshGradient === 'boolean' ? rawTheme.meshGradient : defaults.theme.meshGradient,
        particles: typeof rawTheme.particles === 'boolean' ? rawTheme.particles : defaults.theme.particles
      };

      const rawBranding = (config.branding && typeof config.branding === 'object') ? config.branding : {};
      const safeBranding = {
        ...defaults.branding,
        ...rawBranding,
        // If siteName is an empty string, preserve it as empty string so "Loopra" is not silently restored
        siteName: typeof rawBranding.siteName === 'string' ? rawBranding.siteName : (defaults.branding.siteName || ''),
        tagline: typeof rawBranding.tagline === 'string' ? rawBranding.tagline : defaults.branding.tagline,
        logoUrl: typeof rawBranding.logoUrl === 'string' ? rawBranding.logoUrl : defaults.branding.logoUrl,
        faviconUrl: typeof rawBranding.faviconUrl === 'string' ? rawBranding.faviconUrl : defaults.branding.faviconUrl,
        description: typeof rawBranding.description === 'string' ? rawBranding.description : defaults.branding.description
      };

      const publicData = {
        version: config.version || 1,
        branding: safeBranding,
        theme: safeTheme,
        announcement: { ...defaults.announcement, ...(config.announcement || {}) },
        banner: { ...defaults.banner, ...(config.banner || {}) },
        maintenance: { ...defaults.maintenance, ...(config.maintenance || {}) },
        sections: (config.sections || defaults.sections)
          .filter(s => s && s.enabled)
          .sort((a, b) => (a.order || 0) - (b.order || 0)),
        stations: (config.stations || defaults.stations)
          .filter(st => st && st.enabled)
          .sort((a, b) => (a.order || 0) - (b.order || 0)),
        timeMachineEras: (config.timeMachineEras || defaults.timeMachineEras || [])
          .filter(e => e && e.enabled)
          .sort((a, b) => (a.order || 0) - (b.order || 0)),
        navigation: normalizeNavigationList(config.navigation || defaults.navigation)
          .filter(n => n && (n.enabled || n.isCore))
          .sort((a, b) => (a.order || 0) - (b.order || 0)),
        playerDefaults: { ...defaults.playerDefaults, ...(config.playerDefaults || {}) },
        searchPage: { ...defaults.searchPage, ...(config.searchPage || {}) },
        footer: { ...defaults.footer, ...(config.footer || {}) },
        featuredCollections: (featuredCollections || []).map(c => ({
          id: c._id.toString(),
          name: c.name,
          slug: c.slug,
          category: c.category,
          description: c.description,
          coverArt: c.coverArt,
          tracksCount: (c.tracks || []).filter(t => !t.isHidden).length,
          tracks: (c.tracks || []).filter(t => !t.isHidden)
        }))
      };

      publicConfigCache = publicData;
      publicConfigCacheTime = now;
      return publicData;
    } catch (err) {
      console.warn('[CMS Service] Fallback to default public config:', err.message);
      return getDefaultSiteConfig();
    }
  },

  // Get current active maintenance configuration
  async getMaintenanceConfig() {
    try {
      const pub = await this.getPublicConfig();
      return pub?.maintenance || { enabled: false, title: '', message: '', allowedRoles: ['admin'] };
    } catch (err) {
      return { enabled: false, title: '', message: '', allowedRoles: ['admin'] };
    }
  },

  // Update maintenance mode directly (updates published & draft, invalidates cache)
  async updateMaintenance({ enabled, title, message }, adminUser) {
    const defaults = getDefaultSiteConfig();
    const published = await SiteConfig.findOne({ configType: 'published' }).sort({ version: -1, updatedAt: -1 });
    const draft = await SiteConfig.findOne({ configType: 'draft' }).sort({ version: -1, updatedAt: -1 });

    const newMaintenance = {
      ...(published?.maintenance || defaults.maintenance),
      enabled: typeof enabled === 'boolean' ? enabled : Boolean(published?.maintenance?.enabled),
      title: typeof title === 'string' ? title : (published?.maintenance?.title || defaults.maintenance.title),
      message: typeof message === 'string' ? message : (published?.maintenance?.message || defaults.maintenance.message),
      allowedRoles: ['admin']
    };

    const nextVersion = ((published?.version || 1) + 1);

    const updatedPublished = await SiteConfig.findOneAndUpdate(
      { configType: 'published' },
      {
        $set: {
          maintenance: newMaintenance,
          version: nextVersion,
          lastModifiedBy: adminUser?.username || 'admin',
          publishedAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (draft) {
      await SiteConfig.updateOne(
        { configType: 'draft' },
        {
          $set: {
            maintenance: newMaintenance,
            version: nextVersion,
            lastModifiedBy: adminUser?.username || 'admin'
          }
        }
      );
    }

    try {
      await ContentVersion.create({
        versionNumber: nextVersion,
        contentType: 'SITE_CONFIG',
        snapshot: updatedPublished.toObject ? updatedPublished.toObject() : updatedPublished,
        publishedBy: adminUser?.username || 'admin',
        changeSummary: `Emergency maintenance mode ${newMaintenance.enabled ? 'ENABLED' : 'DISABLED'} by admin`
      });
    } catch (verErr) {
      console.warn('[CMS Service] Version snapshot notice:', verErr.message);
    }

    this.invalidateCache();
    return updatedPublished;
  },

  // Get full draft config for Admin CMS
  async getDraftConfig() {
    const defaults = getDefaultSiteConfig();
    let draft = await SiteConfig.findOne({ configType: 'draft' }).sort({ version: -1, updatedAt: -1 }).lean();
    if (!draft) {
      const published = await SiteConfig.findOne({ configType: 'published' }).sort({ version: -1, updatedAt: -1 }).lean();
      if (published) {
        const { _id, configType, ...rest } = published;
        draft = await SiteConfig.create({
          configType: 'draft',
          ...rest
        });
        draft = draft.toObject();
      } else {
        return defaults;
      }
    }

    const rawDraftBranding = (draft.branding && typeof draft.branding === 'object') ? draft.branding : {};
    const draftBranding = {
      ...defaults.branding,
      ...rawDraftBranding,
      siteName: typeof rawDraftBranding.siteName === 'string' ? rawDraftBranding.siteName : (defaults.branding.siteName || ''),
      tagline: typeof rawDraftBranding.tagline === 'string' ? rawDraftBranding.tagline : defaults.branding.tagline,
      logoUrl: typeof rawDraftBranding.logoUrl === 'string' ? rawDraftBranding.logoUrl : defaults.branding.logoUrl,
      faviconUrl: typeof rawDraftBranding.faviconUrl === 'string' ? rawDraftBranding.faviconUrl : defaults.branding.faviconUrl,
      description: typeof rawDraftBranding.description === 'string' ? rawDraftBranding.description : defaults.branding.description
    };

    return {
      ...defaults,
      ...draft,
      branding: draftBranding,
      theme: { ...defaults.theme, ...(draft.theme || {}) },
      announcement: { ...defaults.announcement, ...(draft.announcement || {}) },
      banner: { ...defaults.banner, ...(draft.banner || {}) },
      maintenance: { ...defaults.maintenance, ...(draft.maintenance || {}) },
      searchPage: { ...defaults.searchPage, ...(draft.searchPage || {}) },
      footer: { ...defaults.footer, ...(draft.footer || {}) },
      sections: Array.isArray(draft.sections) && draft.sections.length > 0 ? draft.sections : defaults.sections,
      stations: Array.isArray(draft.stations) && draft.stations.length > 0 ? draft.stations : defaults.stations,
      timeMachineEras: Array.isArray(draft.timeMachineEras) && draft.timeMachineEras.length > 0 ? draft.timeMachineEras : defaults.timeMachineEras,
      navigation: normalizeNavigationList(Array.isArray(draft.navigation) && draft.navigation.length > 0 ? draft.navigation : defaults.navigation),
      playerDefaults: { ...defaults.playerDefaults, ...(draft.playerDefaults || {}) }
    };
  },

  // Save changes to Draft without publishing to live website
  async saveDraft(data, adminUser) {
    const defaults = getDefaultSiteConfig();
    const existingDraft = await SiteConfig.findOne({ configType: 'draft' }).sort({ version: -1, updatedAt: -1 }).lean() || {};
    const safeData = (data && typeof data === 'object') ? data : {};

    const incomingTheme = (safeData.theme && typeof safeData.theme === 'object') ? safeData.theme : {};
    const existingTheme = (existingDraft.theme && typeof existingDraft.theme === 'object') ? existingDraft.theme : defaults.theme;

    const mergedTheme = {
      accentColor: (typeof incomingTheme.accentColor === 'string' && incomingTheme.accentColor.trim())
        ? incomingTheme.accentColor.trim()
        : (existingTheme.accentColor || defaults.theme.accentColor),
      themeMode: ['dark', 'midnight', 'neon'].includes(incomingTheme.themeMode)
        ? incomingTheme.themeMode
        : (existingTheme.themeMode || defaults.theme.themeMode),
      glassmorphism: typeof incomingTheme.glassmorphism === 'boolean'
        ? incomingTheme.glassmorphism
        : (typeof existingTheme.glassmorphism === 'boolean' ? existingTheme.glassmorphism : defaults.theme.glassmorphism),
      meshGradient: typeof incomingTheme.meshGradient === 'boolean'
        ? incomingTheme.meshGradient
        : (typeof existingTheme.meshGradient === 'boolean' ? existingTheme.meshGradient : defaults.theme.meshGradient),
      particles: typeof incomingTheme.particles === 'boolean'
        ? incomingTheme.particles
        : (typeof existingTheme.particles === 'boolean' ? existingTheme.particles : defaults.theme.particles)
    };

    const incomingBranding = (safeData.branding && typeof safeData.branding === 'object') ? safeData.branding : {};
    const existingBranding = (existingDraft.branding && typeof existingDraft.branding === 'object') ? existingDraft.branding : defaults.branding;

    const mergedBranding = {
      ...defaults.branding,
      ...existingBranding,
      ...incomingBranding,
      siteName: typeof incomingBranding.siteName === 'string'
        ? incomingBranding.siteName
        : (typeof existingBranding.siteName === 'string' ? existingBranding.siteName : (defaults.branding.siteName || '')),
      tagline: typeof incomingBranding.tagline === 'string' ? incomingBranding.tagline : existingBranding.tagline,
      logoUrl: typeof incomingBranding.logoUrl === 'string' ? incomingBranding.logoUrl : existingBranding.logoUrl,
      faviconUrl: typeof incomingBranding.faviconUrl === 'string' ? incomingBranding.faviconUrl : existingBranding.faviconUrl,
      description: typeof incomingBranding.description === 'string' ? incomingBranding.description : existingBranding.description
    };

    const updatePayload = {
      branding: mergedBranding,
      theme: mergedTheme,
      announcement: { ...defaults.announcement, ...(existingDraft.announcement || {}), ...(safeData.announcement || {}) },
      banner: { ...defaults.banner, ...(existingDraft.banner || {}), ...(safeData.banner || {}) },
      maintenance: { ...defaults.maintenance, ...(existingDraft.maintenance || {}), ...(safeData.maintenance || {}) },
      sections: Array.isArray(safeData.sections) && safeData.sections.length > 0 ? safeData.sections : (existingDraft.sections || defaults.sections),
      stations: Array.isArray(safeData.stations) ? safeData.stations : (existingDraft.stations || defaults.stations),
      timeMachineEras: Array.isArray(safeData.timeMachineEras) ? safeData.timeMachineEras : (existingDraft.timeMachineEras || defaults.timeMachineEras),
      navigation: normalizeNavigationList(Array.isArray(safeData.navigation) ? safeData.navigation : (existingDraft.navigation || defaults.navigation)),
      playerDefaults: { ...defaults.playerDefaults, ...(existingDraft.playerDefaults || {}), ...(safeData.playerDefaults || {}) },
      searchPage: { ...defaults.searchPage, ...(existingDraft.searchPage || {}), ...(safeData.searchPage || {}) },
      footer: { ...defaults.footer, ...(existingDraft.footer || {}), ...(safeData.footer || {}) },
      lastModifiedBy: adminUser?.username || 'admin'
    };

    const updated = await SiteConfig.findOneAndUpdate(
      { configType: 'draft' },
      { $set: updatePayload },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    return updated;
  },

  // Publish Draft to Live Website & save version snapshot
  async publish(adminUser, changeSummary = 'Published CMS update') {
    let draft = await SiteConfig.findOne({ configType: 'draft' }).sort({ version: -1, updatedAt: -1 }).lean();
    if (!draft) {
      draft = await this.getDraftConfig();
    }

    const defaults = getDefaultSiteConfig();
    const draftTheme = (draft.theme && typeof draft.theme === 'object') ? draft.theme : defaults.theme;
    const safeTheme = {
      accentColor: (typeof draftTheme.accentColor === 'string' && draftTheme.accentColor.trim()) ? draftTheme.accentColor.trim() : defaults.theme.accentColor,
      themeMode: ['dark', 'midnight', 'neon'].includes(draftTheme.themeMode) ? draftTheme.themeMode : defaults.theme.themeMode,
      glassmorphism: typeof draftTheme.glassmorphism === 'boolean' ? draftTheme.glassmorphism : defaults.theme.glassmorphism,
      meshGradient: typeof draftTheme.meshGradient === 'boolean' ? draftTheme.meshGradient : defaults.theme.meshGradient,
      particles: typeof draftTheme.particles === 'boolean' ? draftTheme.particles : defaults.theme.particles
    };

    const nextVersion = (draft.version || 1) + 1;

    // 1. Update published configuration
    const { _id, configType, createdAt, updatedAt, ...draftContent } = draft;
    const published = await SiteConfig.findOneAndUpdate(
      { configType: 'published' },
      {
        $set: {
          ...draftContent,
          configType: 'published',
          theme: safeTheme,
          version: nextVersion,
          lastModifiedBy: adminUser?.username || 'admin',
          publishedAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    // Also bump draft version
    await SiteConfig.updateOne(
      { configType: 'draft' },
      { $set: { version: nextVersion, lastModifiedBy: adminUser?.username || 'admin' } }
    );

    // 2. Snapshot into ContentVersion
    await ContentVersion.create({
      versionNumber: nextVersion,
      contentType: 'SITE_CONFIG',
      snapshot: published.toObject ? published.toObject() : published,
      publishedBy: adminUser?.username || 'admin',
      changeSummary
    });

    // 3. Invalidate public cache
    this.invalidateCache();

    return published;
  },

  // Restore snapshot version
  async restoreVersion(versionId, adminUser) {
    const versionRecord = await ContentVersion.findById(versionId).lean();
    if (!versionRecord) {
      throw new Error('Specified version record not found');
    }

    const snapshot = versionRecord.snapshot;
    const { _id, configType, createdAt, updatedAt, ...rest } = snapshot;
    const nextVersion = (snapshot.version || 1) + 1;

    // Apply to published
    await SiteConfig.findOneAndUpdate(
      { configType: 'published' },
      {
        $set: {
          ...rest,
          version: nextVersion,
          lastModifiedBy: adminUser.username,
          publishedAt: new Date()
        }
      },
      { upsert: true }
    );

    // Apply to draft
    await SiteConfig.findOneAndUpdate(
      { configType: 'draft' },
      {
        $set: {
          ...rest,
          version: nextVersion,
          lastModifiedBy: adminUser.username
        }
      },
      { upsert: true }
    );

    // Record new audit snapshot
    await ContentVersion.create({
      versionNumber: nextVersion,
      contentType: 'SITE_CONFIG',
      snapshot: rest,
      publishedBy: adminUser.username,
      changeSummary: `Restored to Revision #${versionRecord.versionNumber}`
    });

    this.invalidateCache();

    return { message: `Successfully restored to revision #${versionRecord.versionNumber}`, version: nextVersion };
  }
};
