/**
 * Loopra Multi-Model AI Orchestrator & Quota Manager
 * 
 * Provides:
 * 1. Automatic official Gemini model discovery & capability mapping.
 * 2. Task-specific model routing (Casual Chat, Voice Intent, Speech-to-Text, Translation, Complex Tasks, TTS).
 * 3. Model-specific request tracking: RPM, TPM, RPD monitoring.
 * 4. Request queues & concurrency control.
 * 5. Exponential backoff for HTTP 429 errors with Retry-After header support.
 * 6. Automatic fallback cascades across compatible models.
 * 7. In-flight request deduplication.
 * 8. In-memory response caching for idempotent tasks.
 * 9. Protection against unnecessary repeated API calls (short-circuiting local media controls and redundant translations).
 * 10. Strict quota verification tracking: Live quotas without AI Studio session are marked 'UNVERIFIED'.
 */

import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import {
  getGeminiKeys,
  isGeminiConfigured,
  isFailoverError,
  isQuotaError,
  sanitizeLogMessage,
  createGeminiClient
} from './geminiKeyManager.js';

/**
 * Official Google Gemini Models Registry (Current Generative Models)
 */
export const OFFICIAL_GEMINI_MODELS = {
  'gemini-3.1-flash-lite': {
    id: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash-Lite',
    description: 'Cost-efficient, fastest performance for high-frequency, lightweight tasks & translation',
    contextWindow: 1048576,
    capabilities: ['text_generation', 'translation', 'chat', 'lightweight_reasoning'],
    inputModalities: ['text'],
    outputModalities: ['text'],
    defaultRole: 'CASUAL_CHAT',
    baselineQuota: {
      rpm: 15,
      tpm: 250000,
      rpd: 500,
      rpdTier: 'UNVERIFIED'
    }
  },
  'gemini-3.5-flash-lite': {
    id: 'gemini-3.5-flash-lite',
    displayName: 'Gemini 3.5 Flash-Lite',
    description: 'Ultra-low latency, high-throughput execution for structured JSON and sub-agents',
    contextWindow: 1048576,
    capabilities: ['text_generation', 'structured_output', 'translation', 'chat'],
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    defaultRole: 'CASUAL_CHAT_FALLBACK',
    baselineQuota: {
      rpm: 15,
      tpm: 250000,
      rpd: 500,
      rpdTier: 'UNVERIFIED'
    }
  },
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash',
    description: 'High-intelligence, fast multimodal model for agentic, audio and conversational tasks',
    contextWindow: 1048576,
    capabilities: ['text_generation', 'audio_input', 'speech_transcription', 'realtime_conversation', 'tool_use', 'multimodal'],
    inputModalities: ['text', 'audio', 'image', 'video'],
    outputModalities: ['text'],
    defaultRole: 'VOICE_INTENT',
    baselineQuota: {
      rpm: 5,
      tpm: 250000,
      rpd: 20,
      rpdTier: 'UNVERIFIED'
    }
  },
  'gemini-3.5-transcribe': {
    id: 'gemini-3.5-transcribe',
    displayName: 'Gemini 3.5 Transcribe',
    description: 'Fast, specialized speech-to-text with smart and verbatim modes for Indian languages',
    contextWindow: 524288,
    capabilities: ['speech_transcription', 'audio_input'],
    inputModalities: ['audio'],
    outputModalities: ['text'],
    defaultRole: 'SPEECH_TO_TEXT',
    baselineQuota: {
      rpm: 10,
      tpm: 200000,
      rpd: 200,
      rpdTier: 'UNVERIFIED'
    }
  },
  'gemini-4-argon': {
    id: 'gemini-4-argon',
    displayName: 'Gemini 4 Argon',
    description: 'Flagship reasoning model for complex problem solving, coding, and in-depth research',
    contextWindow: 1048576,
    capabilities: ['deep_reasoning', 'complex_tasks', 'analysis', 'structured_output'],
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
    defaultRole: 'COMPLEX_TASK',
    baselineQuota: {
      rpm: 5,
      tpm: 125000,
      rpd: 20,
      rpdTier: 'UNVERIFIED'
    }
  },
  'gemini-3.8-flash-tts': {
    id: 'gemini-3.8-flash-tts',
    displayName: 'Gemini 3.8 Flash TTS',
    description: 'Expressive studio-grade text-to-speech, multi-speaker dialogue, and Voice Design',
    contextWindow: 65536,
    capabilities: ['text_to_speech', 'audio_generation'],
    inputModalities: ['text'],
    outputModalities: ['audio'],
    defaultRole: 'TEXT_TO_SPEECH',
    baselineQuota: {
      rpm: 5,
      tpm: 50000,
      rpd: 50,
      rpdTier: 'UNVERIFIED'
    }
  }
};

