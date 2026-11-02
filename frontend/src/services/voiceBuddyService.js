/**
 * Loopra Voice Buddy & Character Intelligence Service
 * 
 * Rebuilt for Loopra:
 * 1. Both characters carry the unified name: LOOPRA
 *    - Loopra (Male Voice) - MadhurNeural, fast conversational Hindi
 *    - Loopra (Female Voice) - SwaraNeural, fast conversational Hindi
 * 2. Studio-quality Neural Indian Hindi TTS with 1.10x–1.14x natural pace.
 * 3. Varied conversational dialogue generator (no static repetition).
 */

export const CHARACTERS = {
  male: {
    id: 'male',
    key: 'male',
    name: 'Loopra',
    gender: 'male',
    label: 'Loopra (Male Voice)',
    subtitle: 'Friendly • Confident • Fast Hindi',
    description: 'Animated 2D physical Loopra companion in streetwear hoodie',
    avatarEmoji: '👦',
    avatarImg: '/characters/male_bust.png',
    color: '#f59e0b', // Loopra Amber
    glowColor: 'rgba(245, 158, 11, 0.7)',
    voiceId: 'hi-IN-MadhurNeural',
    pitch: 0.85,
    rate: 1.12 // Slightly faster, natural conversational speed
  },
  female: {
    id: 'female',
    key: 'female',
    name: 'Loopra',
    gender: 'female',
    label: 'Loopra (Female Voice)',
    subtitle: 'Warm • Cheerful • Fast Hindi',
    description: 'Animated 2D physical Loopra companion in casual hoodie',
    avatarEmoji: '👧',
    avatarImg: '/characters/female_bust.png',
    color: '#10b981', // Loopra Emerald / Cyan
    glowColor: 'rgba(16, 185, 129, 0.7)',
    voiceId: 'hi-IN-SwaraNeural',
    pitch: 1.25,
    rate: 1.12 // Slightly faster, natural conversational speed
  }
};

class VoiceBuddyService {
  constructor() {
    this.activeCharacterKey = this.getSavedCharacter();
    this.isVoiceOutputEnabled = this.getSavedVoiceOutput();
    this.isPlaybackActive = false;
    this.speechSynthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.isSpeaking = false;
    this.subscribers = new Set();
    this.currentAudio = null;
  }

