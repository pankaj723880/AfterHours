/**
 * UI Element Visibility Registry
 * Canonical registry of all toggleable UI elements in Loopra across Desktop Web, Mobile Web & Android APK.
 * Grouped into 3 distinct operational categories:
 *  1. nav: Sidebar & Navigation Items
 *  2. section: Cards & Page Sections
 *  3. btn: Buttons & Interactive Controls
 */

export const UI_ELEMENT_CATEGORIES = {
  NAV: 'nav',
  SECTION: 'section',
  BTN: 'btn'
};

export const UI_VISIBILITY_REGISTRY = [
  // ==========================================
  // CATEGORY 1: SIDEBAR & NAVIGATION ITEMS
  // ==========================================
  {
    key: 'nav.home',
    label: 'Home Destination',
    description: 'Main home navigation destination in sidebar and mobile bottom nav.',
    category: UI_ELEMENT_CATEGORIES.NAV,
    defaultValue: true
  },
  {
    key: 'nav.discover',
    label: 'Discover & Search',
    description: 'Explore trending songs, playlists, albums, and global catalog search.',
    category: UI_ELEMENT_CATEGORIES.NAV,
    defaultValue: true
  },
  {
    key: 'nav.liked',
    label: 'Liked Songs Collection',
    description: 'User saved/liked songs library tab in sidebar and mobile bottom bar.',
    category: UI_ELEMENT_CATEGORIES.NAV,
    defaultValue: true
  },
  {
    key: 'nav.playlists',
    label: 'Playlists Collection',
    description: 'Personal playlists view in sidebar and mobile navigation.',
    category: UI_ELEMENT_CATEGORIES.NAV,
    defaultValue: true
  },
  {
    key: 'nav.rooms',
    label: 'Listening Rooms (Collaborative)',
    description: 'Real-time collaborative listening lounges in sidebar and mobile bottom nav.',
    category: UI_ELEMENT_CATEGORIES.NAV,
    defaultValue: true
  },
  {
    key: 'nav.radio',
    label: 'Indian Live Radio',
    description: 'Curated 24/7 live Indian radio stations in sidebar and mobile nav.',
    category: UI_ELEMENT_CATEGORIES.NAV,
    defaultValue: true
  },
  {
    key: 'nav.djClub',
    label: 'Loopra DJ Club',
    description: 'Virtual audio visualizer DJ stage & nightclub environment in sidebar.',
    category: UI_ELEMENT_CATEGORIES.NAV,
    defaultValue: true
  },
  {
    key: 'nav.mood',
    label: 'Mood-to-Music AI',
    description: 'AI-assisted mood generator and sonic vibe selector in sidebar.',
    category: UI_ELEMENT_CATEGORIES.NAV,
    defaultValue: true
  },
  {
    key: 'nav.timemachine',
    label: 'Time Machine Radio',
    description: 'Decade retro music travel (70s, 80s, 90s, 2000s) in sidebar.',
    category: UI_ELEMENT_CATEGORIES.NAV,
    defaultValue: true
  },
  {
    key: 'nav.activity',
    label: 'Global Activity Feed',
    description: 'Real-time platform listening pulses and member activity in sidebar.',
    category: UI_ELEMENT_CATEGORIES.NAV,
    defaultValue: true
  },
  {
    key: 'nav.swipe',
    label: 'Discover Swipe',
    description: 'Tinder-style quick audio preview card stack in sidebar.',
    category: UI_ELEMENT_CATEGORIES.NAV,
    defaultValue: true
  },
  {
    key: 'nav.history',
    label: 'Listening History',
    description: 'Recently played tracks and listening log in sidebar.',
    category: UI_ELEMENT_CATEGORIES.NAV,
    defaultValue: true
  },
  {
    key: 'nav.stats',
    label: 'Weekly Recap & Stats',
    description: 'Personal listening analytics and stats recap modal trigger in sidebar.',
    category: UI_ELEMENT_CATEGORIES.NAV,
    defaultValue: true
  },
  {
    key: 'nav.downloads',
    label: 'Downloaded Songs (Offline)',
    description: 'Cached offline music library navigation link in sidebar.',
    category: UI_ELEMENT_CATEGORIES.NAV,
    defaultValue: true
  },

  // ==========================================
  // CATEGORY 2: CARDS & PAGE SECTIONS
  // ==========================================
  {
    key: 'section.regionalMusic',
    label: 'Regional Music Section',
    description: 'Location-based regional & language music shelf on the Home page.',
    category: UI_ELEMENT_CATEGORIES.SECTION,
    defaultValue: true
  },
  {
    key: 'section.aiForYou',
    label: 'Personalized "AI For You" Recommendations',
    description: 'Gemini AI-powered personalized suggestions row on the Homepage.',
    category: UI_ELEMENT_CATEGORIES.SECTION,
    defaultValue: true
  },
  {
    key: 'section.trendingOnLoopra',
    label: 'Trending on Loopra Carousel',
    description: 'Viral and top-streamed songs carousel on Home and Discover pages.',
    category: UI_ELEMENT_CATEGORIES.SECTION,
    defaultValue: true
  },
  {
    key: 'section.popularAlbums',
    label: 'Popular Albums & Soundtracks',
    description: 'Iconic album artwork and soundtrack collections on Home & Discover.',
    category: UI_ELEMENT_CATEGORIES.SECTION,
    defaultValue: true
  },
  {
    key: 'section.popularArtists',
    label: 'Popular Artists Row',
    description: 'Top vocalists and legendary playback artists circle row on Home.',
    category: UI_ELEMENT_CATEGORIES.SECTION,
    defaultValue: true
  },
  {
    key: 'section.popularRadio',
    label: 'Popular Radio Streams Row',
    description: 'Featured 24/7 radio stations carousel on Homepage.',
    category: UI_ELEMENT_CATEGORIES.SECTION,
    defaultValue: true
  },
  {
    key: 'section.recentlyPlayed',
    label: 'Listening History & Recent Tracks',
    description: 'Listening history track grid and recent playback log page section.',
    category: UI_ELEMENT_CATEGORIES.SECTION,
    defaultValue: true
  },
  {
    key: 'section.trendingChips',
    label: 'Trending Quick-Search Chips',
    description: 'Horizontal pill search suggestions in Discover and search headers.',
    category: UI_ELEMENT_CATEGORIES.SECTION,
    defaultValue: true
  },
  {
    key: 'card.roomPlaylists',
    label: 'Room Collaborative Playlists Tab & Cards',
    description: 'Collaborative playlist browser and cards inside Listening Rooms.',
    category: UI_ELEMENT_CATEGORIES.SECTION,
    defaultValue: true
  },
  {
    key: 'card.liveActivity',
    label: 'Room Live Activity Feed Tab',
    description: 'Real-time room events and reactions log inside Listening Rooms.',
    category: UI_ELEMENT_CATEGORIES.SECTION,
    defaultValue: true
  },
  {
    key: 'card.roomMembers',
    label: 'Room Members & Moderator Controls Tab',
    description: 'Active listener roster, permissions, and moderation panel in rooms.',
    category: UI_ELEMENT_CATEGORIES.SECTION,
    defaultValue: true
  },
  {
    key: 'section.homeHero',
    label: 'Homepage Hero Showcase Banner',
    description: 'Cinematic hero spotlight and quick launch hero on the homepage.',
    category: UI_ELEMENT_CATEGORIES.SECTION,
    defaultValue: true
  },
  {
    key: 'section.featureShortcuts',
    label: 'Feature Quick Shortcuts Deck',
    description: 'Compact grid shortcuts to Mood, Nostalgia, and Rooms on Homepage.',
    category: UI_ELEMENT_CATEGORIES.SECTION,
    defaultValue: true
  },

  // ==========================================
  // CATEGORY 3: BUTTONS & INTERACTIVE CONTROLS
  // ==========================================
  {
    key: 'btn.listenTogether',
    label: 'Listen Together (Sync Playback) Toggle',
    description: 'Master switch to synchronize audio and seek positions in Listening Rooms.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.syncLive',
    label: 'Sync Live Playback Action Button',
    description: 'One-tap button to instantly snap client playback to room host timestamp.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.broadcast',
    label: 'Broadcast My Playback (Host/Co-Host)',
    description: 'Button for hosts to broadcast their current audio stream to room.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.roomReactions',
    label: 'Floating Emoji Quick Reactions Bar',
    description: 'Emoji quick-reaction picker and real-time floating animation pills.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.roomChat',
    label: 'Room Live Chat Trigger & Input',
    description: 'Slide-over mini live chat window and input drawer in Listening Rooms.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.importPlaylist',
    label: 'Import Personal Playlist to Room',
    description: 'Button to copy personal playlists into a collaborative listening lounge.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.newRoomPlaylist',
    label: 'Create New Room Playlist Button',
    description: '+ New Room Playlist creation button and form in Listening Rooms.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.saveToLibrary',
    label: 'Save Room Playlist to Personal Library',
    description: 'Fork / Copy room playlist directly into personal library.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.inviteRoom',
    label: 'Invite & Share Room Code Button',
    description: 'Share invite link and copy 6-character room code in Listening Rooms.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.archiveRoom',
    label: 'Archive Room Button (Host Controls)',
    description: 'Allows room hosts to archive rooms without permanent data loss.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.smartQueue',
    label: 'Smart Queue & Autoplay Controls',
    description: 'Smart queue autoplay toggle and continuous recommendation feed.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.expandPlayer',
    label: 'Expand Full Player Button',
    description: 'Mini-player expand button and now-playing viewport expand triggers.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.turntable3D',
    label: '3D Vinyl Turntable Display',
    description: 'Illuminated 3D interactive turntable on expanded audio player.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.spectrumVisualizer',
    label: 'Audio Spectrum Visualizer',
    description: 'Animated real-time audio spectrum frequency bars on player.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.cinematicVideo',
    label: 'Cinematic Video Player Trigger',
    description: 'Full-screen canvas video playback button for supported songs.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.lyrics',
    label: 'Synchronized Lyrics Modal Button',
    description: 'Karaoke-style synchronized lyrics viewer trigger in bottom player bar.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.sleepTimer',
    label: 'Sleep Timer Modal Button',
    description: 'Preset countdown audio sleep timer button in player options.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  },
  {
    key: 'btn.downloadApk',
    label: 'Android APK Download Banner & Buttons',
    description: 'One-click native Android APK download banner across Web views.',
    category: UI_ELEMENT_CATEGORIES.BTN,
    defaultValue: true
  }
];

// Helper map for O(1) registry lookups
export const UI_VISIBILITY_REGISTRY_MAP = new Map(
  UI_VISIBILITY_REGISTRY.map(item => [item.key, item])
);

// Get default visibility dictionary (every key defaulted to true)
export const getDefaultVisibilityMap = () => {
  const map = {};
  for (const item of UI_VISIBILITY_REGISTRY) {
    map[item.key] = item.defaultValue !== false;
  }
  return map;
};
