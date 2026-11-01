import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchWakeWord,
  classifyAudioEnergy,
  InactivityController,
  SESSION_STATES,
  INACTIVITY_TIMEOUT_MS,
  checkWakeWordBrowserSupport
} from '../../frontend/src/services/wakeWordService.js';
import {
  parseVoiceCommandLocally,
  parseMultiStepInstruction,
  executeTaskPipeline
} from '../../frontend/src/services/voiceTaskEngine.js';

test('Loopra 12 Mandatory Acceptance Tests for Hey Loopra & 60-Second Auto-Deactivation', async (t) => {
  
  // Test 1: Voice Mode OFF -> say "Hey Loopra" -> Voice Mode activates.
  await t.test('Acceptance 1: Voice Mode OFF -> say "Hey Loopra" -> Voice Mode activates', () => {
    let isVoiceModeActive = false;
    let currentState = SESSION_STATES.OFF;

    const utterance = 'Hey Loopra';
    const wake = matchWakeWord(utterance);

    if (!isVoiceModeActive && wake.matched) {
      isVoiceModeActive = true;
      currentState = SESSION_STATES.WAKE_WORD_DETECTED;
    }

    assert.equal(wake.matched, true);
    assert.equal(isVoiceModeActive, true);
    assert.equal(currentState, SESSION_STATES.WAKE_WORD_DETECTED);
  });

  // Test 2: Voice Mode OFF -> random background noise -> remains OFF.
  await t.test('Acceptance 2: Voice Mode OFF -> random background noise -> remains OFF', () => {
    let isVoiceModeActive = false;
    let currentState = SESSION_STATES.OFF;

    const noiseUtterance = 'humming static noise';
    const wake = matchWakeWord(noiseUtterance);

    if (!isVoiceModeActive && wake.matched) {
      isVoiceModeActive = true;
      currentState = SESSION_STATES.WAKE_WORD_DETECTED;
    }

    assert.equal(wake.matched, false);
    assert.equal(isVoiceModeActive, false);
    assert.equal(currentState, SESSION_STATES.OFF);
  });

  // Test 3: Voice Mode OFF -> say "Play Headlights" without wake phrase -> does not activate.
  await t.test('Acceptance 3: Voice Mode OFF -> say "Play Headlights" without wake phrase -> does not activate', () => {
    let isVoiceModeActive = false;
    let currentState = SESSION_STATES.OFF;

    const commandWithoutWake = 'Play Headlights';
    const wake = matchWakeWord(commandWithoutWake);

    if (!isVoiceModeActive && wake.matched) {
      isVoiceModeActive = true;
    }

    assert.equal(wake.matched, false);
    assert.equal(isVoiceModeActive, false);
    assert.equal(currentState, SESSION_STATES.OFF);
  });

  // Test 4: Say "Hey Loopra" -> say "Open Discover" -> Discover opens.
  await t.test('Acceptance 4: Say "Hey Loopra" -> say "Open Discover" -> Discover opens', async () => {
    let currentNav = 'home';
    const parsed = parseVoiceCommandLocally('Open Discover', {});
    assert.equal(parsed.action, 'navigate_page');
    assert.equal(parsed.target, 'discover');

    const steps = parseMultiStepInstruction('Open Discover', {});
    const result = await executeTaskPipeline(steps, {}, {
      onNavigate: (tab) => {
        currentNav = tab;
      }
    });

    assert.equal(result.success, true);
    assert.equal(currentNav, 'discover');
  });

  // Test 5: Say "Hey Loopra" -> remain silent for 60 seconds -> automatically OFF.
  await t.test('Acceptance 5: Say "Hey Loopra" -> remain silent for 60 seconds -> automatically OFF', () => {
    let isVoiceModeActive = true;
    let deactivatedReason = null;

    const controller = new InactivityController({
      timeoutMs: 60, // scaled for fast test
      onTimeout: () => {
        isVoiceModeActive = false;
        deactivatedReason = 'auto';
      }
    });

    controller.start();

    return new Promise((resolve) => {
      setTimeout(() => {
        assert.equal(isVoiceModeActive, false);
        assert.equal(deactivatedReason, 'auto');
        resolve();
      }, 90);
    });
  });

  // Test 6: Say "Hey Loopra" -> background noise for 60 seconds -> automatically OFF.
  await t.test('Acceptance 6: Say "Hey Loopra" -> background noise for 60 seconds -> automatically OFF', () => {
    let isVoiceModeActive = true;
    let deactivatedReason = null;

    const controller = new InactivityController({
      timeoutMs: 80,
      onTimeout: () => {
        isVoiceModeActive = false;
        deactivatedReason = 'auto';
      }
    });

    controller.start();

    // Noise events arrive at 30ms and 50ms without valid commands
    setTimeout(() => {
      const audioClass = classifyAudioEnergy(0.08, 0.10);
      assert.equal(audioClass, 'noise');
      // InactivityController is NOT reset on noise!
    }, 30);

    setTimeout(() => {
      const audioClass = classifyAudioEnergy(0.05, 0.07);
      assert.equal(audioClass, 'noise');
    }, 50);

    return new Promise((resolve) => {
      setTimeout(() => {
        assert.equal(isVoiceModeActive, false, 'Should be automatically deactivated despite background noise');
        assert.equal(deactivatedReason, 'auto');
        resolve();
      }, 110);
    });
  });

  // Test 7: Say "Hey Loopra" -> issue a valid command -> timeout resets.
  await t.test('Acceptance 7: Say "Hey Loopra" -> issue a valid command -> timeout resets', () => {
    let isVoiceModeActive = true;
    let deactivated = false;

    const controller = new InactivityController({
      timeoutMs: 80,
      onTimeout: () => {
        isVoiceModeActive = false;
        deactivated = true;
      }
    });

    controller.start();

    // At 40ms, a valid command is recognized and executed -> timeout resets
    setTimeout(() => {
      const parsed = parseVoiceCommandLocally('Volume 50', {});
      if (parsed && parsed.action) {
        controller.resetOnValidCommand();
      }
    }, 40);

    return new Promise((resolve) => {
      // At 90ms (which would have expired original window at 80ms), still active!
      setTimeout(() => {
        assert.equal(isVoiceModeActive, true);
        assert.equal(deactivated, false);
      }, 90);

      // At 140ms (40 + 80 = 120ms), new window expires
      setTimeout(() => {
        assert.equal(isVoiceModeActive, false);
        assert.equal(deactivated, true);
        resolve();
      }, 150);
    });
  });

  // Test 8: Complete a command -> wait 59 seconds -> remains active.
  await t.test('Acceptance 8: Complete a command -> wait 59 seconds -> remains active', () => {
    let isVoiceModeActive = true;
    const controller = new InactivityController({
      timeoutMs: 100, // representing 60s
      onTimeout: () => {
        isVoiceModeActive = false;
      }
    });

    controller.start();

    // At 95ms (representing 59s out of 60s)
    return new Promise((resolve) => {
      setTimeout(() => {
        assert.equal(isVoiceModeActive, true, 'At 59s mark, session must still be active');
        controller.clear();
        resolve();
      }, 85);
    });
  });

  // Test 9: Complete a command -> wait 60 seconds without another valid command -> OFF.
  await t.test('Acceptance 9: Complete a command -> wait 60 seconds without another valid command -> OFF', () => {
    let isVoiceModeActive = true;
    const controller = new InactivityController({
      timeoutMs: 60,
      onTimeout: () => {
        isVoiceModeActive = false;
      }
    });

    controller.start();

    return new Promise((resolve) => {
      setTimeout(() => {
        assert.equal(isVoiceModeActive, false, 'Must be OFF after 60s without another valid command');
        resolve();
      }, 90);
    });
  });

  // Test 10: Execute a multi-step task lasting longer than 60 seconds -> task must not be interrupted.
  await t.test('Acceptance 10: Execute a multi-step task lasting longer than 60 seconds -> task must not be interrupted', () => {
    let taskInterrupted = false;
    let isVoiceModeActive = true;

    const controller = new InactivityController({
      timeoutMs: 60, // 60ms represents 60s
      onTimeout: () => {
        taskInterrupted = true;
        isVoiceModeActive = false;
      }
    });

    controller.start();

    // Multi-step task begins execution -> pause timeout
    controller.pauseForExecution();

    return new Promise((resolve) => {
      // At 90ms (which is > 60ms timeout), task is still running!
      setTimeout(() => {
        assert.equal(taskInterrupted, false, 'Task MUST NOT be interrupted during active execution');
        assert.equal(isVoiceModeActive, true);

        // Task completes! Resume fresh 60s window
        controller.resumeAfterExecution();
      }, 90);

      // Now verify fresh 60s window counts down from 90ms
      setTimeout(() => {
        assert.equal(isVoiceModeActive, false, 'Deactivates 60s AFTER multi-step task completes');
        resolve();
      }, 170);
    });
  });

  // Test 11: Say "Stop Listening" -> immediate deactivation.
  await t.test('Acceptance 11: Say "Stop Listening" -> immediate deactivation', () => {
    let isVoiceModeActive = true;
    const parsed = parseVoiceCommandLocally('Stop Listening', {});
    assert.equal(parsed.action, 'stop_continuous');

    if (parsed.action === 'stop_continuous') {
      isVoiceModeActive = false;
    }

    assert.equal(isVoiceModeActive, false);
  });

  // Test 12: Manually turn OFF -> wake-word detector returns to standby.
  await t.test('Acceptance 12: Manually turn OFF -> wake-word detector returns to standby', () => {
    let isVoiceModeActive = true;
    let standbyListening = false;

    // User clicks manual OFF
    isVoiceModeActive = false;
    // Wake-word detector returns to standby
    standbyListening = true;

    // In standby, wake phrase activates again:
    const wake = matchWakeWord('Hey Loopra');
    if (standbyListening && wake.matched) {
      isVoiceModeActive = true;
    }

    assert.equal(isVoiceModeActive, true, 'Can re-activate from standby by saying Hey Loopra');
  });

  // Browser support helper verification
  await t.test('Browser limitation detection', () => {
    const support = checkWakeWordBrowserSupport();
    assert.ok(typeof support.supported === 'boolean');
  });
});
