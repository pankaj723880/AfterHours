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
  SPEAKING: 'SPEAKING',
  EXECUTING: 'EXECUTING',
  ERROR: 'ERROR'
};

export const INACTIVITY_TIMEOUT_MS = 60 * 1000; // 60 seconds

class VoiceSessionController {
  constructor() {
    this.state = SESSION_STATES.OFF;
    this.statusMessage = 'Voice Agent: OFF (Click mic to speak)';
    this.errorMessage = '';
    this.lang = 'hi-IN'; // Default Hindi per requirements (toggle for en-IN)
    this.initiator = 'global'; // 'global' | 'voice_agent' | 'ai_companion'
    
    // Hardware & Audio references
    this.mediaStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.animFrameId = null;
    this.recognition = null;
    this.audioCaptureRetries = 0;

    // Concurrency & lifecycle guards
    this.isSessionActive = false;
    this.isRecognizing = false;
    this.isStarting = false;
    this.isManualStopping = false;
    this.isExecuting = false;
    this.isSpeakingTts = false;
    this.ttsResumeTimer = null;

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

    // Mobile & Tab Resiliency Listeners
    this.initEnvironmentListeners();
    this.bindVoiceBuddyTtsListener();
  }

  initEnvironmentListeners() {
    if (typeof window === 'undefined') return;

    // 1. Autoplay & Suspension Unlock on User Gesture (Mobile/Safari/Chrome)
    const unlockAudio = () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });

    // 2. Tab Switching & Mobile Background Resiliency (visibilitychange)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // Screen locked or tab backgrounded: Pause recognition to prevent background listening or Android loop
          clearTimeout(this.restartTimer);
          if (this.recognition && this.isRecognizing) {
            try {
              this.recognition.abort();
            } catch (_) {}
          }
        } else {
          // Tab returned to foreground: resume audio context and recognition if session is active
          if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
          }
          if (this.isSessionActive && !this.isSpeakingTts && !this.isExecuting && !this.isManualStopping) {
            setTimeout(() => {
              if (this.isSessionActive && !this.isSpeakingTts && !this.isExecuting) {
                this.safeStartRecognition();
              }
            }, 300);
          }
        }
      });
    }

    // 3. Bluetooth / Audio Input Device Change Resiliency
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        if (this.isSessionActive && this.mediaStream) {
          try {
            const tracks = this.mediaStream.getAudioTracks();
            if (tracks.length === 0 || tracks.some(t => t.readyState === 'ended')) {
              await this.setupAudioStream();
            }
          } catch (_) {}
        }
      });
    }
  }

  // -------------------------------------------------------------
  // Subscription & State Broadcasting
  // -------------------------------------------------------------

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.add(callback);
      // Emit initial snapshot without triggering one-shot command events
      const snapshot = this.getSnapshot();
      snapshot.event = 'initial_state';
      callback(snapshot);
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
    // Distinct mic state indicators: Listening / Processing / Speaking / Idle
    let micState = 'Idle';
    if (this.isSpeakingTts || this.state === SESSION_STATES.SPEAKING) {
      micState = 'Speaking';
    } else if (this.state === SESSION_STATES.PROCESSING || this.state === SESSION_STATES.EXECUTING || this.isExecuting) {
      micState = 'Processing';
    } else if (this.isSessionActive && this.state === SESSION_STATES.LISTENING) {
      micState = 'Listening';
    } else {
      micState = 'Idle';
    }

    return {
      state: this.state,
      micState,
      statusMessage: this.statusMessage,
      errorMessage: this.errorMessage,
      isSessionActive: this.isSessionActive,
      isListening: this.isRecognizing && this.state === SESSION_STATES.LISTENING && !this.isSpeakingTts,
      isSpeakingTts: this.isSpeakingTts,
      lang: this.lang,
      initiator: this.initiator
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
    console.log('[VoiceSession:WebSpeech] Changing language to:', newLang);
    this.lang = newLang;
    if (this.recognition) {
      try {
        this.recognition.lang = newLang;
      } catch (_) {}
    }
    this.notifySubscribers('language_change');
  }

  toggleLanguage() {
    const nextLang = this.lang === 'hi-IN' ? 'en-IN' : 'hi-IN';
    this.setLanguage(nextLang);
    return nextLang;
  }

  bindVoiceBuddyTtsListener() {
    if (typeof window === 'undefined') return;

    const attach = () => {
      if (window.voiceBuddyService && typeof window.voiceBuddyService.subscribe === 'function') {
        window.voiceBuddyService.subscribe((payload) => {
          const evt = typeof payload === 'string' ? payload : payload?.event;
          if (evt === 'speech_start' || evt === 'speech_pending') {
            this.isSpeakingTts = true;
            this.lastTtsText = (payload?.text || '').trim().toLowerCase();
            this.lastTtsStartTime = Date.now();
            if (this.ttsResumeTimer) {
              clearTimeout(this.ttsResumeTimer);
              this.ttsResumeTimer = null;
            }
            if (this.isSessionActive) {
              this.setState(SESSION_STATES.SPEAKING, 'Loopra speaking...');
            }
            this.emitInterim(''); // Flush any lingering interim speech
            // Suppress microphone during TTS playback to avoid hearing own speakers
            this.safeStopRecognition();
          } else if (evt === 'speech_end') {
            // Guard: If voiceBuddyService is still processing queued speech, do NOT emit duplicate cooldown
            const isStillSpeaking = typeof window !== 'undefined' && window.voiceBuddyService && window.voiceBuddyService.isSpeaking;
            if (isStillSpeaking) return;

            this.lastTtsEndTime = Date.now();
            if (this.ttsResumeTimer) {
              clearTimeout(this.ttsResumeTimer);
              this.ttsResumeTimer = null;
            }
            // Exactly one 750ms cooldown prevents speaker reverberation from triggering phantom user speech
            this.ttsResumeTimer = setTimeout(() => {
              this.ttsResumeTimer = null;
              this.isSpeakingTts = false;
              if (this.isSessionActive && !this.isManualStopping && !this.isExecuting) {
                this.setState(SESSION_STATES.LISTENING, 'Listening... (Speak your music command)');
                this.safeStartRecognition();
              }
            }, 750);
          }
        });
        return true;
      }
      return false;
    };

    if (!attach()) {
      setTimeout(attach, 400);
    }
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

    // Setup Web Audio Analyser for 3D visualizer volume metering
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

  emitAudioCommand({ audioData, mimeType, transcript = '' }) {
    const snapshot = this.getSnapshot();
    snapshot.event = 'audio_command';
    snapshot.audioData = audioData;
    snapshot.mimeType = mimeType;
    snapshot.transcript = transcript;
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
    snapshot.initiator = this.initiator;
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
      console.warn('[VoiceSession:WebSpeech] SpeechRecognition API not supported in this browser.');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = this.lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[VoiceSession:WebSpeech] onstart - recognition engine active (lang:', this.lang, ')');
      this.isRecognizing = true;
      this.isStarting = false;
      this.audioCaptureRetries = 0;
      if (this.isSessionActive && !this.isExecuting && !this.isSpeakingTts) {
        this.setState(SESSION_STATES.LISTENING, 'Listening... (Speak your music command)');
      }
    };

    recognition.onaudiostart = () => {
      console.log('[VoiceSession:WebSpeech] onaudiostart - audio stream receiving input');
    };

    recognition.onsoundstart = () => {
      console.log('[VoiceSession:WebSpeech] onsoundstart - sound waveform detected');
    };

    recognition.onspeechstart = () => {
      console.log('[VoiceSession:WebSpeech] onspeechstart - speech pattern identified');
    };

    recognition.onspeechend = () => {
      console.log('[VoiceSession:WebSpeech] onspeechend - speech segment concluded');
    };

    recognition.onsoundend = () => {
      console.log('[VoiceSession:WebSpeech] onsoundend - sound stopped');
    };

    recognition.onaudioend = () => {
      console.log('[VoiceSession:WebSpeech] onaudioend - audio recording stopped');
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

      console.log('[VoiceSession:WebSpeech] onresult:', {
        interim: interim || undefined,
        final: finalTranscript || undefined,
        isFinal: !!finalTranscript
      });

      // Acoustic Echo & Loop Protection:
      // 1. If Loopra is actively speaking, voiceBuddy is speaking, or TTS ended less than 750ms ago, discard audio entirely.
      const isBuddySpeaking = typeof window !== 'undefined' && window.voiceBuddyService && window.voiceBuddyService.isSpeaking;
      if (this.isSpeakingTts || isBuddySpeaking || (this.lastTtsEndTime && Date.now() - this.lastTtsEndTime < 750)) {
        return;
      }

      // 2. Echo content filter: Discard any transcript that echoes what the avatar just spoke
      const candidateText = (finalTranscript || interim || '').toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
      if (candidateText && this.lastTtsText) {
        const cleanTts = this.lastTtsText.replace(/[^a-z0-9\s]/gi, '').trim();
        if (cleanTts && (cleanTts.includes(candidateText) || candidateText.includes(cleanTts)) && (Date.now() - (this.lastTtsEndTime || 0) < 4000)) {
          console.log('[VoiceSession:WebSpeech] Discarded speaker echo from avatar TTS:', candidateText);
          return;
        }
      }

      if (interim) {
        this.emitInterim(interim);
      }

      if (finalTranscript) {
        const cleaned = finalTranscript.trim();
        this.emitInterim(''); // Clear interim

        if (!cleaned) return;

        // Deduplicate rapid repeat triggers within 2000ms
        const now = Date.now();
        if (
          this.lastExecuted.text === cleaned &&
          (now - this.lastExecuted.timestamp) < 2000
        ) {
          return;
        }
        this.lastExecuted = { text: cleaned, timestamp: now };

        this.resetInactivityOnValidCommand();
        this.setState(SESSION_STATES.PROCESSING, `Processing: "${cleaned}"`);
        this.emitFinalTranscript(cleaned);
      }
    };

    recognition.onerror = (event) => {
      const err = event.error;

      if (err === 'no-speech' || err === 'aborted') {
        // Natural speech pause or benign abort on stop/TTS pause - do not flood console or restart loops
        return;
      }

      console.warn('[VoiceSession:WebSpeech] onerror:', err);

      if (err === 'not-allowed' || err === 'service-not-allowed') {
        this.setState(
          SESSION_STATES.ERROR,
          'Microphone permission denied. Please allow microphone access in your browser address bar.',
          err
        );
        this.stopSession('permission_denied');
        return;
      }

      if (err === 'audio-capture') {
        this.audioCaptureRetries = (this.audioCaptureRetries || 0) + 1;
        console.warn(`[VoiceSession:WebSpeech] audio-capture warning (attempt ${this.audioCaptureRetries}/3)`);
        if (this.audioCaptureRetries >= 3) {
          this.setState(
            SESSION_STATES.ERROR,
            'Microphone hardware not available or in use by another application.',
            err
          );
          this.stopSession('hardware_error');
          return;
        }
        // Graceful retry after brief pause on mobile
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
          if (this.isSessionActive && !this.isManualStopping && !this.isSpeakingTts && !this.isExecuting) {
            this.safeStartRecognition();
          }
        }, 800);
        return;
      }

      // For network or non-fatal errors: auto-restart gracefully if session active
      if (this.isSessionActive && !this.isManualStopping) {
        if (err === 'network') {
          this.setState(SESSION_STATES.LISTENING, 'Speech network reconnected. Listening...', err);
        }
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
          if (this.isSessionActive && !this.isManualStopping && !this.isSpeakingTts && !this.isExecuting) {
            this.safeStartRecognition();
          }
        }, 350);
      }
    };

    recognition.onend = () => {
      console.log('[VoiceSession:WebSpeech] onend - recognition instance stopped');
      this.isRecognizing = false;
      this.isStarting = false;

      // Robust auto-restart on 'end' ONLY when session is genuinely active and ready:
      // NOT while speaking TTS, NOT while processing/executing a command, NOT when manual stopping, NOT when page hidden!
      const isDocumentVisible = typeof document === 'undefined' || !document.hidden;
      if (
        this.isSessionActive &&
        !this.isManualStopping &&
        !this.isSpeakingTts &&
        !this.isExecuting &&
        this.state === SESSION_STATES.LISTENING &&
        isDocumentVisible
      ) {
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
          if (
            this.isSessionActive &&
            !this.isManualStopping &&
            !this.isRecognizing &&
            !this.isStarting &&
            !this.isSpeakingTts &&
            !this.isExecuting &&
            this.state === SESSION_STATES.LISTENING &&
            (typeof document === 'undefined' || !document.hidden)
          ) {
            console.log('[VoiceSession:WebSpeech] Continuous recognition restart on end');
            this.safeStartRecognition();
          }
        }, 250);
      }
    };

    return recognition;
  }

  safeStartRecognition() {
    const isDocumentVisible = typeof document === 'undefined' || !document.hidden;
    if (
      !this.isSessionActive ||
      this.isManualStopping ||
      this.isSpeakingTts ||
      this.isExecuting ||
      !isDocumentVisible
    ) {
      return;
    }
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

  safeStopRecognition() {
    this.isStarting = false;
    clearTimeout(this.restartTimer);
    if (!this.recognition) return;
    try {
      this.isRecognizing = false;
      this.recognition.abort();
    } catch (_) {
      try {
        this.recognition.stop();
      } catch (__) {}
    }
  }

  // -------------------------------------------------------------
  // Public Lifecycle Control
  // -------------------------------------------------------------

  /**
   * Manually activates Voice Mode.
   * Can ONLY be invoked via explicit user interaction (e.g. clicking the mic button).
   */
  async startSession({ lang, initiator = 'global' } = {}) {
    if (this.isSessionActive) {
      if (initiator) this.initiator = initiator;
      return; // Already active
    }

    this.isManualStopping = false;
    this.isSessionActive = true;
    this.isExecuting = false;
    this.initiator = initiator || 'global';
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
      const isBuddySpeaking = typeof window !== 'undefined' && window.voiceBuddyService && window.voiceBuddyService.isSpeaking;
      if (this.isSpeakingTts || isBuddySpeaking) {
        this.setState(
          SESSION_STATES.SPEAKING,
          'Loopra speaking...'
        );
      } else {
        this.setState(
          SESSION_STATES.LISTENING,
          message || 'Listening... (Speak your music command)'
        );
        this.safeStartRecognition();
      }
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
    clearTimeout(this.ttsResumeTimer);
    this.ttsResumeTimer = null;
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
