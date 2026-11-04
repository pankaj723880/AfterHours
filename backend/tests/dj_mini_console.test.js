/**
 * dj_mini_console.test.js
 * Comprehensive automated verification for the Loopra Mini DJ Mixing Console
 * 
 * Tests:
 * 1. Exports verification (15 Beat Styles, 8 Bass items, 12 SFX, 5 Patterns)
 * 2. Web Audio API mock harness execution
 * 3. Individual testing of all 15 beat styles (BPM, scheduling, drum/bass tracks)
 * 4. Individual testing of all 8 BOOM-BOOM bass library generators
 * 5. Individual testing of all 12 DJ sound effects
 * 6. Advanced DJ controls (3-band EQ, Intensity, BPM, Pattern, Echo, Reverb, Faders, Mute)
 * 7. Live trigger functions: Beat Drop & Bass Drop
 * 8. Beat synchronization event dispatching
 */

import assert from 'assert';

// Mock Web Audio API environment for Node.js
class MockAudioNode {
  constructor() {
    this.gain = {
      setValueAtTime: () => {},
      linearRampToValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {}
    };
    this.frequency = {
      setValueAtTime: () => {},
      linearRampToValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {}
    };
    this.Q = {
      setValueAtTime: () => {}
    };
    this.delayTime = {
      setValueAtTime: () => {}
    };
  }
  connect() {}
  disconnect() {}
  start() {}
  stop() {}
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0.1;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = new MockAudioNode();
  }

  createGain() { return new MockAudioNode(); }
  createOscillator() { return new MockAudioNode(); }
  createBiquadFilter() { return new MockAudioNode(); }
  createDelay() { return new MockAudioNode(); }
  createConvolver() { return new MockAudioNode(); }
  createDynamicsCompressor() {
    return {
      threshold: { setValueAtTime: () => {} },
      knee: { setValueAtTime: () => {} },
      ratio: { setValueAtTime: () => {} },
      attack: { setValueAtTime: () => {} },
      release: { setValueAtTime: () => {} },
      connect: () => {}
    };
  }
  createBuffer(channels, length, sampleRate) {
    return {
      getChannelData: () => new Float32Array(length)
    };
  }
  createBufferSource() { return new MockAudioNode(); }
  createWaveShaper() {
    return {
      curve: null,
      oversample: 'none',
      connect: () => {}
    };
  }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

global.window = {
  AudioContext: MockAudioContext,
  webkitAudioContext: MockAudioContext
};

