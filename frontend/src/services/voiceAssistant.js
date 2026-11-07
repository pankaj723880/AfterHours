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
  }

  isSupported() {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
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
      const err = new Error('Speech recognition not supported in this browser.');
      this.notify({ error: err.message });
      onError?.(err.message);
      return;
    }

    this.stop(); // Stop any pending session

    const targetLang = lang || this.lang || 'hi-IN';
    this.lang = targetLang;

    try {
      // 1. Explicit Handshake
      await this.requestMicPermission();

      // 2. Initialize SpeechRecognition engine
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      // Mobile Chrome drops connections if continuous is true; use false for mobile single commands
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      recognition.continuous = !isMobile;
      recognition.interimResults = true;
      recognition.lang = targetLang || 'hi-IN'; // Prioritize Hindi/Hinglish Indian accent
      recognition.maxAlternatives = 1;

      // Auto-duck music volume to 10% on listening so background audio doesn't drown user voice
      if (typeof window !== 'undefined' && window.loopraPlayer?.setVolume) {
        window.loopraPlayer.setVolume(10);
      }

      let interimBuffer = '';
      let finalBuffer = '';

      const restoreMusicVolume = () => {
        if (typeof window !== 'undefined' && window.loopraPlayer?.setVolume) {
          window.loopraPlayer.setVolume(100);
        }
      };

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
      if (typeof window !== 'undefined' && window.loopraPlayer?.setVolume) {
        window.loopraPlayer.setVolume(100);
      }
      this.state = VOICE_STATES.ERROR;
      const msg = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
        ? 'Microphone permission denied. Please allow microphone access.'
        : err.message || 'Could not start voice recognition.';
      this.notify({ error: msg });
      onError?.(msg);
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

