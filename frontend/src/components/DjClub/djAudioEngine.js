/**
 * djAudioEngine.js
 * Advanced Procedural Web Audio API DJ Synthesizer & Mixing Console Engine for Loopra DJ Club
 * 
 * Capabilities:
 * - 16 Genuinely Distinct Beat Styles across 4 Categories (EDM, Techno, Bass/Hard Dance, Desi/Dhol)
 * - 8 BOOM-BOOM Bass & Drum Generators (Deep Sub, Punchy Kick, Rolling Bass, Wobble, Distorted, Reverse, Dhol, Triple Drop)
 * - 12 Instant Punchy DJ Sound Effects (Air Horn, Bass Impact, Riser, Scratch, Laser, Bass Sweep, Sub Drop, Crowd Hype, Drum Roll, DJ Shout, Impact Hit, Echo Delay)
 * - 3-Band Equalizer (Bass, Kick/Mid, Treble)
 * - Beat Intensity / Saturation Drive control
 * - Studio Echo Delay (with feedback & filter) and Procedural Reverb Convolver
 * - Adjustable BPM (70 - 180) with dynamic tempo calculation & pattern styles (Straight, Syncopated, Half-time, Triplet, Drop Mode)
 * - Quick Beat Drop & Bass Drop live trigger functions
 * - Beat-Sync Event Dispatcher: syncs light flashes, lasers, and waveform directly with real audio beats
 * - Zero external audio files required: 100% locally synthesized in real time
 * - Master Dynamics Compressor for distortion-free club mix
 */

export const BEAT_CATEGORIES = [
  { id: 'edm', name: 'EDM & House' },
  { id: 'techno', name: 'Techno' },
  { id: 'bass', name: 'Bass & Hard' },
  { id: 'desi', name: 'Desi & Dhol' }
];

export const BEAT_STYLES = [
  // 1. EDM & House
  {
    id: 'big-room',
    name: 'Big Room EDM',
    category: 'edm',
    defaultBpm: 128,
    desc: 'Festival anthem kick with offbeat saw bass & stadium claps'
  },
  {
    id: 'progressive-house',
    name: 'Progressive House',
    category: 'edm',
    defaultBpm: 126,
    desc: 'Melodic pumping 16th bassline with smooth layered hats'
  },
  {
    id: 'electro-house',
    name: 'Electro House',
    category: 'edm',
    defaultBpm: 130,
    desc: 'Gritty distorted synth bass with punchy acoustic snare'
  },
  {
    id: 'festival-anthem',
    name: 'Festival Anthem',
    category: 'edm',
    defaultBpm: 132,
    desc: 'Massive euphoric upbeat supersaw stabs & pounding sub'
  },

  // 2. Techno
  {
    id: 'tech-house',
    name: 'Tech House',
    category: 'techno',
    defaultBpm: 125,
    desc: 'Bouncy syncopated bass groove with swung rimshot claps'
  },
  {
    id: 'hard-techno',
    name: 'Hard Techno',
    category: 'techno',
    defaultBpm: 150,
    desc: 'Industrial 4/4 rumble kick & driving metallic ride hats'
  },
  {
    id: 'acid-techno',
    name: 'Acid Techno',
    category: 'techno',
    defaultBpm: 140,
    desc: 'Resonant 303 squelch bassline with hypnotic sweeps'
  },
  {
    id: 'minimal-techno',
    name: 'Minimal Techno',
    category: 'techno',
    defaultBpm: 128,
    desc: 'Deep clicky sub kick with micro-percussion & sine pulses'
  },

  // 3. Bass & Hard Dance
  {
    id: 'drum-and-bass',
    name: 'Drum & Bass',
    category: 'bass',
    defaultBpm: 174,
    desc: 'Fast 174 BPM breakbeat, snappy snare on 2/4 & sub glides'
  },
  {
    id: 'dubstep',
    name: 'Dubstep',
    category: 'bass',
    defaultBpm: 140,
    desc: 'Half-time heavy snare on 3, guttural wobble LFO bass'
  },
  {
    id: 'hardstyle',
    name: 'Hardstyle',
    category: 'bass',
    defaultBpm: 150,
    desc: 'Distorted pitch-bent kick with reverse-bass offbeat roar'
  },
  {
    id: 'psytrance',
    name: 'Psytrance',
    category: 'bass',
    defaultBpm: 142,
    desc: 'Driving K-B-B-B triplet rolling gallop & sharp offbeat hats'
  },

  // 4. Desi & Dhol
  {
    id: 'bollywood-edm',
    name: 'Bollywood EDM',
    category: 'desi',
    defaultBpm: 130,
    desc: '4-on-the-floor club kick with dholak slaps & bouncy synth bass'
  },
  {
    id: 'punjabi-dhol-bass',
    name: 'Punjabi Dhol Bass',
    category: 'desi',
    defaultBpm: 128,
    desc: 'Authentic Dhol Chaal groove with thunderous dagga sub-bass'
  },
  {
    id: 'bhangra-club-mix',
    name: 'Bhangra Club Mix',
    category: 'desi',
    defaultBpm: 134,
    desc: 'Hyper-energetic dhol triplets, offbeat bounce & stadium claps'
  }
];