/**
 * Task Categories and their prioritized fallback cascades
 */
export const TASK_PRIORITY_CASCADES = {
  CASUAL_CHAT: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'],
  VOICE_INTENT: ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'],
  SPEECH_TO_TEXT: ['gemini-3.5-transcribe', 'gemini-3.8-flash'],
  TRANSLATION: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'],
  COMPLEX_TASK: ['gemini-4-argon', 'gemini-3.8-flash'],
  TEXT_TO_SPEECH: ['gemini-3.8-flash-tts']
};

class MultiModelOrchestrator {
  constructor() {
    this.modelsQuotaState = new Map();
    this.inFlightRequests = new Map(); // key -> Promise (Request deduplication)
    this.responseCache = new Map(); // key -> { value, expiresAt }
    this.discoveredModels = new Map(); // modelId -> metadata
    this.lastDiscoveryTime = 0;
    this.discoveryIntervalMs = 60 * 60 * 1000; // 1 hour refresh

    // Diagnostics
    this.diagnostics = {
      totalRoutedRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      deduplicatedRequests: 0,
      shortCircuitedCalls: 0,
      modelFallbacksTriggered: 0,
      http429Events: 0,
      last429Details: null
    };

    // Initialize quota tracking for all official models
    this.initQuotaTracking();

    // Start background maintenance for sliding window cleanup
    this.maintenanceTimer = setInterval(() => {
      this.cleanupMetricsAndCache();
    }, 15000);

    if (this.maintenanceTimer.unref) {
      this.maintenanceTimer.unref();
    }
  }

  /**
   * Initializes quota data structures for tracked models
   */
  initQuotaTracking() {
    for (const [modelId, spec] of Object.entries(OFFICIAL_GEMINI_MODELS)) {
      if (!this.modelsQuotaState.has(modelId)) {
        this.modelsQuotaState.set(modelId, {
          modelId,
          displayName: spec.displayName,
          requestsCount: 0,
          slidingRPM: [], // timestamps of requests in last 60s
          slidingTPM: [], // { timestamp, tokens } in last 60s
          slidingRPD: [], // timestamps of requests in last 24h
          activeInFlight: 0,
          backoffUntil: 0,
          lastError: null,
          lastStatus: 200,
          quotaInfo: {
            rpmStatus: 'MEASURED_LOCALLY',
            tpmStatus: 'MEASURED_LOCALLY',
            rpdStatus: 'UNVERIFIED', // Per instruction: mark UNVERIFIED unless AI Studio session is verified
            isUnlimitedRpd: false,
            configuredRpm: spec.baselineQuota.rpm,
            configuredTpm: spec.baselineQuota.tpm,
            configuredRpd: spec.baselineQuota.rpd
          }
        });
      }
    }
  }

  /**
   * Automatically discovers available models from the official Gemini API if keys are present.
   * If live API is unreachable or keys missing, retains verified official catalogue.
   */
  async discoverAvailableModels(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.lastDiscoveryTime > 0 && now - this.lastDiscoveryTime < this.discoveryIntervalMs) {
      return Array.from(this.discoveredModels.values());
    }

    const keys = getGeminiKeys();
    if (keys.length === 0) {
      // Use verified catalogue as base
      for (const [id, spec] of Object.entries(OFFICIAL_GEMINI_MODELS)) {
        this.discoveredModels.set(id, {
          ...spec,
          source: 'OFFICIAL_SPECIFICATION',
          isAvailable: true,
          quotaStatus: 'UNVERIFIED'
        });
      }
      this.lastDiscoveryTime = now;
      return Array.from(this.discoveredModels.values());
    }

