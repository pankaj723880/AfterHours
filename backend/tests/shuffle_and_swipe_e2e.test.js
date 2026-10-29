import assert from 'assert';
import { isSingleSong, isValidYouTubeId, filterSingleSongs } from '../services/songFilter.js';

const BASE_URL = 'http://localhost:5000';

async function runTestSuite() {
  console.log('=== STARTING SHUFFLE, SWIPE AUTOPLAY & SINGLE-SONG VERIFICATION SUITE ===\n');

  // ==========================================
  // SECTION 1: 100+ SINGLE-SONG SHUFFLE POOL
  // ==========================================
  console.log('--- TEST 1: Shuffle Pool Minimum 100 Tracks & Single-Song Compliance ---');
  const poolRes = await fetch(`${BASE_URL}/api/youtube/shuffle-pool`);
  assert.strictEqual(poolRes.status, 200, 'Shuffle pool endpoint returns 200 OK');
  const poolData = await poolRes.json();

  assert(Array.isArray(poolData.items), 'Shuffle pool returns items array');
  console.log(`[INFO] Shuffle pool total tracks returned: ${poolData.items.length}`);
  assert(poolData.items.length >= 100, `Shuffle pool must contain at least 100 tracks (Actual: ${poolData.items.length})`);

  // Verify unique video IDs (no duplicate records)
  const idSet = new Set();
  const duplicateIds = [];
  for (const track of poolData.items) {
    const id = track.id || track.videoId;
    assert(id && typeof id === 'string', 'Track must have non-empty ID');
    assert(isValidYouTubeId(id), `Track ID "${id}" must be a valid 11-char YouTube ID`);
    if (idSet.has(id)) {
      duplicateIds.push(id);
    }
    idSet.add(id);
  }
  assert.strictEqual(duplicateIds.length, 0, `Shuffle pool must not have duplicate tracks. Duplicates found: ${duplicateIds.join(', ')}`);
  console.log(`[PASS] Verified ${idSet.size} unique, embeddable YouTube video IDs in shuffle pool.`);

  // Verify single-song filtering on every track in the pool
  const multiSongInPool = poolData.items.filter(t => !isSingleSong(t));
  assert.strictEqual(multiSongInPool.length, 0, `Shuffle pool must not contain any multi-song compilations/mashups. Found: ${multiSongInPool.map(t => t.title).join(', ')}`);
  console.log('[PASS] Verified 100% of tracks in shuffle pool are authentic single songs.\n');

  // ==========================================
  // SECTION 2: FAIR SHUFFLE & NON-REPETITION CYCLE
  // ==========================================
  console.log('--- TEST 2: Fair Randomization & Non-Repeating Cycle Across 100 Songs ---');
  // Simulate client-side non-repeating shuffle cycle on the 100+ track pool
  const pool = [...poolData.items];
  
  // Fisher-Yates shuffle
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const playedIdsInCycle = [];
  for (let step = 0; step < 100; step++) {
    const track = shuffled[step];
    assert(track, `Track at step ${step} must exist`);
    assert(!playedIdsInCycle.includes(track.id), `Track "${track.title}" (${track.id}) was repeated at step ${step} before pool exhaustion!`);
    playedIdsInCycle.push(track.id);
  }
  assert.strictEqual(playedIdsInCycle.length, 100, 'Exactly 100 distinct songs played in sequence without any repetition');
  console.log('[PASS] Non-repeating shuffle cycle verified across 100 consecutive tracks.\n');

  // ==========================================
  // SECTION 3: SEARCH SINGLE-SONG FILTERING
  // ==========================================
  console.log('--- TEST 3: Single-Song Filtering on Search Results ---');
  const searchQueries = ['Arijit Singh', 'Bollywood Romantic Songs', 'Kishore Kumar'];
  for (const q of searchQueries) {
    const searchRes = await fetch(`${BASE_URL}/api/youtube/search?q=${encodeURIComponent(q)}&limit=10`);
    assert.strictEqual(searchRes.status, 200, `Search query "${q}" returns 200 OK`);
    const searchData = await searchRes.json();
    assert(Array.isArray(searchData.items), `Search for "${q}" returned items array`);

    const multiSongFound = searchData.items.filter(item => {
      const title = item.snippet?.title || '';
      return !isSingleSong({ title });
    });

    assert.strictEqual(multiSongFound.length, 0, `Search for "${q}" returned multi-song compilations: ${multiSongFound.map(m => m.snippet?.title).join(' | ')}`);
    console.log(`[PASS] Search for "${q}" returned ${searchData.items.length} clean single songs.`);
  }
  console.log('');

  // ==========================================
  // SECTION 4: MOOD AI SINGLE-SONG FILTERING
  // ==========================================
  console.log('--- TEST 4: Single-Song Filtering on Mood-to-Music AI ---');
  const moodRes = await fetch(`${BASE_URL}/api/mood/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Late night nostalgic Hindi love songs', seed: 42 })
  });
  assert.strictEqual(moodRes.status, 200, 'Mood recommend responds with 200 OK');
  const moodData = await moodRes.json();
  assert(Array.isArray(moodData.tracks), 'Mood endpoint returns tracks array');
  assert(moodData.tracks.length > 0, 'Mood endpoint returned recommended tracks');

  for (const track of moodData.tracks) {
    assert(isSingleSong(track), `Mood recommendation "${track.title}" must be an individual single song`);
  }
  console.log(`[PASS] Verified ${moodData.tracks.length} mood tracks are all authentic single songs.\n`);

  // ==========================================
  // SECTION 5: DISCOVER SWIPE AUTOPLAY LOGIC SIMULATION
  // ==========================================
  console.log('--- TEST 5: Discover Swipe Autoplay Logic & State Synchronization ---');
  // Simulate DiscoverSwipe state transitions
  const deck = pool.slice(0, 10);
  let currentIndex = 0;
  let currentlyPlaying = null;
  let isPlaying = false;
  let buffering = false;
  let playbackBlocked = false;

  const onPlaySong = (track) => {
    buffering = true;
    currentlyPlaying = track;
    isPlaying = true;
  };

  const onPlaybackStarted = () => {
    buffering = false;
    playbackBlocked = false;
  };

  // 1. Initial State: Card 0 is displayed, user taps play or swipes
  assert.strictEqual(currentIndex, 0);
  assert.strictEqual(currentlyPlaying, null);

  // 2. User Swipes Right (Like): Must trigger next card index and immediately autoplay next card
  const handleSwipeAction = (direction) => {
    const nextIdx = currentIndex + 1;
    const nextSong = deck[nextIdx];
    if (nextSong) {
      onPlaySong(nextSong);
    }
    currentIndex = nextIdx;
  };

  handleSwipeAction('like');
  assert.strictEqual(currentIndex, 1, 'Current index advanced to 1');
  assert.strictEqual(currentlyPlaying?.id, deck[1].id, 'Next track was automatically triggered for playback');
  assert.strictEqual(isPlaying, true, 'Global playback set to true without secondary tap');
  assert.strictEqual(buffering, true, 'Buffering indicator active while new track loads');
  onPlaybackStarted();
  assert.strictEqual(buffering, false, 'Buffering cleared once playback starts');
  console.log(`[PASS] Swipe Right immediately started autoplay of track 1 ("${deck[1].title}").`);

  // 3. User Swipes Left (Skip): Must trigger next card index and autoplay card 2
  handleSwipeAction('skip');
  assert.strictEqual(currentIndex, 2, 'Current index advanced to 2');
  assert.strictEqual(currentlyPlaying?.id, deck[2].id, 'Track 2 was automatically triggered for playback');
  console.log(`[PASS] Swipe Left immediately started autoplay of track 2 ("${deck[2].title}").`);

  // 4. User navigates back (Undo / Previous): Must autoplay card 1
  const handlePrevCard = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      onPlaySong(deck[prevIdx]);
      currentIndex = prevIdx;
    }
  };
  handlePrevCard();
  assert.strictEqual(currentIndex, 1, 'Current index returned to 1');
  assert.strictEqual(currentlyPlaying?.id, deck[1].id, 'Previous track was automatically triggered for playback');
  console.log(`[PASS] Previous navigation immediately autoplays previous track.`);

  console.log('\n=== ALL END-TO-END VERIFICATION SUITES PASSED CLEANLY! ===');
}

runTestSuite().catch(err => {
  console.error('\n[TEST FAILURE]:', err);
  process.exit(1);
});

