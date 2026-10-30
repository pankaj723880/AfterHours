import assert from 'assert';
import { VisitorSessionManager } from '../services/metrics.js';

console.log('===============================================================');
console.log('    TEST SUITE: REAL-TIME ACTIVE USERS & RATINGS/REVIEWS      ');
console.log('===============================================================');

// ----------------------------------------------------------------------------
// TEST 1: Two Distinct User Accounts Online Simultaneously
// ----------------------------------------------------------------------------
console.log('\n--- SCENARIO 1: Two Distinct User Accounts Online Simultaneously ---');
const mgr = new VisitorSessionManager({ disconnectGraceMs: 50, inactivityTimeoutMs: 150 });

// Account A logs in
const userA = { _id: 'user_A_id_123', username: 'alex', role: 'user' };
mgr.registerConnection({
  socketId: 'sock_userA_tab1',
  sessionId: 'browser_session_common_1',
  user: userA
});

let stats = mgr.getStats();
console.log(`[Step 1] Account A logged in: genuine active visitors = ${stats.totalUniqueSessions}, authenticated = ${stats.authenticatedSessions}`);
assert.strictEqual(stats.totalUniqueSessions, 1, 'Step 1: Exactly 1 active visitor for Account A');
assert.strictEqual(stats.authenticatedSessions, 1, 'Step 1: Exactly 1 authenticated visitor');

// Account B logs in simultaneously in another tab / browser (even sharing same browser_session_common_1)
const userB = { _id: 'user_B_id_456', username: 'bob', role: 'user' };
mgr.registerConnection({
  socketId: 'sock_userB_tab1',
  sessionId: 'browser_session_common_1', // Simulated same browser / machine
  user: userB
});

stats = mgr.getStats();
console.log(`[Step 2] Account B logged in: genuine active visitors = ${stats.totalUniqueSessions}, authenticated = ${stats.authenticatedSessions}`);
assert.strictEqual(stats.totalUniqueSessions, 2, 'Step 2: Two different accounts MUST count as 2 active visitors');
assert.strictEqual(stats.authenticatedSessions, 2, 'Step 2: Two distinct authenticated accounts');

// Account A opens a second tab
mgr.registerConnection({
  socketId: 'sock_userA_tab2',
  sessionId: 'browser_session_common_1',
  user: userA
});

stats = mgr.getStats();
console.log(`[Step 3] Account A opens second tab: genuine active visitors = ${stats.totalUniqueSessions}, connections = ${stats.activeConnections}`);
assert.strictEqual(stats.totalUniqueSessions, 2, 'Step 3: Multi-tab for Account A must not inflate active count (still 2)');
assert.strictEqual(stats.activeConnections, 3, 'Step 3: 3 active socket connections');

// Account B logs out
mgr.handleLogout('sock_userB_tab1', 'browser_session_common_1');
// Now sock_userB_tab1 transitioned to anonymous session on that browser
stats = mgr.getStats();
console.log(`[Step 4] Account B logs out: authenticated = ${stats.authenticatedSessions}, anon = ${stats.anonymousSessions}`);
assert.strictEqual(stats.authenticatedSessions, 1, 'Step 4: Only 1 authenticated user remains (Account A)');

// Account B's tab closes
mgr.handleDisconnect('sock_userB_tab1');
// Account A closes tab 2
mgr.handleDisconnect('sock_userA_tab2');

stats = mgr.getStats();
assert.strictEqual(stats.authenticatedSessions, 1, 'Account A still active via tab 1');

// Account A closes tab 1
mgr.handleDisconnect('sock_userA_tab1');

// Wait for disconnectGraceMs (50ms)
await new Promise(r => setTimeout(r, 70));

mgr.cleanupStaleSessions();
stats = mgr.getStats();
console.log(`[Step 5] Both users closed & grace period expired: genuine active visitors = ${stats.totalUniqueSessions}`);
assert.strictEqual(stats.totalUniqueSessions, 0, 'Step 5: Active count becomes 0 after all tabs disconnect');

// ----------------------------------------------------------------------------
// TEST 2: Temporary Network Drop & Reconnect
// ----------------------------------------------------------------------------
console.log('\n--- SCENARIO 2: Reconnection & Network Drops ---');
const mgr2 = new VisitorSessionManager({ disconnectGraceMs: 200, inactivityTimeoutMs: 500 });
mgr2.registerConnection({
  socketId: 'sock_drop_1',
  sessionId: 'sid_reconnect_test',
  user: userA
});
assert.strictEqual(mgr2.getStats().totalUniqueSessions, 1);

// Socket disconnects
mgr2.handleDisconnect('sock_drop_1');
// Immediate reconnect with new socket ID before grace period
mgr2.registerConnection({
  socketId: 'sock_drop_2',
  sessionId: 'sid_reconnect_test',
  user: userA
});
stats = mgr2.getStats();
console.log(`Reconnected socket: active visitors = ${stats.totalUniqueSessions}`);
assert.strictEqual(stats.totalUniqueSessions, 1, 'Reconnection does not duplicate user count');

console.log('\n=== ALL PRESENCE & COUNTING TESTS PASSED PERFECTLY ===');