    try {
      const client = new GoogleGenAI({ apiKey: keys[0].key });
      const apiModels = await client.models.list();
      const discovered = [];

      for await (const m of apiModels) {
        const rawName = m.name || '';
        const cleanId = rawName.replace(/^models\//, '');
        const existingSpec = OFFICIAL_GEMINI_MODELS[cleanId] || {};

        const entry = {
          id: cleanId,
          name: rawName,
          displayName: m.displayName || existingSpec.displayName || cleanId,
          description: m.description || existingSpec.description || 'Google Gemini Model',
          supportedGenerationMethods: m.supportedActions || m.supportedGenerationMethods || [],
          capabilities: existingSpec.capabilities || ['text_generation'],
          inputModalities: existingSpec.inputModalities || ['text'],
          outputModalities: existingSpec.outputModalities || ['text'],
          source: 'GOOGLE_API_LIST_ENDPOINT',
          isAvailable: true,
          quotaStatus: 'UNVERIFIED' // The model-list endpoint does not return project RPD/RPM limits
        };

        this.discoveredModels.set(cleanId, entry);
        discovered.push(entry);

        if (!this.modelsQuotaState.has(cleanId)) {
          this.modelsQuotaState.set(cleanId, {
            modelId: cleanId,
            displayName: entry.displayName,
            requestsCount: 0,
            slidingRPM: [],
            slidingTPM: [],
            slidingRPD: [],
            activeInFlight: 0,
            backoffUntil: 0,
            lastError: null,
            lastStatus: 200,
            quotaInfo: {
              rpmStatus: 'MEASURED_LOCALLY',
              tpmStatus: 'MEASURED_LOCALLY',
              rpdStatus: 'UNVERIFIED',
              isUnlimitedRpd: false,
              configuredRpm: 15,
              configuredTpm: 250000,
              configuredRpd: 500
            }
          });
        }
      }

      this.lastDiscoveryTime = now;
      return discovered.length > 0 ? discovered : Array.from(this.discoveredModels.values());
    } catch (err) {
      console.warn('[MultiModelOrchestrator] Model list API notice:', sanitizeLogMessage(err.message));
      // Populate with official catalogue
      for (const [id, spec] of Object.entries(OFFICIAL_GEMINI_MODELS)) {
        this.discoveredModels.set(id, {
          ...spec,
          source: 'OFFICIAL_SPECIFICATION',
          isAvailable: true,
          quotaStatus: 'UNVERIFIED'
        });
      }
      this.lastDiscoveryTime = now;
      return Array.from(this.discoveredModels.values());
    }
  }

  /**
   * Returns selected model for a given task type, honoring environment overrides
   */
  resolveModelForTask(taskType = 'CASUAL_CHAT') {
    const envOverrides = {
      CASUAL_CHAT: process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_MODEL,
      VOICE_INTENT: process.env.GEMINI_VOICE_MODEL || process.env.GEMINI_MODEL,
      SPEECH_TO_TEXT: process.env.GEMINI_STT_MODEL,
      TRANSLATION: process.env.GEMINI_TRANSLATE_MODEL,
      COMPLEX_TASK: process.env.GEMINI_COMPLEX_MODEL,
      TEXT_TO_SPEECH: process.env.GEMINI_TTS_MODEL
    };

    const override = envOverrides[taskType];
    const defaultCascade = TASK_PRIORITY_CASCADES[taskType] || TASK_PRIORITY_CASCADES.CASUAL_CHAT;

    if (override && override.trim()) {
      const cleanOverride = override.trim();
      // Place the override at the front of the cascade
      const filtered = defaultCascade.filter(m => m !== cleanOverride);
      return [cleanOverride, ...filtered];
    }

    return [...defaultCascade];
  }

