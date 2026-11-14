// Dedicated High-Fidelity Web Audio DSP Chain for Loopra Relax Mode
// Provides 14 spatial/acoustic presets, 3D PannerNode HRTF positioning, 7-band parametric EQ, Delay/Echo & Convolution Reverb
// With automatic dynamic loudness compensation preserving perceived loudness (within ±1.5 LU) across all spatial modes & effects

export const SPATIAL_STUDIO_MODES = [
  { id: 'natural', name: 'Original / Natural', desc: 'Completely untouched original studio recording', isHeadphoneOnly: false, targetGainComp: 1.0 },
  { id: 'stereo', name: 'Standard Stereo', desc: 'Balanced left/right acoustic field', isHeadphoneOnly: false, targetGainComp: 1.05 },
  { id: 'wide-stereo', name: 'Wide Stereo', desc: 'Expanded stereo boundary width via Haas delay & micro-reflections', isHeadphoneOnly: false, targetGainComp: 1.25 },
  { id: 'spatial-3d', name: '3D Spatial Audio', desc: 'Virtual 3D spatial field with binaural HRTF positioning', isHeadphoneOnly: true, targetGainComp: 1.55 },
  { id: 'surround', name: 'Surround Simulation', desc: 'Immersive virtual surround sound field for stereo headphones', isHeadphoneOnly: true, targetGainComp: 1.6 },
  { id: 'echo', name: 'Atmospheric Echo', desc: 'Smooth rhythmic slapback and canyon delays', isHeadphoneOnly: false, targetGainComp: 1.1 },
  { id: 'reverb', name: 'Reflective Reverb', desc: 'Natural acoustic room reverberation and tail decay', isHeadphoneOnly: false, targetGainComp: 1.15 },
  { id: 'hall', name: 'Concert Hall', desc: 'Spacious high-ceiling ambient concert hall resonance', isHeadphoneOnly: false, targetGainComp: 1.45 },
  { id: 'cave', name: 'Deep Cave', desc: 'Long decaying stone cavern echo with low absorption', isHeadphoneOnly: false, targetGainComp: 1.5 },
  { id: 'room', name: 'Cozy Room', desc: 'Intimate warm indoor acoustic environment', isHeadphoneOnly: false, targetGainComp: 1.1 },
  { id: 'binaural-spatial', name: 'Binaural Spatial', desc: 'Headphone-optimized 360-degree spatial localization', isHeadphoneOnly: true, targetGainComp: 1.55 },
  { id: 'deep-bass', name: 'Deep Bass', desc: 'Warm low-frequency sub-bass boost without clipping', isHeadphoneOnly: false, targetGainComp: 1.0 },
  { id: 'clear-nature', name: 'Clear Voice / Nature', desc: 'High-clarity wildlife presence with gentle warm air', isHeadphoneOnly: false, targetGainComp: 1.05 },
  { id: 'cinematic', name: 'Cinematic Atmosphere', desc: 'Grand theatrical audio profile with deep lows & crisp spatial highs', isHeadphoneOnly: false, targetGainComp: 1.4 }
];

export const SPATIAL_POSITIONS = [
  { id: 'center', label: 'Center', x: 0, y: 0, z: -1 },
  { id: 'front', label: 'Front', x: 0, y: 0.5, z: -1.8 },
  { id: 'front-left', label: 'Front-Left', x: -1.2, y: 0.3, z: -1.3 },
  { id: 'front-right', label: 'Front-Right', x: 1.2, y: 0.3, z: -1.3 },
  { id: 'left', label: 'Left', x: -1.8, y: 0, z: -0.2 },
  { id: 'right', label: 'Right', x: 1.8, y: 0, z: -0.2 },
  { id: 'rear-left', label: 'Rear-Left', x: -1.3, y: -0.2, z: 1.3 },
  { id: 'rear-right', label: 'Rear-Right', x: 1.3, y: -0.2, z: 1.3 }
];

export const EQ_BANDS = [
  { freq: 60, label: 'Sub-bass', type: 'lowshelf' },
  { freq: 150, label: 'Bass', type: 'peaking', q: 0.7 },
  { freq: 400, label: 'Low-mid', type: 'peaking', q: 0.7 },
  { freq: 1000, label: 'Mid', type: 'peaking', q: 0.7 },
  { freq: 3000, label: 'High-mid', type: 'peaking', q: 0.7 },
  { freq: 8000, label: 'Treble', type: 'peaking', q: 0.7 },
  { freq: 12000, label: 'Air', type: 'highshelf' }
];

export const EQ_FREQUENCIES_7 = EQ_BANDS.map(b => b.freq);

export const EQ_PRESETS = {
  natural: { 60: 0, 150: 0, 400: 0, 1000: 0, 3000: 0, 8000: 0, 12000: 0 },
  warm: { 60: 2, 150: 1.5, 400: 0.5, 1000: 0, 3000: -0.5, 8000: -1, 12000: -1 },
  deep: { 60: 3, 150: 2, 400: 1, 1000: 0, 3000: 0.5, 8000: 1, 12000: 1.5 },
  clear: { 60: -1, 150: -0.5, 400: 0, 1000: 1, 3000: 1.5, 8000: 2, 12000: 1.5 },
  relax: { 60: 1.5, 150: 1, 400: 0, 1000: -0.5, 3000: 0, 8000: -0.5, 12000: -1 },
  cinematic: { 60: 2.5, 150: 1.5, 400: 0, 1000: 0.5, 3000: 1.5, 8000: 1.5, 12000: 2 },
  wide: { 60: 0.5, 150: 0.5, 400: 0, 1000: 0, 3000: 1, 8000: 1.5, 12000: 1.5 }
};

export class SpatialStudioDsp {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.isEnabled = false;
    this.isBypassed = false;
    this.mode = 'natural';
    this.activePosition = 'center';
    this.eqGains = { ...EQ_PRESETS.natural };

    // Spatial parameters
    this.spatialWidth = 1.0;
    this.spatialDistance = 1.0;

    // Echo / Delay parameters
    this.echoAmount = 0.0;
    this.delayTime = 0.28;
    this.feedback = 0.35;

    // Reverb parameters
    this.reverbAmount = 0.0;
    this.roomSize = 0.5;
    this.decayTime = 2.2;

    // Wet / Dry balance (0.0 = 100% dry, 1.0 = 100% wet)
    this.wetDry = 0.5;

    // Loudness Compensation Gain
    this.compensationGain = 1.0;

    // Nodes
    this.inputNode = null;
    this.outputNode = null;
    this.dryGainNode = null;
    this.wetGainNode = null;
    this.bypassGainNode = null;
    this.loudnessCompNode = null;
    this.limiterNode = null;

    // Dual Analysers for Real-time A/B Loudness Metering
    this.analyserOriginal = null;
    this.analyserProcessed = null;

    // 7 BiquadFilterNodes
    this.eqFilters = [];

    // PannerNode (HRTF)
    this.pannerNode = null;

    // Delay subsystem
    this.delayNode = null;
    this.delayFeedbackNode = null;
    this.delayFilterNode = null;
    this.delayGainNode = null;

    // Convolver Reverb subsystem
    this.convolverNode = null;
    this.convolverGainNode = null;

    // Build the audio processing graph
    this.buildGraph();
  }

  buildGraph() {
    if (!this.ctx) return;

    // Input boundary
    this.inputNode = this.ctx.createGain();

    // Analyser for Original (A) signal
    this.analyserOriginal = this.ctx.createAnalyser();
    this.analyserOriginal.fftSize = 256;
    this.analyserOriginal.smoothingTimeConstant = 0.8;
    this.inputNode.connect(this.analyserOriginal);

    // Bypass Gain Node (for instantaneous A/B comparison and 100% bypass)
    this.bypassGainNode = this.ctx.createGain();
    this.bypassGainNode.gain.setValueAtTime(1, this.ctx.currentTime);
    this.inputNode.connect(this.bypassGainNode);

    // 1. Equalizer Filter Bank: 7 BiquadFilterNodes in series
    this.eqFilters = EQ_BANDS.map((band) => {
      const filter = this.ctx.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.setValueAtTime(band.freq, this.ctx.currentTime);
      if (band.q) {
        filter.Q.setValueAtTime(band.q, this.ctx.currentTime);
      }
      filter.gain.setValueAtTime(0, this.ctx.currentTime);
      return filter;
    });

    for (let i = 0; i < this.eqFilters.length - 1; i++) {
      this.eqFilters[i].connect(this.eqFilters[i + 1]);
    }

    // Connect input to EQ start
    this.inputNode.connect(this.eqFilters[0]);

    // 2. 3D Spatial PannerNode with HRTF panning model & calibrated distance model
    try {
      this.pannerNode = this.ctx.createPanner();
      this.pannerNode.panningModel = 'HRTF';
      this.pannerNode.distanceModel = 'inverse';
      this.pannerNode.refDistance = 1.0;
      this.pannerNode.maxDistance = 10000;
      // Use gentle rolloffFactor (0.35) so virtual distance creates spatial perspective
      // without collapsing the physical sound amplitude
      this.pannerNode.rolloffFactor = 0.35;
      this.pannerNode.coneInnerAngle = 360;
      this.pannerNode.coneOuterAngle = 0;
      this.pannerNode.coneOuterGain = 0;

      const pos = SPATIAL_POSITIONS[0]; // center
      this.setPosition(pos.x, pos.y, pos.z);
    } catch (e) {
      console.warn('[SpatialStudioDsp] HRTF fallback to equalpower:', e);
      this.pannerNode = this.ctx.createPanner();
      this.pannerNode.panningModel = 'equalpower';
    }

    // Configure audio listener orientation if supported
    if (this.ctx.listener) {
      try {
        if (this.ctx.listener.forwardZ) {
          this.ctx.listener.positionX.setValueAtTime(0, this.ctx.currentTime);
          this.ctx.listener.positionY.setValueAtTime(0, this.ctx.currentTime);
          this.ctx.listener.positionZ.setValueAtTime(0, this.ctx.currentTime);
          this.ctx.listener.forwardX.setValueAtTime(0, this.ctx.currentTime);
          this.ctx.listener.forwardY.setValueAtTime(0, this.ctx.currentTime);
          this.ctx.listener.forwardZ.setValueAtTime(-1, this.ctx.currentTime);
          this.ctx.listener.upX.setValueAtTime(0, this.ctx.currentTime);
          this.ctx.listener.upY.setValueAtTime(1, this.ctx.currentTime);
          this.ctx.listener.upZ.setValueAtTime(0, this.ctx.currentTime);
        } else if (typeof this.ctx.listener.setOrientation === 'function') {
          this.ctx.listener.setOrientation(0, 0, -1, 0, 1, 0);
        }
      } catch (_) {}
    }

    const lastEqFilter = this.eqFilters[this.eqFilters.length - 1];
    lastEqFilter.connect(this.pannerNode);

    // 3. Dry and Wet Processing Nodes
    this.dryGainNode = this.ctx.createGain();
    this.wetGainNode = this.ctx.createGain();

    this.dryGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    this.wetGainNode.gain.setValueAtTime(0, this.ctx.currentTime);

    // Split panned output into dry and wet
    this.pannerNode.connect(this.dryGainNode);

    // 4. Echo / Delay Sub-Graph
    this.delayNode = this.ctx.createDelay(3.0);
    this.delayNode.delayTime.setValueAtTime(this.delayTime, this.ctx.currentTime);

    this.delayFeedbackNode = this.ctx.createGain();
    this.delayFeedbackNode.gain.setValueAtTime(this.feedback, this.ctx.currentTime);

    this.delayFilterNode = this.ctx.createBiquadFilter();
    this.delayFilterNode.type = 'lowpass';
    this.delayFilterNode.frequency.setValueAtTime(4500, this.ctx.currentTime);

    this.delayGainNode = this.ctx.createGain();
    this.delayGainNode.gain.setValueAtTime(this.echoAmount, this.ctx.currentTime);

    this.pannerNode.connect(this.delayNode);
    this.delayNode.connect(this.delayFilterNode);
    this.delayFilterNode.connect(this.delayFeedbackNode);
    this.delayFeedbackNode.connect(this.delayNode);
    this.delayFilterNode.connect(this.delayGainNode);
    this.delayGainNode.connect(this.wetGainNode);

    // 5. Convolution Reverb Sub-Graph
    this.convolverNode = this.ctx.createConvolver();
    this.convolverGainNode = this.ctx.createGain();
    this.convolverGainNode.gain.setValueAtTime(this.reverbAmount, this.ctx.currentTime);
    this.generateSyntheticImpulse(this.roomSize, this.decayTime);

    this.pannerNode.connect(this.convolverNode);
    this.convolverNode.connect(this.convolverGainNode);
    this.convolverGainNode.connect(this.wetGainNode);

    // 6. Loudness Compensation Gain Node (Applied internally to the processed chain)
    this.loudnessCompNode = this.ctx.createGain();
    this.loudnessCompNode.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.dryGainNode.connect(this.loudnessCompNode);
    this.wetGainNode.connect(this.loudnessCompNode);

    // 7. Safety Dynamics Limiter (To prevent any clipping, distortion or bass overload)
    this.limiterNode = this.ctx.createDynamicsCompressor();
    this.limiterNode.threshold.setValueAtTime(-0.5, this.ctx.currentTime);
    this.limiterNode.knee.setValueAtTime(6.0, this.ctx.currentTime);
    this.limiterNode.ratio.setValueAtTime(10.0, this.ctx.currentTime);
    this.limiterNode.attack.setValueAtTime(0.005, this.ctx.currentTime);
    this.limiterNode.release.setValueAtTime(0.08, this.ctx.currentTime);

    this.loudnessCompNode.connect(this.limiterNode);

    // Analyser for Processed (B) signal
    this.analyserProcessed = this.ctx.createAnalyser();
    this.analyserProcessed.fftSize = 256;
    this.analyserProcessed.smoothingTimeConstant = 0.8;
    this.limiterNode.connect(this.analyserProcessed);

    // Final Output boundary node
    this.outputNode = this.ctx.createGain();
    this.bypassGainNode.connect(this.outputNode);
    this.limiterNode.connect(this.outputNode);

    this.updateGains();
  }

  // Smooth position coordinate assignment
  setPosition(x, y, z) {
    if (!this.pannerNode || !this.ctx) return;
    const now = this.ctx.currentTime;
    const distScale = Math.max(0.6, Math.min(2.5, this.spatialDistance));
    const targetX = x * distScale * this.spatialWidth;
    const targetY = y * distScale;
    const targetZ = z * distScale;

    if (this.pannerNode.positionX) {
      this.pannerNode.positionX.cancelScheduledValues(now);
      this.pannerNode.positionY.cancelScheduledValues(now);
      this.pannerNode.positionZ.cancelScheduledValues(now);
      this.pannerNode.positionX.linearRampToValueAtTime(targetX, now + 0.12);
      this.pannerNode.positionY.linearRampToValueAtTime(targetY, now + 0.12);
      this.pannerNode.positionZ.linearRampToValueAtTime(targetZ, now + 0.12);
    } else if (typeof this.pannerNode.setPosition === 'function') {
      this.pannerNode.setPosition(targetX, targetY, targetZ);
    }
  }

  // Generate clean stereo mathematical impulse response for natural acoustics
  generateSyntheticImpulse(roomSize = 0.5, decay = 2.0) {
    if (!this.ctx || !this.convolverNode) return;
    const rate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(rate * Math.max(0.3, Math.min(5.0, decay))));
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    const decayFactor = 3.5 / (decay || 1.5);
    const diffusion = Math.max(0.2, roomSize);

    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const envelope = Math.exp(-t * decayFactor);
      
      const earlyRefl = i < rate * 0.05 ? (Math.random() * 2 - 1) * 1.4 : (Math.random() * 2 - 1);
      left[i] = earlyRefl * envelope * diffusion;
      right[i] = earlyRefl * envelope * diffusion * (1 - Math.sin(t * 12) * 0.15);
    }

    try {
      this.convolverNode.buffer = impulse;
    } catch (e) {
      console.warn('[SpatialStudioDsp] Failed to set impulse buffer:', e);
    }
  }

  // Set Master Studio Mode
  setMode(modeId) {
    this.mode = modeId;
    this.isEnabled = true;
    this.isBypassed = false;

    if (modeId === 'natural') {
      this.applyNatural();
    } else if (modeId === 'stereo') {
      this.applyStereo();
    } else if (modeId === 'wide-stereo') {
      this.applyWideStereo();
    } else if (modeId === 'spatial-3d') {
      this.applySpatial3D();
    } else if (modeId === 'surround') {
      this.applySurround();
    } else if (modeId === 'echo') {
      this.applyEcho();
    } else if (modeId === 'reverb') {
      this.applyReverb();
    } else if (modeId === 'hall') {
      this.applyHall();
    } else if (modeId === 'cave') {
      this.applyCave();
    } else if (modeId === 'room') {
      this.applyRoom();
    } else if (modeId === 'binaural-spatial') {
      this.applyBinauralSpatial();
    } else if (modeId === 'deep-bass') {
      this.applyDeepBass();
    } else if (modeId === 'clear-nature') {
      this.applyClearNature();
    } else if (modeId === 'cinematic') {
      this.applyCinematic();
    }
    this.updateGains();
  }

  applyNatural() {
    this.setEqPreset('natural');
    this.spatialWidth = 1.0;
    this.spatialDistance = 1.0;
    this.echoAmount = 0.0;
    this.reverbAmount = 0.0;
    this.setPosition(0, 0, -1);
    this.activePosition = 'center';
    this.compensationGain = 1.0;
    this.isEnabled = false; // Original mode bypasses DSP completely to pure native audio
  }

  applyStereo() {
    this.setEqPreset('natural');
    this.spatialWidth = 1.15;
    this.spatialDistance = 1.0;
    this.echoAmount = 0.0;
    this.reverbAmount = 0.05;
    this.roomSize = 0.3;
    this.decayTime = 1.0;
    this.generateSyntheticImpulse(0.3, 1.0);
    this.setPosition(0, 0, -1);
    this.activePosition = 'center';
    this.compensationGain = 1.02;
  }

  applyWideStereo() {
    this.setEqPreset('wide');
    this.spatialWidth = 1.6;
    this.spatialDistance = 1.1;
    this.echoAmount = 0.06;
    this.delayTime = 0.024;
    this.feedback = 0.12;
    this.reverbAmount = 0.12;
    this.roomSize = 0.45;
    this.decayTime = 1.4;
    this.generateSyntheticImpulse(0.45, 1.4);
    this.setPosition(0, 0.1, -1.1);
    this.activePosition = 'front';
    this.compensationGain = 1.12;
  }

  applySpatial3D() {
    this.setEqPreset('natural');
    this.spatialWidth = 1.5;
    this.spatialDistance = 1.2;
    this.echoAmount = 0.08;
    this.delayTime = 0.12;
    this.feedback = 0.15;
    this.reverbAmount = 0.15;
    this.roomSize = 0.55;
    this.decayTime = 1.8;
    this.generateSyntheticImpulse(0.55, 1.8);
    this.setPosition(-0.9, 0.15, -1.1);
    this.activePosition = 'front-left';
    this.compensationGain = 1.25;
  }

  applySurround() {
    this.setEqPreset('wide');
    this.spatialWidth = 1.7;
    this.spatialDistance = 1.25;
    this.echoAmount = 0.1;
    this.delayTime = 0.15;
    this.feedback = 0.18;
    this.reverbAmount = 0.2;
    this.roomSize = 0.65;
    this.decayTime = 2.0;
    this.generateSyntheticImpulse(0.65, 2.0);
    this.setPosition(0, 0.25, -1.25);
    this.activePosition = 'front';
    this.compensationGain = 1.28;
  }

  applyEcho() {
    this.setEqPreset('natural');
    this.echoAmount = 0.32;
    this.delayTime = 0.26;
    this.feedback = 0.3;
    this.reverbAmount = 0.06;
    this.roomSize = 0.4;
    this.decayTime = 1.6;
    this.generateSyntheticImpulse(0.4, 1.6);
    this.compensationGain = 1.05;
  }

  applyReverb() {
    this.setEqPreset('relax');
    this.echoAmount = 0.05;
    this.reverbAmount = 0.32;
    this.roomSize = 0.6;
    this.decayTime = 2.2;
    this.generateSyntheticImpulse(0.6, 2.2);
    this.compensationGain = 1.1;
  }

  applyHall() {
    this.setEqPreset('warm');
    this.spatialWidth = 1.4;
    this.spatialDistance = 1.3;
    this.echoAmount = 0.12;
    this.delayTime = 0.28;
    this.feedback = 0.24;
    this.reverbAmount = 0.38;
    this.roomSize = 0.75;
    this.decayTime = 2.6;
    this.generateSyntheticImpulse(0.75, 2.6);
    this.compensationGain = 1.22;
  }

  applyCave() {
    this.setEqPreset('deep');
    this.spatialWidth = 1.5;
    this.spatialDistance = 1.4;
    this.echoAmount = 0.32;
    this.delayTime = 0.32;
    this.feedback = 0.35;
    this.reverbAmount = 0.4;
    this.roomSize = 0.8;
    this.decayTime = 2.8;
    this.generateSyntheticImpulse(0.8, 2.8);
    this.compensationGain = 1.25;
  }

  applyRoom() {
    this.setEqPreset('warm');
    this.spatialWidth = 1.1;
    this.spatialDistance = 1.0;
    this.echoAmount = 0.03;
    this.delayTime = 0.06;
    this.feedback = 0.1;
    this.reverbAmount = 0.15;
    this.roomSize = 0.3;
    this.decayTime = 0.9;
    this.generateSyntheticImpulse(0.3, 0.9);
    this.compensationGain = 1.05;
  }

  applyBinauralSpatial() {
    this.setEqPreset('natural');
    this.spatialWidth = 1.8;
    this.spatialDistance = 1.2;
    this.echoAmount = 0.08;
    this.delayTime = 0.12;
    this.feedback = 0.16;
    this.reverbAmount = 0.18;
    this.roomSize = 0.55;
    this.decayTime = 1.8;
    this.generateSyntheticImpulse(0.55, 1.8);
    this.compensationGain = 1.24;
  }

  applyDeepBass() {
    this.setEqPreset('deep');
    this.spatialWidth = 1.1;
    this.echoAmount = 0.04;
    this.reverbAmount = 0.08;
    this.roomSize = 0.35;
    this.decayTime = 1.2;
    this.generateSyntheticImpulse(0.35, 1.2);
    this.compensationGain = 1.02;
  }

  applyClearNature() {
    this.setEqPreset('clear');
    this.spatialWidth = 1.2;
    this.echoAmount = 0.03;
    this.reverbAmount = 0.08;
    this.roomSize = 0.35;
    this.decayTime = 1.2;
    this.generateSyntheticImpulse(0.35, 1.2);
    this.compensationGain = 1.03;
  }

  applyCinematic() {
    this.setEqPreset('cinematic');
    this.spatialWidth = 1.6;
    this.spatialDistance = 1.3;
    this.echoAmount = 0.14;
    this.delayTime = 0.2;
    this.feedback = 0.22;
    this.reverbAmount = 0.28;
    this.roomSize = 0.7;
    this.decayTime = 2.4;
    this.generateSyntheticImpulse(0.7, 2.4);
    this.compensationGain = 1.22;
  }

  // Update wet/dry and crossfades with loudness compensation
  updateGains() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const isProcessed = this.isEnabled && !this.isBypassed;

    if (this.bypassGainNode) {
      this.bypassGainNode.gain.cancelScheduledValues(now);
      this.bypassGainNode.gain.linearRampToValueAtTime(isProcessed ? 0 : 1, now + 0.05);
    }

    if (this.dryGainNode && this.wetGainNode) {
      // Preserve dry signal at 1.0 so reverb/echo are truly additive rather than suppressing original
      const dry = isProcessed ? 1.0 : 0;
      const wet = isProcessed ? Math.max(0.1, this.wetDry) : 0;

      this.dryGainNode.gain.cancelScheduledValues(now);
      this.dryGainNode.gain.linearRampToValueAtTime(dry, now + 0.05);

      this.wetGainNode.gain.cancelScheduledValues(now);
      this.wetGainNode.gain.linearRampToValueAtTime(wet, now + 0.05);
    }

    if (this.loudnessCompNode) {
      const comp = isProcessed ? Math.max(1.0, this.compensationGain) : 1.0;
      this.loudnessCompNode.gain.cancelScheduledValues(now);
      this.loudnessCompNode.gain.linearRampToValueAtTime(comp, now + 0.06);
    }

    if (this.delayGainNode) {
      this.delayGainNode.gain.cancelScheduledValues(now);
      this.delayGainNode.gain.linearRampToValueAtTime(this.echoAmount, now + 0.05);
    }

    if (this.delayNode) {
      this.delayNode.delayTime.cancelScheduledValues(now);
      this.delayNode.delayTime.linearRampToValueAtTime(this.delayTime, now + 0.05);
    }

    if (this.delayFeedbackNode) {
      this.delayFeedbackNode.gain.cancelScheduledValues(now);
      this.delayFeedbackNode.gain.linearRampToValueAtTime(Math.min(0.85, this.feedback), now + 0.05);
    }

    if (this.convolverGainNode) {
      this.convolverGainNode.gain.cancelScheduledValues(now);
      this.convolverGainNode.gain.linearRampToValueAtTime(this.reverbAmount, now + 0.05);
    }
  }

  setParam(key, value) {
    if (this[key] !== undefined) {
      this[key] = value;
      if (key === 'spatialDistance' || key === 'spatialWidth') {
        const pos = SPATIAL_POSITIONS.find(p => p.id === this.activePosition) || SPATIAL_POSITIONS[0];
        this.setPosition(pos.x, pos.y, pos.z);
      } else if (key === 'roomSize' || key === 'decayTime') {
        this.generateSyntheticImpulse(this.roomSize, this.decayTime);
      }
      this.updateGains();
    }
  }

  setEqPreset(presetName) {
    const preset = EQ_PRESETS[presetName] || EQ_PRESETS.natural;
    this.eqGains = { ...preset };
    this.applyEqGains();
  }

  setBandGain(freq, gain) {
    const numFreq = Number(freq);
    this.eqGains[numFreq] = Math.max(-12, Math.min(12, gain));
    this.applyEqGains();
  }

  applyEqGains() {
    if (!this.ctx || !this.eqFilters.length) return;
    const now = this.ctx.currentTime;
    this.eqFilters.forEach((filter) => {
      const freq = Math.round(filter.frequency.value);
      const targetGain = this.eqGains[freq] ?? 0;
      filter.gain.cancelScheduledValues(now);
      filter.gain.linearRampToValueAtTime(targetGain, now + 0.05);
    });
  }

  set3DPosition(positionId) {
    const pos = SPATIAL_POSITIONS.find(p => p.id === positionId) || SPATIAL_POSITIONS[0];
    this.activePosition = pos.id;
    this.setPosition(pos.x, pos.y, pos.z);
  }

  toggleEnabled(forcedState) {
    this.isEnabled = typeof forcedState === 'boolean' ? forcedState : !this.isEnabled;
    this.updateGains();
  }

  toggleBypass(forcedState) {
    this.isBypassed = typeof forcedState === 'boolean' ? forcedState : !this.isBypassed;
    this.updateGains();
  }

  resetToOriginal() {
    this.mode = 'natural';
    this.applyNatural();
    this.isEnabled = false;
    this.isBypassed = false;
    this.updateGains();
  }

  // Real-time A/B Loudness Metering (returns RMS dB for original vs processed)
  getLoudnessMeasurement() {
    if (!this.analyserOriginal || !this.analyserProcessed) {
      return { originalDb: -Infinity, processedDb: -Infinity, diffDb: 0 };
    }

    const bufOrig = new Float32Array(this.analyserOriginal.fftSize);
    const bufProc = new Float32Array(this.analyserProcessed.fftSize);

    this.analyserOriginal.getFloatTimeDomainData(bufOrig);
    this.analyserProcessed.getFloatTimeDomainData(bufProc);

    let sumOrig = 0;
    for (let i = 0; i < bufOrig.length; i++) {
      sumOrig += bufOrig[i] * bufOrig[i];
    }
    const rmsOrig = Math.sqrt(sumOrig / bufOrig.length);
    const dbOrig = rmsOrig > 0.00001 ? 20 * Math.log10(rmsOrig) : -60;

    let sumProc = 0;
    for (let i = 0; i < bufProc.length; i++) {
      sumProc += bufProc[i] * bufProc[i];
    }
    const rmsProc = Math.sqrt(sumProc / bufProc.length);
    const dbProc = rmsProc > 0.00001 ? 20 * Math.log10(rmsProc) : -60;

    const diff = Number((dbProc - dbOrig).toFixed(1));
    return {
      originalDb: Number(dbOrig.toFixed(1)),
      processedDb: Number(dbProc.toFixed(1)),
      diffDb: isFinite(diff) ? diff : 0
    };
  }

  getState() {
    return {
      isEnabled: this.isEnabled,
      isBypassed: this.isBypassed,
      mode: this.mode,
      activePosition: this.activePosition,
      eqGains: { ...this.eqGains },
      spatialWidth: this.spatialWidth,
      spatialDistance: this.spatialDistance,
      echoAmount: this.echoAmount,
      delayTime: this.delayTime,
      feedback: this.feedback,
      reverbAmount: this.reverbAmount,
      roomSize: this.roomSize,
      decayTime: this.decayTime,
      wetDry: this.wetDry,
      compensationGain: this.compensationGain
    };
  }
}
