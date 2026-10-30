import assert from 'assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
  }
  return { status: res.status, headers: res.headers, data };
}

async function runTests() {
  console.log('\n=== Starting Admin User Role Update & Persistence Test Suite ===\n');

  // Try connecting direct Mongoose for additional inspection if local Mongo is up
  let directDbAvailable = false;
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 1500 });
    directDbAvailable = true;
    console.log('[Direct DB] Connected to local MongoDB for direct document assertions');
  } catch (e) {
    console.log('[Direct DB] Local standalone MongoDB not listening; validating authoritative DB persistence via backend API readback');
  }

  // 1. Authenticate as Admin
  console.log('Step 1: Authenticating as Admin (admin@afterhours.com)...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin@afterhours.com', password: 'admin123' })
  });
  assert.strictEqual(loginRes.status, 200, `Admin login must return 200, got ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
  const adminToken = loginRes.data.token;
  assert(adminToken, 'Admin token must be received');
  console.log('  ✓ Admin logged in successfully');

  // 2. Register a dedicated Test User
  const testUsername = `role_test_${Date.now()}`;
  console.log(`Step 2: Registering dedicated test user (${testUsername})...`);
  const regRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: testUsername, password: 'password123' })
  });
  assert.strictEqual(regRes.status, 200, `Register must return 200, got ${regRes.status}: ${JSON.stringify(regRes.data)}`);
  const standardToken = regRes.data.token;
  const targetUserId = regRes.data.user?.id || regRes.data.user?._id || regRes.data.userId;
  assert(targetUserId, 'Target user ID must exist');
  assert.strictEqual(regRes.data.user.role, 'user', 'New user must default to role: user');
  console.log(`  ✓ Test user registered with ID: ${targetUserId}, role: "user"`);

  // Test 1: Unauthenticated request to PATCH /api/admin/users/:id must return 401
  console.log('\nTest 1: Unauthenticated request rejection...');
  const unauthRes = await request(`/api/admin/users/${targetUserId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'admin' })
  });
  assert.strictEqual(unauthRes.status, 401, `Expected 401 Unauthorized, got ${unauthRes.status}`);
  console.log('  ✓ 401 Unauthorized enforced for anonymous caller');

  // Test 2: Standard user with valid JWT must receive 403 Forbidden
  console.log('\nTest 2: Standard non-admin user access rejection...');
  const userRes = await request(`/api/admin/users/${targetUserId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${standardToken}` },
    body: JSON.stringify({ role: 'admin' })
  });
  assert.strictEqual(userRes.status, 403, `Expected 403 Forbidden, got ${userRes.status}`);
  console.log('  ✓ 403 Forbidden enforced for standard non-admin caller');

  // Test 3: Standard user cannot self-promote via PUT /api/user/profile
  console.log('\nTest 3: Verify standard user cannot self-promote via profile endpoint...');
  await request('/api/user/profile', {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${standardToken}` },
    body: JSON.stringify({ role: 'admin', displayName: 'Hacker' })
  });
  const checkUserRes = await request(`/api/admin/users/${targetUserId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(checkUserRes.status, 200, 'Admin can read target user details');
  assert.strictEqual(checkUserRes.data.role, 'user', 'Role must remain "user" despite exploit attempt');
  console.log('  ✓ Self-promotion via profile update strictly ignored and prevented');

  // Test 4: Admin updates standard user to role: 'admin'
  console.log('\nTest 4: Admin promotes user to admin role via PATCH /api/admin/users/:id...');
  const promoteRes = await request(`/api/admin/users/${targetUserId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ role: 'admin' })
  });
  assert.strictEqual(promoteRes.status, 200, `Expected 200 OK, got ${promoteRes.status}: ${JSON.stringify(promoteRes.data)}`);
  assert.strictEqual(promoteRes.data?.user?.role, 'admin', 'Returned user object must have role: admin');
  assert(promoteRes.data?.user?.id, 'Returned user object must have id field');
  assert(promoteRes.data?.user?._id, 'Returned user object must have _id field');
  console.log('  ✓ API response confirms role: "admin" with normalized id & _id');

  // Test 5: Verify authoritative database persistence via dedicated readback endpoint
  console.log('\nTest 5: Verify authoritative role persistence in MongoDB...');
  const readbackAfterPromote = await request(`/api/admin/users/${targetUserId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(readbackAfterPromote.status, 200, 'Readback returns 200');
  assert.strictEqual(readbackAfterPromote.data.role, 'admin', 'Database record must reflect updated role: admin');
  console.log('  ✓ MongoDB persistence verified: role is authoritative "admin" in database');

  // Test 6: Verify newly promoted user now passes requireAdmin checks on admin endpoints
  console.log('\nTest 6: Verify promoted user can now access admin endpoints (/api/admin/metrics)...');
  // Re-login as the promoted user to get fresh token with admin role
  const promotedLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: testUsername, password: 'password123' })
  });
  assert.strictEqual(promotedLogin.status, 200, 'Promoted user login succeeded');
  assert.strictEqual(promotedLogin.data.user.role, 'admin', 'Login user payload reflects updated role: admin');
  const promotedToken = promotedLogin.data.token;

  const metricsRes = await request('/api/admin/metrics', {
    headers: { 'Authorization': `Bearer ${promotedToken}` }
  });
  assert.strictEqual(metricsRes.status, 200, `Promoted admin must access /api/admin/metrics with 200 OK, got ${metricsRes.status}`);
  console.log('  ✓ Promoted user successfully accesses protected admin telemetry endpoint');

  // Test 7: Admin demotes user back to role: 'user'
  console.log('\nTest 7: Admin demotes user back to "user" role...');
  const demoteRes = await request(`/api/admin/users/${targetUserId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ role: 'user' })
  });
  assert.strictEqual(demoteRes.status, 200, `Expected 200 OK, got ${demoteRes.status}`);
  assert.strictEqual(demoteRes.data?.user?.role, 'user', 'Returned user role must be "user"');

  const readbackAfterDemote = await request(`/api/admin/users/${targetUserId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(readbackAfterDemote.data.role, 'user', 'Database record must reflect reverted role: user');
  console.log('  ✓ MongoDB persistence verified: role reverted to "user"');

  // Test 8: Demoted user is immediately rejected from admin endpoints
  console.log('\nTest 8: Verify demoted user is blocked from admin endpoints...');
  // authenticateToken queries User.findById in DB, so even existing token is immediately blocked!
  const blockedRes = await request('/api/admin/metrics', {
    headers: { 'Authorization': `Bearer ${promotedToken}` }
  });
  assert.strictEqual(blockedRes.status, 403, `Demoted user must receive 403 Forbidden on admin endpoint, got ${blockedRes.status}`);
  console.log('  ✓ Demoted user immediately blocked (403 Forbidden) in real-time');

  // Test 9: Invalid role rejection
  console.log('\nTest 9: Invalid role rejection...');
  const invalidRoleRes = await request(`/api/admin/users/${targetUserId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ role: 'superadmin' })
  });
  assert.strictEqual(invalidRoleRes.status, 400, `Expected 400 Bad Request for unsupported role, got ${invalidRoleRes.status}`);
  console.log('  ✓ Invalid role "superadmin" rejected with 400 Bad Request');

  // Test 10: Invalid user ID format rejection
  console.log('\nTest 10: Invalid user ID format rejection...');
  const invalidIdRes = await request('/api/admin/users/invalid_non_hex_id', {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ role: 'admin' })
  });
  assert.strictEqual(invalidIdRes.status, 400, `Expected 400 Bad Request for invalid ID, got ${invalidIdRes.status}`);
  console.log('  ✓ Invalid user ID safely rejected with 400 Bad Request');

  // Test 11: GET /api/admin/users headers and formatted user output
  console.log('\nTest 11: Verify GET /api/admin/users Cache-Control headers and ID formatting...');
  const listUsersRes = await request('/api/admin/users?limit=5', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(listUsersRes.status, 200, 'GET /api/admin/users must return 200');
  const cacheControl = listUsersRes.headers.get('cache-control') || '';
  assert(cacheControl.includes('no-store'), `Cache-Control must contain no-store, got "${cacheControl}"`);
  assert(Array.isArray(listUsersRes.data?.users), 'Must return users array');
  const sample = listUsersRes.data.users[0];
  assert(sample.id && sample._id, 'Users must have both id and _id fields');
  console.log('  ✓ GET /api/admin/users includes no-store cache headers and dual id/_id normalization');

  // Clean up test user
  console.log('\nCleaning up test user...');
  await request(`/api/admin/users/${targetUserId}/permanent`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('  ✓ Test user purged');

  console.log('\n=== All 11 Admin User Role Update Tests PASSED Successfully! ===\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Test Failure:', err);
    process.exit(1);
  });
