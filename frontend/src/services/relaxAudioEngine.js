// Centralized Web Audio API Sound Mixing & Binaural Beats Engine for Loopra Relax Mode

class RelaxAudioEngine {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.masterVolume = 0.8;
    this.isMuted = false;
    this.activeTracks = new Map(); // id -> { audio, sourceNode, gainNode, analyserNode, type, ... }
    this.binauralOscillators = new Map(); // id -> { oscL, oscR, mergerNode, gainNode, ... }
    this.listeners = new Set();
    this.hasUserInteracted = false;
  }

  // Safely initialize or resume AudioContext after user gesture
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
      this.masterGain.connect(this.audioContext.destination);
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
        type: val.type
      });
    });

    this.binauralOscillators.forEach((val, id) => {
      playingIds.push(id);
      volumes[id] = val.volume;
      details.push({
        id,
        category: 'binaural',
        title: val.title,
        volume: val.volume,
        type: 'binaural',
        carrier: val.carrier,
        beat: val.beat
      });
    });

    return {
      masterVolume: this.masterVolume,
      isMuted: this.isMuted,
      activeCount: playingIds.length,
      playingIds,
      volumes,
      details,
      activeCategories: Array.from(new Set(details.map(d => d.category)))
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

  // Play ambient audio track (Forest, Birds, Water) with automatic fallback resilience
  async playAmbientTrack(sound) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (this.activeTracks.has(sound.id)) {
      // Already playing; do not duplicate
      return;
    }

    try {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.loop = true;
      audio.preload = 'auto';

      // Automatic fallback if primary remote audio fails (e.g. offline, CORS, or dead CDN)
      audio.onerror = () => {
        if (sound.fallbackUrl && audio.src !== sound.fallbackUrl) {
          console.warn(`[RelaxAudioEngine] Primary stream failed for ${sound.title}. Retrying with local fallback:`, sound.fallbackUrl);
          audio.src = sound.fallbackUrl;
          audio.play().catch(e => console.error('[RelaxAudioEngine] Fallback play error:', e));
        }
      };

      audio.src = sound.audioUrl;

      const sourceNode = ctx.createMediaElementSource(audio);
      const gainNode = ctx.createGain();
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 64;

      const initialVolume = typeof sound.defaultVolume === 'number' ? sound.defaultVolume : 0.75;
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(initialVolume, ctx.currentTime + 0.6); // smooth fade-in

      sourceNode.connect(gainNode);
      gainNode.connect(analyserNode);
      analyserNode.connect(this.masterGain);

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

      try {
        await audio.play();
      } catch (playErr) {
        if (sound.fallbackUrl) {
          console.warn(`[RelaxAudioEngine] Initial play rejected for ${sound.title}. Attempting fallback:`, sound.fallbackUrl);
          audio.src = sound.fallbackUrl;
          await audio.play();
        } else {
          throw playErr;
        }
      }

      this.notifyListeners();
    } catch (err) {
      console.error('[RelaxAudioEngine] Failed to play track:', sound.id, err);
      this.stopSound(sound.id);
    }
  }

  // Play True Stereo Binaural Beat via Web Audio API ChannelMergerNode
  playBinauralBeat(sound) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (this.binauralOscillators.has(sound.id)) {
      return;
    }

    const carrier = sound.carrier || 200;
    const beat = sound.beat || 10;
    const initialVolume = typeof sound.defaultVolume === 'number' ? sound.defaultVolume : 0.6;

    // True stereo channel splitting: Left = carrier, Right = carrier + beat
    const fLeft = carrier;
    const fRight = carrier + beat;

    const oscL = ctx.createOscillator();
    const oscR = ctx.createOscillator();
    oscL.type = 'sine';
    oscR.type = 'sine';
    oscL.frequency.setValueAtTime(fLeft, ctx.currentTime);
    oscR.frequency.setValueAtTime(fRight, ctx.currentTime);

    // Warm subharmonic to provide organic body
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(carrier * 0.5, ctx.currentTime);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.12, ctx.currentTime);
    subOsc.connect(subGain);

    const mergerNode = ctx.createChannelMerger(2);
    oscL.connect(mergerNode, 0, 0); // left channel
    oscR.connect(mergerNode, 0, 1); // right channel
    subGain.connect(mergerNode, 0, 0);
    subGain.connect(mergerNode, 0, 1);

    const gainNode = ctx.createGain();
    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 64;

    gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(initialVolume, ctx.currentTime + 1.2); // gentle binaural fade-in

    mergerNode.connect(gainNode);
    gainNode.connect(analyserNode);
    analyserNode.connect(this.masterGain);

    oscL.start();
    oscR.start();
    subOsc.start();

    this.binauralOscillators.set(sound.id, {
      id: sound.id,
      category: 'binaural',
      title: sound.title,
      carrier,
      beat,
      oscL,
      oscR,
      subOsc,
      gainNode,
      analyserNode,
      volume: initialVolume,
      type: 'binaural'
    });

    this.notifyListeners();
  }

  setSoundVolume(id, volume) {
    const vol = Math.max(0, Math.min(1, volume));
    if (this.activeTracks.has(id)) {
      const item = this.activeTracks.get(id);
      item.volume = vol;
      if (this.audioContext && item.gainNode) {
        const now = this.audioContext.currentTime;
        item.gainNode.gain.cancelScheduledValues(now);
        item.gainNode.gain.linearRampToValueAtTime(vol, now + 0.05);
      }
      this.notifyListeners();
      return;
    }

    if (this.binauralOscillators.has(id)) {
      const item = this.binauralOscillators.get(id);
      item.volume = vol;
      if (this.audioContext && item.gainNode) {
        const now = this.audioContext.currentTime;
        item.gainNode.gain.cancelScheduledValues(now);
        item.gainNode.gain.linearRampToValueAtTime(vol, now + 0.05);
      }
      this.notifyListeners();
    }
  }

  stopSound(id) {
    if (this.activeTracks.has(id)) {
      const item = this.activeTracks.get(id);
      if (this.audioContext && item.gainNode) {
        const now = this.audioContext.currentTime;
        item.gainNode.gain.cancelScheduledValues(now);
        item.gainNode.gain.linearRampToValueAtTime(0.001, now + 0.3); // smooth fade-out
        setTimeout(() => {
          try {
            item.audio.pause();
            item.audio.src = '';
            item.sourceNode.disconnect();
            item.gainNode.disconnect();
          } catch (_) { }
        }, 320);
      } else {
        try { item.audio.pause(); } catch (_) { }
      }
      this.activeTracks.delete(id);
      this.notifyListeners();
      return;
    }

    if (this.binauralOscillators.has(id)) {
      const item = this.binauralOscillators.get(id);
      if (this.audioContext && item.gainNode) {
        const now = this.audioContext.currentTime;
        item.gainNode.gain.cancelScheduledValues(now);
        item.gainNode.gain.linearRampToValueAtTime(0.001, now + 0.5);
        setTimeout(() => {
          try {
            item.oscL.stop();
            item.oscR.stop();
            item.subOsc.stop();
            item.oscL.disconnect();
            item.oscR.disconnect();
            item.subOsc.disconnect();
            item.gainNode.disconnect();
          } catch (_) { }
        }, 520);
      } else {
        try {
          item.oscL.stop();
          item.oscR.stop();
        } catch (_) { }
      }
      this.binauralOscillators.delete(id);
      this.notifyListeners();
    }
  }

  toggleSound(sound) {
    if (this.isSoundPlaying(sound.id)) {
      this.stopSound(sound.id);
    } else {
      if (sound.category === 'binaural' || sound.carrier) {
        this.playBinauralBeat(sound);
      } else {
        this.playAmbientTrack(sound);
      }
    }
  }

  isSoundPlaying(id) {
    return this.activeTracks.has(id) || this.binauralOscillators.has(id);
  }

  stopAll() {
    const trackIds = Array.from(this.activeTracks.keys());
    const binauralIds = Array.from(this.binauralOscillators.keys());

    trackIds.forEach(id => this.stopSound(id));
    binauralIds.forEach(id => this.stopSound(id));
    this.notifyListeners();
  }

  // Get combined frequency spectrum amplitude for visual reactions
  getAverageFrequencies() {
    if (!this.audioContext) return { overall: 0, forest: 0, birds: 0, water: 0, binaural: 0 };
    const tempArr = new Uint8Array(32);
    const sums = { overall: 0, forest: 0, birds: 0, water: 0, binaural: 0 };
    let count = 0;

    const readAnalyser = (analyser, cat) => {
      analyser.getByteFrequencyData(tempArr);
      let localSum = 0;
      for (let i = 0; i < tempArr.length; i++) localSum += tempArr[i];
      const avg = localSum / tempArr.length / 255;
      sums[cat] = Math.max(sums[cat] || 0, avg);
      sums.overall += avg;
      count++;
    };

    this.activeTracks.forEach(t => {
      if (t.analyserNode) readAnalyser(t.analyserNode, t.category);
    });

    this.binauralOscillators.forEach(b => {
      if (b.analyserNode) readAnalyser(b.analyserNode, 'binaural');
    });

    if (count > 0) sums.overall = sums.overall / count;
    return sums;
  }
}

export const relaxAudioEngine = new RelaxAudioEngine();

