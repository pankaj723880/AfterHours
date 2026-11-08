/**
 * Loopra Central AI Configuration Module
 * 
 * Environment-driven model configuration and discovery.
 * Strictly verifies and configures verified Google Gemini models.
 */

import dotenv from 'dotenv';
dotenv.config();

const sanitizeApiKey = (key) => {
  if (typeof key !== 'string') return '';
  let clean = key.trim().replace(/^['"]|['"]$/g, '');
  return clean;
};

const parseKeyList = (raw) => {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/[,\r\n\s]+/)
    .map(sanitizeApiKey)
    .filter(k => k && k.length > 5);
};

export const getGeminiConfigKeys = () => {
  const combined = [
    ...parseKeyList(process.env.VITE_GEMINI_API_KEYS),
    ...parseKeyList(process.env.GEMINI_API_KEYS),
    ...parseKeyList(process.env.VITE_GEMINI_KEYS),
    ...parseKeyList(process.env.GEMINI_KEYS),
  ];

  const discrete = [
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY_1 || process.env.GEMINI_KEY_1,
    process.env.GEMINI_API_KEY_2 || process.env.VITE_GEMINI_API_KEY_2 || process.env.GEMINI_KEY_2,
    process.env.GEMINI_API_KEY_3 || process.env.VITE_GEMINI_API_KEY_3 || process.env.GEMINI_KEY_3,
    process.env.GEMINI_API_KEY_4 || process.env.VITE_GEMINI_API_KEY_4 || process.env.GEMINI_KEY_4,
    process.env.GEMINI_API_KEY_5 || process.env.VITE_GEMINI_API_KEY_5 || process.env.GEMINI_KEY_5,
  ].map(sanitizeApiKey).filter(k => k && k.length > 5);

  const unique = [];
  const seen = new Set();
  for (const k of [...combined, ...discrete]) {
    if (k && !seen.has(k)) {
      seen.add(k);
      unique.push(k);
    }
  }
  return unique;
};

export const GEMINI_CONFIG = {
  // API Keys
  get apiKey() {
    const keys = getGeminiConfigKeys();
    return keys[0] || (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  },
  get secondaryApiKey() {
    const keys = getGeminiConfigKeys();
    return keys[1] || (process.env.GEMINI_API_KEY_2 || '').trim();
  },

  // Verified Model IDs (Default to latest stable Flash & Live models)
  liveModel: (process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live').trim(),
  chatModel: (process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
  intentModel: (process.env.GEMINI_INTENT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
  sttModel: (process.env.GEMINI_STT_MODEL || 'gemini-3.5-transcribe-live').trim(),
  ttsModel: (process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts').trim(),

  // Voice Modes
  voiceMode: (process.env.LOOPRA_VOICE_MODE || 'live').toLowerCase(), // 'live' | 'hybrid' | 'standard'
  enableLiveVoice: process.env.LOOPRA_ENABLE_LIVE_VOICE !== 'false',

  // Limits & Latency Targets
  temperature: 0.35,
  maxContextTurns: 20,
  maxHistoryTokens: 8000,
  startupGreetingMaxWords: 25,
  inactivityTimeoutMs: 60 * 1000
};

/**
 * Returns available Gemini API keys with validation.
 */
export function getAvailableKeys() {
  const rawKeys = getGeminiConfigKeys();
  if (rawKeys.length > 0) {
    return rawKeys.map((key, index) => ({
      index,
      label: index === 0 ? 'primary' : (index === 1 ? 'secondary' : `key_${index + 1}`),
      key
    }));
  }

  const keys = [];
  if (GEMINI_CONFIG.apiKey && GEMINI_CONFIG.apiKey.length > 5) {
    keys.push({ index: 0, label: 'primary', key: GEMINI_CONFIG.apiKey });
  }
  if (GEMINI_CONFIG.secondaryApiKey && GEMINI_CONFIG.secondaryApiKey.length > 5 && GEMINI_CONFIG.secondaryApiKey !== GEMINI_CONFIG.apiKey) {
    keys.push({ index: 1, label: 'secondary', key: GEMINI_CONFIG.secondaryApiKey });
  }
  return keys;
}

export function isGeminiAvailable() {
  return getAvailableKeys().length > 0;
}

export default GEMINI_CONFIG;

