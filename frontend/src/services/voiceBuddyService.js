/**
 * Loopra Voice Buddy & Character Intelligence Service
 * 
 * Rebuilt for Loopra:
 * 1. Single unified female companion: LOOPRA
 *    - Loopra (Female Voice) - en-IN-NeerjaExpressiveNeural, fast conversational natural Hindi/Hinglish
 * 2. Studio-quality Neural Indian Hindi TTS with 1.10x–1.14x natural pace.
 * 3. Varied conversational dialogue generator (no static repetition).
 */

import { getApiUrl } from '../utils/apiUrl.js';

export const CHARACTERS = {
  female: {
    id: 'female',
    key: 'female',
    name: 'Loopra',
    gender: 'female',
    label: 'Loopra (Female Voice)',
    subtitle: 'Warm • Cheerful • Expressive Indian Voice',
    description: 'Animated Live2D physical Loopra companion in techwear hoodie',
    avatarImg: '/characters/female_bust.png',
    color: '#10b981', // Loopra Emerald / Cyan
    glowColor: 'rgba(16, 185, 129, 0.7)',
    voiceId: 'en-IN-NeerjaExpressiveNeural',
    pitch: 1.05,
    rate: 1.5 // 1.5x natural conversational speed
  }
};

class VoiceBuddyService {
  constructor() {
    this.activeCharacterKey = 'female';
    this.isVoiceOutputEnabled = this.getSavedVoiceOutput();
    this.isPlaybackActive = false;
    this.speechSynthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.isSpeaking = false;
    this.subscribers = new Set();
    this.currentAudio = null;
    this._currentUtterance = null;
    this.hasLoadedVoices = false;
    this.speechQueue = [];
    this.isProcessingQueue = false;
    this.heartbeatTimer = null;
    this.watchdogTimer = null;
    this.lastSpokenText = '';
    this.lastSpokenTime = 0;
    this.audioContext = null;
    this.audioAnalyser = null;
    this.audioMeterAnimationId = null;

    if (typeof window !== 'undefined' && this.speechSynthesis) {
      if (typeof this.speechSynthesis.onvoiceschanged !== 'undefined') {
        this.speechSynthesis.onvoiceschanged = () => {
          this.hasLoadedVoices = true;
          this.cachedIndianVoice = this.getIndianVoice();
        };
      }
    }

    // Direct user-gesture audio unlock for mobile browsers (Brave, Opera, iOS Safari, Android)
    if (typeof window !== 'undefined') {
      const handleUserUnlock = () => {
        this.unlockAudio();
      };
      ['touchstart', 'touchend', 'click', 'pointerdown', 'keydown'].forEach((evt) => {
        window.addEventListener(evt, handleUserUnlock, { capture: true, passive: true });
      });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.isSpeaking && this.speechSynthesis?.paused) {
          this.speechSynthesis.resume();
        }
      });
    }

    // Explicit binding to ensure methods are resilient across HMR and detached contexts
    this.setPlaybackActive = this.setPlaybackActive.bind(this);
    this.isMusicPlaying = this.isMusicPlaying.bind(this);
    this.setVoiceOutput = this.setVoiceOutput.bind(this);
    this.toggleVoiceOutput = this.toggleVoiceOutput.bind(this);
    this.speak = this.speak.bind(this);
    this.stopSpeech = this.stopSpeech.bind(this);
    this.processQueue = this.processQueue.bind(this);
    this.executeSpeech = this.executeSpeech.bind(this);
    this.getIndianVoice = this.getIndianVoice.bind(this);
    this.speakWithSpeechSynthesis = this.speakWithSpeechSynthesis.bind(this);
    this.startSyntheticAudioMeter = this.startSyntheticAudioMeter.bind(this);
    this.stopSyntheticAudioMeter = this.stopSyntheticAudioMeter.bind(this);
    this.initAudioMeter = this.initAudioMeter.bind(this);
    this.stopAudioMeter = this.stopAudioMeter.bind(this);
    this.fallbackToIndianSpeechSynthesis = this.fallbackToIndianSpeechSynthesis.bind(this);
    this.startHeartbeat = this.startHeartbeat.bind(this);
    this.clearHeartbeat = this.clearHeartbeat.bind(this);
    this.unlockAudio = this.unlockAudio.bind(this);
    this.getActiveCharacter = this.getActiveCharacter.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.notifySubscribers = this.notifySubscribers.bind(this);
  }

  getSavedCharacter() {
    return 'female';
  }

  getSavedVoiceOutput() {
    if (typeof localStorage === 'undefined') return true;
    const saved = localStorage.getItem('loopra_voice_output');
    return saved !== 'false'; // Defaults to true
  }

  setVoiceOutput(enabled) {
    this.isVoiceOutputEnabled = !!enabled;
    try {
      localStorage.setItem('loopra_voice_output', this.isVoiceOutputEnabled ? 'true' : 'false');
    } catch (_) { }
    if (!this.isVoiceOutputEnabled) {
      this.stopSpeech();
    }
    this.notifySubscribers('voice_output_change', { enabled: this.isVoiceOutputEnabled });
  }

  toggleVoiceOutput() {
    this.setVoiceOutput(!this.isVoiceOutputEnabled);
    return this.isVoiceOutputEnabled;
  }

  /**
   * Direct user-gesture audio unlock mechanism for mobile browsers (Brave, Opera, iOS, Android).
   * Prevents speechSynthesis and audio streams from being silenced by privacy shields or autoplay blocks.
   */
  unlockAudio() {
    if (typeof window === 'undefined') return;

    // 1. Unlock Web SpeechSynthesis
    try {
      if (this.speechSynthesis) {
        if (this.speechSynthesis.paused) {
          this.speechSynthesis.resume();
        }
        // Prime mobile speech engine queue with silent utterance
        if (!this._speechSynthUnlocked) {
          try {
            const silentUtt = new SpeechSynthesisUtterance(' ');
            silentUtt.volume = 0;
            silentUtt.rate = 2.0;
            this.speechSynthesis.speak(silentUtt);
            this._speechSynthUnlocked = true;
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 2. Unlock Web AudioContext & Hardware Audio Routing
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioContext || this.audioContext.state === 'closed') {
          this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().catch(() => {});
        }
        // Play 1-sample silent buffer to unlock hardware audio routing across mobile shields
        if (!this._audioHardwareUnlocked && this.audioContext.state === 'running') {
          try {
            const buffer = this.audioContext.createBuffer(1, 1, 22050);
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            source.start(0);
            this._audioHardwareUnlocked = true;
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 3. Unlock HTML5 Audio element autoplay for backend neural stream
    try {
      if (!this._dummyAudioUnlocked) {
        const dummyAudio = new Audio();
        dummyAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        dummyAudio.volume = 0.01;
        const p = dummyAudio.play();
        if (p !== undefined) {
          p.then(() => {
            dummyAudio.pause();
            dummyAudio.src = '';
            this._dummyAudioUnlocked = true;
          }).catch(() => {});
        }
      }
    } catch (_) {}

    // 4. Cache verified Indian female voice
    if (!this.cachedIndianVoice) {
      this.cachedIndianVoice = this.getIndianVoice();
    }
  }

  setPlaybackActive(isPlaying) {
    this.isPlaybackActive = !!isPlaying;
    if (typeof window !== 'undefined') {
      window.__loopraIsMusicPlaying = !!isPlaying;
    }
    // Note: Do not abort ongoing TTS confirmation when song playback starts;
    // let Loopra smoothly finish her short voice reply to the user.
    this.notifySubscribers('playback_change', { isPlaying: this.isPlaybackActive });
  }

  isMusicPlaying() {
    if (this.isPlaybackActive) return true;
    if (typeof window !== 'undefined' && window.__loopraIsMusicPlaying) return true;
    return false;
  }

  setCharacter(characterKey = 'female') {
    this.activeCharacterKey = 'female';
    try {
      localStorage.setItem('loopra_voice_character', 'female');
    } catch (_) { }
    this.notifySubscribers('character_change');
  }

  getActiveCharacter() {
    return CHARACTERS.female;
  }

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.add(callback);
    }
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(event, data = {}) {
    for (const sub of this.subscribers) {
      try {
        sub({ event, character: this.getActiveCharacter(), ...data });
      } catch (e) {
        console.warn('[VoiceBuddyService] subscriber notice:', e);
      }
    }
  }

  /**
   * Generates fresh, warm, natural and confident companion greetings for Loopra AI.
   * Avoids repetitive "kya sunna hai" or "kya baat karenge".
   */
  generateWelcomeGreeting() {
    const greetings = [
      'Hey! Kya haal hai?',
      'Hello! Kaise ho?',
      'Hey there! I\'m here.',
      'Hey dost! Kaise ho aap?',
      'Hello! Good to see you.'
    ];

    const randomIndex = Math.floor(Math.random() * greetings.length);
    return greetings[randomIndex];
  }

  /**
   * Generates varied, authentic conversational Hindi / Hinglish responses for Loopra female companion.
   */
  generateFriendReply(action, details = {}) {
    const cleanAction = typeof action === 'string' ? action : (action?.action || '');
    const text = typeof action === 'string' ? action.toLowerCase() : '';
    const target = (details.target || details.query || '').toLowerCase();

    // 0. Welcome / Activation Greeting
    if (cleanAction === 'welcome' || cleanAction === 'greeting' || cleanAction === 'start' || text.includes('welcome') || text.includes('greeting')) {
      return this.generateWelcomeGreeting();
    }

    // 1. Saloon FM Navigation
    if (target === 'barber' || text.includes('saloon') || text.includes('salon') || text.includes('lune')) {
      return 'Haan bilkul! Main Saloon FM open kar rahi hu.';
    }

    // 2. Theka Session Navigation
    if (target === 'pauwa' || text.includes('theka') || text.includes('pauwa')) {
      return 'Theka Session ready hai! Shuru karte hai.';
    }

    // 3. Horn Ok Please (Truck / Highway)
    if (target === 'truck' || text.includes('horn') || text.includes('highway')) {
      return 'Horn Ok Please Highway Radio chala diya hai dost!';
    }

    // 4. Time Machine Radio
    if (target === 'timemachine' || text.includes('time machine') || text.includes('retro') || text.includes('purane')) {
      return 'Time Machine Radio khol diya hai! Golden classic yaadon ka safar shuru.';
    }

    // 5. Live Indian Radio
    if (target === 'radio' || text.includes('live radio') || text.includes('all radio')) {
      return 'Indian Live Radio stations open kar diya hai dost!';
    }

    // 6. Home Navigation
    if (target === 'home' || text.includes('home') || text.includes('mukhya')) {
      return 'Chaliye, Home page par chalte hai!';
    }

    // 7. Library Navigation & Actions
    if (cleanAction === 'unlike' || cleanAction === 'unlike_current' || text.includes('unlike') || text.includes('hatao') || text.includes('hata diya')) {
      return details.target
        ? `Aapke Liked Songs se "${details.target}" hata diya hai dost!`
        : 'Aapke Liked Songs se yeh gaana hata diya hai dost!';
    }

    if (cleanAction === 'like' || cleanAction === 'like_current' || text.includes('like')) {
      return details.target
        ? `Aapke Liked Songs mein "${details.target}" add kar diya hai dost!`
        : 'Aapke Liked Songs mein add kar diya hai dost!';
    }

    if (target === 'library' || text.includes('library') || text.includes('liked') || text.includes('favorites')) {
      return 'Aapki Music Library open kar di hai dost!';
    }

    // Avatar Interactive Gestures
    if (cleanAction === 'wave' || text.includes('wave') || text.includes('hath hilao')) {
      return 'Hello dost! Kaise ho aap? Main Loopra hu!';
    }
    if (cleanAction === 'wink' || text.includes('wink') || text.includes('aankh maro')) {
      return 'Wink! Aaj ka music vibe ekdum best hai!';
    }
    if (cleanAction === 'dance' || text.includes('dance') || text.includes('nacho')) {
      return 'Groove on! Chaliye beats ke saath vibe karte hai!';
    }
    if (cleanAction === 'jump' || text.includes('jump') || text.includes('koodo')) {
      return 'Full energy! Let us go!';
    }
    if (cleanAction === 'pose' || text.includes('pose')) {
      return 'Check out my style! Ready for the beats!';
    }

    // Search Command Reply (Strictly explains searching, NEVER says playing)
    if (cleanAction === 'search' || text.includes('search') || text.includes('dhoondh')) {
      const q = details.query || '';
      return q ? `Aapke liye "${q}" search kar rahi hu dost, dekhiye!` : 'Songs search kar rahi hoon dost!';
    }

    // 8. Discover / Search Navigation
    if (target === 'discover' || text.includes('discover') || text.includes('explore')) {
      return 'Discover section open kar diya hai!';
    }

    // 9. Trending Section Scroll
    if (target === 'trending_section' || text.includes('trending') || text.includes('viral')) {
      return 'Trending songs samne le aayi hu dost, enjoy kijiye!';
    }

    // Playback Commands
    if (cleanAction === 'pause' || text.includes('pause') || text.includes('roko')) {
      return 'Music pause kar diya hai.';
    }

    if (cleanAction === 'resume' || text.includes('resume') || text.includes('play karo') || text.includes('chalao')) {
      return 'Music wapas resume kar diya hai dost!';
    }

    if (cleanAction === 'next' || text.includes('next') || text.includes('agla')) {
      return 'Next song chala diya hai dost!';
    }

    if (cleanAction === 'previous' || text.includes('previous') || text.includes('pichla')) {
      return 'Pichle gaane par le aayi hu.';
    }

    if (cleanAction === 'volume_down' || text.includes('kam')) {
      return 'Volume dheere kar di hai dost.';
    }

    if (cleanAction === 'volume_up' || text.includes('tej') || text.includes('badhao')) {
      return 'Volume tej kar di hai dost.';
    }

    if (cleanAction === 'set_volume') {
      return `Volume set kar di hai ${details.value || 50}% par.`;
    }

    // Folders & Applications Navigation
    if (cleanAction === 'open_folder' || text.includes('folder') || text.includes('download')) {
      const folderName = details.folder || details.target || 'Downloads';
      return `${folderName} folder open kar diya hai.`;
    }

    if (cleanAction === 'open_application' || cleanAction === 'open_app' || text.includes('application')) {
      const appName = details.app || details.target || 'Application';
      return `${appName} open kar diya hai.`;
    }

    if (cleanAction === 'play_search' || cleanAction === 'play' || cleanAction === 'play_artist' || cleanAction === 'play_song') {
      const name = details.artist || details.query || details.title || '';
      return name ? `"${name}" play kar diya hai. Enjoy!` : 'Gaana play kar diya hai. Enjoy!';
    }

    if (typeof details === 'string' && details.length > 5) {
      if (/executed\s*(clarif|action|none|unknown)/i.test(details)) {
        return 'Music play kar diya hai.';
      }
      return details;
    }

    if (details.title) {
      return `"${details.title}" play kar diya hai. Enjoy!`;
    }

    return 'Action poora kar diya hai dost!';
  }

  detectEmotion(text = '', contextAction = '') {
    const lower = (text + ' ' + contextAction).toLowerCase();
    if (lower.includes('cheer') || lower.includes('party') || lower.includes('dance') || lower.includes('celebrat')) {
      return 'cheerful';
    }
    if (lower.includes('sad') || lower.includes('dard') || lower.includes('slow') || lower.includes('soothing')) {
      return 'empathetic';
    }
    if (lower.includes('error') || lower.includes('fail') || lower.includes('problem')) {
      return 'apologetic';
    }
    return 'friendly';
  }

  startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.speechSynthesis && this.isSpeaking) {
        // Android Chromium keep-alive heartbeat to defeat 15-second cutoff
        this.speechSynthesis.pause();
        this.speechSynthesis.resume();
      } else {
        this.clearHeartbeat();
      }
    }, 10000);
  }

  clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Phonetic Hinglish normalizer for natural rhythm, breathing pauses, and accurate Indian pronunciation.
   */
  preprocessTextForSpeech(text = '') {
    if (!text || typeof text !== 'string') return '';
    let processed = text.trim();

    // Strip markdown formatting symbols
    processed = processed.replace(/[*_#`~>]/g, '');

    // Expand common radio/music abbreviations for natural Hindi speech
    processed = processed.replace(/\bFM\b/gi, 'एफ.एम.');
    processed = processed.replace(/\b90s\b/gi, "90's");
    processed = processed.replace(/\b2000s\b/gi, "2000's");
    processed = processed.replace(/\bAI\b/g, 'ए.आई.');
    processed = processed.replace(/\bTTS\b/gi, 'टी.टी.एस.');

    // Ensure natural comma pauses after common greeting/acknowledgement phrases
    processed = processed.replace(/\b(haan bilkul|haan dost|theek hai|chaliye|shukriya|namaste|hello)\b/gi, '$1,');

    // Clean up multiple spaces/commas
    processed = processed.replace(/,{2,}/g, ',').replace(/\s{2,}/g, ' ');

    return processed;
  }

  /**
   * Speaks out the reply using a reliable sequential Speech Queue.
   * Prevents multiple calls from cutting each other off and handles Android speech limits.
   */
  speak(text, contextAction = '', options = {}) {
    if (!text || typeof text !== 'string') return;
    let cleanText = text.trim();
    if (!cleanText) return;

    // Strict override: Intercept any legacy "Haan bilkul, Loopra ready hai" phrases and replace with fresh welcome dialogue
    if (
      /^(haan\s*bilkul[!,.\s]*)?loopra\s*(ready|taiyaar)\s*(hai|h)/i.test(cleanText) ||
      /loopra\s*(ready|taiyaar)\s*(hai|h)[,.\s]*batao\s*kya\s*play/i.test(cleanText)
    ) {
      cleanText = this.generateWelcomeGreeting();
    }

    // Strict speech deduplication: ignore identical utterances within 3000ms
    const now = Date.now();
    if (this.lastSpokenText === cleanText && (now - this.lastSpokenTime) < 3000) {
      console.log('[VoiceBuddy] Suppressed duplicate speech utterance within 3000ms:', cleanText);
      if (typeof options?.onEnd === 'function') {
        try { options.onEnd(); } catch (_) {}
      }
      return;
    }
    this.lastSpokenText = cleanText;
    this.lastSpokenTime = now;

    // 1. If voice output is manually disabled (OFF) -> Text-only, NO TTS audio
    if (!this.isVoiceOutputEnabled) {
      this.stopSpeech();
      this.notifySubscribers('speech_text_only', { text: cleanText, reason: 'voice_output_disabled' });
      if (typeof options?.onEnd === 'function') {
        try { options.onEnd(); } catch (_) {}
      }
      return;
    }

    if (typeof window === 'undefined') {
      if (typeof options?.onEnd === 'function') {
        try { options.onEnd(); } catch (_) {}
      }
      return;
    }

    this.unlockAudio();

    // 2. Interrupt any ongoing speech to prevent duplicate or overlapping speech
    if (this.isSpeaking || this.currentAudio) {
      this.stopSpeech();
    }
    this.speechQueue = []; // Clear queue: only speak latest command response!

    // Mark speaking state immediately and notify listeners so microphone pauses before audio buffers
    this.isSpeaking = true;
    this.notifySubscribers('speech_pending', { text: cleanText });

    this.speechQueue.push({ text: cleanText, contextAction, options });
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  processQueue() {
    if (this.speechQueue.length === 0) {
      this.isProcessingQueue = false;
      this.isSpeaking = false;
      this.clearHeartbeat();
      this.notifySubscribers('speech_end');
      return;
    }

    this.isProcessingQueue = true;
    this.isSpeaking = true;
    const current = this.speechQueue.shift();

    // Split long sentences (> 180 chars) to prevent Android Chrome 15-second speech truncation
    if (current.text.length > 180) {
      const sentences = (current.text.match(/[^.!?\n]+[.!?\n]*/g) || [current.text])
        .map(s => s.trim())
        .filter(Boolean);
      if (sentences.length > 1) {
        const first = sentences[0];
        const rest = sentences.slice(1).map(s => ({
          text: s,
          contextAction: current.contextAction,
          options: current.options
        }));
        this.speechQueue.unshift(...rest);
        current.text = first;
      }
    }

    this.executeSpeech(current.text, current.contextAction, current.options);
  }

  /**
   * Initializes real-time audio volume analyser for 3D avatar lip-sync mouth movements.
   */
  initAudioMeter(audio) {
    if (typeof window === 'undefined') return;
    try {
      this.stopAudioMeter();
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      if (!this.audioAnalyser) {
        this.audioAnalyser = this.audioContext.createAnalyser();
        this.audioAnalyser.fftSize = 128;
      }

      try {
        if (!audio._sourceNode) {
          audio._sourceNode = this.audioContext.createMediaElementSource(audio);
          audio._sourceNode.connect(this.audioAnalyser);
          this.audioAnalyser.connect(this.audioContext.destination);
        }
      } catch (_) {}

      const bufferLength = this.audioAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!this.isSpeaking || !this.currentAudio) {
          this.notifySubscribers('speech_volume', { volume: 0 });
          if (typeof window !== 'undefined') window.__loopraVoiceAudioLevel = 0;
          return;
        }

        this.audioAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        let avg = sum / (bufferLength || 1);
        let vol = Math.min(1.0, avg / 70);

        // Conversational speech amplitude modulation if cross-origin returns 0
        if (vol < 0.05 && this.currentAudio && !this.currentAudio.paused) {
          vol = 0.35 + Math.sin(Date.now() / 90) * 0.3;
        }

        if (typeof window !== 'undefined') {
          window.__loopraVoiceAudioLevel = vol;
        }
        this.notifySubscribers('speech_volume', { volume: vol });
        this.audioMeterAnimationId = requestAnimationFrame(updateMeter);
      };

      this.audioMeterAnimationId = requestAnimationFrame(updateMeter);
    } catch (e) {
      console.warn('[VoiceBuddy] Audio meter setup notice:', e);
    }
  }

  stopAudioMeter() {
    if (this.audioMeterAnimationId) {
      cancelAnimationFrame(this.audioMeterAnimationId);
      this.audioMeterAnimationId = null;
    }
    if (typeof window !== 'undefined') {
      window.__loopraVoiceAudioLevel = 0;
    }
    this.notifySubscribers('speech_volume', { volume: 0 });
  }

  /**
   * Real-time synthetic volume analyser for instant Web SpeechSynthesis lip-sync.
   */
  startSyntheticAudioMeter() {
    this.stopSyntheticAudioMeter();
    const update = () => {
      if (!this.isSpeaking) {
        this.notifySubscribers('speech_volume', { volume: 0 });
        if (typeof window !== 'undefined') window.__loopraVoiceAudioLevel = 0;
        return;
      }
      const vol = 0.35 + Math.sin(Date.now() / 90) * 0.25;
      if (typeof window !== 'undefined') window.__loopraVoiceAudioLevel = vol;
      this.notifySubscribers('speech_volume', { volume: vol });
      this.syntheticMeterId = requestAnimationFrame(update);
    };
    this.syntheticMeterId = requestAnimationFrame(update);
  }

  stopSyntheticAudioMeter() {
    if (this.syntheticMeterId) {
      cancelAnimationFrame(this.syntheticMeterId);
      this.syntheticMeterId = null;
    }
    if (typeof window !== 'undefined') window.__loopraVoiceAudioLevel = 0;
    this.notifySubscribers('speech_volume', { volume: 0 });
  }

  /**
   * Discovers natural Indian female voices from browser SpeechSynthesis.
   * Strictly filters for voice.lang === 'hi-IN' or voices containing Hindi / Google हिन्दी / Lekha.
   * Excludes British / male voices so users never hear an unnatural British accent.
   */
  getIndianVoice() {
    if (!this.speechSynthesis) return null;
    const voices = this.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;

    const isExplicitIndianFemaleVoice = (v) => {
      const lang = (v.lang || '').replace('_', '-').toLowerCase();
      const name = (v.name || '').toLowerCase();
      const rawName = v.name || '';

      // Strictly exclude male voices
      if (
        name.includes('ravi') ||
        name.includes('madhur') ||
        name.includes('prabhat') ||
        name.includes('david') ||
        name.includes('mark') ||
        name.includes('male') ||
        name.includes('george')
      ) {
        return false;
      }

      // Strictly exclude British / UK accents
      if (
        lang === 'en-gb' ||
        lang === 'en-uk' ||
        name.includes('british') ||
        name.includes('united kingdom') ||
        name.includes('great britain') ||
        name.includes('serena') ||
        name.includes('daniel') ||
        name.includes('oliver') ||
        name.includes('hazel') ||
        name.includes('susan')
      ) {
        return false;
      }

      // Explicit filter for hi-IN, Google हिन्दी, Lekha, Hindi, Swara, Neerja, Kalpana, Heera
      return (
        lang === 'hi-in' ||
        rawName.includes('Google हिन्दी') ||
        rawName.includes('हिन्दी') ||
        rawName.includes('Lekha') ||
        name.includes('lekha') ||
        name.includes('hindi') ||
        name.includes('swara') ||
        name.includes('neerja') ||
        name.includes('kalpana') ||
        name.includes('heera') ||
        (lang === 'en-in' && (name.includes('india') || name.includes('neerja') || name.includes('heera') || name.includes('veena')))
      );
    };

    // 1. Direct Indian female match
    let voice = voices.find(isExplicitIndianFemaleVoice);
    if (voice) return voice;

    // 2. Strict secondary match: any pure Hindi language voice
    voice = voices.find((v) => {
      const lang = (v.lang || '').replace('_', '-').toLowerCase();
      const name = (v.name || '').toLowerCase();
      if (name.includes('male') || name.includes('ravi') || name.includes('david') || name.includes('british')) return false;
      return lang === 'hi-in' || lang.startsWith('hi') || name.includes('hindi') || (v.name && v.name.includes('हिन्दी'));
    });
    if (voice) return voice;

    // If no native Indian voice is installed in browser, return null so executeSpeech
    // cleanly routes to high-quality Indian Neural TTS stream (/api/voice-agent/tts)
    return null;
  }

  /**
   * Zero-Latency Instant TTS Speech Synthesis (<20ms start time).
   */
  speakWithSpeechSynthesis(text, onComplete, voice = null) {
    if (!this.speechSynthesis) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    try {
      this.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(this.preprocessTextForSpeech(text) || text);
      const selectedVoice = voice || this.getIndianVoice();
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang || 'hi-IN';
      } else {
        utterance.lang = 'hi-IN';
      }
      utterance.rate = 1.35;
      utterance.pitch = 1.05;

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.startHeartbeat();
        this.notifySubscribers('speech_start', { text });
        this.startSyntheticAudioMeter();
      };

      utterance.onend = () => {
        this.stopSyntheticAudioMeter();
        if (typeof onComplete === 'function') onComplete();
      };

      utterance.onerror = () => {
        this.stopSyntheticAudioMeter();
        if (typeof onComplete === 'function') onComplete();
      };

      this._currentUtterance = utterance;
      this.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[VoiceBuddy] Speech synthesis error:', e);
      this.stopSyntheticAudioMeter();
      if (typeof onComplete === 'function') onComplete();
    }
  }

  executeSpeech(text, contextAction = '', options = {}) {
    clearTimeout(this.watchdogTimer);

    let hasFinished = false;
    const completeItem = () => {
      if (hasFinished) return;
      hasFinished = true;
      clearTimeout(this.watchdogTimer);
      this.stopAudioMeter();
      this.stopSyntheticAudioMeter();
      if (this.currentAudio) {
        try {
          this.currentAudio.pause();
          this.currentAudio.onplay = null;
          this.currentAudio.onended = null;
          this.currentAudio.onerror = null;
          this.currentAudio.src = '';
        } catch (_) {}
        this.currentAudio = null;
      }

      // If more sentences remain in queue for this utterance, continue without premature speech_end
      if (this.speechQueue.length > 0) {
        this.processQueue();
        return;
      }

      this.isSpeaking = false;
      this.notifySubscribers('speech_end', { text, action: contextAction });
      this.notifySubscribers('speech_volume', { volume: 0 });
      if (typeof options?.onEnd === 'function') {
        try { options.onEnd(); } catch (_) {}
      }
      this.processQueue();
    };

    // Watchdog timer: estimated duration (char count * 90ms) + 6000ms safety buffer
    const estimatedMs = Math.max(5000, Math.round(text.length * 90) + 6000);
    this.watchdogTimer = setTimeout(completeItem, estimatedMs);

    const cleanPhonetics = this.preprocessTextForSpeech(text);
    const textToSpeak = cleanPhonetics || text;

    // 1. Primary: Zero-Latency Browser SpeechSynthesis with STRICT Indian Accent
    const indianVoice = this.getIndianVoice();
    if (this.speechSynthesis && indianVoice) {
      this.speakWithSpeechSynthesis(textToSpeak, completeItem, indianVoice);
      return;
    }

    // 2. Secondary Fallback: High-Quality Indian Neural TTS via backend stream
    const encoded = encodeURIComponent(textToSpeak);
    const audioUrl = getApiUrl(`/api/voice-agent/tts?text=${encoded}&gender=female`);

    try {
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      audio.crossOrigin = 'anonymous';
      audio.defaultPlaybackRate = 1.5;
      audio.playbackRate = 1.5;

      audio.onplay = () => {
        this.isSpeaking = true;
        this.startHeartbeat();
        this.notifySubscribers('speech_start', { text: textToSpeak, action: contextAction });
        this.initAudioMeter(audio);
      };

      audio.onended = () => {
        completeItem();
      };

      let fallbackTriggered = false;
      const triggerFallback = () => {
        if (fallbackTriggered || hasFinished) return;
        fallbackTriggered = true;
        this.fallbackToIndianSpeechSynthesis(textToSpeak, completeItem);
      };

      audio.onerror = (e) => {
        console.warn('[VoiceBuddy] Neural audio stream error, checking Indian browser voice fallback:', e);
        triggerFallback();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name === 'AbortError') {
            // Cancelled cleanly by stopSpeech()
            return;
          }
          console.warn('[VoiceBuddy] Audio playback error:', err?.message);
          triggerFallback();
        });
      }
    } catch (err) {
      console.warn('[VoiceBuddy] Speech audio instantiation error:', err);
      this.fallbackToIndianSpeechSynthesis(textToSpeak, completeItem);
    }
  }

  /**
   * Safe Fallback: Only allows Indian female voices (hi-IN, en-IN).
   * STRICT: NEVER falls back to male or British voices.
   */
  fallbackToIndianSpeechSynthesis(text, onComplete) {
    if (!this.speechSynthesis) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    try {
      const voices = this.speechSynthesis.getVoices() || [];
      const isIndianFemaleVoice = (v) => {
        const lang = (v.lang || '').replace('_', '-').toLowerCase();
        const name = (v.name || '').toLowerCase();
        // Strictly exclude male voices
        if (name.includes('ravi') || name.includes('madhur') || name.includes('prabhat') || name.includes('david') || name.includes('mark') || name.includes('male') || name.includes('george')) {
          return false;
        }
        return lang === 'hi-in' || lang === 'en-in' || name.includes('india') || name.includes('hindi') || name.includes('हिन्दी') || name.includes('swara') || name.includes('neerja') || name.includes('kalpana') || name.includes('heera') || name.includes('zira');
      };

      const indianVoice = voices.find(isIndianFemaleVoice);
      if (!indianVoice) {
        console.warn('[VoiceBuddy] No native Indian voice installed in browser. Suppressing fallback to prevent bad British voice.');
        if (typeof onComplete === 'function') onComplete();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(this.preprocessTextForSpeech(text) || text);
      utterance.voice = indianVoice;
      utterance.lang = indianVoice.lang || 'hi-IN';
      utterance.rate = 1.5;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.startHeartbeat();
        this.notifySubscribers('speech_start', { text });
      };

      utterance.onend = () => {
        if (typeof onComplete === 'function') onComplete();
      };

      utterance.onerror = () => {
        if (typeof onComplete === 'function') onComplete();
      };

      this.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[VoiceBuddy] Fallback speech error:', e);
      if (typeof onComplete === 'function') onComplete();
    }
  }

  stopSpeech() {
    this.speechQueue = [];
    this.isProcessingQueue = false;
    this.clearHeartbeat();
    clearTimeout(this.watchdogTimer);
    this.stopAudioMeter();
    this.stopSyntheticAudioMeter();

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.onplay = null;
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.src = '';
      } catch (_) {}
      this.currentAudio = null;
    }
    if (this.speechSynthesis) {
      try {
        this.speechSynthesis.cancel();
      } catch (_) {}
    }
    this._currentUtterance = null;
    this.isSpeaking = false;
    this.notifySubscribers('speech_end');
    this.notifySubscribers('speech_volume', { volume: 0 });
  }
}

export const voiceBuddyService = new VoiceBuddyService();

// Standalone function export for absolute call safety
export function setPlaybackActive(isPlaying) {
  try {
    voiceBuddyService.setPlaybackActive(isPlaying);
  } catch (_) {
    voiceBuddyService.isPlaybackActive = !!isPlaying;
  }
}

// Attach to instance and prototype
voiceBuddyService.setPlaybackActive = setPlaybackActive;
VoiceBuddyService.prototype.setPlaybackActive = setPlaybackActive;

if (typeof window !== 'undefined') {
  window.voiceBuddyService = voiceBuddyService;
  window.setPlaybackActive = setPlaybackActive;
}

export default voiceBuddyService;
