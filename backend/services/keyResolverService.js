/**
 * Centralized Dynamic API Key Resolver & Failover Engine
 * 
 * Manages YouTube and Gemini API keys with:
 * 1. Database-backed AES-256 encrypted keys prioritized before Render environment variables.
 * 2. Intelligent failover for quota exhaustion (403, 429, dailyLimitExceeded).
 * 3. Automatic quota cooldowns and rate-limit recovery.
 * 4. Masked telemetry and zero plaintext key leakage.
 */

import mongoose from 'mongoose';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import ApiKey from '../models/ApiKeyConfig.js';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../utils/keyEncryption.js';

// In-memory key pool cache for ultra-low latency lookups (TTL: 5s, invalidated on mutations)
const keyPoolCache = {
  youtube: { keys: [], lastFetch: 0 },
  gemini: { keys: [], lastFetch: 0 }
};

const CACHE_TTL_MS = 5000;

export const invalidateKeyPoolCache = (service) => {
  if (service) {
    const s = service.toLowerCase().trim();
    if (keyPoolCache[s]) {
      keyPoolCache[s].keys = [];
      keyPoolCache[s].lastFetch = 0;
    }
  } else {
    keyPoolCache.youtube = { keys: [], lastFetch: 0 };
    keyPoolCache.gemini = { keys: [], lastFetch: 0 };
  }
};

/**
 * Sanitizes an API key string.
 */
