import assert from 'assert';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000';

async function request(reqPath, options = {}) {
  const url = `${BASE_URL}${reqPath}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let body = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else if (contentType.includes('image/') || contentType.includes('application/octet-stream')) {
    const ab = await res.arrayBuffer();
    body = Buffer.from(ab);
  } else {
    body = await res.text();
  }
  return { status: res.status, headers: res.headers, body };
}

// 1x1 transparent PNG data URI
const VALID_1X1_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// 1x1 white JPEG data URI
const VALID_1X1_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function runTests() {
  console.log('=== Starting Profile Avatar & Sidebar Verification Test Suite ===\n');

  // Test 1: Health check
  const health = await request('/health');
  assert.strictEqual(health.status, 200, 'Health check should be 200 OK');
  console.log('✓ Test 1: Server and health check are responsive (200 OK)');

  // Test 2: User A Registration & Authentication
  const userA_name = `user_a_${Date.now()}`;
  const regA = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: userA_name, password: 'passwordA123' })
  });
  assert.strictEqual(regA.status, 200);
  const tokenA = regA.body.token;
  assert.ok(tokenA, 'User A token must exist');
  console.log(`✓ Test 2: User A (${userA_name}) registered and authenticated.`);

  // Test 3: User B Registration & Authentication (for isolation testing)
  const userB_name = `user_b_${Date.now()}`;
  const regB = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: userB_name, password: 'passwordB123' })
  });
  assert.strictEqual(regB.status, 200);
  const tokenB = regB.body.token;
  console.log(`✓ Test 3: User B (${userB_name}) registered for isolation testing.`);

  // Test 4: Unauthenticated avatar upload rejection
  console.log('\nTest 4: Attempting avatar upload without token...');
  const unauthUpload = await request('/api/user/profile/avatar', {
    method: 'POST',
    body: JSON.stringify({ image: VALID_1X1_PNG })
  });
  assert.strictEqual(unauthUpload.status, 401, 'Unauthenticated upload must return 401 Unauthorized');
  console.log('✓ Test 4 Passed: Unauthenticated request rejected with HTTP 401.');

  // Test 5: Unsupported file format rejection
  console.log('\nTest 5: Attempting upload with unsupported format (text/plain)...');
  const fakeFormat = await request('/api/user/profile/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ image: 'data:text/plain;base64,SGVsbG8gd29ybGQ=' })
  });
  assert.strictEqual(fakeFormat.status, 400, 'Unsupported format must return 400 Bad Request');
  assert.ok(fakeFormat.body.error.includes('Unsupported image format'));
  console.log('✓ Test 5 Passed: Unsupported format rejected with HTTP 400.');

  // Test 6: Corrupted image content rejection (magic bytes mismatch)
  console.log('\nTest 6: Attempting upload with spoofed MIME type (fake PNG magic bytes)...');
  const spoofedImage = await request('/api/user/profile/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ image: 'data:image/png;base64,ZmFrZSBpbWFnZSBjb250ZW50IHRoYXQgaXMgbm90IHBuZw==' })
  });
  assert.strictEqual(spoofedImage.status, 400, 'Corrupted / spoofed image must return 400 Bad Request');
  assert.ok(spoofedImage.body.error.includes('corrupted') || spoofedImage.body.error.includes('Invalid'));
  console.log('✓ Test 6 Passed: Magic bytes validation rejected spoofed image content.');

  // Test 7: Oversized image rejection (> 5MB)
  console.log('\nTest 7: Attempting upload with oversized image (> 5MB)...');
  // Generate a buffer > 5MB
  const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024, 0x00);
  // Give it valid PNG header so size check triggers
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).copy(largeBuffer, 0);
  const largeDataUrl = `data:image/png;base64,${largeBuffer.toString('base64')}`;

  const oversizedRes = await request('/api/user/profile/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ image: largeDataUrl })
  });
  assert.strictEqual(oversizedRes.status, 400, 'Oversized image must return 400 Bad Request');
  assert.ok(oversizedRes.body.error.includes('5MB'));
  console.log('✓ Test 7 Passed: Oversized file rejected with HTTP 400.');

  // Test 8: Valid PNG avatar upload
  console.log('\nTest 8: Uploading valid PNG profile image for User A...');
  const uploadRes = await request('/api/user/profile/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ image: VALID_1X1_PNG })
  });
  assert.strictEqual(uploadRes.status, 200, 'Valid avatar upload should succeed');
  assert.strictEqual(uploadRes.body.success, true);
  assert.ok(uploadRes.body.avatarUrl, 'Must return avatarUrl');
  assert.ok(uploadRes.body.avatarUrl.startsWith('/uploads/avatar-'), 'avatarUrl must be stored under /uploads/avatar-');
  const firstAvatarUrl = uploadRes.body.avatarUrl;
  console.log(`✓ Test 8 Passed: User A avatar uploaded successfully -> ${firstAvatarUrl}`);

  // Test 9: Verify avatar file is accessible via HTTP GET
  console.log('\nTest 9: Verifying uploaded image is accessible via static server endpoint...');
  const getImgRes = await request(firstAvatarUrl);
  assert.strictEqual(getImgRes.status, 200, 'Uploaded image must return 200 OK');
  assert.ok(Buffer.isBuffer(getImgRes.body), 'Must return binary image data');
  assert.ok(getImgRes.body.length > 0, 'Image buffer must not be empty');
  console.log(`✓ Test 9 Passed: Image bytes verified (${getImgRes.body.length} bytes delivered).`);

  // Test 10: Verify persistence on /api/auth/me and /api/user/profile/:username
  console.log('\nTest 10: Verifying persistence on /api/auth/me and profile GET...');
  const meRes = await request('/api/auth/me', {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.strictEqual(meRes.status, 200);
  assert.strictEqual(meRes.body.user.avatarUrl, firstAvatarUrl, 'Auth me must return uploaded avatarUrl');

  const profileRes = await request(`/api/user/profile/${userA_name}`);
  assert.strictEqual(profileRes.status, 200);
  assert.strictEqual(profileRes.body.avatarUrl, firstAvatarUrl, 'Profile lookup must return uploaded avatarUrl');
  console.log('✓ Test 10 Passed: Avatar persistently stored and returned on profile APIs.');

  // Test 11: Replacing avatar cleans up old file and updates to new URL
  console.log('\nTest 11: Uploading replacement JPEG avatar to test replacement and cleanup...');
  const replaceRes = await request('/api/user/profile/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ image: VALID_1X1_JPEG })
  });
  assert.strictEqual(replaceRes.status, 200);
  const secondAvatarUrl = replaceRes.body.avatarUrl;
  assert.ok(secondAvatarUrl.startsWith('/uploads/avatar-'));
  assert.notStrictEqual(secondAvatarUrl, firstAvatarUrl, 'New avatar should have unique URL');

  // Verify old image was removed from disk
  const oldFilename = path.basename(firstAvatarUrl);
  const oldDiskPath = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'public', 'uploads', oldFilename);
  assert.strictEqual(fs.existsSync(oldDiskPath), false, 'Previous avatar file should be removed from disk');
  console.log('✓ Test 11 Passed: Replacement avatar saved, and old avatar was safely cleaned up.');

  // Test 12: User isolation - User B cannot modify User A's avatar
  console.log('\nTest 12: Verifying user isolation (User B token only updates User B)...');
  const userB_profileBefore = await request(`/api/user/profile/${userB_name}`);
  assert.strictEqual(userB_profileBefore.body.avatarUrl, '', 'User B initially has no avatar');

  const uploadB = await request('/api/user/profile/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ image: VALID_1X1_PNG })
  });
  assert.strictEqual(uploadB.status, 200);
  assert.strictEqual(uploadB.body.user.username, userB_name, 'Upload applies only to User B');

  // User A avatar should be unchanged
  const userA_check = await request(`/api/user/profile/${userA_name}`);
  assert.strictEqual(userA_check.body.avatarUrl, secondAvatarUrl, "User A avatar was unaffected by User B's action");
  console.log("✓ Test 12 Passed: Strong user isolation verified; users can update only their own profile.");

  // Test 13: Sidebar Code Inspection Verification
  console.log('\nTest 13: Verifying removal of sidebar navigation items in App.jsx...');
  const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '..');
  const appJsxPath = path.join(projectRoot, 'frontend', 'src', 'App.jsx');
  const appJsxContent = fs.readFileSync(appJsxPath, 'utf-8');
  
  // The sidebar aside block starts at <aside and ends at </aside>
  const asideMatch = appJsxContent.match(/<aside[\s\S]*?<\/aside>/);
  assert.ok(asideMatch, '<aside> sidebar must exist in App.jsx');
  const sidebarHtml = asideMatch[0];

  assert.strictEqual(sidebarHtml.includes('handleStationSelect(\'romance\')'), false, 'Pehla Nasha (romance) must not be in sidebar');
  assert.strictEqual(sidebarHtml.includes('handleStationSelect(\'sad_songs\')'), false, 'Dard-E-Dil (sad_songs) must not be in sidebar');
  assert.strictEqual(sidebarHtml.includes('handleStationSelect(\'chill\')'), false, 'Mehfil Lounge (chill) must not be in sidebar');
  assert.strictEqual(sidebarHtml.includes('handleStationSelect(\'downloads\')'), false, 'Downloads must not be in sidebar');
  console.log('✓ Test 13 Passed: Pehla Nasha, Dard-E-Dil, Mehfil Lounge, and Downloads are completely removed from sidebar.');

  // Test 14: UserProfileModal Code Inspection Verification
  console.log('\nTest 14: Verifying removal of Followers and Following from UserProfileModal.jsx...');
  const modalPath = path.join(projectRoot, 'frontend', 'src', 'components', 'Profile', 'UserProfileModal.jsx');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');
  assert.strictEqual(modalContent.includes('followersCount'), false, 'followersCount state must be removed from modal');
  assert.strictEqual(modalContent.includes('followingCount'), false, 'followingCount state must be removed from modal');
  assert.strictEqual(modalContent.includes('Followers</p>'), false, 'Followers UI label must be removed');
  assert.strictEqual(modalContent.includes('Following</p>'), false, 'Following UI label must be removed');
  assert.ok(modalContent.includes('handleFileChange'), 'Avatar upload handler must exist in modal');
  assert.ok(modalContent.includes('handleSaveAvatar'), 'Avatar save handler must exist in modal');
  console.log('✓ Test 14 Passed: Followers and Following are absent from profile UI; photo upload handlers verified.');

  console.log('\n================================================================');
  console.log('ALL 14 PROFILE AVATAR & SIDEBAR TESTS PASSED PERFECTLY!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
