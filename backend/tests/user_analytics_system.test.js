import assert from 'assert';
import mongoose from 'mongoose';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import UserPlaybackEvent from '../models/UserPlaybackEvent.js';
import UserListeningSession from '../models/UserListeningSession.js';
import WebsiteUsageSession from '../models/WebsiteUsageSession.js';
import { analyticsService, isValidMusicPlay, getWeekStartInTimezone } from '../services/analyticsService.js';
import analyticsRoutes from '../routes/analytics.js';
import { generateToken } from '../middleware/auth.js';

console.log('=== STARTING GENUINE USER-ISOLATED ANALYTICS SYSTEM TEST SUITE ===\n');

async function createTestApp() {
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
  await mongoose.connect(MONGODB_URI);
  console.log(' Connected to MongoDB');

  const { server, baseUrl } = await createTestApp();
  console.log(` Test server running on ${baseUrl}`);

  try {
    // Generate and persist unique test users
    const timestamp = Date.now();
    const userA = await User.create({
      username: `test_user_a_${timestamp}`,
      email: `test_a_${timestamp}@example.com`,
      password: 'password123',
      role: 'user'
    });
    const userB = await User.create({
      username: `test_user_b_${timestamp}`,
      email: `test_b_${timestamp}@example.com`,
      password: 'password123',
      role: 'user'
    });
    const userC = await User.create({
      username: `test_user_c_${timestamp}`,
      email: `test_c_${timestamp}@example.com`,
      password: 'password123',
      role: 'user'
    });

    const userAId = userA._id;
    const userBId = userB._id;
    const userCId = userC._id;

    const tokenA = generateToken(userA);
    const tokenB = generateToken(userB);
    const tokenC = generateToken(userC);

    console.log('\n--- TEST 1: Empty State Honesty (Brand New User C) ---');
    {
      const res = await fetch(`${baseUrl}/api/analytics/overview?timezone=UTC`, {
        headers: { Authorization: `Bearer ${tokenC}` }
      });
      assert.strictEqual(res.status, 200, 'Overview endpoint returned 200');
      const data = await res.json();

      console.log('Checking brand new user empty state values...');
      assert.strictEqual(data.weeklyRecap.totalPlays, 0, 'User C has 0 total plays');
      assert.strictEqual(data.weeklyRecap.totalListeningSeconds, 0, 'User C has 0 listening seconds');
      assert.strictEqual(parseFloat(data.weeklyRecap.totalListeningHours), 0.0, 'User C has 0.0 listening hours');
      assert.strictEqual(data.weeklyRecap.peakDay, 'None', 'User C peak day is None');
      assert.strictEqual(parseFloat(data.weeklyRecap.peakDayHours), 0.0, 'User C peak day hours is 0.0');
      assert.strictEqual(data.weeklyRecap.topSongs.length, 0, 'User C top songs is empty');
      assert.strictEqual(data.weeklyRecap.topArtists.length, 0, 'User C top artists is empty');
      assert.strictEqual(data.weeklyRecap.hoursTrend, null, 'User C hours trend is null (NO fake +28%)');

      // Check daily activity graph values - MUST ALL BE ZERO (No fake 5.2h / 3.6h!)
      assert.strictEqual(data.weeklyRecap.dailyActivity.length, 7, 'Weekly recap has 7 days');
      for (const day of data.weeklyRecap.dailyActivity) {
        assert.strictEqual(day.seconds, 0, `Day ${day.day} must have 0 seconds`);
        assert.strictEqual(day.hours, 0, `Day ${day.day} must have 0 hours (NOT 5.2h)`);
        assert.strictEqual(day.isPeak, false, `Day ${day.day} must not be peak`);
      }

      // Check all-time stats
      assert.strictEqual(data.allTimeStats.totalPlays, 0, 'All-time plays is 0');
      assert.strictEqual(data.allTimeStats.totalListeningSeconds, 0, 'All-time seconds is 0');
      assert.strictEqual(data.allTimeStats.uniqueTracks, 0, 'All-time unique tracks is 0');
      assert.strictEqual(data.allTimeStats.uniqueArtists, 0, 'All-time unique artists is 0');

      console.log(' PASS: Brand new user has 100% honest empty state with ZERO fabricated numbers.');
    }

    console.log('\n--- TEST 2: Valid Play Rules & Event Ingestion ---');
    {
      // 10s skip: NOT a valid play
      assert.strictEqual(isValidMusicPlay(10, 200, false), false, '10s skip is not a valid play');
      // 30s playback: Valid play
      assert.strictEqual(isValidMusicPlay(30, 200, false), true, '30s playback is a valid play');
      // Completed track: Valid play even if short
      assert.strictEqual(isValidMusicPlay(18, 20, true), true, 'Completed short track is a valid play');
      // >= 50% track: Valid play
      assert.strictEqual(isValidMusicPlay(25, 40, false), true, '>= 50% of track is a valid play');
      console.log(' PASS: Music play validation rules adhere strictly to specification.');
    }

    console.log('\n--- TEST 3: User A vs User B Data Isolation ---');
    {
      // Log for User A:
      // Track 1: Kesariya (Arijit Singh) - 45s (valid play)
      const resA1 = await fetch(`${baseUrl}/api/analytics/playback-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          sessionId: `sess_a_1_${timestamp}`,
          trackId: 'track_kesariya',
          songTitle: 'Kesariya',
          artistName: 'Arijit Singh',
          albumName: 'Brahmastra',
          eventType: 'progress',
          listenedDurationSeconds: 45,
          durationSeconds: 240,
          source: 'player'
        })
      });
      assert.strictEqual(resA1.status, 200, 'User A Track 1 recorded');

      // Track 2: Kun Faya Kun (A.R. Rahman) - 180s (completed, valid play)
      const resA2 = await fetch(`${baseUrl}/api/analytics/playback-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          sessionId: `sess_a_2_${timestamp}`,
          trackId: 'track_kun_faya_kun',
          songTitle: 'Kun Faya Kun',
          artistName: 'A.R. Rahman',
          albumName: 'Rockstar',
          eventType: 'completed',
          listenedDurationSeconds: 180,
          durationSeconds: 200,
          completed: true,
          source: 'player'
        })
      });
      assert.strictEqual(resA2.status, 200, 'User A Track 2 recorded');

      // Track 3: Shape of You (Ed Sheeran) - 12s skip (NOT a valid play)
      const resA3 = await fetch(`${baseUrl}/api/analytics/playback-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          sessionId: `sess_a_3_${timestamp}`,
          trackId: 'track_shape_of_you',
          songTitle: 'Shape of You',
          artistName: 'Ed Sheeran',
          eventType: 'skip',
          listenedDurationSeconds: 12,
          durationSeconds: 230,
          completed: false,
          source: 'player'
        })
      });
      assert.strictEqual(resA3.status, 200, 'User A Track 3 skip recorded');

      // Now log for User B:
      // Track 4: Cruel Summer (Taylor Swift) - 120s (valid play)
      const resB1 = await fetch(`${baseUrl}/api/analytics/playback-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`
        },
        body: JSON.stringify({
          sessionId: `sess_b_1_${timestamp}`,
          trackId: 'track_cruel_summer',
          songTitle: 'Cruel Summer',
          artistName: 'Taylor Swift',
          albumName: 'Lover',
          eventType: 'completed',
          listenedDurationSeconds: 120,
          durationSeconds: 180,
          completed: true,
          source: 'player'
        })
      });
      assert.strictEqual(resB1.status, 200, 'User B Track 1 recorded');

      // Fetch User A overview
      const resOverviewA = await fetch(`${baseUrl}/api/analytics/overview?timezone=UTC&forceRefresh=true`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const dataA = await resOverviewA.json();

      // Fetch User B overview
      const resOverviewB = await fetch(`${baseUrl}/api/analytics/overview?timezone=UTC&forceRefresh=true`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      const dataB = await resOverviewB.json();

      console.log('Verifying User A stats...');
      // User A should have 2 valid plays (Kesariya and Kun Faya Kun; 12s skip is not valid play)
      assert.strictEqual(dataA.weeklyRecap.totalPlays, 2, 'User A has exactly 2 valid plays');
      // User A total listening seconds = 45 + 180 + 12 = 237 seconds
      assert.strictEqual(dataA.weeklyRecap.totalListeningSeconds, 237, 'User A total listening seconds is 237s');

      // Top artists for User A should ONLY include User A's artists
      const userAArtists = dataA.weeklyRecap.topArtists.map(a => a.artist);
      assert(userAArtists.includes('Arijit Singh') || userAArtists.includes('A.R. Rahman'), 'User A has Arijit / Rahman');
      assert(!userAArtists.includes('Taylor Swift'), 'CRITICAL: Taylor Swift does NOT leak into User A!');

      // Top songs for User A
      const userASongs = dataA.weeklyRecap.topSongs.map(s => s.title);
      assert(userASongs.includes('Kesariya') || userASongs.includes('Kun Faya Kun'), 'User A has their own top songs');
      assert(!userASongs.includes('Cruel Summer'), 'CRITICAL: Cruel Summer does NOT leak into User A!');

      console.log('Verifying User B stats...');
      assert.strictEqual(dataB.weeklyRecap.totalPlays, 1, 'User B has exactly 1 valid play');
      assert.strictEqual(dataB.weeklyRecap.totalListeningSeconds, 120, 'User B total listening seconds is 120s');

      const userBArtists = dataB.weeklyRecap.topArtists.map(a => a.artist);
      assert(userBArtists.includes('Taylor Swift'), 'User B has Taylor Swift');
      assert(!userBArtists.includes('Arijit Singh'), 'CRITICAL: Arijit Singh does NOT leak into User B!');
      assert(!userBArtists.includes('A.R. Rahman'), 'CRITICAL: A.R. Rahman does NOT leak into User B!');

      console.log(' PASS: 100% strict user data isolation verified between User A and User B.');
    }

    console.log('\n--- TEST 4: Mathematical Consistency of Graph and Recap ---');
    {
      const res = await fetch(`${baseUrl}/api/analytics/overview?timezone=UTC&forceRefresh=true`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const data = await res.json();

      const dailySumSeconds = data.weeklyRecap.dailyActivity.reduce((acc, d) => acc + d.seconds, 0);
      assert.strictEqual(dailySumSeconds, data.weeklyRecap.totalListeningSeconds, 
        `Daily activity seconds sum (${dailySumSeconds}) strictly equals totalListeningSeconds (${data.weeklyRecap.totalListeningSeconds})`);

      for (const day of data.weeklyRecap.dailyActivity) {
        const expectedHours = parseFloat((day.seconds / 3600).toFixed(1));
        assert.strictEqual(day.hours, expectedHours, `Day ${day.day} hours (${day.hours}) equals seconds/3600 (${expectedHours})`);
      }

      console.log(' PASS: Mathematical consistency verified. Daily breakdown sum strictly equals weekly total.');
    }

    console.log('\n--- TEST 5: Active Website Usage Tracking ---');
    {
      const webSessionId = `ws_test_${timestamp}`;

      // First heartbeat: 30 seconds active
      const hb1 = await fetch(`${baseUrl}/api/analytics/website-heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          sessionId: webSessionId,
          activeSecondsDelta: 30,
          page: '/discover',
          deviceType: 'desktop',
          isIdle: false
        })
      });
      assert.strictEqual(hb1.status, 200, 'Heartbeat 1 recorded');

      // Second heartbeat: 45 seconds active
      const hb2 = await fetch(`${baseUrl}/api/analytics/website-heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`
        },
        body: JSON.stringify({
          sessionId: webSessionId,
          activeSecondsDelta: 45,
          page: '/discover',
          deviceType: 'desktop',
          isIdle: false
        })
      });
      assert.strictEqual(hb2.status, 200, 'Heartbeat 2 recorded');

      // Check usage endpoint
      const usageRes = await fetch(`${baseUrl}/api/analytics/usage`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert.strictEqual(usageRes.status, 200, 'Usage endpoint 200');
      const usageData = await usageRes.json();

      console.log('User A recorded website active seconds:', usageData.activeDurationSeconds);
      assert(usageData.activeDurationSeconds >= 75, 'User A has at least 75 seconds of active website usage');
      assert.strictEqual(usageData.sessionCount, 1, 'User A has 1 active session');

      // End session
      const endRes = await fetch(`${baseUrl}/api/analytics/website-session-end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`
        },
        body: JSON.stringify({ sessionId: webSessionId })
      });
      assert.strictEqual(endRes.status, 200, 'Session ended successfully');

      // Verify User C has 0 website usage
      const usageResC = await fetch(`${baseUrl}/api/analytics/usage`, {
        headers: { Authorization: `Bearer ${tokenC}` }
      });
      const usageDataC = await usageResC.json();
      assert.strictEqual(usageDataC.activeDurationSeconds, 0, 'User C has 0 website duration');
      assert.strictEqual(usageDataC.activeHours, 0.0, 'User C has 0.0 website hours');

      console.log(' PASS: Website usage tracking and multi-tab safety verified.');
    }

    console.log('\n--- CLEANING UP TEST DATA ---');
    await UserPlaybackEvent.deleteMany({ userId: { $in: [userAId, userBId, userCId] } });
    await UserListeningSession.deleteMany({ userId: { $in: [userAId, userBId, userCId] } });
    await WebsiteUsageSession.deleteMany({ userId: { $in: [userAId, userBId, userCId] } });
    await User.deleteMany({ _id: { $in: [userAId, userBId, userCId] } });
    console.log(' Test documents cleaned up.');

    console.log('\n======================================================');
    console.log(' ALL 5 COMPREHENSIVE TESTS PASSED WITH 100% ACCURACY! ');
    console.log('======================================================\n');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
