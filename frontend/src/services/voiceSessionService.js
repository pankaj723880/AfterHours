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

import { chatBuddyClient } from './chatBuddyClient.js';
import { getApiUrl } from '../utils/apiUrl.js';
import { USE_V2_VOICE_ENGINE } from '../constants/featureFlags.js';
import { voiceControlService } from './voiceControlService.js';

export const SESSION_STATES = {
  OFF: 'OFF',
  REQUESTING_PERMISSION: 'REQUESTING_PERMISSION',
  CONNECTING: 'CONNECTING',
  LISTENING: 'LISTENING',
  THINKING: 'THINKING',
  PROCESSING: 'PROCESSING',
  SPEAKING: 'SPEAKING',
  INTERRUPTED: 'INTERRUPTED',
  EXECUTING: 'EXECUTING',
  ACTION_COMPLETED: 'ACTION_COMPLETED',
  ERROR: 'ERROR'
};

export const INACTIVITY_TIMEOUT_MS = 60 * 1000; // 60 seconds

/**
 * Lightweight Devanagari to Roman/Hinglish (Latin script) Transliteration Layer.
 * Ensures spoken Hindi/Hinglish words are converted to phonetic Latin script
 * (e.g., "हिस्ट्री" -> "history", "गाना" -> "gaana", "मेरा नाम पंकज है" -> "mera naam pankaj hai").
 */
export function devanagariToHinglish(text) {
  if (!text || typeof text !== 'string') return text || '';
  if (!/[\u0900-\u097F]/.test(text)) return text;

  const dict = {
    'हिस्ट्री': 'history',
    'प्लेलिस्ट': 'playlist',
    'गाना': 'gaana',
    'गाने': 'gaane',
    'सॉन्ग': 'song',
    'सॉन्ग्स': 'songs',
    'म्यूजिक': 'music',
    'चलाओ': 'chalao',
    'चला': 'chala',
    'बजाओ': 'bajao',
    'बजा': 'baja',
    'रोको': 'roko',
    'रोक': 'rok',
    'पॉज': 'pause',
    'प्ले': 'play',
    'अगला': 'agla',
    'नेक्स्ट': 'next',
    'पिछला': 'pichhla',
    'बैक': 'back',
    'आवाज': 'aawaz',
    'आवाज़': 'aawaz',
    'वॉल्यूम': 'volume',
    'कम': 'kam',
    'ज्यादा': 'zyada',
    'बढ़ाओ': 'badhao',
    'घटाओ': 'ghatao',
    'खोजो': 'khojo',
    'ढूंढो': 'dhundho',
    'सर्च': 'search',
    'खोलें': 'kholo',
    'खोलो': 'kholo',
    'ओपन': 'open',
    'बंद': 'band',
    'पसंद': 'pasand',
    'लाइक': 'like',
    'कतार': 'queue',
    'क्यू': 'queue',
    'क्यु': 'queue',
    'होम': 'home',
    'रेडियो': 'radio',
    'डिस्कवर': 'discover',
    'सेटिंग्स': 'settings',
    'प्रोफाइल': 'profile',
    'लूप्रा': 'loopra',
    'मेरा': 'mera',
    'नाम': 'naam',
    'पंकज': 'pankaj',
    'है': 'hai',
    'करो': 'karo',
    'दो': 'do',
    'दे': 'de',
    'सुनो': 'suno',
    'सुनाओ': 'sunao',
    'डांस': 'dance',
    'नाचो': 'nacho',
    'कूद': 'jump',
    'कूदो': 'jump',
    'बाय': 'byeee',
    'बाये': 'byeee'
  };

  let out = text;
  for (const [hindi, latin] of Object.entries(dict)) {
    out = out.replace(new RegExp(hindi, 'g'), latin);
  }

  const charMap = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah',
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ः': 'h', '्': '',
    '़': '', '।': '.', 'ऽ': '', 'ॉ': 'o', 'ॅ': 'e'
  };

  out = out.replace(/[\u0900-\u097F]/g, char => charMap[char] || '');
  return out.replace(/\s+/g, ' ').trim();
}

