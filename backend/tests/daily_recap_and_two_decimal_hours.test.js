import assert from 'assert';
import mongoose from 'mongoose';
import express from 'express';
import http from 'http';
import User from '../models/User.js';
import UserPlaybackEvent from '../models/UserPlaybackEvent.js';
import UserListeningEvent from '../models/UserListeningEvent.js';
import { analyticsService, formatHours, getDayBoundsInTimezone } from '../services/analyticsService.js';
import analyticsRoutes from '../routes/analytics.js';
import { generateToken } from '../middleware/auth.js';

console.log('=== STARTING DAILY RECAP & TWO-DECIMAL HOURS TEST SUITE ===\n');

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', analyticsRoutes);

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
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGODB_URI);
  }

  const { server, baseUrl } = await startTestServer();

  try {
    // -------------------------------------------------------------
    // UNIT TEST 1: Two-Decimal Hour Formatting Precision
    // -------------------------------------------------------------
    console.log('--- TEST 1: Two-Decimal Hour Precision Calculations ---');
    assert.strictEqual(formatHours(0), '0.00', '0s should format to 0.00');
    assert.strictEqual(formatHours(30), '0.01', '30s should format to 0.01');
    assert.strictEqual(formatHours(60), '0.02', '60s should format to 0.02');
    assert.strictEqual(formatHours(300), '0.08', '300s (5 min) should format to 0.08');
    assert.strictEqual(formatHours(1800), '0.50', '1800s (30 min) should format to 0.50');
    assert.strictEqual(formatHours(3600), '1.00', '3600s (1 hr) should format to 1.00');
    assert.strictEqual(formatHours(9000), '2.50', '9000s (2.5 hr) should format to 2.50');
    console.log('✓ formatHours passes all precision benchmarks (0.00, 0.01, 0.02, 0.08, 0.50, 1.00, 2.50)');

    // -------------------------------------------------------------
    // UNIT TEST 2: Timezone & Calendar Boundaries
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Timezone and Day Boundaries ---');
    const utcBounds = getDayBoundsInTimezone('UTC');
    assert.ok(utcBounds.startOfDay instanceof Date, 'startOfDay should be a Date');
    assert.ok(utcBounds.endOfDay instanceof Date, 'endOfDay should be a Date');
    assert.strictEqual(utcBounds.endOfDay.getTime() - utcBounds.startOfDay.getTime(), 86400000 - 1, 'Day span must be 24h - 1ms');

    const istBounds = getDayBoundsInTimezone('Asia/Kolkata');
    assert.strictEqual(istBounds.endOfDay.getTime() - istBounds.startOfDay.getTime(), 86400000 - 1, 'IST Day span must be 24h - 1ms');
    console.log('✓ Timezone day boundary calculations validated');

    // -------------------------------------------------------------
    // INTEGRATION TEST 3: Daily Recap & Lifetime Listening Hours Fix
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Lifetime Hours Fix & Daily Recap End-to-End ---');
    const testUserAId = new mongoose.Types.ObjectId();
    const testUserBId = new mongoose.Types.ObjectId();

    await User.deleteMany({ _id: { $in: [testUserAId, testUserBId] } });
    await UserPlaybackEvent.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
    await UserListeningEvent.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });

    const userA = await User.create({
      _id: testUserAId,
      username: `daily_user_a_${Date.now()}`,
      password: 'password123',
      role: 'user',
      status: 'active'
    });
    const userB = await User.create({
      _id: testUserBId,
      username: `daily_user_b_${Date.now()}`,
      password: 'password123',
      role: 'user',
      status: 'active'
    });

    const tokenA = generateToken(userA);
    const tokenB = generateToken(userB);

    // Record verified plays for User A today:
    // Play 1: Track 1 (Kesariya - Arijit Singh), 300 seconds (5 min) => 0.08h
    await analyticsService.recordPlaybackEvent(testUserAId, {
      sessionId: `sess_a1_${Date.now()}`,
      trackId: 'track_kesariya',
      title: 'Kesariya',
      artist: 'Arijit Singh',
      durationSeconds: 260,
      listenedDurationSeconds: 300,
      completed: true
    });

    // Play 2: Track 2 (Tum Hi Ho - Arijit Singh), 180 seconds (3 min) => 0.05h
    await analyticsService.recordPlaybackEvent(testUserAId, {
      sessionId: `sess_a2_${Date.now()}`,
      trackId: 'track_tumhiho',
      title: 'Tum Hi Ho',
      artist: 'Arijit Singh',
      durationSeconds: 240,
      listenedDurationSeconds: 180,
      completed: false
    });

    // Play 3: Track 3 (Pasoori - Ali Sethi), 120 seconds (2 min) => 0.03h
    await analyticsService.recordPlaybackEvent(testUserAId, {
      sessionId: `sess_a3_${Date.now()}`,
      trackId: 'track_pasoori',
      title: 'Pasoori',
      artist: 'Ali Sethi',
      durationSeconds: 210,
      listenedDurationSeconds: 120,
      completed: true
    });

    // Total listened seconds for User A = 300 + 180 + 120 = 600 seconds = 0.1666... hours => "0.17"
    // Valid plays = 3, Unique tracks = 3, Top artist = Arijit Singh (2 plays)

    // Test getDailyRecap directly
    const dailyRecapA = await analyticsService.getDailyRecap(testUserAId, { timezone: 'UTC', forceRefresh: true });
    assert.strictEqual(dailyRecapA.totalPlays, 3, 'User A should have 3 total verified plays today');
    assert.strictEqual(dailyRecapA.distinctTracksCount, 3, 'User A should have 3 distinct tracks');
    assert.strictEqual(dailyRecapA.totalListeningSeconds, 600, 'User A total seconds should be 600s');
    assert.strictEqual(dailyRecapA.totalHours, '0.17', '600s / 3600 formatted to 2 decimals should be 0.17h');
    assert.strictEqual(dailyRecapA.hourlyActivity.length, 24, 'Hourly activity should contain exactly 24 buckets (0..23)');
    assert.ok(dailyRecapA.peakHour !== 'None', 'Peak hour should be detected');
    assert.ok(dailyRecapA.dailySummary.includes('0.17 hours across 3 verified plays'), `Daily summary should describe actual stats. Got: ${dailyRecapA.dailySummary}`);
    console.log('✓ getDailyRecap calculated correctly for User A:', {
      totalHours: dailyRecapA.totalHours,
      totalPlays: dailyRecapA.totalPlays,
      peakHour: dailyRecapA.peakHour,
      summary: dailyRecapA.dailySummary
    });

    // Test All-Time Stats for User A (Lifetime Hours check)
    const allTimeA = await analyticsService.getAllTimeStats(testUserAId, { timezone: 'UTC', forceRefresh: true });
    assert.strictEqual(allTimeA.totalHours, '0.17', 'Lifetime hours must match genuine playback duration with 2 decimal precision (0.17h)');
    assert.strictEqual(allTimeA.totalPlays, 3, 'Lifetime plays should be 3');
    assert.strictEqual(allTimeA.uniqueTracks, 3, 'Lifetime unique tracks should be 3');
    console.log('✓ Lifetime listening hours correctly shows 0.17h (not 0.0h or 0.00h!)');

    // -------------------------------------------------------------
    // TEST 4: User B Isolation
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: User B Isolation ---');
    const dailyRecapB = await analyticsService.getDailyRecap(testUserBId, { timezone: 'UTC', forceRefresh: true });
    assert.strictEqual(dailyRecapB.totalPlays, 0, 'User B must have 0 plays');
    assert.strictEqual(dailyRecapB.totalHours, '0.00', 'User B hours must be exactly 0.00');
    assert.strictEqual(dailyRecapB.distinctTracksCount, 0, 'User B distinct tracks must be 0');
    assert.strictEqual(dailyRecapB.peakHour, 'None', 'User B peak hour must be None');
    assert.ok(dailyRecapB.dailySummary.includes('No music listened to yet today'), 'User B should receive friendly empty summary');
    console.log('✓ Multi-user isolation verified: User B has 0.00h and 0 plays');

    // -------------------------------------------------------------
    // TEST 5: Express REST API Endpoints Verification
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: REST API Endpoints ---');

    // 5a. GET /api/analytics/daily
    const resDaily = await fetch(`${baseUrl}/api/analytics/daily`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(resDaily.status, 200, 'GET /api/analytics/daily should return 200');
    const bodyDaily = await resDaily.json();
    assert.strictEqual(bodyDaily.success, true);
    assert.strictEqual(bodyDaily.dailyRecap.totalHours, '0.17');
    assert.strictEqual(bodyDaily.dailyRecap.totalPlays, 3);
    console.log('✓ GET /api/analytics/daily returned verified response');

    // 5b. GET /api/analytics/overview (includes dailyRecap)
    const resOverview = await fetch(`${baseUrl}/api/analytics/overview`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(resOverview.status, 200, 'GET /api/analytics/overview should return 200');
    const bodyOverview = await resOverview.json();
    assert.strictEqual(bodyOverview.success, true);
    assert.ok(bodyOverview.dailyRecap, 'Overview must contain dailyRecap');
    assert.strictEqual(bodyOverview.dailyRecap.totalHours, '0.17');
    assert.strictEqual(bodyOverview.allTimeStats.totalHours, '0.17');
    assert.strictEqual(bodyOverview.telemetryStatus.totalHours, '0.17');
    console.log('✓ GET /api/analytics/overview contains dailyRecap and 2-decimal hours');

    // 5c. GET /api/analytics/top-songs?range=daily
    const resTopSongs = await fetch(`${baseUrl}/api/analytics/top-songs?range=daily`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(resTopSongs.status, 200);
    const bodyTopSongs = await resTopSongs.json();
    assert.strictEqual(bodyTopSongs.success, true);
    assert.strictEqual(bodyTopSongs.topSongs.length, 3);
    console.log('✓ GET /api/analytics/top-songs?range=daily returned today tracks');

    // 5d. GET /api/analytics/top-artists?range=daily
    const resTopArtists = await fetch(`${baseUrl}/api/analytics/top-artists?range=daily`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(resTopArtists.status, 200);
    const bodyTopArtists = await resTopArtists.json();
    assert.strictEqual(bodyTopArtists.success, true);
    assert.strictEqual(bodyTopArtists.topArtists[0].artist, 'Arijit Singh');
    console.log('✓ GET /api/analytics/top-artists?range=daily returned Arijit Singh as #1');

    // Clean up test data
    await User.deleteMany({ _id: { $in: [testUserAId, testUserBId] } });
    await UserPlaybackEvent.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
    await UserListeningEvent.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===\n');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

run()
  .then(() => {
    console.log('Test completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });
