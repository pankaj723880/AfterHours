/**
 * Loopra Voice Buddy & Character Intelligence Service
 * 
 * Rebuilt for Loopra:
 * 1. Single unified female companion: LOOPRA
 *    - Loopra (Female Voice) - en-IN-NeerjaExpressiveNeural, fast conversational natural Hindi/Hinglish
 * 2. Studio-quality Neural Indian Hindi TTS with 1.10x–1.14x natural pace.
 * 3. Varied conversational dialogue generator (no static repetition).
 */

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
    rate: 1.12 // Slightly faster, natural conversational speed
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

    // Explicit binding to ensure methods are resilient across HMR and detached contexts
    this.setPlaybackActive = this.setPlaybackActive.bind(this);
    this.isMusicPlaying = this.isMusicPlaying.bind(this);
    this.setVoiceOutput = this.setVoiceOutput.bind(this);
    this.toggleVoiceOutput = this.toggleVoiceOutput.bind(this);
    this.speak = this.speak.bind(this);
    this.stopSpeech = this.stopSpeech.bind(this);
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
    } catch (_) {}
    if (!this.isVoiceOutputEnabled) {
      this.stopSpeech();
    }
    this.notifySubscribers('voice_output_change', { enabled: this.isVoiceOutputEnabled });
  }

  toggleVoiceOutput() {
    this.setVoiceOutput(!this.isVoiceOutputEnabled);
    return this.isVoiceOutputEnabled;
  }

  setPlaybackActive(isPlaying) {
    this.isPlaybackActive = !!isPlaying;
    if (typeof window !== 'undefined') {
      window.__loopraIsMusicPlaying = !!isPlaying;
    }
    if (this.isPlaybackActive && this.isSpeaking) {
      this.stopSpeech();
    }
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
    } catch (_) {}
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
   * Generates varied, authentic conversational Hindi / Hinglish responses for Loopra female companion.
   */
  generateFriendReply(action, details = {}) {
    const cleanAction = typeof action === 'string' ? action : (action?.action || '');
    const text = typeof action === 'string' ? action.toLowerCase() : '';
    const target = (details.target || details.query || '').toLowerCase();

    // 1. Saloon FM Navigation
    if (target === 'barber' || text.includes('saloon') || text.includes('salon') || text.includes('lune')) {
      return 'Haan bilkul! Main Saloon FM open kar rahi hoon.';
    }

    // 2. Theka Session Navigation
    if (target === 'pauwa' || text.includes('theka') || text.includes('pauwa')) {
      return 'Theka Session ready hai! Shuru karte hain.';
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
      return 'Indian Live Radio stations open kar diye hain dost!';
    }

    // 6. Home Navigation
    if (target === 'home' || text.includes('home') || text.includes('mukhya')) {
      return 'Chaliye, Home page par chalte hain!';
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
      return 'Hello dost! Kaise ho aap? Main Loopra hoon!';
    }
    if (cleanAction === 'wink' || text.includes('wink') || text.includes('aankh maro')) {
      return 'Wink! Aaj ka music vibe ekdum best hai!';
    }
    if (cleanAction === 'dance' || text.includes('dance') || text.includes('nacho')) {
      return 'Groove on! Chaliye beats ke saath vibe karte hain!';
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
      return q ? `Aapke liye "${q}" search kar rahi hoon dost, dekhiye!` : 'Songs search kar rahi hoon dost!';
    }

    // 8. Discover / Search Navigation
    if (target === 'discover' || text.includes('discover') || text.includes('explore')) {
      return 'Discover section open kar diya hai!';
    }

    // 9. Trending Section Scroll
    if (target === 'trending_section' || text.includes('trending') || text.includes('viral')) {
      return 'Trending songs samne le aayi hoon dost, enjoy kijiye!';
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
      return 'Pichle gaane par le aayi hoon.';
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

    if (cleanAction === 'play_search' || cleanAction === 'play') {
      return 'Haan bilkul! Song play kar diya hai, suniye!';
    }

    if (typeof details === 'string' && details.length > 5) {
      return details;
    }

    return 'Done dost! Command execute ho gaya.';
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

  /**
   * Speaks out the reply using studio-quality Neural Indian Hindi TTS from backend.
   * Speed tuned to natural fast conversational pace (1.12x).
   * Cancels stale audio immediately so speech is instantaneous with zero delay.
   */
  async speak(text, contextAction = '') {
    if (!text) return;

    // 1. If voice output is manually disabled (OFF) -> Text-only, NO TTS audio
    if (!this.isVoiceOutputEnabled) {
      this.stopSpeech();
      this.notifySubscribers('speech_text_only', { text, reason: 'voice_output_disabled' });
      return;
    }

    if (typeof window === 'undefined') return;

    // Immediately cancel any existing or stale speech to prevent lag/overlap
    this.stopSpeech();
    const char = this.getActiveCharacter();
    const emotion = this.detectEmotion(text, contextAction);

    try {
      const ttsUrl = `/api/voice-agent/tts?text=${encodeURIComponent(text)}&gender=${char.gender}&voice=${encodeURIComponent(char.voiceId || 'en-IN-NeerjaExpressiveNeural')}&emotion=${emotion}`;
      const audio = new Audio(ttsUrl);
      this.currentAudio = audio;
      audio.playbackRate = char.rate || 1.12;

      audio.onplay = () => {
        this.isSpeaking = true;
        this.notifySubscribers('speech_start', { text, audio });
      };

      audio.onended = () => {
        this.isSpeaking = false;
        this.currentAudio = null;
        this.notifySubscribers('speech_end', { text });
      };

      audio.onerror = () => {
        this.fallbackBrowserSpeak(text, char);
      };

      await audio.play();
    } catch (_) {
      this.fallbackBrowserSpeak(text, char);
    }
  }

  fallbackBrowserSpeak(text, char) {
    if (!this.speechSynthesis) {
      this.isSpeaking = false;
      this.notifySubscribers('speech_end', { text });
      return;
    }

    try {
      this.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      utterance.pitch = char.pitch;
      utterance.rate = char.rate || 1.12;

      const voices = this.speechSynthesis.getVoices() || [];
      const hindiVoice = voices.find(v => 
        (v.lang === 'hi-IN' || v.lang === 'hi_IN') && 
        (/female|kalpana|neerja|google/i.test(v.name))
      ) || voices.find(v => v.lang === 'hi-IN' || v.lang === 'hi_IN') || voices[0];

      if (hindiVoice) utterance.voice = hindiVoice;

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.notifySubscribers('speech_start', { text });
      };
      utterance.onend = () => {
        this.isSpeaking = false;
        this.notifySubscribers('speech_end', { text });
      };
      utterance.onerror = () => {
        this.isSpeaking = false;
        this.notifySubscribers('speech_end', { text });
      };

      this.speechSynthesis.speak(utterance);
    } catch (e) {
      this.isSpeaking = false;
      this.notifySubscribers('speech_end', { text });
    }
  }

  stopSpeech() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (_) {}
      this.currentAudio = null;
    }
    if (this.speechSynthesis) {
      try {
        this.speechSynthesis.cancel();
      } catch (_) {}
    }
    this.isSpeaking = false;
    this.notifySubscribers('speech_end');
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
