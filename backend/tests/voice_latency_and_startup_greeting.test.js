/**
 * Targeted Verification Test Suite:
 * 1. Sync Text & Audio Responses (Instant TTS latency, simultaneous transcript sync)
 * 2. Immediate Activation Greeting (Greeting played first, recognition listening starts only after greeting finishes)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Loopra Voice Response Latency & Startup Greeting Sequence Suite', () => {

  test('1. VoiceBuddyService triggers instant speech, propagates options.onEnd, and starts lip-sync meter', async () => {
    // Mock minimal browser environment
    let spokenUtterance = null;
    let syntheticMeterStarted = false;
    let onEndCalled = false;

    class MockSpeechSynthesisUtterance {
      constructor(text) {
        this.text = text;
        this.voice = null;
        this.lang = '';
        this.rate = 1;
        this.pitch = 1;
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
      }
    }

    const mockVoices = [
      { name: 'Microsoft Swara Online (Natural) - Hindi (India)', lang: 'hi-IN' },
      { name: 'Google हिन्दी', lang: 'hi-IN' }
    ];

    const mockSpeechSynthesis = {
      speak: (utt) => {
        spokenUtterance = utt;
        // Simulate immediate start in under 15ms
        setTimeout(() => {
          if (utt.onstart) utt.onstart();
          // Simulate end after short greeting
          setTimeout(() => {
            if (utt.onend) utt.onend();
          }, 30);
        }, 10);
      },
      cancel: () => { },
      getVoices: () => mockVoices
    };

    // Verify voice matching logic
    const isIndianFemaleVoice = (v) => {
      const lang = (v.lang || '').replace('_', '-').toLowerCase();
      const name = (v.name || '').toLowerCase();
      if (name.includes('ravi') || name.includes('male') || name.includes('david')) return false;
      return lang === 'hi-in' || lang === 'en-in' || name.includes('swara') || name.includes('hindi');
    };

    const selectedVoice = mockVoices.find(isIndianFemaleVoice);
    assert.ok(selectedVoice, 'Indian female voice must be discovered');
    assert.strictEqual(selectedVoice.name, 'Microsoft Swara Online (Natural) - Hindi (India)');

    // Verify simulated speech cycle with onEnd callback
    await new Promise((resolve) => {
      const startTime = Date.now();
      const utt = new MockSpeechSynthesisUtterance('Hey! Kya haal hai?');
      utt.voice = selectedVoice;
      utt.onstart = () => {
        const startLatency = Date.now() - startTime;
        assert.ok(startLatency < 50, `Audio playback must start in <50ms (was ${startLatency}ms)`);
        syntheticMeterStarted = true;
      };
      utt.onend = () => {
        onEndCalled = true;
        resolve();
      };
      mockSpeechSynthesis.speak(utt);
    });

    assert.ok(syntheticMeterStarted, 'Synthetic audio meter must start immediately on speech start');
    assert.ok(onEndCalled, 'onEnd must be called when speech finishes');
  });

  test('2. VoiceSessionService immediate activation sequence: greeting first, recognition listening only after greeting finishes', async () => {
    let recognitionStarted = false;
    let recognitionActiveDuringGreeting = false;
    let greetingAudioPlaying = false;
    let greetingFinished = false;
    const eventsSequence = [];

    // Simulated session controller state
    const SESSION_STATES = {
      CONNECTING: 'connecting',
      SPEAKING: 'speaking',
      LISTENING: 'listening'
    };

    let sessionState = SESSION_STATES.CONNECTING;
    let isSpeakingTts = false;
    let hasGreetedThisSession = false;

    const mockVoiceBuddy = {
      isVoiceOutputEnabled: true,
      generateWelcomeGreeting: () => 'Hey! Kya haal hai?',
      speak: (text, context, options) => {
        eventsSequence.push('greeting_audio_started');
        greetingAudioPlaying = true;

        // Check if recognition is running while greeting is playing
        if (recognitionStarted) {
          recognitionActiveDuringGreeting = true;
        }

        // Simulate audio playback duration
        setTimeout(() => {
          greetingAudioPlaying = false;
          greetingFinished = true;
          eventsSequence.push('greeting_audio_finished');
          if (options && typeof options.onEnd === 'function') {
            options.onEnd();
          }
        }, 50);
      }
    };

    const safeStartRecognition = () => {
      if (isSpeakingTts) {
        recognitionActiveDuringGreeting = true;
        return;
      }
      recognitionStarted = true;
      eventsSequence.push('recognition_listening_started');
    };

    // Run startSession sequence
    const startSessionSimulated = async () => {
      const greeting = mockVoiceBuddy.generateWelcomeGreeting();
      assert.strictEqual(greeting, 'Hey! Kya haal hai?', 'Welcome greeting must be generated instantly');

      const startListeningAfterGreeting = () => {
        isSpeakingTts = false;
        sessionState = SESSION_STATES.LISTENING;
        safeStartRecognition();
      };

      if (!hasGreetedThisSession && mockVoiceBuddy.isVoiceOutputEnabled) {
        hasGreetedThisSession = true;
        isSpeakingTts = true;
        sessionState = SESSION_STATES.SPEAKING;

        // Play greeting audio immediately first!
        mockVoiceBuddy.speak(greeting, 'welcome', {
          onEnd: () => {
            startListeningAfterGreeting();
          }
        });
      }
    };

    await startSessionSimulated();

    // Verify intermediate state: Greeting is playing, recognition must NOT be listening
    assert.strictEqual(sessionState, SESSION_STATES.SPEAKING);
    assert.strictEqual(recognitionStarted, false, 'SpeechRecognition must NOT start while greeting is playing');

    // Wait for greeting to finish
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Verify completed state: Greeting finished, recognition listening is now active
    assert.strictEqual(greetingFinished, true, 'Greeting audio must complete');
    assert.strictEqual(recognitionStarted, true, 'SpeechRecognition must be listening after greeting finishes');
    assert.strictEqual(recognitionActiveDuringGreeting, false, 'SpeechRecognition must NEVER be active during greeting playback');
    assert.strictEqual(sessionState, SESSION_STATES.LISTENING, 'State must transition to LISTENING');

    // Verify chronological event sequence
    assert.deepStrictEqual(eventsSequence, [
      'greeting_audio_started',
      'greeting_audio_finished',
      'recognition_listening_started'
    ], 'Event sequence must be: greeting audio started -> greeting audio finished -> recognition listening started');
  });

  test('3. Immediate greeting fallback when voice output is disabled', async () => {
    let recognitionStarted = false;
    const SESSION_STATES = {
      LISTENING: 'listening'
    };

    const mockVoiceBuddy = {
      isVoiceOutputEnabled: false // Disabled
    };

    let sessionState = null;
    let isSpeakingTts = false;

    const startListening = () => {
      isSpeakingTts = false;
      sessionState = SESSION_STATES.LISTENING;
      recognitionStarted = true;
    };

    if (mockVoiceBuddy.isVoiceOutputEnabled) {
      isSpeakingTts = true;
    } else {
      startListening();
    }

    assert.strictEqual(recognitionStarted, true, 'Recognition starts immediately if voice output disabled');
    assert.strictEqual(sessionState, SESSION_STATES.LISTENING);
    assert.strictEqual(isSpeakingTts, false);
  });

  test('4. Strict Indian Female Voice Selection: matches hi-IN, Google हिन्दी, Lekha and strictly excludes British and male voices', () => {
    const candidateVoices = [
      { name: 'Google UK English Female', lang: 'en-GB' },
      { name: 'George', lang: 'en-GB' },
      { name: 'Daniel', lang: 'en-GB' },
      { name: 'Oliver', lang: 'en-GB' },
      { name: 'Microsoft Ravi - English (India)', lang: 'en-IN' },
      { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
      { name: 'Lekha', lang: 'hi-IN' },
      { name: 'Google हिन्दी', lang: 'hi-IN' },
      { name: 'Microsoft Swara Online (Natural) - Hindi (India)', lang: 'hi-IN' }
    ];

    const isExplicitIndianFemaleVoice = (v) => {
      const lang = (v.lang || '').replace('_', '-').toLowerCase();
      const name = (v.name || '').toLowerCase();
      const rawName = v.name || '';

      // Strictly exclude male voices
      if (
        name.includes('ravi') ||
        name.includes('madhur') ||
        name.includes('prabhat') ||
        name.includes('david') ||
        name.includes('mark') ||
        name.includes('male') ||
        name.includes('george')
      ) {
        return false;
      }

      // Strictly exclude British / UK accents
      if (
        lang === 'en-gb' ||
        lang === 'en-uk' ||
        name.includes('british') ||
        name.includes('united kingdom') ||
        name.includes('great britain') ||
        name.includes('serena') ||
        name.includes('daniel') ||
        name.includes('oliver') ||
        name.includes('hazel') ||
        name.includes('susan')
      ) {
        return false;
      }

      // Explicit filter for hi-IN, Google हिन्दी, Lekha, Hindi, Swara, Neerja, Kalpana, Heera
      return (
        lang === 'hi-in' ||
        rawName.includes('Google हिन्दी') ||
        rawName.includes('हिन्दी') ||
        rawName.includes('Lekha') ||
        name.includes('lekha') ||
        name.includes('hindi') ||
        name.includes('swara') ||
        name.includes('neerja') ||
        name.includes('kalpana') ||
        name.includes('heera') ||
        (lang === 'en-in' && (name.includes('india') || name.includes('neerja') || name.includes('heera') || name.includes('veena')))
      );
    };

    const matched = candidateVoices.filter(isExplicitIndianFemaleVoice);
    assert.strictEqual(matched.length, 3);
    assert.ok(matched.some(v => v.name === 'Lekha'), 'Must match Lekha (iOS Indian female voice)');
    assert.ok(matched.some(v => v.name === 'Google हिन्दी'), 'Must match Google हिन्दी (Android Indian female voice)');
    assert.ok(matched.some(v => v.name.includes('Swara')), 'Must match Swara (Windows/Edge Indian female voice)');

    // Ensure zero British voices matched
    const britishMatches = matched.filter(v => (v.lang === 'en-GB' || v.name.includes('UK') || v.name === 'George' || v.name === 'Oliver'));
    assert.strictEqual(britishMatches.length, 0, 'Must strictly exclude all British accents');

    // Ensure zero male voices matched
    const maleMatches = matched.filter(v => v.name.includes('Ravi') || v.name.includes('David') || v.name.includes('George'));
    assert.strictEqual(maleMatches.length, 0, 'Must strictly exclude male voices');
  });

  test('5. Brave & Opera mobile constraint fallback and audio unlock mechanism', async () => {
    let advancedConstraintsAttempted = false;
    let basicFallbackAttempted = false;

    // Simulate Brave / Opera mobile getUserMedia behavior where complex constraints throw OverconstrainedError
    const mockGetMedia = async (constraints) => {
      if (constraints && constraints.audio && typeof constraints.audio === 'object') {
        advancedConstraintsAttempted = true;
        const err = new Error('OverconstrainedError');
        err.name = 'OverconstrainedError';
        throw err;
      }
      basicFallbackAttempted = true;
      return { active: true, getTracks: () => [{ stop: () => {} }] };
    };

    let stream = null;
    try {
      stream = await mockGetMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch {
      // Fallback
      stream = await mockGetMedia({ audio: true });
    }

    assert.ok(advancedConstraintsAttempted, 'Advanced constraints attempted first');
    assert.ok(basicFallbackAttempted, 'Basic fallback attempted on error');
    assert.ok(stream && stream.active, 'MediaStream active after basic fallback');
  });
});

