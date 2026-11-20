import assert from 'assert';
import {
  parseSemanticVersion,
  compareVersions,
  getInstalledAppVersion
} from '../../frontend/src/services/appUpdateService.js';
import { voiceControlService } from '../../frontend/src/services/voiceControlService.js';

console.log('🧪 Starting Acceptance Suite for Android APK Download, Update Notification & Fail-Closed Avatar Visibility...\n');

// ============================================================================
// ISSUE 1 & 2: VERSION PARSING & COMPARISON TESTS
// ============================================================================
console.log('--- Test Suite 1: Semantic Versioning & Comparison (v2.1 -> v2.2 -> v2.9 -> v3.0) ---');

assert.deepStrictEqual(parseSemanticVersion('v2.1'), [2, 1, 0]);
assert.deepStrictEqual(parseSemanticVersion('2.2'), [2, 2, 0]);
assert.deepStrictEqual(parseSemanticVersion('v2.9'), [2, 9, 0]);
assert.deepStrictEqual(parseSemanticVersion('v3.0'), [3, 0, 0]);
assert.deepStrictEqual(parseSemanticVersion('v3.1'), [3, 1, 0]);

// Comparison checks
assert.strictEqual(compareVersions('2.2', '2.1'), 1, 'v2.2 is newer than v2.1');
assert.strictEqual(compareVersions('2.1', '2.2'), -1, 'v2.1 is older than v2.2');
assert.strictEqual(compareVersions('2.1', '2.1'), 0, 'v2.1 equals v2.1');
assert.strictEqual(compareVersions('3.0', '2.9'), 1, 'v3.0 is newer than v2.9');
assert.strictEqual(compareVersions('3.1', '3.0'), 1, 'v3.1 is newer than v3.0');

console.log('✅ Version comparisons and parsing pass perfectly.');

// ============================================================================
// ISSUE 2: NATIVE-TO-WEB BRIDGE & VERSION DETECTION
// ============================================================================
console.log('\n--- Test Suite 2: Native Android App Bridge & Detection ---');

// Case A: Running outside Android container (Normal browser)
const defaultInstalled = getInstalledAppVersion();
assert.strictEqual(defaultInstalled.versionName, '2.1');
assert.strictEqual(defaultInstalled.isNative, false);

// Case B: Mock window.LoopraAndroid native interface inside TWA
let downloadAndInstallCalled = false;
let downloadApkCalled = false;
global.window = {
  LoopraAndroid: {
    getAppVersionName: () => '2.1',
    getAppVersionCode: () => 21,
    canRequestPackageInstalls: () => true,
    downloadAndInstallApk: (url, sha, code) => {
      downloadAndInstallCalled = true;
      assert.strictEqual(url, 'https://loopra1.vercel.app/downloads/loopra.apk');
      assert.strictEqual(sha, 'mock-sha-256');
      assert.strictEqual(code, 22);
    },
    downloadApk: (url) => { downloadApkCalled = true; }
  }
};

let urlCalled = null;
const nativeInstalled = getInstalledAppVersion();
assert.strictEqual(nativeInstalled.versionName, '2.1', 'Bridge reads native versionName');
assert.strictEqual(nativeInstalled.versionCode, 21, 'Bridge reads native versionCode');
assert.strictEqual(nativeInstalled.isNative, true, 'Correctly flags native Android container');

// Test triggerApkDownload calls downloadAndInstallApk with sha256 and versionCode
import { triggerApkDownload } from '../../frontend/src/services/appUpdateService.js';
triggerApkDownload('https://loopra1.vercel.app/downloads/loopra.apk', {
  sha256: 'mock-sha-256',
  versionCode: 22
});
assert.strictEqual(downloadAndInstallCalled, true, 'triggerApkDownload calls native downloadAndInstallApk');

console.log('✅ Native Android bridge methods (getAppVersionName, getAppVersionCode, downloadAndInstallApk) function as expected.');

// ============================================================================
// ISSUE 3: FAIL-CLOSED AVATAR / VOICE VISIBILITY TESTS
// ============================================================================
console.log('\n--- Test Suite 3: Avatar & Voice Fail-Closed State & Fallback Logic ---');

const adminUser = { role: 'admin', isAdmin: true };
const regularUser = { role: 'user', isAdmin: false };
const guestUser = null;

// Initial state must be fail-closed (all false)
const initialState = voiceControlService.getAccessState();
assert.strictEqual(initialState.enabled, false, 'Initial state must have enabled=false');
assert.strictEqual(initialState.globalRollout, false, 'Initial state must have globalRollout=false');
assert.strictEqual(initialState.allowed, false, 'Initial state must have allowed=false');

// evaluateLocalAccess with null/undefined config
assert.strictEqual(voiceControlService.evaluateLocalAccess(null, adminUser), false, 'Null config evaluates to false');
assert.strictEqual(voiceControlService.evaluateLocalAccess(undefined, regularUser), false, 'Undefined config evaluates to false');

// evaluateLocalAccess when disabled (master off)
assert.strictEqual(voiceControlService.evaluateLocalAccess({ enabled: false, globalRollout: false }, adminUser), false, 'Disabled config denies admin');
assert.strictEqual(voiceControlService.evaluateLocalAccess({ enabled: false, globalRollout: false }, regularUser), false, 'Disabled config denies regular user');

// evaluateLocalAccess when enabled for Admin only
const adminOnlyConfig = { enabled: true, globalRollout: false, adminAccess: true };
assert.strictEqual(voiceControlService.evaluateLocalAccess(adminOnlyConfig, adminUser), true, 'Admin allowed when adminAccess=true');
assert.strictEqual(voiceControlService.evaluateLocalAccess(adminOnlyConfig, regularUser), false, 'Regular user blocked when globalRollout=false');
assert.strictEqual(voiceControlService.evaluateLocalAccess(adminOnlyConfig, guestUser), false, 'Guest user blocked when globalRollout=false');

// evaluateLocalAccess when enabled globally
const publicConfig = { enabled: true, globalRollout: true, adminAccess: true };
assert.strictEqual(voiceControlService.evaluateLocalAccess(publicConfig, adminUser), true, 'Admin allowed when public');
assert.strictEqual(voiceControlService.evaluateLocalAccess(publicConfig, regularUser), true, 'Regular user allowed when public');

console.log('✅ Fail-closed avatar and voice control evaluation tests passed completely.');
console.log('\n🎉 ALL 3 ISSUE VERIFICATION SCENARIOS PASSED SUCCESSFULLY!');
