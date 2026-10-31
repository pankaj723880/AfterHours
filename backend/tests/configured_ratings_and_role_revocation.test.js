import assert from 'assert';
import { io as Client } from '../../frontend/node_modules/socket.io-client/build/esm/index.js';
import mongoose from 'mongoose';
import User from '../models/User.js';
import ConfiguredReviewsSettings from '../models/ConfiguredReviewsSettings.js';
import { generateToken } from '../middleware/auth.js';

const BACKEND_URL = 'http://localhost:5000';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours';

async function main() {
  console.log('=== RUNNING TESTS: CONFIGURED RATINGS & INSTANT ROLE REVOCATION ===');

  await mongoose.connect(MONGODB_URI);

  // Setup Test Admin A and Test User B
  const adminA = await User.findOneAndUpdate(
    { username: 'test_admin_alpha@afterhours.test' },
    {
      username: 'test_admin_alpha@afterhours.test',
      email: 'test_admin_alpha@afterhours.test',
      password: 'hashed_dummy_pw',
      role: 'admin',
      status: 'active'
    },
    { upsert: true, new: true }
  );

  const userB = await User.findOneAndUpdate(
    { username: 'test_user_beta@afterhours.test' },
    {
      username: 'test_user_beta@afterhours.test',
      email: 'test_user_beta@afterhours.test',
      password: 'hashed_dummy_pw',
      role: 'admin',
      status: 'active'
    },
    { upsert: true, new: true }
  );

  const tokenA = generateToken(adminA);
  const tokenB = generateToken(userB);

  console.log('[Setup Complete] Admin A ID:', adminA._id, '| User B ID:', userB._id);

  try {
    // --------------------------------------------------------------------------
    // PART 1: CONFIGURED RATINGS & DISTRIBUTION TESTS
    // --------------------------------------------------------------------------
    console.log('\n--- Test 1.1: Save Configured Ratings with 5 Distribution Counts ---');
    // Example: 1-star: 5, 2-stars: 8, 3-stars: 12, 4-stars: 35, 5-stars: 90
    // Expected Total: 150
    // Expected Weighted Avg: (1*5 + 2*8 + 3*12 + 4*35 + 5*90) / 150 = 647 / 150 = 4.313... -> 4.3
    const saveRes = await fetch(`${BACKEND_URL}/api/admin/reviews/configured-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        enabled: true,
        editorialLabel: 'Curated Editorial Highlights',
        distribution: {
          count1: 5,
          count2: 8,
          count3: 12,
          count4: 35,
          count5: 90
        }
      })
    });

    const saveData = await saveRes.json();
    assert.strictEqual(saveRes.status, 200, `Save settings must return 200, got ${saveRes.status}`);
    assert.strictEqual(saveData.success, true);
    assert.strictEqual(saveData.settings.displayCount, 150, `Expected total 150, got ${saveData.settings.displayCount}`);
    assert.strictEqual(Math.round(saveData.settings.displayRating * 10) / 10, 4.3, `Expected avg 4.3, got ${saveData.settings.displayRating}`);
    assert.strictEqual(saveData.settings.distribution.count1, 5);
    assert.strictEqual(saveData.settings.distribution.count5, 90);
    console.log('✓ Configured settings calculated total=150, average=4.3 correctly!');

    console.log('\n--- Test 1.2: Retrieve Configured Settings on Page Reload / Fetch ---');
    const getRes = await fetch(`${BACKEND_URL}/api/admin/reviews/configured`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const getData = await getRes.json();
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getData.settings.displayCount, 150);
    assert.strictEqual(Math.round(getData.settings.displayRating * 10) / 10, 4.3);
    assert.strictEqual(getData.settings.distribution.count1, 5);
    assert.strictEqual(getData.settings.distribution.count5, 90);
    assert.strictEqual(getData.settings.enabled, true);
    console.log('✓ Page reload/fetch accurately recovered exact MongoDB saved values!');

    console.log('\n--- Test 1.3: Allow Zero Ratings (all 0s) ---');
    const zeroRes = await fetch(`${BACKEND_URL}/api/admin/reviews/configured-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        enabled: true,
        distribution: { count1: 0, count2: 0, count3: 0, count4: 0, count5: 0 }
      })
    });
    const zeroData = await zeroRes.json();
    assert.strictEqual(zeroRes.status, 200);
    assert.strictEqual(zeroData.settings.displayCount, 0);
    assert.strictEqual(zeroData.settings.displayRating, 0.0);
    console.log('✓ Zero ratings allowed cleanly: total=0, avg=0.0!');

    console.log('\n--- Test 1.4: Reject Negative Distribution Counts ---');
    const negRes = await fetch(`${BACKEND_URL}/api/admin/reviews/configured-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        enabled: true,
        distribution: { count1: -5, count2: 10, count3: 0, count4: 0, count5: 0 }
      })
    });
    assert.strictEqual(negRes.status, 400);
    console.log('✓ Negative counts rejected with 400 Bad Request!');

    console.log('\n--- Test 1.5: Verify Public Summary Separation (Enabled vs Disabled) ---');
    // Re-save configured with 150 ratings / 4.3 avg
    await fetch(`${BACKEND_URL}/api/admin/reviews/configured-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        enabled: true,
        editorialLabel: 'Curated Editorial Highlights',
        distribution: { count1: 5, count2: 8, count3: 12, count4: 35, count5: 90 }
      })
    });

    const pubSummaryEnabledRes = await fetch(`${BACKEND_URL}/api/reviews/summary`);
    const pubSummaryEnabled = await pubSummaryEnabledRes.json();
    assert.ok(pubSummaryEnabled.editorialSummary, 'editorialSummary must be present when enabled');
    assert.strictEqual(Math.round(pubSummaryEnabled.editorialSummary.displayRating * 10) / 10, 4.3);
    assert.strictEqual(pubSummaryEnabled.editorialSummary.displayCount, 150);
    assert.strictEqual(pubSummaryEnabled.editorialSummary.distribution[1], 5);
    assert.strictEqual(pubSummaryEnabled.editorialSummary.distribution[5], 90);
    console.log('✓ Public summary serves editorial summary when enabled!');

    // Now disable configured mode
    await fetch(`${BACKEND_URL}/api/admin/reviews/configured-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ enabled: false })
    });
    const pubSummaryDisabledRes = await fetch(`${BACKEND_URL}/api/reviews/summary`);
    const pubSummaryDisabled = await pubSummaryDisabledRes.json();
    assert.strictEqual(pubSummaryDisabled.editorialSummary, null, 'editorialSummary must be null when disabled');
    console.log('✓ When disabled, editorialSummary is null and genuine stats are strictly isolated!');

    // --------------------------------------------------------------------------
    // PART 2: INSTANT ADMIN ROLE REVOCATION & SOCKET SYNCHRONIZATION
    // --------------------------------------------------------------------------
    console.log('\n--- Test 2.1: Connect User B as Admin over Socket.io ---');
    // Ensure User B is admin in DB
    await User.findByIdAndUpdate(userB._id, { role: 'admin' });

    const socketB = Client(BACKEND_URL, {
      auth: { token: tokenB, sessionId: 'session_user_beta_tab1' },
      transports: ['websocket', 'polling']
    });

    await new Promise((resolve, reject) => {
      socketB.on('connect', resolve);
      socketB.on('connect_error', reject);
      setTimeout(() => reject(new Error('Socket B connection timeout')), 5000);
    });
    console.log('✓ Socket B connected successfully with ID:', socketB.id);

    // Initial check: User B can access admin endpoint
    const initAdminRes = await fetch(`${BACKEND_URL}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(initAdminRes.status, 200, `User B initially accesses /api/admin/metrics with 200, got ${initAdminRes.status}`);
    console.log('✓ User B initially has admin access (200 OK)');

    console.log('\n--- Test 2.2: Admin A Demotes User B to "user" in Real Time ---');
    let receivedRevokedEvent = false;
    let receivedRoleChangeEvent = null;

    socketB.on('admin_access_revoked', (data) => {
      receivedRevokedEvent = true;
    });

    socketB.on('user_role_changed', (data) => {
      if (data.userId === userB._id.toString()) {
        receivedRoleChangeEvent = data;
      }
    });

    const demoteRes = await fetch(`${BACKEND_URL}/api/admin/users/${userB._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ role: 'user' })
    });
    assert.strictEqual(demoteRes.status, 200);

    // Wait for real-time socket events
    await new Promise((resolve) => setTimeout(resolve, 800));

    assert.ok(receivedRevokedEvent, 'Socket B must have received admin_access_revoked event');
    assert.ok(receivedRoleChangeEvent, 'Socket B must have received user_role_changed event');
    assert.strictEqual(receivedRoleChangeEvent.role, 'user', 'user_role_changed role must be "user"');
    console.log('✓ Real-time Socket.io events (admin_access_revoked & user_role_changed) received instantly!');

    console.log('\n--- Test 2.3: Verify Immediate API Access Revocation (Live DB Backed) ---');
    // User B sends previous JWT token (which had role: admin encoded)
    const blockedRes = await fetch(`${BACKEND_URL}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(blockedRes.status, 403, `Demoted user must be immediately blocked with 403 Forbidden, got ${blockedRes.status}`);
    console.log('✓ Demoted user immediately blocked from admin endpoints with 403 Forbidden!');

    console.log('\n--- Test 2.4: Verify /api/user/me returns Live Database Role ---');
    const meRes = await fetch(`${BACKEND_URL}/api/user/me`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const meData = await meRes.json();
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meData.user.role, 'user', `Live role in /api/user/me must be "user", got ${meData.user.role}`);
    console.log('✓ /api/user/me reflects demoted role ("user") immediately!');

    console.log('\n--- Test 2.5: Admin A Promotes User B Back to "admin" ---');
    let receivedGrantedEvent = false;
    let receivedPromoteRoleEvent = null;

    socketB.on('admin_access_granted', () => {
      receivedGrantedEvent = true;
    });

    socketB.on('user_role_changed', (data) => {
      if (data.userId === userB._id.toString() && data.role === 'admin') {
        receivedPromoteRoleEvent = data;
      }
    });

    const promoteRes = await fetch(`${BACKEND_URL}/api/admin/users/${userB._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ role: 'admin' })
    });
    assert.strictEqual(promoteRes.status, 200);

    await new Promise((resolve) => setTimeout(resolve, 800));

    assert.ok(receivedGrantedEvent, 'Socket B must have received admin_access_granted event');
    assert.ok(receivedPromoteRoleEvent, 'Socket B must have received user_role_changed with role admin');
    console.log('✓ Real-time Socket.io promotion events received instantly!');

    const restoredRes = await fetch(`${BACKEND_URL}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(restoredRes.status, 200, `Promoted admin must access /api/admin/metrics with 200 OK, got ${restoredRes.status}`);
    console.log('✓ Promoted admin has admin access restored immediately (200 OK)!');

    socketB.disconnect();

    console.log('\n======================================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED.');
    console.log('======================================================\n');
  } finally {
    // Cleanup test users
    await User.deleteMany({
      _id: { $in: [adminA._id, userB._id] }
    });
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});