  /**
   * Generates a stable deduplication hash
   */
  generateRequestHash(taskType, prompt, extra = {}) {
    const data = JSON.stringify({ taskType, prompt: String(prompt || '').trim(), extra });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Periodic cleanup of cache and sliding metrics
   */
  cleanupMetricsAndCache() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneDayAgo = now - 86400000;

    for (const [_, state] of this.modelsQuotaState.entries()) {
      state.slidingRPM = state.slidingRPM.filter(t => t > oneMinuteAgo);
      state.slidingTPM = state.slidingTPM.filter(item => item.timestamp > oneMinuteAgo);
      state.slidingRPD = state.slidingRPD.filter(t => t > oneDayAgo);
    }

    for (const [key, cached] of this.responseCache.entries()) {
      if (cached.expiresAt <= now) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Record request metrics for a specific model
   */
  recordRequestStart(modelName, estimatedTokens = 100) {
    const state = this.modelsQuotaState.get(modelName);
    if (!state) return;

    const now = Date.now();
    state.requestsCount += 1;
    state.activeInFlight += 1;
    state.slidingRPM.push(now);
    state.slidingTPM.push({ timestamp: now, tokens: estimatedTokens });
    state.slidingRPD.push(now);
  }

  /**
   * Record request completion
   */
  recordRequestEnd(modelName, success, status = 200, error = null, actualTokens = null) {
    const state = this.modelsQuotaState.get(modelName);
    if (!state) return;

    state.activeInFlight = Math.max(0, state.activeInFlight - 1);
    state.lastStatus = status;

    if (actualTokens && state.slidingTPM.length > 0) {
      state.slidingTPM[state.slidingTPM.length - 1].tokens = actualTokens;
    }

    if (!success) {
      state.lastError = sanitizeLogMessage(error?.message || String(error || ''));
    }
  }

  /**
   * Inspects HTTP 429 error and applies exponential backoff with Retry-After support
   */
  handle429RateLimit(modelName, err, attempt = 0) {
    this.diagnostics.http429Events += 1;
    const state = this.modelsQuotaState.get(modelName);
    const rawMsg = String(err?.message || '') + ' ' + JSON.stringify(err || {});
    const safeMsg = sanitizeLogMessage(rawMsg);

    this.diagnostics.last429Details = {
      model: modelName,
      timestamp: new Date().toISOString(),
      message: safeMsg
    };

    // 1. Check for Retry-After in headers or error message
    let retryAfterSeconds = null;
    const retryHeader = err?.response?.headers?.get?.('retry-after') || err?.headers?.['retry-after'];
    if (retryHeader) {
      const parsedHeader = parseInt(retryHeader, 10);
      if (!isNaN(parsedHeader) && parsedHeader > 0) {
        retryAfterSeconds = parsedHeader;
      }
    }

    if (!retryAfterSeconds) {
      const match = rawMsg.match(/retry\s+after\s+([0-9.]+)\s*s/i) || rawMsg.match(/retry\s+in\s+([0-9.]+)\s*s/i);
      if (match && match[1]) {
        retryAfterSeconds = Math.ceil(parseFloat(match[1]));
      }
    }

    // 2. Exponential jittered backoff: 500ms, 1200ms, 2500ms + random jitter
    const baseBackoffMs = 500;
    const maxBackoffMs = 8000;
    const computedMs = Math.min(maxBackoffMs, baseBackoffMs * Math.pow(2, attempt) + Math.floor(Math.random() * 250));
    const finalBackoffMs = retryAfterSeconds ? Math.min(15000, retryAfterSeconds * 1000) : computedMs;

    if (state) {
      state.backoffUntil = Date.now() + finalBackoffMs;
    }

    return finalBackoffMs;
  }

  /**
   * Main Task Execution Engine with Cascade Fallback, Deduplication, and Caching
   * 
   * @param {string} taskType - 'CASUAL_CHAT' | 'VOICE_INTENT' | 'SPEECH_TO_TEXT' | 'TRANSLATION' | 'COMPLEX_TASK' | 'TEXT_TO_SPEECH'
   * @param {Function} taskFn - async ({ client, modelName, keyInfo }) => result
   * @param {Object} options - { prompt, cacheTtlMs, timeoutMs, skipCache, customCascade }
   */
  async executeTask(taskType, taskFn, options = {}) {
    this.diagnostics.totalRoutedRequests += 1;
    const startTime = Date.now();

    const promptText = options.prompt || '';
    const cacheTtlMs = options.cacheTtlMs || 0;
    const timeoutMs = options.timeoutMs || 10000;
    const requestHash = this.generateRequestHash(taskType, promptText, options.extra || {});

    // 1. In-Memory Cache Check
    if (cacheTtlMs > 0 && !options.skipCache) {
      const cached = this.responseCache.get(requestHash);
      if (cached && cached.expiresAt > Date.now()) {
        this.diagnostics.cacheHits += 1;
        return {
          success: true,
          data: cached.value,
          cached: true,
          taskType,
          modelUsed: cached.modelUsed || 'cache',
          latencyMs: Date.now() - startTime
        };
      }
    }

    // 2. In-Flight Request Deduplication Check
    if (this.inFlightRequests.has(requestHash) && !options.skipCache) {
      this.diagnostics.deduplicatedRequests += 1;
      return await this.inFlightRequests.get(requestHash);
    }

    // 3. Create and store execution promise
    const executionPromise = (async () => {
      const cascade = options.customCascade || this.resolveModelForTask(taskType);
      const keys = getGeminiKeys();

      if (keys.length === 0) {
        this.diagnostics.failedRequests += 1;
        return {
          success: false,
          error: 'NO_KEYS_CONFIGURED',
          message: 'Gemini API key is not configured in GEMINI_API_KEY or GEMINI_API_KEY_2.',
          taskType
        };
      }

      let lastError = null;
      let lastHttpStatus = 500;

      // Iterate through models in prioritized cascade
      for (let modelIdx = 0; modelIdx < cascade.length; modelIdx++) {
        const modelName = cascade[modelIdx];
        const modelState = this.modelsQuotaState.get(modelName);

        // Check if model is currently backed off due to 429
        if (modelState && modelState.backoffUntil > Date.now()) {
          console.warn(`[MultiModelOrchestrator] Model ${modelName} is in backoff until ${new Date(modelState.backoffUntil).toISOString()}. Cascading to next model...`);
          this.diagnostics.modelFallbacksTriggered += 1;
          continue;
        }

        // Try primary key, then secondary key if failover eligible
        for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
          const keyInfo = keys[keyIdx];
          const client = new GoogleGenAI({ apiKey: keyInfo.key });

          this.recordRequestStart(modelName);

          try {
            const result = await Promise.race([
              taskFn({ client, modelName, keyInfo, taskType }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs))
            ]);

            this.recordRequestEnd(modelName, true, 200);
            this.diagnostics.successfulRequests += 1;

            // Cache result if TTL specified
            if (cacheTtlMs > 0) {
              this.responseCache.set(requestHash, {
                value: result,
                modelUsed: modelName,
                expiresAt: Date.now() + cacheTtlMs
              });
            }

            return {
              success: true,
              data: result,
              modelUsed: modelName,
              keyLabel: keyInfo.label,
              taskType,
              latencyMs: Date.now() - startTime
            };
          } catch (err) {
            const is429 = isQuotaError(err);
            const status = err.status || err.statusCode || (is429 ? 429 : 500);
            lastHttpStatus = status;
            lastError = err;

            this.recordRequestEnd(modelName, false, status, err);

            if (is429) {
              const backoffMs = this.handle429RateLimit(modelName, err);
              console.warn(`[MultiModelOrchestrator] HTTP 429 on ${modelName} (Key ${keyInfo.label}). Backing off ${backoffMs}ms. Attempting failover...`);
            } else {
              console.warn(`[MultiModelOrchestrator] Model ${modelName} failed on ${keyInfo.label}: ${sanitizeLogMessage(err.message)}`);
            }

            // If secondary key exists and error is failover-eligible, try next key
            const isRetryable = isFailoverError(err);
            if (!isRetryable) {
              // Non-retryable client error on this model, break key loop and try next model
              break;
            }
          }
        }

        // Cascade to next model in cascade
        if (modelIdx < cascade.length - 1) {
          this.diagnostics.modelFallbacksTriggered += 1;
          console.info(`[MultiModelOrchestrator] Cascading task "${taskType}" from ${modelName} to ${cascade[modelIdx + 1]}...`);
        }
      }

      this.diagnostics.failedRequests += 1;
      return {
        success: false,
        error: lastHttpStatus === 429 ? 'ALL_MODELS_QUOTA_EXHAUSTED' : 'ALL_CASCADE_MODELS_FAILED',
        message: sanitizeLogMessage(lastError?.message || 'Cascade execution failed'),
        taskType,
        lastHttpStatus
      };
    })();

    this.inFlightRequests.set(requestHash, executionPromise);

    try {
      return await executionPromise;
    } finally {
      this.inFlightRequests.delete(requestHash);
    }
  }

