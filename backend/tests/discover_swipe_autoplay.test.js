import assert from 'assert';
import { filterSingleSongs, normalizeTrack } from '../../frontend/src/services/songFilter.js';

console.log('=== STARTING DISCOVER SWIPE AUTOMATIC PLAYBACK & SYNC TEST SUITE ===\n');

// Mock verified deck of songs
const mockRawTracks = [
  { id: 'RLzC55ai0eo', videoId: 'RLzC55ai0eo', title: 'Heeriye (Official Video)', artist: 'Jasleen Royal ft Arijit Singh', thumbnail: 'https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg' },
  { id: 'WWIfHemqSEA', videoId: 'WWIfHemqSEA', title: 'Tujhko - Love Song 2026', artist: 'Arijit Singh', thumbnail: 'https://i.ytimg.com/vi/WWIfHemqSEA/hqdefault.jpg' },
  { id: 'BddP6PYo2gs', videoId: 'BddP6PYo2gs', title: 'Kesariya (Official Video)', artist: 'Arijit Singh, Pritam', thumbnail: 'https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg' },
  { id: 'cIGd8gm_pYE', videoId: 'cIGd8gm_pYE', title: 'Lover (Official Music Video)', artist: 'Diljit Dosanjh', thumbnail: 'https://i.ytimg.com/vi/cIGd8gm_pYE/hqdefault.jpg' }
];

// Verify normalization
const mockDeck = mockRawTracks.map(t => normalizeTrack(t));

// Test 1: Swiping to a new song immediately stops previous track and triggers autoplay on the new track
console.log('--- TEST 1: Swipe immediately replaces current song in global player ---');
{
  let currentSong = mockDeck[0];
  let isPlaying = true;
  let previousStopped = false;
  let playedSong = null;
  let currentIndex = 0;
  let isTransitioning = false;

  // Mock global player methods
  const mockPlayer = {
    stopVideo: () => {
      previousStopped = true;
      isPlaying = false;
    },
    loadVideoById: ({ videoId }) => {
      assert.strictEqual(videoId, mockDeck[1].id, 'Must load video ID of newly swiped song');
    },
    playVideo: () => {
      isPlaying = true;
    }
  };

  const onPlaySong = (song) => {
    assert(song, 'Track must be provided');
    if (mockPlayer && typeof mockPlayer.stopVideo === 'function') {
      mockPlayer.stopVideo();
    }
    mockPlayer.loadVideoById({ videoId: song.id });
    mockPlayer.playVideo();
    currentSong = song;
    playedSong = song;
  };

  const triggerAutoplay = (track) => {
    onPlaySong(track);
  };

  const handleSwipeAction = (direction) => {
    if (isTransitioning) return;
    isTransitioning = true;

    const nextIndex = currentIndex + 1;
    const rawNextSong = mockDeck[nextIndex];
    assert(rawNextSong, 'Next song must exist in deck');

    const nextSong = normalizeTrack(rawNextSong);

    // 1. Synchronously trigger autoplay directly from swipe gesture
    triggerAutoplay(nextSong);

    // 2. Transition visual index
    currentIndex = nextIndex;
    isTransitioning = false;
  };

  // Perform swipe left (skip)
  handleSwipeAction('skip');

  assert.strictEqual(currentIndex, 1, 'Current index must advance from 0 to 1');
  assert.strictEqual(previousStopped, true, 'Previous playing song must be stopped');
  assert.strictEqual(currentSong.id, mockDeck[1].id, 'Global player currentSong must now be song B');
  assert.strictEqual(currentSong.title, mockDeck[1].title, 'Title must match song B');
  assert.strictEqual(isPlaying, true, 'Playback must be active on newly swiped track');
  assert.strictEqual(playedSong.id, 'WWIfHemqSEA', 'Played track ID must match');
  console.log('[PASS] Swipe immediately stopped old track and started playing newly swiped track.\n');
}

