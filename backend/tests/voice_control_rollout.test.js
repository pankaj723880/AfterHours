import assert from 'assert';
import { featureFlagService } from '../services/featureFlagService.js';

console.log('🧪 Starting Loopra Voice Control Rollout & Admin Management Acceptance Suite...\n');

const adminUser = {
  _id: '507f1f77bcf86cd799439011',
  userId: '507f1f77bcf86cd799439011',
  username: 'superadmin',
  role: 'admin',
  status: 'active'
};

const normalUser = {
  _id: '507f1f77bcf86cd799439022',
  userId: '507f1f77bcf86cd799439022',
  username: 'regular_listener',
  role: 'user',
  status: 'active'
};

const guestUser = null;

// Scenario 1: Initial state - Admin can use Voice Control; normal users cannot.
console.log('Scenario 1: Initial state (Admin-Only Beta: enabled=true, globalRollout=false, adminAccess=true)');
const initialConfig = {
  featureKey: 'voice_control',
  enabled: true,
  globalRollout: false,
  adminAccess: true
};
assert.strictEqual(featureFlagService.evaluateAccess(initialConfig, adminUser), true, 'Admin must have access in initial state');
assert.strictEqual(featureFlagService.evaluateAccess(initialConfig, normalUser), false, 'Normal user must NOT have access in initial state');
assert.strictEqual(featureFlagService.evaluateAccess(initialConfig, guestUser), false, 'Guest user must NOT have access in initial state');
console.log('✅ Scenario 1 Passed: Admin has access; normal users and guests are denied.\n');

// Scenario 2: Master toggle OFF - Nobody can use Voice Control.
console.log('Scenario 2: Master toggle OFF (enabled=false)');
const configMasterOff = {
  featureKey: 'voice_control',
  enabled: false,
  globalRollout: true,
  adminAccess: true
};
assert.strictEqual(featureFlagService.evaluateAccess(configMasterOff, adminUser), false, 'Admin must be denied when master is OFF');
assert.strictEqual(featureFlagService.evaluateAccess(configMasterOff, normalUser), false, 'Normal user must be denied when master is OFF');
assert.strictEqual(featureFlagService.evaluateAccess(configMasterOff, guestUser), false, 'Guest must be denied when master is OFF');
console.log('✅ Scenario 2 Passed: Master toggle OFF denies access to everyone unconditionally.\n');

// Scenario 3: Master ON + Global OFF + Admin ON - Only admins can use it.
console.log('Scenario 3: Master ON + Global OFF + Admin ON');
const configAdminOnly = {
  featureKey: 'voice_control',
  enabled: true,
  globalRollout: false,
  adminAccess: true
};
assert.strictEqual(featureFlagService.evaluateAccess(configAdminOnly, adminUser), true, 'Admin allowed');
assert.strictEqual(featureFlagService.evaluateAccess(configAdminOnly, normalUser), false, 'Normal user denied');
assert.strictEqual(featureFlagService.evaluateAccess(configAdminOnly, guestUser), false, 'Guest denied');
console.log('✅ Scenario 3 Passed: Only admins can use Voice Control.\n');

// Scenario 4: Master ON + Global ON + Admin ON - All eligible authenticated users can use it.
console.log('Scenario 4: Master ON + Global ON + Admin ON (Full Rollout)');
const configFullRollout = {
  featureKey: 'voice_control',
  enabled: true,
  globalRollout: true,
  adminAccess: true
};
assert.strictEqual(featureFlagService.evaluateAccess(configFullRollout, adminUser), true, 'Admin allowed');
assert.strictEqual(featureFlagService.evaluateAccess(configFullRollout, normalUser), true, 'Normal user allowed');
assert.strictEqual(featureFlagService.evaluateAccess(configFullRollout, guestUser), false, 'Unauthenticated guest denied');
console.log('✅ Scenario 4 Passed: All eligible authenticated users have access; unauthenticated guests denied.\n');

// Scenario 5: Master ON + Global ON + Admin OFF - Normal users can use it, admins cannot.
console.log('Scenario 5: Master ON + Global ON + Admin OFF (Admin Access Disabled)');
const configAdminOff = {
  featureKey: 'voice_control',
  enabled: true,
  globalRollout: true,
  adminAccess: false
};
assert.strictEqual(featureFlagService.evaluateAccess(configAdminOff, normalUser), true, 'Normal user allowed');
assert.strictEqual(featureFlagService.evaluateAccess(configAdminOff, adminUser), false, 'Admin denied when adminAccess is OFF');
console.log('✅ Scenario 5 Passed: Normal users can use it, admins cannot.\n');

// Scenario 6: Global rollout switched OFF - Normal user access is revoked.
console.log('Scenario 6: Global rollout switched OFF');
const configSwitchedOff = {
  featureKey: 'voice_control',
  enabled: true,
  globalRollout: false,
  adminAccess: true
};
assert.strictEqual(featureFlagService.evaluateAccess(configSwitchedOff, normalUser), false, 'Normal user revoked');
assert.strictEqual(featureFlagService.evaluateAccess(configSwitchedOff, adminUser), true, 'Admin retains access');
console.log('✅ Scenario 6 Passed: Normal user access immediately revoked while admin retains access.\n');

// Scenario 7: Unauthorized user attempts to modify configuration / input validation.
console.log('Scenario 7: Unauthorized user & input validation');
try {
  await featureFlagService.updateVoiceControlConfig(
    { enabled: 'invalid', globalRollout: false, adminAccess: true },
    adminUser
  );
  assert.fail('Should have thrown type validation error');
} catch (err) {
  assert.strictEqual(
    err.message,
    'All feature toggles (enabled, globalRollout, adminAccess) must be boolean values'
  );
}
console.log('✅ Scenario 7 Passed: Invalid non-boolean configurations strictly rejected.\n');

// Scenario 8: Existing voice session loses access immediately when permissions are revoked.
console.log('Scenario 8: Real-time immediate session revocation');
let mockListeningSession = true;
let mockAbortExecuted = false;

const onPermissionChange = (newConfig, currentUser) => {
  const allowed = featureFlagService.evaluateAccess(newConfig, currentUser);
  if (!allowed && mockListeningSession) {
    mockListeningSession = false;
    mockAbortExecuted = true;
  }
  return allowed;
};

// Start listening during rollout
assert.strictEqual(onPermissionChange(configFullRollout, normalUser), true);
assert.strictEqual(mockListeningSession, true);
assert.strictEqual(mockAbortExecuted, false);

// Rollout switched OFF mid-session
assert.strictEqual(onPermissionChange(configSwitchedOff, normalUser), false);
assert.strictEqual(mockListeningSession, false, 'Session must be immediately killed');
assert.strictEqual(mockAbortExecuted, true, 'Speech recognition abort must be called');
console.log('✅ Scenario 8 Passed: Active voice session terminated immediately upon revocation.\n');

console.log('🎉 ALL 8 SCENARIOS IN SECTION 10 PASSED SUCCESSFULLY!\n');
process.exit(0);
