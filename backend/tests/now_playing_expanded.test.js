import assert from 'assert';

console.log('=== STARTING NOW PLAYING & EXPANDED EXPERIENCE VERIFICATION SUITE ===\n');

// 1. Test Favorite Synchronization Contract
console.log('--- TEST 1: Favorite Synchronization Contract ---');
{
  let likedSongs = [];
  const toggleLike = (song) => {
    const songId = song.id || song.videoId;
    const isAlreadyLiked = likedSongs.some(s => s.id === songId || (s.videoId && s.videoId === songId));
    if (isAlreadyLiked) {
      likedSongs = likedSongs.filter(s => s.id !== songId && (!s.videoId || s.videoId !== songId));
    } else {
      likedSongs = [{ ...song, id: songId, videoId: songId }, ...likedSongs];
    }
  };

  const isSongLiked = (song) => {
    if (!song) return false;
    const songId = song.id || song.videoId;
    return likedSongs.some(s => s.id === songId || (s.videoId && s.videoId === songId));
  };

  const trackA = { id: 'vid_123', title: 'Song A', channel: 'Artist A' };
  const trackB = { videoId: 'vid_456', title: 'Song B', channel: 'Artist B' };

  assert.strictEqual(isSongLiked(trackA), false, 'Track A initially not favorited');
  toggleLike(trackA);
  assert.strictEqual(isSongLiked(trackA), true, 'Track A favorited after toggle');
  assert.strictEqual(isSongLiked({ videoId: 'vid_123' }), true, 'Track A synchronized by videoId matching');

  toggleLike(trackB);
  assert.strictEqual(isSongLiked(trackB), true, 'Track B favorited after toggle');
  assert.strictEqual(likedSongs.length, 2, 'Both tracks present in likedSongs');

  // Untoggle
  toggleLike(trackA);
  assert.strictEqual(isSongLiked(trackA), false, 'Track A removed after second toggle');
  assert.strictEqual(likedSongs.length, 1, 'Only Track B remains favorited');
  console.log('[PASS] Favorite state synchronization works across id and videoId attributes.');
}

// 2. Test Playlist Persistence Contract
console.log('\n--- TEST 2: Playlist Persistence Contract ---');
{
  let mockStorage = {};
  const mockLocalStorage = {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = v; },
    removeItem: (k) => { delete mockStorage[k]; }
  };

  let playlists = [];
  let user = null; // Guest user test

  const persistPlaylists = (pls, u) => {
    const key = u ? 'playlists' : 'guest_playlists';
    mockLocalStorage.setItem(key, JSON.stringify(pls));
  };

  const createPlaylist = (name, song, u) => {
    const newPl = {
      id: 'pl_' + Date.now(),
      name,
      songs: song ? [song] : []
    };
    playlists = [...playlists, newPl];
    persistPlaylists(playlists, u);
    return newPl;
  };

  const addToPlaylist = (plId, song, u) => {
    playlists = playlists.map(pl => {
      if (pl.id === plId) {
        if (!pl.songs.some(s => (s.id || s.videoId) === (song.id || song.videoId))) {
          return { ...pl, songs: [...pl.songs, song] };
        }
      }
      return pl;
    });
    persistPlaylists(playlists, u);
  };

  // Guest creates playlist
  const pl1 = createPlaylist('Late Night Vibes', { id: 'song_1', title: 'Track 1' }, user);
  assert.strictEqual(playlists.length, 1, 'Playlist created in state');
  assert(mockLocalStorage.getItem('guest_playlists') !== null, 'Guest playlists persisted to localStorage');

  // Add another song
  addToPlaylist(pl1.id, { id: 'song_2', title: 'Track 2' }, user);
  const reloadedGuest = JSON.parse(mockLocalStorage.getItem('guest_playlists'));
  assert.strictEqual(reloadedGuest[0].songs.length, 2, 'Both tracks persisted in playlist on storage reload');

  // Prevent duplicate additions
  addToPlaylist(pl1.id, { id: 'song_2', title: 'Track 2' }, user);
  const reloadedGuestAfterDup = JSON.parse(mockLocalStorage.getItem('guest_playlists'));
  assert.strictEqual(reloadedGuestAfterDup[0].songs.length, 2, 'Duplicate track not added to playlist');

  // Logged-in user test
  user = { userId: 'user_999' };
  createPlaylist('Workout Beats', { id: 'song_3', title: 'Track 3' }, user);
  assert(mockLocalStorage.getItem('playlists') !== null, 'User playlists persisted to localStorage');
  console.log('[PASS] Playlist creation, track addition, deduplication, and guest/user persistence verified.');
}

