import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

// Import audioEqualizerService modules directly
import { 
  EQ_BANDS, 
  EQ_PRESETS, 
  clampGain, 
  findMatchingPreset, 
  validateSettings, 
  audioEqualizerService 
} from '../../frontend/src/services/audioEqualizerService.js';

describe('Audio Equalizer Service & Presets Verification', () => {
  it('1. Verifies 10 ISO standard equalizer frequency bands', () => {
    assert.strictEqual(EQ_BANDS.length, 10, 'Must have exactly 10 bands');

    const expectedFrequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    const expectedLabels = ['31Hz', '62Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];

    EQ_BANDS.forEach((band, i) => {
      assert.strictEqual(band.freq, expectedFrequencies[i], `Band ${i} frequency must be ${expectedFrequencies[i]}`);
      assert.strictEqual(band.label, expectedLabels[i], `Band ${i} label must be ${expectedLabels[i]}`);
    });

    assert.strictEqual(EQ_BANDS[0].type, 'lowshelf', 'First band must be lowshelf');
    assert.strictEqual(EQ_BANDS[9].type, 'highshelf', 'Tenth band must be highshelf');
    for (let i = 1; i <= 8; i++) {
      assert.strictEqual(EQ_BANDS[i].type, 'peaking', `Band ${i} must be peaking filter`);
    }
  });

  it('2. Verifies all required presets exist with valid 10-band gain values', () => {
    const requiredPresets = ['flat', 'bass_boost', 'treble_boost', 'vocal', 'rock', 'pop', 'classical', 'custom'];
    
    requiredPresets.forEach((key) => {
      assert.ok(EQ_PRESETS[key], `Preset "${key}" must exist`);
      assert.strictEqual(EQ_PRESETS[key].values.length, 10, `Preset "${key}" must have 10 values`);
      EQ_PRESETS[key].values.forEach((v) => {
        assert.ok(v >= -12 && v <= 12, `Gain ${v} in preset "${key}" must be within [-12, +12]`);
      });
    });

    // Verify Flat is zero dB across all bands
    assert.deepStrictEqual(EQ_PRESETS.flat.values, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    // Verify Bass Boost emphasizes low frequencies
    assert.ok(EQ_PRESETS.bass_boost.values[0] > 0 && EQ_PRESETS.bass_boost.values[1] > 0);

    // Verify Treble Boost emphasizes high frequencies
    assert.ok(EQ_PRESETS.treble_boost.values[8] > 0 && EQ_PRESETS.treble_boost.values[9] > 0);

    // Verify Vocal boosts mid presence
    assert.ok(EQ_PRESETS.vocal.values[4] > 0 && EQ_PRESETS.vocal.values[5] > 0);
  });

  it('3. Verifies gain clamping and preset matching logic', () => {
    assert.strictEqual(clampGain(15), 12, 'Values above +12 must clamp to +12');
    assert.strictEqual(clampGain(-20), -12, 'Values below -12 must clamp to -12');
    assert.strictEqual(clampGain(4.6), 5, 'Floating values round to integer dB');
    assert.strictEqual(clampGain('NaN'), 0, 'Invalid values return 0');

    // Matching
    assert.strictEqual(findMatchingPreset([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'flat');
    assert.strictEqual(findMatchingPreset(EQ_PRESETS.bass_boost.values), 'bass_boost');
    assert.strictEqual(findMatchingPreset(EQ_PRESETS.rock.values), 'rock');
    assert.strictEqual(findMatchingPreset([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 'custom');
  });

  it('4. Validates stored settings and fallbacks for corrupted data', () => {
    const fallback = validateSettings(null);
    assert.strictEqual(fallback.enabled, true);
    assert.strictEqual(fallback.preset, 'flat');
    assert.deepStrictEqual(fallback.gains, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const corrupted = validateSettings({
      enabled: 'not-a-bool',
      preset: 'unknown_preset_123',
      gains: [50, -50], // invalid length
    });
    assert.strictEqual(corrupted.enabled, true);
    assert.strictEqual(corrupted.preset, 'flat');
    assert.deepStrictEqual(corrupted.gains, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const validCustom = validateSettings({
      enabled: false,
      preset: 'custom',
      gains: [2, 3, 4, 2, 0, -1, -2, 1, 2, 3],
      customGains: [2, 3, 4, 2, 0, -1, -2, 1, 2, 3],
    });
    assert.strictEqual(validCustom.enabled, false);
    assert.strictEqual(validCustom.preset, 'custom');
    assert.deepStrictEqual(validCustom.gains, [2, 3, 4, 2, 0, -1, -2, 1, 2, 3]);
  });

  it('5. Verifies AudioEqualizerService preset switching, reset, and band adjustment', () => {
    // Test preset switching
    audioEqualizerService.setPreset('rock');
    assert.strictEqual(audioEqualizerService.preset, 'rock');
    assert.deepStrictEqual(audioEqualizerService.gains, EQ_PRESETS.rock.values);

    // Adjusting a single band should shift to 'custom'
    audioEqualizerService.setBandGain(0, 11);
    assert.strictEqual(audioEqualizerService.preset, 'custom');
    assert.strictEqual(audioEqualizerService.gains[0], 11);

    // Resetting should restore Flat (0 dB)
    audioEqualizerService.reset();
    assert.strictEqual(audioEqualizerService.preset, 'flat');
    assert.deepStrictEqual(audioEqualizerService.gains, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    // Test bypass toggle
    audioEqualizerService.setEnabled(false);
    assert.strictEqual(audioEqualizerService.enabled, false);
    audioEqualizerService.setEnabled(true);
    assert.strictEqual(audioEqualizerService.enabled, true);
  });
});

describe('Real Web Audio API Mock & Graph Lifecycle Verification', () => {
  function createMockAudioContext() {
    const createdNodes = {
      sources: [],
      filters: [],
      compressors: [],
      gains: [],
    };

    class MockAudioParam {
      constructor(val = 0) {
        this.value = val;
      }
      setTargetAtTime(target, time, constant) {
        this.value = target;
      }
    }

    class MockAudioNode {
      constructor(type) {
        this.type = type;
        this.connectedTo = [];
      }
      connect(target) {
        this.connectedTo.push(target);
        return target;
      }
      disconnect() {
        this.connectedTo = [];
      }
    }

    class MockBiquadFilterNode extends MockAudioNode {
      constructor() {
        super('BiquadFilter');
        this.frequency = new MockAudioParam(1000);
        this.gain = new MockAudioParam(0);
        this.Q = new MockAudioParam(1);
        createdNodes.filters.push(this);
      }
    }

    class MockDynamicsCompressorNode extends MockAudioNode {
      constructor() {
        super('DynamicsCompressor');
        this.threshold = new MockAudioParam(-0.5);
        this.knee = new MockAudioParam(12);
        this.ratio = new MockAudioParam(12);
        this.attack = new MockAudioParam(0.003);
        this.release = new MockAudioParam(0.25);
        createdNodes.compressors.push(this);
      }
    }

    class MockGainNode extends MockAudioNode {
      constructor() {
        super('Gain');
        this.gain = new MockAudioParam(1);
        createdNodes.gains.push(this);
      }
    }

    class MockAudioContext {
      constructor() {
        this.state = 'running';
        this.currentTime = 0;
        this.destination = new MockAudioNode('Destination');
      }
      createMediaElementSource(element) {
        if (element._hasConnectedSource) {
          const err = new Error('HTMLMediaElement already connected to an audio source node.');
          err.name = 'InvalidStateError';
          throw err;
        }
        element._hasConnectedSource = true;
        const source = new MockAudioNode('MediaElementSource');
        createdNodes.sources.push(source);
        return source;
      }
      createBiquadFilter() {
        return new MockBiquadFilterNode();
      }
      createDynamicsCompressor() {
        return new MockDynamicsCompressorNode();
      }
      createGain() {
        return new MockGainNode();
      }
      async resume() {
        this.state = 'running';
      }
    }

    return { MockAudioContext, createdNodes };
  }

  it('6. Attaches Web Audio graph correctly and modulates filters in real time', () => {
    const { MockAudioContext, createdNodes } = createMockAudioContext();

    // Setup global window environment for testing
    globalThis.window = {
      AudioContext: MockAudioContext,
      webkitAudioContext: MockAudioContext,
    };

    const mockAudioElement = {
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    // Attach to element
    audioEqualizerService.attachToAudioElement(mockAudioElement);

    assert.ok(mockAudioElement._loopraAudioContext, 'Must create and attach AudioContext');
    assert.strictEqual(createdNodes.sources.length, 1, 'Must create exactly 1 MediaElementSource');
    assert.strictEqual(createdNodes.filters.length, 10, 'Must create exactly 10 BiquadFilterNodes');
    assert.strictEqual(createdNodes.compressors.length, 1, 'Must create 1 dynamics compressor for anti-clipping');
    assert.strictEqual(createdNodes.gains.length, 1, 'Must create 1 master gain node');

    // Test filter parameter modulation
    audioEqualizerService.setPreset('bass_boost');
    const filters = mockAudioElement._loopraEqNodes;
    assert.strictEqual(filters.length, 10);
    assert.strictEqual(filters[0].gain.value, 6, 'First band gain should be +6 dB');
    assert.strictEqual(filters[1].gain.value, 6, 'Second band gain should be +6 dB');

    // Test bypass sets all filter gains to 0 dB without stopping audio
    audioEqualizerService.setEnabled(false);
    filters.forEach((filter, idx) => {
      assert.strictEqual(filter.gain.value, 0, `Filter ${idx} must be 0 dB when bypassed`);
    });

    // Test re-enabling restores preset gains
    audioEqualizerService.setEnabled(true);
    assert.strictEqual(filters[0].gain.value, 6);

    // Track change test: Re-attaching to the same audio element must NOT throw or create duplicate source nodes
    audioEqualizerService.attachToAudioElement(mockAudioElement);
    assert.strictEqual(createdNodes.sources.length, 1, 'Must not create duplicate source nodes on track change');
  });
});

describe('UI & YouTube Honesty Contract Verification', () => {
  const modalPath = path.join(rootDir, 'frontend', 'src', 'components', 'Player', 'EqualizerModal.jsx');
  const appPath = path.join(rootDir, 'frontend', 'src', 'App.jsx');

  it('7. EqualizerModal displays honest capability message for YouTube vs Direct Audio', () => {
    assert.ok(fs.existsSync(modalPath), 'EqualizerModal.jsx must exist');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    // Check honest message for YouTube
    assert.match(modalContent, /Equalizer is unavailable for this playback source\./,
      'Must contain explicit notice when playback source cannot be processed');
    assert.match(modalContent, /YouTube streams play inside a sandboxed cross-origin player/,
      'Must explain YouTube CORS sandbox restriction');

    // Check message for direct audio
    assert.match(modalContent, /Equalizer Active — Processing Direct Audio/,
      'Must confirm active processing for direct audio sources');

    // Check presets are all rendered
    ['Flat', 'Bass Boost', 'Treble Boost', 'Vocal', 'Rock', 'Pop', 'Classical', 'Custom'].forEach((name) => {
      assert.ok(modalContent.includes(name) || modalContent.includes('EQ_PRESETS'), `Modal must render preset: ${name}`);
    });

    // Check Reset button
    assert.match(modalContent, /Reset to Flat/, 'Must provide a Reset button');
    assert.match(modalContent, /Equalizer On.*Equalizer Off/s, 'Must have On/Off toggle');
  });

  it('8. App.jsx provides accessible EQ buttons in desktop footer, expanded player, and mobile player', () => {
    const appContent = fs.readFileSync(appPath, 'utf8');

    assert.match(appContent, /import \{ audioEqualizerService \} from '\.\/services\/audioEqualizerService'/,
      'App.jsx must import audioEqualizerService');
    assert.match(appContent, /audioEqualizerService\.attachToAudioElement\(audio\)/,
      'App.jsx must attach audioEqualizerService to direct audio element');
    assert.match(appContent, /audioEqualizerService\.resume\(\)/,
      'App.jsx must resume audio context on play');

    // Check that Equalizer button is present in the player footer
    assert.match(appContent, /title="10-Band Graphic Equalizer"/,
      'Player bar must include Equalizer button');
  });
});

