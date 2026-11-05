/**
 * Loopra Centralized Website Interaction Registry
 * 
 * Comprehensive inventory of all pages, routes, stations, controls, and dynamic elements.
 * Features:
 * 1. Complete static registry of all routes, sub-views, and controls.
 * 2. High-priority exact destination matching to prevent cross-station confusion (e.g., Saloon FM vs Time Machine).
 * 3. Dynamic DOM element discovery for songs, albums, and artists.
 * 4. Multi-lingual Hindi/Hinglish fuzzy normalization.
 */

// Master Static Website Inventory
export const STATIC_INTERACTION_REGISTRY = [
  // --- TOP LEVEL PAGES & SPECIAL STATIONS ---
  {
    id: 'barber',
    name: 'Saloon FM',
    type: 'station',
    route: '/barber',
    parentPage: 'home',
    selector: '[data-nav-id="barber"], a[href*="barber"]',
    priority: 100, // Highest priority to eliminate regression
    aliases: [
      'saloon fm', 'saloon', 'salon fm', 'salon', 'lune fm', 'luna fm',
      'saloon kholo', 'salon open karo', 'saloon nostalgia', '90s saloon',
      'barber station', 'barber', 'saloon chalao'
    ],
    description: 'Iconic 90s & 2000s Bollywood Melodies, Nostalgic Radio Hits'
  },
  {
    id: 'truck',
    name: 'Horn Ok Please',
    type: 'station',
    route: '/truck',
    parentPage: 'home',
    selector: '[data-nav-id="truck"], a[href*="truck"]',
    priority: 95,
    aliases: [
      'horn ok please', 'horn ok', 'truck melodies', 'highway truck',
      'dhaba', 'dhaba station', 'highway tunes', 'punjabi truck'
    ],
    description: 'High-Bass Highway Tracks, Rustic Punjabi Folk & Dhabha Anthems'
  },
  {
    id: 'pauwa',
    name: 'Theka Session',
    type: 'station',
    route: '/pauwa',
    parentPage: 'home',
    selector: '[data-nav-id="pauwa"], a[href*="pauwa"]',
    priority: 95,
    aliases: [
      'theka session', 'theka', 'theka kholo', 'desi theka', 'pauwa',
      'desi theka session', 'theka open karo', 'mehfil station'
    ],
    description: 'Energetic Desi Party Bangers, Late Night Theka Anthems'
  },
  {
    id: 'timemachine',
    name: 'Time Machine Radio',
    type: 'station',
    route: '/timemachine',
    parentPage: 'home',
    selector: '[data-nav-id="timemachine"], a[href*="timemachine"]',
    priority: 90,
    aliases: [
      'time machine radio', 'time machine', 'time machine kholo', 'retro era',
      'retro music', 'purana radio', 'time travel radio'
    ],
    description: 'Decade-by-Decade Retro Bollywood & World Classics'
  },
  {
    id: 'radio',
    name: 'Indian Live Radio',
    type: 'page',
    route: '/radio',
    parentPage: 'root',
    selector: '[data-nav-id="radio"], a[href*="radio"]',
    priority: 85,
    aliases: [
      'indian live radio', 'live radio', 'radio stations', 'radio kholo',
      'fm radio', 'fm kholo', 'fm stations', 'radio'
    ],
    description: 'Live Broadcast Radio Stations Across India'
  },
  {
    id: 'home',
    name: 'Home',
    type: 'page',
    route: '/',
    parentPage: 'root',
    selector: '[data-nav-id="home"], a[href="/"]',
    priority: 90,
    aliases: [
      'home', 'home page', 'ghar jao', 'main page', 'homepage', 'start'
    ],
    description: 'Loopra Main Feed and Station Hub'
  },
  {
    id: 'discover',
    name: 'Discover & Search',
    type: 'page',
    route: '/discover',
    parentPage: 'root',
    selector: '[data-nav-id="discover"], a[href*="discover"]',
    priority: 90,
    aliases: [
      'discover', 'discover and search', 'search page', 'discover page',
      'khojo', 'search kholo', 'explore', 'explore music'
    ],
    description: 'Search Songs, Artists, Albums & Discover Trending Playlists'
  },
  {
    id: 'swipe',
    name: 'Discover Swipe',
    type: 'page',
    route: '/swipe',
    parentPage: 'root',
    selector: '[data-nav-id="swipe"], a[href*="swipe"]',
    priority: 80,
    aliases: [
      'discover swipe', 'swipe', 'music swipe', 'song swipe', 'music tinder'
    ],
    description: 'Quick Music Discovery with 30s Snippet Swiping'
  },
  {
    id: 'for-you',
    name: 'Curated Just For You',
    type: 'page',
    route: '/for-you',
    parentPage: 'root',
    selector: '[data-nav-id="for-you"], a[href*="for-you"]',
    priority: 85,
    aliases: [
      'curated just for you', 'for you', 'made for you', 'recommendations',
      'personalized songs', 'mere liye gaane'
    ],
    description: 'AI & Hybrid Personalized Recommendations'
  },
  {
    id: 'mood',
    name: 'Mood-to-Music AI',
    type: 'page',
    route: '/mood',
    parentPage: 'root',
    selector: '[data-nav-id="mood"], a[href*="mood"]',
    priority: 85,
    aliases: [
      'mood to music', 'mood to music ai', 'mood music', 'vibe to music',
      'mood station', 'mood kholo', 'kaisa mood hai'
    ],
    description: 'AI Musical Companion matching current emotional vibe'
  },
  {
    id: 'library',
    name: 'Music Library / Liked Songs',
    type: 'page',
    route: '/library',
    parentPage: 'root',
    selector: '[data-nav-id="library"], a[href*="library"]',
    priority: 85,
    aliases: [
      'library', 'music library', 'liked songs', 'liked songs collection',
      'mere gaane', 'pasandida gaane', 'my songs', 'favorites'
    ],
    description: 'Personal Liked Songs and Saved Collections'
  },
  {
    id: 'history',
    name: 'Listening History',
    type: 'page',
    route: '/history',
    parentPage: 'root',
    selector: '[data-nav-id="history"], a[href*="history"]',
    priority: 85,
    aliases: [
      'listening history', 'history', 'purane gaane', 'recently played',
      'sune huye gaane', 'history kholo'
    ],
    description: 'Track of all recently played songs'
  },
  {
    id: 'playlists',
    name: 'Playlists',
    type: 'page',
    route: '/playlists',
    parentPage: 'root',
    selector: '[data-nav-id="playlists"], a[href*="playlists"]',
    priority: 80,
    aliases: [
      'playlists', 'playlist', 'my playlists', 'meri playlist', 'playlist dikhao'
    ],
    description: 'User Created & Curated Playlists'
  },
  {
    id: 'activity',
    name: 'Listening Activity',
    type: 'page',
    route: '/activity',
    parentPage: 'root',
    selector: '[data-nav-id="activity"], a[href*="activity"]',
    priority: 80,
    aliases: [
      'listening activity', 'activity', 'listening history', 'recently played',
      'recent activity', 'activity kholo', 'meri activity'
    ],
    description: 'Personal Listening Activity & Real-Time Feed'
  },
  {
    id: 'dj-club',
    name: 'Loopra DJ Club',
    type: 'page',
    route: '/dj-club',
    parentPage: 'root',
    selector: '[data-nav-id="dj-club"], a[href*="dj-club"]',
    priority: 95,
    aliases: [
      'loopra dj club', 'dj club', 'dj club kholo', 'dj mode', 'club mode',
      'dj mixing', 'dj studio', 'dj session', 'dj chalao', 'dj lagao', 'dj view', 'dj'
    ],
    description: 'Interactive DJ mixing console, procedural synth, dynamic lighting & beat generators'
  },
  {
    id: 'downloads_explore',
    name: 'Explore Offline Songs',
    type: 'page',
    route: '/downloads/explore',
    parentPage: 'downloads',
    selector: '[data-nav-id="downloads-explore"], a[href*="downloads/explore"]',
    priority: 85,
    aliases: [
      'explore downloads', 'offline explore', 'downloadable songs', 'offline eligible',
      'explore offline music', 'download karne wale gaane', 'offline catalog'
    ],
    description: 'Browse and discover tracks eligible for encrypted offline download'
  },
  {
    id: 'recap_stats',
    name: 'Recap & Stats',
    type: 'modal',
    action: 'open_insights',
    parentPage: 'root',
    selector: '[data-action="open_insights"]',
    priority: 95,
    aliases: [
      'recap and stats', 'recap & stats', 'my listening statistics', 'music summary',
      'listening report', 'weekly recap', 'recap', 'stats', 'statistics',
      'listening stats', 'listening insights', 'insights', 'recap dikhao', 'stats dikhao'
    ],
    description: 'Personal Listening Analytics, Insights & Weekly Stats Modal'
  },
  {
    id: 'listening_rooms',
    name: 'Social Listening Rooms',
    type: 'modal',
    action: 'open_listening_rooms',
    parentPage: 'root',
    selector: '[data-action="open_listening_rooms"]',
    priority: 90,
    aliases: [
      'listening rooms', 'open listening rooms', 'social rooms', 'listening room kholo',
      'group listening', 'listen together', 'friends room', 'dosto ke sath suno', 'party room'
    ],
    description: 'Real-time synchronized Social Listening Rooms modal'
  },
  {
    id: 'similar_songs',
    name: 'Similar Songs Recommendations',
    type: 'modal',
    action: 'open_similar_songs',
    parentPage: 'root',
    selector: '[data-action="open_similar_songs"]',
    priority: 90,
    aliases: [
      'similar songs', 'recommend similar', 'find similar songs', 'iske jaise gaane',
      'similar music', 'aise hi gaane sunao', 'similar songs modal', 'related songs'
    ],
    description: 'AI & Content Similar Songs recommendation modal'
  },
  {
    id: 'player_settings',
    name: 'Player Settings & Equalizer',
    type: 'modal',
    action: 'open_player_settings',
    parentPage: 'root',
    selector: '[data-action="open_player_settings"]',
    priority: 90,
    aliases: [
      'player settings', 'open equalizer', 'equalizer', 'audio settings',
      'equalizer kholo', 'sound settings', 'playback settings', 'bass treble settings',
      'speed settings', 'audio quality'
    ],
    description: 'Audio Equalizer, Playback Speed, and Audio Quality modal'
  },
  {
    id: 'sleep_timer',
    name: 'Sleep Timer',
    type: 'modal',
    action: 'open_sleep_timer',
    parentPage: 'root',
    selector: '[data-action="open_sleep_timer"]',
    priority: 90,
    aliases: [
      'sleep timer', 'open sleep timer', 'sleep timer kholo', 'timer lagao',
      'off timer', 'auto off timer', 'music timer', 'sone ka timer'
    ],
    description: 'Configurable automatic sleep timer modal'
  },
  {
    id: 'canvas_modal',
    name: 'Loopra Canvas Visualizer',
    type: 'modal',
    action: 'open_canvas',
    parentPage: 'root',
    selector: '[data-action="open_canvas"]',
    priority: 90,
    aliases: [
      'open canvas', 'canvas mode', 'visualizer', 'fullscreen visualizer',
      'music canvas', 'canvas kholo', 'audio visualizer', 'loopra canvas', 'visualizer chalao'
    ],
    description: 'Immersive fullscreen reactive audio canvas visualizer'
  },
  {
    id: 'profile_modal',
    name: 'User Profile',
    type: 'modal',
    action: 'open_profile',
    parentPage: 'root',
    selector: '[data-action="open_profile"]',
    priority: 90,
    aliases: [
      'user profile', 'open profile', 'my profile', 'profile kholo',
      'mera profile', 'account settings', 'user account', 'profile dikhao'
    ],
    description: 'User account profile, badges, and listening summary modal'
  },
  {
    id: 'rating_modal',
    name: 'Rate & Review Modal',
    type: 'modal',
    action: 'open_rating_modal',
    parentPage: 'root',
    selector: '[data-action="open_rating_modal"]',
    priority: 90,
    aliases: [
      'rate song', 'rate this song', 'review song', 'give review',
      'rating do', 'review likho', 'rate karo', 'review modal', 'song feedback'
    ],
    description: 'Submit song rating and user review modal'
  },

  // --- SUB-VIEWS ON HOME ---
  {
    id: 'trending_section',
    name: 'Trending Songs',
    type: 'section',
    route: '/?view=trending',
    parentPage: 'home',
    selector: '[data-section="trending"], #trending-section',
    priority: 80,
    aliases: [
      'trending songs', 'trending', 'top trending', 'trending hits', 'popular songs'
    ],
    description: 'Top most played hits right now'
  },
  {
    id: 'reviews_section',
    name: 'Community Reviews & Ratings',
    type: 'section',
    route: '/?view=reviews',
    parentPage: 'home',
    selector: '[data-section="reviews"], #reviews-section',
    priority: 80,
    aliases: [
      'community reviews', 'all reviews', 'reviews section', 'user reviews',
      'reviews dikhao', 'logo ke reviews', 'music reviews'
    ],
    description: 'Recent user reviews and ratings section on home'
  },
  {
    id: 'artists_section',
    name: 'Featured Artists',
    type: 'section',
    route: '/?view=artists',
    parentPage: 'home',
    selector: '[data-section="artists"], #artists-section',
    priority: 80,
    aliases: [
      'featured artists', 'top artists', 'popular singers', 'saare artists', 'all artists'
    ],
    description: 'Featured top artists directory on home'
  },
  {
    id: 'albums_section',
    name: 'Top Albums',
    type: 'section',
    route: '/?view=albums',
    parentPage: 'home',
    selector: '[data-section="albums"], #albums-section',
    priority: 80,
    aliases: [
      'top albums', 'featured albums', 'all albums', 'saare albums', 'popular albums'
    ],
    description: 'Popular albums section on home'
  },

  // --- PLAYBACK CONTROLS ---
  {
    id: 'playback_pause',
    name: 'Pause Music',
    type: 'control',
    action: 'pause',
    aliases: ['pause', 'pause music', 'gaana roko', 'ruk jao', 'rok do', 'hold on', 'stop music']
  },
  {
    id: 'playback_resume',
    name: 'Resume Music',
    type: 'control',
    action: 'resume',
    aliases: ['resume', 'continue', 'unpause', 'wapas chalao', 'gaana chalu karo']
  },
  {
    id: 'playback_next',
    name: 'Next Track',
    type: 'control',
    action: 'next',
    aliases: ['next', 'next song', 'agla gaana', 'skip', 'aage badhao', 'next track']
  },
  {
    id: 'playback_prev',
    name: 'Previous Track',
    type: 'control',
    action: 'previous',
    aliases: ['previous', 'prev', 'pichla gaana', 'piche karo', 'previous track']
  },
  {
    id: 'playback_volume',
    name: 'Volume Control',
    type: 'control',
    action: 'volume',
    aliases: ['volume', 'awaaz', 'sound', 'volume kam karo', 'volume badhao', 'thoda dheere', 'thoda tej']
  }
];

