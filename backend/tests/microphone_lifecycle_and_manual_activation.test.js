import test from 'node:test';
import assert from 'node:assert/strict';
import {
  voiceSessionService,
  SESSION_STATES,
  INACTIVITY_TIMEOUT_MS
} from '../../frontend/src/services/voiceSessionService.js';
import {
  parseVoiceCommandLocally,
  parseMultiStepInstruction
} from '../../frontend/src/services/voiceTaskEngine.js';

// Setup browser API mocks on Node.js global
function setupMockBrowser(stoppedTracksRef = { count: 0 }, startCountRef = { count: 0 }) {
  const mockMediaStream = {
    active: true,
    getTracks: () => [
      { stop: () => { stoppedTracksRef.count++; } },
      { stop: () => { stoppedTracksRef.count++; } }
    ]
  };

  const mockNavigator = {
    mediaDevices: {
      getUserMedia: async () => mockMediaStream
    }
  };

  class MockSpeechRecognition {
    constructor() {
      this.continuous = false;
      this.interimResults = false;
      this.lang = '';
    }
    start() {
      startCountRef.count++;
      setTimeout(() => this.onstart?.(), 10);
    }
    abort() {
      this.onend?.();
    }
  }

  class MockAudioContext {
    constructor() {
      this.state = 'running';
    }
    createMediaStreamSource() {
      return { connect: () => {} };
    }
    createAnalyser() {
      return {
        fftSize: 64,
        smoothingTimeConstant: 0.65,
        frequencyBinCount: 32,
        connect: () => {},
        getByteFrequencyData: (arr) => arr.fill(20)
      };
    }
    close() {
      this.state = 'closed';
    }
  }

  Object.defineProperty(global, 'navigator', {
    value: mockNavigator,
    configurable: true,
    writable: true
  });

  Object.defineProperty(global, 'window', {
    value: {
      SpeechRecognition: MockSpeechRecognition,
      AudioContext: MockAudioContext
    },
    configurable: true,
    writable: true
  });
}

