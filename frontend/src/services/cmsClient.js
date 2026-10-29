export const DEFAULT_CMS_CONFIG = {
  version: 1,
  branding: {
    siteName: '',
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
    linkText: '',
    dismissible: true
  },
  banner: {
    enabled: false,
    title: 'Nostalgic Radio Stations Now Live',
    subtitle: 'Listen to 90s Saloon FM, Highway Truck Melodies, and Theka Session nonstop.',
    imageUrl: '',
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
    { id: 'trending', title: 'Trending songs', subtitle: 'The most played hits right now', enabled: true, order: 1, displayLimit: 12 },
    { id: 'artists', title: 'Popular artists', subtitle: 'Find your favorite singers', enabled: true, order: 2, displayLimit: 18 },
    { id: 'albums', title: 'Popular albums and singles', subtitle: 'Latest releases', enabled: true, order: 3, displayLimit: 12 },
    { id: 'radio', title: 'Popular radio', subtitle: 'Live streams 24/7', enabled: true, order: 4, displayLimit: 12 },
    { id: 'curated_playlists', title: 'Curated Featured Collections', subtitle: 'Hand-picked mixes by our music editors', enabled: true, order: 5, displayLimit: 8 }
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
    infoPages: []
  },
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
      genres: ['College Rock', 'Pop Rock', 'Romantic Ballads', 'Club Remixes'],
      queries: ['2000s bollywood hits kk sonu nigam mohit chauhan', 'y2k bollywood party hits 2000s pop']
    },
    {
      id: '2010s',
      title: 'Modern Streaming & Indie Renaissance',
      decade: '2010s',
      subtitle: 'Arijit Singh, Amit Trivedi, Desi Hip-Hop, Coke Studio & Indie Melodies',
      description: 'The renaissance of independent singer-songwriters, acoustic folk melodies, and soulful anthems.',
      badge: '⚡ 2010s Indie Wave',
      artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
      enabled: true,
      order: 5,
      genres: ['Indie Folk', 'Soulful Acoustics', 'Desi Hip-Hop', 'EDM Fusion'],
      queries: ['2010s arijit singh hits amit trivedi prateek kuhad', '2010s hindi indie pop acoustic hits']
    }
  ],
  featuredCollections: []
};

