/**
 * Gemini Multi-Key Manager & Automatic Fallback Engine
 * 
 * Complies strictly with:
 * 1. Primary key (GEMINI_API_KEY) by default, secondary key (GEMINI_API_KEY_2) on failure.
 * 2. Automatic failover on HTTP 429, RESOURCE_EXHAUSTED, quota exceeded, 401/403, and timeouts.
 * 3. Safe logging: Never logs, leaks, or exposes raw API keys.
 * 4. Streaming support: Key selection prior to stream start; failover before first chunk; no mid-stream switching.
 * 5. Bounded retries: Sensible backoff, no infinite loops, no retrying client 400 parameter errors.
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
 * Sanitizes any string to ensure API keys are never exposed in logs or errors.
 */
export function sanitizeLogMessage(msg = '') {
  if (!msg) return '';
  const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
  // Redact AIzaSy... or standard Google API key patterns
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
 * Determines whether an error is eligible for failover (429, Quota, 401/403, Timeout, Network).
 * Explicitly rejects retrying ordinary client 400 errors (unless it's API_KEY_INVALID).
 */
export function isFailoverError(err) {
  if (!err) return false;

  const status = err.status || err.statusCode || err.code;
  const message = String(err.message || '') + ' ' + String(err.stack || '');
  const lowerMsg = message.toLowerCase();

  // Quota & Rate limits
  if (status === 429 || status === 'RESOURCE_EXHAUSTED') return true;
  if (lowerMsg.includes('resource_exhausted') || lowerMsg.includes('quota') || lowerMsg.includes('rate limit') || lowerMsg.includes('ratelimitexceeded') || lowerMsg.includes('429')) {
    return true;
  }

  // Auth / Key issues (401, 403, or 400 with API_KEY_INVALID)
  if (status === 401 || status === 403) return true;
  if (
    lowerMsg.includes('api_key_invalid') ||
    lowerMsg.includes('api key not valid') ||
    lowerMsg.includes('unauthenticated') ||
    lowerMsg.includes('permission_denied') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('forbidden')
  ) {
    return true;
  }

  // Network / Timeout errors
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

  // Ordinary client 400 Bad Request should NOT be retried
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
  const modelName = options.modelName || defaultModel;
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

  // Helper to execute an operation with a per-call timeout
  const runWithTimeout = async (keyInfo) => {
    const client = new GoogleGenAI({ apiKey: keyInfo.key });
    return await Promise.race([
      operationFn({ client, keyInfo, modelName }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs);
      })
    ]);
  };

  // 1. Try Primary Key (or first available key)
  const primaryKeyInfo = keys[0];
  try {
    const result = await runWithTimeout(primaryKeyInfo);
    geminiDiagnostics.primarySuccess += 1;
    geminiDiagnostics.lastLatencyMs = Date.now() - startTime;
    return {
      success: true,
      data: result,
      keyLabel: primaryKeyInfo.label,
      keyIndex: primaryKeyInfo.index
    };
  } catch (primaryErr) {
    const isRetryable = isFailoverError(primaryErr);
    const safeErrorMsg = sanitizeLogMessage(primaryErr.message || 'Unknown error');

    geminiDiagnostics.lastError = safeErrorMsg;

    // Check if we have a secondary key and this error qualifies for failover
    const secondaryKeyInfo = keys.find(k => k.index === 1);
    if (isRetryable && secondaryKeyInfo) {
      geminiDiagnostics.totalFailovers += 1;
      geminiDiagnostics.lastFailoverReason = safeErrorMsg;
      console.warn(`[GeminiKeyManager] Primary key failed for ${opName} (${safeErrorMsg}). Automatically failing over to secondary key...`);

      // Brief jittered backoff before secondary attempt (80ms - 150ms)
      await new Promise(res => setTimeout(res, 80 + Math.floor(Math.random() * 70)));

      try {
        const secondaryResult = await runWithTimeout(secondaryKeyInfo);
        geminiDiagnostics.secondarySuccess += 1;
        geminiDiagnostics.lastLatencyMs = Date.now() - startTime;
        console.info(`[GeminiKeyManager] Request succeeded for ${opName} using secondary key.`);
        return {
          success: true,
          data: secondaryResult,
          keyLabel: secondaryKeyInfo.label,
          keyIndex: secondaryKeyInfo.index,
          failedOver: true
        };
      } catch (secondaryErr) {
        const safeSecMsg = sanitizeLogMessage(secondaryErr.message || 'Unknown error');
        geminiDiagnostics.failedCalls += 1;
        geminiDiagnostics.lastError = safeSecMsg;
        console.error(`[GeminiKeyManager] Both primary and secondary keys failed for ${opName}. Secondary error: ${safeSecMsg}`);
        return {
          success: false,
          error: 'ALL_KEYS_FAILED',
          message: safeSecMsg,
          primaryError: safeErrorMsg,
          secondaryError: safeSecMsg
        };
      }
    }

    // No secondary key available, or non-retryable error
    geminiDiagnostics.failedCalls += 1;
    if (!isRetryable) {
      console.warn(`[GeminiKeyManager] Non-retryable error for ${opName}: ${safeErrorMsg}`);
      return {
        success: false,
        error: 'CLIENT_OR_INPUT_ERROR',
        message: safeErrorMsg
      };
    }

    console.error(`[GeminiKeyManager] Primary key failed for ${opName} and no secondary key is configured: ${safeErrorMsg}`);
    return {
      success: false,
      error: 'PRIMARY_KEY_FAILED',
      message: safeErrorMsg
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

  const primaryKeyInfo = keys[0];
  const secondaryKeyInfo = keys.find(k => k.index === 1);

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
    const started = await tryStartStream(primaryKeyInfo);
    return {
      success: true,
      stream: started.stream,
      keyLabel: primaryKeyInfo.label,
      keyIndex: primaryKeyInfo.index
    };
  } catch (primaryErr) {
    const isRetryable = isFailoverError(primaryErr);
    const safeMsg = sanitizeLogMessage(primaryErr.message);

    if (isRetryable && secondaryKeyInfo) {
      console.warn(`[GeminiKeyManager] Stream initiation failed on primary (${safeMsg}). Failing over to secondary key before streaming...`);
      try {
        const startedSec = await tryStartStream(secondaryKeyInfo);
        return {
          success: true,
          stream: startedSec.stream,
          keyLabel: secondaryKeyInfo.label,
          keyIndex: secondaryKeyInfo.index,
          failedOver: true
        };
      } catch (secondaryErr) {
        const safeSecMsg = sanitizeLogMessage(secondaryErr.message);
        return {
          success: false,
          error: 'ALL_KEYS_FAILED',
          message: safeSecMsg
        };
      }
    }

    return {
      success: false,
      error: isRetryable ? 'PRIMARY_KEY_FAILED' : 'CLIENT_OR_INPUT_ERROR',
      message: safeMsg
    };
  }
}

export default {
  getGeminiKeys,
  isGeminiConfigured,
  isFailoverError,
  createGeminiClient,
  executeGeminiOperation,
  executeGeminiStreamOperation,
  sanitizeLogMessage,
  geminiDiagnostics
};

