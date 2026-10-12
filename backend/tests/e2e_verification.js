import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { generateToken, verifyToken } from '../middleware/auth.js';

dotenv.config();

const HOST = 'localhost';
const PORT = process.env.PORT || 5000;

function req(options, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const r = http.request({
      host: HOST,
      port: PORT,
      ...options,
      headers: {
        ...(postData ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...(options.headers || {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    r.on('error', reject);
    if (postData) r.write(postData);
    r.end();
  });
}

async function runE2E() {
  console.log('=== STARTING END-TO-END SYSTEM VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  const check = (condition, title) => {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}`);
      failed++;
    }
  };

  try {
    // 1. Database Operations & User Lifecycle
    console.log('--- 1. Critical: Database Operations & User Sync ---');
    const testUsername = `e2e_user_${Date.now()}@test.com`;
    const regRes = await req({ path: '/api/auth/register', method: 'POST' }, {
      username: testUsername,
      password: 'password_123'
    });
    check(regRes.status === 200 || regRes.status === 201, 'User registered in database');
    const userId = regRes.data?.user?.id || regRes.data?.user?.userId || regRes.data?.userId;

    // Login & JWT Token
    const loginRes = await req({ path: '/api/auth/login', method: 'POST' }, {
      username: testUsername,
      password: 'password_123'
    });
    check(loginRes.status === 200, 'User logged in successfully');
    check(Boolean(loginRes.data?.token), 'Valid JWT issued');
    const userToken = loginRes.data?.token;

    // Verify /api/auth/me
    const meRes = await req({
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    check(meRes.status === 200, '/api/auth/me returns authenticated user');
    check(meRes.data?.user?.username === testUsername.toLowerCase(), 'Profile username matches');

    // Test Data Sync (Likes, Playlists, History)
    const mockTrack = { id: 'RLzC55ai0eo', title: 'Heeriye', channel: 'Jasleen Royal' };
    const syncRes = await req({
      path: `/api/user/${userId}/sync`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` }
    }, {
      likedSongs: [mockTrack],
      history: [mockTrack],
      playlists: [{ id: 'p1', name: 'My Favorites', songs: [mockTrack] }]
    });
    check(syncRes.status === 200, 'User data sync accepted by database');

    // Fetch synced data back
    const getSyncRes = await req({
      path: `/api/user/${userId}`,
      method: 'GET'
    });
    check(getSyncRes.status === 200, 'Retrieved synced data from database');
    check(getSyncRes.data?.likedSongs?.length === 1, 'Liked songs persisted correctly in DB');
    check(getSyncRes.data?.likedSongs[0]?.id === 'RLzC55ai0eo', 'Song ID preserved in liked songs');
    check(getSyncRes.data?.playlists?.length === 1, 'Playlists persisted correctly in DB');

    // 2. Music Search & YouTube Resilience
    console.log('\n--- 2. Critical: YouTube Search & Fallback Handling ---');
    const searchRes = await req({
      path: '/api/youtube/search?q=Arijit%20Singh&limit=5',
      method: 'GET'
    });
    check(searchRes.status === 200, 'YouTube search responds 200 OK');
    check(Array.isArray(searchRes.data?.items) && searchRes.data.items.length > 0, 'Returns non-empty array of tracks');
    const firstTrack = searchRes.data?.items[0];
    check(Boolean(firstTrack?.id?.videoId || firstTrack?.id), 'Valid videoId present in search result');
    check(firstTrack?.snippet?.thumbnails?.high?.url?.includes('hqdefault.jpg'), 'Clean hqdefault thumbnail assigned without 404 risk');

    // 3. Security & Admin Permissions
    console.log('\n--- 3. High: Backend Security & Admin RBAC ---');
    // Normal user denied
    const deniedAdminRes = await req({
      path: '/api/admin/metrics',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    check(deniedAdminRes.status === 403, 'Normal user strictly denied from /api/admin/* (403)');

    // Admin token test (Must match an actual database admin user)
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours');
    const dbAdmin = await User.findOne({ role: 'admin' });
    const adminToken = generateToken(dbAdmin);

    const allowAdminRes = await req({
      path: '/api/admin/metrics',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    check(allowAdminRes.status === 200, 'Authorized admin accesses /api/admin/* (200)');

    // Admin health check
    const healthRes = await req({
      path: '/api/admin/health',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    check(healthRes.status === 200, 'Admin health endpoint reports system status');
    check(healthRes.data?.database?.status === 'connected', 'Database reports active connection');

    // Clean up test user
    await User.deleteOne({ username: testUsername.toLowerCase() });
    await mongoose.disconnect();

    console.log(`\n=== E2E SUITE RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('E2E Runner Error:', err);
    process.exit(1);
  }
}

runE2E();
