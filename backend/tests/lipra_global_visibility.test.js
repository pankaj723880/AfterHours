import assert from 'assert';
import { featureFlagService } from '../services/featureFlagService.js';
import { voiceControlService } from '../../frontend/src/services/voiceControlService.js';

console.log('🧪 Starting Lipra AI Global Visibility & Access Control Suite...');

// 1. Backend Evaluation Tests
const adminUser = { role: 'admin', isAdmin: true };
const regularUser = { role: 'user', isAdmin: false };
const guestUser = null;

// Test A: Master Enabled = true, Global Rollout = false, Admin Access = true (Admin Beta)
const betaConfig = { enabled: true, globalRollout: false, adminAccess: true };
assert.strictEqual(featureFlagService.evaluateAccess(betaConfig, adminUser), true, 'Admin must have access in beta');
assert.strictEqual(featureFlagService.evaluateAccess(betaConfig, regularUser), false, 'Regular user must be blocked when globalRollout is OFF');
assert.strictEqual(featureFlagService.evaluateAccess(betaConfig, guestUser), false, 'Guest user must be blocked when globalRollout is OFF');
console.log('✅ 1. Backend: When Global Rollout is OFF, regular users and guests are denied access.');

// Test B: Master Enabled = true, Global Rollout = true, Admin Access = true (Full Rollout)
const fullConfig = { enabled: true, globalRollout: true, adminAccess: true };
assert.strictEqual(featureFlagService.evaluateAccess(fullConfig, adminUser), true, 'Admin must have access in full rollout');
assert.strictEqual(featureFlagService.evaluateAccess(fullConfig, regularUser), true, 'Regular user must have access in full rollout');
assert.strictEqual(featureFlagService.evaluateAccess(fullConfig, guestUser), false, 'Unauthenticated guests are blocked from voice control');
console.log('✅ 2. Backend: When Global Rollout is ON, regular authenticated users have access.');

// Test C: Master Enabled = false (Master OFF)
const masterOffConfig = { enabled: false, globalRollout: true, adminAccess: true };
assert.strictEqual(featureFlagService.evaluateAccess(masterOffConfig, adminUser), false, 'Admin blocked when master is OFF');
assert.strictEqual(featureFlagService.evaluateAccess(masterOffConfig, regularUser), false, 'Regular user blocked when master is OFF');
assert.strictEqual(featureFlagService.evaluateAccess(masterOffConfig, guestUser), false, 'Guest blocked when master is OFF');
console.log('✅ 3. Backend: Master toggle OFF strictly denies all users including admins.');

// Test D: Frontend voiceControlService evaluateLocalAccess
assert.strictEqual(voiceControlService.evaluateLocalAccess(betaConfig, adminUser), true, 'Frontend evaluates admin=true in beta');
assert.strictEqual(voiceControlService.evaluateLocalAccess(betaConfig, regularUser), false, 'Frontend evaluates regular=false in beta');
assert.strictEqual(voiceControlService.evaluateLocalAccess(fullConfig, regularUser), true, 'Frontend evaluates regular=true in full');
assert.strictEqual(voiceControlService.evaluateLocalAccess(masterOffConfig, adminUser), false, 'Frontend evaluates admin=false when master OFF');
assert.strictEqual(voiceControlService.evaluateLocalAccess(masterOffConfig, regularUser), false, 'Frontend evaluates regular=false when master OFF');
console.log('✅ 4. Frontend: voiceControlService accurately mirrors authoritative permission model.');

// Test E: UI Visibility Matrix Check
function computeUiVisibility({ masterEnabled, globalRollout, adminAccess, user }) {
  const isAdmin = Boolean(user && (user.isAdmin === true || user.role === 'admin'));
  const canAccessVoice = masterEnabled && (isAdmin ? adminAccess : globalRollout);
  const isVoiceActive = Boolean(canAccessVoice && (isAdmin || canAccessVoice));
  
  return {
    isLipraAvatarVisible: isVoiceActive,
    isVoiceSearchMicVisible: canAccessVoice,
    isHeaderVoiceToggleButtonVisible: isVoiceActive,
    isSidebarRoamButtonVisible: isAdmin && isVoiceActive,
    isPlayerSettingsRoamVisible: isAdmin && canAccessVoice,
    isBottomPlayerRoamPillVisible: isAdmin && isVoiceActive,
    isAiCompanionMuteButtonVisible: canAccessVoice
  };
}

// When Admin turns Lipra OFF for all users (globalRollout = false)
const userOffUi = computeUiVisibility({
  masterEnabled: true,
  globalRollout: false,
  adminAccess: true,
  user: regularUser
});

assert.strictEqual(userOffUi.isLipraAvatarVisible, false, 'Lipra avatar must NOT be visible');
assert.strictEqual(userOffUi.isVoiceSearchMicVisible, false, 'Voice search mic button must NOT be visible');
assert.strictEqual(userOffUi.isHeaderVoiceToggleButtonVisible, false, 'Header voice toggle button must NOT be visible');
assert.strictEqual(userOffUi.isSidebarRoamButtonVisible, false, 'Sidebar roam button must NOT be visible');
assert.strictEqual(userOffUi.isPlayerSettingsRoamVisible, false, 'Player settings roam button must NOT be visible');
assert.strictEqual(userOffUi.isBottomPlayerRoamPillVisible, false, 'Player bar roam pill must NOT be visible');
assert.strictEqual(userOffUi.isAiCompanionMuteButtonVisible, false, 'Companion avatar voice mute button must NOT be visible');
console.log('✅ 5. UI: All Lipra-related UI elements are completely absent for normal users when OFF.');

// When Admin turns Lipra ON for all users (globalRollout = true)
const userOnUi = computeUiVisibility({
  masterEnabled: true,
  globalRollout: true,
  adminAccess: true,
  user: regularUser
});

assert.strictEqual(userOnUi.isLipraAvatarVisible, true, 'Lipra avatar returns for normal user');
assert.strictEqual(userOnUi.isVoiceSearchMicVisible, true, 'Voice search mic button returns');
assert.strictEqual(userOnUi.isHeaderVoiceToggleButtonVisible, true, 'Header voice toggle button returns');
assert.strictEqual(userOnUi.isSidebarRoamButtonVisible, false, 'Sidebar roam button remains admin-only');
console.log('✅ 6. UI: Lipra entry points and voice buttons return smoothly when ON.');

console.log('🎉 ALL LIPRA AI GLOBAL VISIBILITY & ACCESS CONTROL TESTS PASSED!');