async function runTestSuite() {
  console.log('=== STARTING MINI DJ MIXING CONSOLE VERIFICATION ===\n');

  const {
    djAudio,
    BEAT_CATEGORIES,
    BEAT_STYLES,
    BASS_LIBRARY,
    SFX_LIBRARY,
    BEAT_PATTERNS
  } = await import('../../frontend/src/components/DjClub/djAudioEngine.js');

  // Test 1: Data Definitions & Libraries
  console.log('[1/8] Verifying Catalog Sizes...');
  assert.strictEqual(BEAT_CATEGORIES.length, 4, 'Must have 4 Beat Categories');
  assert.strictEqual(BEAT_STYLES.length, 15, 'Must have 15 Beat Styles');
  assert.strictEqual(BASS_LIBRARY.length, 8, 'Must have 8 BOOM-BOOM Bass Library Items');
  assert.strictEqual(SFX_LIBRARY.length, 12, 'Must have 12 DJ Sound Effects');
  assert.strictEqual(BEAT_PATTERNS.length, 5, 'Must have 5 Beat Patterns');
  console.log('  ✓ 4 Categories, 15 Styles, 8 Bass items, 12 SFX, 5 Patterns verified.');

  // Test 2: Audio Context & DSP Initialization
  console.log('[2/8] Initializing Audio Engine & DSP Graph...');
  const initSuccess = djAudio.ensureContext();
  assert.ok(initSuccess, 'AudioContext should initialize successfully');
  assert.ok(djAudio.compressor, 'Dynamics Compressor should be initialized');
  assert.ok(djAudio.lowShelf && djAudio.midPeaking && djAudio.highShelf, '3-Band EQ nodes must exist');
  assert.ok(djAudio.echoDelayNode && djAudio.reverbConvolver, 'Echo & Reverb nodes must exist');
  console.log('  ✓ AudioContext, Compressor, 3-Band EQ, Echo Delay & Reverb Convolver initialized.');

  // Test 3: Beat Synchronization Dispatcher
  console.log('[3/8] Testing Beat Synchronization...');
  let beatEventsReceived = [];
  const unsubscribe = djAudio.onBeat((evt) => {
    beatEventsReceived.push(evt);
  });
  djAudio.notifyBeat({ isKick: true, intensity: 1.0, sfxType: 'test' });
  assert.strictEqual(beatEventsReceived.length, 1, 'Listener should receive beat event');
  assert.strictEqual(beatEventsReceived[0].isKick, true, 'Event must carry kick flag');
  unsubscribe();
  console.log('  ✓ Real-time Beat Synchronization event dispatcher operational.');

  // Test 4: Testing Every Beat Style (15/15)
  console.log('[4/8] Testing all 15 Beat Styles...');
  for (const style of BEAT_STYLES) {
    djAudio.setStyle(style.id);
    assert.strictEqual(djAudio.currentStyle, style.id, `Style must be set to ${style.id}`);
    assert.strictEqual(djAudio.bpm, style.defaultBpm, `BPM must match style default (${style.defaultBpm})`);

    // Execute 16-step grid for this style
    for (let step = 0; step < 16; step++) {
      assert.doesNotThrow(() => {
        djAudio.scheduleStep(step, djAudio.ctx.currentTime + step * 0.1);
      }, `Style ${style.id} must execute step ${step} without errors`);
    }
    console.log(`  ✓ Style [${style.name}] @ ${style.defaultBpm} BPM: 16-step grid rendered cleanly`);
  }

  // Test 5: Testing Every BOOM-BOOM Bass Library Item (8/8)
  console.log('\n[5/8] Testing all 8 BOOM-BOOM Bass Library Items...');
  for (const bass of BASS_LIBRARY) {
    assert.doesNotThrow(() => {
      djAudio.triggerBassItem(bass.id);
    }, `Bass item [${bass.name}] must synthesize without errors`);
    console.log(`  ✓ Bass [${bass.name}] (${bass.tag}): Triggered successfully`);
  }

  // Test 6: Testing Every DJ Sound Effect (12/12)
  console.log('\n[6/8] Testing all 12 DJ Sound Effects...');
  for (const sfx of SFX_LIBRARY) {
    assert.doesNotThrow(() => {
      djAudio.triggerSfxItem(sfx.id);
    }, `SFX [${sfx.name}] must trigger without errors`);
    console.log(`  ✓ SFX [${sfx.name}] (${sfx.icon}): Triggered successfully`);
  }

  // Test 7: Testing Advanced DJ Controls
  console.log('\n[7/8] Testing Advanced DJ Controls...');
  
  // 3-Band EQ
  djAudio.setEqBass(6);
  assert.strictEqual(djAudio.eqBass, 6, 'EQ Bass must be +6dB');
  djAudio.setEqMid(-3);
  assert.strictEqual(djAudio.eqMid, -3, 'EQ Mid must be -3dB');
  djAudio.setEqTreble(4);
  assert.strictEqual(djAudio.eqTreble, 4, 'EQ Treble must be +4dB');
  console.log('  ✓ 3-Band EQ (Bass: +6dB, Mid: -3dB, Treble: +4dB) verified');

  // Intensity & Saturation
  djAudio.setBeatIntensity(0.9);
  assert.ok(djAudio.beatIntensity > 1.0, 'Beat intensity should scale drive gain');
  console.log('  ✓ Beat Intensity / Drive saturation verified');

  // BPM & Custom Tempo
  djAudio.setBpm(138);
  assert.strictEqual(djAudio.bpm, 138, 'BPM must be updated to 138');
  console.log('  ✓ BPM adjustment & custom tempo slider verified');

  // Beat Patterns
  for (const p of BEAT_PATTERNS) {
    djAudio.setPattern(p.id);
    assert.strictEqual(djAudio.currentPattern, p.id, `Pattern must be ${p.id}`);
  }
  console.log('  ✓ 5 Beat Patterns (Straight, Syncopated, Half-time, Triplet, Drop Mode) verified');

  // Echo & Reverb
  djAudio.setEchoAmount(0.4);
  assert.strictEqual(djAudio.echoAmount, 0.4, 'Echo amount must be 0.4');
  djAudio.setReverbAmount(0.5);
  assert.strictEqual(djAudio.reverbAmount, 0.5, 'Reverb amount must be 0.5');
  console.log('  ✓ Studio Echo Delay & Reverb Space send levels verified');

  // Faders & Mute
  djAudio.setBeatsVolume(0.75);
  assert.strictEqual(djAudio.beatsVolume, 0.75, 'Beats volume must be 0.75');
  djAudio.setSfxVolume(0.9);
  assert.strictEqual(djAudio.sfxVolume, 0.9, 'SFX volume must be 0.9');
  const isMuted = djAudio.toggleMute();
  assert.strictEqual(isMuted, true, 'Audio must toggle to muted');
  djAudio.toggleMute();
  assert.strictEqual(djAudio.isMuted, false, 'Audio must toggle back to unmuted');
  console.log('  ✓ Dual Volume Faders & Master Mute verified');

  // Test 8: Live Drop Functions
  console.log('\n[8/8] Testing Quick Drop Triggers...');
  assert.doesNotThrow(() => {
    djAudio.triggerLiveBassDrop();
  }, 'Live Bass Drop must execute');
  console.log('  ✓ ⚡ Live Bass Drop executed');

  assert.doesNotThrow(() => {
    djAudio.triggerBeatDrop();
  }, 'Beat Drop sequence must execute');
  console.log('  ✓ 💥 Live Beat Drop executed');

  djAudio.destroy();
  console.log('\n=== ALL MINI DJ MIXING CONSOLE TESTS PASSED (100% SUCCESS) ===');
}

runTestSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
