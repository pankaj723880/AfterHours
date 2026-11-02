/**
 * Loopra Voice Session Service
 * Single Microphone Session Architecture & Authoritative State Machine.
 * 
 * Strict Guarantees:
 * 1. ZERO background wake-word listening when Voice Mode is OFF.
 * 2. Microphone activates ONLY on explicit manual user action.
 * 3. Single microphone session: audio is captured once and kept open during active session.
 * 4. SpeechRecognition is NOT stopped or recreated between commands.
 * 5. Safe, idempotent start/stop/restart state guards preventing connect/disconnect loops.
 * 6. Clean deactivation: hardware mic tracks immediately released on OFF.
 */

export const SESSION_STATES = {
  OFF: 'OFF',
  REQUESTING_PERMISSION: 'REQUESTING_PERMISSION',
  CONNECTING: 'CONNECTING',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  EXECUTING: 'EXECUTING',
  ERROR: 'ERROR'
};

export const INACTIVITY_TIMEOUT_MS = 60 * 1000; // 60 seconds

class VoiceSessionController {
  constructor() {
    this.state = SESSION_STATES.OFF;
    this.statusMessage = 'Voice Agent: OFF (Click mic to speak)';
    this.errorMessage = '';
    this.lang = 'en-IN';
    
    // Hardware & Audio references
    this.mediaStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.animFrameId = null;
    this.recognition = null;

    // Concurrency & lifecycle guards
    this.isSessionActive = false;
    this.isRecognizing = false;
    this.isStarting = false;
    this.isManualStopping = false;
    this.isExecuting = false;

    // Timers
    this.restartTimer = null;
    this.inactivityTimer = null;
    this.inactivityStartTime = null;
    this.inactivityRemainingMs = INACTIVITY_TIMEOUT_MS;
    this.isExecutionPaused = false;

    // Command deduplication
    this.lastExecuted = { text: '', timestamp: 0 };

    // Event subscribers
    this.subscribers = new Set();
  }

