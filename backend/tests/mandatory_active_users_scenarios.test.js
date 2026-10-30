import assert from 'assert';
import mongoose from 'mongoose';
import { io } from '../../frontend/node_modules/socket.io-client/build/esm/index.js';
import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

const BACKEND_URL = 'http://127.0.0.1:5000';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const getPublicLiveCount = async () => {
  const res = await fetch(`${BACKEND_URL}/api/public/live-users`);
  const data = await res.json();
  return data.count;
};

const getAdminLiveCount = async (token) => {
  const res = await fetch(`${BACKEND_URL}/api/admin/metrics`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return {
    activeVisitors: data.activeVisitors,
    breakdown: data.visitorBreakdown
  };
};

async function run() {
  console.log('===============================================================');
  console.log('   MANDATORY ACTIVE USERS VERIFICATION TEST (7 SCENARIOS)     ');
  console.log('===============================================================');

  await mongoose.connect(MONGODB_URI);

  // Setup Admin user
  let admin = await User.findOne({ username: 'admin@afterhours.com' });
  if (!admin) {
    admin = await User.create({ username: 'admin@afterhours.com', password: 'password123', role: 'admin', status: 'active' });
  }
  const adminToken = generateToken(admin);

  // Setup User A
  let userA = await User.findOne({ username: 'account_A_tester' });
  if (!userA) {
    userA = await User.create({ username: 'account_A_tester', password: 'password123', role: 'user', status: 'active' });
  }
  const tokenA = generateToken(userA);

  // Setup User B
  let userB = await User.findOne({ username: 'account_B_tester' });
  if (!userB) {
    userB = await User.create({ username: 'account_B_tester', password: 'password123', role: 'user', status: 'active' });
  }
  const tokenB = generateToken(userB);

  // Ensure live users service is in Mode A (Real Live Users)
  await fetch(`${BACKEND_URL}/api/admin/live-users-config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({ mode: 'real' })
  });

  // --------------------------------------------------------------------------
  // SCENARIO 1: Account A logs in: genuine active users = 1
  // --------------------------------------------------------------------------
  console.log('\n--- SCENARIO 1: Account A logs in ---');
  const socketA_tab1 = io(BACKEND_URL, {
    auth: { sessionId: 'sid_browser_alpha', token: tokenA },
    transports: ['websocket', 'polling']
  });

  await new Promise(r => socketA_tab1.once('connect', r));
  await sleep(300);

  let publicCount = await getPublicLiveCount();
  let adminMetrics = await getAdminLiveCount(adminToken);
  console.log(`[Result 1] Public Navbar: ${publicCount}, Admin Active Visitors: ${adminMetrics.activeVisitors}, Auth Users: ${adminMetrics.breakdown.authenticated}`);
  assert.strictEqual(adminMetrics.breakdown.uniqueUsers, 1, 'Scenario 1: Unique authenticated users = 1');
  assert.strictEqual(publicCount, 1, 'Scenario 1: Navbar shows exactly 1');
  assert.strictEqual(adminMetrics.activeVisitors, 1, 'Scenario 1: Admin dashboard shows exactly 1');
  console.log('[PASS] Scenario 1: Account A logs in -> genuine active users = 1');

  // --------------------------------------------------------------------------
  // SCENARIO 2: Account B logs in simultaneously in another browser/session: genuine active users = 2
  // --------------------------------------------------------------------------
  console.log('\n--- SCENARIO 2: Account B logs in simultaneously ---');
  const socketB_tab1 = io(BACKEND_URL, {
    auth: { sessionId: 'sid_browser_beta', token: tokenB },
    transports: ['websocket', 'polling']
  });

  await new Promise(r => socketB_tab1.once('connect', r));
  await sleep(300);

  publicCount = await getPublicLiveCount();
  adminMetrics = await getAdminLiveCount(adminToken);
  console.log(`[Result 2] Public Navbar: ${publicCount}, Admin Active Visitors: ${adminMetrics.activeVisitors}, Auth Users: ${adminMetrics.breakdown.authenticated}`);
  assert.strictEqual(adminMetrics.breakdown.uniqueUsers, 2, 'Scenario 2: Unique authenticated users = 2');
  assert.strictEqual(publicCount, 2, 'Scenario 2: Navbar shows exactly 2');
  assert.strictEqual(adminMetrics.activeVisitors, 2, 'Scenario 2: Admin dashboard shows exactly 2');
  console.log('[PASS] Scenario 2: Account B logs in simultaneously -> genuine active users = 2');

  // --------------------------------------------------------------------------
  // SCENARIO 3: Open another tab for Account A: count remains 2
  // --------------------------------------------------------------------------
  console.log('\n--- SCENARIO 3: Open another tab for Account A ---');
  const socketA_tab2 = io(BACKEND_URL, {
    auth: { sessionId: 'sid_browser_alpha', token: tokenA },
    transports: ['websocket', 'polling']
  });

  await new Promise(r => socketA_tab2.once('connect', r));
  await sleep(300);

  publicCount = await getPublicLiveCount();
  adminMetrics = await getAdminLiveCount(adminToken);
  console.log(`[Result 3] Public Navbar: ${publicCount}, Admin Active Visitors: ${adminMetrics.activeVisitors}, Auth Users: ${adminMetrics.breakdown.authenticated}`);
  assert.strictEqual(adminMetrics.breakdown.uniqueUsers, 2, 'Scenario 3: Multi-tab for Account A must not inflate count');
  assert.strictEqual(publicCount, 2, 'Scenario 3: Navbar count remains 2');
  assert.strictEqual(adminMetrics.activeVisitors, 2, 'Scenario 3: Admin count remains 2');
  console.log('[PASS] Scenario 3: Open another tab for Account A -> count remains 2');

  // --------------------------------------------------------------------------
  // SCENARIO 4: Log out Account B: count becomes 1
  // --------------------------------------------------------------------------
  console.log('\n--- SCENARIO 4: Log out Account B ---');
  socketB_tab1.emit('user_logout', { sessionId: 'sid_browser_beta' });
  socketB_tab1.disconnect();
  await sleep(400);

  publicCount = await getPublicLiveCount();
  adminMetrics = await getAdminLiveCount(adminToken);
  console.log(`[Result 4] Public Navbar: ${publicCount}, Admin Active Visitors: ${adminMetrics.activeVisitors}, Auth Users: ${adminMetrics.breakdown.authenticated}`);
  assert.strictEqual(adminMetrics.breakdown.uniqueUsers, 1, 'Scenario 4: Only Account A remains authenticated');
  assert.strictEqual(publicCount, 1, 'Scenario 4: Navbar count becomes 1');
  assert.strictEqual(adminMetrics.activeVisitors, 1, 'Scenario 4: Admin count becomes 1');
  console.log('[PASS] Scenario 4: Log out Account B -> count becomes 1');

  // --------------------------------------------------------------------------
  // SCENARIO 5: Close Account A browser & wait for expiration window: count becomes 0
  // --------------------------------------------------------------------------
  console.log('\n--- SCENARIO 5: Close Account A browser & wait for expiration ---');
  socketA_tab1.disconnect();
  socketA_tab2.disconnect();

  // Defined disconnect grace period in VisitorSessionManager is 25 seconds
  // Let's poll until count expires to 0
  console.log('Waiting for disconnect grace period to evict closed sessions...');
  let remainingTime = 28;
  while (remainingTime > 0) {
    await sleep(2000);
    remainingTime -= 2;
    publicCount = await getPublicLiveCount();
    adminMetrics = await getAdminLiveCount(adminToken);
    process.stdout.write(`  Elapsed... current live users = ${publicCount}\r`);
    if (publicCount === 0) break;
  }
  console.log(`\n[Result 5] Public Navbar: ${publicCount}, Admin Active Visitors: ${adminMetrics.activeVisitors}`);
  assert.strictEqual(publicCount, 0, 'Scenario 5: Navbar count becomes 0');
  assert.strictEqual(adminMetrics.activeVisitors, 0, 'Scenario 5: Admin count becomes 0');
  console.log('[PASS] Scenario 5: Close Account A browser -> count becomes 0');

  // --------------------------------------------------------------------------
  // SCENARIO 6: Simulate temporary network interruption & reconnect: no duplicate sessions
  // --------------------------------------------------------------------------
  console.log('\n--- SCENARIO 6: Network drop and reconnect ---');
  const socketA_reconnect = io(BACKEND_URL, {
    auth: { sessionId: 'sid_network_test', token: tokenA },
    transports: ['websocket', 'polling']
  });
  await new Promise(r => socketA_reconnect.once('connect', r));
  await sleep(300);

  publicCount = await getPublicLiveCount();
  assert.strictEqual(publicCount, 1, 'Connected: 1 user');

  // Drop connection
  socketA_reconnect.disconnect();
  await sleep(500);

  // Immediate reconnect (before expiration)
  const socketA_reconnected = io(BACKEND_URL, {
    auth: { sessionId: 'sid_network_test', token: tokenA },
    transports: ['websocket', 'polling']
  });
  await new Promise(r => socketA_reconnected.once('connect', r));
  await sleep(300);

  publicCount = await getPublicLiveCount();
  adminMetrics = await getAdminLiveCount(adminToken);
  console.log(`[Result 6] Reconnected: Public Navbar: ${publicCount}, Admin Active Visitors: ${adminMetrics.activeVisitors}`);
  assert.strictEqual(publicCount, 1, 'Scenario 6: Reconnection does NOT create duplicate sessions');
  assert.strictEqual(adminMetrics.activeVisitors, 1, 'Scenario 6: Admin dashboard shows 1');
  console.log('[PASS] Scenario 6: Reconnect -> no duplicate sessions (count = 1)');

  // --------------------------------------------------------------------------
  // SCENARIO 7: Verify navbar and admin dashboard show the same genuine count
  // --------------------------------------------------------------------------
  console.log('\n--- SCENARIO 7: Verify navbar and admin dashboard consistency ---');
  publicCount = await getPublicLiveCount();
  adminMetrics = await getAdminLiveCount(adminToken);
  console.log(`[Result 7] Public Navbar Count: ${publicCount} === Admin Dashboard Count: ${adminMetrics.activeVisitors}`);
  assert.strictEqual(publicCount, adminMetrics.activeVisitors, 'Scenario 7: Navbar and Admin dashboard match identically');
  console.log('[PASS] Scenario 7: Navbar and admin dashboard show the same genuine count');

  // Cleanup
  socketA_reconnected.disconnect();
  await mongoose.disconnect();
  console.log('\n===============================================================');
  console.log('   ALL 7 MANDATORY ACTIVE USERS SCENARIOS PASSED 100%!        ');
  console.log('===============================================================');
}

run().catch(err => {
  console.error('\n[TEST FAILURE]:', err);
  process.exit(1);
});