class VoiceSessionController {
  constructor() {
    this.state = SESSION_STATES.OFF;
    this.statusMessage = 'Voice Agent: OFF (Click mic to speak)';
    this.errorMessage = '';
    this.lang = 'hi-IN'; // Default Hindi per requirements (toggle for en-IN)
    this.initiator = 'global'; // 'global' | 'voice_agent' | 'ai_companion'
    this.hasGreetedThisSession = false;
    
    // Hardware & Audio references
    this.mediaStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.animFrameId = null;
    this.recognition = null;
    this.audioCaptureRetries = 0;

    // MediaRecorder Voice Capture Bypass & 60-Second Timeout Integration
    this.mediaRecorder = null;
    this.recordedAudioChunks = [];
    this.recordingTimeout = null;
    this.isMediaRecorderActive = false;

    // Concurrency & lifecycle guards
    this.isSessionActive = false;
    this.isRecognizing = false;
    this.isStarting = false;
    this.isManualStopping = false;
    this.isExecuting = false;
    this.isSpeakingTts = false;
    this.ttsResumeTimer = null;

    // Track terminal errors to prevent continuous onend restart loops
    this.hasActiveTerminalError = false;
    this.networkErrorCount = 0;
    this.mobileListenTimeout = null;

    // Timers
    this.restartTimer = null;
    this.speechDebounceTimer = null;
    this.inactivityTimer = null;
    this.inactivityStartTime = null;
    this.inactivityRemainingMs = INACTIVITY_TIMEOUT_MS;
    this.isExecutionPaused = false;
    this.persistentTranscriptBuffer = '';

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
      if (typeof window !== 'undefined' && window.voiceBuddyService) {
        window.voiceBuddyService.unlockAudio();
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('touchend', unlockAudio, { passive: true });

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
          // Tab returned to foreground: resume audio context
          if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
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
            // Keep microphone listening so user can barge-in and interrupt at any moment
          } else if (evt === 'speech_end') {
            // Guard: If voiceBuddyService is still processing queued speech, do NOT emit duplicate cooldown
            const isStillSpeaking = typeof window !== 'undefined' && window.voiceBuddyService && window.voiceBuddyService.isSpeaking;
            if (isStillSpeaking) return;

            this.lastTtsEndTime = Date.now();
            if (this.ttsResumeTimer) {
              clearTimeout(this.ttsResumeTimer);
              this.ttsResumeTimer = null;
            }
            this.isSpeakingTts = false;
            if (this.isSessionActive && !this.isManualStopping && !this.isExecuting) {
              this.setState(SESSION_STATES.LISTENING, 'Listening... (Speak your music command or chat)');
              this.safeStartRecognition();
            }
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
    // 1. Android WebView / TWA & Insecure Context Check
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      const warningMsg = 'Microphone access requires HTTPS or localhost';
      console.warn(`[VoiceSessionController] Insecure context: ${warningMsg}`);
      window.dispatchEvent(new CustomEvent('loopra:show-toast', { detail: { message: warningMsg, duration: 4000 } }));
    }

    // Explicitly query Android WebView permissions if Permissions API is supported
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'microphone' });
        if (perm.state === 'denied') {
          console.warn('[VoiceSessionController] Microphone permission is currently denied by device or WebView container');
        }
      } catch (_) {}
    }

    // 2. Resolve getUserMedia across modern and legacy mobile implementations (Android WebView / Opera / Brave)
    const getMedia = navigator.mediaDevices?.getUserMedia
      ? (c) => navigator.mediaDevices.getUserMedia(c)
      : (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia)
        ? (c) => new Promise((res, rej) => (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia).call(navigator, c, res, rej))
        : null;

    if (!getMedia) {
      throw new Error('BROWSER_NO_MEDIA_DEVICES');
    }

    // 3. Android WebView / Mobile constraint resilience:
    // Try optimal echoCancellation first, and fall back to simple audio: true for WebViews.
    if (!this.mediaStream || !this.mediaStream.active) {
      try {
        this.mediaStream = await getMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (err) {
        console.warn('[VoiceSessionController] Advanced audio constraints rejected in WebView/mobile, requesting clean audio: true:', err.message);
        this.mediaStream = await getMedia({ audio: true });
      }
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
    if (typeof window !== 'undefined') {
      window.__loopraVoiceAudioLevel = scale;
    }
    // Only dispatch volume_change subscriber updates if the level changes significantly (> 0.08)
    // or goes to/from 0, preventing high-frequency RAF setState re-renders in subscriber components
    if (Math.abs((this._lastEmittedVolumeScale || 0) - scale) < 0.08 && scale > 0 && this._lastEmittedVolumeScale > 0) {
      return;
    }
    this._lastEmittedVolumeScale = scale;

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
    const SpeechRecognition = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
      : null;
    if (!SpeechRecognition) {
      console.warn('[VoiceSession:WebSpeech] SpeechRecognition API not supported in this browser.');
      return null;
    }

    const recognition = new SpeechRecognition();
    // In Chromium/Brave PWA, speech recognition terminates quickly on silence; single-shot is vastly more reliable
    const isMobileOrBrave = (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Brave/i.test(navigator.userAgent)) || Boolean(typeof navigator !== 'undefined' && navigator.brave?.isBrave);
    recognition.continuous = !isMobileOrBrave;
    recognition.interimResults = true;
    recognition.lang = USE_V2_VOICE_ENGINE ? 'hi-IN' : (this.lang || 'hi-IN');
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[VoiceSession:WebSpeech] onstart - recognition engine active (lang:', this.lang, ')');
      this.isRecognizing = true;
      this.isStarting = false;
      this.audioCaptureRetries = 0;
      this.networkErrorCount = 0;
      this.hasActiveTerminalError = false;
      this.persistentTranscriptBuffer = '';

      // Auto-duck music volume to 10% on listening so background audio doesn't drown user voice
      if (typeof window !== 'undefined' && window.loopraPlayer?.setVolume) {
        window.loopraPlayer.setVolume(10);
      }

      if (this.speechDebounceTimer) {
        clearTimeout(this.speechDebounceTimer);
        this.speechDebounceTimer = null;
      }
      if (this.isSessionActive && !this.isExecuting && !this.isSpeakingTts) {
        this.setState(SESSION_STATES.LISTENING, 'Listening... (Speak your music command)');
      }

      // Safe single-shot auto-timeout to prevent premature 5-second cutoffs (15s total listening window)
      if (this.mobileListenTimeout) {
        clearTimeout(this.mobileListenTimeout);
        this.mobileListenTimeout = null;
      }
      this.mobileListenTimeout = setTimeout(() => {
        if (this.isRecognizing && this.recognition) {
          try { this.recognition.stop(); } catch (_) {}
        }
      }, 15000);
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

      // Aggressively buffer interim and final transcripts into persistent state
      const rawCurrent = (finalTranscript || interim || '').trim();
      if (rawCurrent) {
        this.persistentTranscriptBuffer = rawCurrent;
        this.pendingMobileTranscript = rawCurrent;
      }

      console.log('[VoiceSession:WebSpeech] onresult received (mobile/desktop):', {
        interim: interim || undefined,
        final: finalTranscript || undefined,
        buffered: this.persistentTranscriptBuffer,
        isFinal: !!finalTranscript,
        resultsLength: event.results?.length,
        resultIndex: event.resultIndex
      });

      // Real-Time Barge-In & Interruption Handling:
      // If Loopra is actively speaking and user speaks, evaluate interruption
      const isBuddySpeaking = typeof window !== 'undefined' && window.voiceBuddyService && window.voiceBuddyService.isSpeaking;
      if (this.isSpeakingTts || isBuddySpeaking) {
        const candidateText = (finalTranscript || interim || '').toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();
        const cleanTts = (this.lastTtsText || '').replace(/[^a-z0-9\s]/gi, '').trim();

        // Echo filter: Discard if this is just the avatar's own words echoing into mic
        if (cleanTts && candidateText && cleanTts.includes(candidateText) && candidateText.length < 18) {
          return;
        }

        // Real user speech detected while speaking -> Instant Interruption!
        if (candidateText && candidateText.length > 1) {
          console.log('[VoiceSession:WebSpeech] Barge-in interruption triggered:', candidateText);
          if (typeof window !== 'undefined' && window.voiceBuddyService) {
            window.voiceBuddyService.stopSpeech();
          }
          this.isSpeakingTts = false;
          this.setState(SESSION_STATES.INTERRUPTED, 'Interrupted');
        }
      }

      if (interim) {
        const romanInterim = devanagariToHinglish(interim);
        this.emitInterim(romanInterim || interim);
      }

      if (finalTranscript) {
        const cleaned = devanagariToHinglish(finalTranscript.trim());
        this.emitInterim(''); // Clear interim preview

        if (!cleaned) return;

        // Debounce finalization slightly (300ms) to ensure continuous speech clauses are captured completely
        if (this.speechDebounceTimer) {
          clearTimeout(this.speechDebounceTimer);
        }
        this.speechDebounceTimer = setTimeout(() => {
          if (!this.isSessionActive) return;
          const candidateToEmit = devanagariToHinglish(this.persistentTranscriptBuffer.trim() || cleaned);
          if (!candidateToEmit) return;

          // Deduplicate rapid repeat triggers within 2000ms
          const now = Date.now();
          if (
            this.lastExecuted.text === candidateToEmit &&
            (now - this.lastExecuted.timestamp) < 2000
          ) {
            return;
          }
          this.lastExecuted = { text: candidateToEmit, timestamp: now };
          this.persistentTranscriptBuffer = '';
          this.pendingMobileTranscript = '';

          this.resetInactivityOnValidCommand();
          // Restore volume back to 100% on recognition completion
          if (typeof window !== 'undefined' && window.loopraPlayer?.setVolume) {
            window.loopraPlayer.setVolume(100);
          }
          this.setState(SESSION_STATES.PROCESSING, `Processing: "${candidateToEmit}"`);
          this.emitFinalTranscript(candidateToEmit);
        }, 300);
      }
    };

    recognition.onerror = (event) => {
      const err = event.error;

      console.warn('[VoiceSession:WebSpeech] onerror:', {
        error: err,
        message: event.message,
        isSessionActive: this.isSessionActive,
        isRecognizing: this.isRecognizing
      });

      this.isRecognizing = false;
      this.isStarting = false;
      clearTimeout(this.restartTimer);
      if (this.mobileListenTimeout) {
        clearTimeout(this.mobileListenTimeout);
        this.mobileListenTimeout = null;
      }

      if (err === 'no-speech' || err === 'aborted') {
        // Benign end or silence - restore volume and wait for manual trigger
        if (typeof window !== 'undefined' && window.loopraPlayer?.setVolume) {
          window.loopraPlayer.setVolume(100);
        }
        return;
      }

      if (err === 'not-allowed' || err === 'service-not-allowed') {
        const isBrave = typeof navigator !== 'undefined' && (navigator.brave?.isBrave || navigator.userAgent?.includes('Brave'));
        const hint = isBrave ? ' (Brave Shields may be blocking Google Speech servers. Disable Shields for this site or allow speech service in settings)' : '';
        this.setState(
          SESSION_STATES.ERROR,
          `Microphone or speech service permission denied${hint}. Please allow microphone access.`,
          err
        );
        this.stopSession('permission_denied');
        return;
      }

      if (err === 'audio-capture') {
        this.setState(
          SESSION_STATES.ERROR,
          'Microphone hardware not available or in use by another application.',
          err
        );
        this.stopSession('hardware_error');
        return;
      }

      if (err === 'network') {
        // Automatically bypass flaky browser network speech errors via MediaRecorder voice capture
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
          console.log('[VoiceSession:WebSpeech] Network error encountered. Activating MediaRecorder capture bypass.');
          this.setState(SESSION_STATES.LISTENING, 'Listening via audio capture... (Speak your music command)');
          this.startMediaRecorderCapture();
          return;
        }

        this.setState(SESSION_STATES.ERROR, 'Speech network unavailable. Tap mic to retry.', err);
        this.stopSession('network_error');
        return;
      }

      // Any other error: cleanly display error and terminate session without retries
      this.setState(SESSION_STATES.ERROR, `Speech error: ${err}. Tap mic to retry.`, err);
      this.stopSession(err);
    };

    recognition.onend = () => {
      console.log('[VoiceSession:WebSpeech] onend - recognition instance stopped');
      this.isRecognizing = false;
      this.isStarting = false;
      clearTimeout(this.restartTimer);
      if (this.mobileListenTimeout) {
        clearTimeout(this.mobileListenTimeout);
        this.mobileListenTimeout = null;
      }

      // Restore volume back to 100% when recognition concludes
      if (typeof window !== 'undefined' && window.loopraPlayer?.setVolume) {
        window.loopraPlayer.setVolume(100);
      }

      // Single-Shot STT Fallback: Finalize buffered interim/final speech if engine ended before marking isFinal
      const fallbackText = (this.persistentTranscriptBuffer || this.pendingMobileTranscript || '').trim();
      if (fallbackText) {
        this.persistentTranscriptBuffer = '';
        this.pendingMobileTranscript = '';
        console.log('[VoiceSession:WebSpeech] Speech fallback finalizing on onend:', fallbackText);
        const cleaned = devanagariToHinglish(fallbackText);
        this.emitInterim('');
        this.resetInactivityOnValidCommand();
        this.setState(SESSION_STATES.PROCESSING, `Processing: "${cleaned}"`);
        this.emitFinalTranscript(cleaned);
        return;
      }

      // Single-shot mode: never auto-restart on onend.
      // Mic cleanly waits for manual user click to trigger next utterance.
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

    const isMobileBrowser = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Brave/i.test(navigator.userAgent);
    // On mobile viewports/browsers, always re-create fresh instance if not recognizing, since dead instances cannot restart
    if (!this.recognition || isMobileBrowser) {
      if (this.recognition && isMobileBrowser && !this.isRecognizing) {
        try { this.recognition.abort(); } catch (_) {}
      }
      this.recognition = this.initSpeechRecognition();
    }

    if (!this.recognition) {
      // Fallback: If Web Speech Recognition is unsupported or blocked, use MediaRecorder voice capture bypass
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
        console.log('[VoiceSessionController] SpeechRecognition unavailable, falling back to MediaRecorder voice capture bypass');
        this.setState(SESSION_STATES.LISTENING, 'Listening... (Speak your music command)');
        this.startMediaRecorderCapture();
        return;
      }

      const isOpera = typeof navigator !== 'undefined' && (navigator.userAgent?.includes('OPR/') || navigator.userAgent?.includes('Opera'));
      const hint = isOpera ? 'Opera Mobile does not support Web Speech Recognition. Please use Chrome, Brave or Edge.' : 'Speech recognition not supported in this browser. Please use Chrome or Edge.';
      this.setState(
        SESSION_STATES.ERROR,
        hint
      );
      this.stopSession('unsupported');
      return;
    }

    try {
      this.isStarting = true;
      this.recognition.start();
    } catch (err) {
      this.isStarting = false;
      if (err.name === 'InvalidStateError') {
        // Stale instance on mobile - re-instantiate cleanly and retry
        try {
          this.recognition = this.initSpeechRecognition();
          if (this.recognition) {
            this.isStarting = true;
            this.recognition.start();
          }
        } catch (reErr) {
          this.isStarting = false;
          console.warn('[VoiceSessionController] safeStartRecognition mobile re-init error:', reErr.message);
        }
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
  // MediaRecorder Voice Capture Bypass & 60-Second Timeout Pipeline
  // -------------------------------------------------------------

  async startMediaRecorderCapture() {
    try {
      if (!this.mediaStream || !this.mediaStream.active) {
        await this.setupAudioStream();
      }
      if (!this.mediaStream || !this.mediaStream.active) return false;

      // Stop any existing recorder instance
      this.stopMediaRecorderCapture(false);

      const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
        ? 'audio/webm;codecs=opus'
        : (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm'))
          ? 'audio/webm'
          : 'audio/mp4';

      this.recordedAudioChunks = [];
      const recorder = new MediaRecorder(this.mediaStream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedAudioChunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        this.isMediaRecorderActive = false;
        if (this.recordingTimeout) {
          clearTimeout(this.recordingTimeout);
          this.recordingTimeout = null;
        }

        const chunks = [...this.recordedAudioChunks];
        this.recordedAudioChunks = [];

        if (!this.isSessionActive || chunks.length === 0) return;

        try {
          const audioBlob = new Blob(chunks, { type: mimeType });
          if (audioBlob.size < 500) return;

          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          this.setState(SESSION_STATES.PROCESSING, 'Transcribing voice...');
          const apiUrl = getApiUrl('/api/transcribe');
          const resp = await fetch(apiUrl, {
            method: 'POST',
            body: formData
          });

          if (resp.ok) {
            const data = await resp.json();
            if (data && data.transcript && data.transcript.trim()) {
              const cleaned = devanagariToHinglish(data.transcript.trim());
              console.log('[VoiceSession:MediaRecorder] Transcribed transcript:', cleaned);
              this.resetInactivityOnValidCommand();
              this.setState(SESSION_STATES.PROCESSING, `Processing: "${cleaned}"`);
              this.emitFinalTranscript(cleaned);
            }
          }
        } catch (postErr) {
          console.warn('[VoiceSession:MediaRecorder] Audio transcription POST error:', postErr.message);
        }
      };

      this.mediaRecorder = recorder;
      recorder.start(1000); // 1-second chunks
      this.isMediaRecorderActive = true;

      // Strictly enforce 60-second (60000 ms) recording timeout before auto-stopping
      if (this.recordingTimeout) clearTimeout(this.recordingTimeout);
      this.recordingTimeout = setTimeout(() => {
        console.log('[VoiceSession:MediaRecorder] 60-second recording timeout reached, stopping capture');
        this.stopMediaRecorderCapture(true);
      }, 60000);

      return true;
    } catch (err) {
      console.warn('[VoiceSession:MediaRecorder] Capture start notice:', err.message);
      return false;
    }
  }

  stopMediaRecorderCapture(shouldProcess = true) {
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        if (!shouldProcess) {
          this.recordedAudioChunks = [];
        }
        this.mediaRecorder.stop();
      } catch (_) {}
    }
    this.mediaRecorder = null;
    this.isMediaRecorderActive = false;
  }

  // -------------------------------------------------------------
  // Public Lifecycle Control
  // -------------------------------------------------------------

  /**
   * Manually activates Voice Mode.
   * Can ONLY be invoked via explicit user interaction (e.g. clicking the mic button).
   */
  async startSession({ lang, initiator = 'global' } = {}) {
    // Enforce Voice Control Rollout Permissions: block background / unauthorized triggers
    const accessState = voiceControlService.getAccessState();
    if (accessState && accessState.allowed === false) {
      console.warn('[voiceSessionService] Voice access denied by rollout permissions.');
      this.setState(SESSION_STATES.OFF);
      return;
    }

    if (this.isSessionActive) {
      if (initiator) this.initiator = initiator;
      return; // Already active
    }

    // Direct user-gesture audio unlock for mobile browsers (Brave, Opera, iOS Safari, Android)
    if (typeof window !== 'undefined' && window.voiceBuddyService) {
      window.voiceBuddyService.unlockAudio();
    }

    this.isManualStopping = false;
    this.isSessionActive = true;
    this.isExecuting = false;
    this.hasActiveTerminalError = false;
    this.networkErrorCount = 0;
    this.initiator = initiator || 'global';
    if (lang) this.lang = lang;

    const isMobileViewport = (typeof window !== 'undefined' && window.innerWidth <= 768) ||
      (typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Brave/i.test(navigator.userAgent));

    // 1. Explicit Mobile Mic Trigger:
    // On mobile viewports, start recognition synchronously inside the touch/click event turn
    // to bypass transient user activation expiration that mobile browsers enforce.
    if (isMobileViewport) {
      this.setState(
        SESSION_STATES.LISTENING,
        'Listening... (Speak your music command)'
      );
      this.safeStartRecognition();
      this.startInactivityTimer();

      // Setup audio stream in background for visualizer without delaying STT
      this.setupAudioStream().catch((err) => {
        console.warn('[VoiceSessionController] Mobile audio visualizer stream notice:', err.message);
      });
      return;
    }

    // 2. Desktop Flow:
    this.setState(
      SESSION_STATES.REQUESTING_PERMISSION,
      'Requesting microphone access...'
    );

    // Request microphone hardware ONCE
    try {
      await this.setupAudioStream();
    } catch (err) {
      console.warn('[VoiceSessionController] Audio stream setup failed:', err);
      // On mobile browsers, MediaDevices visualizer stream can safely fail without blocking SpeechRecognition
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('denied')) {
        const isBrave = typeof navigator !== 'undefined' && (navigator.brave?.isBrave || navigator.userAgent?.includes('Brave'));
        const hint = isBrave ? ' (Please allow microphone access or check Brave Shields)' : '';
        const errMsg = `Microphone permission was denied${hint}. Please allow microphone access in your browser address bar.`;
        this.setState(SESSION_STATES.ERROR, errMsg, err.message);
        this.stopSession('permission_denied');
        return;
      }
    }

    // 3. Immediate Activation Greeting Sequence:
    // When Loopra is turned on, play greeting audio immediately first,
    // and ONLY start active SpeechRecognition listening after the greeting finishes.
    const buddy = typeof window !== 'undefined' ? window.voiceBuddyService : null;
    const initialGreeting = (buddy && typeof buddy.generateWelcomeGreeting === 'function')
      ? buddy.generateWelcomeGreeting()
      : 'Arey aao aao! Earphones lagao aur batao aaj kya sunne ka plan hai?';

    const startListeningAfterGreeting = () => {
      if (!this.isSessionActive || this.isManualStopping) return;
      this.isSpeakingTts = false;
      this.setState(
        SESSION_STATES.LISTENING,
        'Listening... (Speak your music command)'
      );
      this.safeStartRecognition();
      this.startInactivityTimer();
    };

    if (!this.hasGreetedThisSession && buddy && buddy.isVoiceOutputEnabled) {
      this.hasGreetedThisSession = true;
      this.isSpeakingTts = true;

      // Attempt dynamic witty greeting via Gemini API with quick fallback
      if (typeof buddy.fetchDynamicAvatarGreeting === 'function') {
        buddy.fetchDynamicAvatarGreeting().then((dynamicGreeting) => {
          if (!this.isSessionActive || this.isManualStopping) return;
          const greetingToSpeak = dynamicGreeting || initialGreeting;
          this.setState(
            SESSION_STATES.SPEAKING,
            `Loopra: "${greetingToSpeak}"`
          );
          buddy.speak(greetingToSpeak, 'welcome', {
            onEnd: () => {
              startListeningAfterGreeting();
            }
          });
        }).catch(() => {
          if (!this.isSessionActive || this.isManualStopping) return;
          this.setState(
            SESSION_STATES.SPEAKING,
            `Loopra: "${initialGreeting}"`
          );
          buddy.speak(initialGreeting, 'welcome', {
            onEnd: () => {
              startListeningAfterGreeting();
            }
          });
        });
      } else {
        this.setState(
          SESSION_STATES.SPEAKING,
          `Loopra: "${initialGreeting}"`
        );
        buddy.speak(initialGreeting, 'welcome', {
          onEnd: () => {
            startListeningAfterGreeting();
          }
        });
      }
    } else {
      this.hasGreetedThisSession = true;
      startListeningAfterGreeting();
    }
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
    this.hasGreetedThisSession = false;

    // Restore music volume to 100% when recognition stops
    if (typeof window !== 'undefined' && window.loopraPlayer?.setVolume) {
      window.loopraPlayer.setVolume(100);
    }

    // Halt any ongoing assistant TTS output immediately
    if (typeof window !== 'undefined' && window.voiceBuddyService) {
      window.voiceBuddyService.stopSpeech();
    }

    // Clear all pending timers
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    if (this.speechDebounceTimer) {
      clearTimeout(this.speechDebounceTimer);
      this.speechDebounceTimer = null;
    }
    clearTimeout(this.ttsResumeTimer);
    this.ttsResumeTimer = null;
    this.hasActiveTerminalError = false;
    this.networkErrorCount = 0;
    this.persistentTranscriptBuffer = '';
    if (this.mobileListenTimeout) {
      clearTimeout(this.mobileListenTimeout);
      this.mobileListenTimeout = null;
    }
    this.clearInactivityTimer();

    // Stop MediaRecorder capture
    this.stopMediaRecorderCapture(false);

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

// Hook export for components requiring dedicated MediaRecorder Voice Capture hook
export function useMediaRecorderVoice({ onTranscript } = {}) {
  const isRecordingRef = { current: false };

  const startRecording = async () => {
    isRecordingRef.current = true;
    return await voiceSessionService.startMediaRecorderCapture();
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    voiceSessionService.stopMediaRecorderCapture(true);
  };

  return {
    startRecording,
    stopRecording,
    isRecording: voiceSessionService.isMediaRecorderActive
  };
}

// Global singleton instance for single session controller architecture
export const voiceSessionService = new VoiceSessionController();
export default voiceSessionService;
