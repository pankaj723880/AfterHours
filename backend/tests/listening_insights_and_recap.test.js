import assert from 'assert';
import mongoose from 'mongoose';
import User from '../models/User.js';
import UserListeningEvent from '../models/UserListeningEvent.js';
import { listeningEventService, getWeekStartInTimezone } from '../services/listeningEventService.js';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import profileRoutes from '../routes/profile.js';
import recommendationRoutes, { handleListeningEvent } from '../routes/recommendations.js';

const JWT_SECRET = process.env.JWT_SECRET || 'afterhours_secret_key_jwt_super_secure';

console.log('=== STARTING LOOPRA LISTENING INSIGHTS & RECAP TEST SUITE ===\n');

async function startTestServer() {
  const app = express();
  app.use(express.json());

  app.use('/api/user', profileRoutes);
  app.use('/api/recommendations', recommendationRoutes);
  app.post('/api/listening-events', authenticateToken, handleListeningEvent);

  app.get('/api/listening-stats', authenticateToken, async (req, res) => {
    try {
      const userId = req.user._id || req.user.userId || req.user.id;
      const timezone = req.query.timezone || 'UTC';
      const forceRefresh = req.query.forceRefresh === 'true';
      const stats = await listeningEventService.getListeningStats(userId, { timezone, forceRefresh });
      res.json(stats);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  return {
    server,
    baseUrl: `http://localhost:${port}`
  };
}

async function run() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours';
  await mongoose.connect(MONGODB_URI);

  const { server, baseUrl } = await startTestServer();

  try {
    // Setup test users
    const userAId = new mongoose.Types.ObjectId();
    const userBId = new mongoose.Types.ObjectId();

    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    await UserListeningEvent.deleteMany({ userId: { $in: [userAId, userBId] } });

    const userA = await User.create({ _id: userAId, username: `user_a_${Date.now()}`, password: 'hashpassword', role: 'user', status: 'active' });
    const userB = await User.create({ _id: userBId, username: `user_b_${Date.now()}`, password: 'hashpassword', role: 'user', status: 'active' });

    const tokenA = generateToken(userA);
    const tokenB = generateToken(userB);

    // --- TEST 1: User-Specific Analytics Isolation ---
    console.log('--- TEST 1: User-Specific Analytics Isolation ---');
    const sessionA1 = `ps_a1_${Date.now()}`;
    const sessionA2 = `ps_a2_${Date.now()}`;
    const sessionB1 = `ps_b1_${Date.now()}`;

    // User A listens to Track 1 (180s) and Track 2 (45s)
    await listeningEventService.recordEvent(userAId, {
      playSessionId: sessionA1,
      trackId: 'track_a1',
      title: 'Tum Hi Ho',
      artist: 'Arijit Singh',
      eventType: 'completed',
      duration: 260,
      listenedDuration: 180,
      completionPercent: 70
    });

    await listeningEventService.recordEvent(userAId, {
      playSessionId: sessionA2,
      trackId: 'track_a2',
      title: 'Lover',
      artist: 'Diljit Dosanjh',
      eventType: 'progress',
      duration: 190,
      listenedDuration: 45,
      completionPercent: 24
    });

    // User B listens to Track B1 (200s)
    await listeningEventService.recordEvent(userBId, {
      playSessionId: sessionB1,
      trackId: 'track_b1',
      title: 'Pasoori',
      artist: 'Ali Sethi',
      eventType: 'completed',
      duration: 220,
      listenedDuration: 200,
      completionPercent: 91
    });

    const statsA = await listeningEventService.getListeningStats(userAId, { forceRefresh: true });
    const statsB = await listeningEventService.getListeningStats(userBId, { forceRefresh: true });

    assert.strictEqual(statsA.userId, userAId.toString());
    assert.strictEqual(statsB.userId, userBId.toString());

    // User A should have 2 unique tracks (track_a1, track_a2) and 2 valid plays (180s & 45s both >= 30s)
    assert.strictEqual(statsA.allTimeStats.distinctTracksCount, 2);
    assert.strictEqual(statsA.allTimeStats.totalPlays, 2);
    assert.strictEqual(statsA.allTimeStats.totalListeningSeconds, 225); // 180 + 45
    assert.strictEqual(statsA.allTimeStats.longestSessionSeconds, 180);
    assert(statsA.allTimeStats.topTracks.some(t => t.id === 'track_a1' && t.artist === 'Arijit Singh'));
    assert(!statsA.allTimeStats.topTracks.some(t => t.id === 'track_b1'), 'User A must NOT have User B tracks');

    // User B should only have track_b1
    assert.strictEqual(statsB.allTimeStats.distinctTracksCount, 1);
    assert.strictEqual(statsB.allTimeStats.totalPlays, 1);
    assert.strictEqual(statsB.allTimeStats.totalListeningSeconds, 200);
    assert.strictEqual(statsB.allTimeStats.topArtists[0]?.artist, 'Ali Sethi');
    assert(!statsB.allTimeStats.topTracks.some(t => t.id === 'track_a1'), 'User B must NOT have User A tracks');

    console.log('[PASS] Full user analytics isolation verified: User A and User B stats are completely distinct.\n');

    // --- TEST 2: Playback Duration, Pause, Resume, and Progress Milestones ---
    console.log('--- TEST 2: Session Updates, Pause & Resume Exclusions ---');
    const sessionActive = `ps_session_test_${Date.now()}`;

    // Step 2a: Start track
    await listeningEventService.recordEvent(userAId, {
      playSessionId: sessionActive,
      trackId: 'track_session_1',
      title: 'Channa Mereya',
      artist: 'Arijit Singh',
      eventType: 'play_start',
      duration: 300,
      listenedDuration: 0
    });

    // Step 2b: Listen 10s (below 30s threshold -> NOT a valid completed play yet)
    await listeningEventService.recordEvent(userAId, {
      playSessionId: sessionActive,
      trackId: 'track_session_1',
      title: 'Channa Mereya',
      artist: 'Arijit Singh',
      eventType: 'progress',
      duration: 300,
      listenedDuration: 10
    });

    let midStats = await listeningEventService.getListeningStats(userAId, { forceRefresh: true });
    // Total plays should still be 2 (from Test 1), because 10s is not a valid play (< 30s)
    assert.strictEqual(midStats.allTimeStats.totalPlays, 2, 'Play < 30s must not count as valid play');
    assert.strictEqual(midStats.allTimeStats.totalListeningSeconds, 235, 'Actual 10s listened must be counted in total seconds');

    // Step 2c: User pauses
    await listeningEventService.recordEvent(userAId, {
      playSessionId: sessionActive,
      trackId: 'track_session_1',
      title: 'Channa Mereya',
      artist: 'Arijit Singh',
      eventType: 'pause',
      duration: 300,
      listenedDuration: 10
    });

    // Step 2d: User resumes and listens up to 60s
    await listeningEventService.recordEvent(userAId, {
      playSessionId: sessionActive,
      trackId: 'track_session_1',
      title: 'Channa Mereya',
      artist: 'Arijit Singh',
      eventType: 'progress',
      duration: 300,
      listenedDuration: 60
    });

    midStats = await listeningEventService.getListeningStats(userAId, { forceRefresh: true });
    // Now it reached 60s (>= 30s), so total valid plays increases from 2 to 3!
    assert.strictEqual(midStats.allTimeStats.totalPlays, 3, 'Play reaching 60s must now count as valid play');
    assert.strictEqual(midStats.allTimeStats.totalListeningSeconds, 285, 'Duration must update on the same session without duplicates');

    console.log('[PASS] Session tracking, pause/resume, and 30s valid play threshold verified.\n');

    // --- TEST 3: Timezone Calculation & Weekly Recap Boundaries ---
    console.log('--- TEST 3: Timezone Calculation & Weekly Recap ---');
    const kolkataWeekStart = getWeekStartInTimezone('Asia/Kolkata');
    const nyWeekStart = getWeekStartInTimezone('America/New_York');
    assert(kolkataWeekStart instanceof Date && !isNaN(kolkataWeekStart.getTime()), 'Kolkata week start must be valid Date');
    assert(nyWeekStart instanceof Date && !isNaN(nyWeekStart.getTime()), 'NY week start must be valid Date');

    // Verify weekly recap has activity
    assert(statsA.weeklyRecap !== null, 'Weekly recap should be populated with current week activity');
    assert.strictEqual(statsA.weeklyRecap.periodLabel, 'This Week');
    assert(statsA.weeklyRecap.totalPlays >= 2);
    assert(statsA.weeklyRecap.peakDay, 'Peak day must be calculated');
    assert(statsA.weeklyRecap.topArtists.length > 0, 'Top artists must be calculated');

    console.log('[PASS] Timezone boundaries and weekly recap metrics verified.\n');

    // --- TEST 4: HTTP Endpoints & Authentication Security ---
    console.log('--- TEST 4: HTTP API Endpoints & Security ---');

    // 4a. Unauthenticated calls must return 401
    const unauthStatsRes = await fetch(`${baseUrl}/api/listening-stats`);
    assert.strictEqual(unauthStatsRes.status, 401, 'Unauthenticated GET /api/listening-stats must return 401');

    const unauthPostRes = await fetch(`${baseUrl}/api/listening-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId: 'test', title: 'Test' })
    });
    assert.strictEqual(unauthPostRes.status, 401, 'Unauthenticated POST /api/listening-events must return 401');

    // 4b. Authenticated GET /api/user/listening-stats
    const authUserStatsRes = await fetch(`${baseUrl}/api/user/listening-stats?timezone=Asia/Kolkata&forceRefresh=true`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert.strictEqual(authUserStatsRes.status, 200, 'Authenticated GET /api/user/listening-stats must return 200');
    const userStatsData = await authUserStatsRes.json();
    assert.strictEqual(userStatsData.userId, userAId.toString());
    assert(userStatsData.allTimeStats.totalListeningSeconds > 0);

    // 4c. Authenticated GET /api/listening-stats
    const authDirectStatsRes = await fetch(`${baseUrl}/api/listening-stats?forceRefresh=true`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    assert.strictEqual(authDirectStatsRes.status, 200, 'Authenticated GET /api/listening-stats must return 200');
    const userBData = await authDirectStatsRes.json();
    assert.strictEqual(userBData.userId, userBId.toString());

    // 4d. Authenticated POST /api/listening-events
    const postEventRes = await fetch(`${baseUrl}/api/listening-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        trackId: 'track_http_1',
        title: 'Kesariya',
        artist: 'Arijit Singh',
        eventType: 'completed',
        duration: 240,
        listenedDuration: 240,
        completionPercent: 100,
        playSessionId: `ps_http_${Date.now()}`
      })
    });
    assert.strictEqual(postEventRes.status, 200, 'POST /api/listening-events must return 200');
    const postEventData = await postEventRes.json();
    assert.strictEqual(postEventData.success, true);
    assert.strictEqual(postEventData.recorded, true);

    console.log('[PASS] All API endpoints and authentication guards verified.\n');

    // Clean up test data
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    await UserListeningEvent.deleteMany({ userId: { $in: [userAId, userBId] } });

    console.log('=== ALL LOOPRA LISTENING INSIGHTS & RECAP TESTS PASSED! ===');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error('[TEST FAILURE]:', err);
  process.exit(1);
});
