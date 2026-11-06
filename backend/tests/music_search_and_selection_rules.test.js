/**
 * Loopra Music Search & Selection Rules Verification Test
 * 
 * Rules Under Test:
 * 1. DEFAULT LANGUAGE: If the user does not specify a language, ALWAYS default to Hindi / Bollywood songs matching the mood.
 * 2. MAINSTREAM ARTISTS ONLY: Strictly search and play songs sung by known, popular, and verified mainstream artists (e.g., Arijit Singh, Atif Aslam, Shreya Ghoshal, Vishal Mishra, etc.).
 * 3. NO JUNK / AI / LOW-VIEWS: Never play AI-generated songs, unknown underground tracks, random covers, or non-music videos (like foreign drama clips or low-view channels). Always pick official audio, lyrical videos, or top music label releases (like T-Series, Sony Music, etc.) with high views and popularity.
 */

import assert from 'assert';
import { normalizeMusicSearchQuery } from '../server.js';
import { verifySingleSong, isMainstreamArtist, MAINSTREAM_VERIFIED_ARTISTS } from '../services/songFilter.js';
import musicValidationService from '../services/musicValidationService.js';
import { interpretMoodPrompt } from '../services/moodClassifier.js';
import { LOOPRA_VOICE_SYSTEM_INSTRUCTION } from '../services/chatBuddyLlmService.js';

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

console.log('🚀 Running Music Search & Selection Rules Verification Suite...\n');

// ==========================================
// TEST SUITE 1: RULE 1 - DEFAULT LANGUAGE (Hindi / Bollywood)
// ==========================================
console.log('--- TEST SUITE 1: RULE 1 - DEFAULT LANGUAGE ---');

runTest('Generic "romantic songs" defaults to Hindi/Bollywood', () => {
  const normalized = normalizeMusicSearchQuery('romantic songs');
  assert(normalized.toLowerCase().includes('hindi') || normalized.toLowerCase().includes('bollywood'), 'Should include hindi or bollywood');
});

runTest('Generic "relaxing music" defaults to Hindi/Bollywood', () => {
  const normalized = normalizeMusicSearchQuery('relaxing music');
  assert(normalized.toLowerCase().includes('hindi') || normalized.toLowerCase().includes('bollywood'), 'Should include hindi or bollywood');
});

runTest('Generic "sad songs" defaults to Hindi/Bollywood', () => {
  const normalized = normalizeMusicSearchQuery('sad songs');
  assert(normalized.toLowerCase().includes('hindi') || normalized.toLowerCase().includes('bollywood'), 'Should include hindi or bollywood');
});

runTest('Generic "party songs" defaults to Hindi/Bollywood', () => {
  const normalized = normalizeMusicSearchQuery('party songs');
  assert(normalized.toLowerCase().includes('bollywood'), 'Should include bollywood');
});

runTest('Mood classifier defaults to Hindi when language unspecified', () => {
  const moodResult = interpretMoodPrompt('play something chill and relaxing');
  assert.strictEqual(moodResult.language, 'hindi', 'Default language must be hindi');
  assert(moodResult.suggestedQueries.some(q => q.includes('hindi') || q.includes('bollywood')), 'Suggested queries must target Hindi/Bollywood');
});

runTest('Explicit language (e.g. "punjabi party songs") preserves user language preference', () => {
  const normalized = normalizeMusicSearchQuery('punjabi party songs');
  assert.strictEqual(normalized, 'punjabi party songs', 'Should preserve explicit language');
});

// ==========================================
// TEST SUITE 2: RULE 2 - MAINSTREAM ARTISTS ONLY
// ==========================================
console.log('\n--- TEST SUITE 2: RULE 2 - MAINSTREAM ARTISTS ONLY ---');

runTest('Mainstream verified artist list contains key legends & hitmakers', () => {
  const required = ['arijit singh', 'atif aslam', 'shreya ghoshal', 'vishal mishra', 'kk', 'sonu nigam'];
  for (const art of required) {
    assert(MAINSTREAM_VERIFIED_ARTISTS.includes(art), `Mainstream artists must include ${art}`);
  }
});

runTest('isMainstreamArtist detects verified artists correctly', () => {
  assert.strictEqual(isMainstreamArtist('Kesariya - Arijit Singh'), true);
  assert.strictEqual(isMainstreamArtist('Jeena Jeena by Atif Aslam'), true);
  assert.strictEqual(isMainstreamArtist('Shreya Ghoshal Live Performance'), true);
  assert.strictEqual(isMainstreamArtist('Pehle Bhi Main - Vishal Mishra'), true);
  assert.strictEqual(isMainstreamArtist('Unknown Underground Bedroom Singer'), false);
});