  // -------------------------------------------------------------
  // Subscription & State Broadcasting
  // -------------------------------------------------------------

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.add(callback);
      // Immediately emit current state snapshot
      callback(this.getSnapshot());
    }
    return () => {
      this.subscribers.delete(callback);
    };
  }

  notifySubscribers(event = 'state_change') {
    const snapshot = this.getSnapshot();
    snapshot.event = event;
    for (const sub of this.subscribers) {
      try {
        sub(snapshot);
      } catch (err) {
        console.warn('[VoiceSessionController] Subscriber error:', err);
      }
    }
  }

  getSnapshot() {
    return {
      state: this.state,
      statusMessage: this.statusMessage,
      errorMessage: this.errorMessage,
      isSessionActive: this.isSessionActive,
      isListening: this.isRecognizing && this.state === SESSION_STATES.LISTENING,
      lang: this.lang
    };
  }

  setState(newState, message = '', error = '') {
    this.state = newState;
    if (message) this.statusMessage = message;
    if (error) this.errorMessage = error;
    this.notifySubscribers('state_change');
  }

  setLanguage(newLang) {
    if (!newLang || newLang === this.lang) return;
    this.lang = newLang;
    if (this.recognition) {
      try {
        this.recognition.lang = newLang;
      } catch (_) {}
    }
    this.notifySubscribers('language_change');
  }

  // -------------------------------------------------------------
  // 60-Second Inactivity Management
  // -------------------------------------------------------------

  startInactivityTimer() {
    this.clearInactivityTimer();
    this.inactivityStartTime = Date.now();
    this.isExecutionPaused = false;
    this.inactivityTimer = setTimeout(() => {
      if (this.isSessionActive && !this.isExecutionPaused && !this.isExecuting) {
        this.stopSession('inactivity');
      }
    }, INACTIVITY_TIMEOUT_MS);
  }

  resetInactivityOnValidCommand() {
    if (!this.isSessionActive) return;
    this.startInactivityTimer();
  }

  pauseInactivityForExecution() {
    this.isExecutionPaused = true;
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  resumeInactivityAfterExecution() {
    if (!this.isSessionActive) return;
    this.isExecutionPaused = false;
    this.startInactivityTimer();
  }

  clearInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    this.inactivityStartTime = null;
    this.isExecutionPaused = false;
  }

  // -------------------------------------------------------------
  // Audio Visualizer & Hardware MediaStream Management
  // -------------------------------------------------------------

  async setupAudioStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('BROWSER_NO_MEDIA_DEVICES');
    }

    // Only create a new stream if not already active
    if (!this.mediaStream || !this.mediaStream.active) {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    }

    // Setup Web Audio Analyser for volume metering
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioContext || this.audioContext.state === 'closed') {
          this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);
        this.analyser = analyser;

        this.startVolumeLoop();
      }
    } catch (e) {
      console.warn('[VoiceSessionController] AudioContext visualizer init warning:', e.message);
    }
  }

  startVolumeLoop() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    const reqAnim = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (cb) => setTimeout(cb, 50);
    const cancelAnim = typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame : (id) => clearTimeout(id);

    const updateVolume = () => {
      if (!this.isSessionActive || !this.analyser) {
        this.emitVolume(0);
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalized = Math.min(1.0, Math.max(0.0, (avg - 10) / 100));
      this.emitVolume(normalized);

      this.animFrameId = reqAnim(updateVolume);
    };

    if (this.animFrameId) cancelAnim(this.animFrameId);
    this.animFrameId = reqAnim(updateVolume);
  }

  emitVolume(scale) {
    const snapshot = this.getSnapshot();
    snapshot.event = 'volume_change';
    snapshot.volumeScale = scale;
    for (const sub of this.subscribers) {
      try {
        sub(snapshot);
      } catch (_) {}
    }
  }

  emitInterim(text) {
    const snapshot = this.getSnapshot();
    snapshot.event = 'interim_transcript';
    snapshot.interimText = text;
    for (const sub of this.subscribers) {
      try {
        sub(snapshot);
      } catch (_) {}
    }
  }

  emitFinalTranscript(text) {
    const snapshot = this.getSnapshot();
    snapshot.event = 'final_transcript';
    snapshot.transcript = text;
    for (const sub of this.subscribers) {
      try {
        sub(snapshot);
      } catch (_) {}
    }
  }

  // -------------------------------------------------------------
  // SpeechRecognition Lifecycle & Guards
  // -------------------------------------------------------------

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = this.lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.isRecognizing = true;
      this.isStarting = false;
      if (this.isSessionActive && !this.isExecuting) {
        this.setState(SESSION_STATES.LISTENING, 'Listening... (Speak your music command)');
      }
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i][0];
        if (event.results[i].isFinal) {
          finalTranscript += item.transcript;
        } else {
          interim += item.transcript;
        }
      }

      if (interim) {
        this.emitInterim(interim);
      }

      if (finalTranscript) {
        const cleaned = finalTranscript.trim();
        this.emitInterim(''); // Clear interim

        if (!cleaned) return;

        // Deduplicate rapid repeat triggers within 2500ms
        const now = Date.now();
        if (
          this.lastExecuted.text === cleaned &&
          (now - this.lastExecuted.timestamp) < 2500
        ) {
          return;
        }
        this.lastExecuted = { text: cleaned, timestamp: now };

        // Valid speech captured: reset inactivity window
        this.resetInactivityOnValidCommand();

        // Switch state to PROCESSING, but KEEP RECOGNITION ALIVE!
        // Do NOT stop speech recognition here!
        this.setState(SESSION_STATES.PROCESSING, `Processing: "${cleaned}"`);
        this.emitFinalTranscript(cleaned);
      }
    };

    recognition.onerror = (event) => {
      const err = event.error;
      // Benign non-fatal events:
      if (err === 'no-speech') {
        // Natural silence between sentences: remain in LISTENING
        return;
      }
      if (err === 'aborted') {
        // Expected when stopping or cleaning up
        return;
      }

      console.warn('[VoiceSessionController] SpeechRecognition error:', err);

      if (err === 'not-allowed' || err === 'service-not-allowed') {
        this.setState(
          SESSION_STATES.ERROR,
          'Microphone permission denied. Please allow microphone access in your browser settings.',
          err
        );
        this.stopSession('permission_denied');
        return;
      }

      if (err === 'audio-capture') {
        this.setState(
          SESSION_STATES.ERROR,
          'Microphone hardware not available or in use by another app.',
          err
        );
        this.stopSession('hardware_error');
        return;
      }

      if (err === 'network') {
        // Speech service network timeout - retry gracefully if session is still active
        if (this.isSessionActive && !this.isManualStopping) {
          this.setState(
            SESSION_STATES.LISTENING,
            'Speech service reconnected. Listening...',
            err
          );
        }
        return;
      }

      // Other generic errors
      if (this.isSessionActive) {
        this.setState(
          SESSION_STATES.ERROR,
          `Speech recognition note: ${err}`,
          err
        );
      }
    };

    recognition.onend = () => {
      this.isRecognizing = false;
      this.isStarting = false;

      // Handle natural browser termination while session is still meant to be ON
      if (this.isSessionActive && !this.isManualStopping) {
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
          if (
            this.isSessionActive &&
            !this.isManualStopping &&
            !this.isRecognizing &&
            !this.isStarting
          ) {
            this.safeStartRecognition();
          }
        }, 180);
      }
    };

    return recognition;
  }

  safeStartRecognition() {
    if (!this.isSessionActive || this.isManualStopping) return;
    if (this.isRecognizing || this.isStarting) return;

    if (!this.recognition) {
      this.recognition = this.initSpeechRecognition();
    }

    if (!this.recognition) {
      this.setState(
        SESSION_STATES.ERROR,
        'Speech recognition not supported in this browser. Please use Chrome or Edge.'
      );
      this.stopSession('unsupported');
      return;
    }

    try {
      this.isStarting = true;
      this.recognition.start();
    } catch (err) {
      this.isStarting = false;
      // If already started, mark recognizing
      if (err.name === 'InvalidStateError') {
        this.isRecognizing = true;
      } else {
        console.warn('[VoiceSessionController] safeStartRecognition error:', err.message);
      }
    }
  }

  // -------------------------------------------------------------
  // Public Lifecycle Control
  // -------------------------------------------------------------

  /**
   * Manually activates Voice Mode.
   * Can ONLY be invoked via explicit user interaction (e.g. clicking the mic button).
   */
  async startSession({ lang } = {}) {
    if (this.isSessionActive) {
      return; // Already active
    }

    this.isManualStopping = false;
    this.isSessionActive = true;
    this.isExecuting = false;
    if (lang) this.lang = lang;

    // 1. Transition to REQUESTING_PERMISSION
    this.setState(
      SESSION_STATES.REQUESTING_PERMISSION,
      'Requesting microphone access...'
    );

    // 2. Request microphone hardware ONCE
    try {
      await this.setupAudioStream();
    } catch (err) {
      console.warn('[VoiceSessionController] Audio stream setup failed:', err);
      let errMsg = 'Microphone permission was denied. Please allow microphone access.';
      if (err.message === 'BROWSER_NO_MEDIA_DEVICES') {
        errMsg = 'Your browser does not support audio recording.';
      }
      this.setState(SESSION_STATES.ERROR, errMsg, err.message);
      this.stopSession('permission_denied');
      return;
    }

    // 3. Transition to CONNECTING
    this.setState(
      SESSION_STATES.CONNECTING,
      'Starting speech recognition...'
    );

    // 4. Initialize and start continuous speech recognition
    this.safeStartRecognition();

    // 5. Start 60s inactivity watchdog
    this.startInactivityTimer();
  }

  /**
   * Called by the application command executor when an action starts.
   * Does NOT stop the microphone!
   */
  notifyExecutionStart(label = '') {
    this.isExecuting = true;
    this.pauseInactivityForExecution();
    this.setState(
      SESSION_STATES.EXECUTING,
      label || 'Executing command...'
    );
  }

  /**
   * Called by the application command executor when action finishes.
   * Smoothly returns state to LISTENING.
   */
  notifyExecutionFinish(message = '') {
    this.isExecuting = false;
    this.resumeInactivityAfterExecution();
    if (this.isSessionActive) {
      this.setState(
        SESSION_STATES.LISTENING,
        message || 'Listening... (Speak your music command)'
      );
    }
  }

  /**
   * Completely stops Voice Mode and releases all hardware & network resources.
   * Guaranteed ZERO background audio capture when called.
   */
  stopSession(reason = 'manual') {
    this.isManualStopping = true;
    this.isSessionActive = false;
    this.isExecuting = false;

    // Clear all pending timers
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    this.clearInactivityTimer();

    // Cancel animation frame & zero volume
    if (this.animFrameId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animFrameId);
      } else {
        clearTimeout(this.animFrameId);
      }
      this.animFrameId = null;
    }
    this.emitVolume(0);

    // Stop and abort speech recognition
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }
    this.isRecognizing = false;
    this.isStarting = false;

    // Release hardware microphone tracks completely
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      this.mediaStream = null;
    }

    // Close AudioContext
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (_) {}
      this.audioContext = null;
    }
    this.analyser = null;

    // Set authoritative state to OFF
    let finalMsg = 'Voice Agent: OFF (Click mic to speak)';
    if (reason === 'inactivity') {
      finalMsg = 'Voice Control turned off due to inactivity.';
    } else if (reason === 'permission_denied') {
      finalMsg = 'Microphone permission denied.';
    }

    this.setState(SESSION_STATES.OFF, finalMsg);
    this.isManualStopping = false;
  }
}

// Global singleton instance for single session controller architecture
export const voiceSessionService = new VoiceSessionController();
export default voiceSessionService;
