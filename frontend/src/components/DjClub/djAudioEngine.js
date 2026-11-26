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

export const INSTRUMENT_CATEGORIES = [
  { id: 'all', name: 'All Instruments' },
  { id: 'guitars', name: 'Guitars & Plucked' },
  { id: 'keys', name: 'Keys & Pads' },
  { id: 'percussion', name: 'Drums & Percussion' },
  { id: 'winds', name: 'Winds & Brass' },
  { id: 'strings', name: 'Strings & Bowed' }
];

export const INSTRUMENT_LIBRARY = [
  // 1. Guitars & Plucked
  {
    id: 'acoustic-guitar',
    name: 'Acoustic Guitar',
    tag: 'Folk Strum',
    icon: '🎸',
    category: 'guitars',
    desc: 'Karplus-Strong physical string resonance with sparkling nylon pick strike'
  },
  {
    id: 'electric-guitar',
    name: 'Electric Guitar',
    tag: 'Clean Lead',
    icon: '🎸',
    category: 'guitars',
    desc: 'Boutique tube-driven guitar riff with warm overdrive and subtle vibrato'
  },
  {
    id: 'bassline-groove',
    name: 'Bass Guitar',
    tag: 'Electric Bass',
    icon: '🎸',
    category: 'guitars',
    desc: 'Punchy jazz-funk electric bass pluck with rich fundamental body'
  },
  {
    id: 'ukulele-plucked',
    name: 'Ukulele',
    tag: 'Hawaiian Pluck',
    icon: '🪕',
    category: 'guitars',
    desc: 'Light, bright cheerful nylon ukulele chord strum with crisp finger pluck'
  },
  {
    id: 'sitar-melodic',
    name: 'Sitar',
    tag: 'Indian Plucked',
    icon: '🪕',
    category: 'guitars',
    desc: 'Rich buzzing jawari bridge timbre with sympathetic drone string resonance'
  },
  {
    id: 'sarangi-bowed',
    name: 'Sarangi',
    tag: 'Indian Bowed',
    icon: '🎻',
    category: 'guitars',
    desc: 'Expressive vocal-like Indian bowed instrument with rich microtonal glides'
  },

  // 2. Keys & Pads
  {
    id: 'piano-grand',
    name: 'Grand Piano',
    tag: 'Concert Keys',
    icon: '🎹',
    category: 'keys',
    desc: 'Rich multi-harmonic acoustic concert piano chords with natural hammer release'
  },
  {
    id: 'electric-keys',
    name: 'Rhodes EP',
    tag: 'Vintage Keys',
    icon: '🎹',
    category: 'keys',
    desc: 'Warm electric Rhodes tine chime with lush stereophonic tremolo'
  },
  {
    id: 'harmonium-pump',
    name: 'Harmonium',
    tag: 'Indian Reed',
    icon: '🪗',
    category: 'keys',
    desc: 'Warm bellows-pumped acoustic brass reeds with rich vocal accompaniment tone'
  },
  {
    id: 'synth-lead',
    name: 'Synth Pad',
    tag: 'Analog Pad',
    icon: '🎛️',
    category: 'keys',
    desc: 'Lush analog detuned polysynth chord progression with soft filter sweep'
  },
  {
    id: 'organ-vintage',
    name: 'Tonewheel Organ',
    tag: 'B3 Drawbar',
    icon: '🎹',
    category: 'keys',
    desc: 'Classic rotary Leslie speaker organ chord with warm gospel/rock bite'
  },

  // 3. Drums & Percussion
  {
    id: 'acoustic-drums',
    name: 'Acoustic Drum Kit',
    tag: 'Live Kit',
    icon: '🥁',
    category: 'percussion',
    desc: 'Live acoustic wood snare rimshot, punchy kick and crisp bronze cymbals'
  },
  {
    id: 'tabla-bols',
    name: 'Tabla',
    tag: 'Indian Classical',
    icon: '🪘',
    category: 'percussion',
    desc: 'Authentic Dayan sharp rim ring tuned to Sa layered with deep resonant Bayan sweep'
  },
  {
    id: 'dholak-folk',
    name: 'Dholak',
    tag: 'Indian Folk',
    icon: '🪘',
    category: 'percussion',
    desc: 'Bouncy Indian folk drum with tight treble slap and warm wooden bass thump'
  },
  {
    id: 'congas-latin',
    name: 'Congas & Bongos',
    tag: 'Afro-Cuban',
    icon: '🪘',
    category: 'percussion',
    desc: 'Warm resonant open tone paired with sharp high-pitched palm heel slap'
  },
  {
    id: 'shaker-tambourine',
    name: 'Shaker / Tambourine',
    tag: 'Rhythm Shaker',
    icon: '🪇',
    category: 'percussion',
    desc: 'High-frequency rhythmic seed shaker and metallic tambourine jingle'
  },
  {
    id: 'hihat-ride',
    name: 'Hi-Hat / Ride Cymbal',
    tag: 'Bronze Cymbal',
    icon: '🥁',
    category: 'percussion',
    desc: 'Crisp metallic acoustic ride cymbal ping with shimmering sustain'
  },

  // 4. Winds & Brass
  {
    id: 'flute-melodic',
    name: 'Bansuri (Flute)',
    tag: 'Indian Bamboo',
    icon: '🪈',
    category: 'winds',
    desc: 'Breathy Indian bamboo flute melody with expressive vibrato and airy overtones'
  },
  {
    id: 'saxophone-smooth',
    name: 'Saxophone',
    tag: 'Warm Tenor',
    icon: '🎷',
    category: 'winds',
    desc: 'Soulful sultry tenor sax lick with reed buzz and warm vibrato swell'
  },
  {
    id: 'trumpet-solo',
    name: 'Trumpet',
    tag: 'Bright Solo',
    icon: '🎺',
    category: 'winds',
    desc: 'Punchy jazz-club trumpet stab with crisp metallic flare and fast attack'
  },
  {
    id: 'brass-section',
    name: 'Brass Section',
    tag: 'Horn Section',
    icon: '🎺',
    category: 'winds',
    desc: 'Bright funky trumpet, trombone, and sax section punch with crisp brass bite'
  },

  // 5. Strings & Bowed
  {
    id: 'violin-solo',
    name: 'Solo Violin',
    tag: 'Classical Bowed',
    icon: '🎻',
    category: 'strings',
    desc: 'Sweet singing acoustic violin melody with natural bow friction and warm vibrato'
  },
  {
    id: 'cello-deep',
    name: 'Cello',
    tag: 'Warm Low Bowed',
    icon: '🎻',
    category: 'strings',
    desc: 'Rich deep resonant cello sustain with woody body tone and gentle vibrato'
  },
  {
    id: 'string-ensemble',
    name: 'Orchestral Strings',
    tag: 'Full Ensemble',
    icon: '🎻',
    category: 'strings',
    desc: 'Lush orchestral violins and cellos with slow cinematic swell and stereo spread'
  }
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
    this.instrumentGain = null;

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

    // Solo & Mute States for Channel Submixes
    this.isBeatsMuted = false;
    this.isInstrumentsMuted = false;
    this.isSfxMuted = false;
    this.soloChannel = null; // null | 'beats' | 'instruments' | 'sfx'

    // Mixer Levels
    this.beatsVolume = 0.8;
    this.sfxVolume = 0.85;
    this.instrumentVolume = 0.8;
    this.eqBass = 0; // -12 to +12 dB
    this.eqMid = 0;
    this.eqTreble = 0;
    this.beatIntensity = 1.0; // 0.2 to 2.0
    this.echoAmount = 0.15; // 0 to 1
    this.reverbAmount = 0.2; // 0 to 1

    // Musical Instrument Layer Configuration
    this.instrumentChordProgressions = [
      // Standard club progressions in A minor / C major:
      // i - VI - III - VII (Am - F - C - G)
      [
        { name: 'Am', root: 220.0, freqs: [220.0, 261.63, 329.63, 440.0] },
        { name: 'F',  root: 174.61, freqs: [174.61, 220.0, 261.63, 349.23] },
        { name: 'C',  root: 130.81, freqs: [261.63, 329.63, 392.0, 523.25] },
        { name: 'G',  root: 196.0, freqs: [196.0, 246.94, 293.66, 392.0] }
      ]
    ];
    this.chordStep = 0;

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

    // Multi-Item Continuous Auto-Loop System
    this.activeLoops = new Map(); // id -> { id, type: 'bass'|'fx'|'instrument', interval: number, nextTriggerTime: number, lastTriggerTime: number, customInterval: boolean }
    this.globalBassInterval = 2.0; // 0.5 to 10s (default 2s)
    this.globalFxInterval = 4.0; // 1 to 15s (default 4s)
    this.globalInstrumentInterval = 2.0; // 0.5 to 8s (default 2s)
    this.loopSchedulerTimer = null;
    this.loopStateListeners = new Set();
    this.loopTriggerListeners = new Set();

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

      // Dedicated Musical Instrument Bus (routed through EQ so treble/mid/bass sculpting applies)
      this.instrumentGain = this.ctx.createGain();
      this.instrumentGain.gain.setValueAtTime(this.instrumentVolume, this.ctx.currentTime);
      this.instrumentGain.connect(this.lowShelf);

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
  // AUTHENTIC MUSICAL INSTRUMENTS SYNTHESIZER LIBRARY
  // =========================================================================

  /**
   * Helper to advance harmonic chord sequence for organic accompaniment
   */
  getNextChord() {
    const progression = this.instrumentChordProgressions[0];
    const chord = progression[this.chordStep % progression.length];
    this.chordStep = (this.chordStep + 1) % progression.length;
    return chord;
  }

  /**
   * 1. Concert Grand Piano
   * Additive synthesis with multi-harmonic partials, percussive hammer strike,
   * natural acoustic decay and soundboard resonance.
   */
  playConcertPiano(time = 0, chord = null) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const selectedChord = chord || this.getNextChord();
    const freqs = selectedChord.freqs;

    freqs.forEach((baseFreq, noteIdx) => {
      const noteDelay = noteIdx * 0.018; // Natural human strum/arpeggio feel
      const noteTime = t + noteDelay;

      // Partials (fundamental, octave, 5th, 2nd octave)
      const partials = [
        { mult: 1.0, gain: 0.28, decay: 1.8 },
        { mult: 2.0, gain: 0.14, decay: 1.2 },
        { mult: 3.0, gain: 0.07, decay: 0.8 },
        { mult: 4.0, gain: 0.03, decay: 0.5 }
      ];

      partials.forEach((p) => {
        const osc = this.ctx.createOscillator();
        const pGain = this.ctx.createGain();

        osc.type = p.mult === 1.0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(baseFreq * p.mult, noteTime);

        pGain.gain.setValueAtTime(0, noteTime);
        pGain.gain.linearRampToValueAtTime(p.gain * this.instrumentVolume, noteTime + 0.006);
        pGain.gain.exponentialRampToValueAtTime(p.gain * 0.6 * this.instrumentVolume, noteTime + 0.12);
        pGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + p.decay);

        osc.connect(pGain);
        pGain.connect(this.instrumentGain);
        if (this.reverbSendGain) pGain.connect(this.reverbSendGain);

        osc.start(noteTime);
        osc.stop(noteTime + p.decay + 0.02);
      });

      // Hammer mechanical acoustic transient
      if (noteIdx === 0 && this.noiseBuffer) {
        const hammer = this.ctx.createBufferSource();
        hammer.buffer = this.noiseBuffer;
        const hFilter = this.ctx.createBiquadFilter();
        hFilter.type = 'bandpass';
        hFilter.frequency.setValueAtTime(1600, noteTime);
        hFilter.Q.setValueAtTime(3.0, noteTime);

        const hGain = this.ctx.createGain();
        hGain.gain.setValueAtTime(0.08, noteTime);
        hGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.035);

        hammer.connect(hFilter);
        hFilter.connect(hGain);
        hGain.connect(this.instrumentGain);

        hammer.start(noteTime);
        hammer.stop(noteTime + 0.04);
      }
    });

    this.notifyBeat({ isInstrument: true, intensity: 0.65, sfxType: 'piano' });
  }

  /**
   * 2. Rhodes Electric Piano
   * FM chime bell timbre with mellow stereo tremolo
   */
  playRhodesEP(time = 0, chord = null) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const selectedChord = chord || this.getNextChord();
    const freqs = selectedChord.freqs;

    freqs.forEach((freq, idx) => {
      const noteTime = t + idx * 0.015;

      // Carrier: Sine
      const carrier = this.ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(freq, noteTime);

      // Modulator: Sine tuned to 4x frequency for Rhodes metallic chime
      const modulator = this.ctx.createOscillator();
      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(freq * 3.99, noteTime);

      const modGain = this.ctx.createGain();
      modGain.gain.setValueAtTime(freq * 1.8, noteTime);
      modGain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.4);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      // Tremolo LFO
      const tremolo = this.ctx.createOscillator();
      tremolo.type = 'sine';
      tremolo.frequency.setValueAtTime(4.5, noteTime);

      const tremoloGain = this.ctx.createGain();
      tremoloGain.gain.setValueAtTime(0.2, noteTime);

      const noteGain = this.ctx.createGain();
      noteGain.gain.setValueAtTime(0, noteTime);
      noteGain.gain.linearRampToValueAtTime(0.22 * this.instrumentVolume, noteTime + 0.01);
      noteGain.gain.exponentialRampToValueAtTime(0.12 * this.instrumentVolume, noteTime + 0.4);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 1.6);

      carrier.connect(noteGain);
      noteGain.connect(this.instrumentGain);
      if (this.echoSendGain) noteGain.connect(this.echoSendGain);
      if (this.reverbSendGain) noteGain.connect(this.reverbSendGain);

      carrier.start(noteTime);
      modulator.start(noteTime);
      carrier.stop(noteTime + 1.65);
      modulator.stop(noteTime + 1.65);
    });

    this.notifyBeat({ isInstrument: true, intensity: 0.6, sfxType: 'rhodes' });
  }

  /**
   * 3. Acoustic Guitar
   * Karplus-Strong physical plucked string model with pick noise & body resonance
   */
  playAcousticGuitar(time = 0, chord = null) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const selectedChord = chord || this.getNextChord();
    const freqs = selectedChord.freqs;

    freqs.forEach((freq, stringIdx) => {
      const pickTime = t + stringIdx * 0.024; // Downward acoustic strum spread
      const sampleRate = this.ctx.sampleRate || 44100;
      const periodSamples = Math.round(sampleRate / freq);
      if (periodSamples <= 0) return;

      // Noise burst for guitar pick strike
      const noiseBuffer = this.ctx.createBuffer(1, periodSamples, sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < periodSamples; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (periodSamples * 0.3));
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      // Acoustic string delay line with feedback (Karplus-Strong)
      const delay = this.ctx.createDelay(1.0);
      delay.delayTime.setValueAtTime(1 / freq, pickTime);

      const feedback = this.ctx.createGain();
      feedback.gain.setValueAtTime(0.975, pickTime);

      // Lowpass filter simulates string damping over time
      const damping = this.ctx.createBiquadFilter();
      damping.type = 'lowpass';
      damping.frequency.setValueAtTime(Math.min(8000, freq * 5), pickTime);

      // Body acoustic cavity resonance filter
      const bodyFilter = this.ctx.createBiquadFilter();
      bodyFilter.type = 'peaking';
      bodyFilter.frequency.setValueAtTime(210, pickTime); // Guitar wood resonance
      bodyFilter.Q.setValueAtTime(2.5, pickTime);
      bodyFilter.gain.setValueAtTime(4.0, pickTime);

      const envGain = this.ctx.createGain();
      envGain.gain.setValueAtTime(0.32 * this.instrumentVolume, pickTime);
      envGain.gain.exponentialRampToValueAtTime(0.0001, pickTime + 1.4);

      // Connect Karplus loop: Noise -> Delay -> Damping -> Feedback -> Delay
      noiseSource.connect(delay);
      delay.connect(damping);
      damping.connect(feedback);
      feedback.connect(delay);

      damping.connect(bodyFilter);
      bodyFilter.connect(envGain);
      envGain.connect(this.instrumentGain);
      if (this.reverbSendGain) envGain.connect(this.reverbSendGain);

      noiseSource.start(pickTime);
      noiseSource.stop(pickTime + (periodSamples / sampleRate));

      setTimeout(() => {
        try {
          delay.disconnect();
          damping.disconnect();
          feedback.disconnect();
        } catch (_) {}
      }, 1500);
    });

    this.notifyBeat({ isInstrument: true, intensity: 0.65, sfxType: 'guitar' });
  }

  /**
   * 4. Electric Guitar Riff
   * Overdriven tube-style guitar chord with subtle vibrato
   */
  playElectricGuitar(time = 0, chord = null) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const selectedChord = chord || this.getNextChord();
    const freqs = selectedChord.freqs.slice(0, 3); // 3-note power chord

    freqs.forEach((freq, idx) => {
      const noteTime = t + idx * 0.012;

      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, noteTime);

      // Subtle pitch vibrato
      const vibrato = this.ctx.createOscillator();
      vibrato.frequency.setValueAtTime(5.2, noteTime);
      const vibGain = this.ctx.createGain();
      vibGain.gain.setValueAtTime(freq * 0.015, noteTime);
      vibrato.connect(vibGain);
      vibGain.connect(osc.frequency);

      // Tube preamp distortion shaper
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = this.makeDistortionCurve(18);

      // Guitar cabinet speaker simulation filter (cuts harsh highs & muddy lows)
      const cabFilter = this.ctx.createBiquadFilter();
      cabFilter.type = 'bandpass';
      cabFilter.frequency.setValueAtTime(1400, noteTime);
      cabFilter.Q.setValueAtTime(1.2, noteTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.24 * this.instrumentVolume, noteTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.14 * this.instrumentVolume, noteTime + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 1.2);

      osc.connect(shaper);
      shaper.connect(cabFilter);
      cabFilter.connect(gain);
      gain.connect(this.instrumentGain);

      if (this.echoSendGain) gain.connect(this.echoSendGain);
      if (this.reverbSendGain) gain.connect(this.reverbSendGain);

      osc.start(noteTime);
      vibrato.start(noteTime);
      osc.stop(noteTime + 1.25);
      vibrato.stop(noteTime + 1.25);
    });

    this.notifyBeat({ isInstrument: true, intensity: 0.75, sfxType: 'electric-guitar' });
  }

  /**
   * 5. Warm Electric Bassline
   * Punchy jazz/funk fingerstyle bass with round woody tone
   */
  playWarmBassline(time = 0, root = null) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const selectedChord = this.getNextChord();
    const freq = root || selectedChord.root * 0.5; // Sub-octave fundamental

    // Primary fundamental: Triangle for warm round body
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    // Harmonic bite: Lowpass-filtered square
    const oscHarmonic = this.ctx.createOscillator();
    oscHarmonic.type = 'sawtooth';
    oscHarmonic.frequency.setValueAtTime(freq, t);

    const bassFilter = this.ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(420, t);
    bassFilter.frequency.exponentialRampToValueAtTime(180, t + 0.25);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55 * this.instrumentVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.3 * this.instrumentVolume, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

    osc.connect(gain);
    oscHarmonic.connect(bassFilter);
    bassFilter.connect(gain);
    gain.connect(this.instrumentGain);

    osc.start(t);
    oscHarmonic.start(t);
    osc.stop(t + 0.95);
    oscHarmonic.stop(t + 0.95);

    this.notifyBeat({ isKick: true, isInstrument: true, intensity: 0.8, sfxType: 'warm-bass' });
  }

  /**
   * 6. Bansuri / Melodic Indian Bamboo Flute
   * Breathy acoustic flute with natural vibrato and airy overblown harmonics
   */
  playBansuriFlute(time = 0) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const melodyNotes = [587.33, 659.25, 783.99, 880.0]; // D5, E5, G5, A5 pentatonic
    const freq = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
    const duration = 0.9;

    // Core breathy flute oscillator (Triangle + Sine)
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq * 1.02, t + duration * 0.4);
    osc.frequency.linearRampToValueAtTime(freq, t + duration);

    // Expressive pitch vibrato
    const vibrato = this.ctx.createOscillator();
    vibrato.frequency.setValueAtTime(5.8, t);
    const vibGain = this.ctx.createGain();
    vibGain.gain.setValueAtTime(freq * 0.018, t);
    vibrato.connect(vibGain);
    vibGain.connect(osc.frequency);

    // Chiff breath noise
    let noiseSource = null;
    let nGain = null;
    if (this.noiseBuffer) {
      noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;
      const nFilter = this.ctx.createBiquadFilter();
      nFilter.type = 'bandpass';
      nFilter.frequency.setValueAtTime(freq * 2.2, t);
      nFilter.Q.setValueAtTime(3.5, t);

      nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.06 * this.instrumentVolume, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      noiseSource.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(this.instrumentGain);
      noiseSource.start(t);
      noiseSource.stop(t + 0.25);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.28 * this.instrumentVolume, t + 0.08); // Soft breath attack
    gain.gain.exponentialRampToValueAtTime(0.2 * this.instrumentVolume, t + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(this.instrumentGain);
    if (this.reverbSendGain) gain.connect(this.reverbSendGain);
    if (this.echoSendGain) gain.connect(this.echoSendGain);

    osc.start(t);
    vibrato.start(t);
    osc.stop(t + duration + 0.05);
    vibrato.stop(t + duration + 0.05);

    this.notifyBeat({ isInstrument: true, intensity: 0.6, sfxType: 'flute' });
  }

  /**
   * 7. Orchestral String Ensemble
   * Warm cinematic violins and cellos with lush swell
   */
  playStringEnsemble(time = 0, chord = null) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const selectedChord = chord || this.getNextChord();
    const freqs = selectedChord.freqs;
    const duration = 1.8;

    freqs.forEach((freq, idx) => {
      // Detuned twin sawtooth oscillators for lush orchestral chorus
      [-4, 4].forEach((cents) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * Math.pow(2, cents / 1200), t);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12 * this.instrumentVolume, t + 0.25); // Gentle bowing swell
        gain.gain.setValueAtTime(0.1 * this.instrumentVolume, t + duration * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.instrumentGain);
        if (this.reverbSendGain) gain.connect(this.reverbSendGain);

        osc.start(t);
        osc.stop(t + duration + 0.05);
      });
    });

    this.notifyBeat({ isInstrument: true, intensity: 0.7, sfxType: 'strings' });
  }

  /**
   * 8. Club Horns & Brass Section
   * Staccato funky horn hit with bright trumpet sizzle
   */
  playClubBrass(time = 0, chord = null) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const selectedChord = chord || this.getNextChord();
    const freqs = selectedChord.freqs.slice(0, 3);
    const duration = 0.45;

    freqs.forEach((freq) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      // Brass envelope: sharp filter bite that decays fast
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3600, t);
      filter.frequency.exponentialRampToValueAtTime(800, t + duration);
      filter.Q.setValueAtTime(3.2, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.26 * this.instrumentVolume, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.14 * this.instrumentVolume, t + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.instrumentGain);
      if (this.reverbSendGain) gain.connect(this.reverbSendGain);

      osc.start(t);
      osc.stop(t + duration + 0.02);
    });

    this.notifyBeat({ isSnare: true, isInstrument: true, intensity: 0.85, sfxType: 'brass' });
  }

  /**
   * 9. Live Acoustic Drums
   * Acoustic wood snare rimshot + punchy acoustic kick + bronze crash
   */
  playLiveAcousticDrums(time = 0) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    // Warm wooden acoustic kick
    const kickOsc = this.ctx.createOscillator();
    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(110, t);
    kickOsc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

    const kickGain = this.ctx.createGain();
    kickGain.gain.setValueAtTime(0.8 * this.instrumentVolume, t);
    kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    kickOsc.connect(kickGain);
    kickGain.connect(this.instrumentGain);
    kickOsc.start(t);
    kickOsc.stop(t + 0.36);

    // Acoustic wooden snare crack
    const snareTime = t + 0.24;
    const snareOsc = this.ctx.createOscillator();
    snareOsc.type = 'triangle';
    snareOsc.frequency.setValueAtTime(190, snareTime);
    snareOsc.frequency.exponentialRampToValueAtTime(95, snareTime + 0.08);

    const snareGain = this.ctx.createGain();
    snareGain.gain.setValueAtTime(0.6 * this.instrumentVolume, snareTime);
    snareGain.gain.exponentialRampToValueAtTime(0.001, snareTime + 0.18);

    snareOsc.connect(snareGain);
    snareGain.connect(this.instrumentGain);
    snareOsc.start(snareTime);
    snareOsc.stop(snareTime + 0.19);

    if (this.noiseBuffer) {
      const snareNoise = this.ctx.createBufferSource();
      snareNoise.buffer = this.noiseBuffer;
      const nFilter = this.ctx.createBiquadFilter();
      nFilter.type = 'highpass';
      nFilter.frequency.setValueAtTime(1800, snareTime);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.4 * this.instrumentVolume, snareTime);
      nGain.gain.exponentialRampToValueAtTime(0.001, snareTime + 0.22);

      snareNoise.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(this.instrumentGain);
      if (this.reverbSendGain) nGain.connect(this.reverbSendGain);

      snareNoise.start(snareTime);
      snareNoise.stop(snareTime + 0.24);
    }

    this.notifyBeat({ isKick: true, isSnare: true, isInstrument: true, intensity: 0.9, sfxType: 'acoustic-drums' });
  }

  /**
   * 10. Warm Analog Poly Synth
   * Multi-voice analog supersaw synth chords
   */
  playAnalogPolySynth(time = 0, chord = null) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const selectedChord = chord || this.getNextChord();
    const freqs = selectedChord.freqs;
    const duration = 1.2;

    freqs.forEach((freq) => {
      [-6, 0, 6].forEach((cents) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * Math.pow(2, cents / 1200), t);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, t);
        filter.frequency.exponentialRampToValueAtTime(700, t + duration * 0.8);
        filter.Q.setValueAtTime(2.5, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12 * this.instrumentVolume, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.06 * this.instrumentVolume, t + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.instrumentGain);
        if (this.reverbSendGain) gain.connect(this.reverbSendGain);
        if (this.echoSendGain) gain.connect(this.echoSendGain);

        osc.start(t);
        osc.stop(t + duration + 0.05);
      });
    });

    this.notifyBeat({ isInstrument: true, intensity: 0.75, sfxType: 'synth' });
  }

  /**
   * 11. Ukulele
   * Light cheerful nylon strings with high pitch ring and fast finger strum
   */
  playUkulele(time = 0, chord = null) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const selectedChord = chord || this.getNextChord();
    // High-pitched G4-C4-E4-A4 re-entrant tuning feel
    const freqs = selectedChord.freqs.map((f) => f * 1.5);

    freqs.forEach((freq, stringIdx) => {
      const pickTime = t + stringIdx * 0.016;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, pickTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(Math.min(6000, freq * 3.5), pickTime);
      filter.Q.setValueAtTime(2.0, pickTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.24 * this.instrumentVolume, pickTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, pickTime + 0.65);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.instrumentGain);
      if (this.reverbSendGain) gain.connect(this.reverbSendGain);

      osc.start(pickTime);
      osc.stop(pickTime + 0.7);
    });

    this.notifyBeat({ isInstrument: true, intensity: 0.6, sfxType: 'ukulele' });
  }

  /**
   * 12. Indian Sitar
   * Buzzing Jawari flat bridge harmonic resonance with meend microtonal bending
   */
  playSitar(time = 0) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const sitarNotes = [293.66, 329.63, 392.0, 440.0, 523.25]; // D4, E4, G4, A4, C5 (Raga Kafi / Bhupali notes)
    const baseFreq = sitarNotes[Math.floor(Math.random() * sitarNotes.length)];
    const duration = 1.6;

    // Main plucked Chikari / Baaj string
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq, t);
    // Characteristic Indian Meend pitch glide
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.08, t + 0.25);
    osc.frequency.linearRampToValueAtTime(baseFreq, t + 0.6);

    // Jawari bridge buzzy comb / high-harmonic formant filter
    const jawariFilter = this.ctx.createBiquadFilter();
    jawariFilter.type = 'peaking';
    jawariFilter.frequency.setValueAtTime(1450, t);
    jawariFilter.Q.setValueAtTime(6.0, t);
    jawariFilter.gain.setValueAtTime(12.0, t);

    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(5000, t);
    lpf.frequency.exponentialRampToValueAtTime(1200, t + duration * 0.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35 * this.instrumentVolume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.18 * this.instrumentVolume, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    // Sympathetic Tarab drone resonance
    const drone = this.ctx.createOscillator();
    drone.type = 'triangle';
    drone.frequency.setValueAtTime(baseFreq * 0.5, t);
    const droneGain = this.ctx.createGain();
    droneGain.gain.setValueAtTime(0.12 * this.instrumentVolume, t);
    droneGain.gain.exponentialRampToValueAtTime(0.0001, t + duration * 1.2);

    osc.connect(jawariFilter);
    jawariFilter.connect(lpf);
    lpf.connect(gain);
    gain.connect(this.instrumentGain);

    drone.connect(droneGain);
    droneGain.connect(this.instrumentGain);

    if (this.reverbSendGain) {
      gain.connect(this.reverbSendGain);
      droneGain.connect(this.reverbSendGain);
    }
    if (this.echoSendGain) gain.connect(this.echoSendGain);

    osc.start(t);
    drone.start(t);
    osc.stop(t + duration + 0.05);
    drone.stop(t + duration * 1.2 + 0.05);

    this.notifyBeat({ isInstrument: true, intensity: 0.7, sfxType: 'sitar' });
  }

  /**
   * 13. Sarangi (Indian Bowed Instrument)
   * Expressive microtonal bowed timbre with rich vocal inflection
   */
  playSarangi(time = 0) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const notes = [220.0, 246.94, 277.18, 329.63, 370.0];
    const freq = notes[Math.floor(Math.random() * notes.length)];
    const duration = 1.4;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 0.96, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.18); // Glissando bow glide
    osc.frequency.linearRampToValueAtTime(freq * 1.03, t + 0.7);
    osc.frequency.linearRampToValueAtTime(freq, t + duration);

    // Bow vibrato
    const vibrato = this.ctx.createOscillator();
    vibrato.frequency.setValueAtTime(5.4, t);
    const vibGain = this.ctx.createGain();
    vibGain.gain.setValueAtTime(freq * 0.02, t);
    vibrato.connect(vibGain);
    vibGain.connect(osc.frequency);

    const bodyFilter = this.ctx.createBiquadFilter();
    bodyFilter.type = 'bandpass';
    bodyFilter.frequency.setValueAtTime(1100, t);
    bodyFilter.Q.setValueAtTime(3.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.28 * this.instrumentVolume, t + 0.12);
    gain.gain.setValueAtTime(0.22 * this.instrumentVolume, t + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(bodyFilter);
    bodyFilter.connect(gain);
    gain.connect(this.instrumentGain);
    if (this.reverbSendGain) gain.connect(this.reverbSendGain);
    if (this.echoSendGain) gain.connect(this.echoSendGain);

    osc.start(t);
    vibrato.start(t);
    osc.stop(t + duration + 0.05);
    vibrato.stop(t + duration + 0.05);

    this.notifyBeat({ isInstrument: true, intensity: 0.65, sfxType: 'sarangi' });
  }

  /**
   * 14. Indian Harmonium
   * Bellows-pumped brass reed acoustic accordion tone
   */
  playHarmonium(time = 0, chord = null) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const selectedChord = chord || this.getNextChord();
    const freqs = selectedChord.freqs;
    const duration = 1.3;

    freqs.forEach((freq) => {
      // Free brass reed produces rich square-saw hybrid harmonics
      const reed1 = this.ctx.createOscillator();
      reed1.type = 'sawtooth';
      reed1.frequency.setValueAtTime(freq, t);

      const reed2 = this.ctx.createOscillator();
      reed2.type = 'square';
      reed2.frequency.setValueAtTime(freq * 1.002, t); // Slight acoustic detuning of double reeds

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1850, t);
      filter.Q.setValueAtTime(1.8, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      // Bellows pressure swell
      gain.gain.linearRampToValueAtTime(0.12 * this.instrumentVolume, t + 0.08);
      gain.gain.setValueAtTime(0.1 * this.instrumentVolume, t + duration * 0.75);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      reed1.connect(filter);
      reed2.connect(filter);
      filter.connect(gain);
      gain.connect(this.instrumentGain);
      if (this.reverbSendGain) gain.connect(this.reverbSendGain);

      reed1.start(t);
      reed2.start(t);
      reed1.stop(t + duration + 0.05);
      reed2.stop(t + duration + 0.05);
    });

    this.notifyBeat({ isInstrument: true, intensity: 0.65, sfxType: 'harmonium' });
  }

  /**
   * 15. Tonewheel Organ (B3 Drawbars)
   * Warm rotary drawbar organ chord with vintage gospel/funk bite
   */
  playTonewheelOrgan(time = 0, chord = null) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const selectedChord = chord || this.getNextChord();
    const freqs = selectedChord.freqs;
    const duration = 1.1;

    freqs.forEach((freq) => {
      // Drawbar footages: Fundamental, Octave, 12th, 15th
      [1.0, 2.0, 3.0].forEach((mult, mIdx) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * mult, t);

        // Fast Leslie speaker chorus modulation
        const leslie = this.ctx.createOscillator();
        leslie.frequency.setValueAtTime(6.2, t);
        const lGain = this.ctx.createGain();
        lGain.gain.setValueAtTime(freq * 0.008, t);
        leslie.connect(lGain);
        lGain.connect(osc.frequency);

        const gain = this.ctx.createGain();
        const baseAmp = mIdx === 0 ? 0.16 : mIdx === 1 ? 0.09 : 0.04;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(baseAmp * this.instrumentVolume, t + 0.015);
        gain.gain.setValueAtTime(baseAmp * 0.8 * this.instrumentVolume, t + duration * 0.8);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

        osc.connect(gain);
        gain.connect(this.instrumentGain);
        if (this.reverbSendGain) gain.connect(this.reverbSendGain);

        osc.start(t);
        leslie.start(t);
        osc.stop(t + duration + 0.05);
        leslie.stop(t + duration + 0.05);
      });
    });

    this.notifyBeat({ isInstrument: true, intensity: 0.7, sfxType: 'organ' });
  }

  /**
   * 16. Indian Classical Tabla (Dayan + Bayan)
   * Crisp resonant Dayan "Na/Tin" ring paired with deep pitch-modulating Bayan "Ghe"
   */
  playTabla(time = 0) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    // 1. Dayan (Treble drum tuned to Sa - D4 / ~293.66Hz)
    const dayanOsc = this.ctx.createOscillator();
    dayanOsc.type = 'sine';
    dayanOsc.frequency.setValueAtTime(293.66, t);
    dayanOsc.frequency.exponentialRampToValueAtTime(290.0, t + 0.18);

    const dayanFilter = this.ctx.createBiquadFilter();
    dayanFilter.type = 'bandpass';
    dayanFilter.frequency.setValueAtTime(587.33, t); // Metallic Shyahi bell overtone
    dayanFilter.Q.setValueAtTime(7.0, t);

    const dayanGain = this.ctx.createGain();
    dayanGain.gain.setValueAtTime(0.65 * this.instrumentVolume, t);
    dayanGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    dayanOsc.connect(dayanFilter);
    dayanFilter.connect(dayanGain);
    dayanGain.connect(this.instrumentGain);
    dayanOsc.start(t);
    dayanOsc.stop(t + 0.3);

    // 2. Bayan (Bass drum with heel pitch glide)
    const bayanOsc = this.ctx.createOscillator();
    bayanOsc.type = 'sine';
    bayanOsc.frequency.setValueAtTime(80, t);
    // Classical Bayan sliding modulation
    bayanOsc.frequency.exponentialRampToValueAtTime(125, t + 0.08);
    bayanOsc.frequency.exponentialRampToValueAtTime(62, t + 0.35);

    const bayanGain = this.ctx.createGain();
    bayanGain.gain.setValueAtTime(0.75 * this.instrumentVolume, t);
    bayanGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    bayanOsc.connect(bayanGain);
    bayanGain.connect(this.instrumentGain);
    bayanOsc.start(t);
    bayanOsc.stop(t + 0.42);

    this.notifyBeat({ isKick: true, isInstrument: true, intensity: 0.85, sfxType: 'tabla' });
  }

  /**
   * 17. Indian Folk Dholak
   * Warm wooden folk drum with bouncy bass thump and sharp treble slap
   */
  playDholak(time = 0) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    // Bass head
    const bassOsc = this.ctx.createOscillator();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(95, t);
    bassOsc.frequency.exponentialRampToValueAtTime(52, t + 0.22);

    const bassGain = this.ctx.createGain();
    bassGain.gain.setValueAtTime(0.7 * this.instrumentVolume, t);
    bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    bassOsc.connect(bassGain);
    bassGain.connect(this.instrumentGain);
    bassOsc.start(t);
    bassOsc.stop(t + 0.33);

    // Treble slap (sharp rim click)
    const trebleTime = t + 0.12;
    const trebleOsc = this.ctx.createOscillator();
    trebleOsc.type = 'triangle';
    trebleOsc.frequency.setValueAtTime(620, trebleTime);
    trebleOsc.frequency.exponentialRampToValueAtTime(240, trebleTime + 0.04);

    const trebleGain = this.ctx.createGain();
    trebleGain.gain.setValueAtTime(0.55 * this.instrumentVolume, trebleTime);
    trebleGain.gain.exponentialRampToValueAtTime(0.001, trebleTime + 0.06);

    trebleOsc.connect(trebleGain);
    trebleGain.connect(this.instrumentGain);
    trebleOsc.start(trebleTime);
    trebleOsc.stop(trebleTime + 0.07);

    this.notifyBeat({ isKick: true, isInstrument: true, intensity: 0.8, sfxType: 'dholak' });
  }

  /**
   * 18. Congas & Bongos
   * Warm resonant open tone and sharp high-pitched palm heel slap
   */
  playCongas(time = 0) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    // Open conga tone (approx 210 Hz)
    const congaOsc = this.ctx.createOscillator();
    congaOsc.type = 'sine';
    congaOsc.frequency.setValueAtTime(220, t);
    congaOsc.frequency.exponentialRampToValueAtTime(175, t + 0.12);

    const congaGain = this.ctx.createGain();
    congaGain.gain.setValueAtTime(0.65 * this.instrumentVolume, t);
    congaGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    congaOsc.connect(congaGain);
    congaGain.connect(this.instrumentGain);
    congaOsc.start(t);
    congaOsc.stop(t + 0.26);

    // High bongo slap on syncopated 16th
    const bongoTime = t + 0.16;
    const bongoOsc = this.ctx.createOscillator();
    bongoOsc.type = 'triangle';
    bongoOsc.frequency.setValueAtTime(480, bongoTime);
    bongoOsc.frequency.exponentialRampToValueAtTime(290, bongoTime + 0.05);

    const bongoGain = this.ctx.createGain();
    bongoGain.gain.setValueAtTime(0.5 * this.instrumentVolume, bongoTime);
    bongoGain.gain.exponentialRampToValueAtTime(0.001, bongoTime + 0.08);

    bongoOsc.connect(bongoGain);
    bongoGain.connect(this.instrumentGain);
    bongoOsc.start(bongoTime);
    bongoOsc.stop(bongoTime + 0.09);

    this.notifyBeat({ isInstrument: true, intensity: 0.75, sfxType: 'congas' });
  }

  /**
   * 19. Shaker / Tambourine
   * High-frequency seed shaker rattle with metallic jingle strike
   */
  playShakerTambourine(time = 0) {
    if (!this.ensureContext()) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    if (!this.noiseBuffer) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    // 2-stroke shaker forward/back pattern
    [0, 0.1].forEach((offset, idx) => {
      const shakeTime = t + offset;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(idx === 0 ? 6800 : 8200, shakeTime);
      filter.Q.setValueAtTime(2.2, shakeTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime((idx === 0 ? 0.25 : 0.38) * this.instrumentVolume, shakeTime);
      gain.gain.exponentialRampToValueAtTime(0.001, shakeTime + 0.06);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.instrumentGain);

      noise.start(shakeTime);
      noise.stop(shakeTime + 0.07);
    });

    // Tambourine jingle ping
    const jingleOsc = this.ctx.createOscillator();
    jingleOsc.type = 'triangle';
    jingleOsc.frequency.setValueAtTime(5400, t + 0.1);

    const jGain = this.ctx.createGain();
    jGain.gain.setValueAtTime(0.18 * this.instrumentVolume, t + 0.1);
    jGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    jingleOsc.connect(jGain);
    jGain.connect(this.instrumentGain);
    jingleOsc.start(t + 0.1);
    jingleOsc.stop(t + 0.24);

    this.notifyBeat({ isInstrument: true, intensity: 0.5, sfxType: 'shaker' });
  }

  /**
   * 20. Hi-Hat / Ride Cymbal
   * Shimmering metallic acoustic ride ping with rich sustained wash
   */
  playHiHatRide(time = 0) {
    if (!this.ensureContext()) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    if (!this.noiseBuffer) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);

    // Ride bell harmonic ping
    [3200, 4800, 6100].forEach((freq) => {
      const bell = this.ctx.createOscillator();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(freq, t);

      const bGain = this.ctx.createGain();
      bGain.gain.setValueAtTime(0.08 * this.instrumentVolume, t);
      bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      bell.connect(bGain);
      bGain.connect(this.instrumentGain);
      bell.start(t);
      bell.stop(t + 0.46);
    });

    // Bronze cymbal wash
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28 * this.instrumentVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.instrumentGain);
    if (this.reverbSendGain) gain.connect(this.reverbSendGain);

    noise.start(t);
    noise.stop(t + 0.7);

    this.notifyBeat({ isHat: true, isInstrument: true, intensity: 0.6, sfxType: 'ride' });
  }

  /**
   * 21. Tenor Saxophone
   * Warm soulful jazz tenor sax lick with reed buzz and natural vibrato
   */
  playSaxophone(time = 0) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const notes = [311.13, 349.23, 415.30, 466.16]; // Eb4, F4, Ab4, Bb4 jazz blues notes
    const freq = notes[Math.floor(Math.random() * notes.length)];
    const duration = 1.1;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 0.98, t);
    osc.frequency.linearRampToValueAtTime(freq, t + 0.08); // Pitch scoop
    osc.frequency.linearRampToValueAtTime(freq * 1.015, t + duration * 0.6);
    osc.frequency.linearRampToValueAtTime(freq, t + duration);

    // Vibrato LFO
    const vibrato = this.ctx.createOscillator();
    vibrato.frequency.setValueAtTime(5.5, t);
    const vibGain = this.ctx.createGain();
    vibGain.gain.setValueAtTime(freq * 0.02, t);
    vibrato.connect(vibGain);
    vibGain.connect(osc.frequency);

    // Saxophone body/horn formant resonance
    const formant = this.ctx.createBiquadFilter();
    formant.type = 'peaking';
    formant.frequency.setValueAtTime(1100, t);
    formant.Q.setValueAtTime(2.8, t);
    formant.gain.setValueAtTime(6.0, t);

    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(2800, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.32 * this.instrumentVolume, t + 0.06);
    gain.gain.setValueAtTime(0.24 * this.instrumentVolume, t + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(formant);
    formant.connect(lpf);
    lpf.connect(gain);
    gain.connect(this.instrumentGain);
    if (this.reverbSendGain) gain.connect(this.reverbSendGain);
    if (this.echoSendGain) gain.connect(this.echoSendGain);

    osc.start(t);
    vibrato.start(t);
    osc.stop(t + duration + 0.05);
    vibrato.stop(t + duration + 0.05);

    this.notifyBeat({ isInstrument: true, intensity: 0.75, sfxType: 'sax' });
  }

  /**
   * 22. Bright Solo Trumpet
   * Punchy jazz trumpet stab with bright metallic flare
   */
  playTrumpet(time = 0) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const notes = [466.16, 523.25, 587.33, 698.46]; // Bb4, C5, D5, F5
    const freq = notes[Math.floor(Math.random() * notes.length)];
    const duration = 0.65;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4800, t);
    filter.frequency.exponentialRampToValueAtTime(1600, t + duration);
    filter.Q.setValueAtTime(3.5, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35 * this.instrumentVolume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.18 * this.instrumentVolume, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.instrumentGain);
    if (this.reverbSendGain) gain.connect(this.reverbSendGain);

    osc.start(t);
    osc.stop(t + duration + 0.02);

    this.notifyBeat({ isSnare: true, isInstrument: true, intensity: 0.85, sfxType: 'trumpet' });
  }

  /**
   * 23. Solo Violin
   * Sweet singing acoustic violin melody with natural bow friction and warm vibrato
   */
  playViolin(time = 0) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const notes = [440.0, 493.88, 523.25, 659.25, 783.99]; // A4, B4, C5, E5, G5
    const freq = notes[Math.floor(Math.random() * notes.length)];
    const duration = 1.3;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    // Warm natural bow vibrato
    const vibrato = this.ctx.createOscillator();
    vibrato.frequency.setValueAtTime(6.0, t);
    const vibGain = this.ctx.createGain();
    vibGain.gain.setValueAtTime(freq * 0.018, t);
    vibrato.connect(vibGain);
    vibGain.connect(osc.frequency);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.24 * this.instrumentVolume, t + 0.1);
    gain.gain.setValueAtTime(0.18 * this.instrumentVolume, t + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.instrumentGain);
    if (this.reverbSendGain) gain.connect(this.reverbSendGain);

    osc.start(t);
    vibrato.start(t);
    osc.stop(t + duration + 0.05);
    vibrato.stop(t + duration + 0.05);

    this.notifyBeat({ isInstrument: true, intensity: 0.65, sfxType: 'violin' });
  }

  /**
   * 24. Deep Cello
   * Rich deep resonant cello sustain with woody body tone and gentle vibrato
   */
  playCello(time = 0) {
    if (!this.ensureContext()) return;
    const t = Math.max(time, this.ctx.currentTime + 0.005);
    const notes = [130.81, 146.83, 164.81, 196.0, 220.0]; // C3, D3, E3, G3, A3
    const freq = notes[Math.floor(Math.random() * notes.length)];
    const duration = 1.6;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    const vibrato = this.ctx.createOscillator();
    vibrato.frequency.setValueAtTime(4.8, t);
    const vibGain = this.ctx.createGain();
    vibGain.gain.setValueAtTime(freq * 0.012, t);
    vibrato.connect(vibGain);
    vibGain.connect(osc.frequency);

    const bodyFilter = this.ctx.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.setValueAtTime(950, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3 * this.instrumentVolume, t + 0.16);
    gain.gain.setValueAtTime(0.22 * this.instrumentVolume, t + duration * 0.75);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(bodyFilter);
    bodyFilter.connect(gain);
    gain.connect(this.instrumentGain);
    if (this.reverbSendGain) gain.connect(this.reverbSendGain);

    osc.start(t);
    vibrato.start(t);
    osc.stop(t + duration + 0.05);
    vibrato.stop(t + duration + 0.05);

    this.notifyBeat({ isKick: true, isInstrument: true, intensity: 0.75, sfxType: 'cello' });
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
  async triggerAirHorn(time = 0) {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = Math.max(time, this.ctx.currentTime + 0.015);
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
  async triggerBassImpact(time = 0) {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = Math.max(time, this.ctx.currentTime + 0.015);

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
  async triggerRiser(duration = 2.0, time = 0) {
    await this.resumeContext();
    if (!this.ctx) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    const t = Math.max(time, this.ctx.currentTime + 0.015);

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
  async triggerScratch(time = 0) {
    await this.resumeContext();
    if (!this.ctx) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    if (!this.noiseBuffer) return;
    const t = Math.max(time, this.ctx.currentTime + 0.015);

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
  async triggerLaserZap(time = 0) {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = Math.max(time, this.ctx.currentTime + 0.015);

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
  async triggerBassSweep(time = 0) {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = Math.max(time, this.ctx.currentTime + 0.015);

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
  async triggerSubDrop(time = 0) {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = Math.max(time, this.ctx.currentTime + 0.015);

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
  async triggerCrowdHype(time = 0) {
    await this.resumeContext();
    if (!this.ctx) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    if (!this.noiseBuffer) return;
    const t = Math.max(time, this.ctx.currentTime + 0.015);

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
  async triggerDrumRoll(time = 0) {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = Math.max(time, this.ctx.currentTime + 0.015);

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
  async triggerDjShout(time = 0) {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = Math.max(time, this.ctx.currentTime + 0.015);

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
  async triggerImpactHit(time = 0) {
    await this.resumeContext();
    if (!this.ctx) return;
    if (!this.noiseBuffer) this.initNoiseBuffer();
    const t = Math.max(time, this.ctx.currentTime + 0.015);

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
  async triggerEchoDelay(time = 0) {
    await this.resumeContext();
    if (!this.ctx) return;
    const t = Math.max(time, this.ctx.currentTime + 0.015);

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

  updateChannelGains() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Beats
    let bVol = this.beatsVolume * this.beatIntensity;
    if (this.isMuted || this.isBeatsMuted || (this.soloChannel && this.soloChannel !== 'beats')) {
      bVol = 0;
    }
    if (this.beatsGain) {
      this.beatsGain.gain.setValueAtTime(bVol, now);
    }

    // Instruments
    let iVol = this.instrumentVolume;
    if (this.isMuted || this.isInstrumentsMuted || (this.soloChannel && this.soloChannel !== 'instruments')) {
      iVol = 0;
    }
    if (this.instrumentGain) {
      this.instrumentGain.gain.setValueAtTime(iVol, now);
    }

    // SFX
    let sVol = this.sfxVolume;
    if (this.isMuted || this.isSfxMuted || (this.soloChannel && this.soloChannel !== 'sfx')) {
      sVol = 0;
    }
    if (this.sfxGain) {
      this.sfxGain.gain.setValueAtTime(sVol, now);
    }
  }

  setBeatsVolume(vol) {
    this.beatsVolume = Math.max(0, Math.min(1, vol));
    this.updateChannelGains();
  }

  setSfxVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    this.updateChannelGains();
  }

  setInstrumentVolume(vol) {
    this.instrumentVolume = Math.max(0, Math.min(1, vol));
    this.updateChannelGains();
  }

  toggleBeatsMute() {
    this.isBeatsMuted = !this.isBeatsMuted;
    this.updateChannelGains();
    return this.isBeatsMuted;
  }

  toggleInstrumentsMute() {
    this.isInstrumentsMuted = !this.isInstrumentsMuted;
    this.updateChannelGains();
    return this.isInstrumentsMuted;
  }

  toggleSfxMute() {
    this.isSfxMuted = !this.isSfxMuted;
    this.updateChannelGains();
    return this.isSfxMuted;
  }

  setSoloChannel(channel) {
    // toggle solo if already active
    this.soloChannel = this.soloChannel === channel ? null : channel;
    this.updateChannelGains();
    return this.soloChannel;
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

  // Trigger individual bass library item (supports precise Web Audio time scheduling)
  triggerBassItem(id, time = 0) {
    const t = Math.max(time, this.ctx ? this.ctx.currentTime + 0.005 : 0.005);
    switch (id) {
      case 'deep-sub': this.playDeepSub(t); break;
      case 'punchy-kick': this.playPunchyKick(t, true); break;
      case 'rolling-bass': this.playRollingBass(t, 65.41); break;
      case 'wobble-bass': this.playWobbleBass(t, 55.0, 6); break;
      case 'distorted-bass': this.playDistortedBass(t, 60.0); break;
      case 'reverse-bass': this.playReverseBass(t, 65.0); break;
      case 'dhol-bass': this.playDholBass(t, true); break;
      case 'triple-drop': this.playTripleDrop(t); break;
      default: this.playPunchyKick(t, true); break;
    }
    this.notifyBeat({ isKick: true, intensity: 0.95, sfxType: id });
  }

  // Trigger individual musical instrument library item (supports precise Web Audio time scheduling)
  triggerInstrumentItem(id, time = 0) {
    const t = Math.max(time, this.ctx ? this.ctx.currentTime + 0.005 : 0.005);
    switch (id) {
      // Guitars & Plucked
      case 'acoustic-guitar': this.playAcousticGuitar(t); break;
      case 'electric-guitar': this.playElectricGuitar(t); break;
      case 'bassline-groove': this.playWarmBassline(t); break;
      case 'ukulele-plucked': this.playUkulele(t); break;
      case 'sitar-melodic': this.playSitar(t); break;
      case 'sarangi-bowed': this.playSarangi(t); break;

      // Keys & Pads
      case 'piano-grand': this.playConcertPiano(t); break;
      case 'electric-keys': this.playRhodesEP(t); break;
      case 'harmonium-pump': this.playHarmonium(t); break;
      case 'synth-lead': this.playAnalogPolySynth(t); break;
      case 'organ-vintage': this.playTonewheelOrgan(t); break;

      // Drums & Percussion
      case 'acoustic-drums': this.playLiveAcousticDrums(t); break;
      case 'tabla-bols': this.playTabla(t); break;
      case 'dholak-folk': this.playDholak(t); break;
      case 'congas-latin': this.playCongas(t); break;
      case 'shaker-tambourine': this.playShakerTambourine(t); break;
      case 'hihat-ride': this.playHiHatRide(t); break;

      // Winds & Brass
      case 'flute-melodic': this.playBansuriFlute(t); break;
      case 'saxophone-smooth': this.playSaxophone(t); break;
      case 'trumpet-solo': this.playTrumpet(t); break;
      case 'brass-section': this.playClubBrass(t); break;

      // Strings & Bowed
      case 'violin-solo': this.playViolin(t); break;
      case 'cello-deep': this.playCello(t); break;
      case 'string-ensemble': this.playStringEnsemble(t); break;

      default: this.playConcertPiano(t); break;
    }
  }

  // Trigger individual SFX library item (supports precise Web Audio time scheduling)
  triggerSfxItem(id, time = 0) {
    const t = Math.max(time, this.ctx ? this.ctx.currentTime + 0.005 : 0.005);
    switch (id) {
      case 'airhorn': this.triggerAirHorn(t); break;
      case 'bass-impact': this.triggerBassImpact(t); break;
      case 'riser': this.triggerRiser(1.8, t); break;
      case 'scratch': this.triggerScratch(t); break;
      case 'laser': this.triggerLaserZap(t); break;
      case 'bass-sweep': this.triggerBassSweep(t); break;
      case 'sub-drop': this.triggerSubDrop(t); break;
      case 'crowd-hype': this.triggerCrowdHype(t); break;
      case 'drum-roll': this.triggerDrumRoll(t); break;
      case 'dj-shout': this.triggerDjShout(t); break;
      case 'impact-hit': this.triggerImpactHit(t); break;
      case 'echo-delay': this.triggerEchoDelay(t); break;
      default: this.triggerLaserZap(t); break;
    }
  }

  // =========================================================================
  // MULTI-ITEM CONTINUOUS AUTO-LOOP SYSTEM (Centralized Scheduler)
  // =========================================================================

  onLoopStateChange(callback) {
    if (typeof callback === 'function') {
      this.loopStateListeners.add(callback);
    }
    return () => this.loopStateListeners.delete(callback);
  }

  notifyLoopStateChange() {
    const activeLoops = Array.from(this.activeLoops.values());
    const activeBass = activeLoops.filter((l) => l.type === 'bass');
    const activeFx = activeLoops.filter((l) => l.type === 'fx');
    const activeInstruments = activeLoops.filter((l) => l.type === 'instrument');

    this.loopStateListeners.forEach((cb) => {
      try {
        cb({
          activeLoops,
          activeBassCount: activeBass.length,
          activeFxCount: activeFx.length,
          activeInstrumentCount: activeInstruments.length,
          globalBassInterval: this.globalBassInterval,
          globalFxInterval: this.globalFxInterval,
          globalInstrumentInterval: this.globalInstrumentInterval
        });
      } catch (_) {}
    });
  }

  onLoopTrigger(callback) {
    if (typeof callback === 'function') {
      this.loopTriggerListeners.add(callback);
    }
    return () => this.loopTriggerListeners.delete(callback);
  }

  notifyLoopTrigger(data) {
    this.loopTriggerListeners.forEach((cb) => {
      try {
        cb(data);
      } catch (_) {}
    });
  }

  /**
   * Centralized Single Scheduler Loop: checks active loops with Web Audio lookahead.
   * Completely avoids multi-timer leaks or duplicate audio intervals.
   */
  scheduleLoopIteration() {
    if (!this.ctx || this.activeLoops.size === 0) {
      if (this.loopSchedulerTimer) {
        clearTimeout(this.loopSchedulerTimer);
        this.loopSchedulerTimer = null;
      }
      return;
    }

    const now = this.ctx.currentTime;
    const lookahead = 0.05; // 50ms scheduling window

    this.activeLoops.forEach((loop, id) => {
      if (now >= loop.nextTriggerTime - lookahead) {
        const triggerTime = Math.max(now, loop.nextTriggerTime);

        if (loop.type === 'bass') {
          this.triggerBassItem(id, triggerTime);
        } else if (loop.type === 'fx') {
          this.triggerSfxItem(id, triggerTime);
        } else if (loop.type === 'instrument') {
          this.triggerInstrumentItem(id, triggerTime);
        }

        loop.lastTriggerTime = triggerTime;
        loop.nextTriggerTime = triggerTime + loop.interval;

        this.notifyLoopTrigger({
          id,
          type: loop.type,
          time: triggerTime,
          nextTime: loop.nextTriggerTime,
          interval: loop.interval
        });
      }
    });

    this.loopSchedulerTimer = setTimeout(() => this.scheduleLoopIteration(), 25);
  }

  /**
   * Toggle individual item in the continuous multi-loop system
   */
  async toggleLoop(id, type = 'bass', customInterval = null) {
    await this.resumeContext();
    if (this.activeLoops.has(id)) {
      // Turn OFF
      this.activeLoops.delete(id);
      if (this.activeLoops.size === 0 && this.loopSchedulerTimer) {
        clearTimeout(this.loopSchedulerTimer);
        this.loopSchedulerTimer = null;
      }
      this.notifyLoopStateChange();
      return false;
    } else {
      // Turn ON
      let defaultInterval = this.globalBassInterval;
      if (type === 'fx') {
        defaultInterval = this.globalFxInterval;
      } else if (type === 'instrument') {
        defaultInterval = this.globalInstrumentInterval;
      }

      const interval = Number(customInterval) > 0 ? Number(customInterval) : defaultInterval;
      const now = this.ctx ? this.ctx.currentTime : 0;

      const loopConfig = {
        id,
        type,
        interval: Math.max(0.2, interval),
        nextTriggerTime: now + 0.01, // Immediate first play
        lastTriggerTime: now,
        customInterval: Boolean(customInterval && customInterval !== defaultInterval)
      };

      this.activeLoops.set(id, loopConfig);

      // Play immediate first note
      if (type === 'bass') {
        this.triggerBassItem(id, now + 0.01);
      } else if (type === 'fx') {
        this.triggerSfxItem(id, now + 0.01);
      } else if (type === 'instrument') {
        this.triggerInstrumentItem(id, now + 0.01);
      }

      loopConfig.nextTriggerTime = now + loopConfig.interval;

      this.notifyLoopTrigger({
        id,
        type,
        time: now + 0.01,
        nextTime: loopConfig.nextTriggerTime,
        interval: loopConfig.interval
      });

      if (!this.loopSchedulerTimer) {
        this.scheduleLoopIteration();
      }
      this.notifyLoopStateChange();
      return true;
    }
  }

  isLoopActive(id) {
    return this.activeLoops.has(id);
  }

  getLoopConfig(id) {
    return this.activeLoops.get(id) || null;
  }

  getActiveLoops() {
    return Array.from(this.activeLoops.values());
  }

  getActiveCount(type) {
    let count = 0;
    this.activeLoops.forEach((loop) => {
      if (!type || loop.type === type) count++;
    });
    return count;
  }

  /**
   * Adjusts individual item's repeat interval immediately without restarting other items
   */
  setItemInterval(id, newInterval) {
    const loop = this.activeLoops.get(id);
    const validInterval = Math.max(0.2, Number(newInterval) || 1.0);
    if (loop) {
      loop.interval = validInterval;
      loop.customInterval = true;
      const now = this.ctx ? this.ctx.currentTime : 0;
      const elapsed = now - loop.lastTriggerTime;
      if (elapsed < loop.interval) {
        loop.nextTriggerTime = loop.lastTriggerTime + loop.interval;
      } else {
        loop.nextTriggerTime = now + 0.02;
      }
      this.notifyLoopStateChange();
    }
  }

  /**
   * Sets Global Bass Interval (0.5 to 10s)
   */
  setGlobalBassInterval(sec) {
    const validSec = Math.max(0.5, Math.min(10, Number(sec) || 2.0));
    this.globalBassInterval = validSec;
    // Update active bass loops that don't have custom override
    this.activeLoops.forEach((loop) => {
      if (loop.type === 'bass' && !loop.customInterval) {
        loop.interval = validSec;
      }
    });
    this.notifyLoopStateChange();
  }

  /**
   * Sets Global FX Interval (1 to 15s)
   */
  setGlobalFxInterval(sec) {
    const validSec = Math.max(1, Math.min(15, Number(sec) || 4.0));
    this.globalFxInterval = validSec;
    // Update active FX loops that don't have custom override
    this.activeLoops.forEach((loop) => {
      if (loop.type === 'fx' && !loop.customInterval) {
        loop.interval = validSec;
      }
    });
    this.notifyLoopStateChange();
  }

  /**
   * Sets Global Instrument Interval (0.5 to 10s)
   */
  setGlobalInstrumentInterval(sec) {
    const validSec = Math.max(0.5, Math.min(10, Number(sec) || 2.0));
    this.globalInstrumentInterval = validSec;
    // Update active instrument loops that don't have custom override
    this.activeLoops.forEach((loop) => {
      if (loop.type === 'instrument' && !loop.customInterval) {
        loop.interval = validSec;
      }
    });
    this.notifyLoopStateChange();
  }

  /**
   * Stop all active instrument loops
   */
  stopAllInstruments() {
    for (const [id, loop] of this.activeLoops.entries()) {
      if (loop.type === 'instrument') {
        this.activeLoops.delete(id);
      }
    }
    if (this.activeLoops.size === 0 && this.loopSchedulerTimer) {
      clearTimeout(this.loopSchedulerTimer);
      this.loopSchedulerTimer = null;
    }
    this.notifyLoopStateChange();
  }

  /**
   * Stop all active bass loops
   */
  stopAllBass() {
    for (const [id, loop] of this.activeLoops.entries()) {
      if (loop.type === 'bass') {
        this.activeLoops.delete(id);
      }
    }
    if (this.activeLoops.size === 0 && this.loopSchedulerTimer) {
      clearTimeout(this.loopSchedulerTimer);
      this.loopSchedulerTimer = null;
    }
    this.notifyLoopStateChange();
  }

  /**
   * Stop all active FX loops
   */
  stopAllFx() {
    for (const [id, loop] of this.activeLoops.entries()) {
      if (loop.type === 'fx') {
        this.activeLoops.delete(id);
      }
    }
    if (this.activeLoops.size === 0 && this.loopSchedulerTimer) {
      clearTimeout(this.loopSchedulerTimer);
      this.loopSchedulerTimer = null;
    }
    this.notifyLoopStateChange();
  }

  /**
   * Stop all active loops (both Bass and FX)
   */
  stopAllLoops() {
    this.activeLoops.clear();
    if (this.loopSchedulerTimer) {
      clearTimeout(this.loopSchedulerTimer);
      this.loopSchedulerTimer = null;
    }
    this.notifyLoopStateChange();
  }

  /**
   * Emergency Stop All: stops all loops + pauses beat playback
   */
  stopAll() {
    this.stopAllLoops();
    this.pauseBeats();
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
    this.stopAllLoops();
    this.pauseBeats();
    this.beatListeners.clear();
    this.loopStateListeners.clear();
    this.loopTriggerListeners.clear();
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch (_) {}
    }
  }
}

export const djAudio = new DjAudioEngine();
export default djAudio;
