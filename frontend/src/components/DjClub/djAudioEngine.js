/**
 * djAudioEngine.js
 * High-Energy Procedural Web Audio API DJ Synthesizer & Beat Engine for Loopra DJ Club
 * 
 * Capabilities:
 * - Authentic 4-on-the-floor BOOM-BOOM kick synthesizer with pitch drop & sub-bass punch
 * - Snappy electronic snares and layered stereo claps
 * - Crisp closed & open hi-hat 16th-note patterns
 * - Off-beat rolling EDM / Tech-House bassline
 * - Dynamic DJ Risers & explosive beat Drops
 * - Instant DJ Sound Effects: Air Horn, Laser Zap, Sub Drop, Vinyl Scratch, Impact Burst
 * - Beat-Sync Event Dispatcher: syncs light flashes & lasers directly with real audio beats
 * - Zero external audio files required: 100% locally synthesized in real time
 * - Strict adherence to browser autoplay restrictions: audio only starts on explicit user trigger
 * - Independent volume & mute controls that do not collide with Loopra's music player
 */

class DjAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.beatsGain = null;
    this.sfxGain = null;

    this.isPlayingBeats = false;
    this.isMuted = false;

    // Volume levels (0.0 to 1.0)
    this.beatsVolume = 0.75;
    this.sfxVolume = 0.85;

    // Tempo & Sequence Configuration
    this.bpm = 128; // Default EDM tempo
    this.currentPattern = 'edm'; // 'edm' | 'tech-house' | 'hyper-rave'
    this.currentStep = 0;
    this.barCount = 0;
    this.timerId = null;
    this.nextNoteTime = 0.0;
    this.scheduleAheadTime = 0.1; // seconds
    this.lookahead = 25.0; // milliseconds

    // Auto SFX occasional trigger (every 16 or 32 bars)
    this.isAutoSfxEnabled = true;

    // Beat subscriber callbacks
    this.beatListeners = new Set();

    // Noise buffer cache for snares, claps, hats and risers
    this.noiseBuffer = null;
  }

  /**
   * Initializes AudioContext safely on first explicit user action
   */
  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();

      // Master output stage
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);

      // Dedicated Beats Bus
      this.beatsGain = this.ctx.createGain();
      this.beatsGain.gain.value = this.beatsVolume;
      this.beatsGain.connect(this.masterGain);

      // Dedicated SFX Bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      // Pre-generate 3 seconds of white noise for percussions & sweeps
      this.initNoiseBuffer();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return true;
  }

  /**
   * Generates white noise buffer
   */
  initNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  /**
   * Register a listener for beat events (e.g. for lighting synchronization)
   */
  onBeat(callback) {
    if (typeof callback === 'function') {
      this.beatListeners.add(callback);
    }
    return () => this.beatListeners.delete(callback);
  }

  notifyBeat(beatData) {
    this.beatListeners.forEach((cb) => {
      try {
        cb(beatData);
      } catch (_) {}
    });
  }

  // =========================================================================
  // SYNTHESIS ENGINES: PERCUSSION & INSTRUMENTS
  // =========================================================================

  /**
   * Deep BOOM-BOOM Club Kick Drum
   */
  playKick(time = 0, isAccent = false) {
    if (!this.ensureContext()) return;
    const t = time || this.ctx.currentTime;

    // 1. Main punch oscillator with steep pitch drop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const startFreq = isAccent ? 165 : 145;
    const endFreq = isAccent ? 40 : 45;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.08);

    const kickVolume = isAccent ? 1.0 : 0.88;
    gain.gain.setValueAtTime(kickVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.beatsGain);

    osc.start(t);
    osc.stop(t + 0.36);

    // 2. Sub-bass layer for chest-thumping club boom
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(55, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.28);

    subGain.gain.setValueAtTime(0.65, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    subOsc.connect(subGain);
    subGain.connect(this.beatsGain);

    subOsc.start(t);
    subOsc.stop(t + 0.33);

    // 3. Transient click at t=0 for punchy attack
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(380, t);
    clickOsc.frequency.exponentialRampToValueAtTime(80, t + 0.02);

    clickGain.gain.setValueAtTime(0.45, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    clickOsc.connect(clickGain);
    clickGain.connect(this.beatsGain);

    clickOsc.start(t);
    clickOsc.stop(t + 0.026);
  }

  /**
   * Snappy Electronic Snare
   */
  playSnare(time = 0) {
    if (!this.ensureContext()) return;
    const t = time || this.ctx.currentTime;

    // Tone body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(85, t + 0.1);

    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(oscGain);
    oscGain.connect(this.beatsGain);
    osc.start(t);
    osc.stop(t + 0.16);

    // Snappy noise body
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(950, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.55, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.beatsGain);

      noise.start(t);
      noise.stop(t + 0.23);
    }
  }

  /**
   * Stereo Layered Electronic Clap
   */
  playClap(time = 0) {
    if (!this.ensureContext() || !this.noiseBuffer) return;
    const t = time || this.ctx.currentTime;

    // 3 rapid micro bursts followed by a sustained decay
    [0, 0.012, 0.024].forEach((offset, idx) => {
      const burst = this.ctx.createBufferSource();
      burst.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, t + offset);
      filter.Q.setValueAtTime(1.8, t + offset);

      const gain = this.ctx.createGain();
      const isTail = idx === 2;
      const duration = isTail ? 0.22 : 0.025;
      gain.gain.setValueAtTime(isTail ? 0.6 : 0.45, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + duration);

      burst.connect(filter);
      filter.connect(gain);
      gain.connect(this.beatsGain);

      burst.start(t + offset);
      burst.stop(t + offset + duration + 0.01);
    });
  }

  /**
   * Hi-Hat (Closed & Open)
   */
  playHat(time = 0, isOpen = false) {
    if (!this.ensureContext() || !this.noiseBuffer) return;
    const t = time || this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, t);

    const gain = this.ctx.createGain();
    const duration = isOpen ? 0.28 : 0.045;
    const peakGain = isOpen ? 0.4 : 0.25;

    gain.gain.setValueAtTime(peakGain, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.beatsGain);

    noise.start(t);
    noise.stop(t + duration + 0.01);
  }

  /**
   * Off-beat Rolling Synth Bass
   */
  playBasslineNote(time = 0, freq = 65.41) {
    // 65.41 Hz = C2
    if (!this.ensureContext()) return;
    const t = time || this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, t);
    filter.Q.setValueAtTime(4.5, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.18);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.48, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.beatsGain);

    osc.start(t);
    osc.stop(t + 0.19);
  }

  // =========================================================================
  // ORIGINAL DJ SOUND EFFECTS (SFX)
  // =========================================================================

  /**
   * 1. Iconic DJ Club Air Horn
   */
  triggerAirHorn() {
    if (!this.ensureContext()) return;
    const t = this.ctx.currentTime;

    // Harmonic multi-tone brass frequencies (approx Eb4, G4, Bb4, Eb5)
    const freqs = [311.13, 392.0, 466.16, 622.25];

    // Play 3 staccato blast bursts
    [0, 0.18, 0.38].forEach((burstOffset, burstIdx) => {
      const burstTime = t + burstOffset;
      const duration = burstIdx === 2 ? 0.42 : 0.14;

      freqs.forEach((freq) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        // Pitch drop characteristic of compressed air horns
        osc.frequency.setValueAtTime(freq, burstTime);
        osc.frequency.linearRampToValueAtTime(freq * 0.95, burstTime + duration);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.18, burstTime);
        gain.gain.setValueAtTime(0.18, burstTime + duration * 0.75);
        gain.gain.exponentialRampToValueAtTime(0.001, burstTime + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(burstTime);
        osc.stop(burstTime + duration + 0.01);
      });
    });

    this.notifyBeat({
      beatIndex: 0,
      isKick: true,
      isSnare: false,
      isHat: false,
      intensity: 1.0,
      isDrop: true,
      sfxType: 'airhorn'
    });
  }

  /**
   * 2. Rapid Laser Zap FX
   */
  triggerLaserZap() {
    if (!this.ensureContext()) return;
    const t = this.ctx.currentTime;

    // 2 rapid laser sweeps
    [0, 0.14].forEach((offset) => {
      const zapTime = t + offset;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(3200, zapTime);
      osc.frequency.exponentialRampToValueAtTime(90, zapTime + 0.12);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, zapTime);
      filter.Q.setValueAtTime(5, zapTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.42, zapTime);
      gain.gain.exponentialRampToValueAtTime(0.001, zapTime + 0.13);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(zapTime);
      osc.stop(zapTime + 0.14);
    });

    this.notifyBeat({
      beatIndex: 1,
      isKick: false,
      isSnare: false,
      isHat: false,
      intensity: 0.9,
      sfxType: 'laser'
    });
  }

  /**
   * 3. Deep Sub Drop / Bass Drop
   */
  triggerSubDrop() {
    if (!this.ensureContext()) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(26, t + 1.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.85, t);
    gain.gain.setValueAtTime(0.75, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 1.32);

    this.notifyBeat({
      beatIndex: 0,
      isKick: true,
      isSnare: true,
      isHat: false,
      intensity: 1.0,
      isDrop: true,
      sfxType: 'drop'
    });
  }

  /**
   * 4. Vinyl Scratch FX
   */
  triggerScratch() {
    if (!this.ensureContext() || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, t);
    filter.frequency.linearRampToValueAtTime(2200, t + 0.08);
    filter.frequency.linearRampToValueAtTime(450, t + 0.16);
    filter.frequency.linearRampToValueAtTime(1800, t + 0.24);
    filter.Q.setValueAtTime(8, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);
    noise.stop(t + 0.27);

    this.notifyBeat({
      beatIndex: 2,
      isKick: false,
      isSnare: true,
      isHat: false,
      intensity: 0.7,
      sfxType: 'scratch'
    });
  }

  /**
   * 5. DJ Tension Riser & White Noise Sweep
   */
  triggerRiser(duration = 2.0) {
    if (!this.ensureContext() || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    // Rising noise sweep
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.exponentialRampToValueAtTime(6500, t + duration);
    filter.Q.setValueAtTime(4.5, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0.65, t + duration * 0.9);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);
    noise.stop(t + duration + 0.02);

    // Accompanying pitch-rising synth tone
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + duration);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.08, t);
    oscGain.gain.linearRampToValueAtTime(0.35, t + duration * 0.9);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  // =========================================================================
  // BEAT SEQUENCER & PLAYBACK LOOP (16-Step Grid)
  // =========================================================================

  /**
   * Starts the DJ Beats pattern
   */
  startBeats() {
    if (!this.ensureContext()) return;
    if (this.isPlayingBeats) return;

    this.isPlayingBeats = true;
    this.currentStep = 0;
    this.barCount = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;

    this.scheduler();
  }

  /**
   * Pauses the DJ Beats pattern
   */
  pauseBeats() {
    this.isPlayingBeats = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Toggle DJ Beats playback
   */
  toggleBeats() {
    if (this.isPlayingBeats) {
      this.pauseBeats();
      return false;
    } else {
      this.startBeats();
      return true;
    }
  }

  /**
   * Lookahead Scheduler
   */
  scheduler() {
    if (!this.isPlayingBeats || !this.ctx) return;

    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleStep(this.currentStep, this.nextNoteTime);
      this.advanceStep();
    }

    this.timerId = setTimeout(() => this.scheduler(), this.lookahead);
  }

  advanceStep() {
    // 16th note step calculation
    const secondsPerBeat = 60.0 / this.bpm;
    const secondsPer16th = secondsPerBeat / 4.0;
    this.nextNoteTime += secondsPer16th;

    this.currentStep = (this.currentStep + 1) % 16;
    if (this.currentStep === 0) {
      this.barCount += 1;

      // Check for occasional auto DJ riser/drop every 16 bars
      if (this.isAutoSfxEnabled && this.barCount % 16 === 15) {
        this.triggerRiser(1.8);
      }
    }
  }

  /**
   * Schedules a single 16th-note step across the drum & bass instruments
   */
  scheduleStep(step, time) {
    // Standard 4-on-the-floor beat grid:
    // Quarter notes occur on steps: 0, 4, 8, 12
    const isQuarterNote = step % 4 === 0;
    const isOffbeat = step % 4 === 2; // "and" of the beat

    // Bass frequencies cycle through club progression
    const bassFreqs = [58.27, 65.41, 73.42, 87.31]; // Bb1, C2, D2, F2
    const bassFreq = bassFreqs[Math.floor(this.barCount / 2) % bassFreqs.length];

    let hasKick = false;
    let hasSnare = false;
    let hasHat = false;

    // 1. KICK DRUM (BOOM BOOM on 1, 2, 3, 4)
    if (isQuarterNote) {
      const isAccent = step === 0;
      this.playKick(time, isAccent);
      hasKick = true;
    }

    // 2. SNARE / CLAP (on beats 2 & 4: steps 4 & 12)
    if (step === 4 || step === 12) {
      this.playSnare(time);
      this.playClap(time);
      hasSnare = true;
    }

    // 3. HI-HATS
    if (this.currentPattern === 'hyper-rave') {
      // 16th-note driving hi-hats
      const isOpen = isOffbeat;
      this.playHat(time, isOpen);
      hasHat = true;
    } else {
      // Classic offbeat open hat + 8th note groove
      if (isOffbeat) {
        this.playHat(time, true);
        hasHat = true;
      } else if (step % 2 === 0) {
        this.playHat(time, false);
        hasHat = true;
      }
    }

    // 4. BASSLINE
    if (isOffbeat) {
      this.playBasslineNote(time, bassFreq);
    }

    // Emit event to synchronize lighting canvas on real audio hits
    // Use setTimeout to fire the visual sync right as the audio reaches the speakers
    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => {
      if (!this.isPlayingBeats) return;
      this.notifyBeat({
        step,
        beatIndex: Math.floor(step / 4),
        isKick: hasKick,
        isSnare: hasSnare,
        isHat: hasHat,
        intensity: hasKick ? (step === 0 ? 1.0 : 0.85) : hasSnare ? 0.75 : 0.35,
        barNumber: this.barCount
      });
    }, delayMs);
  }

  // =========================================================================
  // VOLUME & SETTINGS
  // =========================================================================

  setBeatsVolume(vol) {
    this.beatsVolume = Math.max(0, Math.min(1, vol));
    if (this.beatsGain && this.ctx) {
      this.beatsGain.gain.setValueAtTime(this.beatsVolume, this.ctx.currentTime);
    }
  }

  setSfxVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  setBpm(newBpm) {
    this.bpm = Math.max(80, Math.min(160, newBpm));
  }

  setPattern(pattern) {
    if (['edm', 'tech-house', 'hyper-rave'].includes(pattern)) {
      this.currentPattern = pattern;
      if (pattern === 'hyper-rave') this.bpm = 134;
      else if (pattern === 'tech-house') this.bpm = 125;
      else this.bpm = 128;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  setMute(muted) {
    this.isMuted = Boolean(muted);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    }
  }

  destroy() {
    this.pauseBeats();
    this.beatListeners.clear();
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch (_) {}
    }
  }
}

// Export singleton instance
export const djAudio = new DjAudioEngine();
export default djAudio;