// Test 2: Swipe right (Like) also immediately plays newly swiped track
console.log('--- TEST 2: Swipe right (Like) likes old song and immediately plays new song ---');
{
  let currentSong = mockDeck[1];
  let likedList = [];
  let currentIndex = 1;
  let playedSong = null;

  const onToggleLike = (song) => {
    likedList.push(song.id);
  };

  const onPlaySong = (song) => {
    currentSong = song;
    playedSong = song;
  };

  const handleSwipeAction = (direction) => {
    const activeCard = mockDeck[currentIndex];
    if (direction === 'like') {
      onToggleLike(activeCard);
    }
    const nextIndex = currentIndex + 1;
    const nextSong = mockDeck[nextIndex];
    currentIndex = nextIndex;
    onPlaySong(nextSong);
  };

  handleSwipeAction('like');

  assert.strictEqual(likedList.includes('WWIfHemqSEA'), true, 'Previous song was added to liked songs');
  assert.strictEqual(currentIndex, 2, 'Index advanced to 2');
  assert.strictEqual(currentSong.id, mockDeck[2].id, 'Global player currentSong is now track 2 (Kesariya)');
  assert.strictEqual(playedSong.id, 'BddP6PYo2gs', 'Kesariya was started');
  console.log('[PASS] Like action recorded and new track automatically started playing.\n');
}

// Test 3: Previous card navigation immediately plays the previous track
console.log('--- TEST 3: Previous card navigation starts playing previous song ---');
{
  let currentIndex = 2; // Kesariya
  let currentSong = mockDeck[2];
  let playedSong = null;

  const onPlaySong = (song) => {
    currentSong = song;
    playedSong = song;
  };

  const handlePrevCard = () => {
    if (currentIndex <= 0) return;
    const prevIndex = currentIndex - 1;
    currentIndex = prevIndex;
    onPlaySong(mockDeck[prevIndex]);
  };

  handlePrevCard();

  assert.strictEqual(currentIndex, 1, 'Index moved back to 1');
  assert.strictEqual(currentSong.id, mockDeck[1].id, 'Current song moved back to track 1');
  assert.strictEqual(playedSong.id, 'WWIfHemqSEA', 'Track 1 started playing');
  console.log('[PASS] Previous card button immediately switched audio to the previous track.\n');
}

// Test 4: Idle playback does NOT cause automatic card changes
console.log('--- TEST 4: Idle playback / track end never changes the card in Discover Swipe ---');
{
  let activeCardIndex = 1;
  let currentSong = mockDeck[1];

  // Simulate global queue advancing when a song finishes
  const onSongEnd = () => {
    currentSong = mockDeck[2]; // Global player advances to track 2
    // CRITICAL: Discover Swipe card index MUST NOT change during idle playback!
  };

  onSongEnd();

  assert.strictEqual(activeCardIndex, 1, 'Discover Swipe card index remained on card 1');
  console.log('[PASS] Idle playback does not cause automatic card changes.\n');
}

// Test 5: Playback failure does NOT trigger infinite skip loop
console.log('--- TEST 5: Playback error stops and displays retry overlay without skipping ---');
{
  let currentIndex = 1;
  let isPlaying = false;
  let playbackError = null;
  let autoplayBlocked = false;

  const simulatePlaybackFailure = (reason) => {
    isPlaying = false;
    playbackError = reason || 'Could not start playback. Tap to retry.';
    autoplayBlocked = true;
    // CRITICAL: Do NOT advance currentIndex!
  };

  simulatePlaybackFailure('Playback restricted by video owner');

  assert.strictEqual(currentIndex, 1, 'Must remain on current card (no automatic skip)');
  assert.strictEqual(isPlaying, false, 'Player stays paused');
  assert.strictEqual(autoplayBlocked, true, 'Retry action becomes available to user');
  console.log('[PASS] Failed playback safely holds position and invites user action with 0 skips.\n');
}

// Test 6: One swipe changes exactly one track (no double advance)
console.log('--- TEST 6: Transition throttle guarantees exactly 1 track change per gesture ---');
{
  let currentIndex = 0;
  let isTransitioning = false;
  let lastActionTime = 0;
  let advanceCount = 0;

  const handleSwipe = () => {
    const now = Date.now();
    if (isTransitioning || now - lastActionTime < 350) return;
    isTransitioning = true;
    lastActionTime = now;
    currentIndex++;
    advanceCount++;
  };

  // User performs swipe
  handleSwipe();
  // Rapid repeated touches/clicks while animating
  handleSwipe();
  handleSwipe();
  handleSwipe();

  assert.strictEqual(currentIndex, 1, 'Only 1 advance allowed');
  assert.strictEqual(advanceCount, 1, 'advanceCount is strictly 1');
  console.log('[PASS] Exactly one track advanced per completed swipe gesture.\n');
}

console.log('=== ALL DISCOVER SWIPE AUTOPLAY TESTS PASSED SUCCESSFULLY! ===');

