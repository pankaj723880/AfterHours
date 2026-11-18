/**
 * Voice Assistant Service (Modular Speech & Permission Engine)
 * Designed for mobile browsers (Chrome, Brave, Samsung) and Android TWA/WebViews.
 * 
 * Features:
 * 1. Explicit Permission Handshake: Requests getUserMedia on user click to unlock mic hardware
 *    before passing control to SpeechRecognition, cleanly releasing tracks immediately.
 * 2. Cross-browser SpeechRecognition wrapper (webkit / standard) with safe parameter configuration.
 * 3. Authoritative state machine: idle, requesting_permission, listening, processing, error.
 */

import { devanagariToHinglish } from './voiceSessionService.js';

export const VOICE_STATES = {
  IDLE: 'idle',
  REQUESTING_PERMISSION: 'requesting_permission',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  ERROR: 'error'
};

class VoiceAssistantService {
  constructor() {
    this.recognition = null;
    this.state = VOICE_STATES.IDLE;
    this.lang = 'hi-IN';
    this.listeners = new Set();
    this.activeStream = null;
    this.safetyTimer = null;
    this.nativeCleanupFns = [];
    this.isNativeSession = false;
  }

  isSupported() {
    if (typeof window === 'undefined') return false;
    // Check Android native bridge first
    if (window.LoopraAndroid && typeof window.LoopraAndroid.isNativeSpeechAvailable === 'function') {
      try {
        if (window.LoopraAndroid.isNativeSpeechAvailable()) return true;
      } catch (_) {}
    }
    // Web Speech API
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  isNativeAndroidAvailable() {
    if (typeof window === 'undefined') return false;
    if (window.LoopraAndroid && typeof window.LoopraAndroid.isNativeSpeechAvailable === 'function') {
      try {
        return window.LoopraAndroid.isNativeSpeechAvailable();
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
      listener({ state: this.state, lang: this.lang });
    }
    return () => this.listeners.delete(listener);
  }

  notify(payload = {}) {
    const data = { state: this.state, lang: this.lang, ...payload };
    this.listeners.forEach((fn) => {
      try { fn(data); } catch (_) {}
    });
  }

  setLanguage(newLang) {
    this.lang = newLang || 'en-IN';
    if (this.recognition) {
      this.recognition.lang = this.lang;
    }
  }

  /**
   * Mobile/WebView Explicit Permission Handshake
   * Required by Android WebViews & modern mobile browsers before speech engine activation.
   */
  async requestMicPermission() {
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      const warningMsg = 'Microphone access requires HTTPS or localhost';
      console.warn(`[VoiceAssistant] Insecure context: ${warningMsg}`);
      window.dispatchEvent(new CustomEvent('loopra:show-toast', { detail: { message: warningMsg, duration: 4000 } }));
      throw new Error(warningMsg);
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('BROWSER_UNSUPPORTED');
    }

    this.state = VOICE_STATES.REQUESTING_PERMISSION;
    this.notify();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Immediately stop and release hardware audio tracks so SpeechRecognition engine can bind
    stream.getTracks().forEach((track) => track.stop());
    return true;
  }

  /**
   * Starts Speech Recognition session with explicit user gesture and permission handling
   */
  async start({ onTranscript, onFinal, onError, lang } = {}) {
    if (!this.isSupported()) {
      this.state = VOICE_STATES.ERROR;
      const err = new Error('Speech recognition not supported in this browser or app.');
      this.notify({ error: err.message });
      onError?.(err.message);
      return;
    }

    this.stop(); // Stop any pending session

    const targetLang = lang || this.lang || 'hi-IN';
    this.lang = targetLang;

    // Auto-duck music volume to 10% on listening so background audio doesn't drown user voice
    if (typeof window !== 'undefined' && window.loopraPlayer?.setVolume) {
      window.loopraPlayer.setVolume(10);
    }

    const restoreMusicVolume = () => {
      if (typeof window !== 'undefined' && window.loopraPlayer?.setVolume) {
        window.loopraPlayer.setVolume(100);
      }
    };

    // =========================================================================
    // PATH A: Android Native Bridge (Bubblewrap / TWA / Native WebView)
    // =========================================================================
    if (this.isNativeAndroidAvailable()) {
      try {
        this.isNativeSession = true;
        this.state = VOICE_STATES.LISTENING;
        this.notify({ message: 'Listening...' });

        if (this.safetyTimer) clearTimeout(this.safetyTimer);
        this.safetyTimer = setTimeout(() => {
          this.stop();
        }, 12000);

        let latestFinal = '';
        let latestInterim = '';

        const speechHandler = (e) => {
          const detail = e.detail || {};
          const rawText = (detail.text || '').trim();
          const isFinal = Boolean(detail.isFinal);
          if (!rawText) return;

          const converted = devanagariToHinglish(rawText);
          const candidateText = converted || rawText;

          if (isFinal) {
            latestFinal = candidateText;
            latestInterim = '';
          } else {
            latestInterim = candidateText;
          }

          const currentText = (latestFinal || latestInterim).trim();
          this.notify({ interim: latestInterim, final: latestFinal, transcript: currentText });
          onTranscript?.({ interim: latestInterim, final: latestFinal, transcript: currentText });

          if (isFinal && candidateText) {
            if (this.safetyTimer) clearTimeout(this.safetyTimer);
            restoreMusicVolume();
            this.state = VOICE_STATES.IDLE;
            this.notify({ state: VOICE_STATES.IDLE, transcript: candidateText });
            this.cleanupNativeListeners();
            onFinal?.(candidateText);
          }
        };

        const errorHandler = (e) => {
          const errCode = e.detail?.error || 'unknown';
          console.warn('[VoiceAssistant:AndroidNative] Speech error:', errCode);
          if (this.safetyTimer) clearTimeout(this.safetyTimer);
          restoreMusicVolume();
          this.state = VOICE_STATES.ERROR;
          this.cleanupNativeListeners();

          let friendlyError = 'Speech recognition error. Please try speaking again.';
          if (errCode === 'permission_denied') {
            friendlyError = 'Microphone permission blocked. Please allow mic access in app settings.';
          } else if (errCode === 'no_speech' || errCode === 'no_match') {
            friendlyError = 'No speech detected. Please speak closer to your device.';
          } else if (errCode === 'network_error' || errCode === 'network_timeout') {
            friendlyError = 'Voice network error. Please check your internet connection.';
          }

          this.notify({ error: friendlyError });
          onError?.(friendlyError);
        };

        window.addEventListener('loopra-native-speech', speechHandler);
        window.addEventListener('loopra-native-speech-error', errorHandler);
        this.nativeCleanupFns.push(() => {
          window.removeEventListener('loopra-native-speech', speechHandler);
          window.removeEventListener('loopra-native-speech-error', errorHandler);
        });

        window.LoopraAndroid.startSpeechRecognition(targetLang);
        return;
      } catch (nativeErr) {
        console.warn('[VoiceAssistant] Android native speech start failed, falling back to Web Speech:', nativeErr.message);
        this.cleanupNativeListeners();
      }
    }

    // =========================================================================
    // PATH B: Web Speech API (Desktop Chrome/Edge, Mobile Chrome/Safari/Brave)
    // =========================================================================
    try {
      // 1. Explicit Handshake
      await this.requestMicPermission();

      // 2. Initialize SpeechRecognition engine
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported in this browser.');
      }
      const recognition = new SpeechRecognition();

      // Mobile Chrome/Brave PWA drops connections if continuous is true; use false for single-shot commands
      const isMobileOrBrave = /Android|iPhone|iPad|iPod|Brave/i.test(navigator.userAgent) || Boolean(navigator.brave?.isBrave);
      recognition.continuous = !isMobileOrBrave;
      recognition.interimResults = true;
      recognition.lang = targetLang || 'hi-IN'; // Prioritize Hindi/Hinglish Indian accent
      recognition.maxAlternatives = 1;

      let interimBuffer = '';
      let finalBuffer = '';

      recognition.onstart = () => {
        this.state = VOICE_STATES.LISTENING;
        this.notify({ message: 'Listening...' });

        // Safety timeout (12s auto-stop if no speech concluded)
        if (this.safetyTimer) clearTimeout(this.safetyTimer);
        this.safetyTimer = setTimeout(() => {
          this.stop();
        }, 12000);
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || '';
          if (item.isFinal) {
            final += text;
          } else {
            interim += text;
          }
        }

        interimBuffer = interim;
        if (final) finalBuffer += final;

        const currentText = (finalBuffer || interimBuffer).trim();
        this.notify({ interim: interimBuffer, final: finalBuffer, transcript: currentText });
        onTranscript?.({ interim: interimBuffer, final: finalBuffer, transcript: currentText });
      };

      recognition.onerror = (event) => {
        console.warn('[VoiceAssistant] Speech error:', event.error);
        if (this.safetyTimer) clearTimeout(this.safetyTimer);
        restoreMusicVolume();
        this.state = VOICE_STATES.ERROR;

        let friendlyError = `Speech error: ${event.error}`;
        if (event.error === 'not-allowed') {
          friendlyError = 'Microphone permission blocked. Please allow mic access in your browser or app settings.';
        } else if (event.error === 'no-speech') {
          friendlyError = 'No voice detected. Please speak closer to your device.';
        } else if (event.error === 'network') {
          friendlyError = 'Voice network error. Please check your internet connection.';
        }

        this.notify({ error: friendlyError });
        onError?.(friendlyError);
      };

      recognition.onend = () => {
        if (this.safetyTimer) clearTimeout(this.safetyTimer);
        restoreMusicVolume();
        const resolved = (finalBuffer || interimBuffer).trim();
        this.state = VOICE_STATES.IDLE;
        this.notify({ state: VOICE_STATES.IDLE, transcript: resolved });
        if (resolved) {
          onFinal?.(resolved);
        }
      };

      this.recognition = recognition;
      recognition.start();
    } catch (err) {
      if (this.safetyTimer) clearTimeout(this.safetyTimer);
      restoreMusicVolume();
      this.state = VOICE_STATES.ERROR;
      const msg = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
        ? 'Microphone permission denied. Please allow microphone access.'
        : err.message || 'Could not start voice recognition.';
      this.notify({ error: msg });
      onError?.(msg);
    }
  }

  cleanupNativeListeners() {
    while (this.nativeCleanupFns.length > 0) {
      const fn = this.nativeCleanupFns.pop();
      try { fn(); } catch (_) {}
    }
  }

  stop() {
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
    if (typeof window !== 'undefined' && window.loopraPlayer?.setVolume) {
      window.loopraPlayer.setVolume(100);
    }
    if (this.isNativeSession) {
      this.isNativeSession = false;
      this.cleanupNativeListeners();
      if (typeof window !== 'undefined' && window.LoopraAndroid && typeof window.LoopraAndroid.stopSpeechRecognition === 'function') {
        try {
          window.LoopraAndroid.stopSpeechRecognition();
        } catch (_) {}
      }
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }
    this.state = VOICE_STATES.IDLE;
    this.notify();
  }
}

export const voiceAssistant = new VoiceAssistantService();
export default voiceAssistant;

