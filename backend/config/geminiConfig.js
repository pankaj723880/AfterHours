/**
 * Loopra Central AI Configuration Module
 * 
 * Environment-driven model configuration and discovery.
 * Strictly verifies and configures verified Google Gemini models.
 */

import dotenv from 'dotenv';
dotenv.config();

export const GEMINI_CONFIG = {
  // API Keys
  apiKey: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim(),
  secondaryApiKey: (process.env.GEMINI_API_KEY_2 || '').trim(),

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

