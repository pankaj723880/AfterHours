import assert from 'assert';

// Test the UI rollout permission evaluation logic directly
function evaluateVoiceAccess(voiceConfig, user) {
  const masterEnabled = Boolean(
    typeof voiceConfig.voiceControlEnabled === 'boolean'
      ? voiceConfig.voiceControlEnabled
      : voiceConfig.masterEnabled ?? voiceConfig.enabled
  );

  const publicRollout = Boolean(
    typeof voiceConfig.enableVoiceControlForAllUsers === 'boolean'
      ? voiceConfig.enableVoiceControlForAllUsers
      : voiceConfig.publicRollout ?? voiceConfig.globalRollout
  );

  const isAdmin = Boolean(user && (user.isAdmin === true || user.role === 'admin'));

  const canAccessVoice = masterEnabled && (publicRollout || isAdmin);

  return {
    canAccessVoice,
    masterEnabled,
    publicRollout,
    isAdmin
  };
}

console.log('🧪 Starting Voice Control UI Permissions & Rollout Suite...');

// 1. voiceControlEnabled is ON, enableVoiceControlForAllUsers is OFF
// Regular user: canAccessVoice must be false
const regularUser = { id: 'u1', username: 'bob', role: 'user', isAdmin: false };
const adminUser = { id: 'u2', username: 'alice', role: 'admin', isAdmin: true };
const guestUser = null;

const restrictedConfig = {
  voiceControlEnabled: true,
  enableVoiceControlForAllUsers: false
};

const regResult = evaluateVoiceAccess(restrictedConfig, regularUser);
assert.strictEqual(regResult.canAccessVoice, false, 'Regular user must NOT have access when public rollout is OFF');
console.log('✅ Regular user denied access when publicRollout=false');

const adminResult = evaluateVoiceAccess(restrictedConfig, adminUser);
assert.strictEqual(adminResult.canAccessVoice, true, 'Admin MUST have access when public rollout is OFF');
console.log('✅ Admin granted access when publicRollout=false');

const guestResult = evaluateVoiceAccess(restrictedConfig, guestUser);
assert.strictEqual(guestResult.canAccessVoice, false, 'Guest must NOT have access when public rollout is OFF');
console.log('✅ Guest denied access when publicRollout=false');

// 2. Both voiceControlEnabled and enableVoiceControlForAllUsers are ON
const fullRolloutConfig = {
  voiceControlEnabled: true,
  enableVoiceControlForAllUsers: true
};

assert.strictEqual(evaluateVoiceAccess(fullRolloutConfig, regularUser).canAccessVoice, true);
assert.strictEqual(evaluateVoiceAccess(fullRolloutConfig, adminUser).canAccessVoice, true);
console.log('✅ All users granted access when publicRollout=true');

// 3. Master toggle is OFF
const disabledConfig = {
  voiceControlEnabled: false,
  enableVoiceControlForAllUsers: true
};

assert.strictEqual(evaluateVoiceAccess(disabledConfig, regularUser).canAccessVoice, false);
assert.strictEqual(evaluateVoiceAccess(disabledConfig, adminUser).canAccessVoice, false);
console.log('✅ Master OFF strictly blocks everyone');

console.log('🎉 ALL VOICE CONTROL UI PERMISSION TESTS PASSED!');
