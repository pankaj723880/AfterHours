import assert from 'assert';
import mongoose from 'mongoose';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from '../../frontend/node_modules/socket.io-client/build/esm/index.js';
import User from '../models/User.js';
import UserPlaybackEvent from '../models/UserPlaybackEvent.js';
import UserListeningEvent from '../models/UserListeningEvent.js';
import WebsiteUsageSession from '../models/WebsiteUsageSession.js';
import { analyticsService, cleanArtistName, isValidMusicPlay } from '../services/analyticsService.js';
import { listeningEventService } from '../services/listeningEventService.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import analyticsRoutes from '../routes/analytics.js';
import { handleListeningEvent } from '../routes/recommendations.js';

console.log('=== STARTING REAL-TIME LISTENING TELEMETRY & RECAP AUDIT TEST SUITE ===\n');

async function createAuditTestServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  app.set('io', io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (token) {
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (decoded?.userId) {
          socket.userId = decoded.userId;
          socket.join(`user_${decoded.userId}`);
        }
      }
    } catch (e) {}
    next();
  });

  app.use('/api/analytics', analyticsRoutes);
  app.post('/api/listening-events', authenticateToken, async (req, res, next) => {
    req.app_io = io;
    return handleListeningEvent(req, res, next);
  });

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  return {
    server,
    io,
    baseUrl: `http://localhost:${port}`
  };
}

