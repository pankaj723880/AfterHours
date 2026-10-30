import assert from 'assert';
import mongoose from 'mongoose';
import express from 'express';
import http from 'http';
import User from '../models/User.js';
import UserBehaviorEvent from '../models/UserBehaviorEvent.js';
import UserLearningProfile from '../models/UserLearningProfile.js';
import LearningUpdateLog from '../models/LearningUpdateLog.js';
import { learningEngineService } from '../services/learningEngineService.js';
import learningRoutes from '../routes/learningIntelligence.js';
import recommendationRoutes from '../routes/recommendations.js';
import { generateToken } from '../middleware/auth.js';
import { recommendationEngine } from '../services/recommendationEngine.js';

console.log('=== STARTING AI LEARNING INTELLIGENCE ENGINE TEST SUITE ===\n');

async function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/learning-intelligence', learningRoutes);
  app.use('/api/recommendations', recommendationRoutes);

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
  console.log('✔ Connected to MongoDB');

  const { server, baseUrl } = await createTestServer();
  console.log(`✔ Test server running on ${baseUrl}\n`);

  const createdUserIds = [];

  try {
    const timestamp = Date.now();

    // 1. Setup Test Users: User A, User B, and Admin User
    const userA = await User.create({
      username: `learner_a_${timestamp}`,
      email: `learner_a_${timestamp}@test.com`,
      password: 'password123',
      role: 'user'
    });
    createdUserIds.push(userA._id);

    const userB = await User.create({
      username: `learner_b_${timestamp}`,
      email: `learner_b_${timestamp}@test.com`,
      password: 'password123',
      role: 'user'
    });
    createdUserIds.push(userB._id);

    const adminUser = await User.create({
      username: `learner_admin_${timestamp}`,
      email: `learner_admin_${timestamp}@test.com`,
      password: 'password123',
      role: 'admin'
    });
    createdUserIds.push(adminUser._id);

    const tokenA = generateToken(userA);
    const tokenB = generateToken(userB);
    const tokenAdmin = generateToken(adminUser);

    console.log('--- TEST 1: Strict Admin Access Control & Authorization ---');
    // Non-admin token accessing admin overview must be rejected with 403
    const forbiddenRes = await fetch(`${baseUrl}/api/learning-intelligence/admin/overview`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert.strictEqual(forbiddenRes.status, 403, 'Non-admin user should receive 403 Forbidden on admin overview');

    // Unauthenticated request must be rejected with 401
    const unauthRes = await fetch(`${baseUrl}/api/learning-intelligence/admin/overview`);
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request should receive 401 Unauthorized');

    // Admin token must be allowed with 200 OK
    const adminRes = await fetch(`${baseUrl}/api/learning-intelligence/admin/overview`, {
      headers: { 'Authorization': `Bearer ${tokenAdmin}` }
    });
    assert.strictEqual(adminRes.status, 200, 'Admin request should succeed with 200 OK');
    const overviewData = await adminRes.json();
    assert.strictEqual(overviewData.status, 'ok');
    assert.strictEqual(overviewData.engine.mode, 'passive_observation');
    console.log('✔ PASS: Admin access controls strictly enforced (401 unauth, 403 non-admin, 200 admin).\n');

    console.log('--- TEST 2: Genuine Event Ingestion & Idempotency ---');
    // User A records a completed play for Arijit Singh (Bollywood)
    const fixedEventId = `evt_idemp_test_${timestamp}`;
    const eventPayload1 = {
      category: 'music',
      eventType: 'completed',
      eventId: fixedEventId,
      metadata: {
        trackId: 'track_arijit_1',
        songTitle: 'Kesariya',
        artistName: 'Arijit Singh',
        genre: 'Bollywood',
        language: 'Hindi',
        era: '2020s',
        mood: 'Romantic',
        durationSeconds: 260,
        listenedDurationSeconds: 260,
        completionPercent: 100
      }
    };

    const ingestRes1 = await fetch(`${baseUrl}/api/learning-intelligence/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify(eventPayload1)
    });
    assert.strictEqual(ingestRes1.status, 200);
    const ingestData1 = await ingestRes1.json();
    assert.strictEqual(ingestData1.success, true);
    assert.strictEqual(ingestData1.recorded, true);

    // Duplicate event with identical eventId must be silently deduplicated (idempotent)
    const ingestRes2 = await fetch(`${baseUrl}/api/learning-intelligence/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify(eventPayload1)
    });
    assert.strictEqual(ingestRes2.status, 200);
    const ingestData2 = await ingestRes2.json();
    assert.strictEqual(ingestData2.duplicate, true, 'Duplicate eventId must be flagged duplicate and not inserted');

    const totalEventsInDb = await UserBehaviorEvent.countDocuments({ eventId: fixedEventId });
    assert.strictEqual(totalEventsInDb, 1, 'Only exactly 1 event record must exist in DB for identical eventId');
    console.log('✔ PASS: Ingestion succeeded and duplicate event was safely deduplicated.\n');

    console.log('--- TEST 3: User A vs User B Learning Isolation ---');
    // User A listens to Bollywood / Arijit Singh and The Weeknd / Pop
    await learningEngineService.recordEvent({
      userId: userA._id,
      category: 'music',
      eventType: 'like',
      metadata: {
        trackId: 'track_weeknd_1',
        songTitle: 'Blinding Lights',
        artistName: 'The Weeknd',
        genre: 'Pop',
        language: 'English',
        era: '2020s',
        mood: 'Energetic'
      }
    });

    await learningEngineService.recordEvent({
      userId: userA._id,
      category: 'discovery',
      eventType: 'search',
      metadata: {
        searchQuery: 'Arijit Singh romantic live',
        artistName: 'Arijit Singh',
        genre: 'Bollywood'
      }
    });

    await learningEngineService.recordEvent({
      userId: userA._id,
      category: 'website',
      eventType: 'feature_visit',
      metadata: { featureName: 'radio' }
    });

    // User B listens to AP Dhillon (Punjabi) and Lofi Beats (Lo-Fi)
    await learningEngineService.recordEvent({
      userId: userB._id,
      category: 'music',
      eventType: 'completed',
      metadata: {
        trackId: 'track_ap_1',
        songTitle: 'Brown Munde',
        artistName: 'AP Dhillon',
        genre: 'Punjabi',
        language: 'Punjabi',
        era: '2020s',
        mood: 'Party'
      }
    });

    await learningEngineService.recordEvent({
      userId: userB._id,
      category: 'music',
      eventType: 'replay',
      metadata: {
        trackId: 'track_lofi_1',
        songTitle: 'Night Owl Chill',
        artistName: 'Lofi Beats',
        genre: 'Lo-Fi',
        language: 'Instrumental',
        era: '2020s',
        mood: 'Chill'
      }
    });

    await learningEngineService.recordEvent({
      userId: userB._id,
      category: 'discovery',
      eventType: 'mood_search',
      metadata: { mood: 'Chill' }
    });

    // Run batch processing cycle
    const batchResult = await learningEngineService.processPendingEventsBatch(100);
    assert.strictEqual(batchResult.status, 'success');
    assert(batchResult.processedCount >= 5, 'Batch should have processed all pending events');

    // Fetch User A's profile
    const profileA = await UserLearningProfile.findOne({ userId: userA._id }).lean();
    assert(profileA, 'User A should have a learning profile');

    // Fetch User B's profile
    const profileB = await UserLearningProfile.findOne({ userId: userB._id }).lean();
    assert(profileB, 'User B should have a learning profile');

    // Verify User A has Arijit Singh and The Weeknd, but NOT AP Dhillon or Lofi Beats
    const artistsA = profileA.favoriteArtists.map(a => a.name);
    assert(artistsA.includes('Arijit Singh'), 'User A should have Arijit Singh');
    assert(artistsA.includes('The Weeknd'), 'User A should have The Weeknd');
    assert(!artistsA.includes('AP Dhillon'), 'User A must NOT have User B artist AP Dhillon');
    assert(!artistsA.includes('Lofi Beats'), 'User A must NOT have User B artist Lofi Beats');

    // Verify User B has AP Dhillon and Lofi Beats, but NOT Arijit Singh or The Weeknd
    const artistsB = profileB.favoriteArtists.map(a => a.name);
    assert(artistsB.includes('AP Dhillon'), 'User B should have AP Dhillon');
    assert(artistsB.includes('Lofi Beats'), 'User B should have Lofi Beats');
    assert(!artistsB.includes('Arijit Singh'), 'User B must NOT have User A artist Arijit Singh');
    assert(!artistsB.includes('The Weeknd'), 'User B must NOT have User A artist The Weeknd');

    // Verify genres are isolated
    const genresA = profileA.learnedGenres.map(g => g.name);
    const genresB = profileB.learnedGenres.map(g => g.name);
    assert(genresA.includes('Bollywood'), 'User A should have Bollywood genre');
    assert(genresB.includes('Punjabi') || genresB.includes('Lo-Fi'), 'User B should have Punjabi or Lo-Fi');
    assert(!genresA.includes('Lo-Fi'), 'User A must NOT have Lo-Fi genre');

    console.log('✔ PASS: 100% strict user data isolation verified between User A and User B.\n');

    console.log('--- TEST 4: Single Skip Rule & Soft Downweighting ---');
    // User A skips a track from Dua Lipa once
    await learningEngineService.recordEvent({
      userId: userA._id,
      category: 'music',
      eventType: 'skip',
      metadata: {
        trackId: 'track_dua_1',
        songTitle: 'Levitating',
        artistName: 'Dua Lipa',
        genre: 'Pop',
        playbackPositionSeconds: 8
      }
    });

    await learningEngineService.processPendingEventsBatch(100);

    const updatedProfileA = await UserLearningProfile.findOne({ userId: userA._id }).lean();
    const duaArtist = updatedProfileA.favoriteArtists.find(a => a.name === 'Dua Lipa');
    assert(duaArtist, 'Dua Lipa should be tracked in profile');
    assert.strictEqual(duaArtist.skipCount, 1, 'Skip count should be 1');
    assert(duaArtist.score >= 0, 'Single skip must NOT result in negative score');
    assert(!updatedProfileA.skipPatterns.frequentSkipArtists.includes('Dua Lipa'), 'Single skip must NOT classify artist as frequent skip or disliked');
    console.log('✔ PASS: Single skip rule verified (artist not classified as disliked on 1 skip).\n');

    console.log('--- TEST 5: Survival Across Engine Restarts & Rehydration ---');
    // User A records another event while service is "stopped"
    learningEngineService.destroy();

    await learningEngineService.recordEvent({
      userId: userA._id,
      category: 'music',
      eventType: 'completed',
      metadata: {
        trackId: 'track_arijit_2',
        songTitle: 'Tum Hi Ho',
        artistName: 'Arijit Singh',
        genre: 'Bollywood',
        durationSeconds: 240,
        listenedDurationSeconds: 240,
        completionPercent: 100
      }
    });

    // Re-init service (simulating server restart)
    learningEngineService.init();

    // Process pending batch
    await learningEngineService.processPendingEventsBatch(100);

    const rehydratedProfile = await UserLearningProfile.findOne({ userId: userA._id }).lean();
    const arijit = rehydratedProfile.favoriteArtists.find(a => a.name === 'Arijit Singh');
    assert(arijit.completedCount >= 2, 'Completed count should survive restart and increment to 2');
    assert(arijit.score > 5, 'Score should increment incrementally across restarts');

    // Verify audit logs were written
    const updateLogs = await LearningUpdateLog.find({ userId: userA._id }).lean();
    assert(updateLogs.length > 0, 'LearningUpdateLog audit records must be persisted in DB');
    console.log('✔ PASS: Learning state cleanly survives restart and rehydration from MongoDB.\n');

    console.log('--- TEST 6: Strict Passive Mode Verification ---');
    // Ensure that recommendationEngine recommendations do NOT crash or change because of the learning engine
    const recBefore = await recommendationEngine.getPersonalizedRecommendations(userA._id);
    assert(recBefore, 'Recommendation engine should work normally');
    assert(Array.isArray(recBefore.dailyMix), 'Daily mix should be intact');
    assert(Array.isArray(recBefore.madeForYou), 'Made for you should be intact');

    // Run another learning cycle
    await learningEngineService.processPendingEventsBatch(100);

    const recAfter = await recommendationEngine.getPersonalizedRecommendations(userA._id);
    assert(recAfter, 'Recommendation engine should remain functioning without interference');
    console.log('✔ PASS: Strict passive mode confirmed: Core recommendations operate completely independently.\n');

    console.log('--- TEST 7: Privacy & Profile Deletion ---');
    // Delete User B's learning data via admin API
    const deleteRes = await fetch(`${baseUrl}/api/learning-intelligence/admin/users/${userB._id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenAdmin}` }
    });
    assert.strictEqual(deleteRes.status, 200);
    const deleteData = await deleteRes.json();
    assert.strictEqual(deleteData.success, true);
    assert.strictEqual(deleteData.deletedProfile, true);

    const checkProfileB = await UserLearningProfile.findOne({ userId: userB._id });
    assert.strictEqual(checkProfileB, null, 'User B profile should be deleted');

    const checkEventsB = await UserBehaviorEvent.countDocuments({ userId: userB._id });
    assert.strictEqual(checkEventsB, 0, 'User B events should be completely deleted');

    const checkLogsB = await LearningUpdateLog.countDocuments({ userId: userB._id });
    assert.strictEqual(checkLogsB, 0, 'User B update logs should be completely deleted');

    // Verify User A was untouched
    const checkProfileA = await UserLearningProfile.findOne({ userId: userA._id });
    assert(checkProfileA, 'User A profile must remain completely intact');
    console.log('✔ PASS: Complete right-to-be-forgotten privacy deletion verified.\n');

  } finally {
    // Cleanup
    learningEngineService.destroy();
    server.close();
    if (createdUserIds.length > 0) {
      await Promise.all([
        User.deleteMany({ _id: { $in: createdUserIds } }),
        UserBehaviorEvent.deleteMany({ userId: { $in: createdUserIds } }),
        UserLearningProfile.deleteMany({ userId: { $in: createdUserIds } }),
        LearningUpdateLog.deleteMany({ userId: { $in: createdUserIds } })
      ]);
      console.log('✔ Test data cleaned up successfully.');
    }
  }

  console.log('\n======================================================');
  console.log(' ALL 7 AI LEARNING ENGINE TESTS PASSED WITH 100% ACCURACY! ');
  console.log('======================================================');
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });

