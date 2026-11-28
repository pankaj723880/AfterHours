/**
 * UI Element Visibility Registry (Backend)
 * Canonical registry of all toggleable UI elements in Loopra.
 */

export const UI_ELEMENT_CATEGORIES = {
  NAV: 'nav',
  SECTION: 'section',
  BTN: 'btn'
};

export const UI_VISIBILITY_REGISTRY = [
  // Sidebar & Navigation Items
  { key: 'nav.home', label: 'Home Destination', category: 'nav', defaultValue: true },
  { key: 'nav.discover', label: 'Discover & Search', category: 'nav', defaultValue: true },
  { key: 'nav.liked', label: 'Liked Songs Collection', category: 'nav', defaultValue: true },
  { key: 'nav.playlists', label: 'Playlists Collection', category: 'nav', defaultValue: true },
  { key: 'nav.rooms', label: 'Listening Rooms (Collaborative)', category: 'nav', defaultValue: true },
  { key: 'nav.radio', label: 'Indian Live Radio', category: 'nav', defaultValue: true },
  { key: 'nav.djClub', label: 'Loopra DJ Club', category: 'nav', defaultValue: true },
  { key: 'nav.mood', label: 'Mood-to-Music AI', category: 'nav', defaultValue: true },
  { key: 'nav.timemachine', label: 'Time Machine Radio', category: 'nav', defaultValue: true },
  { key: 'nav.activity', label: 'Global Activity Feed', category: 'nav', defaultValue: true },
  { key: 'nav.swipe', label: 'Discover Swipe', category: 'nav', defaultValue: true },
  { key: 'nav.history', label: 'Listening History', category: 'nav', defaultValue: true },
  { key: 'nav.stats', label: 'Weekly Recap & Stats', category: 'nav', defaultValue: true },
  { key: 'nav.downloads', label: 'Downloaded Songs (Offline)', category: 'nav', defaultValue: true },

  // Cards & Page Sections
  { key: 'section.regionalMusic', label: 'Regional Music Section', category: 'section', defaultValue: true },
  { key: 'section.aiForYou', label: 'Personalized "AI For You" Recommendations', category: 'section', defaultValue: true },
  { key: 'section.trendingOnLoopra', label: 'Trending on Loopra Carousel', category: 'section', defaultValue: true },
  { key: 'section.popularAlbums', label: 'Popular Albums & Soundtracks', category: 'section', defaultValue: true },
  { key: 'section.popularArtists', label: 'Popular Artists Row', category: 'section', defaultValue: true },
  { key: 'section.popularRadio', label: 'Popular Radio Streams Row', category: 'section', defaultValue: true },
  { key: 'section.recentlyPlayed', label: 'Listening History & Recent Tracks', category: 'section', defaultValue: true },
  { key: 'section.trendingChips', label: 'Trending Quick-Search Chips', category: 'section', defaultValue: true },
  { key: 'card.roomPlaylists', label: 'Room Collaborative Playlists Tab & Cards', category: 'section', defaultValue: true },
  { key: 'card.liveActivity', label: 'Room Live Activity Feed Tab', category: 'section', defaultValue: true },
  { key: 'card.roomMembers', label: 'Room Members & Moderator Controls Tab', category: 'section', defaultValue: true },
  { key: 'section.homeHero', label: 'Homepage Hero Showcase Banner', category: 'section', defaultValue: true },
  { key: 'section.featureShortcuts', label: 'Feature Quick Shortcuts Deck', category: 'section', defaultValue: true },

  // Buttons & Interactive Controls
  { key: 'btn.listenTogether', label: 'Listen Together (Sync Playback) Toggle', category: 'btn', defaultValue: true },
  { key: 'btn.syncLive', label: 'Sync Live Playback Action Button', category: 'btn', defaultValue: true },
  { key: 'btn.broadcast', label: 'Broadcast My Playback (Host/Co-Host)', category: 'btn', defaultValue: true },
  { key: 'btn.roomReactions', label: 'Floating Emoji Quick Reactions Bar', category: 'btn', defaultValue: true },
  { key: 'btn.roomChat', label: 'Room Live Chat Trigger & Input', category: 'btn', defaultValue: true },
  { key: 'btn.importPlaylist', label: 'Import Personal Playlist to Room', category: 'btn', defaultValue: true },
  { key: 'btn.newRoomPlaylist', label: 'Create New Room Playlist Button', category: 'btn', defaultValue: true },
  { key: 'btn.saveToLibrary', label: 'Save Room Playlist to Personal Library', category: 'btn', defaultValue: true },
  { key: 'btn.inviteRoom', label: 'Invite & Share Room Code Button', category: 'btn', defaultValue: true },
  { key: 'btn.archiveRoom', label: 'Archive Room Button (Host Controls)', category: 'btn', defaultValue: true },
  { key: 'btn.smartQueue', label: 'Smart Queue & Autoplay Controls', category: 'btn', defaultValue: true },
  { key: 'btn.expandPlayer', label: 'Expand Full Player Button', category: 'btn', defaultValue: true },
  { key: 'btn.turntable3D', label: '3D Vinyl Turntable Display', category: 'btn', defaultValue: true },
  { key: 'btn.spectrumVisualizer', label: 'Audio Spectrum Visualizer', category: 'btn', defaultValue: true },
  { key: 'btn.cinematicVideo', label: 'Cinematic Video Player Trigger', category: 'btn', defaultValue: true },
  { key: 'btn.lyrics', label: 'Synchronized Lyrics Modal Button', category: 'btn', defaultValue: true },
  { key: 'btn.sleepTimer', label: 'Sleep Timer Modal Button', category: 'btn', defaultValue: true },
  { key: 'btn.downloadApk', label: 'Android APK Download Banner & Buttons', category: 'btn', defaultValue: true }
];

export const getDefaultVisibilityMap = () => {
  const map = {};
  for (const item of UI_VISIBILITY_REGISTRY) {
    map[item.key] = true;
  }
  return map;
};
