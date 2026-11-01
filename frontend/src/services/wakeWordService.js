/**
 * Loopra Wake Word & Inactivity Session Service
 * 
 * Provides:
 * 1. Dedicated "Hey Loopra" On-Device Wake Word Detection Engine
 *    - Operates even when Voice Mode is OFF (standby mode).
 *    - Does NOT stream audio to Gemini, LLM or cloud services.
 *    - Uses a lightweight local keyword spotting mechanism using Web Audio API + SpeechRecognition grammar/VAD.
 *    - Never bypasses browser/OS permissions; requests microphone explicitly.
 *    - Cleans wake word phrase from utterances so "Hey Loopra" is never treated as a song name.
 * 
 * 2. Smart 60-Second Inactivity Controller
 *    - Strictly enforces 60s timeout for:
 *      A. No command issued after activation.
 *      B. 60 seconds of continuous silence.
 *      C. 60 seconds of environmental noise/music/traffic without a valid command.
 *      D. Repeated failed/unintelligible recognition without a valid command.
 *    - Does NOT reset timer merely on microphone energy or random noise.
 *    - Resets timer ONLY when a meaningful, valid command is recognized and executed.
 *    - Starts a fresh 60s window after each command execution completes.
 *    - Does NOT interrupt multi-step tasks in progress.
 * 
 * 3. Session State Machine:
 *    - 'OFF': Wake-word detection standby (or fully stopped if permissions not granted).
 *    - 'WAKE_WORD_DETECTED': Wake phrase recognized.
 *    - 'LISTENING': Waiting for actual command.
 *    - 'PROCESSING': Understanding command.
 *    - 'EXECUTING': Performing the action.
 *    - 'ACTIVE_IDLE': Command completed; waiting for next command within 60s.
 *    - 'AUTO_DEACTIVATED': Session ended because of 60s inactivity.
 *    - 'MANUALLY_DEACTIVATED': User explicitly turned it OFF.
 */

export const SESSION_STATES = {
  OFF: 'OFF',
  WAKE_WORD_DETECTED: 'WAKE_WORD_DETECTED',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  EXECUTING: 'EXECUTING',
  ACTIVE_IDLE: 'ACTIVE_IDLE',
  AUTO_DEACTIVATED: 'AUTO_DEACTIVATED',
  MANUALLY_DEACTIVATED: 'MANUALLY_DEACTIVATED'
};

export const INACTIVITY_TIMEOUT_MS = 60 * 1000; // 60 seconds

/**
 * Checks if raw text contains the wake phrase "Hey Loopra" (or common acoustic variations)
 */
export function matchWakeWord(text = '') {
  if (!text || typeof text !== 'string') return { matched: false, remainingText: '' };
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // Pattern matches: "hey loopra", "ay loopra", "he loopra", "ok loopra", "hello loopra", "hai loopra"
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

  // Also match standalone "loopra" if isolated at start
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
 * Lightweight Voice Activity & Sound Energy Estimator
 * Distinguishes between Silence, Environmental Noise, and Human Speech energy.
 */
export function classifyAudioEnergy(averageVolume = 0, peakVolume = 0) {
  // Normalize 0.0 to 1.0
  if (averageVolume < 0.03) {
    return 'silence';
  }
  // Low sustained energy without peak variance -> background hum/noise
  if (averageVolume < 0.12 && (peakVolume - averageVolume) < 0.06) {
    return 'noise';
  }
  // Higher energy or high dynamic variance -> human speech candidate
  if (averageVolume >= 0.12 || (peakVolume - averageVolume) >= 0.08) {
    return 'speech_candidate';
  }
  return 'noise';
}

/**
 * Inactivity Timer Controller
 * Decoupled controller that can be unit-tested without browser dependencies.
 */
export class InactivityController {
  constructor({ onTimeout, timeoutMs = INACTIVITY_TIMEOUT_MS }) {
    this.onTimeout = onTimeout;
    this.timeoutMs = timeoutMs;
    this.timerId = null;
    this.startTime = null;
    this.isPaused = false; // paused while executing multi-step tasks
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

  /**
   * Reset timer only upon recognition of a VALID, MEANINGFUL command.
   * Microphone noise or speech candidate does NOT reset this timer.
   */
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
    this.start(); // Begin a fresh 60s inactivity window
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
 * Detects whether browser environment supports wake word listening
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
