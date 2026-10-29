import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const HOST = 'localhost';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: HOST,
      port: PORT,
      ...options,
      headers: {
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(JSON.stringify(body)) } : {}),
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING NOSTALGIA STATIONS & SIDEBAR NAVIGATION CRUD TESTS ===\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition, title) => {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}`);
      failed++;
    }
  };

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours');

    // 1. Setup Test Admin & Regular Member
    let admin = await User.findOne({ role: 'admin', status: 'active' });
    if (!admin) {
      admin = await User.create({
        username: 'testadmin_crud',
        email: 'testadmin_crud@loopra.local',
        password: 'Password123!',
        role: 'admin',
        status: 'active'
      });
    }
    const adminToken = generateToken(admin);

    let member = await User.findOne({ role: 'user', status: 'active' });
    if (!member) {
      member = await User.create({
        username: 'testmember_crud',
        email: 'testmember_crud@loopra.local',
        password: 'Password123!',
        role: 'user',
        status: 'active'
      });
    }
    const memberToken = generateToken(member);

    // ==========================================
    // SECTION 1: AUTHENTICATION & RBAC SECURITY
    // ==========================================
    console.log('\n--- 1. Security & RBAC Checks ---');

    let res = await request({ path: '/api/admin/cms/stations', method: 'GET' });
    assert(res.status === 401, 'GET /stations rejected without token (401)');

    res = await request({
      path: '/api/admin/cms/stations',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${memberToken}` }
    });
    assert(res.status === 403, 'GET /stations rejected for regular member (403)');

    res = await request({
      path: '/api/admin/cms/navigation',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${memberToken}` }
    });
    assert(res.status === 403, 'GET /navigation rejected for regular member (403)');

    // ==========================================
    // SECTION 2: NOSTALGIA STATIONS CRUD
    // ==========================================
    console.log('\n--- 2. Nostalgia Stations Management ---');

    res = await request({
      path: '/api/admin/cms/stations',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res.status === 200 && Array.isArray(res.data.stations), 'GET /stations returns active station catalogue');
    const initialStationCount = res.data.stations.length;

    // 2a. Create station
    const newStationPayload = {
      name: 'Retro Punjabi Beats',
      slug: 'retro-punjabi-beats',
      description: 'Golden era Punjabi folk, high bass dhol beats and highway classics',
      badge: '🚜 Retro Punjabi • 90s Folk',
      icon: 'truck',
      accentColor: '#10b981',
      category: 'Highway Dhaba',
      language: 'Punjabi',
      queries: ['punjabi 90s folk hits', 'surjit bindrakhia classic songs']
    };

    res = await request({
      path: '/api/admin/cms/stations',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, newStationPayload);
    assert(res.status === 201 && res.data.station?.id === 'retro-punjabi-beats', 'POST /stations creates new Nostalgia Station');

    // 2b. Prevent duplicate slug
    res = await request({
      path: '/api/admin/cms/stations',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, newStationPayload);
    assert(res.status === 409, 'POST /stations rejects duplicate station slug with 409 Conflict');

    // 2c. Prevent reserved routes as slugs
    res = await request({
      path: '/api/admin/cms/stations',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, { name: 'Admin Route Test', slug: 'admin' });
    assert(res.status === 400, 'POST /stations rejects reserved route slug (e.g. "admin") with 400 Bad Request');

    // 2d. Update station
    res = await request({
      path: '/api/admin/cms/stations/retro-punjabi-beats',
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      title: 'Retro Punjabi Beats (Remastered)',
      badge: '🚜 Remastered 90s Punjabi',
      accentColor: '#059669'
    });
    assert(res.status === 200 && res.data.station?.title === 'Retro Punjabi Beats (Remastered)', 'PUT /stations/:id updates station metadata');

    // 2e. Manage station tracks
    const trackPayload = {
      videoId: 'testvid12345',
      title: 'Dupatta Tera Satrang Da',
      artist: 'Surjit Bindrakhia',
      album: 'Mukhda Dekh Ke',
      duration: '4:15'
    };

    res = await request({
      path: '/api/admin/cms/stations/retro-punjabi-beats/tracks',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, trackPayload);
    assert(res.status === 201 && res.data.track?.videoId === 'testvid12345', 'POST /stations/:id/tracks adds curated track to station');

    // Verify track is in station
    res = await request({
      path: '/api/admin/cms/stations',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const foundStation = res.data.stations.find(s => s.id === 'retro-punjabi-beats');
    assert(foundStation && foundStation.tracks?.length === 1, 'Station track list persisted in station catalogue');

    // 2f. Delete track from station
    res = await request({
      path: '/api/admin/cms/stations/retro-punjabi-beats/tracks/testvid12345',
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res.status === 200, 'DELETE /stations/:id/tracks/:trackId removes curated track');

    // 2g. Delete station
    res = await request({
      path: '/api/admin/cms/stations/retro-punjabi-beats',
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res.status === 200, 'DELETE /stations/:id removes custom Nostalgia Station');

    // ==========================================
    // SECTION 3: NAVIGATION CRUD & SAFEGUARDS
    // ==========================================
    console.log('\n--- 3. Sidebar Navigation Management ---');

    // Reset navigation to defaults to ensure a clean state
    await request({
      path: '/api/admin/cms/navigation/reset',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    res = await request({
      path: '/api/admin/cms/navigation',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res.status === 200 && Array.isArray(res.data.navigation), 'GET /navigation returns platform destinations');
    assert(res.data.navigation.length >= 15, 'Navigation contains all 15 platform destinations across groups');

    // 3a. Create new navigation item
    const newNavPayload = {
      id: 'custom-vip-lounge',
      label: 'VIP Lounge',
      icon: 'sparkles',
      group: 'discovery',
      route: '/vip-lounge',
      badge: 'VIP',
      description: 'Exclusive listening room'
    };

    res = await request({
      path: '/api/admin/cms/navigation',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, newNavPayload);
    assert(res.status === 201 && res.data.item?.id === 'custom-vip-lounge', 'POST /navigation adds new custom sidebar destination');

    // 3b. Update navigation item
    res = await request({
      path: '/api/admin/cms/navigation/custom-vip-lounge',
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      label: 'Ultra VIP Lounge',
      badge: 'PRO'
    });
    assert(res.status === 200 && res.data.item?.label === 'Ultra VIP Lounge', 'PUT /navigation/:id updates destination properties');

    // 3c. Core item delete safeguard
    res = await request({
      path: '/api/admin/cms/navigation/home',
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res.status === 400 && res.data.message?.includes('Core navigation'), 'DELETE /navigation/:id protects core items from deletion');

    // 3d. Delete custom navigation item
    res = await request({
      path: '/api/admin/cms/navigation/custom-vip-lounge',
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res.status === 200, 'DELETE /navigation/:id removes custom navigation destination');

    // 3e. Reset navigation to defaults
    res = await request({
      path: '/api/admin/cms/navigation/reset',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res.status === 200 && res.data.navigation?.length >= 15, 'POST /navigation/reset restores all 15 platform destinations');

    console.log(`\n=== TEST RUN FINISHED: ${passed} Passed, ${failed} Failed ===`);
    process.exit(failed > 0 ? 1 : 0);

  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
