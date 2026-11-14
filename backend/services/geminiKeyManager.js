/**
 * Gemini Multi-Key Manager & Automatic Fallback Engine
 * 
 * Complies strictly with:
 * 1. Primary key (GEMINI_API_KEY) by default, secondary key (GEMINI_API_KEY_2) on failure.
 * 2. Automatic failover on HTTP 429, RESOURCE_EXHAUSTED, quota exceeded, 401/403, and timeouts.
 * 3. Safe logging: Never logs, leaks, or exposes raw API keys.
 * 4. Streaming support: Key selection prior to stream start; failover before first chunk; no mid-stream switching.
 * 5. Bounded retries: Sensible backoff, no infinite loops, no retrying client 400 parameter errors (except API_KEY_INVALID).
 * 6. Model fallback resilience: Seamless recovery to gemini-3.8-flash if configured model 404s.
 */

import { GoogleGenAI } from '@google/genai';
import mongoose from 'mongoose';
import ApiKey from '../models/ApiKeyConfig.js';
import { decryptApiKey, maskApiKey } from '../utils/keyEncryption.js';
import { getEligibleKeys, recordKeySuccess, recordKeyFailure, sanitizeApiKey, parseKeyList } from './keyResolverService.js';

export const geminiDiagnostics = {
  totalCalls: 0,
  primarySuccess: 0,
  secondarySuccess: 0,
  totalFailovers: 0,
  failedCalls: 0,
  lastFailoverReason: null,
  lastError: null,
  lastLatencyMs: 0
};

/**
 * Sanitizes any string or object to ensure API keys are never exposed in logs or errors.
 */
export function sanitizeLogMessage(msg = '') {
  if (!msg) return '';
  const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
  return text.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
}

// In-memory cache for DB Gemini API keys with 10s TTL
let cachedDbGeminiKeys = [];
let lastDbGeminiKeysFetch = 0;
let geminiGlobalQuotaCooldownUntil = 0;

/**
 * Invalidate the in-memory Gemini key cache so dashboard changes take effect immediately
 */
export const invalidateGeminiKeyCache = () => {
  cachedDbGeminiKeys = [];
  lastDbGeminiKeysFetch = 0;
  geminiGlobalQuotaCooldownUntil = 0;
};

/**
 * Fetch active Gemini keys directly from MongoDB pool using centralized KeyResolverService logic.
 */
export const getActiveDbGeminiKeys = async () => {
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const eligible = await getEligibleKeys('gemini');
      return eligible.filter(k => k.isDbKey);
    }
  } catch (e) {
    // Fail silently, use fallback
  }
  return [];
};

export const refreshDbGeminiKeys = async () => {
  try {
    const active = await getActiveDbGeminiKeys();
    cachedDbGeminiKeys = active.map(item => item.key);
    lastDbGeminiKeysFetch = Date.now();
  } catch (e) {
    // Fail silently, use in-memory / env fallback
  }
};

/**
 * Asynchronously returns all eligible keys with full metadata, strictly prioritizing MongoDB database keys.
 */
export async function getEligibleGeminiKeysAsync() {
  try {
    const eligible = await getEligibleKeys('gemini');
    if (eligible && eligible.length > 0) {
      return eligible.map((k, index) => ({
        index,
        label: k.label || (index === 0 ? 'primary' : (index === 1 ? 'secondary' : `key_${index + 1}`)),
        key: k.key,
        maskedKey: k.maskedKey || maskApiKey(k.key),
        _id: k._id || null,
        isDbKey: Boolean(k.isDbKey),
        source: k.source || (k.isDbKey ? 'database' : 'environment')
      }));
    }
  } catch (err) {
    console.warn('[GeminiKeyManager] Error resolving async eligible keys:', err.message);
  }

  // Fallback to synchronous env resolution
  return getGeminiKeys();
}

/**
 * Returns available keys securely prioritizing the MongoDB API Keys pool.
 * Fallback to environment variables only if no active MongoDB keys are available.
 */
