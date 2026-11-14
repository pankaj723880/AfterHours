import assert from 'node:assert/strict';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../utils/keyEncryption.js';
import { 
  getEnvironmentFallbackKeys, 
  sanitizeApiKey, 
  parseKeyList,
  testKeyHealth 
} from '../services/keyResolverService.js';
import {
  isGitHubConfigured,
  verifyGitHubConnection,
  getRepositoryTree,
  getFileContent
} from '../services/githubService.js';

console.log('🧪 Starting End-to-End Key Manager & Live Code Patcher Test Suite...');

// 1. Encryption at Rest Tests
{
  const rawKey = 'AIzaSyDemoSecretTestingKey1234567890';
  const encrypted = encryptApiKey(rawKey);

  assert(encrypted.encryptedKey, 'encryptedKey should be generated');
  assert(encrypted.iv, 'iv should be generated');
  assert(encrypted.authTag, 'authTag should be generated');
  assert.notEqual(encrypted.encryptedKey, rawKey, 'Encrypted key must not equal raw key');

  const decrypted = decryptApiKey(encrypted);
  assert.equal(decrypted, rawKey, 'Decrypted key must match original raw key');

  // Test backward compatibility fallback
  assert.equal(decryptApiKey(rawKey), rawKey, 'Plaintext fallback should preserve raw key');
  assert.equal(decryptApiKey({ key: rawKey }), rawKey, 'Doc key property fallback should preserve raw key');

  console.log('  ✓ AES-256-GCM Encryption, Decryption & Backward Compatibility passed');
}

// 2. Key Masking & Sanitization Tests
{
  const testKey = 'AIzaSyA1234567890BCDEFGHIJKLMNOPQRSTU12';
  const masked = maskApiKey(testKey);
  assert.equal(masked, 'AIzaSy...STU12'.slice(0, 6) + '...' + testKey.slice(-4), 'Masked key format must be prefix...suffix');
  assert.equal(maskApiKey(''), '••••••••', 'Empty key should show bullets');

  const sanitized = sanitizeApiKey(' "AIzaSyA1234567890BCDEFGHIJKLMNOPQRSTU12345" ');
  assert.equal(sanitized.length, 39, 'Sanitized key should strip whitespace, quotes and slice 39 chars');
  console.log('  ✓ Key Masking & Sanitization passed');
}

// 3. Environment Fallback Key Resolution Tests
{
  process.env.VITE_YOUTUBE_API_KEYS = 'AIzaSyTestYt1_PadChars12345678901, AIzaSyTestYt2_PadChars12345678902';
  process.env.VITE_GEMINI_API_KEYS = 'AIzaSyTestGemini1_PadChars12345678, AIzaSyTestGemini2_PadChars12345678';

  const ytKeys = getEnvironmentFallbackKeys('youtube');
  assert(ytKeys.length >= 2, 'Should discover at least 2 YouTube fallback keys');
  assert(ytKeys[0].maskedKey.includes('AIzaSy'), 'Masked key should have prefix');
  assert.equal(ytKeys[0].source, 'environment', 'Source should be environment');

  const geminiKeys = getEnvironmentFallbackKeys('gemini');
  assert(geminiKeys.length >= 2, 'Should discover at least 2 Gemini fallback keys');
  assert.equal(geminiKeys[0].source, 'environment', 'Source should be environment');

  console.log('  ✓ Environment Fallback Key Resolution passed');
}

// 4. Live Code Patcher Repository Tree & Local Fallback Tests
{
  const tree = await getRepositoryTree();
  assert(Array.isArray(tree), 'Repository tree must return an array');
  assert(tree.length > 5, 'Tree must contain project source files');

  const hasApp = tree.some(p => p.includes('App.jsx'));
  const hasServer = tree.some(p => p.includes('server.js'));
  assert(hasApp, 'Tree must include frontend/src/App.jsx');
  assert(hasServer, 'Tree must include backend/server.js');

  const appFile = await getFileContent('frontend/src/App.jsx');
  assert(appFile, 'getFileContent must retrieve App.jsx');
  assert(appFile.content.includes('export default function App'), 'App.jsx content must match');

  console.log('  ✓ Repository Tree & File Inspection passed');
}

// 5. GitHub Status & Config Verification
{
  const ghStatus = await verifyGitHubConnection();
  assert(typeof ghStatus.connected === 'boolean', 'GitHub connection status must be boolean');
  console.log(`  ✓ GitHub Connection Checker operational (configured: ${isGitHubConfigured()})`);
}

console.log('🎉 All End-to-End Integration Tests PASSED (5/5 suites successful)!');