  getSavedCharacter() {
    if (typeof localStorage === 'undefined') return 'male';
    const saved = localStorage.getItem('loopra_voice_character');
    return (saved === 'female' || saved === 'luna') ? 'female' : 'male';
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

  setCharacter(characterKey) {
    const key = (characterKey === 'female' || characterKey === 'luna') ? 'female' : 'male';
    this.activeCharacterKey = key;
    try {
      localStorage.setItem('loopra_voice_character', key);
    } catch (_) {}
    this.notifySubscribers('character_change');
  }

  getActiveCharacter() {
    return CHARACTERS[this.activeCharacterKey] || CHARACTERS.male;
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
   * Generates varied, authentic conversational Hindi / Hinglish responses.
   */
  generateFriendReply(action, details = {}) {
    const isMale = this.activeCharacterKey === 'male';
    const cleanAction = typeof action === 'string' ? action : (action?.action || '');
    const text = typeof action === 'string' ? action.toLowerCase() : '';
    const target = (details.target || details.query || '').toLowerCase();

    // 1. Saloon FM Navigation
    if (target === 'barber' || text.includes('saloon') || text.includes('salon') || text.includes('lune')) {
      return isMale
        ? 'Bilkul! Chalo, Saloon FM kholte hain.'
        : 'Haan bilkul! Main Saloon FM open kar rahi hoon.';
    }

    // 2. Horn Ok Please
    if (target === 'truck' || text.includes('horn') || text.includes('dhaba')) {
      return isMale
        ? 'Bilkul! Horn Ok Please station chalu kar raha hoon.'
        : 'Zaroor! Horn Ok Please station open ho gaya dost.';
    }

    // 3. Theka Session
    if (target === 'pauwa' || text.includes('theka')) {
      return isMale
        ? 'Haan bhai! Desi Theka session start kar diya.'
        : 'Zaroor! Desi Theka session open kar rahi hoon.';
    }

    // 4. Time Machine Radio
    if (target === 'timemachine' || text.includes('time machine') || text.includes('retro')) {
      return isMale
        ? 'Bilkul! Time Machine Radio khol diya, retro era enjoy karo.'
        : 'Haan bilkul! Time Machine Radio open kar diya maine.';
    }

    // 5. Indian Live Radio
    if (target === 'radio' || text.includes('radio') || text.includes('fm')) {
      return isMale
        ? 'Bilkul! Indian Live Radio stations chalu kar raha hoon.'
        : 'Haan zaroor! Live Radio stations open kar diye hain.';
    }

    // 6. Home
    if (target === 'home' || text.includes('home') || text.includes('ghar')) {
      return isMale
        ? 'Bilkul! Chalo Home page par chalte hain.'
        : 'Haan bilkul! Home page open kar diya hai.';
    }

    // 7. Library / Liked Songs
    if (target === 'library' || text.includes('library') || text.includes('liked') || text.includes('mere gaane')) {
      return isMale
        ? 'Haan bhai! Tumhare saare pasandida gaane khol diye.'
        : 'Haan bilkul! Tumhari music library open kar di hai.';
    }

    // 8. Playlists
    if (target === 'playlists' || text.includes('playlist')) {
      return isMale
        ? 'Bilkul! Playlists khol raha hoon, koi mast playlist chuno.'
        : 'Haan bilkul! Tumhari playlists open kar di hain maine.';
    }

    // 9. Trending Songs
    if (target === 'trending_section' || text.includes('trending')) {
      return isMale
        ? 'Ye dekho bhai! Trending songs screen par dikha diye.'
        : 'Ye lo dost! Top trending hits open kar diye hain.';
    }

    // 10. Discover & Search
    if (target === 'discover' || text.includes('discover')) {
      return isMale
        ? 'Bilkul! Discover aur search section khol diya hai.'
        : 'Haan bilkul! Discover page open kar diya hai.';
    }

    // 11. Search Songs
    if (cleanAction === 'search' || text.includes('search') || text.includes('dhoondh')) {
      const q = details.query || 'gaane';
      return isMale
        ? `${q} ke gaane mil gaye. Sunna shuru karein?`
        : `Ye lo! ${q} ke gaane mil gaye.`;
    }

    // 12. Play First Song
    if (cleanAction === 'play_index' || text.includes('pehla')) {
      return isMale
        ? 'Pehla gaana chala diya bhai!'
        : 'Pehla song play kar diya hai maine dost!';
    }

    // 13. Playback Controls
    if (cleanAction === 'pause' || text.includes('pause') || text.includes('rok')) {
      return isMale
        ? 'Theek hai bhai, gaana pause kar diya.'
        : 'Music pause kar diya hai maine.';
    }

    if (cleanAction === 'resume' || text.includes('resume')) {
      return isMale
        ? 'Bilkul! Gaana wapas play kar diya.'
        : 'Haan bilkul! Music resume ho gaya hai.';
    }

    if (cleanAction === 'next' || text.includes('next')) {
      return isMale
        ? 'Agla gaana chala diya bhai!'
        : 'Next song chala diya hai dost!';
    }

    if (cleanAction === 'previous' || text.includes('previous') || text.includes('pichla')) {
      return isMale
        ? 'Pichla gaana chala diya bhai!'
        : 'Pichle gaane par le aayi hoon.';
    }

    if (cleanAction === 'volume_down' || text.includes('kam')) {
      return isMale
        ? 'Volume kam kar di hai.'
        : 'Volume dheere kar di hai dost.';
    }

    if (cleanAction === 'volume_up' || text.includes('tej') || text.includes('badhao')) {
      return isMale
        ? 'Volume badha di hai.'
        : 'Volume tej kar di hai dost.';
    }

    if (cleanAction === 'set_volume') {
      return isMale
        ? `Volume ${details.value || 50}% kar di hai.`
        : `Volume set kar di hai ${details.value || 50}% par.`;
    }

    if (cleanAction === 'play_search' || cleanAction === 'play') {
      return isMale
        ? 'Bilkul! Gaana baja diya hai, volume badha ke enjoy karo.'
        : 'Haan bilkul! Song play kar diya hai, suniye!';
    }

    if (typeof details === 'string' && details.length > 5) {
      return details;
    }

    return isMale
      ? 'Bilkul! Command complete ho gaya bhai.'
      : 'Done dost! Command execute ho gaya.';
  }

  /**
   * Speaks out the reply using studio-quality Neural Indian Hindi TTS from backend.
   * Speed tuned to natural fast conversational pace (1.12x).
   * Automatically suppressed during active music playback or when voice output is disabled.
   */
  async speak(text) {
    if (!text) return;

    // 1. If voice output is manually disabled (OFF) -> Text-only, NO TTS audio
    if (!this.isVoiceOutputEnabled) {
      this.stopSpeech();
      this.notifySubscribers('speech_text_only', { text, reason: 'voice_output_disabled' });
      return;
    }

    // 2. If music is actively playing -> Do NOT interrupt song with TTS, Text-only
    if (this.isMusicPlaying()) {
      this.stopSpeech();
      this.notifySubscribers('speech_text_only', { text, reason: 'playback_active' });
      return;
    }

    if (typeof window === 'undefined') return;

    this.stopSpeech();
    const char = this.getActiveCharacter();

    try {
      const ttsUrl = `/api/voice-agent/tts?text=${encodeURIComponent(text)}&gender=${char.gender}&voice=${encodeURIComponent(char.voiceId || '')}`;
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
        (char.gender === 'female' ? /female|swara|kalpana|google/i.test(v.name) : /male|madhur|hemant/i.test(v.name))
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
export default voiceBuddyService;
