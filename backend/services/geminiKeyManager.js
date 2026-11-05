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

/**
 * Returns available keys securely from environment.
 * Reads dynamically at runtime so environment changes take effect immediately.
 */
export function getGeminiKeys() {
  const keys = [];
  const primary = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  const secondary = (process.env.GEMINI_API_KEY_2 || '').trim();

  if (primary && primary.length > 5) {
    keys.push({ index: 0, label: 'primary', key: primary });
  }

  if (secondary && secondary.length > 5 && secondary !== primary) {
    keys.push({ index: 1, label: 'secondary', key: secondary });
  }

  return keys;
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
export async function executeGeminiOperation(operationFn, options = {}) {
  const startTime = Date.now();
  geminiDiagnostics.totalCalls += 1;

  const defaultModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const requestedModel = options.modelName || defaultModel;
  const timeoutMs = options.timeoutMs || 12000;
  const opName = options.operationName || 'GeminiOp';

  const keys = getGeminiKeys();
  if (keys.length === 0) {
    geminiDiagnostics.failedCalls += 1;
    geminiDiagnostics.lastError = 'No Gemini API keys configured';
    return {
      success: false,
      error: 'NO_KEYS_CONFIGURED',
      message: 'Gemini API key is not configured in GEMINI_API_KEY or GEMINI_API_KEY_2.'
    };
  }

  const firstKey = keys[0];
  const fallbackKey = keys.length > 1 && keys[1].key !== firstKey.key ? keys[1] : null;

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
      // If configured model 404s, fallback to gemini-3.8-flash
      const is404 = modelErr.status === 404 || String(modelErr.message || '').includes('not found');
      if (is404 && requestedModel !== 'gemini-3.8-flash') {
        console.warn(`[GeminiKeyManager] Model ${requestedModel} not found for ${opName}. Retrying with gemini-3.8-flash on key ${keyInfo.label}...`);
        return await executeWithModel('gemini-3.8-flash');
      }
      throw modelErr;
    }
  };

  // 1. Try Primary Key (or first available key)
  try {
    const result = await runWithKey(firstKey);
    if (firstKey.label === 'primary') {
      geminiDiagnostics.primarySuccess += 1;
    } else {
      geminiDiagnostics.secondarySuccess += 1;
    }
    geminiDiagnostics.lastLatencyMs = Date.now() - startTime;
    return {
      success: true,
      data: result,
      keyLabel: firstKey.label,
      keyIndex: firstKey.index
    };
  } catch (primaryErr) {
    const isRetryable = isFailoverError(primaryErr);
    const safeErrorMsg = sanitizeLogMessage(primaryErr.message || 'Unknown error');
    geminiDiagnostics.lastError = safeErrorMsg;

    // Check if we have a secondary key and this error qualifies for failover
    if (isRetryable && fallbackKey) {
      geminiDiagnostics.totalFailovers += 1;
      geminiDiagnostics.lastFailoverReason = safeErrorMsg;
      console.warn(`[GeminiKeyManager] Key ${firstKey.label} failed for ${opName} (${safeErrorMsg}). Automatically failing over to ${fallbackKey.label}...`);

      // Brief jittered backoff before secondary attempt (80ms - 150ms)
      await new Promise(res => setTimeout(res, 80 + Math.floor(Math.random() * 70)));

      try {
        const secondaryResult = await runWithKey(fallbackKey);
        geminiDiagnostics.secondarySuccess += 1;
        geminiDiagnostics.lastLatencyMs = Date.now() - startTime;
        console.info(`[GeminiKeyManager] Request succeeded for ${opName} using ${fallbackKey.label}.`);
        return {
          success: true,
          data: secondaryResult,
          keyLabel: fallbackKey.label,
          keyIndex: fallbackKey.index,
          failedOver: true
        };
      } catch (secondaryErr) {
        const safeSecMsg = sanitizeLogMessage(secondaryErr.message || 'Unknown error');
        geminiDiagnostics.failedCalls += 1;
        geminiDiagnostics.lastError = safeSecMsg;
        console.error(`[GeminiKeyManager] Both primary and secondary keys failed for ${opName}. Secondary error: ${safeSecMsg}`);

        const bothQuotaExhausted = isQuotaError(primaryErr) || isQuotaError(secondaryErr);
        return {
          success: false,
          error: bothQuotaExhausted ? 'QUOTA_EXHAUSTED' : 'ALL_KEYS_FAILED',
          message: safeSecMsg,
          primaryError: safeErrorMsg,
          secondaryError: safeSecMsg,
          allKeysExhausted: bothQuotaExhausted,
          code: bothQuotaExhausted ? 429 : (secondaryErr.status || 500)
        };
      }
    }

    // No secondary key available, or non-retryable client error
    geminiDiagnostics.failedCalls += 1;
    if (!isRetryable) {
      console.warn(`[GeminiKeyManager] Non-retryable error for ${opName}: ${safeErrorMsg}`);
      return {
        success: false,
        error: 'CLIENT_OR_INPUT_ERROR',
        message: safeErrorMsg
      };
    }

    const quotaExhausted = isQuotaError(primaryErr);
    console.error(`[GeminiKeyManager] Primary key failed for ${opName} and no secondary key is configured: ${safeErrorMsg}`);
    return {
      success: false,
      error: quotaExhausted ? 'QUOTA_EXHAUSTED' : 'PRIMARY_KEY_FAILED',
      message: safeErrorMsg,
      code: quotaExhausted ? 429 : (primaryErr.status || 500)
    };
  }
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

  const firstKey = keys[0];
  const fallbackKey = keys.length > 1 && keys[1].key !== firstKey.key ? keys[1] : null;

  // Helper to test if stream can produce its first chunk
  const tryStartStream = async (keyInfo) => {
    const client = new GoogleGenAI({ apiKey: keyInfo.key });
    const stream = await Promise.race([
      streamInitFn({ client, keyInfo, modelName }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs))
    ]);
    return { client, stream, keyInfo };
  };

  try {
    const started = await tryStartStream(firstKey);
    return {
      success: true,
      stream: started.stream,
      keyLabel: firstKey.label,
      keyIndex: firstKey.index
    };
  } catch (primaryErr) {
    const isRetryable = isFailoverError(primaryErr);
    const safeMsg = sanitizeLogMessage(primaryErr.message);

    if (isRetryable && fallbackKey) {
      console.warn(`[GeminiKeyManager] Stream initiation failed on ${firstKey.label} (${safeMsg}). Failing over to ${fallbackKey.label} before streaming...`);
      try {
        const startedSec = await tryStartStream(fallbackKey);
        return {
          success: true,
          stream: startedSec.stream,
          keyLabel: fallbackKey.label,
          keyIndex: fallbackKey.index,
          failedOver: true
        };
      } catch (secondaryErr) {
        const safeSecMsg = sanitizeLogMessage(secondaryErr.message);
        const bothQuota = isQuotaError(primaryErr) || isQuotaError(secondaryErr);
        return {
          success: false,
          error: bothQuota ? 'QUOTA_EXHAUSTED' : 'ALL_KEYS_FAILED',
          message: safeSecMsg,
          primaryError: safeMsg,
          secondaryError: safeSecMsg,
          code: bothQuota ? 429 : 500
        };
      }
    }

    const quotaExhausted = isQuotaError(primaryErr);
    return {
      success: false,
      error: quotaExhausted ? 'QUOTA_EXHAUSTED' : (isRetryable ? 'PRIMARY_KEY_FAILED' : 'CLIENT_OR_INPUT_ERROR'),
      message: safeMsg,
      code: quotaExhausted ? 429 : 500
    };
  }
}

export default {
  getGeminiKeys,
  isGeminiConfigured,
  isFailoverError,
  isQuotaError,
  createGeminiClient,
  executeGeminiOperation,
  executeGeminiStreamOperation,
  sanitizeLogMessage,
  geminiDiagnostics
};