runTest('Normalized mood queries feature mainstream verified artists', () => {
  const romantic = normalizeMusicSearchQuery('romantic songs');
  const relaxing = normalizeMusicSearchQuery('relaxing music');
  const sad = normalizeMusicSearchQuery('sad songs');

  assert(isMainstreamArtist(romantic), 'Romantic query should feature mainstream artist');
  assert(isMainstreamArtist(relaxing), 'Relaxing query should feature mainstream artist');
  assert(isMainstreamArtist(sad), 'Sad query should feature mainstream artist');
});

// ==========================================
// TEST SUITE 3: RULE 3 - NO JUNK / AI / LOW-VIEWS
// ==========================================
console.log('\n--- TEST SUITE 3: RULE 3 - NO JUNK / AI / LOW-VIEWS ---');

runTest('Strictly rejects AI generated songs and AI covers (songFilter)', () => {
  const aiTracks = [
    { id: 'abcdefghijk', title: 'Arijit Singh AI Cover - Tum Hi Ho Remake', channel: 'AI Music Lab' },
    { id: 'abcdefghijk', title: 'Suno AI Generated Hindi Song 2026', channel: 'Suno Creator' },
    { id: 'abcdefghijk', title: 'Deepfake AI Voice Song - Viral Bollywood Track', channel: 'TechVibes' },
    { id: 'abcdefghijk', title: 'Udio AI Chill Melodies Vol 1', channel: 'Synthetic Beats' }
  ];

  for (const track of aiTracks) {
    const res = verifySingleSong(track);
    assert.strictEqual(res.isValid, false, `Should reject AI track: "${track.title}"`);
    assert.strictEqual(res.verificationStatus, 'rejected_junk_or_ai');
  }
});

runTest('Strictly rejects amateur bedroom covers and fan-made covers', () => {
  const coverTracks = [
    { id: 'abcdefghijk', title: 'Kesariya (Bedroom Cover by Rahul)', channel: 'Rahul Vlogs' },
    { id: 'abcdefghijk', title: 'Tum Hi Ho Acoustic Cover with Tabs', channel: 'GuitarForBeginners' },
    { id: 'abcdefghijk', title: 'Heeriye Fan Made Cover Song', channel: 'RandomChannel' }
  ];

  for (const track of coverTracks) {
    const res = verifySingleSong(track);
    assert.strictEqual(res.isValid, false, `Should reject amateur cover: "${track.title}"`);
  }
});

runTest('Strictly rejects foreign drama clips, edits, and status videos', () => {
  const dramaClips = [
    { id: 'abcdefghijk', title: 'Korean KDrama Edit Heartbroken Scene with Hindi Song', channel: 'KDramaClips' },
    { id: 'abcdefghijk', title: 'Pakistani Drama Emotional Scene WhatsApp Status Video', channel: 'DailyStatus' },
    { id: 'abcdefghijk', title: 'Romantic Movie Scene Climax Reel Edit', channel: 'ShortsDaily' }
  ];

  for (const track of dramaClips) {
    const res = verifySingleSong(track);
    assert.strictEqual(res.isValid, false, `Should reject drama clip: "${track.title}"`);
  }
});

await runAsyncTest('MusicValidationService Layer 2 blocks AI and junk tracks', async () => {
  const aiSample = { id: 'test_ai_001', title: 'AI Song Generated by Suno - Relaxing Beats', channel: 'AI Creator' };
  const valRes = await musicValidationService.validateTrack(aiSample);
  assert.strictEqual(valRes.eligible, false, 'MusicValidationService must disqualify AI generated songs');
});

runTest('System instruction embeds the 3 Music Search & Selection Rules', () => {
  assert(LOOPRA_VOICE_SYSTEM_INSTRUCTION.includes('MUSIC SEARCH & SELECTION RULES'), 'Must include MUSIC SEARCH & SELECTION RULES');
  assert(LOOPRA_VOICE_SYSTEM_INSTRUCTION.includes('DEFAULT LANGUAGE'), 'Must mention DEFAULT LANGUAGE');
  assert(LOOPRA_VOICE_SYSTEM_INSTRUCTION.includes('MAINSTREAM ARTISTS ONLY'), 'Must mention MAINSTREAM ARTISTS ONLY');
  assert(LOOPRA_VOICE_SYSTEM_INSTRUCTION.includes('NO JUNK / AI / LOW-VIEWS'), 'Must mention NO JUNK / AI / LOW-VIEWS');
});

console.log('\n======================================================');
console.log(`Verification Summary: Passed: ${passed}, Failed: ${failed}`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL 3 MUSIC SEARCH & SELECTION RULES SUCCESSFULLY VERIFIED!');
  process.exit(0);
}

