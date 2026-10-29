import { safeGet, safeSet, STORAGE_KEYS } from '../utils/storage.js';

/**
 * 10-Band Graphic Equalizer Frequency Bands
 * ISO Standard Center Frequencies: 31 Hz to 16 kHz
 */
export const EQ_BANDS = [
  { freq: 31, label: '31Hz', type: 'lowshelf', q: 0.7 },
  { freq: 62, label: '62Hz', type: 'peaking', q: 1.4 },
  { freq: 125, label: '125Hz', type: 'peaking', q: 1.4 },
  { freq: 250, label: '250Hz', type: 'peaking', q: 1.4 },
  { freq: 500, label: '500Hz', type: 'peaking', q: 1.4 },
  { freq: 1000, label: '1kHz', type: 'peaking', q: 1.4 },
  { freq: 2000, label: '2kHz', type: 'peaking', q: 1.4 },
  { freq: 4000, label: '4kHz', type: 'peaking', q: 1.4 },
  { freq: 8000, label: '8kHz', type: 'peaking', q: 1.4 },
  { freq: 16000, label: '16kHz', type: 'highshelf', q: 0.7 },
];

/**
 * Frequency-to-Gain Presets (-12 dB to +12 dB)
 */
export const EQ_PRESETS = {
  flat: {
    id: 'flat',
    name: 'Flat',
    values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  bass_boost: {
    id: 'bass_boost',
    name: 'Bass Boost',
    values: [6, 6, 5, 3, 1, 0, 0, 0, 0, 0],
  },
  treble_boost: {
    id: 'treble_boost',
    name: 'Treble Boost',
    values: [0, 0, 0, 0, 0, 1, 3, 5, 6, 6],
  },
  vocal: {
    id: 'vocal',
    name: 'Vocal',
    values: [-2, -1, 0, 3, 5, 5, 3, 1, 0, -1],
  },
  rock: {
    id: 'rock',
    name: 'Rock',
    values: [5, 4, 2, -1, -2, 0, 2, 4, 5, 5],
  },
  pop: {
    id: 'pop',
    name: 'Pop',
    values: [-1, 2, 5, 4, 2, -1, 1, 3, 4, 3],
  },
  classical: {
    id: 'classical',
    name: 'Classical',
    values: [4, 3, 2, 2, -1, -1, 0, 2, 4, 4],
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
};

const STORAGE_KEY = STORAGE_KEYS?.EQUALIZER || 'afterhours_equalizer_settings';

/**
 * Clamps dB gain strictly within [-12, +12]
 */
export function clampGain(val) {
  const num = Number(val);
  if (isNaN(num)) return 0;
  return Math.max(-12, Math.min(12, Math.round(num)));
}

/**
 * Checks whether an array of 10 gain values matches any defined preset
 */
export function findMatchingPreset(gains) {
  if (!Array.isArray(gains) || gains.length !== 10) return 'custom';
  for (const [key, preset] of Object.entries(EQ_PRESETS)) {
    if (key === 'custom') continue;
    const matches = preset.values.every((val, i) => Math.round(val) === Math.round(gains[i]));
    if (matches) return key;
  }
  return 'custom';
}

/**
 * Validates stored equalizer settings with fallback to Flat
 */
export function validateSettings(raw) {
  const fallback = {
    enabled: true,
    preset: 'flat',
    gains: [...EQ_PRESETS.flat.values],
    customGains: [...EQ_PRESETS.flat.values],
  };

  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : true;

  let gains = Array.isArray(raw.gains) && raw.gains.length === 10
    ? raw.gains.map(clampGain)
    : [...EQ_PRESETS.flat.values];

  let customGains = Array.isArray(raw.customGains) && raw.customGains.length === 10
    ? raw.customGains.map(clampGain)
    : [...gains];

  let preset = typeof raw.preset === 'string' && EQ_PRESETS[raw.preset]
    ? raw.preset
    : findMatchingPreset(gains);

  return {
    enabled,
    preset,
    gains,
    customGains,
  };
}

class AudioEqualizerService {
  constructor() {
    this.listeners = new Set();
    this.audioElement = null;

    // Load initial validated settings
    const stored = safeGet(STORAGE_KEY, null);
    const validated = validateSettings(stored);

    this.enabled = validated.enabled;
    this.preset = validated.preset;
    this.gains = validated.gains;
    this.customGains = validated.customGains;
  }

  /**
   * Register a subscriber for settings updates
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    const state = this.getSettings();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.warn('[AudioEqualizerService] Listener error:', err);
      }
    }
  }

  save() {
    safeSet(STORAGE_KEY, {
      enabled: this.enabled,
      preset: this.preset,
      gains: this.gains,
      customGains: this.customGains,
    });
  }

  getSettings() {
    return {
      enabled: this.enabled,
      preset: this.preset,
      gains: [...this.gains],
      customGains: [...this.customGains],
      isAttached: Boolean(this.audioElement?._loopraAudioContext),
    };
  }

  /**
   * Connects the 10-band Web Audio API graph to an HTMLAudioElement.
   * Ensures nodes are only created once per audio element (preventing duplicate graphs).
   */
  attachToAudioElement(audioElement) {
    if (!audioElement || typeof window === 'undefined') return;

    this.audioElement = audioElement;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('[AudioEqualizerService] Web Audio API not supported in this browser.');
      return;
    }

    // Reuse existing audio context & nodes on the audio element if already attached
    let ctx = audioElement._loopraAudioContext;
    if (!ctx) {
      try {
        ctx = new AudioContextClass();
        audioElement._loopraAudioContext = ctx;
      } catch (err) {
        console.warn('[AudioEqualizerService] Failed to create AudioContext:', err);
        return;
      }
    }

    if (!audioElement._loopraEqNodes) {
      try {
        const sourceNode = ctx.createMediaElementSource(audioElement);

        // Build 10 BiquadFilterNode chain
        const filters = EQ_BANDS.map((band) => {
          const filter = ctx.createBiquadFilter();
          filter.type = band.type;
          filter.frequency.value = band.freq;
          if (band.q) filter.Q.value = band.q;
          filter.gain.value = 0;
          return filter;
        });

        // Anti-clipping limiter (DynamicsCompressorNode)
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -0.5; // dB
        limiter.knee.value = 12;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003; // 3ms fast attack
        limiter.release.value = 0.25; // 250ms release

        // Master Gain Node for unity signal routing
        const masterGain = ctx.createGain();
        masterGain.gain.value = 1.0;

        // Chain filters in series: source -> filter[0] -> ... -> filter[9] -> limiter -> masterGain -> destination
        let prevNode = sourceNode;
        filters.forEach((filter) => {
          prevNode.connect(filter);
          prevNode = filter;
        });

        prevNode.connect(limiter);
        limiter.connect(masterGain);
        masterGain.connect(ctx.destination);

        audioElement._loopraSourceNode = sourceNode;
        audioElement._loopraEqNodes = filters;
        audioElement._loopraLimiter = limiter;
        audioElement._loopraMasterGain = masterGain;

        // Auto-resume audio context on user-initiated play if suspended by browser autoplay policy
        audioElement.addEventListener('play', () => {
          this.resume();
        });
      } catch (err) {
        // MediaElementAudioSourceNode can throw InvalidStateError if already connected
        console.warn('[AudioEqualizerService] Audio graph setup warning:', err);
      }
    }

    // Apply current settings to the filters immediately
    this.applyFiltersToGraph();
    this.notify();
  }

  /**
   * Resumes a suspended AudioContext (handles browser autoplay restrictions)
   */
  async resume() {
    const ctx = this.audioElement?._loopraAudioContext;
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn('[AudioEqualizerService] AudioContext resume failed:', err);
      }
    }
  }

  /**
   * Internal helper to apply stored gains to BiquadFilterNodes
   */
  applyFiltersToGraph() {
    const filters = this.audioElement?._loopraEqNodes;
    const ctx = this.audioElement?._loopraAudioContext;
    if (!filters || !ctx) return;

    filters.forEach((filter, idx) => {
      const targetGain = this.enabled ? (this.gains[idx] || 0) : 0;
      if (filter.gain.setTargetAtTime) {
        // Smooth exponential transition over 30ms to prevent popping or clicking
        filter.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.03);
      } else {
        filter.gain.value = targetGain;
      }
    });
  }

  /**
   * Adjusts a single band gain in real-time
   */
  setBandGain(index, value) {
    if (index < 0 || index >= 10) return;

    const clamped = clampGain(value);
    const newGains = [...this.gains];
    newGains[index] = clamped;
    this.gains = newGains;

    // Detect if new configuration matches an existing preset
    const matched = findMatchingPreset(newGains);
    this.preset = matched;
    if (matched === 'custom') {
      this.customGains = [...newGains];
    }

    this.applyFiltersToGraph();
    this.save();
    this.notify();
  }

  /**
   * Replaces all 10 band gains simultaneously
   */
  setBands(newGains) {
    if (!Array.isArray(newGains) || newGains.length !== 10) return;

    this.gains = newGains.map(clampGain);
    const matched = findMatchingPreset(this.gains);
    this.preset = matched;
    if (matched === 'custom') {
      this.customGains = [...this.gains];
    }

    this.applyFiltersToGraph();
    this.save();
    this.notify();
  }

  /**
   * Enables or bypasses the equalizer.
   * When bypassed, all filters smoothly transition to 0 dB unity gain without stopping playback.
   */
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.applyFiltersToGraph();
    this.save();
    this.notify();
  }

  /**
   * Selects an equalizer preset (Flat, Bass Boost, Treble Boost, Vocal, Rock, Pop, Classical, Custom)
   */
  setPreset(presetId) {
    if (!EQ_PRESETS[presetId]) return;

    this.preset = presetId;
    if (presetId === 'custom') {
      this.gains = [...this.customGains];
    } else {
      this.gains = [...EQ_PRESETS[presetId].values];
    }

    this.applyFiltersToGraph();
    this.save();
    this.notify();
  }

  /**
   * Resets equalizer to Flat (0 dB across all 10 bands)
   */
  reset() {
    this.setPreset('flat');
  }

  /**
   * Detaches and disconnects audio nodes safely if element is discarded
   */
  disconnect() {
    if (this.audioElement?._loopraEqNodes) {
      try {
        this.audioElement._loopraEqNodes.forEach((node) => node.disconnect());
      } catch (e) {}
    }
    if (this.audioElement?._loopraMasterGain) {
      try {
        this.audioElement._loopraMasterGain.disconnect();
      } catch (e) {}
    }
  }
}

export const audioEqualizerService = new AudioEqualizerService();
export default audioEqualizerService;
