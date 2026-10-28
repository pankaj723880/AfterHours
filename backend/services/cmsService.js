import SiteConfig from '../models/SiteConfig.js';
import CuratedCollection from '../models/CuratedCollection.js';
import ContentVersion from '../models/ContentVersion.js';
import AuditLog from '../models/AuditLog.js';

export const getDefaultSiteConfig = () => ({
  branding: {
    siteName: 'Loopra',
    tagline: 'AfterHours Mehfil Music',
    logoUrl: '',
    faviconUrl: '',
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
      enabled: true,
      order: 1,
      bgImages: [
        'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=1600&auto=format&fit=crop'
      ],
      queries: ['90s bollywood hit songs kumar sanu Alka Yagnik']
    },
    {
      id: 'truck',
      title: 'Horn Ok Please',
      subtitle: 'High-Bass Highway Tracks, Rustic Punjabi Folk/Dhol Beats & Dhabha Anthems',
      badge: '🚛 Horn Ok Please • Highway Dhaba Vibe',
      artwork: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=1600&auto=format&fit=crop',
      enabled: true,
      order: 2,
      bgImages: [
        'https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=1600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1508873696983-2df5c92063c7?q=80&w=1600&auto=format&fit=crop'
      ],
      queries: ['altaf raja best songs hindi highway dhaba hits']
    },
    {
      id: 'pauwa',
      title: 'Theka Session',
      subtitle: 'Late-Night Party Anthems, High-Energy Drinking Bangers & Desi Hip-Hop',
      badge: '🍾 Theka Session • Desi Beats & Party Anthems',
      artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop',
      enabled: true,
      order: 3,
      bgImages: [
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop'
      ],
      queries: [
        'punjabi daru peg songs party hits yo yo honey singh badshah',
        'altaf raja sad songs dard bhare geet wine heartbreak'
      ]
    }
  ],
  navigation: [
    { id: 'home', label: 'Home', enabled: true, order: 1, isCore: true, icon: 'home', badge: '' },
    { id: 'discover', label: 'Search', enabled: true, order: 2, isCore: true, icon: 'search', badge: '' },
    { id: 'barber', label: 'Saloon FM', enabled: true, order: 3, isCore: false, icon: 'scissors', badge: '90s' },
    { id: 'truck', label: 'Horn Ok Please', enabled: true, order: 4, isCore: false, icon: 'truck', badge: 'Dhaba' },
    { id: 'pauwa', label: 'Theka Session', enabled: true, order: 5, isCore: false, icon: 'beer', badge: 'Desi' },
    { id: 'library', label: 'Favourites', enabled: true, order: 6, isCore: true, icon: 'heart', badge: '' },
    { id: 'history', label: 'History', enabled: true, order: 7, isCore: true, icon: 'history', badge: '' },
    { id: 'playlists', label: 'Playlists', enabled: true, order: 8, isCore: true, icon: 'list', badge: '' }
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
      let published = await SiteConfig.findOne({ configType: 'published' });
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
      }

      let draft = await SiteConfig.findOne({ configType: 'draft' });
      if (!draft) {
        const defaults = getDefaultSiteConfig();
        draft = await SiteConfig.create({
          configType: 'draft',
          version: published.version || 1,
          ...defaults,
          lastModifiedBy: 'system'
        });
        console.log('[CMS Service] Initialized default draft SiteConfig');
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
      let config = await SiteConfig.findOne({ configType: 'published' }).lean();
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

      const publicData = {
        version: config.version || 1,
        branding: { ...defaults.branding, ...(config.branding || {}) },
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
        navigation: (config.navigation || defaults.navigation)
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

  // Get full draft config for Admin CMS
  async getDraftConfig() {
    const defaults = getDefaultSiteConfig();
    let draft = await SiteConfig.findOne({ configType: 'draft' }).lean();
    if (!draft) {
      const published = await SiteConfig.findOne({ configType: 'published' }).lean();
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

    return {
      ...defaults,
      ...draft,
      branding: { ...defaults.branding, ...(draft.branding || {}) },
      theme: { ...defaults.theme, ...(draft.theme || {}) },
      announcement: { ...defaults.announcement, ...(draft.announcement || {}) },
      banner: { ...defaults.banner, ...(draft.banner || {}) },
      maintenance: { ...defaults.maintenance, ...(draft.maintenance || {}) },
      searchPage: { ...defaults.searchPage, ...(draft.searchPage || {}) },
      footer: { ...defaults.footer, ...(draft.footer || {}) },
      sections: Array.isArray(draft.sections) && draft.sections.length > 0 ? draft.sections : defaults.sections,
      stations: Array.isArray(draft.stations) && draft.stations.length > 0 ? draft.stations : defaults.stations,
      navigation: Array.isArray(draft.navigation) && draft.navigation.length > 0 ? draft.navigation : defaults.navigation,
      playerDefaults: { ...defaults.playerDefaults, ...(draft.playerDefaults || {}) }
    };
  },

  // Save changes to Draft without publishing to live website
  async saveDraft(data, adminUser) {
    const defaults = getDefaultSiteConfig();
    const existingDraft = await SiteConfig.findOne({ configType: 'draft' }).lean() || {};
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

    const updatePayload = {
      branding: { ...defaults.branding, ...(existingDraft.branding || {}), ...(safeData.branding || {}) },
      theme: mergedTheme,
      announcement: { ...defaults.announcement, ...(existingDraft.announcement || {}), ...(safeData.announcement || {}) },
      banner: { ...defaults.banner, ...(existingDraft.banner || {}), ...(safeData.banner || {}) },
      maintenance: { ...defaults.maintenance, ...(existingDraft.maintenance || {}), ...(safeData.maintenance || {}) },
      sections: Array.isArray(safeData.sections) && safeData.sections.length > 0 ? safeData.sections : (existingDraft.sections || defaults.sections),
      stations: Array.isArray(safeData.stations) && safeData.stations.length > 0 ? safeData.stations : (existingDraft.stations || defaults.stations),
      navigation: Array.isArray(safeData.navigation) && safeData.navigation.length > 0 ? safeData.navigation : (existingDraft.navigation || defaults.navigation),
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
    let draft = await SiteConfig.findOne({ configType: 'draft' }).lean();
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