export const normalizeNavigationList = (rawNav) => {
  const defaults = DEFAULT_CMS_CONFIG.navigation;
  const input = Array.isArray(rawNav) ? rawNav : [];
  const map = new Map();

  defaults.forEach((item, index) => {
    map.set(item.id, { ...item, order: index + 1 });
  });

  input.forEach(item => {
    if (!item || !item.id) return;
    if (item.id === 'profile' || item.id === 'equalizer') return;

    const existing = map.get(item.id);
    if (existing) {
      let group = existing.group;
      if (['barber', 'truck', 'pauwa'].includes(item.id)) group = 'stations';
      else if (['mood', 'timemachine', 'activity', 'swipe'].includes(item.id)) group = 'discovery';
      else if (['library', 'history', 'playlists', 'stats'].includes(item.id)) group = 'collection';
      else if (['home', 'discover', 'radio'].includes(item.id)) group = 'main';

      let label = item.label || existing.label;
      if (item.id === 'library' && (label === 'Liked Songs' || !label)) label = 'Liked Songs Collection';
      if (item.id === 'history' && (label === 'History' || !label)) label = 'Listening History';

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
    .filter(n => n.id !== 'profile' && n.id !== 'equalizer')
    .sort((a, b) => (a.order || 0) - (b.order || 0));
};

export const normalizeCmsConfig = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_CMS_CONFIG));
  }

  const defaultTheme = DEFAULT_CMS_CONFIG.theme;
  const rawTheme = (raw.theme && typeof raw.theme === 'object') ? raw.theme : {};

  return {
    version: typeof raw.version === 'number' ? raw.version : DEFAULT_CMS_CONFIG.version,
    branding: {
      siteName: typeof raw.branding?.siteName === 'string' ? raw.branding.siteName : (DEFAULT_CMS_CONFIG.branding.siteName || ''),
      tagline: raw.branding?.tagline ?? DEFAULT_CMS_CONFIG.branding.tagline,
      logoUrl: raw.branding?.logoUrl ?? DEFAULT_CMS_CONFIG.branding.logoUrl,
      faviconUrl: raw.branding?.faviconUrl ?? DEFAULT_CMS_CONFIG.branding.faviconUrl,
      description: raw.branding?.description ?? DEFAULT_CMS_CONFIG.branding.description
    },
    theme: {
      accentColor: (typeof rawTheme.accentColor === 'string' && rawTheme.accentColor.trim())
        ? rawTheme.accentColor.trim()
        : defaultTheme.accentColor,
      themeMode: ['dark', 'midnight', 'neon'].includes(rawTheme.themeMode)
        ? rawTheme.themeMode
        : defaultTheme.themeMode,
      glassmorphism: typeof rawTheme.glassmorphism === 'boolean'
        ? rawTheme.glassmorphism
        : defaultTheme.glassmorphism,
      meshGradient: typeof rawTheme.meshGradient === 'boolean'
        ? rawTheme.meshGradient
        : defaultTheme.meshGradient,
      particles: typeof rawTheme.particles === 'boolean'
        ? rawTheme.particles
        : defaultTheme.particles
    },
    announcement: {
      enabled: typeof raw.announcement?.enabled === 'boolean' ? raw.announcement.enabled : DEFAULT_CMS_CONFIG.announcement.enabled,
      message: raw.announcement?.message ?? DEFAULT_CMS_CONFIG.announcement.message,
      type: raw.announcement?.type ?? DEFAULT_CMS_CONFIG.announcement.type,
      linkUrl: raw.announcement?.linkUrl ?? DEFAULT_CMS_CONFIG.announcement.linkUrl,
      linkText: raw.announcement?.linkText ?? DEFAULT_CMS_CONFIG.announcement.linkText,
      dismissible: typeof raw.announcement?.dismissible === 'boolean' ? raw.announcement.dismissible : DEFAULT_CMS_CONFIG.announcement.dismissible
    },
    banner: {
      enabled: typeof raw.banner?.enabled === 'boolean' ? raw.banner.enabled : DEFAULT_CMS_CONFIG.banner.enabled,
      title: raw.banner?.title ?? DEFAULT_CMS_CONFIG.banner.title,
      subtitle: raw.banner?.subtitle ?? DEFAULT_CMS_CONFIG.banner.subtitle,
      imageUrl: raw.banner?.imageUrl ?? DEFAULT_CMS_CONFIG.banner.imageUrl,
      actionText: raw.banner?.actionText ?? DEFAULT_CMS_CONFIG.banner.actionText,
      actionUrl: raw.banner?.actionUrl ?? DEFAULT_CMS_CONFIG.banner.actionUrl
    },
    maintenance: {
      enabled: typeof raw.maintenance?.enabled === 'boolean' ? raw.maintenance.enabled : DEFAULT_CMS_CONFIG.maintenance.enabled,
      title: raw.maintenance?.title ?? DEFAULT_CMS_CONFIG.maintenance.title,
      message: raw.maintenance?.message ?? DEFAULT_CMS_CONFIG.maintenance.message,
      allowedRoles: Array.isArray(raw.maintenance?.allowedRoles) ? raw.maintenance.allowedRoles : DEFAULT_CMS_CONFIG.maintenance.allowedRoles
    },
    sections: Array.isArray(raw.sections) && raw.sections.length > 0 ? raw.sections : DEFAULT_CMS_CONFIG.sections,
    stations: Array.isArray(raw.stations) ? raw.stations : DEFAULT_CMS_CONFIG.stations,
    timeMachineEras: Array.isArray(raw.timeMachineEras) ? raw.timeMachineEras : DEFAULT_CMS_CONFIG.timeMachineEras,
    navigation: normalizeNavigationList(raw.navigation),
    playerDefaults: {
      defaultVolume: typeof raw.playerDefaults?.defaultVolume === 'number' ? raw.playerDefaults.defaultVolume : DEFAULT_CMS_CONFIG.playerDefaults.defaultVolume,
      autoPlayNext: typeof raw.playerDefaults?.autoPlayNext === 'boolean' ? raw.playerDefaults.autoPlayNext : DEFAULT_CMS_CONFIG.playerDefaults.autoPlayNext,
      visualizerEnabled: typeof raw.playerDefaults?.visualizerEnabled === 'boolean' ? raw.playerDefaults.visualizerEnabled : DEFAULT_CMS_CONFIG.playerDefaults.visualizerEnabled
    },
    searchPage: {
      heading: raw.searchPage?.heading ?? DEFAULT_CMS_CONFIG.searchPage.heading,
      subheading: raw.searchPage?.subheading ?? DEFAULT_CMS_CONFIG.searchPage.subheading,
      placeholder: raw.searchPage?.placeholder ?? DEFAULT_CMS_CONFIG.searchPage.placeholder,
      helperText: raw.searchPage?.helperText ?? DEFAULT_CMS_CONFIG.searchPage.helperText
    },
    footer: {
      copyright: raw.footer?.copyright ?? DEFAULT_CMS_CONFIG.footer.copyright,
      contactEmail: raw.footer?.contactEmail ?? DEFAULT_CMS_CONFIG.footer.contactEmail,
      disclaimerText: raw.footer?.disclaimerText ?? DEFAULT_CMS_CONFIG.footer.disclaimerText,
      infoPages: Array.isArray(raw.footer?.infoPages) ? raw.footer.infoPages : DEFAULT_CMS_CONFIG.footer.infoPages
    },
    featuredCollections: Array.isArray(raw.featuredCollections) ? raw.featuredCollections : []
  };
};