class WebsiteInteractionRegistry {
  constructor() {
    this.staticRegistry = STATIC_INTERACTION_REGISTRY;
    this.dynamicRegistry = new Map();
    this.observer = null;
    this.initObserver();
  }

  initObserver() {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;

    // Scan DOM initially after window loads
    setTimeout(() => this.scanDynamicElements(), 1200);

    // Watch for dynamic insertions (search results, cards, etc.) without full-DOM re-scan spam
    let debounceTimer;
    this.observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.scanDynamicElements(), 500);
    });

    try {
      this.observer.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  }

  /**
   * Scans for dynamic interactive cards and items on screen
   */
  scanDynamicElements() {
    if (typeof document === 'undefined') return;

    const cards = document.querySelectorAll('[data-track-id], [data-artist-name], [data-playlist-id]');
    cards.forEach((el) => {
      const trackId = el.getAttribute('data-track-id');
      const artistName = el.getAttribute('data-artist-name');
      const title = el.getAttribute('data-title') || el.innerText?.slice(0, 40) || '';

      if (trackId && title) {
        this.dynamicRegistry.set(`track_${trackId}`, {
          id: `track_${trackId}`,
          name: title,
          type: 'track',
          element: el,
          aliases: [title.toLowerCase()],
          action: () => el.click()
        });
      } else if (artistName) {
        this.dynamicRegistry.set(`artist_${artistName}`, {
          id: `artist_${artistName}`,
          name: artistName,
          type: 'artist',
          element: el,
          aliases: [artistName.toLowerCase()],
          action: () => el.click()
        });
      }
    });
  }

  /**
   * Intelligent partial & fuzzy matching for voice & text commands.
   * Guarantees exact named stations (like Saloon FM) are strictly matched over generic keywords.
   */
  findBestMatch(rawQuery = '') {
    if (!rawQuery || typeof rawQuery !== 'string') return null;
    const clean = rawQuery.toLowerCase()
      .replace(/[?!,.]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // 1. Strict Priority: Saloon FM check (eliminates any regression)
    if (
      clean.includes('saloon') ||
      clean.includes('salon') ||
      clean.includes('lune fm') ||
      clean.includes('luna fm') ||
      clean.includes('barber')
    ) {
      return this.staticRegistry.find(item => item.id === 'barber');
    }

    // 2. Strict Priority: Horn Ok Please check
    if (clean.includes('horn ok') || clean.includes('truck') || clean.includes('dhaba')) {
      return this.staticRegistry.find(item => item.id === 'truck');
    }

    // 3. Strict Priority: Theka Session check
    if (clean.includes('theka') || clean.includes('pauwa')) {
      return this.staticRegistry.find(item => item.id === 'pauwa');
    }

    // 4. Strict Priority: Time Machine Radio check
    if (clean.includes('time machine') || clean.includes('retro era')) {
      return this.staticRegistry.find(item => item.id === 'timemachine');
    }

    // 5. Match against all static registered items with alias scoring
    let bestMatch = null;
    let highestScore = 0;

    for (const item of this.staticRegistry) {
      for (const alias of item.aliases) {
        let score = 0;
        if (clean === alias) {
          score = 100 + (item.priority || 0);
        } else if (clean.includes(alias)) {
          score = 70 + alias.length * 2 + (item.priority || 0);
        } else if (alias.includes(clean) && clean.length >= 4) {
          score = 50 + clean.length + (item.priority || 0);
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatch = item;
        }
      }
    }

    if (highestScore >= 50) {
      return bestMatch;
    }

    // 6. Dynamic DOM registry check (e.g. tracks or artist cards on page)
    for (const [key, dynItem] of this.dynamicRegistry.entries()) {
      if (dynItem.aliases.some(a => clean.includes(a) || a.includes(clean))) {
        return dynItem;
      }
    }

    return null;
  }
}

export const websiteInteractionRegistry = new WebsiteInteractionRegistry();
export default websiteInteractionRegistry;

