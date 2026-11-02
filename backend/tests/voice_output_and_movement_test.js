import { voiceBuddyService } from '../../frontend/src/services/voiceBuddyService.js';

console.log('🧪 Running Loopra Voice Output & Playback Suppression Tests...');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✅ Passed: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
  }
}

// Test 1: Music Playback Suppression
voiceBuddyService.setVoiceOutput(true);
voiceBuddyService.setPlaybackActive(true);
assert(voiceBuddyService.isMusicPlaying() === true, 'isMusicPlaying() returns true when playback is active');

let receivedEvent = null;
let receivedData = null;
const unsub = voiceBuddyService.subscribe((data) => {
  receivedEvent = data.event;
  receivedData = data;
});

await voiceBuddyService.speak('Opening Saloon FM for you');
assert(receivedEvent === 'speech_text_only', 'TTS audio is suppressed during playback and emits speech_text_only');
assert(receivedData?.reason === 'playback_active', 'Suppression reason is playback_active');

// Test 2: Voice Output Manual OFF Toggle
voiceBuddyService.setPlaybackActive(false);
voiceBuddyService.setVoiceOutput(false);
assert(voiceBuddyService.isVoiceOutputEnabled === false, 'Voice output can be toggled OFF');

receivedEvent = null;
receivedData = null;
await voiceBuddyService.speak('Paused');
assert(receivedEvent === 'speech_text_only', 'When voice output is OFF, speech is suppressed as speech_text_only');
assert(receivedData?.reason === 'voice_output_disabled', 'Suppression reason is voice_output_disabled');

// Test 3: Voice Output Manual ON Toggle when playback paused
voiceBuddyService.setVoiceOutput(true);
assert(voiceBuddyService.isVoiceOutputEnabled === true, 'Voice output can be toggled ON');
assert(voiceBuddyService.isMusicPlaying() === false, 'Playback is not active');

unsub();

console.log(`\n🎉 Result: ${passed}/${total} Voice Output & Suppression tests passed!`);
if (passed === total) process.exit(0);
else process.exit(1);