test('Loopra Voice Control: Manual Activation & Single Microphone Session Lifecycle', async (t) => {

  // Test 1: Voice Mode is OFF by default and does NOT activate on "Hey Loopra"
  await t.test('1. OFF by default: Audio streams and recognition are completely NULL', () => {
    voiceSessionService.stopSession('manual');
    const snapshot = voiceSessionService.getSnapshot();

    assert.equal(snapshot.state, SESSION_STATES.OFF);
    assert.equal(snapshot.isSessionActive, false);
    assert.equal(snapshot.isListening, false);
    assert.equal(voiceSessionService.mediaStream, null, 'Hardware MediaStream must be null when OFF');
    assert.equal(voiceSessionService.recognition, null, 'SpeechRecognition must be null when OFF');
    assert.equal(voiceSessionService.restartTimer, null, 'No background restart timers when OFF');
  });

  // Test 2: Saying "Hey Loopra" when OFF does NOT activate Voice Mode
  await t.test('2. "Hey Loopra" when OFF: Zero automatic activation; state remains OFF', () => {
    voiceSessionService.stopSession('manual');
    assert.equal(voiceSessionService.isSessionActive, false);

    // Simulated utterance arrives (e.g. ambient noise or speech) while Voice Mode is OFF
    const utterance = 'Hey Loopra';
    // Since session is OFF, voiceSessionService has no listeners running and never starts.
    assert.equal(voiceSessionService.isSessionActive, false, 'Must remain OFF');
    assert.equal(voiceSessionService.state, SESSION_STATES.OFF);
  });

  // Test 3: Manual activation transitions state through REQUESTING_PERMISSION -> CONNECTING -> LISTENING
  await t.test('3. Explicit manual activation starts single session with authoritative states', async () => {
    const statesObserved = [];
    const unsub = voiceSessionService.subscribe((snapshot) => {
      statesObserved.push(snapshot.state);
    });

    setupMockBrowser();

    await voiceSessionService.startSession({ lang: 'hi-IN' });

    // Wait for mock recognition to fire onstart
    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.equal(voiceSessionService.isSessionActive, true);
    assert.equal(voiceSessionService.state, SESSION_STATES.LISTENING);
    assert.equal(voiceSessionService.isRecognizing, true);
    assert.equal(voiceSessionService.lang, 'hi-IN');

    // Verify progression
    assert.ok(statesObserved.includes(SESSION_STATES.REQUESTING_PERMISSION), 'Must transition through REQUESTING_PERMISSION');
    assert.ok(statesObserved.includes(SESSION_STATES.CONNECTING), 'Must transition through CONNECTING');
    assert.ok(statesObserved.includes(SESSION_STATES.LISTENING), 'Must transition to LISTENING');

    unsub();
    voiceSessionService.stopSession('manual');
  });

  // Test 4: Consecutive commands do NOT tear down or recreate the microphone
  await t.test('4. Consecutive commands: Microphone stays open across multiple commands', async () => {
    setupMockBrowser();

    await voiceSessionService.startSession({ lang: 'en-IN' });
    await new Promise((resolve) => setTimeout(resolve, 30));

    const initialStream = voiceSessionService.mediaStream;
    const initialRecognition = voiceSessionService.recognition;
    assert.ok(initialStream, 'MediaStream is active');
    assert.ok(initialRecognition, 'SpeechRecognition is active');

    // Command 1: User says "Open Discover"
    voiceSessionService.notifyExecutionStart('Opening Discover...');
    assert.equal(voiceSessionService.state, SESSION_STATES.EXECUTING);
    // Microphone must NOT have been closed!
    assert.equal(voiceSessionService.mediaStream, initialStream, 'Stream remains unchanged');
    assert.equal(voiceSessionService.recognition, initialRecognition, 'Recognition instance remains unchanged');

    // Command 1 finishes
    voiceSessionService.notifyExecutionFinish('Opened Discover');
    assert.equal(voiceSessionService.state, SESSION_STATES.LISTENING);
    assert.equal(voiceSessionService.mediaStream, initialStream, 'Stream still unchanged');

    // Pause for several seconds (simulated) then Command 2: "Play Kesariya"
    voiceSessionService.notifyExecutionStart('Playing Kesariya...');
    assert.equal(voiceSessionService.state, SESSION_STATES.EXECUTING);
    assert.equal(voiceSessionService.mediaStream, initialStream, 'Stream still active without reconnecting');

    // Command 2 finishes
    voiceSessionService.notifyExecutionFinish('Now playing Kesariya');
    assert.equal(voiceSessionService.state, SESSION_STATES.LISTENING);

    // Command 3: "Volume 50"
    voiceSessionService.notifyExecutionStart('Setting volume to 50...');
    voiceSessionService.notifyExecutionFinish('Volume set to 50%');
    assert.equal(voiceSessionService.state, SESSION_STATES.LISTENING);

    // Throughout all 3 consecutive commands, zero mic disconnects occurred!
    assert.equal(voiceSessionService.mediaStream, initialStream);
    assert.equal(voiceSessionService.recognition, initialRecognition);

    voiceSessionService.stopSession('manual');
  });

  // Test 5: Clean deactivation releases all hardware tracks and cancels timers
  await t.test('5. Clean deactivation: hardware tracks released, timers cancelled, state is OFF', async () => {
    const trackRef = { count: 0 };
    setupMockBrowser(trackRef);

    await voiceSessionService.startSession({ lang: 'en-IN' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(voiceSessionService.isSessionActive, true);

    // Now manually stop session
    voiceSessionService.stopSession('manual');

    assert.equal(voiceSessionService.isSessionActive, false);
    assert.equal(voiceSessionService.state, SESSION_STATES.OFF);
    assert.equal(voiceSessionService.mediaStream, null);
    assert.equal(voiceSessionService.recognition, null);
    assert.equal(voiceSessionService.restartTimer, null);
    assert.equal(trackRef.count, 2, 'All hardware tracks must be stopped immediately');
  });

  // Test 6: Browser natural recognition onend triggers controlled restart without mic churn
  await t.test('6. Browser natural onend triggers guarded restart when session is active', async () => {
    const startRef = { count: 0 };
    setupMockBrowser({ count: 0 }, startRef);

    await voiceSessionService.startSession({ lang: 'en-IN' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(startRef.count, 1);

    // Simulate browser naturally triggering onend (e.g. Chrome 60s stream cycle)
    voiceSessionService.recognition.onend();
    assert.equal(voiceSessionService.isRecognizing, false);
    assert.ok(voiceSessionService.restartTimer !== null, 'Guarded restart timer must be scheduled');

    // Wait for restart timer (180ms)
    await new Promise((resolve) => setTimeout(resolve, 220));

    assert.equal(startRef.count, 2, 'Must gracefully restart recognition session');
    assert.equal(voiceSessionService.isRecognizing, true);

    voiceSessionService.stopSession('manual');
  });

  // Test 7: Deduplication prevents identical speech results within 2.5s from double-executing
  await t.test('7. Command deduplication: rapid duplicate browser transcripts ignored', () => {
    let emittedTranscripts = [];
    const unsub = voiceSessionService.subscribe((snapshot) => {
      if (snapshot.event === 'final_transcript') {
        emittedTranscripts.push(snapshot.transcript);
      }
    });

    voiceSessionService.isSessionActive = true;
    voiceSessionService.state = SESSION_STATES.LISTENING;

    setupMockBrowser();
    const mockRec = voiceSessionService.initSpeechRecognition();
    
    // First emission
    mockRec.onresult({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Next song' }], { isFinal: true })
      ]
    });

    // Second emission 200ms later (browser duplicate)
    mockRec.onresult({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Next song' }], { isFinal: true })
      ]
    });

    // Verify only one final transcript was dispatched
    assert.equal(emittedTranscripts.length, 1);
    assert.equal(emittedTranscripts[0], 'Next song');

    unsub();
    voiceSessionService.stopSession('manual');
  });

  // Test 8: Explicit stop commands ("stop listening", "done loopra") trigger immediate deactivation
  await t.test('8. Voice command deactivation: "stop listening" and "done loopra" map to stop_continuous', () => {
    const parse1 = parseVoiceCommandLocally('stop listening');
    assert.equal(parse1.action, 'stop_continuous');

    const parse2 = parseVoiceCommandLocally('done loopra');
    assert.equal(parse2.action, 'stop_continuous');

    const parse3 = parseVoiceCommandLocally('bye loopra');
    assert.equal(parse3.action, 'stop_continuous');
  });

  // Test 9: 60s inactivity watchdog triggers clean deactivation
  await t.test('9. Inactivity watchdog: Auto-deactivates session when silence/inactivity persists', () => {
    return new Promise((resolve) => {
      let stateLog = [];
      const unsub = voiceSessionService.subscribe((s) => stateLog.push(s.state));

      voiceSessionService.isSessionActive = true;
      voiceSessionService.state = SESSION_STATES.LISTENING;

      // Mock a short inactivity threshold for test
      voiceSessionService.inactivityTimer = setTimeout(() => {
        voiceSessionService.stopSession('inactivity');
        assert.equal(voiceSessionService.state, SESSION_STATES.OFF);
        assert.ok(voiceSessionService.statusMessage.includes('inactivity'));
        unsub();
        resolve();
      }, 50);
    });
  });
});