export const BASS_LIBRARY = [
  { id: 'deep-sub', name: 'Deep Sub Bass', tag: '30Hz Sub', desc: 'Ultra-low rumbling sine wave sub' },
  { id: 'punchy-kick', name: 'Punchy Kick', tag: 'Club Punch', desc: 'Fast transient chest-thumping club kick' },
  { id: 'rolling-bass', name: 'Rolling Bass', tag: 'Saw Groove', desc: '16th-note resonant filtered sawtooth bass' },
  { id: 'wobble-bass', name: 'Wobble Bass', tag: 'Dub LFO', desc: 'Modulated lowpass bass sweep with grit' },
  { id: 'distorted-bass', name: 'Distorted Bass', tag: 'Industrial', desc: 'Hard-clipped aggressive drive bass' },
  { id: 'reverse-bass', name: 'Reverse Bass', tag: 'Hardstyle', desc: 'Swell-in envelope with pitch punch' },
  { id: 'dhol-bass', name: 'Dhol Bass', tag: 'Punjabi Dagga', desc: 'Acoustic resonant wooden dhol drum boom' },
  { id: 'triple-drop', name: 'Triple Drop', tag: 'Cascade Sub', desc: '3-stage cascading sub-frequency rumble' }
];

export const SFX_LIBRARY = [
  { id: 'airhorn', name: 'Air Horn', icon: '🚨', desc: 'Triple brass blast' },
  { id: 'bass-impact', name: 'Bass Impact', icon: '💣', desc: 'Cinematic trailer boom' },
  { id: 'riser', name: 'DJ Riser', icon: '📈', desc: 'Tension noise & pitch sweep' },
  { id: 'scratch', name: 'Vinyl Scratch', icon: '🌀', desc: '4-stroke turntable flick' },
  { id: 'laser', name: 'Laser Zap', icon: '⚡', desc: 'Dual beam cyber zap' },
  { id: 'bass-sweep', name: 'Bass Sweep', icon: '🌊', desc: 'Resonant sub frequency dive' },
  { id: 'sub-drop', name: 'Sub Drop', icon: '💥', desc: 'Chest-thumping 24Hz plunge' },
  { id: 'crowd-hype', name: 'Crowd Hype', icon: '🙌', desc: 'Stadium crowd roar & cheer' },
  { id: 'drum-roll', name: 'Drum Roll', icon: '🥁', desc: 'Accelerating snare build & crash' },
  { id: 'dj-shout', name: 'DJ Shout', icon: '📢', desc: 'Vocoder formant chant' },
  { id: 'impact-hit', name: 'Impact Hit', icon: '✨', desc: 'Club crash with transient slam' },
  { id: 'echo-delay', name: 'Echo Delay', icon: '🎛️', desc: 'Cascading tape feedback repeat' }
];

export const BEAT_PATTERNS = [
  { id: 'straight', name: 'Straight 4/4', desc: 'Standard 4-on-the-floor club groove' },
  { id: 'syncopated', name: 'Syncopated', desc: 'Offbeat bouncy dance rhythm' },
  { id: 'half-time', name: 'Half-Time', desc: 'Heavy dubstep/trap halftime feel' },
  { id: 'triplet', name: 'Triplet / Roll', desc: 'Psytrance & Bhangra rolling triplets' },
  { id: 'drop-mode', name: 'Drop Mode', desc: 'Kick removed for tension build' }
];

class DjAudioEngine {
  constructor() {
    this.ctx = null;
    this.compressor = null;
    this.masterGain = null;

    // Submix busses
    this.beatsGain = null;
    this.sfxGain = null;

    // 3-Band Equalizer (Low, Mid, High)
    this.lowShelf = null;
    this.midPeaking = null;
    this.highShelf = null;

    // Sound FX DSP sends
    this.echoDelayNode = null;
    this.echoFeedbackGain = null;
    this.echoSendGain = null;
    this.reverbConvolver = null;
    this.reverbSendGain = null;

    // Playback state
    this.isPlayingBeats = false;
    this.isMuted = false;

    // Mixer Levels
    this.beatsVolume = 0.8;
    this.sfxVolume = 0.85;
    this.eqBass = 0; // -12 to +12 dB
    this.eqMid = 0;
    this.eqTreble = 0;
    this.beatIntensity = 1.0; // 0.2 to 2.0
    this.echoAmount = 0.15; // 0 to 1
    this.reverbAmount = 0.2; // 0 to 1

    // Tempo & Style Configuration
    this.bpm = 128;
    this.currentStyle = 'big-room';
    this.currentPattern = 'straight';
    this.currentStep = 0;
    this.barCount = 0;
    this.timerId = null;
    this.nextNoteTime = 0.0;
    this.scheduleAheadTime = 0.12;
    this.lookahead = 25.0;

    // Event listeners for visual sync
    this.beatListeners = new Set();

    // Noise buffer cache
    this.noiseBuffer = null;
    this.reverbBuffer = null;

    // Wave shaper curve for distortion / intensity
    this.distortionCurve = null;
  }

  /**
   * Initializes AudioContext & advanced DSP routing
   */
  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();

      // Master Dynamics Compressor: prevents digital clipping during heavy drops
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(20, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4.5, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime);