const STORAGE_KEY = 'afterhours_cms_public_config';

export const getCachedCmsConfig = () => {
  if (typeof window === 'undefined') return normalizeCmsConfig(DEFAULT_CMS_CONFIG);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeCmsConfig(DEFAULT_CMS_CONFIG);
    return normalizeCmsConfig(JSON.parse(raw));
  } catch (e) {
    return normalizeCmsConfig(DEFAULT_CMS_CONFIG);
  }
};

export const fetchPublicCmsConfig = async (backendUrl) => {
  const cleanUrl = (backendUrl || '').trim().replace(/\/+$/, '');
  try {
    const res = await fetch(`${cleanUrl}/api/cms/public-config?_t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && typeof data === 'object') {
      const normalized = normalizeCmsConfig(data);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } catch (e) {}
      applyThemeToDom(normalized.theme, true);
      return normalized;
    }
  } catch (err) {
    console.warn('[CMS Client] Notice fetching public config:', err.message);
  }
  const fallback = getCachedCmsConfig();
  applyThemeToDom(fallback.theme, false);
  return fallback;
};

export const hexToRgb = (hex) => {
  try {
    let clean = (hex || '#f59e0b').replace('#', '').trim();
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    const num = parseInt(clean, 16);
    if (isNaN(num)) return { r: 245, g: 158, b: 11 };
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  } catch (e) {
    return { r: 245, g: 158, b: 11 };
  }
};

export const adjustBrightness = (hex, percent) => {
  const { r, g, b } = hexToRgb(hex);
  const adjust = (val) => Math.min(255, Math.max(0, Math.round(val + (val * percent) / 100)));
  const nr = adjust(r);
  const ng = adjust(g);
  const nb = adjust(b);
  return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
};

export const applyThemeToDom = (theme, persistToStorage = false) => {
  if (typeof document === 'undefined') return;
  const defaultTheme = DEFAULT_CMS_CONFIG.theme;
  const incomingTheme = (theme && typeof theme === 'object') ? theme : {};
  const safeTheme = {
    accentColor: (typeof incomingTheme.accentColor === 'string' && incomingTheme.accentColor.trim())
      ? incomingTheme.accentColor.trim()
      : defaultTheme.accentColor,
    themeMode: ['dark', 'midnight', 'neon'].includes(incomingTheme.themeMode)
      ? incomingTheme.themeMode
      : defaultTheme.themeMode,
    glassmorphism: typeof incomingTheme.glassmorphism === 'boolean'
      ? incomingTheme.glassmorphism
      : defaultTheme.glassmorphism,
    meshGradient: typeof incomingTheme.meshGradient === 'boolean'
      ? incomingTheme.meshGradient
      : defaultTheme.meshGradient,
    particles: typeof incomingTheme.particles === 'boolean'
      ? incomingTheme.particles
      : defaultTheme.particles
  };

  const accentColor = safeTheme.accentColor || '#f59e0b';
  const rgb = hexToRgb(accentColor);
  const hoverColor = adjustBrightness(accentColor, 15);
  const lightColor = adjustBrightness(accentColor, 35);
  const darkColor = adjustBrightness(accentColor, -20);

  const root = document.documentElement;

  // 1. Accent color CSS variables
  root.style.setProperty('--accent-color', accentColor);
  root.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  root.style.setProperty('--accent-color-hover', hoverColor);
  root.style.setProperty('--accent-color-light', lightColor);
  root.style.setProperty('--accent-color-dark', darkColor);

  // 2. Theme Mode
  root.setAttribute('data-theme', safeTheme.themeMode || 'dark');

  // 3. Glassmorphism toggle
  if (safeTheme.glassmorphism === false) {
    root.classList.add('no-glass');
    root.style.setProperty('--glass-blur', '0px');
  } else {
    root.classList.remove('no-glass');
    root.style.setProperty('--glass-blur', '24px');
  }

  // 4. Optionally cache in localStorage for published theme
  if (persistToStorage) {
    try {
      localStorage.setItem('afterhours_applied_theme', JSON.stringify(safeTheme));
    } catch (e) {}
  }
};
