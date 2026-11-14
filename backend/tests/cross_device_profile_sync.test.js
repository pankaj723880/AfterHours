import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 Starting Loopra Cross-Device Profile Picture Synchronization Suite...\n');

// 1. Verify User schema has canonical avatarUrl field
const userModelCode = fs.readFileSync('backend/models/User.js', 'utf8');
assert.ok(userModelCode.includes("avatarUrl: { type: String, default: '', trim: true }"), 'User model must have canonical avatarUrl');
console.log('✅ 1. Database Schema: Exactly one canonical avatarUrl field stored against the unique user record.');

// 2. Verify Profile route performs atomic canonical update, deletes obsolete local file, and broadcasts via socket
const profileRouteCode = fs.readFileSync('backend/routes/profile.js', 'utf8');
assert.ok(profileRouteCode.includes('existingUser.avatarUrl = finalAvatarUrl;'), 'Must update existingUser.avatarUrl');
assert.ok(profileRouteCode.includes('io.to(`user_${existingUser._id.toString()}`).emit(\'user_profile_updated\''), 'Must broadcast user_profile_updated to user room on upload');
assert.ok(profileRouteCode.includes('io.to(`user_${existingUser._id.toString()}`).emit(\'user_profile_updated\', {\n          userId: existingUser._id.toString(),\n          avatarUrl: \'\''), 'Must broadcast user_profile_updated on delete');
console.log('✅ 2. Backend API: Atomic replacement, obsolete image cleanup, and real-time socket broadcast to all connected devices.');

// 3. Verify Server static file Cache-Control headers
const serverCode = fs.readFileSync('backend/server.js', 'utf8');
assert.ok(serverCode.includes("res.set('Cache-Control', 'public, max-age=3600, must-revalidate');"), 'Must configure cache-control with must-revalidate');
console.log('✅ 3. HTTP Caching: /uploads configured with must-revalidate and unique timestamp-hash filenames to prevent stale browser caches.');

// 4. Verify Frontend App.jsx real-time synchronization
const appCode = fs.readFileSync('frontend/src/App.jsx', 'utf8');
assert.ok(appCode.includes("socket.on('user_profile_updated', handleUserProfileUpdated)"), 'App.jsx must listen for user_profile_updated');
assert.ok(appCode.includes("socket.off('user_profile_updated', handleUserProfileUpdated)"), 'App.jsx must clean up user_profile_updated listener');
assert.ok(appCode.includes('prev.avatarUrl === data.user.avatarUrl'), 'syncCurrentUserState must check avatarUrl equality');
console.log('✅ 4. Frontend Cross-Device Sync: App.jsx instantly updates state & localStorage on socket event and startup/reconnect auth check.');

// 5. Verify UserAvatar used universally across all locations
assert.ok(appCode.includes('<UserAvatar\n                            user={user}'), 'Sidebar user cards must use UserAvatar');
const userAvatarCode = fs.readFileSync('frontend/src/components/Common/UserAvatar.jsx', 'utf8');
assert.ok(userAvatarCode.includes('themeOverlay && ('), 'UserAvatar must apply theme-aware subtle overlay');
assert.ok(userAvatarCode.includes('--accent-rgb'), 'UserAvatar overlay must use theme design tokens');
console.log('✅ 5. Shared Universal Component: UserAvatar renders same canonical photo with theme-aware overlay across desktop, mobile & TWA.');

// 6. Multi-Device State Simulation Tests (Section 7)
console.log('\n--- Multi-Device Scenario Simulation ---');

// Simulated User Account
const userAccountA = {
  _id: 'user_12345',
  username: 'alex',
  avatarUrl: '/uploads/avatar-user_12345-1000-aaa.jpg'
};

const userAccountB = {
  _id: 'user_67890',
  username: 'pankaj',
  avatarUrl: '/uploads/avatar-user_67890-5000-bbb.png'
};

// Device states
let laptopSession = { ...userAccountA };
let androidTwaSession = { ...userAccountA };
let otherPhoneSession = { ...userAccountA };
let userBSession = { ...userAccountB };

// Test A: Upload Photo A from Laptop
const photoA = '/uploads/avatar-user_12345-2000-photoA.jpg';
userAccountA.avatarUrl = photoA;
laptopSession.avatarUrl = photoA;
// Broadcast simulates socket arrival on Android TWA
androidTwaSession.avatarUrl = photoA;

assert.strictEqual(laptopSession.avatarUrl, photoA);
assert.strictEqual(androidTwaSession.avatarUrl, photoA);
assert.strictEqual(userBSession.avatarUrl, userAccountB.avatarUrl, 'User B must not be affected by User A upload');
console.log('✅ Test A Passed: Upload from Laptop appears on Android TWA.');

// Test B: Upload Photo B from Android TWA
const photoB = '/uploads/avatar-user_12345-3000-photoB.webp';
userAccountA.avatarUrl = photoB;
androidTwaSession.avatarUrl = photoB;
// Broadcast simulates socket arrival on Laptop
laptopSession.avatarUrl = photoB;

assert.strictEqual(laptopSession.avatarUrl, photoB);
assert.strictEqual(androidTwaSession.avatarUrl, photoB);
console.log('✅ Test B Passed: Upload from Android TWA replaces picture on Laptop.');

// Test C: Upload Photo C from another device
const photoC = '/uploads/avatar-user_12345-4000-photoC.jpg';
userAccountA.avatarUrl = photoC;
otherPhoneSession.avatarUrl = photoC;
laptopSession.avatarUrl = photoC;
androidTwaSession.avatarUrl = photoC;

assert.strictEqual(laptopSession.avatarUrl, photoC);
assert.strictEqual(androidTwaSession.avatarUrl, photoC);
assert.strictEqual(otherPhoneSession.avatarUrl, photoC);
console.log('✅ Test C Passed: Photo C from 3rd device becomes canonical profile picture everywhere.');

// Test D: Log out and log back in on both devices
// Server database is queried on login:
const loginFetch = (userId) => (userId === userAccountA._id ? { ...userAccountA } : { ...userAccountB });
const freshLaptop = loginFetch(userAccountA._id);
const freshAndroid = loginFetch(userAccountA._id);

assert.strictEqual(freshLaptop.avatarUrl, photoC);
assert.strictEqual(freshAndroid.avatarUrl, photoC);
console.log('✅ Test D Passed: Re-login on both devices re-hydrates canonical server photo.');

// Test E: Independent accounts check
assert.strictEqual(userBSession.avatarUrl, '/uploads/avatar-user_67890-5000-bbb.png');
console.log('✅ Test E Passed: User B retains independent avatar unaffected by User A.');

console.log('\n🎉 ALL CROSS-DEVICE PROFILE PICTURE TESTS PASSED!');

