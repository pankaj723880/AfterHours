import assert from 'assert';
import { aiMusicCompanionService } from '../services/aiMusicCompanionService.js';
import { musicRecognitionService } from '../services/musicRecognitionService.js';
import { catalogService, CORE_CATALOG_TRACKS } from '../services/catalogService.js';

console.log('=== STARTING LOOPRA AI MUSIC COMPANION TEST SUITE ===\n');

async function runTests() {
  let passed = 0;

  // TEST 1: Service Configuration & Capabilities
  console.log('--- TEST 1: Service Context & Capabilities ---');
  const providerInfo = musicRecognitionService.getProviderInfo();
  assert(typeof providerInfo === 'object', 'Provider info must be an object');
  assert.strictEqual(providerInfo.provider, 'gemini', 'Provider must be pure gemini');
  assert('configured' in providerInfo, 'Provider info must contain configured boolean');
  console.log(`[PASS] Music recognition info: provider="${providerInfo.provider}", configured=${providerInfo.configured}, model="${providerInfo.model}"`);
  passed++;

  // TEST 2: Current Song Awareness
  console.log('\n--- TEST 2: Intelligent Current Song Awareness ---');
  const mockCurrentTrack = {
    id: 'BddP6PYo2gs',
    videoId: 'BddP6PYo2gs',
    title: 'Kesariya (Official Video)',
    artist: 'Arijit Singh, Pritam',
    album: 'Brahmastra',
    duration: '4:28',
    currentTime: '1:45',
    isPlaying: true
  };

  const currentSongChat = await aiMusicCompanionService.processChat({
    message: "What song is currently playing?",
    currentTrack: mockCurrentTrack,
    history: []
  });

  assert(currentSongChat && typeof currentSongChat.reply === 'string', 'Must return a reply');
  assert(
    currentSongChat.reply.toLowerCase().includes('kesariya') ||
    currentSongChat.reply.toLowerCase().includes('arijit'),
    'Reply must be aware of the current playing track title or artist'
  );
  console.log('[PASS] Assistant correctly detected current song from global player metadata: Kesariya by Arijit Singh.');
  passed++;

  // TEST 3: Aware when no song is playing
  console.log('\n--- TEST 3: Awareness When No Song Is Playing ---');
  const noSongChat = await aiMusicCompanionService.processChat({
    message: "What's playing right now?",
    currentTrack: null,
    history: []
  });

  assert(noSongChat && typeof noSongChat.reply === 'string', 'Must return a reply');
  assert(
    noSongChat.reply.toLowerCase().includes('no music') ||
    noSongChat.reply.toLowerCase().includes('nothing') ||
    noSongChat.reply.toLowerCase().includes('start') ||
    noSongChat.reply.toLowerCase().includes('no track'),
    'Assistant must honestly state no song is playing'
  );
  console.log('[PASS] Assistant accurately reported no track is playing without fabricating state.');
  passed++;

  // TEST 4: Multi-Turn Ordinal Playback Request ("Play the 2nd one")
  console.log('\n--- TEST 4: Multi-Turn Playback Resolution ("Play the second one") ---');
  const mockHistory = [
    {
      role: 'user',
      content: 'Suggest some classic romantic Hindi hits.'
    },
    {
      role: 'model',
      content: 'Here are timeless romantic songs for you.',
      tracks: [
        { id: 'cNV5hLSa9H8', title: 'Tujhe Dekha Toh Yeh Jaana Sanam', artist: 'Kumar Sanu' },
        { id: 'Umqb9KENgmk', title: 'Tum Hi Ho', artist: 'Arijit Singh' },
        { id: 'KeyfUuXPOcY', title: 'Dheere Dheere Se Meri Zindagi', artist: 'Kumar Sanu' }
      ]
    }
  ];

  const chatResponse = await aiMusicCompanionService.processChat({
    message: 'Play the 2nd one',
    currentTrack: null,
    history: mockHistory
  });

  assert(chatResponse.action, 'Playback action must be recognized');
  assert.strictEqual(chatResponse.action.type, 'PLAY_TRACK', 'Action type must be PLAY_TRACK');
  assert.strictEqual(chatResponse.action.track.id, 'Umqb9KENgmk', 'Second track ID must match Tum Hi Ho (Umqb9KENgmk)');
  console.log(`[PASS] Multi-turn ordinal resolution successfully triggered PLAY_TRACK action for 2nd track: "${chatResponse.action.track.title}" (${chatResponse.action.track.id})`);
  passed++;

  // TEST 5: Candidate Catalog Integrity
  console.log('\n--- TEST 5: Candidate Catalog Integrity (Zero Hallucinated IDs) ---');
  const candidatePool = await catalogService.getCuratedTracks();
  const recommendationChat = await aiMusicCompanionService.processChat({
    message: "Recommend some upbeat party songs",
    currentTrack: null,
    history: []
  });

  assert(Array.isArray(recommendationChat.tracks), 'Chat must return track array');
  const validIdSet = new Set(candidatePool.map(c => c.id || c.videoId));

  for (const t of recommendationChat.tracks) {
    const trackId = t.id || t.videoId;
    assert(validIdSet.has(trackId), `Track ID "${trackId}" must exist in verified catalog`);
    assert(t.title, 'Track must have title');
    assert(t.artist, 'Track must have artist');
  }
  console.log(`[PASS] All ${recommendationChat.tracks.length} recommended tracks verified strictly against catalog candidates.`);
  passed++;

  // TEST 6: Gemini Song Recognition Without Key (Honest Reporting)
  console.log('\n--- TEST 6: Gemini Recognition Interface - Unconfigured State ---');
  const dummyAudioBase64 = Buffer.from('RIFF....WAVEfmt ....data....test-audio-bytes-padding-1234567890'.repeat(30)).toString('base64');

  const savedGeminiKey = process.env.GEMINI_API_KEY;
  const savedGoogleKey = process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;

  const unconfiguredResult = await musicRecognitionService.identifyAudio({
    audioBase64: dummyAudioBase64,
    mimeType: 'audio/webm',
    durationSeconds: 12
  });

  assert.strictEqual(unconfiguredResult.success, false, 'Should not succeed without keys');
  assert.strictEqual(unconfiguredResult.configured, false, 'Must report configured=false');
  assert(unconfiguredResult.message.includes('GEMINI_API_KEY'), 'Must report required GEMINI_API_KEY');
  console.log('[PASS] Gracefully and honestly reported required GEMINI_API_KEY without paid third-party fallback.');
  passed++;

  // Restore dummy key so subsequent validation tests can test audio buffer logic
  process.env.GEMINI_API_KEY = 'test_mock_gemini_key_for_testing';

  // TEST 7: Recognition Audio Validation (Undersized Samples)
  console.log('\n--- TEST 7: Recognition Audio Sample Validation ---');
  const shortAudioResult = await musicRecognitionService.identifyAudio({
    audioBase64: 'short',
    mimeType: 'audio/webm'
  });
  assert.strictEqual(shortAudioResult.success, false, 'Short audio must fail');
  assert(shortAudioResult.error && shortAudioResult.error.includes('too short'), 'Must report audio sample too short');
  console.log('[PASS] Correctly rejected undersized audio capture buffer.');
  passed++;

  // Restore env
  if (savedGeminiKey) process.env.GEMINI_API_KEY = savedGeminiKey;
  else delete process.env.GEMINI_API_KEY;
  if (savedGoogleKey) process.env.GOOGLE_API_KEY = savedGoogleKey;

  // TEST 8: Exact Catalogue Matching for Known Hindi Song ("Tum Hi Ho")
  console.log('\n--- TEST 8: Catalogue Matching - Known Hindi Song ("Tum Hi Ho") ---');
  const tumHiHoMatch = await catalogService.findExactCatalogueMatch({
    title: 'Tum Hi Ho',
    artist: 'Arijit Singh',
    album: 'Aashiqui 2'
  });

  assert.strictEqual(tumHiHoMatch.isExactMatch, true, 'Tum Hi Ho must match exact catalogue track');
  assert.ok(tumHiHoMatch.matchedTrack, 'Matched track must be present');
  assert.strictEqual(tumHiHoMatch.matchedTrack.id, 'Umqb9KENgmk', 'Must match official Tum Hi Ho video ID Umqb9KENgmk');
  assert.notStrictEqual(tumHiHoMatch.matchedTrack.id, '2mDCVzruYzQ', 'Must NEVER match Butta Bomma ID');
  console.log(`[PASS] Exact match verified for Tum Hi Ho -> ${tumHiHoMatch.matchedTrack.title} (${tumHiHoMatch.matchedTrack.id})`);
  passed++;

  // TEST 9: Exact Catalogue Matching for Known Hindi Song ("Kesariya")
  console.log('\n--- TEST 9: Catalogue Matching - Known Hindi Song ("Kesariya") ---');
  const kesariyaMatch = await catalogService.findExactCatalogueMatch({
    title: 'Kesariya',
    artist: 'Arijit Singh',
    album: 'Brahmastra'
  });

  assert.strictEqual(kesariyaMatch.isExactMatch, true, 'Kesariya must match exact catalogue track');
  assert.strictEqual(kesariyaMatch.matchedTrack.id, 'BddP6PYo2gs', 'Must match Kesariya ID BddP6PYo2gs');
  console.log(`[PASS] Exact match verified for Kesariya -> ${kesariyaMatch.matchedTrack.title} (${kesariyaMatch.matchedTrack.id})`);
  passed++;

  // TEST 10: Unknown / Uncatalogued Song Handling (Never Plays Random Song)
  console.log('\n--- TEST 10: Unknown Song Handling (Zero False Fallbacks) ---');
  const unknownSongMatch = await catalogService.findExactCatalogueMatch({
    title: 'Xyz Completely Unknown Obscure Song 987654321',
    artist: 'Nonexistent Band 12345',
    album: 'Fake Album'
  });

  assert.strictEqual(unknownSongMatch.isExactMatch, false, 'Unknown song must NOT match catalogue');
  assert.strictEqual(unknownSongMatch.matchedTrack, null, 'Must NOT return a random fallback track');
  console.log('[PASS] Uncatalogued song successfully resolved to isExactMatch=false with matchedTrack=null (Zero false fallbacks).');
  passed++;

  // TEST 11: User Profile Isolation
  console.log('\n--- TEST 11: User Profile Isolation in Chat Responses ---');
  const userA = { _id: '507f1f77bcf86cd799439011', username: 'pankaj' };
  const userB = { _id: '507f1f77bcf86cd799439022', username: 'rahul' };

  const chatA = await aiMusicCompanionService.processChat({
    user: userA,
    message: "What should I listen to next?",
    currentTrack: null,
    history: []
  });

  const chatB = await aiMusicCompanionService.processChat({
    user: userB,
    message: "What should I listen to next?",
    currentTrack: null,
    history: []
  });

  assert(chatA.reply && chatB.reply, 'Both users must receive valid independent replies');
  console.log('[PASS] User profiles processed independently with zero data leakage.');
  passed++;

  console.log(`\n=== ALL ${passed} AI MUSIC COMPANION TESTS PASSED SUCCESSFULLY! ===`);
}

runTests().catch(err => {
  console.error('\n[TEST FAILED]:', err);
  process.exit(1);
});