export const sanitizeApiKey = (key) => {
  if (typeof key !== 'string') return '';
  let clean = key.trim().replace(/^['"]|['"]$/g, '');
  if (clean.startsWith('AIzaSy') && clean.length > 39) {
    clean = clean.slice(0, 39);
  }
  return clean;
};

/**
 * Parse comma/newline/space separated key strings.
 */
export const parseKeyList = (raw) => {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/[,\r\n\s]+/)
    .map(sanitizeApiKey)
    .filter(k => k && k.length > 5);
};

/**
 * Discovers Render / local environment fallback keys for a given service.
 */
export const getEnvironmentFallbackKeys = (service) => {
  const s = (service || '').toLowerCase().trim();
  const env = process.env || {};

  if (s === 'youtube') {
    const combined = [
      ...parseKeyList(env.VITE_YOUTUBE_API_KEYS),
      ...parseKeyList(env.YOUTUBE_API_KEYS),
      ...parseKeyList(env.VITE_YOUTUBE_KEYS),
      ...parseKeyList(env.YOUTUBE_KEYS),
    ];
    const discrete = [
      env.YOUTUBE_KEY_1 || env.VITE_YOUTUBE_KEY_1,
      env.YOUTUBE_KEY_2 || env.VITE_YOUTUBE_KEY_2,
      env.YOUTUBE_KEY_3 || env.VITE_YOUTUBE_KEY_3,
      env.YOUTUBE_KEY_4 || env.VITE_YOUTUBE_KEY_4,
      env.YOUTUBE_KEY_5 || env.VITE_YOUTUBE_KEY_5,
      env.YOUTUBE_KEY_6 || env.VITE_YOUTUBE_KEY_6,
      env.YOUTUBE_KEY_7 || env.VITE_YOUTUBE_KEY_7,
      env.YOUTUBE_KEY_8 || env.VITE_YOUTUBE_KEY_8,
      env.YOUTUBE_KEY_9 || env.VITE_YOUTUBE_KEY_9,
      env.YOUTUBE_KEY_10 || env.VITE_YOUTUBE_KEY_10,
      env.YOUTUBE_API_KEY,
    ].map(sanitizeApiKey).filter(Boolean);

    const unique = [];
    const seen = new Set();
    for (const k of [...combined, ...discrete]) {
      if (k && !seen.has(k)) {
        seen.add(k);
        unique.push(k);
      }
    }
    return unique.map((key, idx) => ({
      key,
      maskedKey: maskApiKey(key),
      source: 'environment',
      label: `Render Env Fallback ${idx + 1}`,
      isDbKey: false,
      _id: null
    }));
  }

  if (s === 'gemini') {
    const combined = [
      ...parseKeyList(env.VITE_GEMINI_API_KEYS),
      ...parseKeyList(env.GEMINI_API_KEYS),
      ...parseKeyList(env.VITE_GEMINI_KEYS),
      ...parseKeyList(env.GEMINI_KEYS),
    ];
    const discrete = [
      env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.VITE_GEMINI_API_KEY_1 || env.GEMINI_KEY_1,
      env.GEMINI_API_KEY_2 || env.VITE_GEMINI_API_KEY_2 || env.GEMINI_KEY_2,
      env.GEMINI_API_KEY_3 || env.VITE_GEMINI_API_KEY_3 || env.GEMINI_KEY_3,
      env.GEMINI_API_KEY_4 || env.VITE_GEMINI_API_KEY_4 || env.GEMINI_KEY_4,
      env.GEMINI_API_KEY_5 || env.VITE_GEMINI_API_KEY_5 || env.GEMINI_KEY_5,
    ].map(sanitizeApiKey).filter(Boolean);

    const unique = [];
    const seen = new Set();
    for (const k of [...combined, ...discrete]) {
      if (k && !seen.has(k)) {
        seen.add(k);
        unique.push(k);
      }
    }
    return unique.map((key, idx) => ({
      key,
      maskedKey: maskApiKey(key),
      source: 'environment',
      label: `Render Env Fallback ${idx + 1}`,
      isDbKey: false,
      _id: null
    }));
  }

  return [];
};

/**
 * Fetches all enabled and active database keys for a provider, decrypting them securely.
 */
export const getActiveDatabaseKeys = async (service) => {
  const s = (service || '').toLowerCase().trim();
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return [];
  }

  try {
    const now = new Date();
    // Query active keys that are enabled and not permanently exhausted, or whose cooldown has expired
    const docs = await ApiKey.find({
      service: s,
      isEnabled: { $ne: false },
      $or: [
        { isExhausted: { $ne: true }, status: { $in: ['Active', null] } },
        { cooldownUntil: { $lte: now } }
      ]
    })
    .sort({ failureCount: 1, lastUsedAt: 1 })
    .lean();

    const activeList = [];
    for (const doc of docs) {
      const rawKey = decryptApiKey(doc);
      if (rawKey && rawKey.length > 5) {
        activeList.push({
          _id: doc._id,
          key: sanitizeApiKey(rawKey),
          maskedKey: doc.maskedKey || maskApiKey(rawKey),
          source: 'database',
          label: doc.label || 'MongoDB Dynamic Key',
          isDbKey: true,
          failureCount: doc.failureCount || 0,
          successCount: doc.successCount || 0,
          cooldownUntil: doc.cooldownUntil
        });
      }
    }
    return activeList;
  } catch (err) {
    console.warn(`[KeyResolver] Error fetching database keys for ${s}:`, err.message);
    return [];
  }
};

/**
 * Returns prioritized list of active keys (Database keys FIRST, then Environment fallbacks).
 */
export const getEligibleKeys = async (service) => {
  const s = (service || '').toLowerCase().trim();
  const now = Date.now();

  let cached = keyPoolCache[s];
  if (cached && cached.keys.length > 0 && (now - cached.lastFetch < CACHE_TTL_MS)) {
    return cached.keys;
  }

  const dbKeys = await getActiveDatabaseKeys(s);
  const envKeys = getEnvironmentFallbackKeys(s);

  // Filter out any environment keys that are already present in the database
  const seenMasked = new Set(dbKeys.map(k => k.maskedKey));
  const distinctEnvKeys = envKeys.filter(ek => !seenMasked.has(ek.maskedKey));

  // Prioritize Database keys over Environment variables
  const prioritized = [...dbKeys, ...distinctEnvKeys];

  keyPoolCache[s] = {
    keys: prioritized,
    lastFetch: now
  };

  return prioritized;
};

/**
 * Records key success in the database telemetry.
 */
