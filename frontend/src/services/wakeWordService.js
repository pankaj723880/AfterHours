/**
 * Loopra Voice Session & Inactivity Service
 * 
 * NOTE: Automatic background wake-word listening ("Hey Loopra") has been completely removed.
 * Voice Control activates ONLY through explicit manual user interaction.
 * Zero microphone monitoring runs while Voice Control is OFF.
 */

import {
  SESSION_STATES,
  INACTIVITY_TIMEOUT_MS,
  voiceSessionService
} from './voiceSessionService.js';

export { SESSION_STATES, INACTIVITY_TIMEOUT_MS, voiceSessionService };

/**
 * Text utility helper to strip leading greeting prefixes (e.g. "hey loopra play kesariya" -> "play kesariya")
 * when processing already-captured voice utterances.
 * Does NOT run background audio detection.
 */
export function matchWakeWord(text = '') {
  if (!text || typeof text !== 'string') return { matched: false, remainingText: '' };
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // Strip greeting prefixes: "hey loopra", "ok loopra", "hello loopra", "loopra"
  const wakeRegex = /^(hey|he|ay|hai|ok|okay|hello)\s+(loopra|lupra|lubra|lukra)\b/i;
  const match = lower.match(wakeRegex);

  if (match) {
    const remaining = clean.slice(match[0].length).replace(/^[,.\s]+/, '').trim();
    return {
      matched: true,
      wakePhrase: match[0],
      remainingText: remaining
    };
  }

  const standaloneRegex = /^(loopra|lupra)\b/i;
  const standMatch = lower.match(standaloneRegex);
  if (standMatch) {
    const remaining = clean.slice(standMatch[0].length).replace(/^[,.\s]+/, '').trim();
    return {
      matched: true,
      wakePhrase: standMatch[0],
      remainingText: remaining
    };
  }

  return { matched: false, remainingText: clean };
}

/**
 * Audio Energy & Voice Activity Classifier
 */
export function classifyAudioEnergy(averageVolume = 0, peakVolume = 0) {
  if (averageVolume < 0.03) {
    return 'silence';
  }
  if (averageVolume < 0.12 && (peakVolume - averageVolume) < 0.06) {
    return 'noise';
  }
  if (averageVolume >= 0.12 || (peakVolume - averageVolume) >= 0.08) {
    return 'speech_candidate';
  }
  return 'noise';
}

/**
 * Inactivity Timer Controller
 */
export class InactivityController {
  constructor({ onTimeout, timeoutMs = INACTIVITY_TIMEOUT_MS }) {
    this.onTimeout = onTimeout;
    this.timeoutMs = timeoutMs;
    this.timerId = null;
    this.startTime = null;
    this.isPaused = false;
  }

  start() {
    this.clear();
    this.startTime = Date.now();
    this.isPaused = false;
    this.timerId = setTimeout(() => {
      if (!this.isPaused && typeof this.onTimeout === 'function') {
        this.onTimeout();
      }
    }, this.timeoutMs);
  }

  resetOnValidCommand() {
    this.start();
  }

  pauseForExecution() {
    this.isPaused = true;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  resumeAfterExecution() {
    this.isPaused = false;
    this.start();
  }

  clear() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.startTime = null;
    this.isPaused = false;
  }

  getRemainingMs() {
    if (!this.startTime || this.isPaused) return this.timeoutMs;
    const elapsed = Date.now() - this.startTime;
    return Math.max(0, this.timeoutMs - elapsed);
  }
}

/**
 * Checks whether browser environment supports Web Speech & MediaDevices
 */
export function checkWakeWordBrowserSupport() {
  if (typeof window === 'undefined') {
    return { supported: false, reason: 'Non-browser environment' };
  }

  const hasMediaDevices = Boolean(navigator?.mediaDevices?.getUserMedia);
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!hasMediaDevices && !SpeechRec) {
    return {
      supported: false,
      reason: 'Browser lacks Audio and Speech Recognition support'
    };
  }

  return {
    supported: true,
    hasSpeechRec: Boolean(SpeechRec),
    hasMediaDevices
  };
}