async function runAudit() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours';
  await mongoose.connect(MONGODB_URI);

  const { server, baseUrl } = await createAuditTestServer();

  try {
    const userAId = new mongoose.Types.ObjectId();
    const userBId = new mongoose.Types.ObjectId();

    // Clean test records
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    await UserPlaybackEvent.deleteMany({ userId: { $in: [userAId, userBId] } });
    await UserListeningEvent.deleteMany({ userId: { $in: [userAId, userBId] } });
    await WebsiteUsageSession.deleteMany({ userId: { $in: [userAId, userBId] } });

    const userA = await User.create({ _id: userAId, username: `audita_${Date.now()}`, password: 'hash', role: 'user', status: 'active' });
    const userB = await User.create({ _id: userBId, username: `auditb_${Date.now()}`, password: 'hash', role: 'user', status: 'active' });

    const tokenA = generateToken(userA);
    const tokenB = generateToken(userB);

    // --- TEST 1: Play, Pause, Resume, Accurate Duration Tracking ---
    console.log('--- TEST 1: Play, Pause, Resume Duration Calculation ---');
    const session1 = `ps_audit_1_${Date.now()}`;

    // 1a. User A starts song and plays for 180s (3 min)
    await analyticsService.recordPlaybackEvent(userAId, {
      sessionId: session1,
      trackId: 'song_audit_1',
      songTitle: 'Kesariya',
      artistName: 'Arijit Singh - Topic',
      eventType: 'progress',
      durationSeconds: 260,
      listenedDurationSeconds: 180
    });

    let statsA = await analyticsService.getAllTimeStats(userAId, { forceRefresh: true });
    assert.strictEqual(statsA.totalListeningSeconds, 180, 'Listening duration must equal 180 seconds');
    assert.strictEqual(statsA.totalPlays, 1, '180s listen must count as 1 valid play');

    // 1b. User A pauses for 2 minutes (no additional seconds listened)
    await analyticsService.recordPlaybackEvent(userAId, {
      sessionId: session1,
      trackId: 'song_audit_1',
      songTitle: 'Kesariya',
      artistName: 'Arijit Singh - Topic',
      eventType: 'pause',
      durationSeconds: 260,
      listenedDurationSeconds: 180 // Exact same listened time
    });

    statsA = await analyticsService.getAllTimeStats(userAId, { forceRefresh: true });
    assert.strictEqual(statsA.totalListeningSeconds, 180, 'Paused time must NOT increase listening duration');

    // 1c. User A resumes and listens for another 120s (total 300s = 5 minutes)
    await analyticsService.recordPlaybackEvent(userAId, {
      sessionId: session1,
      trackId: 'song_audit_1',
      songTitle: 'Kesariya',
      artistName: 'Arijit Singh - Topic',
      eventType: 'completed',
      durationSeconds: 260,
      listenedDurationSeconds: 300,
      completed: true
    });

    statsA = await analyticsService.getAllTimeStats(userAId, { forceRefresh: true });
    assert.strictEqual(statsA.totalListeningSeconds, 300, 'Total listening duration must update to 300s (5 min)');
    assert.strictEqual(statsA.totalPlays, 1, 'Session update must NOT duplicate play count');
    console.log('✓ TEST 1 PASSED: Play, pause, resume and duration calculation are exact.\n');

    // --- TEST 2: Skip Threshold & Non-Valid Play Handling ---
    console.log('--- TEST 2: Skip Threshold & Non-Valid Play Handling ---');
    const session2 = `ps_audit_2_${Date.now()}`;
    const session3 = `ps_audit_3_${Date.now()}`;

    // 2a. Skip after 30s (meets >= 30s threshold -> valid play)
    await analyticsService.recordPlaybackEvent(userAId, {
      sessionId: session2,
      trackId: 'song_audit_2',
      songTitle: 'Lover',
      artistName: 'Diljit Dosanjh',
      eventType: 'skip',
      durationSeconds: 200,
      listenedDurationSeconds: 30
    });

    // 2b. Skip after 10s (below 30s threshold and not completed -> NOT a valid play)
    await analyticsService.recordPlaybackEvent(userAId, {
      sessionId: session3,
      trackId: 'song_audit_3',
      songTitle: 'Ghar More Pardesiya',
      artistName: 'Shreya Ghoshal',
      eventType: 'skip',
      durationSeconds: 240,
      listenedDurationSeconds: 10
    });

    statsA = await analyticsService.getAllTimeStats(userAId, { forceRefresh: true });
    // Total plays should be 2 (session1 Kesariya + session2 Lover, but NOT session3 Ghar More Pardesiya)
    assert.strictEqual(statsA.totalPlays, 2, 'Song skipped < 30s must not count as valid play');
    assert.strictEqual(statsA.totalListeningSeconds, 340, 'Duration must include all actual seconds (300 + 30 + 10 = 340s)');
    console.log('✓ TEST 2 PASSED: 30s threshold enforced strictly.\n');

    // --- TEST 3: Idempotency & Deduplication ---
    console.log('--- TEST 3: Idempotency & Duplicate Submission Protection ---');
    // Submit identical event again
    const dupeRes = await analyticsService.recordPlaybackEvent(userAId, {
      sessionId: session2,
      trackId: 'song_audit_2',
      songTitle: 'Lover',
      artistName: 'Diljit Dosanjh',
      eventType: 'skip',
      durationSeconds: 200,
      listenedDurationSeconds: 30
    });

    statsA = await analyticsService.getAllTimeStats(userAId, { forceRefresh: true });
    assert.strictEqual(statsA.totalPlays, 2, 'Duplicate event must NOT increment play count');
    assert.strictEqual(statsA.totalListeningSeconds, 340, 'Duplicate event must NOT increment listening seconds');
    console.log('✓ TEST 3 PASSED: Idempotent processing prevented duplicate ingestion.\n');

    // --- TEST 4: User-Specific Analytics Isolation ---
    console.log('--- TEST 4: Multi-User Analytics Isolation ---');
    const sessionB = `ps_audit_b_${Date.now()}`;
    await analyticsService.recordPlaybackEvent(userBId, {
      sessionId: sessionB,
      trackId: 'song_audit_b1',
      songTitle: 'Pasoori',
      artistName: 'Ali Sethi',
      eventType: 'completed',
      durationSeconds: 210,
      listenedDurationSeconds: 200,
      completed: true
    });

    const statsB = await analyticsService.getAllTimeStats(userBId, { forceRefresh: true });
    statsA = await analyticsService.getAllTimeStats(userAId, { forceRefresh: true });

    assert.strictEqual(statsB.totalPlays, 1);
    assert.strictEqual(statsB.totalListeningSeconds, 200);
    assert.strictEqual(statsB.topTracks[0]?.title, 'Pasoori');
    assert(!statsA.topTracks.some(t => t.id === 'song_audit_b1'), 'User A must not contain User B tracks');
    assert(!statsB.topTracks.some(t => t.id === 'song_audit_1'), 'User B must not contain User A tracks');
    console.log('✓ TEST 4 PASSED: User A and User B telemetry are completely isolated.\n');

    // --- TEST 5: Period-Aware Monthly & Weekly Recaps ---
    console.log('--- TEST 5: Period Isolation & Monthly Recap Date Filtering ---');
    // Target October 2026
    const octRecap = await analyticsService.getMonthlyRecap(userAId, { month: 10, year: 2026, forceRefresh: true });
    assert.strictEqual(octRecap.month, 10);
    assert.strictEqual(octRecap.year, 2026);
    assert.strictEqual(octRecap.dailyActivity.length, 31, 'October must have 31 daily activity items');
    assert.strictEqual(octRecap.totalPlays, 2, 'October valid plays must equal 2');
    assert.strictEqual(octRecap.distinctTracksCount, 2, 'Distinct tracks in October must equal 2');

    // Target September 2026 (empty period)
    const sepRecap = await analyticsService.getMonthlyRecap(userAId, { month: 9, year: 2026, forceRefresh: true });
    assert.strictEqual(sepRecap.dailyActivity.length, 30, 'September must have 30 daily activity items');
    assert.strictEqual(sepRecap.totalPlays, 0, 'September must have 0 plays');
    assert.strictEqual(sepRecap.totalHours, '0.0', 'September must have 0.0 hours');
    assert.strictEqual(sepRecap.hasData, false, 'September hasData must be false');
    console.log('✓ TEST 5 PASSED: Monthly recap has correct days, period boundaries, and empty state.\n');

    // --- TEST 6: Artist Identity & Metadata Mapping ---
    console.log('--- TEST 6: Artist Identity & Placeholder Prevention ---');
    assert.strictEqual(cleanArtistName('Arijit Singh - Topic'), 'Arijit Singh');
    assert.strictEqual(cleanArtistName('T-Series', 'Tum Hi Ho | Arijit Singh | Aashiqui 2'), 'Arijit Singh');
    assert.strictEqual(cleanArtistName(''), 'Unknown Artist');
    assert.strictEqual(cleanArtistName('A'), 'Unknown Artist');
    assert.strictEqual(cleanArtistName('Various Artists'), 'Various Artists');

    // Verify topArtists on user A has clean name and no single letter
    assert.strictEqual(statsA.topArtists[0]?.artist, 'Arijit Singh');
    assert.strictEqual(statsA.topArtists[0]?.name, 'Arijit Singh');
    assert(statsA.topArtists[0]?.percentage > 0);
    console.log('✓ TEST 6 PASSED: Artist identity cleanup and mapping verified.\n');

    // --- TEST 7: Web Usage vs Music Listening Distinction ---
    console.log('--- TEST 7: Web Usage vs Music Listening Duration ---');
    const wsSession = `ws_test_${Date.now()}`;
    await analyticsService.recordWebsiteHeartbeat(userAId, {
      sessionId: wsSession,
      activeSecondsDelta: 60,
      page: '/discover'
    });

    statsA = await analyticsService.getAllTimeStats(userAId, { forceRefresh: true });
    assert.strictEqual(statsA.totalListeningSeconds, 340, 'Music listening seconds must remain unchanged');
    assert.strictEqual(statsA.totalActiveWebsiteSeconds, 60, 'Website active seconds must be 60s');
    assert.strictEqual(statsA.totalSessions, 1);
    console.log('✓ TEST 7 PASSED: Web usage and music listening duration remain strictly separate.\n');

    // --- TEST 8: Telemetry Status & Mathematical Reconciliation ---
    console.log('--- TEST 8: Telemetry Status & Reconciliation ---');
    const overviewA = await analyticsService.getUnifiedOverview(userAId, { forceRefresh: true });
    assert.strictEqual(overviewA.telemetryStatus.isVerified, true, 'User A with genuine plays must be verified');
    assert.strictEqual(overviewA.telemetryStatus.statusText, 'Verified Data');

    // An unplayed user must show 0 plays honest status
    const emptyUserId = new mongoose.Types.ObjectId();
    const overviewEmpty = await analyticsService.getUnifiedOverview(emptyUserId, { forceRefresh: true });
    assert.strictEqual(overviewEmpty.telemetryStatus.isVerified, false);
    assert.strictEqual(overviewEmpty.telemetryStatus.statusText, 'Verified (0 Plays)');
    console.log('✓ TEST 8 PASSED: Telemetry status reflects genuine data integrity.\n');

    // --- TEST 9: HTTP Endpoints & Month Query Support ---
    console.log('--- TEST 9: HTTP REST API & Query Filtering ---');
    const authHeaders = {
      'Authorization': `Bearer ${tokenA}`,
      'Content-Type': 'application/json'
    };

    const resMonthly = await fetch(`${baseUrl}/api/analytics/monthly?month=10&year=2026&forceRefresh=true`, { headers: authHeaders });
    assert.strictEqual(resMonthly.status, 200);
    const monthlyJson = await resMonthly.json();
    assert.strictEqual(monthlyJson.monthlyRecap.totalPlays, 2);
    assert.strictEqual(monthlyJson.monthlyRecap.dailyActivity.length, 31);

    const resTopSongsMonthly = await fetch(`${baseUrl}/api/analytics/top-songs?range=monthly&month=10&year=2026`, { headers: authHeaders });
    assert.strictEqual(resTopSongsMonthly.status, 200);
    const topSongsJson = await resTopSongsMonthly.json();
    assert.strictEqual(topSongsJson.topSongs.length, 2);
    console.log('✓ TEST 9 PASSED: HTTP API monthly queries work flawlessly.\n');

    // --- TEST 10: Real-Time Socket.IO Notification ---
    console.log('--- TEST 10: Real-Time Socket.IO Telemetry Notification ---');
    const socket = ioClient(baseUrl, {
      auth: { token: tokenA },
      transports: ['websocket']
    });

    await new Promise((resolve) => {
      socket.on('connect', resolve);
    });

    let receivedSocketEvent = null;
    socket.on('listening_stats_updated', (data) => {
      receivedSocketEvent = data;
    });

    // Post new playback event via HTTP
    await fetch(`${baseUrl}/api/listening-events`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        trackId: 'song_audit_live_1',
        title: 'Apna Bana Le',
        artist: 'Arijit Singh',
        eventType: 'completed',
        duration: 250,
        listenedDuration: 250,
        completionPercent: 100,
        playSessionId: `ps_live_${Date.now()}`
      })
    });

    // Wait for socket broadcast
    await new Promise(r => setTimeout(r, 600));
    assert(receivedSocketEvent !== null, 'Socket must receive listening_stats_updated broadcast');
    assert.strictEqual(receivedSocketEvent.userId, userAId.toString());
    assert.strictEqual(receivedSocketEvent.trackId, 'song_audit_live_1');
    socket.disconnect();
    console.log('✓ TEST 10 PASSED: Real-time Socket.IO notification verified.\n');

    // Clean up
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    await UserPlaybackEvent.deleteMany({ userId: { $in: [userAId, userBId] } });
    await UserListeningEvent.deleteMany({ userId: { $in: [userAId, userBId] } });
    await WebsiteUsageSession.deleteMany({ userId: { $in: [userAId, userBId] } });

    console.log('===============================================================');
    console.log('ALL 10 REAL-TIME LISTENING TELEMETRY AUDIT TESTS PASSED 100%!');
    console.log('===============================================================');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runAudit().catch(err => {
  console.error('[AUDIT TEST FAILURE]:', err);
  process.exit(1);
});