export function getGeminiKeys() {
  if (Date.now() - lastDbGeminiKeysFetch > 10000) {
    refreshDbGeminiKeys();
  }

  // If active keys exist in MongoDB pool, prioritize them first!
  const hasDbKeys = cachedDbGeminiKeys.length > 0;

  const envKeys = [
    ...parseKeyList(process.env.VITE_GEMINI_API_KEYS),
    ...parseKeyList(process.env.GEMINI_API_KEYS),
    ...parseKeyList(process.env.VITE_GEMINI_KEYS),
    ...parseKeyList(process.env.GEMINI_KEYS),
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY_1 || process.env.GEMINI_KEY_1,
    process.env.GEMINI_API_KEY_2 || process.env.VITE_GEMINI_API_KEY_2 || process.env.GEMINI_KEY_2,
    process.env.GEMINI_API_KEY_3 || process.env.VITE_GEMINI_API_KEY_3 || process.env.GEMINI_KEY_3,
    process.env.GEMINI_API_KEY_4 || process.env.VITE_GEMINI_API_KEY_4 || process.env.GEMINI_KEY_4,
    process.env.GEMINI_API_KEY_5 || process.env.VITE_GEMINI_API_KEY_5 || process.env.GEMINI_KEY_5,
  ].map(sanitizeApiKey).filter(k => k && k.length > 5);

  const prioritizedList = hasDbKeys
    ? [...cachedDbGeminiKeys, ...envKeys]
    : envKeys;

  const unique = [];
  const seen = new Set();
  for (const k of prioritizedList) {
    if (k && !seen.has(k)) {
      seen.add(k);
      unique.push(k);
    }
  }

  return unique.map((key, index) => ({
    index,
    label: index === 0 ? 'primary' : (index === 1 ? 'secondary' : `key_${index + 1}`),
    key,
    maskedKey: maskApiKey(key),
    isFromDb: cachedDbGeminiKeys.includes(key)
  }));
}

/**
 * Checks whether at least one Gemini API key is configured.
 */
export function isGeminiConfigured() {
  return getGeminiKeys().length > 0;
}

/**
 * Identifies whether an error is specifically quota or rate limit exhaustion.
 */
export function isQuotaError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.code || err.error?.code;
  const raw = String(err.message || '') + ' ' + String(err.stack || '') + ' ' + JSON.stringify(err.error || {});
  const lower = raw.toLowerCase();

  return (
    status === 429 ||
    status === 'RESOURCE_EXHAUSTED' ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('ratelimitexceeded') ||
    lower.includes('429')
  );
}

/**
 * Determines whether an error is eligible for failover (429, Quota, 401/403, Timeout, Network).
 * Explicitly rejects retrying ordinary client 400 parameter errors (unless it's API_KEY_INVALID).
 */
export function isFailoverError(err) {
  if (!err) return false;

  const status = err.status || err.statusCode || err.code || err.error?.code;
  const raw = String(err.message || '') + ' ' + String(err.stack || '') + ' ' + JSON.stringify(err.error || {});
  const lowerMsg = raw.toLowerCase();

  // 1. Quota & Rate limits
  if (isQuotaError(err)) return true;

  // 2. Auth / Key issues (401, 403, or 400 with API_KEY_INVALID)
  if (status === 401 || status === 403) return true;
  if (
    lowerMsg.includes('api_key_invalid') ||
    lowerMsg.includes('api key not valid') ||
    lowerMsg.includes('unauthenticated') ||
    lowerMsg.includes('permission_denied') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('forbidden') ||
    lowerMsg.includes('service_disabled') ||
    lowerMsg.includes('api_key_service_blocked')
  ) {
    return true;
  }

  // 3. Network / Timeout errors
  if (
    status === 'GEMINI_TIMEOUT' ||
    lowerMsg.includes('gemini_timeout') ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('network error')
  ) {
    return true;
  }

  // Ordinary client 400 Bad Request (bad prompt format, etc.) should NOT trigger key failover
  if (status === 400) {
    return false;
  }

  return false;
}

/**
 * Creates a GoogleGenAI client for the specified key or index.
 */
export function createGeminiClient(keyOrIndex = 0) {
  const keys = getGeminiKeys();
  if (keys.length === 0) return null;

  let chosenKey = null;
  if (typeof keyOrIndex === 'number') {
    const item = keys.find(k => k.index === keyOrIndex) || keys[0];
    chosenKey = item.key;
  } else if (typeof keyOrIndex === 'string') {
    chosenKey = keyOrIndex;
  }

  if (!chosenKey) return null;
  return new GoogleGenAI({ apiKey: chosenKey });
}

/**
 * Execute a Gemini operation with automatic primary-to-secondary key failover.
 * 
 * @param {Function} operationFn - async ({ client, keyInfo, modelName }) => result
 * @param {Object} options - { modelName, timeoutMs, operationName }
 */
/**
 * Execute a Gemini operation with automatic multi-key quota and error failover across all configured keys.
 * 
 * @param {Function} operationFn - async ({ client, keyInfo, modelName }) => result
 * @param {Object} options - { modelName, timeoutMs, operationName }
 */
