import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import SystemMetric from '../models/SystemMetric.js';
import { generateToken } from '../middleware/auth.js';
import { VisitorSessionManager, MetricsService, metricsService } from '../services/metrics.js';

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

async function runMetricsAuditTests() {
  console.log('===============================================================');
  console.log('   AFTERHOURS PRODUCTION METRICS AUDIT & VERIFICATION SUITE   ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title} ${details ? '--> ' + details : ''}`);
      failed++;
    }
  };

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours');
    }

    // -------------------------------------------------------------
    // TEST 1: VisitorSessionManager - Deduplication with multiple connections
    // -------------------------------------------------------------
    console.log('--- TEST 1: Visitor Session Deduplication (Single Visitor, Multiple Sockets) ---');
    const testSessionMgr = new VisitorSessionManager({ disconnectGraceMs: 500, inactivityTimeoutMs: 1500 });
    
    // User opens 1 tab: socket 1 connects
    const mockUser = { _id: 'user_1', username: 'tester', role: 'user' };
    const sess1 = testSessionMgr.registerConnection({
      socketId: 'sock_tab1',
      sessionId: 'user_session_abc',
      user: mockUser
    });
    // Same user opens second socket (e.g. admin or notification socket in same session)
    const sess2 = testSessionMgr.registerConnection({
      socketId: 'sock_tab1_extra',
      sessionId: 'user_session_abc',
      user: mockUser
    });

    let stats = testSessionMgr.getStats();
    assert(stats.totalUniqueSessions === 1, '1 visitor session counted despite 2 socket connections', `got ${stats.totalUniqueSessions}`);
    assert(stats.activeConnections === 2, '2 physical socket connections tracked correctly', `got ${stats.activeConnections}`);
    assert(sess1 === sess2, 'Both connections resolve to the exact same session object');

    // -------------------------------------------------------------
    // TEST 2: Multiple tabs sharing same session
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Multiple Browser Tabs Sharing Session ---');
    testSessionMgr.registerConnection({
      socketId: 'sock_tab2',
      sessionId: 'user_session_abc',
      user: mockUser
    });
    testSessionMgr.registerConnection({
      socketId: 'sock_tab3',
      sessionId: 'user_session_abc',
      user: mockUser
    });

    stats = testSessionMgr.getStats();
    assert(stats.totalUniqueSessions === 1, '3 tabs sharing same session ID count as 1 unique live visitor', `got ${stats.totalUniqueSessions}`);
    assert(stats.activeConnections === 4, '4 active socket connections tracked across tabs', `got ${stats.activeConnections}`);

    // Add a second separate visitor (anonymous)
    testSessionMgr.registerConnection({
      socketId: 'sock_anon_1',
      sessionId: 'anon_session_xyz',
      user: null
    });

    stats = testSessionMgr.getStats();
    assert(stats.totalUniqueSessions === 2, '2 distinct session IDs count as exactly 2 live visitors', `got ${stats.totalUniqueSessions}`);
    assert(stats.authenticatedSessions === 1, '1 authenticated visitor session', `got ${stats.authenticatedSessions}`);
    assert(stats.anonymousSessions === 1, '1 anonymous visitor session', `got ${stats.anonymousSessions}`);

    // -------------------------------------------------------------
    // TEST 3: Reconnection and Stale-Session Cleanup
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Disconnection, Grace Period & Cleanup ---');
    // Tab 2 and Tab 3 close
    testSessionMgr.handleDisconnect('sock_tab2');
    testSessionMgr.handleDisconnect('sock_tab3');
    stats = testSessionMgr.getStats();
    assert(stats.totalUniqueSessions === 2, 'Session stays active as long as at least 1 socket remains connected');

    // Remaining sockets for user_session_abc disconnect
    testSessionMgr.handleDisconnect('sock_tab1');
    testSessionMgr.handleDisconnect('sock_tab1_extra');
    
    // Immediately after disconnect, grace period keeps session active
    stats = testSessionMgr.getStats();
    assert(stats.totalUniqueSessions === 2, 'Session retained in grace period immediately after socket disconnect', `got ${stats.totalUniqueSessions}`);

    // Wait 600ms (grace period is 500ms)
    await new Promise(r => setTimeout(r, 650));
    testSessionMgr.cleanupStaleSessions();
    stats = testSessionMgr.getStats();
    assert(stats.totalUniqueSessions === 1, 'Expired session cleanly evicted after grace period', `got ${stats.totalUniqueSessions}`);
    assert(stats.anonymousSessions === 1, 'Only remaining active session is preserved');

    // -------------------------------------------------------------
    // TEST 4: Rolling 60-Second RPM Calculation
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Rolling 60-Second RPM Window ---');
    const testMetrics = new MetricsService();
    
    const baseNow = Date.now();
    // Simulate requests within the last 60 seconds
    testMetrics.recordRequest({ method: 'GET', path: '/api/search', status: 200, durationMs: 45 });
    testMetrics.recordRequest({ method: 'POST', path: '/api/auth/login', status: 200, durationMs: 60 });
    testMetrics.recordRequest({ method: 'GET', path: '/health', status: 200, durationMs: 5 }); // health check
    
    // Inject an old request timestamp (90 seconds ago)
    testMetrics.requestTimestamps.unshift({ time: baseNow - 90000, isUser: true });
    
    const snap = testMetrics.getSnapshot();
    assert(snap.requestsPerMinute === 3, 'Only requests in rolling 60-second window counted in RPM', `got ${snap.requestsPerMinute}`);
    assert(snap.requestsPerMinuteUser === 2, 'User RPM excludes background health checks', `got ${snap.requestsPerMinuteUser}`);

    // -------------------------------------------------------------
    // TEST 5: Latency Measurement (Monotonic hrtime & p95 calculation)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Monotonic Latency & Percentiles ---');
    const latencyTest = new MetricsService();
    
    // Insert 100 requests with known distribution (1 to 100 ms)
    for (let i = 1; i <= 100; i++) {
      latencyTest.recordRequest({ method: 'GET', path: '/api/test', status: 200, durationMs: i });
    }
    
    const latSnap = latencyTest.getSnapshot();
    assert(latSnap.avgLatencyMs === 51, 'Average latency calculated accurately (rounded integer ms)', `got ${latSnap.avgLatencyMs}`);
    assert(latSnap.p50LatencyMs === 51, 'Median p50 latency is 51ms', `got ${latSnap.p50LatencyMs}`);
    assert(latSnap.p95LatencyMs === 96, 'p95 latency in 100 requests is 96ms', `got ${latSnap.p95LatencyMs}`);

    // Slow request detection (> 500ms)
    latencyTest.recordRequest({ method: 'GET', path: '/api/heavy-query', status: 200, durationMs: 650 });
    const latSlowSnap = latencyTest.getSnapshot();
    assert(latSlowSnap.slowRequests.length === 1, 'Requests > 500ms captured in slowRequests buffer');
    assert(latSlowSnap.slowRequests[0].duration === 650, 'Slow request duration accurately recorded');

    // -------------------------------------------------------------
    // TEST 6: Error Rate Calculation & Zero-Request Handling
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Error Rate & Safe Zero-Request Handling ---');
    const errMetrics = new MetricsService();
    
    // Zero request state
    let zeroSnap = errMetrics.getSnapshot();
    assert(zeroSnap.errorRatePercent === 0.0, 'Zero requests returns 0.0% error rate without NaN or Infinity', `got ${zeroSnap.errorRatePercent}`);
    assert(!Number.isNaN(zeroSnap.errorRatePercent) && Number.isFinite(zeroSnap.errorRatePercent), 'Error rate is finite numeric');

    // Record requests: 90 successful (200), 8 client errors (401/404), 2 server errors (500)
    for (let i = 0; i < 90; i++) {
      errMetrics.recordRequest({ method: 'GET', path: '/api/songs', status: 200, durationMs: 20 });
    }
    for (let i = 0; i < 8; i++) {
      errMetrics.recordRequest({ method: 'POST', path: '/api/auth/login', status: 401, durationMs: 30 });
    }
    for (let i = 0; i < 2; i++) {
      errMetrics.recordRequest({ method: 'GET', path: '/api/crash', status: 500, durationMs: 15 });
    }

    const errSnap = errMetrics.getSnapshot();
    assert(errSnap.eligibleRequestsTotal === 100, 'Eligible requests population equals 100', `got ${errSnap.eligibleRequestsTotal}`);
    assert(errSnap.serverErrorsCount === 2, 'Server errors (5xx) counted as 2', `got ${errSnap.serverErrorsCount}`);
    assert(errSnap.clientErrorsCount === 8, 'Client errors (4xx) counted as 8', `got ${errSnap.clientErrorsCount}`);
    assert(errSnap.serverErrorRatePercent === 2.0, 'Server error rate is exactly 2.0%', `got ${errSnap.serverErrorRatePercent}`);
    assert(errSnap.totalErrorRatePercent === 10.0, 'Total error rate (5xx + 4xx) is 10.0%', `got ${errSnap.totalErrorRatePercent}`);

    // -------------------------------------------------------------
    // TEST 7: Counter Persistence Across Server Restarts
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Cumulative Counter Persistence ---');
    const persistMetrics = new MetricsService();
    
    // Simulate initial process with 50 requests
    persistMetrics.lifetimeBaseline = 1000;
    persistMetrics.processRequestsTotal = 50;
    
    // Flush to MongoDB
    await persistMetrics.flushPersistence();
    
    const savedDoc = await SystemMetric.findOne({ key: 'cumulative_traffic' });
    assert(savedDoc && savedDoc.value === 1050, 'Lifetime total persisted to MongoDB SystemMetric collection', `got ${savedDoc?.value}`);

    // Simulate server restart: new service instance initializes from DB
    const restartedMetrics = new MetricsService();
    await restartedMetrics.initPersistence();
    assert(restartedMetrics.lifetimeBaseline === 1050, 'Baseline loaded from MongoDB after restart', `got ${restartedMetrics.lifetimeBaseline}`);
    assert(restartedMetrics.processRequestsTotal === 0, 'New process counter starts at 0', `got ${restartedMetrics.processRequestsTotal}`);
    
    const restartSnap = restartedMetrics.getSnapshot();
    assert(restartSnap.requestsTotal === 0, 'Process lifetime displays 0 immediately after restart');
    assert(restartSnap.requestsLifetimeTotal === 1050, 'Cumulative lifetime displays continuous total (1050)');

    // -------------------------------------------------------------
    // TEST 8: Live HTTP Admin Endpoint Security & Auth
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Live HTTP Admin Security & Authorization ---');
    
    // Unauthenticated request
    const unauthRes = await request({ path: '/api/admin/metrics', method: 'GET' });
    assert(unauthRes.status === 401, 'Unauthenticated request to /api/admin/metrics returns 401', `got ${unauthRes.status}`);

    // Normal user token (role: 'user')
    let testUser = await User.findOne({ role: 'user' });
    if (!testUser) {
      testUser = new User({
        username: 'test_metrics_user_' + Date.now(),
        password: 'password_test_123',
        role: 'user',
        status: 'active'
      });
      await testUser.save();
    }
    const userToken = generateToken(testUser);
    
    const forbiddenRes = await request({
      path: '/api/admin/metrics',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    assert(forbiddenRes.status === 403, 'Non-admin user token rejected with 403 Forbidden', `got ${forbiddenRes.status}`);

    // Admin user token (role: 'admin')
    let testAdmin = await User.findOne({ role: 'admin' });
    if (!testAdmin) {
      testAdmin = new User({
        username: 'test_metrics_admin_' + Date.now(),
        password: 'admin_password_123',
        role: 'admin',
        status: 'active'
      });
      await testAdmin.save();
    }
    const adminToken = generateToken(testAdmin);

    const authorizedRes = await request({
      path: '/api/admin/metrics',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(authorizedRes.status === 200, 'Admin token successfully returns 200 OK', `got ${authorizedRes.status}`);
    assert(typeof authorizedRes.data?.activeVisitors === 'number', 'Payload contains activeVisitors metric');
    assert(authorizedRes.data?.visitorBreakdown !== undefined, 'Payload contains visitorBreakdown breakdown');
    assert(authorizedRes.data?.requestsBreakdown !== undefined, 'Payload contains requestsBreakdown');
    assert(typeof authorizedRes.data?.p95LatencyMs === 'number', 'Payload contains monotonic p95 latency');

    // Check secrets are redacted
    const healthRes = await request({
      path: '/api/admin/health',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const healthStr = JSON.stringify(healthRes.data);
    assert(!healthStr.includes('mongodb+srv://') && !healthStr.includes(process.env.JWT_SECRET || '___missing___'), 'Health response strictly redacts credentials and secrets');

    console.log('\n===============================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test Suite encountered error:', err);
    process.exit(1);
  }
}

runMetricsAuditTests();
