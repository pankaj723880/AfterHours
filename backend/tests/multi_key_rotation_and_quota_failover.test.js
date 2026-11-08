import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getYoutubeApiKeys } from '../server.js';
import { getGeminiKeys, executeGeminiOperation, isFailoverError, isQuotaError } from '../services/geminiKeyManager.js';
import { getAvailableKeys, getGeminiConfigKeys } from '../config/geminiConfig.js';

describe('Robust Multi-Key API Rotation & Quota Failover Verification', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all test env keys
    delete process.env.VITE_YOUTUBE_API_KEYS;
    delete process.env.YOUTUBE_API_KEYS;
    delete process.env.VITE_YOUTUBE_KEYS;
    delete process.env.YOUTUBE_KEYS;
    for (let i = 1; i <= 10; i++) {
      delete process.env[`YOUTUBE_KEY_${i}`];
      delete process.env[`VITE_YOUTUBE_KEY_${i}`];
    }
    delete process.env.YOUTUBE_API_KEY;

    delete process.env.VITE_GEMINI_API_KEYS;
    delete process.env.GEMINI_API_KEYS;
    delete process.env.VITE_GEMINI_KEYS;
    delete process.env.GEMINI_KEYS;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_2;
    delete process.env.GOOGLE_API_KEY;
    for (let i = 1; i <= 5; i++) {
      delete process.env[`GEMINI_API_KEY_${i}`];
      delete process.env[`VITE_GEMINI_API_KEY_${i}`];
      delete process.env[`GEMINI_KEY_${i}`];
    }
  });

  describe('1. YouTube Data API (10 Keys Rotation)', () => {
    it('correctly parses 10 comma-separated keys from VITE_YOUTUBE_API_KEYS', () => {
      const keys = Array.from({ length: 10 }, (_, i) => `AIzaSyMockKeyForYouTubeIndex${i + 1}_Pad`);
      process.env.VITE_YOUTUBE_API_KEYS = keys.join(',');

      const discovered = getYoutubeApiKeys();
      assert.equal(discovered.length, 10);
      assert.deepEqual(discovered, keys);
    });

    it('correctly parses 10 comma-separated keys from YOUTUBE_API_KEYS', () => {
      const keys = Array.from({ length: 10 }, (_, i) => `AIzaSyServerYTKeyNum${i + 1}_PadChars`);
      process.env.YOUTUBE_API_KEYS = keys.join(', ');

      const discovered = getYoutubeApiKeys();
      assert.equal(discovered.length, 10);
      assert.deepEqual(discovered, keys);
    });

    it('merges discrete keys YOUTUBE_KEY_1..10 without duplicates', () => {
      process.env.VITE_YOUTUBE_API_KEYS = 'AIzaSyKey1_PadPaddingChars12345, AIzaSyKey2_PadPaddingChars12345';
      process.env.YOUTUBE_KEY_2 = 'AIzaSyKey2_PadPaddingChars12345'; // duplicate
      process.env.YOUTUBE_KEY_3 = 'AIzaSyKey3_PadPaddingChars12345';
      process.env.YOUTUBE_KEY_10 = 'AIzaSyKey10_PadPaddingChars1234';

      const discovered = getYoutubeApiKeys();
      assert.equal(discovered.length, 4);
      assert.equal(discovered[0], 'AIzaSyKey1_PadPaddingChars12345');
      assert.equal(discovered[1], 'AIzaSyKey2_PadPaddingChars12345');
      assert.equal(discovered[2], 'AIzaSyKey3_PadPaddingChars12345');
      assert.equal(discovered[3], 'AIzaSyKey10_PadPaddingChars1234');
    });
  });

  describe('2. Google Gemini API (5 Keys Rotation & Automatic Failover)', () => {
    it('correctly parses 5 comma-separated keys from VITE_GEMINI_API_KEYS', () => {
      const keys = Array.from({ length: 5 }, (_, i) => `AIzaSyGeminiMockKey_${i + 1}_Testing123`);
      process.env.VITE_GEMINI_API_KEYS = keys.join(',');

      const discovered = getGeminiKeys();
      assert.equal(discovered.length, 5);
      assert.equal(discovered[0].label, 'primary');
      assert.equal(discovered[1].label, 'secondary');
      assert.equal(discovered[2].label, 'key_3');
      assert.equal(discovered[3].label, 'key_4');
      assert.equal(discovered[4].label, 'key_5');

      const configKeys = getGeminiConfigKeys();
      assert.equal(configKeys.length, 5);

      const available = getAvailableKeys();
      assert.equal(available.length, 5);
    });

    it('fails over across keys until success when earlier keys hit quota (429)', async () => {
      const keys = [
        'AIzaSyGeminiQuotaKey1_12345678901',
        'AIzaSyGeminiQuotaKey2_12345678902',
        'AIzaSyGeminiWorkingKey3_123456789'
      ];
      process.env.VITE_GEMINI_API_KEYS = keys.join(',');

      const attemptedKeys = [];
      const res = await executeGeminiOperation(async ({ keyInfo }) => {
        attemptedKeys.push(keyInfo.key);
        if (keyInfo.key === keys[0]) {
          const err = new Error('RESOURCE_EXHAUSTED: Quota exceeded for quota metric');
          err.status = 429;
          throw err;
        }
        if (keyInfo.key === keys[1]) {
          const err = new Error('Rate limit exceeded 429');
          err.status = 429;
          throw err;
        }
        return { message: 'Success from key 3' };
      }, { operationName: 'MultiKeyQuotaFailoverTest' });

      assert.equal(res.success, true);
      assert.equal(res.keyLabel, 'key_3');
      assert.equal(res.failedOver, true);
      assert.deepEqual(attemptedKeys, keys);
      assert.equal(res.data.message, 'Success from key 3');
    });

    it('reports QUOTA_EXHAUSTED when all 5 configured keys fail with 429', async () => {
      const keys = Array.from({ length: 5 }, (_, i) => `AIzaSyGeminiExhaustedKey_${i + 1}_12345`);
      process.env.VITE_GEMINI_API_KEYS = keys.join(',');

      let callCount = 0;
      const res = await executeGeminiOperation(async ({ keyInfo }) => {
        callCount++;
        const err = new Error('RESOURCE_EXHAUSTED: Daily limit exceeded');
        err.status = 429;
        throw err;
      }, { operationName: 'AllFiveKeysQuotaExhausted' });

      assert.equal(res.success, false);
      assert.equal(res.error, 'QUOTA_EXHAUSTED');
      assert.equal(res.allKeysExhausted, true);
      assert.equal(callCount, 5);
    });
  });
});

