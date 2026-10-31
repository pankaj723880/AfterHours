import assert from 'assert';
import mongoose from 'mongoose';
import http from 'http';
import { io as ioClient } from '../../frontend/node_modules/socket.io-client/build/esm/index.js';
import User from '../models/User.js';
import UserListeningEvent from '../models/UserListeningEvent.js';
import { generateToken } from '../middleware/auth.js';
import { analyticsService } from '../services/analyticsService.js';

const BACKEND_URL = 'http://localhost:5000';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours';

async function makeRequest(path, options = {}) {
  const url = new URL(path, BACKEND_URL);
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const body = options.body ? JSON.stringify(options.body) : null;

  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: options.method || 'GET',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runAuditTests() {
  console.log('=== RUNNING TESTS: LOOPRA USER EXPERIENCE AUDIT ENHANCEMENTS ===\n');

  await mongoose.connect(MONGODB_URI);

  // 1. Setup Test User
  const testUser = await User.findOneAndUpdate(
    { username: 'ux_enhancement_tester' },
    {
      $set: {
        username: 'ux_enhancement_tester',
        email: 'ux_tester@loopra.test',
        role: 'user',
        status: 'active',
        isPublic: true
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const token = generateToken({
    _id: testUser._id.toString(),
    userId: testUser._id.toString(),
    username: testUser.username,
    role: testUser.role
  });

  console.log('[1/4] Testing /api/recommendations/similar endpoint...');
  // Missing query should 400
  const badReq = await makeRequest('/api/recommendations/similar');
  assert.strictEqual(badReq.status, 400, 'Empty similar query returns 400');

  // Valid query
  const simReq = await makeRequest('/api/recommendations/similar?title=Tum%20Hi%20Ho&artist=Arijit%20Singh');
  assert.strictEqual(simReq.status, 200, 'Valid similar query returns 200');
  assert.ok(simReq.json.success, 'Response success is true');
  assert.ok(Array.isArray(simReq.json.items), 'items is an array');
  assert.strictEqual(simReq.json.originalTrack.title, 'Tum Hi Ho', 'Matches original track');
  console.log(`[PASS] /api/recommendations/similar returned ${simReq.json.items.length} candidate songs.\n`);

  console.log('[2/4] Testing Monthly Recap & Listening Streaks in analyticsService...');
  // Insert sample genuine listening events for today and yesterday
  const now = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  await UserListeningEvent.deleteMany({ userId: testUser._id });

  await UserListeningEvent.create([
    {
      userId: testUser._id,
      trackId: 'test_track_1',
      videoId: 'test_track_1',
      title: 'Song Alpha',
      trackTitle: 'Song Alpha',
      artist: 'Artist A',
      eventType: 'completed',
      listenedDuration: 180,
      timestamp: yesterday
    },
    {
      userId: testUser._id,
      trackId: 'test_track_2',
      videoId: 'test_track_2',
      title: 'Song Beta',
      trackTitle: 'Song Beta',
      artist: 'Artist B',
      eventType: 'completed',
      listenedDuration: 210,
      timestamp: now
    }
  ]);

  const statsOverview = await analyticsService.getUnifiedOverview(testUser._id, { forceRefresh: true });
  assert.ok(statsOverview.success, 'Overview success is true');
  assert.ok(statsOverview.monthlyRecap, 'Monthly recap object exists');
  assert.strictEqual(statsOverview.monthlyRecap.totalPlays, 2, 'Monthly plays count matches events');
  assert.ok(statsOverview.streaks, 'Streaks object exists');
  assert.strictEqual(statsOverview.streaks.currentStreak, 2, 'Consecutive day streak is accurately 2');
  console.log(`[PASS] Monthly recap & streaks computed: currentStreak=${statsOverview.streaks.currentStreak}, monthlyPlays=${statsOverview.monthlyRecap.totalPlays}\n`);

  console.log('[3/4] Testing GET /api/rooms REST endpoint...');
  const roomsRes = await makeRequest('/api/rooms');
  assert.strictEqual(roomsRes.status, 200, '/api/rooms returns 200');
  assert.ok(Array.isArray(roomsRes.json.rooms), 'rooms is an array');
  console.log(`[PASS] /api/rooms returned ${roomsRes.json.rooms.length} active rooms.\n`);

  console.log('[4/4] Testing Socket.IO Listening Room join, sync & leave...');
  const socket = ioClient(BACKEND_URL, {
    transports: ['websocket'],
    auth: { token }
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket connection timed out')), 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      console.log('Socket connected successfully with ID:', socket.id);

      const roomId = `test_room_${Date.now()}`;

      socket.emit('join_listening_room', {
        roomId,
        user: { _id: testUser._id.toString(), username: testUser.username }
      });

      socket.on('listening_room_state', (roomState) => {
        assert.strictEqual(roomState.id, roomId, 'Joined correct room');
        assert.ok(roomState.participants.length >= 1, 'Participant registered');

        // Test sync playback
        socket.emit('room_playback_sync', {
          roomId,
          currentSong: { title: 'Room Sync Track' },
          isPlaying: true,
          seekTime: 42
        });

        // Test leaving room
        socket.emit('leave_listening_room', { roomId });

        socket.disconnect();
        resolve();
      });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  console.log('[PASS] Socket.IO Listening Rooms flow completed successfully!\n');

  await mongoose.disconnect();
  console.log('=== ALL AUDIT & FEATURE ENHANCEMENT TESTS PASSED! ===');
}

runAuditTests().catch(err => {
  console.error('[TEST SUITE ERROR]:', err);
  process.exit(1);
});
