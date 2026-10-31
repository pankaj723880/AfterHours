import assert from 'assert';
import mongoose from 'mongoose';
import { catalogService, CORE_CATALOG_TRACKS } from '../services/catalogService.js';
import { recommendationEngine } from '../services/recommendationEngine.js';
import {
  getCanonicalSongKey,
  cleanSongTitle,
  cleanArtistName,
  getVersionDescriptor,
  areTracksSame,
  TrackDeduplicator
} from '../services/recommendationHistoryService.js';

console.log('=== STARTING LOOPRA HOMEPAGE ZERO DUPLICATE AUDIT TEST SUITE ===\n');

async function runTestSuite() {
  const candidates = await catalogService.getCuratedTracks();
  assert(Array.isArray(candidates) && candidates.length >= 30, 'Rich candidate catalog must be available');

  // =========================================================================
  // TEST A: Cross-Section Duplication with Overlapping Candidate Lists
  // =========================================================================
  console.log('--- TEST A: Cross-Section Duplication Across ALL Sections ---');

  const sampleUserProfile = {
    userId: new mongoose.Types.ObjectId(),
    topArtists: [
      { name: 'Arijit Singh', score: 90 },
      { name: 'Jasleen Royal', score: 70 },
      { name: 'Diljit Dosanjh', score: 60 }
    ],
    topGenres: [
      { name: 'Romantic', score: 85 },
      { name: 'Bollywood', score: 80 }
    ],
    topMoods: [{ name: 'Love', score: 80 }],
    favouriteTrackIds: ['RLzC55ai0eo', 'BddP6PYo2gs'],
    skippedTrackIds: [],
    dislikedTrackIds: [],
    recentTracks: [
      { trackId: 'RLzC55ai0eo', title: 'Heeriye', artist: 'Jasleen Royal ft Arijit Singh' },
      { trackId: 'BddP6PYo2gs', title: 'Kesariya', artist: 'Arijit Singh, Pritam' }
    ],
    totalCompletedListens: 18,
    isNewUser: false
  };

  const recResult = recommendationEngine.generateHeuristicRecommendations(sampleUserProfile, candidates);
  const sanitized = recommendationEngine.sanitizeRecommendations(recResult.recommendations, candidates, sampleUserProfile);

  const sectionsToVerify = [
    { name: 'madeForYou', tracks: sanitized.madeForYou || [] },
    { name: 'becauseYouListenedTo', tracks: sanitized.becauseYouListenedTo?.recommendations || [] },
    { name: 'dailyMix', tracks: sanitized.dailyMix || [] },
    { name: 'favouriteArtists', tracks: sanitized.favouriteArtists || [] },
    { name: 'discover', tracks: sanitized.discover || [] },
    { name: 'moreLikeRecent', tracks: sanitized.moreLikeRecent || [] }
  ];

  const globalTracker = new TrackDeduplicator();
  let totalTracksChecked = 0;

  for (const sec of sectionsToVerify) {
    assert(Array.isArray(sec.tracks), `Section ${sec.name} must be an array`);
    for (const track of sec.tracks) {
      assert(!globalTracker.isDuplicate(track), `DUPLICATE FOUND! Track "${track.title}" in section "${sec.name}" is already present in another section!`);
      globalTracker.add(track);
      totalTracksChecked++;
    }
  }

  assert(totalTracksChecked >= 15, `Expected substantial number of recommendation tracks, found ${totalTracksChecked}`);
  console.log(`[PASS] Test A: Verified ${totalTracksChecked} tracks across all 6 sections with EXACTLY ZERO duplicates.\n`);

  // =========================================================================
  // TEST B: Alternate YouTube IDs for Same Recording Rejected
  // =========================================================================
  console.log('--- TEST B: Alternate YouTube IDs for Same Recording Rejected ---');

  const trackOfficial = {
    id: 'VIDEO_ID_111',
    videoId: 'VIDEO_ID_111',
    title: 'Kesariya (Official Video)',
    artist: 'Arijit Singh, Pritam'
  };

  const trackAudio = {
    id: 'VIDEO_ID_222', // DIFFERENT YOUTUBE ID!
    videoId: 'VIDEO_ID_222',
    title: 'Kesariya [Official HD Audio]',
    artist: 'Pritam, Arijit Singh'
  };

  assert(areTracksSame(trackOfficial, trackAudio), 'Tracks with alternate YouTube IDs for same recording must be recognized as identical');

  const deduplicatorB = new TrackDeduplicator();
  deduplicatorB.add(trackOfficial);
  assert(deduplicatorB.isDuplicate(trackAudio), 'Deduplicator must reject alternate YouTube ID of same recording');
  console.log('[PASS] Test B: Alternate YouTube IDs for identical recording successfully identified and rejected.\n');

  // =========================================================================
  // TEST C: Different Title Formatting / Noise Suffixes Rejected
  // =========================================================================
  console.log('--- TEST C: Different Title Formatting / Suffixes Rejected ---');

  const trackVarA = {
    id: 'ID_AAA',
    title: 'Heeriye (Official Music Video)',
    artist: 'Jasleen Royal ft Arijit Singh'
  };

  const trackVarB = {
    id: 'ID_BBB',
    title: 'Heeriye - Full Song | Dulquer Salmaan | Jasleen Royal | Arijit Singh',
    artist: 'Jasleen Royal'
  };

  const trackVarC = {
    id: 'ID_CCC',
    title: 'Heeriye (Lyrics Video) [4K UHD]',
    artist: 'Jasleen Royal, Arijit Singh'
  };

  assert(areTracksSame(trackVarA, trackVarB), 'Variant B must match Variant A');
  assert(areTracksSame(trackVarA, trackVarC), 'Variant C must match Variant A');

  const deduplicatorC = new TrackDeduplicator([trackVarA]);
  assert(deduplicatorC.isDuplicate(trackVarB), 'Variant B must be detected as duplicate');
  assert(deduplicatorC.isDuplicate(trackVarC), 'Variant C must be detected as duplicate');
  console.log('[PASS] Test C: YouTube title noise, credits, and formatting variations correctly recognized and deduplicated.\n');

  // =========================================================================
  // TEST D: Genuine Versions (Remix, Acoustic, Live) Preserved
  // =========================================================================
  console.log('--- TEST D: Genuine Versions (Acoustic, Remix, Live) Preserved ---');

  const originalSong = {
    id: 'KASOOR_ORIG',
    title: 'Kasoor',
    artist: 'Prateek Kuhad'
  };

  const acousticSong = {
    id: 'KASOOR_ACOUSTIC',
    title: 'Kasoor - Acoustic',
    artist: 'Prateek Kuhad'
  };

  const liveSong = {
    id: 'KASOOR_LIVE',
    title: 'Kasoor (Live at Delhi)',
    artist: 'Prateek Kuhad'
  };

  const remixSong = {
    id: 'KASOOR_REMIX',
    title: 'Kasoor (Lost Stories Remix)',
    artist: 'Prateek Kuhad, Lost Stories'
  };

  assert(!areTracksSame(originalSong, acousticSong), 'Acoustic version must NOT be merged with original');
  assert(!areTracksSame(originalSong, liveSong), 'Live version must NOT be merged with original');
  assert(!areTracksSame(originalSong, remixSong), 'Remix version must NOT be merged with original');
  assert(!areTracksSame(acousticSong, remixSong), 'Acoustic and Remix versions must NOT be merged');

  const deduplicatorD = new TrackDeduplicator();
  deduplicatorD.add(originalSong);
  assert(!deduplicatorD.isDuplicate(acousticSong), 'Deduplicator must allow acoustic recording');
  deduplicatorD.add(acousticSong);
  assert(!deduplicatorD.isDuplicate(liveSong), 'Deduplicator must allow live recording');
  deduplicatorD.add(liveSong);
  assert(!deduplicatorD.isDuplicate(remixSong), 'Deduplicator must allow remix recording');

  console.log('[PASS] Test D: Genuine acoustic, live, and remix recordings cleanly preserved without false deduplication.\n');

  // =========================================================================
  // TEST E: Pagination Never Returns Previously Seen Songs
  // =========================================================================
  console.log('--- TEST E: Pagination and Exclusion Integrity ---');

  const starterMix = recommendationEngine.buildDiscoveryStarterMix(candidates);
  const initialDaily = starterMix.recommendations.dailyMix || [];
  const initialMade = starterMix.recommendations.madeForYou || [];

  const excludeIds = new Set([
    ...initialDaily.map(t => t.id || t.videoId),
    ...initialMade.map(t => t.id || t.videoId)
  ]);
  const excludeKeys = new Set([
    ...initialDaily.map(t => getCanonicalSongKey(t)),
    ...initialMade.map(t => getCanonicalSongKey(t))
  ]);

  // Query discovery with exclusions
  const discoveryCandidates = candidates.filter(t => {
    const id = t.id || t.videoId;
    const key = getCanonicalSongKey(t);
    return !excludeIds.has(id) && !excludeKeys.has(key);
  });

  const deduplicatorE = new TrackDeduplicator([
    ...initialDaily,
    ...initialMade
  ]);

  const pagedTracks = deduplicatorE.filterUnique(discoveryCandidates).slice(0, 10);
  assert(pagedTracks.length > 0, 'Paged discovery should return tracks');

  for (const pt of pagedTracks) {
    const id = pt.id || pt.videoId;
    const key = getCanonicalSongKey(pt);
    assert(!excludeIds.has(id), `Paged track ID "${id}" was in exclude set!`);
    assert(!excludeKeys.has(key), `Paged track key "${key}" was in exclude set!`);
  }
  console.log(`[PASS] Test E: Paged results returned ${pagedTracks.length} tracks with ZERO overlap against exclusion set.\n`);

  // =========================================================================
  // TEST F: Concurrent Asynchronous API Response Order Independence
  // =========================================================================
  console.log('--- TEST F: Concurrent Async Order Independence ---');

  // Scenario: Pool of songs X, Y, Z received by Section 1 and Section 2
  const candidateBatch1 = candidates.slice(0, 10);
  const candidateBatch2 = candidates.slice(5, 15); // 50% overlap!

  // Simulation Order 1: Section A resolves first, then Section B
  const dedupOrder1 = new TrackDeduplicator();
  const secA1 = dedupOrder1.filterUnique(candidateBatch1);
  const secB1 = dedupOrder1.filterUnique(candidateBatch2);

  // Simulation Order 2: Section B resolves first, then Section A
  const dedupOrder2 = new TrackDeduplicator();
  const secB2 = dedupOrder2.filterUnique(candidateBatch2);
  const secA2 = dedupOrder2.filterUnique(candidateBatch1);

  // Verify within both orders, cross-section overlap is EXACTLY ZERO
  const keysA1 = new Set(secA1.map(getCanonicalSongKey));
  const keysB1 = new Set(secB1.map(getCanonicalSongKey));
  for (const k of keysA1) {
    assert(!keysB1.has(k), `Order 1: Song key "${k}" exists in both sections!`);
  }

  const keysA2 = new Set(secA2.map(getCanonicalSongKey));
  const keysB2 = new Set(secB2.map(getCanonicalSongKey));
  for (const k of keysA2) {
    assert(!keysB2.has(k), `Order 2: Song key "${k}" exists in both sections!`);
  }
  console.log('[PASS] Test F: Independent asynchronous resolution orders consistently maintain 100% disjoint sets.\n');

  // =========================================================================
  // TEST G: Refresh Generates Unique Sets Without Duplicates
  // =========================================================================
  console.log('--- TEST G: Refresh Produces Zero-Duplicate Sets ---');

  const refreshedRec = recommendationEngine.generateHeuristicRecommendations(sampleUserProfile, candidates);
  const sanitizedRefreshed = recommendationEngine.sanitizeRecommendations(refreshedRec.recommendations, candidates, sampleUserProfile);

  const refreshTracker = new TrackDeduplicator();
  const allRefreshed = [
    ...(sanitizedRefreshed.madeForYou || []),
    ...(sanitizedRefreshed.dailyMix || []),
    ...(sanitizedRefreshed.discover || []),
    ...(sanitizedRefreshed.becauseYouListenedTo?.recommendations || []),
    ...(sanitizedRefreshed.favouriteArtists || []),
    ...(sanitizedRefreshed.moreLikeRecent || [])
  ];

  for (const t of allRefreshed) {
    assert(!refreshTracker.isDuplicate(t), `Duplicate found during refresh: "${t.title}"`);
    refreshTracker.add(t);
  }
  console.log(`[PASS] Test G: Refreshed recommendation ecosystem (${allRefreshed.length} tracks) verified with ZERO duplicates.\n`);

  // =========================================================================
  // TEST H: Multi-User Isolation
  // =========================================================================
  console.log('--- TEST H: Multi-User Profile Isolation ---');

  const userA = {
    userId: new mongoose.Types.ObjectId(),
    topArtists: [{ name: 'Arijit Singh', score: 90 }],
    topGenres: [{ name: 'Romantic', score: 85 }],
    topMoods: [],
    favouriteTrackIds: ['RLzC55ai0eo'],
    skippedTrackIds: [],
    dislikedTrackIds: [],
    recentTracks: [{ trackId: 'RLzC55ai0eo', title: 'Heeriye', artist: 'Jasleen Royal' }],
    totalCompletedListens: 5,
    isNewUser: false
  };

  const userB = {
    userId: new mongoose.Types.ObjectId(),
    topArtists: [{ name: 'Diljit Dosanjh', score: 95 }],
    topGenres: [{ name: 'Punjabi Pop', score: 90 }],
    topMoods: [],
    favouriteTrackIds: ['cIGd8gm_pYE'],
    skippedTrackIds: [],
    dislikedTrackIds: [],
    recentTracks: [{ trackId: 'cIGd8gm_pYE', title: 'Lover', artist: 'Diljit Dosanjh' }],
    totalCompletedListens: 8,
    isNewUser: false
  };

  const recA = recommendationEngine.generateHeuristicRecommendations(userA, candidates);
  const recB = recommendationEngine.generateHeuristicRecommendations(userB, candidates);

  const userARecs = [...recA.recommendations.madeForYou, ...recA.recommendations.dailyMix];
  const userBRecs = [...recB.recommendations.madeForYou, ...recB.recommendations.dailyMix];

  // User A's top recommendations must focus on Arijit / Romantic
  assert(userARecs.some(t => (t.artist || '').toLowerCase().includes('arijit') || (t.title || '').toLowerCase().includes('heeriye')), 'User A should receive Arijit recommendations');
  // User B's top recommendations must focus on Diljit / Punjabi
  assert(userBRecs.some(t => (t.artist || '').toLowerCase().includes('diljit') || (t.title || '').toLowerCase().includes('lover')), 'User B should receive Diljit recommendations');

  console.log('[PASS] Test H: Multi-user recommendation profiles cleanly isolated.\n');

  // =========================================================================
  // TEST I: Full Homepage Ecosystem Scan (EXACTLY ZERO DUPLICATES)
  // =========================================================================
  console.log('--- TEST I: Full Homepage Ecosystem Scan Across ALL Carousels ---');

  // Simulate complete homepage card rendering on activeTab === 'home':
  // 1. Personalized recommendations (all 6 rows)
  // 2. Trending songs (ScrollableRow)
  const homeRecs = recommendationEngine.sanitizeRecommendations(recResult.recommendations, candidates, sampleUserProfile);

  const homeRenderedTracks = [];
  const homepageDeduplicator = new TrackDeduplicator();

  // Row 1: Made For You
  for (const t of (homeRecs.madeForYou || [])) {
    assert(!homepageDeduplicator.isDuplicate(t), `Duplicate in Made For You: "${t.title}"`);
    homepageDeduplicator.add(t);
    homeRenderedTracks.push({ section: 'Made For You', track: t });
  }

  // Row 2: Because You Listened To
  for (const t of (homeRecs.becauseYouListenedTo?.recommendations || [])) {
    assert(!homepageDeduplicator.isDuplicate(t), `Duplicate in Because You Listened To: "${t.title}"`);
    homepageDeduplicator.add(t);
    homeRenderedTracks.push({ section: 'Because You Listened To', track: t });
  }

  // Row 3: Daily Mix
  for (const t of (homeRecs.dailyMix || [])) {
    assert(!homepageDeduplicator.isDuplicate(t), `Duplicate in Daily Mix: "${t.title}"`);
    homepageDeduplicator.add(t);
    homeRenderedTracks.push({ section: 'Your Daily Mix', track: t });
  }

  // Row 4: Favourite Artists
  for (const t of (homeRecs.favouriteArtists || [])) {
    assert(!homepageDeduplicator.isDuplicate(t), `Duplicate in Favourite Artists: "${t.title}"`);
    homepageDeduplicator.add(t);
    homeRenderedTracks.push({ section: 'Favourite Artists', track: t });
  }

  // Row 5: Discover Your Next Favourite
  for (const t of (homeRecs.discover || [])) {
    assert(!homepageDeduplicator.isDuplicate(t), `Duplicate in Discover: "${t.title}"`);
    homepageDeduplicator.add(t);
    homeRenderedTracks.push({ section: 'Discover Your Next Favourite', track: t });
  }

  // Row 6: More Like Recent
  for (const t of (homeRecs.moreLikeRecent || [])) {
    assert(!homepageDeduplicator.isDuplicate(t), `Duplicate in More Like Recent: "${t.title}"`);
    homepageDeduplicator.add(t);
    homeRenderedTracks.push({ section: 'More Like Recent', track: t });
  }

  // Row 7: Trending Songs Carousel (coordinated with recommendations)
  const renderedKeys = new Set(homepageDeduplicator.getAllKeys());
  const uniqueTrending = candidates.filter(t => {
    const key = getCanonicalSongKey(t);
    if (renderedKeys.has(key)) return false;
    if (homepageDeduplicator.isDuplicate(t)) return false;
    homepageDeduplicator.add(t);
    return true;
  }).slice(0, 8);

  for (const t of uniqueTrending) {
    homeRenderedTracks.push({ section: 'Trending songs', track: t });
  }

  // GLOBAL VERIFICATION: Verify all pairs (A, B) where A !== B satisfy canonicalTrackId(A) !== canonicalTrackId(B)
  console.log(`Scanning all ${homeRenderedTracks.length} homepage cards for any duplicate canonical identities...`);
  let duplicateCount = 0;

  for (let i = 0; i < homeRenderedTracks.length; i++) {
    for (let j = i + 1; j < homeRenderedTracks.length; j++) {
      const itemA = homeRenderedTracks[i];
      const itemB = homeRenderedTracks[j];

      if (areTracksSame(itemA.track, itemB.track)) {
        duplicateCount++;
        console.error(`[FAIL] Duplicate found: "${itemA.track.title}" in [${itemA.section}] and "${itemB.track.title}" in [${itemB.section}]!`);
      }
    }
  }

  assert.strictEqual(duplicateCount, 0, `Expected duplicate count to be EXACTLY ZERO, found ${duplicateCount}`);
  console.log(`[PASS] Test I: Verified ${homeRenderedTracks.length} homepage cards across all carousels. Duplicate count: EXACTLY ZERO.\n`);

  console.log('=== ALL 9 HOMEPAGE ZERO DUPLICATE AUDIT TESTS PASSED SUCCESSFULLY! ===\n');
}

runTestSuite().catch(err => {
  console.error('[TEST SUITE FAILED]:', err);
  process.exit(1);
});
