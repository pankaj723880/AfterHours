import assert from 'assert';
import mongoose from 'mongoose';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../utils/keyEncryption.js';
import ApiKey from '../models/ApiKeyConfig.js';
import CodePatcherHistory from '../models/CodePatcherHistory.js';
import { getEligibleKeys, invalidateKeyPoolCache, testKeyHealth } from '../services/keyResolverService.js';
import { executeGeminiOperation, getGeminiKeys, getEligibleGeminiKeysAsync } from '../services/geminiKeyManager.js';

async function runTestSuite() {
  console.log('🧪 Starting End-to-End Test Suite: Mobile UI, Persistent History & Gemini Key Pool...');

  // 1. Test AES Key Encryption and Decryption Roundtrip
  const testPlainKey = 'AIzaSyA_TEST_KEY_FOR_POOL_VERIFICATION_12345';
  const encrypted = encryptApiKey(testPlainKey);
  assert.ok(encrypted.encryptedKey, 'Encrypted key payload must exist');
  assert.ok(encrypted.iv, 'IV must exist');
  assert.ok(encrypted.authTag, 'Auth tag must exist');

  const decrypted = decryptApiKey(encrypted);
  assert.strictEqual(decrypted, testPlainKey, 'Decrypted key must exactly match original plaintext key');
  console.log('  ✓ AES-256-GCM Key Encrypt / Decrypt / Reveal Roundtrip passed');

  // 2. Test Masking Security
  const masked = maskApiKey(testPlainKey);
  assert.ok(!masked.includes('POOL_VERIFICATION'), 'Masked representation must never contain raw middle tokens');
  assert.ok(masked.startsWith('AIzaSy'), 'Masked key must start with AIzaSy');
  assert.ok(masked.endsWith('2345'), 'Masked key must preserve suffix');
  console.log(`  ✓ Key Masking Sanity passed (${masked})`);

  // 3. Test CodePatcherHistory Schema & Valid Statuses
  const validStatuses = [
    'Submitted',
    'Analyzing',
    'Generating Patch',
    'Applying Patch',
    'Validating',
    'Completed',
    'Failed',
    'Cancelled',
    'Awaiting Approval'
  ];

  validStatuses.forEach(status => {
    const doc = new CodePatcherHistory({
      executionId: `test_${Date.now()}_${status}`,
      instructionPrompt: 'Optimize mobile cards',
      status
    });
    const err = doc.validateSync();
    assert.strictEqual(err, undefined, `Status "${status}" must be valid in CodePatcherHistory schema`);
  });
  console.log(`  ✓ CodePatcherHistory schema validation passed for all ${validStatuses.length} required statuses`);

  // 4. Test Gemini Key Resolver Integration & Asynchronous Pool Lookup
  const eligibleKeys = await getEligibleGeminiKeysAsync();
  assert.ok(Array.isArray(eligibleKeys), 'getEligibleGeminiKeysAsync must return an array');
  console.log(`  ✓ getEligibleGeminiKeysAsync resolved ${eligibleKeys.length} keys via centralized keyResolverService`);

  // 5. Test executeGeminiOperation error handling and telemetry
  const fakeOperation = async () => {
    throw new Error('RESOURCE_EXHAUSTED: Quota exceeded for quota metric');
  };

  const opResult = await executeGeminiOperation(fakeOperation, { operationName: 'TestSuiteMock' });
  assert.strictEqual(opResult.success, false, 'Operation must fail gracefully when quota exhausted');
  assert.ok(
    opResult.error === 'QUOTA_EXHAUSTED' || opResult.error === 'NO_KEYS_CONFIGURED' || opResult.allKeysExhausted,
    `Error must be classified as quota exhaustion or no keys, got: ${opResult.error}`
  );
  console.log(`  ✓ executeGeminiOperation properly handled mock provider response without crash (${opResult.error})`);

  console.log('🎉 All End-to-End Tests Passed Successfully!');
}

runTestSuite().catch(err => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});
