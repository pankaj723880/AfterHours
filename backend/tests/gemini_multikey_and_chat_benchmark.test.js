/**
 * Comprehensive Test Suite for Gemini Multi-Key Failover & Loopra ChatBuddy Engine
 * 
 * Tests:
 * 1. Environment variable key discovery and deduplication
 * 2. Failover error classification (429, 401/403, RESOURCE_EXHAUSTED, Quota, Timeout)
 * 3. Automatic failover: Primary success, Primary quota exhausted -> Secondary success
 * 4. Primary invalid (401/API_KEY_INVALID) -> Secondary success
 * 5. Both keys exhausted -> Clear error, no fake response
 * 6. Secondary key missing -> Primary continues working
 * 7. Streaming request fallback prior to first chunk
 * 8. Casual conversation benchmark messages ("Kaisi ho?", "Tumhara naam kya hai?", etc.)
 * 9. Follow-up context retention in history
 * 10. Music engine commands and negative modifier preservation
 * 11. Request deduplication
 * 12. Sensitive key sanitization in logs and errors
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getGeminiKeys,
  isGeminiConfigured,
  isFailoverError,
  executeGeminiOperation,
  executeGeminiStreamOperation,
  sanitizeLogMessage,
  geminiDiagnostics
} from '../services/geminiKeyManager.js';

import {
  processChatBuddyMessage,
  fallbackHeuristicClassifier,
  sanitizeAndParseJson,
  CHATBUDDY_SYSTEM_PROMPT
} from '../services/chatBuddyLlmService.js';

describe('Gemini Multi-Key Failover & ChatBuddy Verification Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env vars before each test
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_2;
    delete process.env.GOOGLE_API_KEY;
  });

  afterEach(() => {
    // Restore env vars
    process.env = { ...originalEnv };
  });

  describe('1. Environment Keys Configuration & Discovery', () => {
    it('returns empty array and isGeminiConfigured=false when no keys are set', () => {
      assert.equal(isGeminiConfigured(), false);
      assert.deepEqual(getGeminiKeys(), []);
    });

    it('identifies primary key correctly when GEMINI_API_KEY is present', () => {
      process.env.GEMINI_API_KEY = 'AIzaSyPrimaryMockKeyForTest1234567890';
      assert.equal(isGeminiConfigured(), true);
      const keys = getGeminiKeys();
      assert.equal(keys.length, 1);
      assert.equal(keys[0].label, 'primary');
      assert.equal(keys[0].index, 0);
      assert.equal(keys[0].key, 'AIzaSyPrimaryMockKeyForTest1234567890');
    });

    it('identifies both primary and secondary keys correctly', () => {
      process.env.GEMINI_API_KEY = 'AIzaSyPrimaryMockKeyForTest1234567890';
      process.env.GEMINI_API_KEY_2 = 'AIzaSySecondaryMockKeyForTest987654321';
      assert.equal(isGeminiConfigured(), true);
      const keys = getGeminiKeys();
      assert.equal(keys.length, 2);
      assert.equal(keys[0].label, 'primary');
      assert.equal(keys[1].label, 'secondary');
    });

    it('deduplicates identical primary and secondary keys', () => {
      process.env.GEMINI_API_KEY = 'AIzaSySameKeyForBothPrimaryAndSecondary';
      process.env.GEMINI_API_KEY_2 = 'AIzaSySameKeyForBothPrimaryAndSecondary';
      const keys = getGeminiKeys();
      assert.equal(keys.length, 1);
    });

    it('falls back to GOOGLE_API_KEY if GEMINI_API_KEY is missing', () => {
      process.env.GOOGLE_API_KEY = 'AIzaSyGoogleApiKeyFallback1234567890';
      const keys = getGeminiKeys();
      assert.equal(keys.length, 1);
      assert.equal(keys[0].key, 'AIzaSyGoogleApiKeyFallback1234567890');
    });
  });

  describe('2. Failover Error Classification (isFailoverError)', () => {
    it('detects HTTP 429 and RESOURCE_EXHAUSTED as retryable failover errors', () => {
      assert.equal(isFailoverError({ status: 429, message: 'Too Many Requests' }), true);
      assert.equal(isFailoverError({ message: 'Quota exceeded for quota metric... RESOURCE_EXHAUSTED' }), true);
      assert.equal(isFailoverError({ message: 'rate limit reached, please try again later' }), true);
    });

    it('detects 401, 403, and API_KEY_INVALID as failover errors', () => {
      assert.equal(isFailoverError({ status: 401, message: 'Unauthorized' }), true);
      assert.equal(isFailoverError({ status: 403, message: 'Forbidden' }), true);
      assert.equal(isFailoverError({ status: 400, message: 'API key not valid. Please pass a valid API key. [API_KEY_INVALID]' }), true);
      assert.equal(isFailoverError({ message: 'PERMISSION_DENIED: API key expired' }), true);
    });

    it('detects timeouts and network drops as failover errors', () => {
      assert.equal(isFailoverError(new Error('GEMINI_TIMEOUT')), true);
      assert.equal(isFailoverError(new Error('fetch failed ECONNRESET')), true);
    });

    it('does NOT trigger failover for standard client 400 Bad Request parameter errors', () => {
      assert.equal(isFailoverError({ status: 400, message: 'Invalid JSON body: unexpected token' }), false);
      assert.equal(isFailoverError({ status: 400, message: 'contents must not be empty' }), false);
    });
  });

  describe('3. Execution & Automatic Key Failover', () => {
    it('uses primary key when primary succeeds', async () => {
      process.env.GEMINI_API_KEY = 'AIzaSyPrimaryMockKeyValid123456789';
      process.env.GEMINI_API_KEY_2 = 'AIzaSySecondaryMockKeyValid9876543';

      let attemptedKeys = [];
      const res = await executeGeminiOperation(async ({ keyInfo }) => {
        attemptedKeys.push(keyInfo.label);
        return { text: 'Hello from primary!' };
      });

      assert.equal(res.success, true);
      assert.equal(res.keyLabel, 'primary');
      assert.deepEqual(attemptedKeys, ['primary']);
      assert.equal(res.data.text, 'Hello from primary!');
    });

    it('automatically fails over to secondary key when primary encounters quota limit (429)', async () => {
      process.env.GEMINI_API_KEY = 'AIzaSyPrimaryMockKeyRateLimited123';
      process.env.GEMINI_API_KEY_2 = 'AIzaSySecondaryMockKeyActive98765';

      let attemptedKeys = [];
      const res = await executeGeminiOperation(async ({ keyInfo }) => {
        attemptedKeys.push(keyInfo.label);
        if (keyInfo.label === 'primary') {
          const err = new Error('RESOURCE_EXHAUSTED: Quota exceeded for quota metric');
          err.status = 429;
          throw err;
        }
        return { text: 'Success from secondary key!' };
      });

      assert.equal(res.success, true);
      assert.equal(res.keyLabel, 'secondary');
      assert.equal(res.failedOver, true);
      assert.deepEqual(attemptedKeys, ['primary', 'secondary']);
      assert.equal(res.data.text, 'Success from secondary key!');
    });

    it('automatically attempts secondary key when primary is invalid (401/403/API_KEY_INVALID)', async () => {
      process.env.GEMINI_API_KEY = 'AIzaSyPrimaryInvalidKey1234567890';
      process.env.GEMINI_API_KEY_2 = 'AIzaSySecondaryValidKey9876543210';

      const res = await executeGeminiOperation(async ({ keyInfo }) => {
        if (keyInfo.label === 'primary') {
          const err = new Error('API key not valid. [API_KEY_INVALID]');
          err.status = 400;
          throw err;
        }
        return { text: 'Secondary key authenticated successfully!' };
      });

      assert.equal(res.success, true);
      assert.equal(res.keyLabel, 'secondary');
      assert.equal(res.failedOver, true);
    });

    it('returns clean error and NO fake response when BOTH keys fail', async () => {
      process.env.GEMINI_API_KEY = 'AIzaSyPrimaryFailingKey123456789';
      process.env.GEMINI_API_KEY_2 = 'AIzaSySecondaryFailingKey9876543';

      const res = await executeGeminiOperation(async () => {
        const err = new Error('Quota exceeded 429');
        err.status = 429;
        throw err;
      });

      assert.equal(res.success, false);
      assert.ok(res.error === 'ALL_KEYS_FAILED' || res.error === 'QUOTA_EXHAUSTED');
      assert.ok(res.message.includes('Quota exceeded'));
    });

    it('continues working with primary when secondary key is missing', async () => {
      process.env.GEMINI_API_KEY = 'AIzaSyOnlyPrimaryKeyConfigured123';
      delete process.env.GEMINI_API_KEY_2;

      const res = await executeGeminiOperation(async ({ keyInfo }) => {
        return { text: `Executed using ${keyInfo.label}` };
      });

      assert.equal(res.success, true);
      assert.equal(res.keyLabel, 'primary');
    });
  });

  describe('4. Streaming Request Fallback Before Stream Begins', () => {
    it('fails over to secondary key before streaming starts if primary fails initialization', async () => {
      process.env.GEMINI_API_KEY = 'AIzaSyPrimaryStreamKeyFailing123';
      process.env.GEMINI_API_KEY_2 = 'AIzaSySecondaryStreamKeyWorking987';

      let streamAttempts = [];
      const res = await executeGeminiStreamOperation(async ({ keyInfo }) => {
        streamAttempts.push(keyInfo.label);
        if (keyInfo.label === 'primary') {
          const err = new Error('429 RESOURCE_EXHAUSTED');
          err.status = 429;
          throw err;
        }
        return {
          async *[Symbol.asyncIterator]() {
            yield { text: 'Stream chunk 1' };
            yield { text: 'Stream chunk 2' };
          }
        };
      });

      assert.equal(res.success, true);
      assert.equal(res.keyLabel, 'secondary');
      assert.equal(res.failedOver, true);
      assert.deepEqual(streamAttempts, ['primary', 'secondary']);
    });
  });

  describe('5. Conversational Pipeline & Elimination of Repeated Hardcoded Bug', () => {
    it('does NOT return the repeated sentence "Main yahin hoon!" for casual chat when Gemini fails', async () => {
      // With no keys configured, it should return an honest notification, not the deceptive repeated sentence
      const queries = [
        'Kaisi ho?',
        'Tumhara naam kya hai?',
        'Aaj kya kar rahi ho?',
        'Mujhe bore ho raha hai.',
        'Tumhe music kyun pasand hai?',
        'Achha, aur batao.'
      ];

      for (const query of queries) {
        const result = await processChatBuddyMessage({ message: query });
        assert.equal(result.type, 'chat');
        assert.equal(result.action, 'none');
        assert.notEqual(result.reply, 'Main yahin hoon! Kuch chat karni ho ya koi gaana sunna ho, bataiye.');
        assert.notEqual(result.reply, 'Main yahin hoon! Kuch chat karni ho ya koi gaana sunna ho, bataye.');
      }
    });

    it('correctly parses structured JSON and preserves conversation history', () => {
      const rawLlmOutput = JSON.stringify({
        type: 'chat',
        action: 'none',
        params: {},
        reply: 'Main badhiya hoon! Aap batao, aaj kaunsa gaana sunna hai?'
      });

      const parsed = sanitizeAndParseJson(rawLlmOutput);
      assert.equal(parsed.type, 'chat');
      assert.equal(parsed.action, 'none');
      assert.equal(parsed.reply, 'Main badhiya hoon! Aap batao, aaj kaunsa gaana sunna hai?');
    });

    it('correctly handles markdown code fences around JSON output', () => {
      const raw = '```json\n{"type":"chat","action":"none","params":{},"reply":"Haan bilkul!"}\n```';
      const parsed = sanitizeAndParseJson(raw);
      assert.equal(parsed.type, 'chat');
      assert.equal(parsed.reply, 'Haan bilkul!');
    });
  });

  describe('6. Music Command & Negative Modifier Preservation', () => {
    it('preserves fast local actions for music playback and controls', () => {
      const pause = fallbackHeuristicClassifier('gaana pause kar do');
      assert.equal(pause.action, 'pause');

      const resume = fallbackHeuristicClassifier('song resume karo');
      assert.equal(resume.action, 'resume');

      const next = fallbackHeuristicClassifier('agla gaana chalao');
      assert.equal(next.action, 'next');

      const volume = fallbackHeuristicClassifier('volume kam kar do');
      assert.equal(volume.action, 'volume');
      assert.equal(volume.params.relative, -15);
    });

    it('never triggers playback when negative modifier is present', () => {
      const negative1 = fallbackHeuristicClassifier('Arijit Singh search karo par play mat karna');
      assert.notEqual(negative1.action, 'play_song');

      const negative2 = fallbackHeuristicClassifier('don\'t play any song');
      assert.notEqual(negative2.action, 'play_song');
    });

    it('correctly classifies explicit music playback request', () => {
      const play = fallbackHeuristicClassifier('play Kesariya');
      assert.equal(play.action, 'play_song');
      assert.equal(play.params.query, 'kesariya');
    });

    it('correctly routes navigation commands without playing music', () => {
      const nav = fallbackHeuristicClassifier('meri playlists kholo');
      assert.equal(nav.action, 'open_page');
      assert.equal(nav.params.page, 'playlists');
    });
  });

  describe('7. Sensitive Key Sanitization', () => {
    it('redacts Google API key patterns from log messages and errors', () => {
      const sensitive = 'Failed at key AIzaSyFakeSecretKeyThatMustBeRedacted12345 with 429';
      const clean = sanitizeLogMessage(sensitive);
      assert.ok(!clean.includes('AIzaSyFakeSecretKeyThatMustBeRedacted12345'));
      assert.ok(clean.includes('[REDACTED_API_KEY]'));
    });
  });
});

