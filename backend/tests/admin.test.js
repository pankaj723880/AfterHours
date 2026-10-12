import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
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
  console.log('=== STARTING AUTOMATED ADMIN DASHBOARD TEST SUITE ===\n');
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

    // Setup Test Admin
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      admin = new User({
        username: 'test_super_admin_' + Date.now(),
        password: 'admin_password_123',
        role: 'admin',
        status: 'active'
      });
      await admin.save();
    }
    const adminToken = generateToken(admin);

    // Setup Test Normal User
    const regRes = await request({ path: '/api/auth/register', method: 'POST' }, {
      username: 'normal_user_' + Date.now(),
      password: 'normal_password_123',
      role: 'admin' // Attempting privilege escalation
    });

    assert(regRes.status === 200, 'User registration succeeds');
    assert(regRes.data?.user?.role === 'user', 'Client cannot self-assign role "admin" (least privilege enforced)');
    const userToken = regRes.data?.token;

    // Test 1: Anonymous Access Blocked
    const anonRes = await request({ path: '/api/admin/metrics', method: 'GET' });
    assert(anonRes.status === 401, 'Anonymous request to /api/admin/metrics returns 401 Unauthorized');

    // Test 2: Invalid Token Blocked
    const fakeRes = await request({
      path: '/api/admin/metrics',
      method: 'GET',
      headers: { 'Authorization': 'Bearer invalid.tampered.token' }
    });
    assert(fakeRes.status === 401, 'Tampered/invalid JWT returns 401 Unauthorized');

    // Test 3: Normal Authenticated User Forbidden
    const normalRes = await request({
      path: '/api/admin/metrics',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    assert(normalRes.status === 403, 'Normal user with valid JWT denied /api/admin/metrics with 403 Forbidden');

    // Test 4: Admin Access Permitted
    const adminMetrics = await request({
      path: '/api/admin/metrics',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(adminMetrics.status === 200, 'Admin accesses /api/admin/metrics with 200 OK');
    assert(typeof adminMetrics.data?.uptimeSeconds === 'number', 'Metrics returns structured uptime');

    // Test 5: Health Diagnostics Subsystem
    const adminHealth = await request({
      path: '/api/admin/health',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(adminHealth.status === 200, 'Admin accesses /api/admin/health with 200 OK');
    assert(adminHealth.data?.database?.status === 'connected', 'Database status accurately reports connected');

    // Test 6: Paginated Users List
    const usersList = await request({
      path: '/api/admin/users?page=1&limit=5',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(usersList.status === 200, 'Admin lists users with pagination (200 OK)');
    assert(Array.isArray(usersList.data?.users), 'Users returned as array');
    assert(usersList.data?.users.every(u => !u.password), 'Passwords strictly excluded from response');

    // Test 7: Safeguard — Prevent demoting last remaining admin
    // Temporarily ensure admin is the only active admin in DB to test the safeguard
    const otherAdmins = await User.find({ _id: { $ne: admin._id }, role: 'admin' });
    await User.updateMany({ _id: { $ne: admin._id }, role: 'admin' }, { $set: { role: 'user' } });

    const demoteLastAdminRes = await request({
      path: `/api/admin/users/${admin._id}`,
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, { role: 'user' });
    assert(demoteLastAdminRes.status === 400, 'Safeguard blocks demoting the last active administrator');

    // Restore other admins
    if (otherAdmins.length > 0) {
      await User.updateMany({ _id: { $in: otherAdmins.map(a => a._id) } }, { $set: { role: 'admin' } });
    }

    // Test 8: User Update & Audit Log Generation
    const targetUser = regRes.data?.user;
    const updateRes = await request({
      path: `/api/admin/users/${targetUser.id || targetUser.userId}`,
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, { status: 'suspended' });
    assert(updateRes.status === 200, 'Admin updates user status to suspended');

    const latestAudit = await AuditLog.findOne({ targetId: (targetUser.id || targetUser.userId).toString() })
      .sort({ timestamp: -1 });
    assert(latestAudit?.action === 'USER_UPDATE', 'Audit log automatically generated for user update');
    assert(latestAudit?.details?.status?.to === 'suspended', 'Audit log records exact before/after change diff');

    // Test 9: Telemetry Event Recording
    const telemetryRes = await request({
      path: '/api/admin/telemetry/event',
      method: 'POST'
    }, { type: 'play_start', title: 'Test Track Play' });
    assert(telemetryRes.status === 204, 'Telemetry event recorded without error (204 No Content)');

    // Test 10: Music Analytics Aggregation
    const musicAnalytics = await request({
      path: '/api/admin/music-analytics',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(musicAnalytics.status === 200, 'Admin retrieves aggregated music analytics (200 OK)');
    assert(typeof musicAnalytics.data?.summary?.totalRegisteredUsers === 'number', 'Summary contains totalRegisteredUsers');

    console.log(`\n=== TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED ===`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('[TEST ERROR]:', err);
    process.exit(1);
  }
}

runTests();
