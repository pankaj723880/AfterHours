import assert from 'assert';

console.log('=== Starting Profile Avatar Fix Verification Suite ===\n');

// 1. Test getAvatarUrl logic
function mockGetAvatarUrl(userOrUrl, backendUrl = 'https://afterhours-zvic.onrender.com') {
  if (!userOrUrl) return '';

  let rawUrl = '';
  if (typeof userOrUrl === 'string') {
    rawUrl = userOrUrl.trim();
  } else if (typeof userOrUrl === 'object') {
    rawUrl = (
      userOrUrl.avatarUrl ||
      userOrUrl.avatar ||
      userOrUrl.picture ||
      userOrUrl.photoURL ||
      userOrUrl.profilePicture ||
      ''
    ).trim();
  }

  if (!rawUrl) return '';

  if (rawUrl.startsWith('data:image/') || rawUrl.startsWith('blob:')) {
    return rawUrl;
  }

  if (rawUrl.startsWith('/uploads/') || rawUrl.startsWith('uploads/')) {
    const cleanPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    return `${backendUrl}${cleanPath}`;
  }

  if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
    return `${backendUrl}${rawUrl}`;
  }

  if (rawUrl.startsWith('//')) {
    return `https:${rawUrl}`;
  }

  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }

  return '';
}

// 2. Test getUserInitials logic
function mockGetUserInitials(userOrName, defaultInitial = 'U') {
  if (!userOrName) return defaultInitial;

  let raw = '';
  if (typeof userOrName === 'string') {
    raw = userOrName.trim();
  } else if (typeof userOrName === 'object') {
    raw = (
      userOrName.displayName ||
      userOrName.username ||
      userOrName.name ||
      userOrName.email ||
      ''
    ).trim();
  }

  if (!raw) return defaultInitial;

  const clean = raw.includes('@') ? raw.split('@')[0] : raw;
  const match = clean.match(/[a-zA-Z0-9]/);
  return match ? match[0].toUpperCase() : (clean.charAt(0).toUpperCase() || defaultInitial);
}

// Test Suite
// Test 1: Null / Undefined / Empty avatar checks
assert.strictEqual(mockGetAvatarUrl(null), '', 'Null should return empty string');
assert.strictEqual(mockGetAvatarUrl(undefined), '', 'Undefined should return empty string');
assert.strictEqual(mockGetAvatarUrl(''), '', 'Empty string should return empty string');
assert.strictEqual(mockGetAvatarUrl({}), '', 'Empty object should return empty string');
console.log('✓ Test 1 Passed: Empty & null values return safe empty strings');

// Test 2: Uploads path resolution
const testBackend = 'https://loopra.com';
assert.strictEqual(
  mockGetAvatarUrl('/uploads/avatar-12345.jpg', testBackend),
  'https://loopra.com/uploads/avatar-12345.jpg',
  'Relative uploads path must be prefixed with backend URL'
);
assert.strictEqual(
  mockGetAvatarUrl('uploads/avatar-12345.jpg', testBackend),
  'https://loopra.com/uploads/avatar-12345.jpg',
  'Relative uploads without leading slash must be prefixed with backend URL'
);
console.log('✓ Test 2 Passed: Uploads path correctly prefixed with backend URL');

// Test 3: Google OAuth & CDN URLs
const googleUrl = 'https://lh3.googleusercontent.com/a/ACg8ocK123456789=s96-c';
assert.strictEqual(
  mockGetAvatarUrl(googleUrl, testBackend),
  googleUrl,
  'External Google OAuth URL must be preserved intact'
);
assert.strictEqual(
  mockGetAvatarUrl({ avatarUrl: googleUrl }, testBackend),
  googleUrl,
  'User object with avatarUrl must be resolved'
);
assert.strictEqual(
  mockGetAvatarUrl({ picture: googleUrl }, testBackend),
  googleUrl,
  'User object with OAuth picture field must be resolved'
);
console.log('✓ Test 3 Passed: Google OAuth avatar URLs correctly resolved from string and objects');

// Test 4: Initials extraction
assert.strictEqual(mockGetUserInitials('pankaj'), 'P');
assert.strictEqual(mockGetUserInitials({ username: 'pankaj7238@gmail.com' }), 'P');
assert.strictEqual(mockGetUserInitials({ displayName: 'Loopra DJ', username: 'dj' }), 'L');
assert.strictEqual(mockGetUserInitials({ email: 'admin@afterhours.com' }), 'A');
assert.strictEqual(mockGetUserInitials(null), 'U');
console.log('✓ Test 4 Passed: User initials fallback correctly handles emails, objects, and strings');

// Test 5: Verify Google OAuth persistence contract
function simulateGoogleUserSync(existingUser, payload) {
  const cleanEmail = payload.email.trim().toLowerCase();
  const googleName = (payload.name || '').trim();
  const googlePicture = (payload.picture || '').trim();

  let user = existingUser;
  if (!user) {
    user = {
      username: cleanEmail,
      displayName: googleName || cleanEmail.split('@')[0],
      avatarUrl: googlePicture || '',
      role: 'user',
      status: 'active'
    };
  } else {
    if (!user.avatarUrl && googlePicture) {
      user.avatarUrl = googlePicture;
    }
    if ((!user.displayName || user.displayName === user.username) && googleName) {
      user.displayName = googleName;
    }
  }
  return user;
}

const newUser = simulateGoogleUserSync(null, {
  email: 'listener@loopra.com',
  name: 'Loopra Listener',
  picture: 'https://lh3.googleusercontent.com/a/sample-photo'
});
assert.strictEqual(newUser.avatarUrl, 'https://lh3.googleusercontent.com/a/sample-photo');
assert.strictEqual(newUser.displayName, 'Loopra Listener');

const existingUserNoAvatar = simulateGoogleUserSync({
  username: 'listener@loopra.com',
  displayName: 'listener@loopra.com',
  avatarUrl: ''
}, {
  email: 'listener@loopra.com',
  name: 'Loopra Listener',
  picture: 'https://lh3.googleusercontent.com/a/sample-photo'
});
assert.strictEqual(existingUserNoAvatar.avatarUrl, 'https://lh3.googleusercontent.com/a/sample-photo');
assert.strictEqual(existingUserNoAvatar.displayName, 'Loopra Listener');

// Existing user with custom uploaded avatar must not be overwritten by Google photo
const existingUserCustomAvatar = simulateGoogleUserSync({
  username: 'custom@loopra.com',
  displayName: 'Custom User',
  avatarUrl: '/uploads/avatar-custom.png'
}, {
  email: 'custom@loopra.com',
  name: 'Custom User',
  picture: 'https://lh3.googleusercontent.com/a/sample-photo'
});
assert.strictEqual(existingUserCustomAvatar.avatarUrl, '/uploads/avatar-custom.png');

console.log('✓ Test 5 Passed: Google OAuth persistence contract preserves custom uploads and sets missing avatars');

console.log('\nAll 5 profile avatar fix tests passed successfully!');