export const recordKeySuccess = async (keyInfo) => {
  if (!keyInfo || !keyInfo.isDbKey || !keyInfo._id) return;
  try {
    await ApiKey.updateOne(
      { _id: keyInfo._id },
      { 
        $inc: { successCount: 1 },
        $set: { 
          status: 'Active',
          isExhausted: false,
          lastUsedAt: new Date(),
          lastSuccessAt: new Date(),
          cooldownUntil: null
        }
      }
    );
  } catch (e) {
    // Non-blocking telemetry
  }
};

/**
 * Records key error with intelligent quota vs rate-limit classification.
 */
export const recordKeyFailure = async (keyInfo, errorDetails) => {
  if (!keyInfo) return;
  const { status, reason, message } = errorDetails;

  const isQuota = status === 403 || reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || (message && message.toLowerCase().includes('quota'));
  const isRateLimit = status === 429 || reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded';
  const isInvalid = status === 400 && (reason === 'keyInvalid' || (message && message.toLowerCase().includes('api key not valid')));

  let newStatus = 'Active';
  let isExhausted = false;
  let cooldownUntil = null;

  if (isInvalid) {
    newStatus = 'Invalid';
    isExhausted = true;
  } else if (isQuota) {
    newStatus = 'Exhausted';
    isExhausted = true;
    cooldownUntil = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours
  } else if (isRateLimit) {
    newStatus = 'Active';
    isExhausted = false;
    cooldownUntil = new Date(Date.now() + 60 * 1000); // 1 minute
  }

  // Update in memory cache immediately
  invalidateKeyPoolCache();

  if (keyInfo.isDbKey && keyInfo._id) {
    try {
      await ApiKey.updateOne(
        { _id: keyInfo._id },
        {
          $inc: { failureCount: 1 },
          $set: {
            status: newStatus,
            isExhausted,
            cooldownUntil,
            lastUsedAt: new Date(),
            lastErrorAt: new Date(),
            lastErrorMessage: String(message || '').slice(0, 300),
            lastErrorReason: reason || (isQuota ? 'quotaExceeded' : (isRateLimit ? 'rateLimitExceeded' : 'unknown'))
          }
        }
      );
    } catch (e) {
      // Non-blocking telemetry
    }
  }
};

/**
 * Performs a live health test on an API key without consuming significant quota.
 */
export const testKeyHealth = async (service, plainKey) => {
  const s = (service || '').toLowerCase().trim();
  const startTime = Date.now();

  if (s === 'youtube') {
    try {
      const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'id',
          type: 'video',
          maxResults: 1,
          q: 'test',
          key: plainKey
        },
        timeout: 4000
      });
      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        service: 'youtube',
        latencyMs,
        status: 'Active',
        message: `YouTube API Key is Healthy (${latencyMs}ms latency)`
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const status = err.response?.status;
      const dataErr = err.response?.data?.error;
      const errMsg = dataErr?.message || err.message;
      const reason = dataErr?.errors?.[0]?.reason || '';

      const isQuota = status === 403 || reason === 'quotaExceeded' || errMsg.toLowerCase().includes('quota');
      return {
        success: false,
        service: 'youtube',
        latencyMs,
        status: isQuota ? 'Exhausted' : (status === 400 ? 'Invalid' : 'Error'),
        isQuota,
        statusCode: status,
        message: errMsg
      };
    }
  }

  if (s === 'gemini') {
    try {
      const ai = new GoogleGenAI({ apiKey: plainKey });
      const response = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          config: { maxOutputTokens: 5 }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('GEMINI_TEST_TIMEOUT')), 5000))
      ]);
      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        service: 'gemini',
        latencyMs,
        status: 'Active',
        message: `Gemini API Key is Healthy (${latencyMs}ms latency)`
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const errMsg = err.message || '';
      const isQuota = errMsg.includes('429') || errMsg.toLowerCase().includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
      return {
        success: false,
        service: 'gemini',
        latencyMs,
        status: isQuota ? 'Exhausted' : 'Error',
        isQuota,
        message: errMsg
      };
    }
  }

  return { success: false, message: 'Unsupported service' };
};

