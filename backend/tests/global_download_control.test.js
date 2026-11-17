import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Accept': 'application/json'
      }
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          raw: data
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('=== GLOBAL DOWNLOAD FEATURE CONTROL E2E TEST ===\n');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours');

  // Find or create admin
  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = new User({
      username: 'test_admin_dl_' + Date.now(),
      password: 'test_password_123',
      role: 'admin',
      status: 'active'
    });
    await admin.save();
  }
  const adminToken = generateToken(admin);

  // Find or create regular user
  let regularUser = await User.findOne({ role: 'user', status: 'active' });
  if (!regularUser) {
    regularUser = new User({
      username: 'test_user_dl_' + Date.now(),
      password: 'test_password_123',
      role: 'user',
      status: 'active'
    });
    await regularUser.save();
  }
  const regularUserToken = generateToken(regularUser);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Initial State: Get download control status
    console.log('[Phase 1] Check Initial Download Control State');
    const initRes = await request('GET', '/api/admin/cms/download-control', null, adminToken);
    assert(initRes.statusCode === 200, 'GET /api/admin/cms/download-control returns HTTP 200');
    console.log('    Current status:', initRes.data);

    // 2. Non-admin authorization guard
    console.log('\n[Phase 2] Verify Non-Admin Access Rejection');
    const unauthorizedRes = await request('PUT', '/api/admin/cms/download-control', { enabled: false }, regularUserToken);
    assert(unauthorizedRes.statusCode === 403, 'Non-admin receives 403 Forbidden on PUT download-control');

    // 3. Admin switches DOWNLOAD FEATURE OFF
    console.log('\n[Phase 3] Admin turns DOWNLOAD FEATURE -> OFF');
    const turnOffRes = await request('PUT', '/api/admin/cms/download-control', { enabled: false }, adminToken);
    assert(turnOffRes.statusCode === 200, 'Admin sets download-control to false -> HTTP 200');
    assert(turnOffRes.data?.enabled === false, 'Response confirms enabled === false');

    // 4. Verify Public CMS Config reflects offlineDownloadsEnabled === false
    console.log('\n[Phase 4] Verify Public Config Broadcast');
    const publicConfigRes = await request('GET', '/api/cms/public-config');
    assert(publicConfigRes.statusCode === 200, 'GET /api/cms/public-config returns HTTP 200');
    assert(publicConfigRes.data?.featureControls?.offlineDownloadsEnabled === false, 'Public config featureControls.offlineDownloadsEnabled is false');

    // 5. Verify Direct Download / Stream Endpoint Blocking
    console.log('\n[Phase 5] Verify Direct Audio Stream Endpoint Blocking (HTTP 403)');
    const streamBlockedRes = await request('GET', '/api/audio-stream/cl0a3i2wFcc');
    assert(streamBlockedRes.statusCode === 403, '/api/audio-stream/:videoId returns 403 Forbidden when downloads disabled');
    assert(streamBlockedRes.data?.featureDisabled === true, 'Stream error payload contains featureDisabled: true');

    // 6. Verify Offline Controller Endpoints Blocking
    console.log('\n[Phase 6] Verify /api/offline Endpoints Blocking');
    const batchRes = await request('POST', '/api/offline/eligibility/batch', { trackIds: ['loopra-auth-lofi-02'] });
    assert(batchRes.statusCode === 403, '/api/offline/eligibility/batch returns 403 Forbidden');
    assert(batchRes.data?.featureDisabled === true, 'Batch eligibility reports featureDisabled: true');

    const downloadTrackRes = await request('GET', '/api/offline/download/loopra-auth-lofi-02');
    assert(downloadTrackRes.statusCode === 403, '/api/offline/download/:trackId returns 403 Forbidden');
    assert(downloadTrackRes.data?.featureDisabled === true, 'Download track endpoint reports featureDisabled: true');

    const authorizedTracksRes = await request('GET', '/api/offline/authorized-tracks');
    assert(authorizedTracksRes.statusCode === 403, '/api/offline/authorized-tracks returns 403 Forbidden');
    assert(authorizedTracksRes.data?.featureDisabled === true, 'Authorized tracks endpoint reports featureDisabled: true');

    // 7. Admin switches DOWNLOAD FEATURE back ON
    console.log('\n[Phase 7] Admin turns DOWNLOAD FEATURE -> ON');
    const turnOnRes = await request('PUT', '/api/admin/cms/download-control', { enabled: true }, adminToken);
    assert(turnOnRes.statusCode === 200, 'Admin sets download-control to true -> HTTP 200');
    assert(turnOnRes.data?.enabled === true, 'Response confirms enabled === true');

    // 8. Verify Public CMS Config reflects offlineDownloadsEnabled === true
    console.log('\n[Phase 8] Verify Public Config Broadcast Restoration');
    const restoredPublicConfigRes = await request('GET', '/api/cms/public-config');
    assert(restoredPublicConfigRes.statusCode === 200, 'GET /api/cms/public-config returns HTTP 200');
    assert(restoredPublicConfigRes.data?.featureControls?.offlineDownloadsEnabled === true, 'Public config featureControls.offlineDownloadsEnabled is restored to true');

    // 9. Verify Authorized Tracks Endpoint Unblocked
    console.log('\n[Phase 9] Verify Endpoints Unblocked when ON');
    const unblockedAuthorizedRes = await request('GET', '/api/offline/authorized-tracks');
    assert(unblockedAuthorizedRes.statusCode === 200, '/api/offline/authorized-tracks returns 200 OK when enabled');
    assert(Array.isArray(unblockedAuthorizedRes.data?.tracks), 'Returns active track list when enabled');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
  }

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run();