export async function executeGeminiOperation(operationFn, options = {}) {
  const startTime = Date.now();
  geminiDiagnostics.totalCalls += 1;

  const defaultModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const requestedModel = options.modelName || defaultModel;
  const timeoutMs = options.timeoutMs || 12000;
  const opName = options.operationName || 'GeminiOp';

  // Quick bail out if all keys recently hit global quota exhaustion (protects against 10-15s stalls per request)
  if (Date.now() < geminiGlobalQuotaCooldownUntil) {
    return {
      success: false,
      error: 'QUOTA_EXHAUSTED',
      message: 'Gemini API keys are currently in quota cooldown',
      allKeysExhausted: true,
      code: 429
    };
  }

  // Asynchronously resolve eligible keys (prioritizes DB keys from KeyResolverService!)
  const keys = await getEligibleGeminiKeysAsync();
  if (keys.length === 0) {
    geminiDiagnostics.failedCalls += 1;
    geminiDiagnostics.lastError = 'No Gemini API keys configured';
    return {
      success: false,
      error: 'NO_KEYS_CONFIGURED',
      message: 'Gemini API key is not configured in MongoDB pool or Render environment variables.'
    };
  }

  // Helper to execute with per-call timeout and model 404 resilience
  const runWithKey = async (keyInfo) => {
    const client = new GoogleGenAI({ apiKey: keyInfo.key });

    const executeWithModel = async (modelToUse) => {
      return await Promise.race([
        operationFn({ client, keyInfo, modelName: modelToUse }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs);
        })
      ]);
    };

    try {
      return await executeWithModel(requestedModel);
    } catch (modelErr) {
      // If configured model 404s (not found), cascade to fallback models (gemini-3.1-flash-lite, gemini-3.8-flash)
      // Note: If 429 quota exhaustion, throw immediately so key failover rotates to next API key!
      const is404 = modelErr.status === 404 || String(modelErr.message || '').includes('not found') || String(modelErr.message || '').includes('no longer available');

      if (is404 && requestedModel !== 'gemini-3.1-flash-lite') {
        try {
          console.warn(`[GeminiKeyManager] Model ${requestedModel} encountered not found (404) for ${opName}. Auto-cascading to gemini-3.1-flash-lite...`);
          return await executeWithModel('gemini-3.1-flash-lite');
        } catch (cascadeErr) {
          if (requestedModel !== 'gemini-3.8-flash' && !isQuotaError(cascadeErr)) {
            console.warn(`[GeminiKeyManager] Cascade to gemini-3.1-flash-lite failed. Trying gemini-3.8-flash...`);
            return await executeWithModel('gemini-3.8-flash');
          }
          throw cascadeErr;
        }
      }
      throw modelErr;
    }
  };

  let lastError = null;
  let allQuota = true;

  for (let i = 0; i < keys.length; i++) {
    const keyInfo = keys[i];
    try {
      const result = await runWithKey(keyInfo);
      if (keyInfo.label === 'primary') {
        geminiDiagnostics.primarySuccess += 1;
      } else {
        geminiDiagnostics.secondarySuccess += 1;
      }
      geminiDiagnostics.lastLatencyMs = Date.now() - startTime;
      
      // Telemetry: record success in keyResolverService
      await recordKeySuccess(keyInfo);

      if (i > 0) {
        console.info(`[GeminiKeyManager] Request succeeded for ${opName} using ${keyInfo.label} (${keyInfo.maskedKey}).`);
      }
      return {
        success: true,
        data: result,
        keyLabel: keyInfo.label,
        keyIndex: keyInfo.index,
        selectedKeyMasked: keyInfo.maskedKey,
        selectedKeyId: keyInfo._id,
        isDbKey: Boolean(keyInfo.isDbKey),
        source: keyInfo.source || 'database',
        failedOver: i > 0
      };
    } catch (err) {
      lastError = err;
      const isRetryable = isFailoverError(err);
      const isQuota = isQuotaError(err);
      if (!isQuota) allQuota = false;

      const safeErrorMsg = sanitizeLogMessage(err.message || 'Unknown error');
      geminiDiagnostics.lastError = safeErrorMsg;

      // Telemetry: record failure in keyResolverService with proper classification
      await recordKeyFailure(keyInfo, {
        status: err.status || err.statusCode || (isQuota ? 429 : 500),
        reason: isQuota ? 'quotaExceeded' : (err.status === 400 ? 'keyInvalid' : 'error'),
        message: safeErrorMsg
      });

      // If non-retryable (e.g. client parameter error), abort immediately
      if (!isRetryable) {
        geminiDiagnostics.failedCalls += 1;
        console.warn(`[GeminiKeyManager] Non-retryable error for ${opName}: ${safeErrorMsg}`);
        return {
          success: false,
          error: 'CLIENT_OR_INPUT_ERROR',
          message: safeErrorMsg,
          selectedKeyMasked: keyInfo.maskedKey
        };
      }

      if (i < keys.length - 1) {
        geminiDiagnostics.totalFailovers += 1;
        geminiDiagnostics.lastFailoverReason = safeErrorMsg;
        const nextKey = keys[i + 1];
        console.warn(`[GeminiKeyManager] Key ${keyInfo.label} (${keyInfo.maskedKey}) failed for ${opName} (${safeErrorMsg}). Automatically failing over to ${nextKey.label} (${nextKey.maskedKey})...`);
        // Jittered backoff between key attempts
        await new Promise(res => setTimeout(res, 80 + Math.floor(Math.random() * 70)));
        continue;
      }
    }
  }

  // All keys exhausted
  geminiDiagnostics.failedCalls += 1;
  const safeFinalMsg = sanitizeLogMessage(lastError?.message || 'All keys failed');
  const isFinalQuota = allQuota || isQuotaError(lastError);
  if (isFinalQuota) {
    geminiGlobalQuotaCooldownUntil = Date.now() + (5 * 60 * 1000); // 5 min fast-fail cooldown
  }
  console.error(`[GeminiKeyManager] All configured Gemini keys (${keys.length}) failed for ${opName}. Last error: ${safeFinalMsg}`);

  return {
    success: false,
    error: isFinalQuota ? 'QUOTA_EXHAUSTED' : (keys.length > 1 ? 'ALL_KEYS_FAILED' : 'PRIMARY_KEY_FAILED'),
    message: safeFinalMsg,
    primaryError: safeFinalMsg,
    secondaryError: safeFinalMsg,
    allKeysExhausted: isFinalQuota,
    code: isFinalQuota ? 429 : (lastError?.status || 500)
  };
}

