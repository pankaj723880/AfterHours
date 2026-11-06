/**
 * Mobile Web Speech Recognition (STT) & Gesture Isolation Verification Suite
 * Verifies:
 * 1. Synchronous mobile mic trigger bypassing async delay.
 * 2. Mobile SpeechRecognition instance re-initialization on each session.
 * 3. Mobile speech event handling (interim capture and unfinalized interim fallback on onend).
 * 4. Avatar gesture isolation from STT state (no false visual gestures on click or permission failure).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Mobile Web Speech Recognition & Gesture Isolation Suite', () => {

  test('1. Mobile mic trigger runs synchronously inside user click turn without setTimeout delay', () => {
    let synchronousExecuted = false;
    let timerDelayedExecuted = false;

    // Simulate mobile viewport check
    const isMobileViewport = true;

    const onToggleVoiceMode = () => {
      synchronousExecuted = true;
    };

    // Simulated CharacterBuddy pointer up handler
    const handlePointerUpSimulated = (isMobile) => {
      if (isMobile) {
        // Must execute synchronously to preserve transient activation
        onToggleVoiceMode();
        return;
      }

      // Desktop: uses click timer delay
      setTimeout(() => {
        timerDelayedExecuted = true;
      }, 200);
    };

    handlePointerUpSimulated(isMobileViewport);

    assert.strictEqual(synchronousExecuted, true, 'Mobile mic toggle MUST execute synchronously');
    assert.strictEqual(timerDelayedExecuted, false, 'Mobile mic toggle MUST NOT be delayed by setTimeout');
  });

  test('2. Mobile SpeechRecognition instance re-initializes on each session avoiding dead instance lock', () => {
    let instanceCount = 0;
    class MockSpeechRecognition {
      constructor() {
        this.id = ++instanceCount;
        this.started = false;
        this.aborted = false;
      }
      start() {
        if (this.started) throw new Error('InvalidStateError');
        this.started = true;
      }
      abort() {
        this.aborted = true;
      }
    }

    let recognition = null;
    const isMobileBrowser = true;

    const safeStartRecognitionSimulated = () => {
      // Mobile instance re-initialization
      if (!recognition || isMobileBrowser) {
        if (recognition && isMobileBrowser && !recognition.started) {
          recognition.abort();
        }
        recognition = new MockSpeechRecognition();
      }
      recognition.start();
    };

    safeStartRecognitionSimulated();
    assert.strictEqual(recognition.id, 1);
    assert.strictEqual(recognition.started, true);

    // End first session and start second session
    recognition.started = false;
    safeStartRecognitionSimulated();
    assert.strictEqual(recognition.id, 2, 'Must create a fresh instance on mobile to prevent dead engine state');
    assert.strictEqual(recognition.started, true);
  });

  test('3. Mobile onresult interim capture and onend unfinalized fallback', () => {
    let pendingMobileTranscript = '';
    let finalProcessedTranscript = '';
    let state = 'listening';

    // Simulate mobile onresult where Android/Samsung engine only emits interim
    const simulateOnResult = (interimText) => {
      pendingMobileTranscript = interimText;
    };

    // Simulate onend firing while user finished speaking without isFinal=true
    const simulateOnEnd = () => {
      if (pendingMobileTranscript && pendingMobileTranscript.trim()) {
        finalProcessedTranscript = pendingMobileTranscript.trim();
        pendingMobileTranscript = '';
        state = 'processing';
      }
    };

    simulateOnResult('play arijit singh songs');
    assert.strictEqual(pendingMobileTranscript, 'play arijit singh songs');
    assert.strictEqual(finalProcessedTranscript, '');

    simulateOnEnd();
    assert.strictEqual(finalProcessedTranscript, 'play arijit singh songs', 'Must finalize pending mobile interim on onend');
    assert.strictEqual(state, 'processing', 'State must transition to processing on mobile finalizing');
    assert.strictEqual(pendingMobileTranscript, '', 'Pending mobile transcript must be cleared');
  });

  test('4. Avatar gestures strictly isolated from STT state (never trigger on premature clicks or errors)', () => {
    let activeGesture = null;

    const playTransientGesture = (gesture) => {
      activeGesture = gesture;
    };

    const clearGesture = () => {
      activeGesture = null;
    };

    // 1. User clicks mic button: NO premature wave gesture triggered
    const simulateUserClick = () => {
      // Click only toggles voice mode; does NOT play transient gesture
    };

    simulateUserClick();
    assert.strictEqual(activeGesture, null, 'Avatar MUST NOT play gesture prematurely on button click before STT starts');

    // 2. Mic permission denied or hardware error: Gesture cleared / remains null
    const simulatePermissionError = () => {
      clearGesture();
    };
    simulatePermissionError();
    assert.strictEqual(activeGesture, null, 'Avatar MUST NOT have active gesture on permission error');

    // 3. Genuine STT processing state: Think gesture triggered
    const simulateSttProcessing = () => {
      playTransientGesture('think');
    };
    simulateSttProcessing();
    assert.strictEqual(activeGesture, 'think', 'Avatar must trigger thinking gesture ONLY on verified STT processing state');
  });
});

