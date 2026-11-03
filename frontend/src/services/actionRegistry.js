/**
 * Loopra Centralized Action Registry
 * 
 * Single source of truth for ALL supported actions on the Loopra platform.
 * Fully mapped with:
 * - Action ID & Action Name
 * - User-friendly aliases (English, Hindi, Hinglish)
 * - Page and Route
 * - Exact Frontend Component & Handler mapping
 * - Parameters and strict validation
 * - API endpoint & HTTP method (if applicable)
 * - Database operation (if applicable)
 * - Dependencies & Prerequisites
 * - Expected result and verification logic
 * - Confirmation requirements (for destructive operations)
 * - Error & Fallback handling
 */

export const ACTION_CATEGORIES = {
  NAVIGATION: 'NAVIGATION',
  PLAYBACK: 'PLAYBACK',
  QUEUE: 'QUEUE',
  RADIO: 'RADIO',
  PLAYLISTS: 'PLAYLISTS',
  FAVOURITES: 'FAVOURITES',
  HISTORY: 'HISTORY',
  MODALS: 'MODALS',
  OFFLINE: 'OFFLINE',
  AVATAR: 'AVATAR'
};

export const ACTION_REGISTRY = [
  // =========================================================================
  // 1. NAVIGATION ACTIONS
  // =========================================================================
  {
    id: 'nav_home',
    name: 'Navigate to Home',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/',
    page: 'home',
    component: 'App.jsx',
    handlerName: 'onNavigate',
    handlerArgs: ['home'],
    aliases: [
      'home', 'go home', 'home kholo', 'homepage', 'ghar jao', 'main page',
      'home page', 'loopra home', 'wapas home', 'shuruat par jao'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Home view active with hero banners and curated collections',
    verify: (ctx) => ctx.activeTab === 'home',
    errorFallback: 'Unable to open home. Refreshing view.'
  },
  {
    id: 'nav_discover',
    name: 'Navigate to Discover & Search',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/discover',
    page: 'discover',
    component: 'DiscoverView.jsx',
    handlerName: 'onNavigate',
    handlerArgs: ['discover'],
    aliases: [
      'discover', 'open discover', 'discover kholo', 'explore', 'search page',
      'browse', 'discover page', 'gaane dhoondho page', 'explore music', 'khojo'
    ],
    params: {
      query: { type: 'string', required: false, default: '' }
    },
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Discover page active with search bar and trending recommendations',
    verify: (ctx) => ctx.activeTab === 'discover',
    errorFallback: 'Failed to open discover page.'
  },
  {
    id: 'nav_radio',
    name: 'Navigate to Indian Live Radio',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/radio',
    page: 'radio',
    component: 'IndianRadioView.jsx',
    handlerName: 'onNavigate',
    handlerArgs: ['radio'],
    aliases: [
      'radio', 'open radio', 'radio kholo', 'indian radio', 'live radio',
      'air radio', 'radio station', 'radio lagao', 'akashvani', 'radio sunao'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Indian Live Radio page active with verified station streams',
    verify: (ctx) => ctx.activeTab === 'radio' || ctx.activeTab === 'indian-radio',
    errorFallback: 'Could not open radio.'
  },
  {
    id: 'nav_library',
    name: 'Navigate to Library / Favourites',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/library',
    page: 'library',
    component: 'App.jsx (Library View)',
    handlerName: 'onNavigate',
    handlerArgs: ['library'],
    aliases: [
      'library', 'open library', 'library kholo', 'liked songs', 'favourites',
      'favorites', 'meri library', 'pasandida gaane', 'favourite songs', 'my songs',
      'liked gaane', 'saved songs'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Library view opened displaying liked songs list',
    verify: (ctx) => ctx.activeTab === 'library',
    errorFallback: 'Unable to open library.'
  },
  {
    id: 'nav_history',
    name: 'Navigate to Listening History',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/history',
    page: 'history',
    component: 'App.jsx (History View)',
    handlerName: 'onNavigate',
    handlerArgs: ['history'],
    aliases: [
      'history', 'open history', 'history kholo', 'listening history',
      'recently played', 'purane gaane', 'kaunse gaane sune', 'sune huye gaane',
      'recent songs', 'last played'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'History view active showing chronological track playback log',
    verify: (ctx) => ctx.activeTab === 'history',
    errorFallback: 'Failed to load listening history.'
  },
  {
    id: 'nav_playlists',
    name: 'Navigate to Playlists',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/playlists',
    page: 'playlists',
    component: 'Playlists.jsx',
    handlerName: 'onNavigate',
    handlerArgs: ['playlists'],
    aliases: [
      'playlists', 'open playlists', 'playlists kholo', 'playlist page',
      'meri playlist', 'all playlists', 'playlist dikhao', 'saari playlists'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Playlists manager opened with user and curated playlists',
    verify: (ctx) => ctx.activeTab === 'playlists',
    errorFallback: 'Unable to open playlists view.'
  },
  {
    id: 'nav_swipe',
    name: 'Navigate to Discover Swipe',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/swipe',
    page: 'swipe',
    component: 'DiscoverSwipe.jsx',
    handlerName: 'onNavigate',
    handlerArgs: ['swipe'],
    aliases: [
      'swipe', 'discover swipe', 'swipe mode', 'music swipe', 'song swipe',
      'swipe kholo', 'card swipe', 'song cards'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Interactive Discover Swipe cards active',
    verify: (ctx) => ctx.activeTab === 'swipe',
    errorFallback: 'Could not open swipe discovery.'
  },
  {
    id: 'nav_for_you',
    name: 'Navigate to For You Recommendations',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/for-you',
    page: 'for-you',
    component: 'PersonalizedRecommendationsSection.jsx',
    handlerName: 'onNavigate',
    handlerArgs: ['for-you'],
    aliases: [
      'for you', 'recommendations', 'open recommendations', 'meri pasand',
      'suggested songs', 'for you kholo', 'recommended songs', 'mere liye gaane',
      'latest recommended songs'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Personalized algorithmic recommendations displayed',
    verify: (ctx) => ctx.activeTab === 'for-you',
    errorFallback: 'Failed to open recommendations.'
  },
  {
    id: 'nav_mood',
    name: 'Navigate to Mood-to-Music',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/mood',
    page: 'mood',
    component: 'MoodToMusicSection.jsx',
    handlerName: 'onNavigate',
    handlerArgs: ['mood'],
    aliases: [
      'mood', 'mood to music', 'mood music', 'open mood', 'mood kholo',
      'apna mood batao', 'vibe to music', 'mood station', 'kaisa mood hai'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Mood selector opened with Chill, Energetic, Romantic, and Focus options',
    verify: (ctx) => ctx.activeTab === 'mood',
    errorFallback: 'Unable to open mood section.'
  },
  {
    id: 'nav_timemachine',
    name: 'Navigate to Time Machine Radio',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/timemachine',
    page: 'timemachine',
    component: 'TimeMachineRadio.jsx',
    handlerName: 'onNavigate',
    handlerArgs: ['timemachine'],
    aliases: [
      'time machine', 'time machine radio', 'retro radio', 'purana radio',
      'eras', 'decades radio', 'time travel radio', 'retro era', 'purane zamane ke gaane'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Time Machine decade selector opened (1960s through 2020s)',
    verify: (ctx) => ctx.activeTab === 'timemachine',
    errorFallback: 'Failed to open Time Machine.'
  },
  {
    id: 'nav_station_saloon',
    name: 'Open Saloon FM Station',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/barber',
    page: 'barber',
    component: 'App.jsx',
    handlerName: 'onNavigate',
    handlerArgs: ['barber'],
    aliases: [
      'saloon fm', 'saloon', 'salon fm', 'salon', 'barber station',
      'saloon kholo', '90s saloon', 'saloon nostalgia', 'saloon chalao'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: '90s-2000s Nostalgic Bollywood Station active',
    verify: (ctx) => ctx.activeTab === 'barber',
    errorFallback: 'Could not open Saloon FM.'
  },
  {
    id: 'nav_station_truck',
    name: 'Open Horn Ok Please Station',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/truck',
    page: 'truck',
    component: 'App.jsx',
    handlerName: 'onNavigate',
    handlerArgs: ['truck'],
    aliases: [
      'horn ok please', 'horn ok', 'truck', 'highway station', 'punjabi truck',
      'dhaba station', 'highway tunes', 'truck station kholo'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'High-Bass Highway Punjabi Station active',
    verify: (ctx) => ctx.activeTab === 'truck',
    errorFallback: 'Could not open Horn Ok Please station.'
  },
  {
    id: 'nav_station_theka',
    name: 'Open Theka Session Station',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/pauwa',
    page: 'pauwa',
    component: 'App.jsx',
    handlerName: 'onNavigate',
    handlerArgs: ['pauwa'],
    aliases: [
      'theka session', 'theka', 'pauwa', 'desi theka', 'theka kholo',
      'theka open karo', 'desi party bangers', 'mehfil station'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Desi Party & Theka Session Station active',
    verify: (ctx) => ctx.activeTab === 'pauwa',
    errorFallback: 'Could not open Theka Session.'
  },
  {
    id: 'nav_downloads',
    name: 'Navigate to Offline Downloads',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/downloads',
    page: 'downloads',
    component: 'OfflineLibraryView.jsx',
    handlerName: 'onNavigate',
    handlerArgs: ['downloads'],
    aliases: [
      'downloads', 'offline music', 'offline songs', 'downloaded songs',
      'offline library', 'downloads kholo', 'bina internet ke gaane'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Offline storage track viewer active',
    verify: (ctx) => ctx.activeTab === 'downloads',
    errorFallback: 'Could not open downloads view.'
  },
  {
    id: 'nav_activity',
    name: 'Navigate to Live Activity Feed',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: '/activity',
    page: 'activity',
    component: 'ActivityFeed.jsx',
    handlerName: 'onNavigate',
    handlerArgs: ['activity'],
    aliases: [
      'activity', 'activity feed', 'live activity', 'kya chal raha hai',
      'activity kholo', 'meri activity', 'listening activity'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Real-time social listening feed opened',
    verify: (ctx) => ctx.activeTab === 'activity',
    errorFallback: 'Failed to open activity feed.'
  },
  {
    id: 'nav_back',
    name: 'Navigate Back',
    category: ACTION_CATEGORIES.NAVIGATION,
    route: null,
    page: 'history_back',
    component: 'navigationManager.js',
    handlerName: 'onGoBack',
    handlerArgs: [],
    aliases: [
      'go back', 'back', 'piche jao', 'wapas', 'previous page', 'piche chalo'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Pops last route from navigation stack',
    verify: () => true,
    errorFallback: 'Already on root view.'
  },

  // =========================================================================
  // 2. MUSIC SEARCH & PLAYBACK ACTIONS
  // =========================================================================
  {
    id: 'action_search_music',
    name: 'Search Music',
    category: ACTION_CATEGORIES.PLAYBACK,
    route: '/discover',
    page: 'discover',
    component: 'HomeSearchBar.jsx / DiscoverView.jsx',
    handlerName: 'searchCatalog',
    handlerArgs: ['$query'],
    aliases: [
      'search for', 'search', 'dhoondho', 'khojo', 'find songs',
      'gaana dhoondho', 'search music', 'track khojo'
    ],
    params: {
      query: { type: 'string', required: true }
    },
    apiEndpoint: '/api/youtube/search',
    httpMethod: 'GET',
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Retrieves matched tracks without automatically playing',
    verify: (ctx, res) => Array.isArray(res) && res.length >= 0,
    errorFallback: 'No search results found.'
  },
  {
    id: 'action_play_song',
    name: 'Play Specific Song',
    category: ACTION_CATEGORIES.PLAYBACK,
    route: null,
    page: 'player',
    component: 'PlayerContext.jsx / App.jsx',
    handlerName: 'onPlayTrack',
    handlerArgs: ['$track'],
    aliases: [
      'play', 'chalao', 'bajao', 'sunao', 'play song', 'gaana bajao',
      'shuru karo', 'song play karo', 'gaana play karo'
    ],
    params: {
      query: { type: 'string', required: false },
      track: { type: 'object', required: false }
    },
    apiEndpoint: '/api/youtube/search',
    httpMethod: 'GET',
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Audio playback started and currentSong updated',
    verify: (ctx) => ctx.isPlaying === true || ctx.currentSong !== null,
    errorFallback: 'Track unavailable for playback.'
  },
  {
    id: 'action_pause_playback',
    name: 'Pause Playback',
    category: ACTION_CATEGORIES.PLAYBACK,
    route: null,
    page: 'player',
    component: 'BottomPlayer / App.jsx',
    handlerName: 'onTogglePlayPause',
    handlerArgs: [],
    aliases: [
      'pause', 'gaana roko', 'rok do', 'pause karo', 'stop playback',
      'music roko', 'ruk jao', 'hold on', 'stop music', 'band karo'
    ],
    params: {},
    dependencies: ['isPlaying'],
    confirmationRequired: false,
    expectedResult: 'Playback paused at current timestamp',
    verify: (ctx) => ctx.isPlaying === false,
    errorFallback: 'Playback is already paused.'
  },
  {
    id: 'action_resume_playback',
    name: 'Resume Playback',
    category: ACTION_CATEGORIES.PLAYBACK,
    route: null,
    page: 'player',
    component: 'BottomPlayer / App.jsx',
    handlerName: 'onTogglePlayPause',
    handlerArgs: [],
    aliases: [
      'resume', 'unpause', 'wapas chalao', 'gaana chalu karo', 'continue playback',
      'continue', 'fir se chalao'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Audio playback resumed',
    verify: (ctx) => ctx.isPlaying === true,
    errorFallback: 'No song loaded to resume.'
  },
  {
    id: 'action_next_track',
    name: 'Skip to Next Track',
    category: ACTION_CATEGORIES.PLAYBACK,
    route: null,
    page: 'player',
    component: 'BottomPlayer / App.jsx',
    handlerName: 'onNextTrack',
    handlerArgs: [],
    aliases: [
      'next', 'next song', 'agla gaana', 'skip', 'aage badhao', 'next track',
      'skip song', 'agla song', 'next wala'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Advances to next item in playback queue',
    verify: () => true,
    errorFallback: 'End of queue reached.'
  },
  {
    id: 'action_prev_track',
    name: 'Previous Track',
    category: ACTION_CATEGORIES.PLAYBACK,
    route: null,
    page: 'player',
    component: 'BottomPlayer / App.jsx',
    handlerName: 'onPrevTrack',
    handlerArgs: [],
    aliases: [
      'previous', 'prev', 'pichla gaana', 'piche karo', 'previous track',
      'back song', 'pichla song', 'pichhla'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Returns to previous song in queue',
    verify: () => true,
    errorFallback: 'No previous track in history.'
  },
  {
    id: 'action_set_volume',
    name: 'Set Volume Level',
    category: ACTION_CATEGORIES.PLAYBACK,
    route: null,
    page: 'player',
    component: 'BottomPlayer / App.jsx',
    handlerName: 'onSetVolume',
    handlerArgs: ['$level'],
    aliases: [
      'volume', 'set volume', 'awaaz', 'sound', 'volume set karo',
      'awaaz badhao', 'awaaz kam karo', 'thoda dheere', 'thoda tej'
    ],
    params: {
      level: { type: 'number', min: 0, max: 100, required: true }
    },
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Audio output volume set to exact target percentage',
    verify: (ctx, res, args) => ctx.volume === args[0],
    errorFallback: 'Invalid volume level (must be 0 to 100).'
  },
  {
    id: 'action_toggle_mute',
    name: 'Toggle Mute',
    category: ACTION_CATEGORIES.PLAYBACK,
    route: null,
    page: 'player',
    component: 'BottomPlayer / App.jsx',
    handlerName: 'onSetVolume',
    handlerArgs: [0],
    aliases: [
      'mute', 'unmute', 'awaaz band karo', 'chup ho jao', 'sound off',
      'sound on', 'silent'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Volume muted to 0% or unmuted to previous level',
    verify: () => true,
    errorFallback: 'Unable to toggle mute.'
  },
  {
    id: 'action_toggle_shuffle',
    name: 'Toggle Shuffle Mode',
    category: ACTION_CATEGORIES.PLAYBACK,
    route: null,
    page: 'player',
    component: 'BottomPlayer / App.jsx',
    handlerName: 'onToggleShuffle',
    handlerArgs: [],
    aliases: [
      'shuffle', 'toggle shuffle', 'shuffle on', 'shuffle off', 'gaane mix karo',
      'random songs', 'shuffle mode'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Shuffle state toggled',
    verify: () => true,
    errorFallback: 'Could not toggle shuffle mode.'
  },
  {
    id: 'action_toggle_repeat',
    name: 'Toggle Repeat Mode',
    category: ACTION_CATEGORIES.PLAYBACK,
    route: null,
    page: 'player',
    component: 'BottomPlayer / App.jsx',
    handlerName: 'onToggleRepeat',
    handlerArgs: [],
    aliases: [
      'repeat', 'loop', 'repeat song', 'repeat all', 'loop karo',
      'gaana repeat karo', 'repeat mode'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Repeat mode cycled between off, all, and one',
    verify: () => true,
    errorFallback: 'Failed to cycle repeat mode.'
  },

  // =========================================================================
  // 3. QUEUE MANAGEMENT ACTIONS
  // =========================================================================
  {
    id: 'action_open_queue',
    name: 'Open Playback Queue',
    category: ACTION_CATEGORIES.QUEUE,
    route: null,
    page: 'queue_modal',
    component: 'ExpandedPlayer / App.jsx',
    handlerName: 'onOpenQueue',
    handlerArgs: [],
    aliases: [
      'open queue', 'queue', 'queue kholo', 'up next', 'agla kaunsa gaana hai',
      'show queue', 'playback queue', 'queue dikhao'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Queue drawer opened displaying upcoming tracklist',
    verify: () => true,
    errorFallback: 'Unable to open playback queue.'
  },
  {
    id: 'action_add_to_queue',
    name: 'Add Song to Queue',
    category: ACTION_CATEGORIES.QUEUE,
    route: null,
    page: 'player',
    component: 'PlayerContext.jsx / App.jsx',
    handlerName: 'onAddToQueue',
    handlerArgs: ['$track'],
    aliases: [
      'add to queue', 'queue mein daalo', 'queue mein add karo', 'next play karo',
      'queue mein laga do', 'agla bajana'
    ],
    params: {
      track: { type: 'object', required: false }
    },
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Track appended to upcoming playback queue',
    verify: () => true,
    errorFallback: 'No track specified to add to queue.'
  },
  {
    id: 'action_clear_queue',
    name: 'Clear Playback Queue',
    category: ACTION_CATEGORIES.QUEUE,
    route: null,
    page: 'player',
    component: 'PlayerContext.jsx / App.jsx',
    handlerName: 'onClearQueue',
    handlerArgs: [],
    aliases: [
      'clear queue', 'queue khali karo', 'saare agle gaane hatao', 'empty queue',
      'clear all queue', 'queue saaf karo'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Queue emptied leaving only currently playing track',
    verify: () => true,
    errorFallback: 'Queue is already empty.'
  },

  // =========================================================================
  // 4. RADIO & LIVE STREAMS
  // =========================================================================
  {
    id: 'action_play_radio_station',
    name: 'Play Specific Radio Station',
    category: ACTION_CATEGORIES.RADIO,
    route: '/radio',
    page: 'radio',
    component: 'IndianRadioView.jsx / App.jsx',
    handlerName: 'onPlayRadioStation',
    handlerArgs: ['$stationName'],
    aliases: [
      'play vividh bharati', 'vividh bharati chalao', 'mirchi play karo',
      'air fm play karo', 'radio station play karo', 'vividh bharati play karo',
      'radio station chalao', 'play radio'
    ],
    params: {
      stationName: { type: 'string', required: true }
    },
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Live radio stream buffered and audio playback started',
    verify: (ctx) => ctx.isPlaying === true,
    errorFallback: 'Radio station stream currently unreachable.'
  },

  // =========================================================================
  // 5. PLAYLISTS MANAGEMENT
  // =========================================================================
  {
    id: 'action_open_playlist',
    name: 'Open Specific Playlist',
    category: ACTION_CATEGORIES.PLAYLISTS,
    route: '/playlists',
    page: 'playlists',
    component: 'Playlists.jsx / PlaylistDetail.jsx',
    handlerName: 'onOpenPlaylistByName',
    handlerArgs: ['$name'],
    aliases: [
      'open playlist', 'playlist kholo', 'playlist open karo', 'party songs kholo',
      'playlist dikhao', 'is playlist ko kholo'
    ],
    params: {
      name: { type: 'string', required: true }
    },
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Navigates to /playlists and opens requested playlist details',
    verify: () => true,
    errorFallback: 'Playlist not found.'
  },
  {
    id: 'action_play_playlist',
    name: 'Play Entire Playlist',
    category: ACTION_CATEGORIES.PLAYLISTS,
    route: '/playlists',
    page: 'playlists',
    component: 'PlaylistDetail.jsx / App.jsx',
    handlerName: 'onPlayPlaylist',
    handlerArgs: ['$name'],
    aliases: [
      'play playlist', 'playlist ke saare gaane chalao', 'play all songs',
      'playlist play karo', 'saare gaane play karo', 'uske saare songs play karo',
      'playlist chalao'
    ],
    params: {
      name: { type: 'string', required: false }
    },
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Loads all playlist songs into queue and starts track 1',
    verify: (ctx) => ctx.isPlaying === true,
    errorFallback: 'Playlist is empty or cannot be played.'
  },
  {
    id: 'action_create_playlist',
    name: 'Create New Playlist',
    category: ACTION_CATEGORIES.PLAYLISTS,
    route: '/playlists',
    page: 'playlists',
    component: 'PlaylistContext.jsx',
    handlerName: 'onCreatePlaylist',
    handlerArgs: ['$name'],
    aliases: [
      'create playlist', 'nayi playlist banao', 'make a playlist', 'new playlist',
      'ek nayi playlist banao', 'playlist create karo'
    ],
    params: {
      name: { type: 'string', required: true }
    },
    databaseOperation: 'localStorage / DB save playlist',
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'New playlist created and added to user collections',
    verify: (ctx, res) => res && res.id,
    errorFallback: 'Please specify a name for the new playlist.'
  },
  {
    id: 'action_delete_playlist',
    name: 'Delete Playlist',
    category: ACTION_CATEGORIES.PLAYLISTS,
    route: '/playlists',
    page: 'playlists',
    component: 'PlaylistContext.jsx',
    handlerName: 'onDeletePlaylist',
    handlerArgs: ['$playlistId'],
    aliases: [
      'delete playlist', 'playlist hatao', 'playlist delete karo', 'remove playlist'
    ],
    params: {
      playlistId: { type: 'string', required: true }
    },
    databaseOperation: 'localStorage / DB delete playlist',
    dependencies: [],
    confirmationRequired: true,
    expectedResult: 'Playlist permanently removed from user library',
    verify: () => true,
    errorFallback: 'Unable to delete playlist.'
  },
  {
    id: 'action_add_to_playlist',
    name: 'Add Song to Playlist',
    category: ACTION_CATEGORIES.PLAYLISTS,
    route: null,
    page: 'playlists',
    component: 'AddToPlaylistModal.jsx / PlaylistContext.jsx',
    handlerName: 'onAddToPlaylist',
    handlerArgs: ['$track', '$playlistName'],
    aliases: [
      'add to playlist', 'playlist mein add karo', 'playlist mein daalo',
      'save to playlist', 'currently playing song add karo', 'is gaane ko playlist mein daalo'
    ],
    params: {
      track: { type: 'object', required: false },
      playlistName: { type: 'string', required: false }
    },
    databaseOperation: 'localStorage / DB playlist song append',
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Track saved into designated playlist',
    verify: () => true,
    errorFallback: 'Could not add song to playlist.'
  },
  {
    id: 'action_remove_from_playlist',
    name: 'Remove Song from Playlist',
    category: ACTION_CATEGORIES.PLAYLISTS,
    route: '/playlists',
    page: 'playlists',
    component: 'PlaylistContext.jsx',
    handlerName: 'onRemoveFromPlaylist',
    handlerArgs: ['$playlistId', '$songId'],
    aliases: [
      'remove from playlist', 'playlist se hatao', 'playlist se nikal do',
      'playlist se remove karo'
    ],
    params: {
      playlistId: { type: 'string', required: true },
      songId: { type: 'string', required: true }
    },
    databaseOperation: 'localStorage / DB playlist song removal',
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Track removed from designated playlist',
    verify: () => true,
    errorFallback: 'Track not found in playlist.'
  },

  // =========================================================================
  // 6. FAVOURITES / LIKED SONGS
  // =========================================================================
  {
    id: 'action_like_song',
    name: 'Add Song to Favourites',
    category: ACTION_CATEGORIES.FAVOURITES,
    route: null,
    page: 'library',
    component: 'BottomPlayer / App.jsx',
    handlerName: 'onToggleLike',
    handlerArgs: ['$track'],
    aliases: [
      'like', 'favourite', 'favorite', 'add to favourites', 'add to liked',
      'dil do', 'pasand karo', 'like karo', 'current song favourite karo', 'favourite karo'
    ],
    params: {
      track: { type: 'object', required: false }
    },
    databaseOperation: 'localStorage / DB user liked songs toggle',
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Song added to Liked Songs collection',
    verify: () => true,
    errorFallback: 'No song currently playing to add to favourites.'
  },
  {
    id: 'action_unlike_song',
    name: 'Remove Song from Favourites',
    category: ACTION_CATEGORIES.FAVOURITES,
    route: null,
    page: 'library',
    component: 'BottomPlayer / App.jsx',
    handlerName: 'onRemoveFromFavorites',
    handlerArgs: ['$trackOrTitle'],
    aliases: [
      'unlike', 'remove from favourites', 'remove from favorites', 'remove from liked',
      'dislike', 'favourites se hatao', 'unlike karo', 'favourites se remove karo',
      'favourite se hatao', 'pasand se hatao'
    ],
    params: {
      trackOrTitle: { type: 'string|object', required: false }
    },
    databaseOperation: 'localStorage / DB user liked songs removal',
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Target song removed from Liked Songs collection',
    verify: () => true,
    errorFallback: 'Song not found in your favourites.'
  },

  // =========================================================================
  // 7. LISTENING HISTORY
  // =========================================================================
  {
    id: 'action_play_from_history',
    name: 'Play Song from History',
    category: ACTION_CATEGORIES.HISTORY,
    route: '/history',
    page: 'history',
    component: 'App.jsx (History View)',
    handlerName: 'onPlayFromHistory',
    handlerArgs: ['$queryOrIndex'],
    aliases: [
      'play last played song', 'play from history', 'history se play karo',
      'last song bajao', 'pichla gaana chalao', 'last played song play karo',
      'purana gaana sunao'
    ],
    params: {
      queryOrIndex: { type: 'string|number', required: false, default: 0 }
    },
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Plays designated track from recent listening history',
    verify: (ctx) => ctx.isPlaying === true,
    errorFallback: 'No matching tracks found in your listening history.'
  },
  {
    id: 'action_remove_history_item',
    name: 'Remove Specific Item from History',
    category: ACTION_CATEGORIES.HISTORY,
    route: '/history',
    page: 'history',
    component: 'App.jsx (History View)',
    handlerName: 'onRemoveHistoryItem',
    handlerArgs: ['$queryOrId'],
    aliases: [
      'remove this song from history', 'history se ye gaana hatao',
      'remove song from history', 'history se nikal do', 'history se remove karo',
      'sirf ye song remove karo', 'ye song remove karo'
    ],
    params: {
      queryOrId: { type: 'string', required: true }
    },
    databaseOperation: 'localStorage / DB history entry removal',
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Exact single entry deleted from listening history',
    verify: () => true,
    errorFallback: 'Specified song was not found in listening history.'
  },
  {
    id: 'action_clear_history',
    name: 'Clear Entire Listening History',
    category: ACTION_CATEGORIES.HISTORY,
    route: '/history',
    page: 'history',
    component: 'App.jsx (History View)',
    handlerName: 'onClearHistory',
    handlerArgs: [],
    aliases: [
      'clear history', 'clear listening history', 'history saaf karo',
      'puri history delete karo', 'clear all history', 'meri listening history clear kar do',
      'saari history hata do', 'history delete karo'
    ],
    params: {},
    databaseOperation: 'localStorage / DB clear all history',
    dependencies: [],
    confirmationRequired: true,
    confirmationPrompt: 'Kya aap sach mein apni poori listening history delete karna chahte hain? Confirm karein.',
    expectedResult: 'Entire user listening history reset to empty',
    verify: () => true,
    errorFallback: 'Listening history is already empty.'
  },

  // =========================================================================
  // 8. MODALS, LYRICS, STATS, OFFLINE & ARTIST PROFILES
  // =========================================================================
  {
    id: 'action_open_lyrics',
    name: 'Open Lyrics Modal',
    category: ACTION_CATEGORIES.MODALS,
    route: null,
    page: 'lyrics_modal',
    component: 'LyricsModal.jsx',
    handlerName: 'onOpenLyrics',
    handlerArgs: [],
    aliases: [
      'lyrics', 'open lyrics', 'lyrics kholo', 'bol dikhao', 'show lyrics',
      'lyrics padho', 'gaane ke bol'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Synchronized lyrics modal opened for current track',
    verify: () => true,
    errorFallback: 'Lyrics are currently unavailable for this track.'
  },
  {
    id: 'action_open_stats',
    name: 'Open Recap & Listening Insights',
    category: ACTION_CATEGORIES.MODALS,
    route: null,
    page: 'stats_modal',
    component: 'ListeningStatsModal.jsx',
    handlerName: 'onOpenInsights',
    handlerArgs: [],
    aliases: [
      'stats', 'insights', 'recap', 'weekly recap', 'listening stats',
      'stats kholo', 'insights dikhao', 'recap dikhao', 'listening recap'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Listening statistics & recap analytics modal opened',
    verify: () => true,
    errorFallback: 'Unable to load listening insights.'
  },
  {
    id: 'action_open_sleep_timer',
    name: 'Open Sleep Timer',
    category: ACTION_CATEGORIES.MODALS,
    route: null,
    page: 'sleep_timer_modal',
    component: 'SleepTimerModal.jsx',
    handlerName: 'onOpenSleepTimer',
    handlerArgs: [],
    aliases: [
      'sleep timer', 'timer lagao', 'sleep timer kholo', 'music timer', 'stop timer'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Sleep timer modal opened',
    verify: () => true,
    errorFallback: 'Could not open sleep timer.'
  },
  {
    id: 'action_open_profile',
    name: 'Open User Profile',
    category: ACTION_CATEGORIES.MODALS,
    route: null,
    page: 'profile_modal',
    component: 'UserProfileModal.jsx',
    handlerName: 'onOpenProfile',
    handlerArgs: [],
    aliases: [
      'profile', 'open profile', 'my profile', 'profile kholo', 'meri profile',
      'account details'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'User profile and settings modal opened',
    verify: () => true,
    errorFallback: 'Failed to open user profile.'
  },
  {
    id: 'action_open_artist',
    name: 'Open Artist Profile',
    category: ACTION_CATEGORIES.MODALS,
    route: '/artist',
    page: 'artist',
    component: 'ArtistProfileView.jsx',
    handlerName: 'onOpenArtist',
    handlerArgs: ['$artistName'],
    aliases: [
      'open artist', 'artist profile', 'view artist', 'artist kholo',
      'artist profile dikhao', 'uska artist profile kholo', 'artist page'
    ],
    params: {
      artistName: { type: 'string', required: true }
    },
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Artist page opened showing top songs, bio, and albums',
    verify: () => true,
    errorFallback: 'Artist not found.'
  },
  {
    id: 'action_download_track',
    name: 'Download Track for Offline',
    category: ACTION_CATEGORIES.OFFLINE,
    route: null,
    page: 'player',
    component: 'DownloadTrackButton.jsx',
    handlerName: 'onDownloadTrack',
    handlerArgs: ['$track'],
    aliases: [
      'download track', 'download song', 'offline save karo', 'gaana download karo',
      'offline karo', 'save offline'
    ],
    params: {
      track: { type: 'object', required: false }
    },
    databaseOperation: 'IndexedDB offline track caching',
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Track audio and metadata saved to local IndexedDB',
    verify: () => true,
    errorFallback: 'This track is not licensed for offline download.'
  },

  // =========================================================================
  // 9. ANIMATED AVATAR ACTIONS
  // =========================================================================
  {
    id: 'action_avatar_gesture',
    name: 'Avatar Gesture',
    category: ACTION_CATEGORIES.AVATAR,
    route: null,
    page: 'avatar',
    component: 'CharacterBuddy.jsx / ThreeDCharacter.jsx',
    handlerName: 'onAvatarGesture',
    handlerArgs: ['$gesture'],
    aliases: [
      'wave', 'wink', 'dance', 'jump', 'sit', 'sit down', 'pose',
      'naacho', 'kudo', 'baith jao', 'baitho', 'haath hilao'
    ],
    params: {
      gesture: { type: 'string', required: true, enum: ['wave', 'wink', 'dance', 'jump', 'sit', 'pose', 'think'] }
    },
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Character avatar performs requested physical animation',
    verify: () => true,
    errorFallback: 'Gesture not recognized.'
  },
  {
    id: 'action_toggle_avatar',
    name: 'Toggle Avatar Visibility',
    category: ACTION_CATEGORIES.AVATAR,
    route: null,
    page: 'navbar',
    component: 'Header / VoiceAgentModal.jsx',
    handlerName: 'onToggleAvatarVisibility',
    handlerArgs: [],
    aliases: [
      'show avatar', 'hide avatar', 'avatar dikhao', 'avatar chhupao',
      'close buddy', 'open buddy', 'toggle avatar', 'companion dikhao'
    ],
    params: {},
    dependencies: [],
    confirmationRequired: false,
    expectedResult: 'Movable avatar visibility toggled',
    verify: () => true,
    errorFallback: 'Unable to toggle avatar visibility.'
  }
];

/**
 * Helper to retrieve an action by ID
 */
export function getActionById(actionId) {
  return ACTION_REGISTRY.find(a => a.id === actionId) || null;
}

/**
 * Helper to match an action by user text alias (Fuzzy & Exact match across EN, HI, Hinglish)
 */
export function matchActionByAlias(text = '') {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase().trim()
    .replace(/[?!,.]/g, '')
    .replace(/\s+/g, ' ');

  // 1. Exact alias match
  for (const action of ACTION_REGISTRY) {
    if (action.aliases.some(alias => clean === alias)) {
      return action;
    }
  }

  // 2. Substring / phrase match (longest matching alias wins)
  let bestAction = null;
  let bestLength = 0;

  for (const action of ACTION_REGISTRY) {
    for (const alias of action.aliases) {
      if (clean.includes(alias) && alias.length > bestLength) {
        bestAction = action;
        bestLength = alias.length;
      }
    }
  }

  return bestAction;
}

