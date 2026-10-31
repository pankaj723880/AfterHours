import assert from 'assert';
import mongoose from 'mongoose';
import { catalogService } from '../services/catalogService.js';
import { recommendationEngine } from '../services/recommendationEngine.js';
import { getCanonicalSongKey } from '../services/recommendationHistoryService.js';

console.log('=== STARTING LOOPRA RECOMMENDATION DEDUPLICATION & METADATA AUDIT TEST SUITE ===\n');

async function runAudit() {
  const candidates = await catalogService.getCuratedTracks();
  assert(Array.isArray(candidates) && candidates.length > 10, 'Candidate catalog must be available');

  // TEST 1: New User with Zero History -> Daily Mix vs Discover
  console.log('--- TEST 1: Zero-History User (Discovery Starter Mix) ---');
  const starter = recommendationEngine.buildDiscoveryStarterMix(candidates);
  const sanitizedStarter = recommendationEngine.sanitizeRecommendations(starter.recommendations, candidates);

  const starterDaily = sanitizedStarter.dailyMix || [];
  const starterDiscover = sanitizedStarter.discover || [];

  assert(starterDaily.length > 0, 'Starter Daily Mix should contain tracks');
  assert(starterDiscover.length > 0, 'Starter Discover should contain tracks');

  const starterDailyIds = new Set(starterDaily.map(t => t.id || t.videoId));
  const starterDailyKeys = new Set(starterDaily.map(t => getCanonicalSongKey(t)));

  for (const track of starterDiscover) {
    const id = track.id || track.videoId;
    const key = getCanonicalSongKey(track);
    assert(!starterDailyIds.has(id), `Starter Discover song ID "${id}" overlaps with Daily Mix!`);
    assert(!starterDailyKeys.has(key), `Starter Discover song key "${key}" overlaps with Daily Mix!`);
  }
  console.log(`[PASS] Zero-history starter mix verified: ${starterDaily.length} Daily Mix tracks and ${starterDiscover.length} Discover tracks are 100% disjoint.\n`);

  // TEST 2: User with Rich Listening History -> Heuristic Hybrid Recommendations
  console.log('--- TEST 2: User with Rich Listening History ---');
  const richUserProfile = {
    userId: new mongoose.Types.ObjectId(),
    topArtists: [
      { name: 'Arijit Singh', score: 95 },
      { name: 'Pritam', score: 80 }
    ],
    topGenres: [
      { name: 'Romantic', score: 90 },
      { name: 'Bollywood', score: 75 }
    ],
    topMoods: [{ name: 'Love', score: 85 }],
    favouriteTrackIds: ['RLzC55ai0eo', 'BddP6PYo2gs'],
    skippedTrackIds: ['SQWDGLnvxF4'],
    dislikedTrackIds: [],
    recentTracks: [
      { trackId: 'RLzC55ai0eo', title: 'Heeriye', artist: 'Jasleen Royal ft Arijit Singh' },
      { trackId: 'BddP6PYo2gs', title: 'Kesariya', artist: 'Arijit Singh, Pritam' }
    ],
    totalCompletedListens: 24,
    isNewUser: false
  };

  const richRec = recommendationEngine.generateHeuristicRecommendations(richUserProfile, candidates);
  const sanitizedRich = recommendationEngine.sanitizeRecommendations(richRec.recommendations, candidates, richUserProfile);

  const richDaily = sanitizedRich.dailyMix || [];
  const richDiscover = sanitizedRich.discover || [];

  assert(richDaily.length > 0, 'Rich user Daily Mix should contain tracks');
  assert(richDiscover.length > 0, 'Rich user Discover should contain tracks');

  const richDailyIds = new Set(richDaily.map(t => t.id || t.videoId));
  const richDailyKeys = new Set(richDaily.map(t => getCanonicalSongKey(t)));

  // Verify Daily Mix prioritizes familiar favorites
  const hasArijitInDaily = richDaily.some(t => (t.artist || '').toLowerCase().includes('arijit singh') || (t.title || '').toLowerCase().includes('heeriye') || (t.title || '').toLowerCase().includes('kesariya'));
  assert(hasArijitInDaily, 'Daily Mix must prioritize familiar top artist Arijit Singh');

  // Verify Discover is disjoint from Daily Mix
  for (const track of richDiscover) {
    const id = track.id || track.videoId;
    const key = getCanonicalSongKey(track);
    assert(!richDailyIds.has(id), `Discover track ID "${id}" (${track.title}) overlaps with Daily Mix!`);
    assert(!richDailyKeys.has(key), `Discover track canonical key "${key}" overlaps with Daily Mix!`);
  }
  console.log(`[PASS] Rich history verified: ${richDaily.length} Daily Mix tracks and ${richDiscover.length} Discover tracks are 100% disjoint.\n`);

  // TEST 3: User with Limited History (1 or 2 plays)
  console.log('--- TEST 3: User with Limited History (1-2 Plays) ---');
  const limitedUserProfile = {
    userId: new mongoose.Types.ObjectId(),
    topArtists: [{ name: 'Diljit Dosanjh', score: 20 }],
    topGenres: [{ name: 'Punjabi Pop', score: 20 }],
    topMoods: [],
    favouriteTrackIds: [],
    skippedTrackIds: [],
    dislikedTrackIds: [],
    recentTracks: [
      { trackId: 'cIGd8gm_pYE', title: 'Lover', artist: 'Diljit Dosanjh' }
    ],
    totalCompletedListens: 1,
    isNewUser: false
  };

  const limitedRec = recommendationEngine.generateHeuristicRecommendations(limitedUserProfile, candidates);
  const sanitizedLimited = recommendationEngine.sanitizeRecommendations(limitedRec.recommendations, candidates, limitedUserProfile);

  const limitedDaily = sanitizedLimited.dailyMix || [];
  const limitedDiscover = sanitizedLimited.discover || [];

  const limitedDailyIds = new Set(limitedDaily.map(t => t.id || t.videoId));
  const limitedDailyKeys = new Set(limitedDaily.map(t => getCanonicalSongKey(t)));

  for (const track of limitedDiscover) {
    const id = track.id || track.videoId;
    const key = getCanonicalSongKey(track);
    assert(!limitedDailyIds.has(id), `Limited user Discover track ID "${id}" overlaps with Daily Mix!`);
    assert(!limitedDailyKeys.has(key), `Limited user Discover key "${key}" overlaps with Daily Mix!`);
  }
  console.log(`[PASS] Limited history verified: ${limitedDaily.length} Daily Mix tracks and ${limitedDiscover.length} Discover tracks are 100% disjoint.\n`);

  // TEST 4: Metadata Integrity & No "Unknown Artist"
  console.log('--- TEST 4: Metadata Integrity & No "Unknown Artist" Labels ---');
  const allRecommendedTracks = [
    ...starterDaily,
    ...starterDiscover,
    ...richDaily,
    ...richDiscover,
    ...limitedDaily,
    ...limitedDiscover
  ];

  for (const t of allRecommendedTracks) {
    assert(t.id && t.videoId, 'Track must have valid id and videoId');
    assert(t.id === t.videoId, 'id and videoId must match for accurate playback routing');
    assert(t.title && t.title.trim().length > 0, 'Track must have non-empty title');
    assert(t.artist && t.artist.trim().length > 0, 'Track must have non-empty artist');
    assert(t.artist.toLowerCase() !== 'unknown artist', `Track "${t.title}" has forbidden "Unknown Artist" label!`);
    assert(t.artist.toLowerCase() !== 'unknown', `Track "${t.title}" has forbidden "Unknown" label!`);
    assert(t.thumbnail && t.thumbnail.startsWith('http'), `Track "${t.title}" must have valid HTTP thumbnail URL`);
  }
  console.log(`[PASS] Verified ${allRecommendedTracks.length} tracks across all test mixes: zero "Unknown Artist" labels, valid thumbnails, consistent video IDs.\n`);

  // TEST 5: Stale / Corrupted Cache Cleansing
  console.log('--- TEST 5: Corrupted Cache Detection & Purge ---');
  const duplicateId = 'RLzC55ai0eo';
  const corruptedRecommendations = {
    dailyMix: [
      { id: duplicateId, videoId: duplicateId, title: 'Heeriye', artist: 'Arijit Singh' },
      { id: 'BddP6PYo2gs', videoId: 'BddP6PYo2gs', title: 'Kesariya', artist: 'Arijit Singh' }
    ],
    discover: [
      { id: duplicateId, videoId: duplicateId, title: 'Heeriye', artist: 'Arijit Singh' }, // DUPLICATE!
      { id: 'cIGd8gm_pYE', videoId: 'cIGd8gm_pYE', title: 'Lover', artist: 'Diljit Dosanjh' }
    ]
  };

  const cleansed = recommendationEngine.sanitizeRecommendations(corruptedRecommendations, candidates);
  const cleansedDailyIds = new Set((cleansed.dailyMix || []).map(t => t.id || t.videoId));
  for (const track of cleansed.discover || []) {
    assert(!cleansedDailyIds.has(track.id), `Corrupted duplicate track ID "${track.id}" was not purged from Discover!`);
  }
  console.log('[PASS] Corrupted cache successfully detected and duplicate tracks purged from Discover.\n');

  // TEST 6: Limited Candidate Pool Handling
  console.log('--- TEST 6: Limited Candidate Pool (Return Fewer Results Rather Than Duplicate) ---');
  const tinyPool = [
    { id: 'track-1', videoId: 'track-1', title: 'Song One', artist: 'Artist One', genre: 'Pop', mood: 'Vibes' },
    { id: 'track-2', videoId: 'track-2', title: 'Song Two', artist: 'Artist Two', genre: 'Pop', mood: 'Vibes' },
    { id: 'track-3', videoId: 'track-3', title: 'Song Three', artist: 'Artist Three', genre: 'Pop', mood: 'Vibes' }
  ];

  const tinyDaily = [tinyPool[0], tinyPool[1]];
  const tinyDiscover = [tinyPool[0], tinyPool[2]]; // tinyPool[0] is duplicate!

  const tinyCleaned = recommendationEngine.sanitizeRecommendations({
    dailyMix: tinyDaily,
    discover: tinyDiscover
  }, tinyPool);

  const tinyDailyIds = new Set(tinyCleaned.dailyMix.map(t => t.id));
  for (const t of tinyCleaned.discover) {
    assert(!tinyDailyIds.has(t.id), `Track "${t.id}" was duplicated instead of returning fewer results!`);
  }
  assert(tinyCleaned.discover.length === 1, `Discover should return exactly 1 unique track when candidate pool is small, got ${tinyCleaned.discover.length}`);
  console.log(`[PASS] Verified limited candidate pool: returned ${tinyCleaned.discover.length} unique track rather than duplicating.\n`);

  console.log('=== ALL 6 RECOMMENDATION DEDUPLICATION AUDIT TESTS PASSED SUCCESSFULLY! ===\n');
}

runAudit().catch(err => {
  console.error('[TEST FAIL]:', err);
  process.exit(1);
});

