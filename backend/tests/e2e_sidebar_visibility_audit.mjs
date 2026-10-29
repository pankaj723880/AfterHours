import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import SiteConfig from '../models/SiteConfig.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { cmsService, getDefaultSiteConfig, normalizeNavigationList } from '../services/cmsService.js';
import { normalizeNavigationList as clientNormalizeNav } from '../../frontend/src/services/cmsClient.js';

const BACKEND_URL = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'loopra-super-secret-jwt-key-for-local-dev-change-in-prod';

async function runAudit() {
  console.log('=== STARTING SIDEBAR VISIBILITY END-TO-END AUDIT ===\n');

  // Connect to DB
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/afterhours';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }

  // 1. Obtain admin token
  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = await User.create({
      username: 'auditadmin_' + Date.now(),
      email: `auditadmin_${Date.now()}@loopra.io`,
      passwordHash: 'dummyhash',
      role: 'admin'
    });
  }
  const token = jwt.sign(
    { userId: admin._id, username: admin.username, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('1. Obtained test admin credentials: ' + admin.username);

  // STEP 1: Verify current public config before hiding
  const preRes = await fetch(`${BACKEND_URL}/api/cms/public-config?_t=${Date.now()}`);
  assert.strictEqual(preRes.status, 200, 'Public config must return 200');
  const preConfig = await preRes.json();
  const preActivity = preConfig.navigation.find(n => n.id === 'activity');
  console.log(`2. Pre-test state: Listening Activity enabled = ${preActivity?.enabled ?? 'not present'}`);

  // STEP 2: Hide Listening Activity (enabled: false) via PUT /api/admin/cms/navigation/activity
  console.log('\n3. Hiding Listening Activity via PUT /api/admin/cms/navigation/activity...');
  const hideRes = await fetch(`${BACKEND_URL}/api/admin/cms/navigation/activity`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ enabled: false })
  });
  assert.strictEqual(hideRes.status, 200, 'PUT /api/admin/cms/navigation/activity must return 200');
  const hideData = await hideRes.json();
  assert.strictEqual(hideData.item.enabled, false, 'Updated item must have enabled: false');
  console.log('✅ API returned success: ' + hideData.message);

  // STEP 3: Verify DB persistence in both draft and published configurations
  const draftDoc = await SiteConfig.findOne({ configType: 'draft' }).sort({ version: -1, updatedAt: -1 }).lean();
  const pubDoc = await SiteConfig.findOne({ configType: 'published' }).sort({ version: -1, updatedAt: -1 }).lean();

  const draftActivity = draftDoc.navigation.find(n => n.id === 'activity');
  const pubActivity = pubDoc.navigation.find(n => n.id === 'activity');

  assert.strictEqual(draftActivity?.enabled, false, 'Draft in MongoDB must have activity enabled: false');
  assert.strictEqual(pubActivity?.enabled, false, 'Published in MongoDB must have activity enabled: false');
  console.log('✅ Database Persistence Verified: activity is enabled: false in both draft and published collections');

  // STEP 4: Verify Public API reflects hidden state (GET /api/cms/public-config)
  const publicRes = await fetch(`${BACKEND_URL}/api/cms/public-config?_t=${Date.now()}`);
  assert.strictEqual(publicRes.status, 200);
  const publicConfig = await publicRes.json();
  const publicNavActivity = publicConfig.navigation.find(n => n.id === 'activity');

  assert.ok(publicNavActivity, 'Navigation array must include activity item');
  assert.strictEqual(publicNavActivity.enabled, false, 'Public config must report activity enabled: false');
  console.log('✅ Public API Verified: GET /api/cms/public-config reports activity.enabled === false');

  // STEP 5: Verify Frontend Sidebar Filtering (App.jsx simulation)
  const computeSidebar = (configNav) => {
    const disabledIds = new Set();
    const configured = Array.isArray(configNav) ? configNav : [];
    configured.forEach(i => { if (i && i.id && i.enabled === false) disabledIds.add(i.id); });

    const navMap = new Map();
    configured.forEach(item => {
      if (!item || !item.id || item.id === 'profile' || item.id === 'equalizer') return;
      if (item.enabled === false || disabledIds.has(item.id)) return;
      navMap.set(item.id, item);
    });

    return Array.from(navMap.values()).filter(i => i.enabled !== false && !disabledIds.has(i.id));
  };

  const visibleSidebar = computeSidebar(publicConfig.navigation);
  assert.strictEqual(visibleSidebar.some(i => i.id === 'activity'), false, 'Listening Activity MUST NOT be in rendered sidebar');
  console.log('✅ Sidebar Rendering Verified: Listening Activity is completely removed from rendered sidebar items');

  // STEP 6: Hide another item (e.g. 'swipe') and verify the exact same behavior
  console.log('\n4. Hiding secondary item (Discover Swipe)...');
  const hideSwipeRes = await fetch(`${BACKEND_URL}/api/admin/cms/navigation/swipe`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ enabled: false })
  });
  assert.strictEqual(hideSwipeRes.status, 200);

  const publicRes2 = await fetch(`${BACKEND_URL}/api/cms/public-config?_t=${Date.now()}`);
  const publicConfig2 = await publicRes2.json();
  const visibleSidebar2 = computeSidebar(publicConfig2.navigation);

  assert.strictEqual(visibleSidebar2.some(i => i.id === 'activity'), false, 'Activity remains hidden');
  assert.strictEqual(visibleSidebar2.some(i => i.id === 'swipe'), false, 'Discover Swipe is now hidden');
  console.log('✅ Multi-item Hiding Verified: Both activity and swipe are hidden from the sidebar');

  // STEP 7: Unhide Listening Activity and Discover Swipe
  console.log('\n5. Restoring/Unhiding Listening Activity and Discover Swipe...');
  await fetch(`${BACKEND_URL}/api/admin/cms/navigation/activity`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ enabled: true })
  });

  await fetch(`${BACKEND_URL}/api/admin/cms/navigation/swipe`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ enabled: true })
  });

  const publicRes3 = await fetch(`${BACKEND_URL}/api/cms/public-config?_t=${Date.now()}`);
  const publicConfig3 = await publicRes3.json();
  const visibleSidebar3 = computeSidebar(publicConfig3.navigation);

  assert.strictEqual(visibleSidebar3.some(i => i.id === 'activity'), true, 'Listening Activity reappears');
  assert.strictEqual(visibleSidebar3.some(i => i.id === 'swipe'), true, 'Discover Swipe reappears');
  console.log('✅ Unhiding Verified: Listening Activity and Discover Swipe cleanly reappear when enabled: true');

  // STEP 8: Verify that underlying page/route and data are NOT deleted
  console.log('\n6. Verifying underlying feature and data preservation...');
  // Check that activity API endpoint still responds
  const activityDataRes = await fetch(`${BACKEND_URL}/api/activity/feed?limit=5`);
  assert.ok([200, 304].includes(activityDataRes.status), 'Activity data API must continue to respond');
  console.log('✅ Route & Feature Integrity Verified: /api/activity/feed responded with ' + activityDataRes.status);

  console.log('\n=== ALL AUDIT STEPS PASSED SUCCESSFULLY ===');
  process.exit(0);
}

runAudit().catch(err => {
  console.error('\n❌ Audit Failed:', err);
  process.exit(1);
});