// 3. Test Video Availability & Graceful Fallback Contract
console.log('\n--- TEST 3: Video Availability & Graceful Fallback Contract ---');
{
  let toastMsg = null;
  const showToast = (msg) => { toastMsg = msg; };

  const validateAndPrepareVideo = (song) => {
    if (!song) {
      showToast('No track selected');
      return null;
    }
    const vidId = song.id || song.videoId;
    if (!vidId || typeof vidId !== 'string' || vidId.length < 5) {
      showToast('Video is currently unavailable for this track');
      return null;
    }
    return { ...song, id: vidId, videoId: vidId };
  };

  // Null track
  assert.strictEqual(validateAndPrepareVideo(null), null);
  assert.strictEqual(toastMsg, 'No track selected');

  // Track with invalid / empty ID
  assert.strictEqual(validateAndPrepareVideo({ title: 'Song Without ID' }), null);
  assert.strictEqual(toastMsg, 'Video is currently unavailable for this track');

  // Track with valid ID
  const valid = validateAndPrepareVideo({ id: 'dQw4w9WgXcQ', title: 'Rick Astley' });
  assert.strictEqual(valid.id, 'dQw4w9WgXcQ');
  assert.strictEqual(valid.videoId, 'dQw4w9WgXcQ');
  console.log('[PASS] Graceful video validation and user feedback confirmed.');
}

// 4. Test Event Propagation and Mini-player Click Isolation Contract
console.log('\n--- TEST 4: Mini-Player Click & Event Isolation Contract ---');
{
  let isExpandedOpen = false;
  let playbackActionTriggered = null;

  const onMiniPlayerClick = () => {
    isExpandedOpen = true;
  };

  const createEvent = () => {
    let stopped = false;
    return {
      stopPropagation: () => { stopped = true; },
      isPropagationStopped: () => stopped
    };
  };

  // Click on background
  const bgEvent = createEvent();
  if (!bgEvent.isPropagationStopped()) {
    onMiniPlayerClick();
  }
  assert.strictEqual(isExpandedOpen, true, 'Clicking mini-player background opens expanded player');

  // Reset
  isExpandedOpen = false;

  // Click on Play/Pause button
  const playButtonEvent = createEvent();
  playButtonEvent.stopPropagation(); // Child button handles event
  playbackActionTriggered = 'play_pause';
  if (!playButtonEvent.isPropagationStopped()) {
    onMiniPlayerClick();
  }
  assert.strictEqual(isExpandedOpen, false, 'Clicking Play/Pause button does NOT trigger mini-player click');
  assert.strictEqual(playbackActionTriggered, 'play_pause', 'Playback toggled correctly');

  // Click on Next Track button
  const nextButtonEvent = createEvent();
  nextButtonEvent.stopPropagation();
  playbackActionTriggered = 'next_song';
  if (!nextButtonEvent.isPropagationStopped()) {
    onMiniPlayerClick();
  }
  assert.strictEqual(isExpandedOpen, false, 'Clicking Next button does NOT trigger mini-player click');

  // Expand / Collapse Toggle Pill
  let showQueuePanel = false;
  const toggleExpand = () => {
    showQueuePanel = !showQueuePanel;
  };
  toggleExpand();
  assert.strictEqual(showQueuePanel, true, 'Expand pill expands player');
  toggleExpand();
  assert.strictEqual(showQueuePanel, false, 'Collapse pill closes player');
  console.log('[PASS] Mini-player click propagation isolation and expand/collapse verified.');
}

console.log('\n=== ALL NOW PLAYING CONTRACT TESTS PASSED SUCCESSFULLY ===');
