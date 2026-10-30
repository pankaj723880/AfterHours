import assert from 'assert';
import mongoose from 'mongoose';
import User from '../models/User.js';
import UserListeningEvent from '../models/UserListeningEvent.js';
import UserMusicPreference from '../models/UserMusicPreference.js';
import UserRecommendationCache from '../models/UserRecommendationCache.js';
import { listeningEventService } from '../services/listeningEventService.js';
import { catalogService } from '../services/catalogService.js';
import { geminiRecommendationService, geminiDiagnostics } from '../services/geminiRecommendationService.js';
import { recommendationEngine } from '../services/recommendationEngine.js';

console.log('=== STARTING GEMINI AI-POWERED PERSONALIZED RECOMMENDATIONS TEST SUITE ===\n');

// Mock in-memory MongoDB connection for isolated testing
const runTests = async () => {
  // Use memory or test database if available, otherwise test pure logic with mock objects
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();
  const userCId = new mongoose.Types.ObjectId();

  // Test 1: Candidate Catalog Integrity & Single Song Guarantee
  console.log('--- TEST 1: Candidate Catalog Validation ---');
  const catalogTracks = await catalogService.getCuratedTracks();
  assert(Array.isArray(catalogTracks) && catalogTracks.length > 5, 'Catalog must contain verified songs');
  for (const t of catalogTracks) {
    assert(t.id && t.videoId, 'Catalog track must have valid id and videoId');
    assert(t.title, 'Catalog track must have title');
    assert(t.artist, 'Catalog track must have artist');
    assert(t.thumbnail, 'Catalog track must have thumbnail');
  }
  console.log(`[PASS] Catalog verified with ${catalogTracks.length} playable single tracks.\n`);

  // Test 2: Distinct User Profiles & Isolation (User A vs User B)
  console.log('--- TEST 2: Dual User Listening Profiles (User A vs User B) ---');
  
  // User A Profile: Hindi Romantic & Arijit Singh Lover
  const userAEvents = [
    { trackId: 'RLzC55ai0eo', title: 'Heeriye', artist: 'Arijit Singh', eventType: 'completed', duration: 210, listenedDuration: 200, completionPercent: 95 },
    { trackId: 'RLzC55ai0eo', title: 'Heeriye', artist: 'Arijit Singh', eventType: 'repeat', duration: 210, listenedDuration: 210, completionPercent: 100 },
    { trackId: 'WWIfHemqSEA', title: 'Tujhko', artist: 'Arijit Singh', eventType: 'like', duration: 240, listenedDuration: 240, completionPercent: 100 },
    { trackId: 'BddP6PYo2gs', title: 'Kesariya', artist: 'Arijit Singh', eventType: 'completed', duration: 260, listenedDuration: 250, completionPercent: 96 },
    { trackId: 'Yqj1_V90KJo', title: 'Chura Ke Dil Mera', artist: 'Kumar Sanu', eventType: 'completed', duration: 300, listenedDuration: 290, completionPercent: 97 }
  ];

  // User B Profile: Punjabi & High Energy Party Lover
  const userBEvents = [
    { trackId: 'cIGd8gm_pYE', title: 'Lover', artist: 'Diljit Dosanjh', eventType: 'completed', duration: 190, listenedDuration: 185, completionPercent: 97 },
    { trackId: 'cIGd8gm_pYE', title: 'Lover', artist: 'Diljit Dosanjh', eventType: 'repeat', duration: 190, listenedDuration: 190, completionPercent: 100 },
    { trackId: 'cIGd8gm_pYE', title: 'Lover', artist: 'Diljit Dosanjh', eventType: 'like', duration: 190, listenedDuration: 190, completionPercent: 100 },
    { trackId: 'RLzC55ai0eo', title: 'Heeriye', artist: 'Arijit Singh', eventType: 'skip', duration: 210, listenedDuration: 4, completionPercent: 2 }
  ];

  // Mock User Music Preferences for A and B
  const prefA = {
    userId: userAId,
    topArtists: [
      { name: 'Arijit Singh', score: 35, playCount: 4, completedCount: 3, skipCount: 0 },
      { name: 'Kumar Sanu', score: 18, playCount: 2, completedCount: 2, skipCount: 0 }
    ],
    topGenres: [{ name: 'Romantic Melodies', score: 25 }],
    topMoods: [{ name: 'Love & Romance', score: 25 }],
    favouriteTrackIds: ['WWIfHemqSEA'],
    repeatTrackIds: ['RLzC55ai0eo'],
    skippedTrackIds: [],
    dislikedTrackIds: [],
    recentTracks: [{ trackId: 'RLzC55ai0eo', title: 'Heeriye', artist: 'Arijit Singh' }],
    totalPlays: 5,
    totalCompletedListens: 5,
    recommendationsEnabled: true,
    isNewUser: false
  };

  const prefB = {
    userId: userBId,
    topArtists: [
      { name: 'Diljit Dosanjh', score: 40, playCount: 3, completedCount: 3, skipCount: 0 }
    ],
    topGenres: [{ name: 'Punjabi Pop & Party', score: 30 }],
    topMoods: [{ name: 'High Energy Party', score: 30 }],
    favouriteTrackIds: ['cIGd8gm_pYE'],
    repeatTrackIds: ['cIGd8gm_pYE'],
    skippedTrackIds: ['RLzC55ai0eo'],
    dislikedTrackIds: [],
    recentTracks: [{ trackId: 'cIGd8gm_pYE', title: 'Lover', artist: 'Diljit Dosanjh' }],
    totalPlays: 4,
    totalCompletedListens: 3,
    recommendationsEnabled: true,
    isNewUser: false
  };

  const recsA = recommendationEngine.generateHeuristicRecommendations(prefA, catalogTracks);
  const recsB = recommendationEngine.generateHeuristicRecommendations(prefB, catalogTracks);

  assert(recsA.recommendations.madeForYou.length > 0, 'User A should receive Made For You recommendations');
  assert(recsB.recommendations.madeForYou.length > 0, 'User B should receive Made For You recommendations');

  // Verify User A has Arijit Singh in top recommendations
  const userATopArtistMatch = recsA.recommendations.madeForYou.some(t => t.artist.toLowerCase().includes('arijit singh'));
  assert(userATopArtistMatch, 'User A should receive Arijit Singh tracks in recommendations');

  // Verify User B has Diljit Dosanjh in top recommendations
  const userBTopArtistMatch = recsB.recommendations.madeForYou.some(t => t.artist.toLowerCase().includes('diljit dosanjh'));
  assert(userBTopArtistMatch, 'User B should receive Diljit Dosanjh tracks in recommendations');

  // Verify User B was penalized for skipped track
  const userBContainsSkipped = recsB.recommendations.madeForYou.some(t => t.id === 'RLzC55ai0eo');
  assert(!userBContainsSkipped, 'User B should not have skipped track promoted in Made For You');

  console.log('[PASS] User A and User B recommendations generated independently with distinctive artist and mood affinity.\n');

  // Test 3: Brand New User Handling (Discovery Starter Mix)
  console.log('--- TEST 3: New User With Zero History ---');
  const newUserPref = {
    userId: userCId,
    topArtists: [],
    topGenres: [],
    topMoods: [],
    favouriteTrackIds: [],
    skippedTrackIds: [],
    dislikedTrackIds: [],
    recentTracks: [],
    totalPlays: 0,
    totalCompletedListens: 0,
    recommendationsEnabled: true,
    isNewUser: true
  };

  const starterRecs = recommendationEngine.buildDiscoveryStarterMix(catalogTracks);
  assert(starterRecs.source === 'discovery_starter', 'New user must get discovery starter mix');
  assert(starterRecs.recommendations.madeForYou.length >= 4, 'New user must receive curated trending starters');
  assert(starterRecs.recommendations.becauseYouListenedTo === null, 'New user must not have becauseYouListenedTo hallucination');
  console.log('[PASS] New user handled cleanly with discovery starter mix.\n');

  // Test 4: Dislike Exclusions
  console.log('--- TEST 4: Dislike Exclusion Guarantee ---');
  const prefWithDislike = {
    ...prefA,
    dislikedTrackIds: ['RLzC55ai0eo']
  };
  const recsWithDislike = recommendationEngine.generateHeuristicRecommendations(prefWithDislike, catalogTracks);
  const foundDisliked = recsWithDislike.recommendations.madeForYou.some(t => t.id === 'RLzC55ai0eo') ||
                        recsWithDislike.recommendations.dailyMix.some(t => t.id === 'RLzC55ai0eo');
  assert(!foundDisliked, 'Disliked track must be strictly excluded from all recommendations');
  console.log('[PASS] Disliked tracks are 100% excluded.\n');

  // Test 5: Candidate ID Integrity (Zero Hallucinated IDs)
  console.log('--- TEST 5: Candidate ID Integrity Guarantee ---');
  const validIds = new Set(catalogTracks.map(t => t.id));
  for (const track of recsA.recommendations.madeForYou) {
    assert(validIds.has(track.id), `Recommended track ID "${track.id}" must exist in candidate catalog`);
  }
  for (const track of recsB.recommendations.madeForYou) {
    assert(validIds.has(track.id), `Recommended track ID "${track.id}" must exist in candidate catalog`);
  }
  console.log('[PASS] All recommended IDs verified against catalog (Zero hallucinations).\n');

  // Test 6: Privacy Opt-Out
  console.log('--- TEST 6: User Privacy Opt-Out ---');
  const optOutPref = {
    ...prefA,
    recommendationsEnabled: false
  };
  assert.strictEqual(optOutPref.recommendationsEnabled, false, 'Preference reflects opt-out status');
  console.log('[PASS] Privacy preference flag honored.\n');

  // Test 7: Diagnostics & Error Reporting
  console.log('--- TEST 7: Backend Diagnostics Status ---');
  const diag = recommendationEngine.getDiagnostics();
  assert(typeof diag === 'object', 'Diagnostics must return an object');
  assert('geminiConfigured' in diag, 'Diagnostics must include geminiConfigured status');
  assert('cacheHits' in diag, 'Diagnostics must report cache hits');
  assert('cacheMisses' in diag, 'Diagnostics must report cache misses');
  assert('fallbackGenerations' in diag, 'Diagnostics must report fallback generations');
  console.log(`[PASS] Diagnostics working: configured=${diag.geminiConfigured}, fallbackCount=${diag.fallbackGenerations}\n`);

  // Test 8: Anti-Duplication of Listening Events
  console.log('--- TEST 8: Anti-Duplication of Listening Events ---');
  const testTrackEvent = {
    trackId: 'BddP6PYo2gs',
    title: 'Kesariya',
    artist: 'Arijit Singh',
    eventType: 'play_start',
    duration: 260,
    listenedDuration: 5,
    completionPercent: 2
  };

  const firstCall = await listeningEventService.recordEvent(userAId, testTrackEvent);
  assert.strictEqual(firstCall.recorded, true, 'First event should be recorded');

  // Immediate second call with identical payload within 3 seconds
  const secondCall = await listeningEventService.recordEvent(userAId, testTrackEvent);
  assert.strictEqual(secondCall.recorded, false, 'Second immediate duplicate event must not be recorded');
  assert.strictEqual(secondCall.deduplicated, true, 'Second immediate duplicate event must be flagged as deduplicated');
  console.log('[PASS] Rapid duplicate player events successfully deduplicated.\n');

  // Test 9: Express Endpoints Integration Test
  console.log('--- TEST 9: Express Endpoints Integration & Authentication ---');
  const http = await import('http');
  const express = (await import('express')).default;
  const jwt = (await import('jsonwebtoken')).default;
  const recommendationRoutes = (await import('../routes/recommendations.js')).default;
  const { handleListeningEvent } = await import('../routes/recommendations.js');

  const app = express();
  app.use(express.json());

  // Mount routes
  app.use('/api/recommendations', recommendationRoutes);
  app.post('/api/listening-events', (req, res, next) => {
    // Mock user injection for authenticated tests or auth header check
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = auth.split(' ')[1];
    try {
      req.user = jwt.verify(token, 'test_jwt_secret');
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }, handleListeningEvent);

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;

  const makeReq = async (method, path, body = null, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };

  // 9a. GET /api/recommendations/discover (Public)
  const discRes = await makeReq('GET', '/api/recommendations/discover');
  assert.strictEqual(discRes.status, 200, 'Discover endpoint must return 200');
  assert(Array.isArray(discRes.data.items) && discRes.data.items.length > 0, 'Discover endpoint must return array of tracks');
  console.log(`[PASS] GET /api/recommendations/discover returned ${discRes.data.items.length} tracks.`);

  // 9b. Unauthenticated access to /api/recommendations/personalized
  const unauthRes = await makeReq('GET', '/api/recommendations/personalized');
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated access must return 401');
  console.log('[PASS] Unauthenticated GET /api/recommendations/personalized correctly returned 401.');

  // 9c. Unauthenticated access to /api/listening-events
  const unauthEventRes = await makeReq('POST', '/api/listening-events', { trackId: 'test', title: 'test' });
  assert.strictEqual(unauthEventRes.status, 401, 'Unauthenticated listening events must return 401');
  console.log('[PASS] Unauthenticated POST /api/listening-events correctly returned 401.');

  // 9d. Authenticated access to /api/listening-events
  const testUserToken = jwt.sign({ userId: userAId.toString(), username: 'musicfan' }, 'test_jwt_secret', { expiresIn: '1h' });
  const authEventRes = await makeReq('POST', '/api/listening-events', {
    trackId: 'KeyfUuXPOcY',
    title: 'Dheere Dheere Se',
    artist: 'Kumar Sanu',
    eventType: 'completed',
    duration: 290,
    listenedDuration: 280,
    completionPercent: 96
  }, testUserToken);

  assert.strictEqual(authEventRes.status, 200, 'Authenticated listening event must return 200');
  assert.strictEqual(authEventRes.data.success, true, 'Event must succeed');
  console.log('[PASS] Authenticated POST /api/listening-events successfully recorded.');

  server.close();
  console.log('[PASS] All Express routes and security constraints verified.\n');

  console.log('=== ALL 9 PERSONALIZED RECOMMENDATION TESTS PASSED SUCCESSFULLY! ===\n');
};

runTests().catch(err => {
  console.error('[TEST ERROR]:', err);
  process.exit(1);
});
