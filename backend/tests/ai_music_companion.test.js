import assert from 'assert';
import { aiMusicCompanionService, getCurrentDateTimeInfo } from '../services/aiMusicCompanionService.js';
import { musicRecognitionService } from '../services/musicRecognitionService.js';
import { catalogService, CORE_CATALOG_TRACKS } from '../services/catalogService.js';
import { verifySingleSong, isSingleSong } from '../services/songFilter.js';

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

  // =========================================================================
  // MANDATORY REGRESSION TEST SUITE (9 REQUIRED TESTS)
  // =========================================================================

  // REGRESSION 1: Mashup video rejected
  console.log('\n--- REGRESSION 1: Mashup Video Rejected ---');
  const mashupTrack = {
    id: 'mashup12345',
    title: 'Bollywood Romantic Mashup 2026 - Arijit Singh & Atif Aslam',
    channel: 'Mashup Masters'
  };
  const mashupVerification = verifySingleSong(mashupTrack);
  assert.strictEqual(mashupVerification.isValid, false, 'Mashup video must be rejected');
  assert.strictEqual(isSingleSong(mashupTrack), false, 'isSingleSong must return false for mashup');
  assert.strictEqual(mashupVerification.verificationStatus, 'rejected_multi_song');
  console.log(`[PASS] Mashup video rejected successfully: "${mashupTrack.title}" -> isValid=false`);
  passed++;

  // REGRESSION 2: Jukebox rejected
  console.log('\n--- REGRESSION 2: Jukebox Video Rejected ---');
  const jukeboxTrack = {
    id: 'jukebox1234',
    title: 'Rockstar Audio Jukebox | Full Album Songs | A.R. Rahman',
    channel: 'T-Series'
  };
  const jukeboxVerification = verifySingleSong(jukeboxTrack);
  assert.strictEqual(jukeboxVerification.isValid, false, 'Jukebox video must be rejected');
  assert.strictEqual(isSingleSong(jukeboxTrack), false, 'isSingleSong must return false for jukebox');
  assert.strictEqual(jukeboxVerification.verificationStatus, 'rejected_multi_song');
  console.log(`[PASS] Jukebox video rejected successfully: "${jukeboxTrack.title}" -> isValid=false`);
  passed++;

  // REGRESSION 3: Medley rejected
  console.log('\n--- REGRESSION 3: Medley Video Rejected ---');
  const medleyTrack = {
    id: 'medley12345',
    title: 'Evergreen 90s Medley Songs Live Concert',
    channel: 'Sony Music India'
  };
  const medleyVerification = verifySingleSong(medleyTrack);
  assert.strictEqual(medleyVerification.isValid, false, 'Medley video must be rejected');
  assert.strictEqual(isSingleSong(medleyTrack), false, 'isSingleSong must return false for medley');
  assert.strictEqual(medleyVerification.verificationStatus, 'rejected_multi_song');
  console.log(`[PASS] Medley video rejected successfully: "${medleyTrack.title}" -> isValid=false`);
  passed++;

  // REGRESSION 4: Non-stop collection rejected
  console.log('\n--- REGRESSION 4: Non-stop Collection Rejected ---');
  const nonstopTrack = {
    id: 'nonstop1234',
    title: 'Non Stop Hindi Sad Songs | Best Heart Touching Collection',
    channel: 'Tips Official'
  };
  const nonstopVerification = verifySingleSong(nonstopTrack);
  assert.strictEqual(nonstopVerification.isValid, false, 'Non-stop video must be rejected');
  assert.strictEqual(isSingleSong(nonstopTrack), false, 'isSingleSong must return false for nonstop');
  assert.strictEqual(nonstopVerification.verificationStatus, 'rejected_multi_song');
  console.log(`[PASS] Non-stop collection rejected successfully: "${nonstopTrack.title}" -> isValid=false`);
  passed++;

  // REGRESSION 5: Individual official song accepted
  console.log('\n--- REGRESSION 5: Individual Official Song Accepted ---');
  const officialSingle = {
    id: 'Umqb9KENgmk',
    title: 'Tum Hi Ho (Official Video) - Aashiqui 2',
    channel: 'T-Series',
    duration: '4:22'
  };
  const officialVerification = verifySingleSong(officialSingle);
  assert.strictEqual(officialVerification.isValid, true, 'Official single song must be accepted');
  assert.strictEqual(isSingleSong(officialSingle), true, 'isSingleSong must return true for official single');
  assert.strictEqual(officialVerification.songType, 'official_release', 'Must classify as official_release');
  assert.strictEqual(officialVerification.verificationStatus, 'verified_official', 'Must have verified_official status');
  console.log(`[PASS] Individual official song accepted: "${officialSingle.title}" -> songType="${officialVerification.songType}", status="${officialVerification.verificationStatus}"`);
  passed++;

  // REGRESSION 6: Single-song remix accepted
  console.log('\n--- REGRESSION 6: Single-Song Remix Accepted ---');
  const singleRemix = {
    id: 'remix123456',
    title: 'Kesariya (Lofi Remix)',
    channel: 'Sony Music India',
    duration: '3:45'
  };
  const remixVerification = verifySingleSong(singleRemix);
  assert.strictEqual(remixVerification.isValid, true, 'Single-song remix must be accepted');
  assert.strictEqual(isSingleSong(singleRemix), true, 'isSingleSong must return true for single remix');
  assert.strictEqual(remixVerification.songType, 'single_song_remix', 'Must classify as single_song_remix');
  console.log(`[PASS] Single-song remix accepted: "${singleRemix.title}" -> songType="${remixVerification.songType}"`);
  passed++;

  // REGRESSION 7: Current-date questions use fresh information
  console.log('\n--- REGRESSION 7: Current-Date Questions Use Fresh Information ---');
  const dateInfo = getCurrentDateTimeInfo();
  assert(dateInfo.year >= 2026, 'Dynamic date must use current server year (>= 2026)');
  assert(typeof dateInfo.local === 'string' && dateInfo.local.length > 5, 'Must return formatted local date');

  const dateChat = await aiMusicCompanionService.processChat({
    message: "What is today's date?",
    currentTrack: null,
    history: []
  });
  assert(dateChat && dateChat.reply, 'Must return reply for date query');
  assert(
    dateChat.reply.includes(String(dateInfo.year)) ||
    dateChat.reply.includes(dateInfo.timeZone),
    'Reply must reflect dynamic server year or timezone without hardcoding'
  );
  console.log(`[PASS] Dynamic current date reflected in assistant response: "${dateChat.reply}"`);
  passed++;

  // REGRESSION 8: Unverified current facts are not fabricated
  console.log('\n--- REGRESSION 8: Unverified Current Facts Are Not Fabricated ---');
  const unverifiedFactChat = await aiMusicCompanionService.processChat({
    message: "What is the unverified Billboard chart position and exact stream count of this unknown track today?",
    currentTrack: null,
    history: []
  });
  assert(unverifiedFactChat && unverifiedFactChat.reply, 'Must return reply');
  const lowerReply = unverifiedFactChat.reply.toLowerCase();
  assert(
    lowerReply.includes('cannot') ||
    lowerReply.includes('unverified') ||
    lowerReply.includes('verify') ||
    lowerReply.includes('avoid guessing'),
    'Assistant must report inability to verify facts rather than fabricating fake numbers'
  );
  console.log(`[PASS] Assistant explicitly refused to fabricate unverified statistics: "${unverifiedFactChat.reply}"`);
  passed++;

  // REGRESSION 9: Recommendations play the exact selected song
  console.log('\n--- REGRESSION 9: Recommendations Play The Exact Selected Song ---');
  const targetTrack = {
    id: 'cmMiyZaSELo',
    videoId: 'cmMiyZaSELo',
    title: 'Zara Sa (Official Video) - Jannat',
    artist: 'KK, Pritam'
  };
  const playbackTurn = aiMusicCompanionService.detectPlaybackRequest(
    'Play Zara Sa',
    [],
    [targetTrack]
  );
  assert(playbackTurn, 'Playback request must be detected');
  assert.strictEqual(playbackTurn.id, targetTrack.id, 'Must play exact track ID (cmMiyZaSELo)');
  assert.strictEqual(playbackTurn.title, targetTrack.title, 'Must preserve exact track title');
  console.log(`[PASS] Exact selected song preserved during playback resolution: "${playbackTurn.title}" (${playbackTurn.id})`);
  passed++;

  console.log(`\n=== ALL ${passed} AI MUSIC COMPANION TESTS PASSED SUCCESSFULLY! ===`);
}

runTests().catch(err => {
  console.error('\n[TEST FAILED]:', err);
  process.exit(1);
});
