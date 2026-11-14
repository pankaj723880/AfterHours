// Centralized Pure High-Performance Web Audio API Sound Mixing & Preloading Engine for Loopra Relax Mode
// Uses 100% authentic, verified natural field recordings
// Connected through SpatialStudioDsp with real-time loudness compensation

import { SpatialStudioDsp } from './spatialStudioDsp.js';

class RelaxAudioEngine {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.dsp = null;
    this.masterVolume = 0.8;
    this.isMuted = false;

    // Pure Playback state maps (HTML5 Audio connected to WebAudio Gain & Analyser for visualizer)
    this.activeTracks = new Map(); // id -> { audio, sourceNode, gainNode, analyserNode, type: 'audio', ... }

    // Preloaded Audio Elements for instantaneous playback (<100ms)
    this.audioPool = new Map(); // id -> HTMLAudioElement (pre-created, preload="auto")
    this.loadingIds = new Set(); // tracks currently buffering
    this.listeners = new Set();
    this.preloaded = false;
  }

  // Safely initialize or resume AudioContext synchronously upon user gesture
  getAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        console.warn('[RelaxAudioEngine] Web Audio API not supported');
        return null;
      }
      this.audioContext = new AudioCtx();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.audioContext.currentTime);

      // Instantiate DSP Spatial Processor
      this.dsp = new SpatialStudioDsp(this.audioContext);

      // Clean routing: Ambient Tracks -> MasterGain -> DSP -> Destination
      this.masterGain.connect(this.dsp.inputNode);
      this.dsp.outputNode.connect(this.audioContext.destination);
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch((err) => {
        console.warn('[RelaxAudioEngine] Failed to resume audioContext:', err);
      });
    }

    return this.audioContext;
  }

  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.error('[RelaxAudioEngine] Listener error:', e);
      }
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState() {
    const playingIds = [];
    const volumes = {};
    const details = [];

    this.activeTracks.forEach((val, id) => {
      playingIds.push(id);
      volumes[id] = val.volume;
      details.push({
        id,
        category: val.category,
        title: val.title,
        volume: val.volume,
        type: 'audio'
      });
    });

    return {
      masterVolume: this.masterVolume,
      isMuted: this.isMuted,
      activeCount: playingIds.length,
      playingIds,
      volumes,
      details,
      loadingIds: Array.from(this.loadingIds),
      activeCategories: Array.from(new Set(details.map(d => d.category))),
      dsp: this.dsp ? this.dsp.getState() : {
        isEnabled: false,
        isBypassed: false,
        mode: 'natural',
        activePosition: 'center',
        eqGains: {},
        wetDry: 0.5,
        compensationGain: 1.0
      }
    };
  }

  setMasterVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioContext) {
      const now = this.audioContext.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : this.masterVolume, now + 0.05);
    }
    this.notifyListeners();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.audioContext) {
      const now = this.audioContext.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : this.masterVolume, now + 0.05);
    }
    this.notifyListeners();
  }

  // DSP Control Passthrough Helpers
  setDspMode(modeId) {
    this.getAudioContext();
    if (this.dsp) {
      this.dsp.setMode(modeId);
      this.notifyListeners();
    }
  }

  setDsp3DPosition(posId) {
    this.getAudioContext();
    if (this.dsp) {
      this.dsp.set3DPosition(posId);
      this.notifyListeners();
    }
  }

  setDspParam(paramKey, val) {
    this.getAudioContext();
    if (this.dsp) {
      this.dsp.setParam(paramKey, val);
      this.notifyListeners();
    }
  }

  setDspEqPreset(presetName) {
    this.getAudioContext();
    if (this.dsp) {
      this.dsp.setEqPreset(presetName);
      this.notifyListeners();
    }
  }

  setDspBandGain(freq, gain) {
    this.getAudioContext();
    if (this.dsp) {
      this.dsp.setBandGain(freq, gain);
      this.notifyListeners();
    }
  }

  toggleDspEnabled(forceState) {
    this.getAudioContext();
    if (this.dsp) {
      this.dsp.toggleEnabled(forceState);
      this.notifyListeners();
    }
  }

  toggleDspBypass(forceState) {
    this.getAudioContext();
    if (this.dsp) {
      this.dsp.toggleBypass(forceState);
      this.notifyListeners();
    }
  }

  resetDspToOriginal() {
    this.getAudioContext();
    if (this.dsp) {
      this.dsp.resetToOriginal();
      this.notifyListeners();
    }
  }

  getLoudnessMeasurement() {
    if (this.dsp) {
      return this.dsp.getLoudnessMeasurement();
    }
    return { originalDb: -60, processedDb: -60, diffDb: 0 };
  }

  // Background Preloader: pre-instantiate and warm authentic nature recordings into pool
  preloadSounds(soundsList = []) {
    if (typeof window === 'undefined') return;
    
    // Warm top sounds in idle slices to ensure instantaneous click responsiveness
    const candidates = soundsList.slice(0, 16);
    candidates.forEach((sound) => {
      if (sound.audioUrl && !this.audioPool.has(sound.id)) {
        try {
          const audio = new Audio();
          audio.preload = 'auto';
          audio.crossOrigin = 'anonymous';
          audio.loop = true;
          audio.src = sound.audioUrl;
          this.audioPool.set(sound.id, audio);
        } catch (_) {}
      }
    });
  }

  // Get or create pooled audio instance
  getOrCreateAudio(sound) {
    if (this.audioPool.has(sound.id)) {
      return this.audioPool.get(sound.id);
    }
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audio.loop = true;
    audio.src = sound.audioUrl;
    this.audioPool.set(sound.id, audio);
    return audio;
  }

  // Instant Playback for Authentic Ambient Audio Tracks (<100ms)
  playAmbientTrack(sound) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (this.activeTracks.has(sound.id)) {
      return;
    }

    const audio = this.getOrCreateAudio(sound);

    // If audio element is already connected to WebAudio nodes in a previous session, reuse
    let sourceNode, gainNode, analyserNode;
    const initialVolume = typeof sound.defaultVolume === 'number' ? sound.defaultVolume : 0.75;

    if (audio._sourceNode && audio._gainNode && audio._analyserNode) {
      sourceNode = audio._sourceNode;
      gainNode = audio._gainNode;
      analyserNode = audio._analyserNode;
    } else {
      sourceNode = ctx.createMediaElementSource(audio);
      gainNode = ctx.createGain();
      analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 64;

      // Pure clean routing: source -> gainNode -> analyserNode -> masterGain (which feeds DSP)
      sourceNode.connect(gainNode);
      gainNode.connect(analyserNode);
      analyserNode.connect(this.masterGain);

      audio._sourceNode = sourceNode;
      audio._gainNode = gainNode;
      audio._analyserNode = analyserNode;
    }

    // Set immediate gain with minimal micro-ramp (0.05s) to eliminate pops while starting instantly
    const now = ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(initialVolume, now + 0.05);

    // Audio fallback handler
    audio.onerror = () => {
      if (sound.fallbackUrl && audio.src !== sound.fallbackUrl) {
        console.warn(`[RelaxAudioEngine] Stream failed for ${sound.title}. Retrying with fallback:`, sound.fallbackUrl);
        audio.src = sound.fallbackUrl;
        audio.play().catch(e => console.error('[RelaxAudioEngine] Fallback play error:', e));
      }
    };

    this.activeTracks.set(sound.id, {
      id: sound.id,
      category: sound.category,
      title: sound.title,
      audio,
      sourceNode,
      gainNode,
      analyserNode,
      volume: initialVolume,
      type: 'audio'
    });

    // Check if network fetch is needed; if audio readyState < 2, indicate loading
    if (audio.readyState < 2) {
      this.loadingIds.add(sound.id);
      this.notifyListeners();
      
      const onCanPlay = () => {
        this.loadingIds.delete(sound.id);
        this.notifyListeners();
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('playing', onCanPlay);
      };
      audio.addEventListener('canplay', onCanPlay, { once: true });
      audio.addEventListener('playing', onCanPlay, { once: true });
    } else {
      this.notifyListeners();
    }

    // Call play() synchronously in same user-interaction task tick
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn(`[RelaxAudioEngine] Play failed for ${sound.title}:`, err.message);
        if (sound.fallbackUrl && audio.src !== sound.fallbackUrl) {
          audio.src = sound.fallbackUrl;
          audio.play().catch(e => console.error('[RelaxAudioEngine] Fallback play error:', e));
        }
      });
    }
  }

  // Adjust volume for an individual sound layer in real time
  setSoundVolume(id, volume) {
    const vol = Math.max(0, Math.min(1, volume));

    if (this.activeTracks.has(id)) {
      const item = this.activeTracks.get(id);
      item.volume = vol;
      if (this.audioContext && item.gainNode) {
        const now = this.audioContext.currentTime;
        item.gainNode.gain.cancelScheduledValues(now);
        item.gainNode.gain.linearRampToValueAtTime(vol, now + 0.03);
      }
      this.notifyListeners();
    }
  }

  stopSound(id) {
    this.loadingIds.delete(id);

    if (this.activeTracks.has(id)) {
      const item = this.activeTracks.get(id);
      if (this.audioContext && item.gainNode) {
        const now = this.audioContext.currentTime;
        item.gainNode.gain.cancelScheduledValues(now);
        item.gainNode.gain.linearRampToValueAtTime(0.001, now + 0.1);
        setTimeout(() => {
          try {
            item.audio.pause();
            item.audio.currentTime = 0;
          } catch (_) { }
        }, 120);
      } else {
        try { item.audio.pause(); } catch (_) { }
      }
      this.activeTracks.delete(id);
      this.notifyListeners();
    }
  }

  toggleSound(sound) {
    if (this.isSoundPlaying(sound.id)) {
      this.stopSound(sound.id);
    } else {
      this.playAmbientTrack(sound);
    }
  }

  isSoundPlaying(id) {
    return this.activeTracks.has(id);
  }

  isSoundLoading(id) {
    return this.loadingIds.has(id);
  }

  stopAll() {
    this.loadingIds.clear();
    const trackIds = Array.from(this.activeTracks.keys());
    trackIds.forEach(id => this.stopSound(id));
    this.notifyListeners();
  }

  // Get combined frequency spectrum amplitude for visual reactions
  getAverageFrequencies() {
    if (!this.audioContext) {
      return {
        overall: 0, forest: 0, birds: 0, water: 0,
        rain: 0, wind: 0, fire: 0, nature: 0
      };
    }
    const tempArr = new Uint8Array(32);
    const sums = {
      overall: 0, forest: 0, birds: 0, water: 0,
      rain: 0, wind: 0, fire: 0, nature: 0
    };
    let count = 0;

    const readAnalyser = (analyser, cat) => {
      try {
        analyser.getByteFrequencyData(tempArr);
        let s = 0;
        for (let i = 0; i < 16; i++) s += tempArr[i];
        const val = s / (16 * 255);
        if (cat && sums[cat] !== undefined) {
          sums[cat] = Math.max(sums[cat], val);
        }
        sums.overall += val;
        count++;
      } catch (_) {}
    };

    this.activeTracks.forEach(t => {
      if (t.analyserNode) readAnalyser(t.analyserNode, t.category);
    });

    if (count > 0) sums.overall = sums.overall / count;
    return sums;
  }
}

export const relaxAudioEngine = new RelaxAudioEngine();