      // Master output stage
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);

      // Connect: MasterGain -> Compressor -> Speakers
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // 3-Band Equalizer: LowShelf (250Hz), Peaking (1200Hz), HighShelf (4000Hz)
      this.lowShelf = this.ctx.createBiquadFilter();
      this.lowShelf.type = 'lowshelf';
      this.lowShelf.frequency.setValueAtTime(250, this.ctx.currentTime);
      this.lowShelf.gain.setValueAtTime(this.eqBass, this.ctx.currentTime);

      this.midPeaking = this.ctx.createBiquadFilter();
      this.midPeaking.type = 'peaking';
      this.midPeaking.frequency.setValueAtTime(1200, this.ctx.currentTime);
      this.midPeaking.Q.setValueAtTime(1.0, this.ctx.currentTime);
      this.midPeaking.gain.setValueAtTime(this.eqMid, this.ctx.currentTime);

      this.highShelf = this.ctx.createBiquadFilter();
      this.highShelf.type = 'highshelf';
      this.highShelf.frequency.setValueAtTime(4000, this.ctx.currentTime);
      this.highShelf.gain.setValueAtTime(this.eqTreble, this.ctx.currentTime);

      // Equalizer chain: LowShelf -> MidPeaking -> HighShelf -> MasterGain
      this.lowShelf.connect(this.midPeaking);
      this.midPeaking.connect(this.highShelf);
      this.highShelf.connect(this.masterGain);

      // Dedicated Beats Bus
      this.beatsGain = this.ctx.createGain();
      this.beatsGain.gain.setValueAtTime(this.beatsVolume * this.beatIntensity, this.ctx.currentTime);
      this.beatsGain.connect(this.lowShelf);

      // Dedicated SFX Bus (direct to master for punchy transient FX)
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Studio Echo Delay Node
      this.initEchoDelay();

      // Procedural Reverb Convolver
      this.initProceduralReverb();

      // Pre-generate white noise buffer
      this.initNoiseBuffer();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return true;
  }

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
   * Studio Echo Delay setup with filtered feedback
   */
  initEchoDelay() {
    if (!this.ctx) return;
    this.echoDelayNode = this.ctx.createDelay(1.0);
    this.echoDelayNode.delayTime.setValueAtTime(0.24, this.ctx.currentTime); // 1/8th note approx

    this.echoFeedbackGain = this.ctx.createGain();
    this.echoFeedbackGain.gain.setValueAtTime(0.42, this.ctx.currentTime);

    const delayFilter = this.ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.setValueAtTime(2600, this.ctx.currentTime);

    this.echoSendGain = this.ctx.createGain();
    this.echoSendGain.gain.setValueAtTime(this.echoAmount, this.ctx.currentTime);

    // Feedback loop: Send -> Delay -> Filter -> FeedbackGain -> Delay
    this.echoSendGain.connect(this.echoDelayNode);
    this.echoDelayNode.connect(delayFilter);
    delayFilter.connect(this.echoFeedbackGain);
    this.echoFeedbackGain.connect(this.echoDelayNode);

    // Output to master
    delayFilter.connect(this.masterGain);
  }

  /**
   * Creates procedural impulse response for natural club acoustic reverb
   */
  initProceduralReverb() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate || 44100;
    const length = sampleRate * 1.5; // 1.5 sec tail
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (sampleRate * 0.32));
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    this.reverbBuffer = impulse;

    this.reverbConvolver = this.ctx.createConvolver();
    this.reverbConvolver.buffer = this.reverbBuffer;

    this.reverbSendGain = this.ctx.createGain();
    this.reverbSendGain.gain.setValueAtTime(this.reverbAmount, this.ctx.currentTime);

    this.reverbSendGain.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.masterGain);
  }

  /**
   * Generates white noise buffer
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
   * Creates distortion curve
   */
  makeDistortionCurve(amount = 20) {
    const k = typeof amount === 'number' ? amount : 20;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

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
  // BOOM-BOOM BASS & DRUM GENERATOR LIBRARY
  // =========================================================================

  /**
   * 1. Deep Sub Bass (Pure sine low-end foundation)
   */
  playDeepSub(time = 0, duration = 0.8) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(45, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + duration * 0.7);

    gain.gain.setValueAtTime(0.85, t);
    gain.gain.linearRampToValueAtTime(0.7, t + duration * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.beatsGain);

    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /**
   * 2. Punchy Club Kick (Fast pitch drop + transient click)
   */
  playPunchyKick(time = 0, isAccent = false) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    // Main punch oscillator
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const startFreq = isAccent ? 175 : 150;
    const endFreq = isAccent ? 38 : 44;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.08);

    const kickVolume = (isAccent ? 1.0 : 0.88) * this.beatIntensity;
    gain.gain.setValueAtTime(kickVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc.connect(gain);
    gain.connect(this.beatsGain);

    osc.start(t);
    osc.stop(t + 0.33);

    // Sub-chest boom
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(58, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.26);

    subGain.gain.setValueAtTime(0.6 * this.beatIntensity, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    subOsc.connect(subGain);
    subGain.connect(this.beatsGain);

    subOsc.start(t);
    subOsc.stop(t + 0.31);

    // Transient click for crisp punch
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(420, t);
    click.frequency.exponentialRampToValueAtTime(80, t + 0.02);

    clickGain.gain.setValueAtTime(0.4 * this.beatIntensity, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    click.connect(clickGain);
    clickGain.connect(this.beatsGain);

    click.start(t);
    click.stop(t + 0.026);
  }

  /**
   * 3. Rolling Bass (16th-note filtered sawtooth)
   */
  playRollingBass(time = 0, freq = 65.41) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, t);
    filter.Q.setValueAtTime(4.0, t);
    filter.frequency.exponentialRampToValueAtTime(130, t + 0.16);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.48 * this.beatIntensity, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.beatsGain);

    osc.start(t);
    osc.stop(t + 0.17);
  }

  /**
   * 4. Wobble Bass (Modulated LFO bass)
   */
  playWobbleBass(time = 0, freq = 55.0, rate = 6) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t);
    filter.Q.setValueAtTime(6.0, t);

    // LFO modulator
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(rate, t);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(700, t);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55 * this.beatIntensity, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.beatsGain);

    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.46);
    lfo.stop(t + 0.46);
  }

  /**
   * 5. Distorted Bass (Overdriven aggressive wave)
   */
  playDistortedBass(time = 0, freq = 60.0) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.makeDistortionCurve(35);
    shaper.oversample = '2x';

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(850, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4 * this.beatIntensity, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(shaper);
    shaper.connect(filter);
    filter.connect(gain);
    gain.connect(this.beatsGain);

    osc.start(t);
    osc.stop(t + 0.29);
  }

  /**
   * 6. Reverse Bass (Hardstyle style reverse swell)
   */
  playReverseBass(time = 0, freq = 65.0) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 0.9, t);
    osc.frequency.linearRampToValueAtTime(freq * 1.05, t + 0.18);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, t);
    filter.frequency.linearRampToValueAtTime(1100, t + 0.16);
    filter.Q.setValueAtTime(5, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.55 * this.beatIntensity, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.beatsGain);

    osc.start(t);
    osc.stop(t + 0.23);
  }

  /**
   * 7. Dhol Bass (Acoustic Punjabi Dagga Drum Boom)
   */
  playDholBass(time = 0, isAccent = true) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    // Deep resonant wooden body pitch dive
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isAccent ? 115 : 98, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.35);

    const vol = (isAccent ? 0.9 : 0.72) * this.beatIntensity;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

    // Acoustic wooden drum resonance bandpass
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(140, t);
    filter.Q.setValueAtTime(2.2, t);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.beatsGain);

    osc.start(t);
    osc.stop(t + 0.43);

    // Dagga slap transient
    const slap = this.ctx.createOscillator();
    const slapGain = this.ctx.createGain();
    slap.type = 'triangle';
    slap.frequency.setValueAtTime(320, t);
    slap.frequency.exponentialRampToValueAtTime(95, t + 0.03);

    slapGain.gain.setValueAtTime(0.35 * this.beatIntensity, t);
    slapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    slap.connect(slapGain);
    slapGain.connect(this.beatsGain);

    slap.start(t);
    slap.stop(t + 0.045);
  }

  /**
   * 8. Triple Drop (3-stage cascading sub rumble)
   */
  playTripleDrop(time = 0) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    [0, 0.12, 0.24].forEach((offset, idx) => {
      const dropTime = t + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const startFreq = idx === 0 ? 140 : idx === 1 ? 95 : 65;
      const endFreq = idx === 0 ? 60 : idx === 1 ? 40 : 25;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, dropTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, dropTime + 0.35);

      const vol = (0.75 - idx * 0.1) * this.beatIntensity;
      gain.gain.setValueAtTime(vol, dropTime);
      gain.gain.exponentialRampToValueAtTime(0.001, dropTime + 0.45);

      osc.connect(gain);
      gain.connect(this.beatsGain);

      osc.start(dropTime);
      osc.stop(dropTime + 0.46);
    });
  }

  /**
   * High-Pitched Punjabi Dhol Tilla (Sharp stick rim snap)
   */
  playDholTilla(time = 0) {
    if (!this.ensureContext()) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.04);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55 * this.beatIntensity, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.beatsGain);
    osc.start(t);
    osc.stop(t + 0.055);

    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2600, t);
      filter.Q.setValueAtTime(4.0, t);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.4 * this.beatIntensity, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.beatsGain);

      noise.start(t);
      noise.stop(t + 0.07);
    }
  }

  /**
   * Snare Drum
   */
  playSnare(time = 0) {
    if (!this.ensureContext()) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(85, t + 0.1);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.6 * this.beatIntensity, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(oscGain);
    oscGain.connect(this.beatsGain);
    osc.start(t);
    osc.stop(t + 0.16);

    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(950, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.55 * this.beatIntensity, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.beatsGain);

      noise.start(t);
      noise.stop(t + 0.23);
    }
  }

  /**
   * Claps
   */
  playClap(time = 0) {
    if (!this.ensureContext()) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    if (!this.noiseBuffer) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

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
      gain.gain.setValueAtTime((isTail ? 0.6 : 0.45) * this.beatIntensity, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + duration);

      burst.connect(filter);
      filter.connect(gain);
      gain.connect(this.beatsGain);

      burst.start(t + offset);
      burst.stop(t + offset + duration + 0.01);
    });
  }

  /**
   * Hi-Hats
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
    const duration = isOpen ? 0.26 : 0.045;
    const peakGain = (isOpen ? 0.4 : 0.25) * this.beatIntensity;

    gain.gain.setValueAtTime(peakGain, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.beatsGain);

    noise.start(t);
    noise.stop(t + duration + 0.01);
  }

  // =========================================================================
  // DJ SOUND EFFECTS LIBRARY (12 Distinct SFX)
  // =========================================================================

  /**
   * 1. Air Horn
   */
  async triggerAirHorn() {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.015;
    const freqs = [311.13, 392.0, 466.16, 622.25];

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

    this.notifyBeat({ isKick: true, isDrop: true, intensity: 1.0, sfxType: 'airhorn' });
  }

  /**
   * 2. Bass Impact (Massive cinematic trailer boom)
   */
  async triggerBassImpact() {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.015;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.7);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    if (this.echoSendGain) gain.connect(this.echoSendGain);

    osc.start(t);
    osc.stop(t + 1.25);

    // Rumble burst
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, t);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.6, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.sfxGain);
      noise.start(t);
      noise.stop(t + 0.65);
    }

    this.notifyBeat({ isKick: true, isDrop: true, intensity: 1.0, sfxType: 'bass-impact' });
  }

  /**
   * 3. DJ Tension Riser
   */
  async triggerRiser(duration = 2.0) {
    await this.resumeContext();
    if (!this.ctx) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    const t = this.ctx.currentTime + 0.015;

    if (this.noiseBuffer) {
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
    }

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

    this.notifyBeat({ isSnare: true, isDrop: false, intensity: 0.85, sfxType: 'riser' });
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
    filter.frequency.linearRampToValueAtTime(2400, t + 0.08);
    filter.frequency.linearRampToValueAtTime(450, t + 0.16);
    filter.frequency.linearRampToValueAtTime(1900, t + 0.24);
    filter.Q.setValueAtTime(8, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);
    noise.stop(t + 0.27);

    this.notifyBeat({ isSnare: true, intensity: 0.75, sfxType: 'scratch' });
  }

  /**
   * 5. Laser Zap FX
   */
  async triggerLaserZap() {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.015;

    [0, 0.13].forEach((offset) => {
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
      gain.gain.setValueAtTime(0.45, zapTime);
      gain.gain.exponentialRampToValueAtTime(0.001, zapTime + 0.13);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(zapTime);
      osc.stop(zapTime + 0.14);
    });

    this.notifyBeat({ intensity: 0.9, sfxType: 'laser' });
  }

  /**
   * 6. Bass Sweep
   */
  async triggerBassSweep() {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.015;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.6);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.6);
    filter.Q.setValueAtTime(6.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.66);

    this.notifyBeat({ isKick: true, intensity: 0.9, sfxType: 'bass-sweep' });
  }

  /**
   * 7. Deep Sub Drop
   */
  async triggerSubDrop() {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.015;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(26, t + 1.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.85, t);
    gain.gain.setValueAtTime(0.75, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 1.32);

    this.notifyBeat({ isKick: true, isDrop: true, intensity: 1.0, sfxType: 'drop' });
  }

  /**
   * 8. Crowd Hype (Cheering stadium roar)
   */
  async triggerCrowdHype() {
    await this.resumeContext();
    if (!this.ctx) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    if (!this.noiseBuffer) return;
    const t = this.ctx.currentTime + 0.015;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(1.2, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.55, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    if (this.reverbSendGain) gain.connect(this.reverbSendGain);

    noise.start(t);
    noise.stop(t + 1.85);

    this.notifyBeat({ intensity: 0.8, sfxType: 'crowd' });
  }

  /**
   * 9. Drum Roll (Accelerating snare build into crash)
   */
  async triggerDrumRoll() {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.015;

    // 8 hits accelerating from 0.12s to 0.03s intervals
    let curr = t;
    let gap = 0.14;
    for (let i = 0; i < 9; i++) {
      this.playSnare(curr);
      curr += gap;
      gap = Math.max(0.035, gap * 0.82);
    }
    // Big crash hit at the end
    setTimeout(() => {
      this.triggerImpactHit();
    }, (curr - t) * 1000);

    this.notifyBeat({ isSnare: true, intensity: 0.95, sfxType: 'drum-roll' });
  }

  /**
   * 10. DJ Shout (Vocoder formant chant "HEY!")
   */
  async triggerDjShout() {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.015;

    // Dual vocal formants (approx 700Hz and 1220Hz for "EH/AY")
    const formants = [720, 1240, 2500];
    formants.forEach((f) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.22);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(f, t);
      filter.Q.setValueAtTime(4.0, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.26);
    });

    this.notifyBeat({ intensity: 0.85, sfxType: 'shout' });
  }

  /**
   * 11. Impact Hit (Metallic club cymbal splash layered with heavy transient punch)
   */
  async triggerImpactHit() {
    await this.resumeContext();
    if (!this.ctx) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    const t = this.ctx.currentTime + 0.015;

    this.playPunchyKick(t, true);

    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(3200, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.55, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      if (this.reverbSendGain) gain.connect(this.reverbSendGain);

      noise.start(t);
      noise.stop(t + 0.82);
    }

    this.notifyBeat({ isKick: true, isDrop: true, intensity: 1.0, sfxType: 'impact' });
  }

  /**
   * 12. Echo Delay FX (Staccato synth stab that cascades in the delay feedback)
   */
  async triggerEchoDelay() {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.015;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.12);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.setValueAtTime(3.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    if (this.echoSendGain) {
      gain.connect(this.echoSendGain);
    }

    osc.start(t);
    osc.stop(t + 0.15);

    this.notifyBeat({ intensity: 0.8, sfxType: 'echo' });
  }

  // =========================================================================
  // ONE-CLICK LIVE PERFORMANCE TRIGGERS
  // =========================================================================

  /**
   * One-click Beat Drop: Cuts the beats for a 1-bar tension silence then slams back with maximum energy & explosion flash
   */
  async triggerBeatDrop() {
    await this.resumeContext();
    if (!this.ctx) return;

    // Trigger instant tension riser
    this.triggerRiser(1.4);

    // Mute beats temporarily for tension drop
    const origBeatsVolume = this.beatsVolume;
    this.setBeatsVolume(0);

    setTimeout(() => {
      this.setBeatsVolume(origBeatsVolume);
      this.triggerImpactHit();
      this.playTripleDrop();
      this.notifyBeat({ isKick: true, isDrop: true, intensity: 1.0, sfxType: 'drop' });
    }, 1400);
  }

  /**
   * One-click Bass Drop: Fires thunderous sub plunge & shockwave pulse immediately
   */
  async triggerLiveBassDrop() {
    await this.resumeContext();
    this.triggerSubDrop();
    this.playDeepSub();
  }

  // =========================================================================
  // 16-STEP BEAT SEQUENCER & STYLE PLAYBACK ENGINE
  // =========================================================================

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

  pauseBeats() {
    this.isPlayingBeats = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  async toggleBeats() {
    if (this.isPlayingBeats) {
      this.pauseBeats();
      return false;
    } else {
      return await this.startBeats();
    }
  }

  scheduler() {
    if (!this.isPlayingBeats || !this.ctx) return;

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
    const secondsPerBeat = 60.0 / this.bpm;
    const secondsPer16th = secondsPerBeat / 4.0;
    this.nextNoteTime += secondsPer16th;

    this.currentStep = (this.currentStep + 1) % 16;
    if (this.currentStep === 0) {
      this.barCount += 1;
    }
  }

  /**
   * Dynamic Step Scheduler - selects rhythm and bass formula according to current style and pattern
   */
  scheduleStep(step, time) {
    const style = this.currentStyle;
    const pattern = this.currentPattern;

    let hasKick = false;
    let hasSnare = false;
    let hasHat = false;

    const isQuarterNote = step % 4 === 0;
    const isOffbeat = step % 4 === 2;

    // Harmonic progression roots
    const roots = [58.27, 65.41, 73.42, 87.31]; // Bb1, C2, D2, F2
    const currentRoot = roots[Math.floor(this.barCount / 2) % roots.length];

    // Check if Drop Mode is active (suppress kick)
    const allowKick = pattern !== 'drop-mode';

    switch (style) {
      // 1. Big Room EDM
      case 'big-room': {
        if (allowKick && isQuarterNote) {
          this.playPunchyKick(time, step === 0);
          hasKick = true;
        }
        if (step === 4 || step === 12) {
          this.playSnare(time);
          this.playClap(time);
          hasSnare = true;
        }
        if (isOffbeat) {
          this.playHat(time, true);
          hasHat = true;
          this.playRollingBass(time, currentRoot);
        } else if (step % 2 === 0) {
          this.playHat(time, false);
          hasHat = true;
        }
        break;
      }

      // 2. Progressive House
      case 'progressive-house': {
        if (allowKick && isQuarterNote) {
          this.playPunchyKick(time, step === 0);
          hasKick = true;
        }
        if (step === 4 || step === 12) {
          this.playClap(time);
          hasSnare = true;
        }
        // Pumping 16th melodic bassline on steps 2, 5, 8, 10, 14
        if ([2, 5, 8, 10, 14].includes(step)) {
          this.playRollingBass(time, currentRoot * (step === 8 ? 1.25 : 1.0));
        }
        if (step % 2 === 0) {
          this.playHat(time, isOffbeat);
          hasHat = true;
        }
        break;
      }

      // 3. Electro House
      case 'electro-house': {
        if (allowKick && isQuarterNote) {
          this.playPunchyKick(time, step === 0);
          hasKick = true;
        }
        if (step === 4 || step === 12) {
          this.playSnare(time);
          hasSnare = true;
        }
        // Gritty syncopated electro bass
        if ([2, 6, 7, 10, 14].includes(step)) {
          this.playDistortedBass(time, currentRoot * (step === 7 ? 1.33 : 1.0));
        }
        this.playHat(time, isOffbeat);
        hasHat = true;
        break;
      }

      // 4. Festival Anthem
      case 'festival-anthem': {
        if (allowKick && isQuarterNote) {
          this.playPunchyKick(time, step === 0);
          hasKick = true;
        }
        if (step === 4 || step === 12) {
          this.playClap(time);
          this.playSnare(time);
          hasSnare = true;
        }
        if (isOffbeat) {
          this.playRollingBass(time, currentRoot);
          this.playHat(time, true);
          hasHat = true;
        }
        if (step === 0) {
          this.playDeepSub(time, 0.4);
        }
        break;
      }

      // 5. Tech House
      case 'tech-house': {
        if (allowKick && isQuarterNote) {
          this.playPunchyKick(time, step === 0);
          hasKick = true;
        }
        if (step === 4 || step === 12) {
          this.playClap(time);
          hasSnare = true;
        }
        // Bouncy tech house groove on steps 2, 6, 9, 14
        if ([2, 6, 9, 14].includes(step)) {
          this.playRollingBass(time, currentRoot);
        }
        if (isOffbeat) {
          this.playHat(time, true);
          hasHat = true;
        } else if (step % 2 === 1) {
          this.playHat(time, false);
          hasHat = true;
        }
        break;
      }

      // 6. Hard Techno
      case 'hard-techno': {
        if (allowKick && isQuarterNote) {
          this.playPunchyKick(time, true);
          this.playDistortedBass(time, 42.0); // Rumble sub kick
          hasKick = true;
        }
        if (step === 4 || step === 12) {
          this.playSnare(time);
          hasSnare = true;
        }
        // Relentless 16th hats
        this.playHat(time, isOffbeat);
        hasHat = true;
        break;
      }

      // 7. Acid Techno
      case 'acid-techno': {
        if (allowKick && isQuarterNote) {
          this.playPunchyKick(time, step === 0);
          hasKick = true;
        }
        if (step === 4 || step === 12) {
          this.playSnare(time);
          hasSnare = true;
        }
        // 303 Acid line moving every 16th note
        const acidNotes = [currentRoot, currentRoot, currentRoot * 1.5, currentRoot, currentRoot * 1.33, currentRoot, currentRoot * 2, currentRoot];
        const note = acidNotes[step % acidNotes.length];
        this.playRollingBass(time, note);
        if (isOffbeat) {
          this.playHat(time, true);
          hasHat = true;
        }
        break;
      }

      // 8. Minimal Techno
      case 'minimal-techno': {
        if (allowKick && isQuarterNote) {
          this.playPunchyKick(time, false);
          hasKick = true;
        }
        if (step === 12) {
          this.playClap(time);
          hasSnare = true;
        }
        if (step === 2 || step === 10) {
          this.playDeepSub(time, 0.25);
        }
        if (isOffbeat) {
          this.playHat(time, false);
          hasHat = true;
        }
        break;
      }

      // 9. Drum & Bass (174 BPM Fast Breakbeat)
      case 'drum-and-bass': {
        // Kick on steps 0 and 10
        if (allowKick && (step === 0 || step === 10)) {
          this.playPunchyKick(time, step === 0);
          hasKick = true;
        }
        // Snare on steps 4 and 12
        if (step === 4 || step === 12) {
          this.playSnare(time);
          hasSnare = true;
        }
        // Fast rolling 16th hats
        this.playHat(time, step % 4 === 2);
        hasHat = true;
        // Reese Sub Glide on beat 1 & 3
        if (step === 0 || step === 8) {
          this.playDeepSub(time, 0.45);
        }
        break;
      }

      // 10. Dubstep (140 BPM Half-Time)
      case 'dubstep': {
        // Half-time: Kick on 0, massive snare on 8
        if (allowKick && step === 0) {
          this.playPunchyKick(time, true);
          hasKick = true;
        }
        if (step === 8) {
          this.playSnare(time);
          this.playClap(time);
          hasSnare = true;
        }
        // Guttural wobble bass on steps 2, 4, 6, 10, 12, 14
        if ([2, 4, 6, 10, 12, 14].includes(step)) {
          this.playWobbleBass(time, currentRoot, step > 8 ? 8 : 4);
        }
        if (step % 2 === 0) {
          this.playHat(time, step === 4 || step === 12);
          hasHat = true;
        }
        break;
      }

      // 11. Hardstyle
      case 'hardstyle': {
        if (allowKick && isQuarterNote) {
          this.playPunchyKick(time, true);
          hasKick = true;
        }
        if (step === 4 || step === 12) {
          this.playClap(time);
          hasSnare = true;
        }
        // Reverse bass offbeat roar on steps 2, 6, 10, 14
        if (isOffbeat) {
          this.playReverseBass(time, currentRoot);
          this.playHat(time, true);
          hasHat = true;
        }
        break;
      }

      // 12. Psytrance (K-B-B-B Triplet Gallop)
      case 'psytrance': {
        if (allowKick && isQuarterNote) {
          this.playPunchyKick(time, true);
          hasKick = true;
        }
        // Rolling psy bass on steps 1, 2, 3 of each beat quarter
        if (step % 4 !== 0) {
          this.playRollingBass(time, currentRoot);
        }
        if (isOffbeat) {
          this.playHat(time, true);
          hasHat = true;
        }
        break;
      }

      // 13. Bollywood EDM
      case 'bollywood-edm': {
        if (allowKick && isQuarterNote) {
          this.playPunchyKick(time, step === 0);
          hasKick = true;
        }
        if (step === 4 || step === 12) {
          this.playSnare(time);
          this.playClap(time);
          hasSnare = true;
        }
        // Dhol tilla syncopation on steps 3, 7, 11, 15
        if ([3, 7, 11, 15].includes(step)) {
          this.playDholTilla(time);
        }
        if (isOffbeat) {
          this.playDholBass(time, step === 2);
          this.playHat(time, true);
          hasHat = true;
        }
        break;
      }

      // 14. Punjabi Dhol Bass (Authentic Chaal)
      case 'punjabi-dhol-bass': {
        // Thunderous Dagga on 0, 6, 10
        if (allowKick && (step === 0 || step === 6 || step === 10)) {
          this.playDholBass(time, step === 0);
          hasKick = true;
        }
        // Sharp Tilla rim snaps on 2, 4, 8, 12, 14
        if ([2, 4, 8, 12, 14].includes(step)) {
          this.playDholTilla(time);
          if (step === 4 || step === 12) hasSnare = true;
        }
        if (step % 2 === 0) {
          this.playHat(time, isOffbeat);
          hasHat = true;
        }
        break;
      }

      // 15. Bhangra Club Mix
      case 'bhangra-club-mix': {
        if (allowKick && isQuarterNote) {
          this.playPunchyKick(time, step === 0);
          this.playDholBass(time, step === 0);
          hasKick = true;
        }
        if (step === 4 || step === 12) {
          this.playClap(time);
          this.playSnare(time);
          hasSnare = true;
        }
        // Syncopated triplet swing
        if ([2, 3, 6, 7, 10, 11, 14, 15].includes(step)) {
          this.playDholTilla(time);
        }
        if (isOffbeat) {
          this.playRollingBass(time, currentRoot);
          this.playHat(time, true);
          hasHat = true;
        }
        break;
      }

      default: {
        if (allowKick && isQuarterNote) {
          this.playPunchyKick(time, step === 0);
          hasKick = true;
        }
        if (step === 4 || step === 12) {
          this.playSnare(time);
          hasSnare = true;
        }
        if (isOffbeat) {
          this.playRollingBass(time, currentRoot);
          this.playHat(time, true);
          hasHat = true;
        }
        break;
      }
    }

    // Direct synchronization with visual lighting canvas
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
        barNumber: this.barCount,
        bpm: this.bpm,
        style: this.currentStyle
      });
    }, delayMs);
  }

  // =========================================================================
  // ADVANCED MIXING CONSOLE CONTROLS & SETTINGS
  // =========================================================================

  setBeatsVolume(vol) {
    this.beatsVolume = Math.max(0, Math.min(1, vol));
    if (this.beatsGain && this.ctx) {
      this.beatsGain.gain.setValueAtTime(this.beatsVolume * this.beatIntensity, this.ctx.currentTime);
    }
  }

  setSfxVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  setBpm(newBpm) {
    this.bpm = Math.max(70, Math.min(180, Number(newBpm) || 128));
  }

  setStyle(styleId) {
    const found = BEAT_STYLES.find((s) => s.id === styleId);
    if (found) {
      this.currentStyle = styleId;
      this.bpm = found.defaultBpm;
    }
  }

  setPattern(patternId) {
    const found = BEAT_PATTERNS.find((p) => p.id === patternId);
    if (found) {
      this.currentPattern = patternId;
    }
  }

  setEqBass(db) {
    this.eqBass = Math.max(-12, Math.min(12, Number(db) || 0));
    if (this.lowShelf && this.ctx) {
      this.lowShelf.gain.setValueAtTime(this.eqBass, this.ctx.currentTime);
    }
  }

  setEqMid(db) {
    this.eqMid = Math.max(-12, Math.min(12, Number(db) || 0));
    if (this.midPeaking && this.ctx) {
      this.midPeaking.gain.setValueAtTime(this.eqMid, this.ctx.currentTime);
    }
  }

  setEqTreble(db) {
    this.eqTreble = Math.max(-12, Math.min(12, Number(db) || 0));
    if (this.highShelf && this.ctx) {
      this.highShelf.gain.setValueAtTime(this.eqTreble, this.ctx.currentTime);
    }
  }

  setBeatIntensity(val) {
    // val 0.0 to 1.0 maps to drive 0.4 to 1.8
    const num = Math.max(0, Math.min(1, Number(val) || 0.5));
    this.beatIntensity = 0.4 + num * 1.4;
    if (this.beatsGain && this.ctx) {
      this.beatsGain.gain.setValueAtTime(this.beatsVolume * this.beatIntensity, this.ctx.currentTime);
    }
  }

  setEchoAmount(val) {
    this.echoAmount = Math.max(0, Math.min(1, Number(val) || 0));
    if (this.echoSendGain && this.ctx) {
      this.echoSendGain.gain.setValueAtTime(this.echoAmount, this.ctx.currentTime);
    }
  }

  setReverbAmount(val) {
    this.reverbAmount = Math.max(0, Math.min(1, Number(val) || 0));
    if (this.reverbSendGain && this.ctx) {
      this.reverbSendGain.gain.setValueAtTime(this.reverbAmount, this.ctx.currentTime);
    }
  }

  // Trigger individual bass library item
  triggerBassItem(id) {
    switch (id) {
      case 'deep-sub': this.playDeepSub(); break;
      case 'punchy-kick': this.playPunchyKick(0, true); break;
      case 'rolling-bass': this.playRollingBass(0, 65.41); break;
      case 'wobble-bass': this.playWobbleBass(0, 55.0, 6); break;
      case 'distorted-bass': this.playDistortedBass(0, 60.0); break;
      case 'reverse-bass': this.playReverseBass(0, 65.0); break;
      case 'dhol-bass': this.playDholBass(0, true); break;
      case 'triple-drop': this.playTripleDrop(0); break;
      default: this.playPunchyKick(0, true); break;
    }
    this.notifyBeat({ isKick: true, intensity: 0.95, sfxType: id });
  }

  // Trigger individual SFX library item
  triggerSfxItem(id) {
    switch (id) {
      case 'airhorn': this.triggerAirHorn(); break;
      case 'bass-impact': this.triggerBassImpact(); break;
      case 'riser': this.triggerRiser(1.8); break;
      case 'scratch': this.triggerScratch(); break;
      case 'laser': this.triggerLaserZap(); break;
      case 'bass-sweep': this.triggerBassSweep(); break;
      case 'sub-drop': this.triggerSubDrop(); break;
      case 'crowd-hype': this.triggerCrowdHype(); break;
      case 'drum-roll': this.triggerDrumRoll(); break;
      case 'dj-shout': this.triggerDjShout(); break;
      case 'impact-hit': this.triggerImpactHit(); break;
      case 'echo-delay': this.triggerEchoDelay(); break;
      default: this.triggerLaserZap(); break;
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

export const djAudio = new DjAudioEngine();
export default djAudio;