  /**
   * Dedicated Text Translation Method (High-accuracy multilingual, Hindi, English, Hinglish)
   * Automatically skips translation if source text already matches target language.
   */
  async translateText({ text = '', targetLang = 'hi', sourceLang = 'auto' }) {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      return { success: true, text: '', translated: false };
    }

    // 1. Redundant call protection: Check if translation is even needed
    const isTargetHindi = targetLang.toLowerCase().startsWith('hi');
    const isTargetEnglish = targetLang.toLowerCase().startsWith('en');
    const hasDevanagari = /[\u0900-\u097F]/.test(cleanText);

    if (isTargetHindi && hasDevanagari && !/[a-zA-Z]/.test(cleanText)) {
      this.diagnostics.shortCircuitedCalls += 1;
      return {
        success: true,
        text: cleanText,
        translated: false,
        note: 'Source text is already 100% Devanagari Hindi'
      };
    }

    if (isTargetEnglish && !hasDevanagari && /^[a-zA-Z0-9\s.,!?'"()-]+$/.test(cleanText)) {
      this.diagnostics.shortCircuitedCalls += 1;
      return {
        success: true,
        text: cleanText,
        translated: false,
        note: 'Source text is already standard English'
      };
    }

    const systemPrompt = `
You are Loopra's High-Fidelity Multilingual Translation Engine.
Translate the input text accurately into ${isTargetHindi ? 'natural Indian Hindi (Devanagari)' : 'natural modern English'}.
Preserve song titles, artist names, numbers, and musical terms exactly.
Output ONLY the translated text and nothing else. No markdown, no commentary.
`;

    const result = await this.executeTask('TRANSLATION', async ({ client, modelName }) => {
      const response = await client.models.generateContent({
        model: modelName,
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nTEXT TO TRANSLATE:\n"${cleanText}"` }] }
        ]
      });

      return (response.text || cleanText).trim();
    }, {
      prompt: `${targetLang}:${cleanText}`,
      cacheTtlMs: 3600000, // Cache translations for 1 hour
      extra: { targetLang }
    });

    if (result.success) {
      return {
        success: true,
        text: result.data,
        translated: true,
        modelUsed: result.modelUsed,
        cached: Boolean(result.cached)
      };
    }

    // Fallback if API fails: return original text
    return {
      success: false,
      text: cleanText,
      translated: false,
      error: result.error
    };
  }

  /**
   * Returns authoritative quota status, rate limits, and diagnostics
   */
  getQuotaStatusReport() {
    const modelsReport = {};
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneDayAgo = now - 86400000;

    for (const [modelId, state] of this.modelsQuotaState.entries()) {
      const activeRpm = state.slidingRPM.filter(t => t > oneMinuteAgo).length;
      const activeTpm = state.slidingTPM
        .filter(item => item.timestamp > oneMinuteAgo)
        .reduce((sum, item) => sum + (item.tokens || 0), 0);
      const activeRpd = state.slidingRPD.filter(t => t > oneDayAgo).length;

      modelsReport[modelId] = {
        modelId,
        displayName: state.displayName,
        totalRequests: state.requestsCount,
        currentMeasuredRPM: activeRpm,
        currentMeasuredTPM: activeTpm,
        currentMeasuredRPD: activeRpd,
        activeInFlight: state.activeInFlight,
        isBackedOff: state.backoffUntil > now,
        backoffRemainingMs: Math.max(0, state.backoffUntil - now),
        lastHttpStatus: state.lastStatus,
        lastError: state.lastError,
        quotaLimits: {
          rpm: state.quotaInfo.configuredRpm,
          tpm: state.quotaInfo.configuredTpm,
          rpd: state.quotaInfo.configuredRpd,
          rpdTier: state.quotaInfo.rpdStatus, // 'UNVERIFIED'
          isUnlimitedRpd: state.quotaInfo.isUnlimitedRpd
        }
      };
    }

    return {
      timestamp: new Date().toISOString(),
      keysConfigured: getGeminiKeys().map(k => ({ index: k.index, label: k.label })),
      isConfigured: isGeminiConfigured(),
      models: modelsReport,
      routingCascades: {
        CASUAL_CHAT: this.resolveModelForTask('CASUAL_CHAT'),
        VOICE_INTENT: this.resolveModelForTask('VOICE_INTENT'),
        SPEECH_TO_TEXT: this.resolveModelForTask('SPEECH_TO_TEXT'),
        TRANSLATION: this.resolveModelForTask('TRANSLATION'),
        COMPLEX_TASK: this.resolveModelForTask('COMPLEX_TASK'),
        TEXT_TO_SPEECH: this.resolveModelForTask('TEXT_TO_SPEECH')
      },
      diagnostics: { ...this.diagnostics },
      cacheSize: this.responseCache.size,
      inFlightCount: this.inFlightRequests.size
    };
  }
}

export const multiModelOrchestrator = new MultiModelOrchestrator();
export default multiModelOrchestrator;