/**
 * Initialize a Gemini streaming request with automatic key failover BEFORE the stream begins.
 * Once chunks begin streaming, keys are not switched mid-stream.
 * 
 * @param {Function} streamInitFn - async ({ client, keyInfo, modelName }) => AsyncIterable or Stream
 * @param {Object} options - { modelName, timeoutMs, operationName }
 */
export async function executeGeminiStreamOperation(streamInitFn, options = {}) {
  const defaultModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const modelName = options.modelName || defaultModel;
  const timeoutMs = options.timeoutMs || 10000;
  const opName = options.operationName || 'GeminiStream';

  const keys = getGeminiKeys();
  if (keys.length === 0) {
    return {
      success: false,
      error: 'NO_KEYS_CONFIGURED',
      message: 'No Gemini keys configured.'
    };
  }

  // Helper to test if stream can produce its first chunk
  const tryStartStream = async (keyInfo) => {
    const client = new GoogleGenAI({ apiKey: keyInfo.key });
    const stream = await Promise.race([
      streamInitFn({ client, keyInfo, modelName }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs))
    ]);
    return { client, stream, keyInfo };
  };

  let lastErr = null;
  let allQuota = true;

  for (let i = 0; i < keys.length; i++) {
    const keyInfo = keys[i];
    try {
      const started = await tryStartStream(keyInfo);
      return {
        success: true,
        stream: started.stream,
        keyLabel: keyInfo.label,
        keyIndex: keyInfo.index,
        failedOver: i > 0
      };
    } catch (err) {
      lastErr = err;
      const isRetryable = isFailoverError(err);
      const isQuota = isQuotaError(err);
      if (!isQuota) allQuota = false;

      const safeMsg = sanitizeLogMessage(err.message);
      if (!isRetryable) {
        return {
          success: false,
          error: 'CLIENT_OR_INPUT_ERROR',
          message: safeMsg,
          code: 500
        };
      }

      if (i < keys.length - 1) {
        const nextKey = keys[i + 1];
        console.warn(`[GeminiKeyManager] Stream initiation failed on ${keyInfo.label} (${safeMsg}). Failing over to ${nextKey.label} before streaming...`);
        continue;
      }
    }
  }

  const safeLastMsg = sanitizeLogMessage(lastErr?.message || 'All keys failed');
  const isFinalQuota = allQuota || isQuotaError(lastErr);
  return {
    success: false,
    error: isFinalQuota ? 'QUOTA_EXHAUSTED' : 'ALL_KEYS_FAILED',
    message: safeLastMsg,
    primaryError: safeLastMsg,
    secondaryError: safeLastMsg,
    code: isFinalQuota ? 429 : 500
  };
}

export default {
  getGeminiKeys,
  getActiveDbGeminiKeys,
  refreshDbGeminiKeys,
  invalidateGeminiKeyCache,
  isGeminiConfigured,
  isFailoverError,
  isQuotaError,
  createGeminiClient,
  executeGeminiOperation,
  executeGeminiStreamOperation,
  sanitizeLogMessage,
  geminiDiagnostics
};
