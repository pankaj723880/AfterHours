/**
 * djAudioEngine.js
 * High-Performance Procedural Web Audio API DJ Synthesizer & Beat Engine for Loopra DJ Club
 * 
 * Capabilities:
 * - Authentic 4-on-the-floor BOOM-BOOM kick synthesizer with pitch drop & sub-bass punch
 * - Snappy electronic snares and layered stereo claps
 * - Crisp closed & open hi-hat 16th-note patterns
 * - Off-beat rolling EDM / Tech-House bassline
 * - Dynamic DJ Risers & explosive beat Drops
 * - Instant DJ Sound Effects: Air Horn, Laser Zap, Sub Drop, Vinyl Scratch, DJ Riser
 * - Beat-Sync Event Dispatcher: syncs light flashes & lasers directly with real audio beats
 * - Zero external audio files required: 100% locally synthesized in real time
 * - Strict adherence to browser autoplay restrictions: audio initializes & resumes on explicit user trigger
 * - Master Dynamics Compressor for loud, punchy, distortion-free club mix
 * - Independent volume & mute controls that do not collide with Loopra's music player
 */

class DjAudioEngine {
  constructor() {
    this.ctx = null;
    this.compressor = null;
    this.masterGain = null;
    this.beatsGain = null;
    this.sfxGain = null;

    this.isPlayingBeats = false;
    this.isMuted = false;

    // Volume levels (0.0 to 1.0)
    this.beatsVolume = 0.8;
    this.sfxVolume = 0.85;

    // Tempo & Sequence Configuration
    this.bpm = 128; // Default EDM tempo
    this.currentPattern = 'edm'; // 'edm' | 'tech-house' | 'hyper-rave'
    this.currentStep = 0;
    this.barCount = 0;
    this.timerId = null;
    this.nextNoteTime = 0.0;
    this.scheduleAheadTime = 0.12; // seconds
    this.lookahead = 25.0; // milliseconds

    // Auto SFX occasional trigger (every 16 bars)
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

      // Master Dynamics Compressor: glues punchy drums and bass without clipping or distortion
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(24, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(5, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);

      // Master output stage
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);

      // Signal Chain: [BeatsBus, SfxBus] -> MasterGain -> Compressor -> Destination
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // Dedicated Beats Bus
      this.beatsGain = this.ctx.createGain();
      this.beatsGain.gain.setValueAtTime(this.beatsVolume, this.ctx.currentTime);
      this.beatsGain.connect(this.masterGain);

      // Dedicated SFX Bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Pre-generate white noise buffer
      this.initNoiseBuffer();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return true;
  }

  /**
   * Asynchronously guarantees AudioContext is running
   */
  async resumeContext() {
    if (!this.ensureContext()) return false;
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('AudioContext resume failed:', err);
      }
    }
    return Boolean(this.ctx && this.ctx.state === 'running');
  }

  /**
   * Generates white noise buffer for percussions & sweeps
   */
  initNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate || 44100;
    const bufferSize = sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  /**
   * Register a listener for beat events (e.g. for lighting canvas synchronization)
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
    const t = Math.max(time, this.ctx.currentTime + 0.005);

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
    if (!this.noiseBuffer) this.initNoiseBuffer();
    const t = Math.max(time, this.ctx.currentTime + 0.005);

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
    if (!this.ensureContext()) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    if (!this.noiseBuffer) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

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
    if (!this.ensureContext()) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    if (!this.noiseBuffer) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

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
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

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
  async triggerAirHorn() {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.015;

    // Harmonic multi-tone brass frequencies (approx Eb4, G4, Bb4, Eb5)
    const freqs = [311.13, 392.0, 466.16, 622.25];

    // Play 3 staccato blast bursts
    [0, 0.18, 0.38].forEach((burstOffset, burstIdx) => {
      const burstTime = t + burstOffset;
      const duration = burstIdx === 2 ? 0.42 : 0.14;

      freqs.forEach((freq) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
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
  async triggerLaserZap() {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.015;

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
  async triggerSubDrop() {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.015;

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
  async triggerScratch() {
    await this.resumeContext();
    if (!this.ctx) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    if (!this.noiseBuffer) return;
    const t = this.ctx.currentTime + 0.015;

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
  async triggerRiser(duration = 2.0) {
    await this.resumeContext();
    if (!this.ctx) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    if (!this.noiseBuffer) return;
    const t = this.ctx.currentTime + 0.015;

    // Rising noise sweep
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.exponentialRampToValueAtTime(6500, t + duration);
    filter.Q.setValueAtTime(4.5, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
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
  async startBeats() {
    const isReady = await this.resumeContext();
    if (!isReady || !this.ctx) return false;
    if (this.isPlayingBeats) return true;

    this.isPlayingBeats = true;
    this.currentStep = 0;
    this.barCount = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.04;

    this.scheduler();
    return true;
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
  async toggleBeats() {
    if (this.isPlayingBeats) {
      this.pauseBeats();
      return false;
    } else {
      return await this.startBeats();
    }
  }

  /**
   * Lookahead Scheduler
   */
  scheduler() {
    if (!this.isPlayingBeats || !this.ctx) return;

    // Guard against drift or scheduling into the past
    if (this.nextNoteTime < this.ctx.currentTime) {
      this.nextNoteTime = this.ctx.currentTime + 0.02;
    }

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
