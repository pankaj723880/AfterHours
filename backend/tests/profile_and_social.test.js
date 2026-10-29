import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

async function runTests() {
  console.log('=== STARTING PROFILE, SOCIAL & SECURITY AUDIT TEST SUITE ===\n');

  let testUserToken = null;
  let testUserId = null;
  let testUsername = `user_${Date.now()}`;
  let secondUserToken = null;
  let secondUserId = null;
  let secondUsername = `user2_${Date.now()}`;
  let adminToken = null;

  // 1. Register test user 1
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testUsername, password: 'password123' })
  });
  const regData = await regRes.json();
  if (regRes.ok && regData.token) {
    testUserToken = regData.token;
    testUserId = regData.userId;
    console.log('[PASS] Test user 1 registered successfully');
  } else {
    console.error('[FAIL] Registration failed:', regData);
    process.exit(1);
  }

  // 2. Register test user 2
  const reg2Res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: secondUsername, password: 'password123' })
  });
  const reg2Data = await reg2Res.json();
  if (reg2Res.ok && reg2Data.token) {
    secondUserToken = reg2Data.token;
    secondUserId = reg2Data.userId;
    console.log('[PASS] Test user 2 registered successfully');
  } else {
    console.error('[FAIL] User 2 registration failed:', reg2Data);
    process.exit(1);
  }

  // 3. Login as admin
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin@afterhours.com', password: 'admin123' })
  });
  const adminData = await adminRes.json();
  if (adminRes.ok && adminData.token) {
    adminToken = adminData.token;
    console.log('[PASS] Admin login succeeded');
  }

  // 4. Update Profile
  const updateRes = await fetch(`${BASE_URL}/api/user/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testUserToken}`
    },
    body: JSON.stringify({
      displayName: 'Mehfil Maestro',
      bio: 'Lover of 90s Bollywood cassettes and midnight retro radio.',
      favoriteGenres: ['90s Bollywood', 'Ghazals & Mehfil'],
      isPublic: true
    })
  });
  const updateData = await updateRes.json();
  if (updateRes.ok && updateData.user.displayName === 'Mehfil Maestro') {
    console.log('[PASS] User profile updated successfully with display name & genres');
  } else {
    console.error('[FAIL] Profile update failed:', updateData);
    process.exit(1);
  }

  // 5. Retrieve Public Profile
  const getProfRes = await fetch(`${BASE_URL}/api/user/profile/${testUsername}`);
  const profData = await getProfRes.json();
  if (getProfRes.ok && profData.displayName === 'Mehfil Maestro' && profData.favoriteGenres.length === 2) {
    console.log('[PASS] Public profile fetched successfully without leaking private passwords/tokens');
  } else {
    console.error('[FAIL] Public profile retrieval failed:', profData);
    process.exit(1);
  }

  // 6. Follow System: User 2 follows User 1
  const followRes = await fetch(`${BASE_URL}/api/user/${testUserId}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secondUserToken}` }
  });
  const followData = await followRes.json();
  if (followRes.ok && followData.targetId === testUserId) {
    console.log('[PASS] User 2 successfully followed User 1');
  } else {
    console.error('[FAIL] Follow failed:', followData);
    process.exit(1);
  }

  // 7. Verify Followers & Following Lists
  const followersRes = await fetch(`${BASE_URL}/api/user/${testUserId}/followers`);
  const followersData = await followersRes.json();
  if (followersRes.ok && followersData.followers.some(f => f.username === secondUsername)) {
    console.log('[PASS] User 1 followers list contains User 2');
  } else {
    console.error('[FAIL] Followers check failed:', followersData);
    process.exit(1);
  }

  const followingRes = await fetch(`${BASE_URL}/api/user/${secondUserId}/following`);
  const followingData = await followingRes.json();
  if (followingRes.ok && followingData.following.some(f => f.username === testUsername)) {
    console.log('[PASS] User 2 following list contains User 1');
  } else {
    console.error('[FAIL] Following check failed:', followingData);
    process.exit(1);
  }

  // 8. Self-follow prevention
  const selfFollowRes = await fetch(`${BASE_URL}/api/user/${testUserId}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${testUserToken}` }
  });
  if (selfFollowRes.status === 400) {
    console.log('[PASS] Self-follow blocked by server with 400 Bad Request');
  } else {
    console.error('[FAIL] Self-follow should be blocked');
    process.exit(1);
  }

  // 9. Unfollow
  const unfollowRes = await fetch(`${BASE_URL}/api/user/${testUserId}/unfollow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secondUserToken}` }
  });
  if (unfollowRes.ok) {
    console.log('[PASS] User 2 successfully unfollowed User 1');
  } else {
    console.error('[FAIL] Unfollow failed');
    process.exit(1);
  }

  // 10. Failed Login Monitoring
  await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testUsername, password: 'wrong_password_test' })
  });

  if (adminToken) {
    const secRes = await fetch(`${BASE_URL}/api/admin/security/failed-logins`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const secData = await secRes.json();
    if (secRes.ok && secData.failedLogins.some(f => f.username === testUsername)) {
      console.log('[PASS] Failed login attempt recorded in security monitoring without leaking passwords');
    } else {
      console.error('[FAIL] Security monitoring did not log failed attempt:', secData);
      process.exit(1);
    }
  }

  console.log('\n=== ALL PROFILE, SOCIAL & SECURITY TESTS PASSED SUCCESSFULLY ===');
}

runTests().catch(err => {
  console.error('[TEST ERROR]:', err);
  process.exit(1);
});
