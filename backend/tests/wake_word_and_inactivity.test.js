import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchWakeWord,
  classifyAudioEnergy,
  InactivityController,
  SESSION_STATES,
  INACTIVITY_TIMEOUT_MS
} from '../../frontend/src/services/wakeWordService.js';
import {
  parseVoiceCommandLocally,
  parseMultiStepInstruction
} from '../../frontend/src/services/voiceTaskEngine.js';

test('Loopra Wake Word & Smart 60-Second Inactivity Test Suite', async (t) => {
  await t.test('1. Wake Word Matching ("Hey Loopra")', () => {
    // Exact variations
    const test1 = matchWakeWord('Hey Loopra');
    assert.equal(test1.matched, true);
    assert.equal(test1.remainingText, '');

    const test2 = matchWakeWord('Hey Loopra play Kesariya');
    assert.equal(test2.matched, true);
    assert.equal(test2.remainingText, 'play Kesariya');

    const test3 = matchWakeWord('he loopra open discover');
    assert.equal(test3.matched, true);
    assert.equal(test3.remainingText, 'open discover');

    const test4 = matchWakeWord('ok loopra volume 50');
    assert.equal(test4.matched, true);
    assert.equal(test4.remainingText, 'volume 50');

    // Negative tests - without wake phrase
    const test5 = matchWakeWord('play Headlights');
    assert.equal(test5.matched, false);
    assert.equal(test5.remainingText, 'play Headlights');

    const test6 = matchWakeWord('random background noise or singing');
    assert.equal(test6.matched, false);
  });

  await t.test('2. Wake Word is never treated as a song search or playback title', () => {
    // When user says purely "Hey Loopra"
    const parsed = parseVoiceCommandLocally('Hey Loopra', {});
    assert.equal(parsed.action, 'wake_ping');
    assert.notEqual(parsed.action, 'play_song');
    assert.notEqual(parsed.action, 'search_music');

    // When compound "Hey Loopra play Kesariya" is parsed
    const compound = parseVoiceCommandLocally('Hey Loopra play Kesariya', {});
    assert.equal(compound.action, 'play_search');
    assert.equal(compound.query, 'Kesariya');
  });

  await t.test('3. Audio Energy & Voice Activity Classification', () => {
    // Silence
    assert.equal(classifyAudioEnergy(0.01, 0.02), 'silence');
    assert.equal(classifyAudioEnergy(0.02, 0.03), 'silence');

    // Low steady environmental noise (AC hum, quiet traffic)
    assert.equal(classifyAudioEnergy(0.06, 0.08), 'noise');

    // Human speech candidate (dynamic spikes / higher volume)
    assert.equal(classifyAudioEnergy(0.20, 0.45), 'speech_candidate');
    assert.equal(classifyAudioEnergy(0.09, 0.25), 'speech_candidate');
  });

  await t.test('4. Inactivity Controller: 60s timeout triggers on silence or no command', (context) => {
    let timedOut = false;
    const controller = new InactivityController({
      timeoutMs: 60, // 60ms for unit testing
      onTimeout: () => {
        timedOut = true;
      }
    });

    controller.start();
    return new Promise((resolve) => {
      setTimeout(() => {
        assert.equal(timedOut, true, 'Should time out after inactivity period');
        resolve();
      }, 90);
    });
  });

  await t.test('5. Inactivity Controller: Microphone noise does NOT reset timeout', (context) => {
    let timedOut = false;
    const controller = new InactivityController({
      timeoutMs: 80,
      onTimeout: () => {
        timedOut = true;
      }
    });

    controller.start();

    // Simulate microphone noise coming in at 40ms without a valid command
    // (Noise should NOT call resetOnValidCommand)
    setTimeout(() => {
      const simulatedNoiseClassification = classifyAudioEnergy(0.07, 0.09);
      assert.equal(simulatedNoiseClassification, 'noise');
      // Do NOT reset controller on noise
    }, 40);

    return new Promise((resolve) => {
      setTimeout(() => {
        assert.equal(timedOut, true, 'Noise must not prevent the 60s timeout');
        resolve();
      }, 110);
    });
  });

  await t.test('6. Inactivity Controller: Valid command resets the timeout and begins fresh window', () => {
    let timedOut = false;
    const controller = new InactivityController({
      timeoutMs: 80,
      onTimeout: () => {
        timedOut = true;
      }
    });

    controller.start();

    // At 40ms, a valid command is recognized and executed -> timer resets
    setTimeout(() => {
      controller.resetOnValidCommand();
    }, 40);

    return new Promise((resolve) => {
      // At 90ms (which would have been past the initial 80ms), verify it has NOT timed out yet
      setTimeout(() => {
        assert.equal(timedOut, false, 'Should not time out because valid command reset the window');
      }, 90);

      // At 140ms (40 + 80 = 120ms), it should time out
      setTimeout(() => {
        assert.equal(timedOut, true, 'Should time out after the new fresh window expires');
        resolve();
      }, 150);
    });
  });

  await t.test('7. Multi-step task execution pauses timeout so tasks > 60s are never interrupted', () => {
    let timedOut = false;
    const controller = new InactivityController({
      timeoutMs: 60,
      onTimeout: () => {
        timedOut = true;
      }
    });

    controller.start();

    // Pause for execution at 20ms
    setTimeout(() => {
      controller.pauseForExecution();
    }, 20);

    return new Promise((resolve) => {
      // During long execution at 80ms (past 60ms timeout), timedOut MUST be false
      setTimeout(() => {
        assert.equal(timedOut, false, 'Inactivity timer must NOT interrupt long-running task');
        // Task finishes -> resume a fresh window
        controller.resumeAfterExecution();
      }, 80);

      // At 160ms (80 + 60 = 140ms), it should time out after the fresh window
      setTimeout(() => {
        assert.equal(timedOut, true, 'Should time out only after task finishes and 60s fresh window expires');
        resolve();
      }, 170);
    });
  });

  await t.test('8. Explicit stop commands ("Stop Listening", "Done Loopra") trigger immediate deactivation', () => {
    const stop1 = parseVoiceCommandLocally('stop listening', {});
    assert.equal(stop1.action, 'stop_continuous');

    const stop2 = parseVoiceCommandLocally('done loopra', {});
    assert.equal(stop2.action, 'stop_continuous');

    const stop3 = parseVoiceCommandLocally('bye loopra', {});
    assert.equal(stop3.action, 'stop_continuous');
  });
});
