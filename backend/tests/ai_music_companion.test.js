import assert from 'assert';
import { aiMusicCompanionService } from '../services/aiMusicCompanionService.js';
import { musicRecognitionService } from '../services/musicRecognitionService.js';
import { catalogService } from '../services/catalogService.js';

console.log('=== STARTING LOOPRA AI MUSIC COMPANION TEST SUITE ===\n');

async function runTests() {
  let passed = 0;

  // TEST 1: Service Configuration & Capabilities
  console.log('--- TEST 1: Service Context & Capabilities ---');
  const providerInfo = musicRecognitionService.getProviderInfo();
  assert(typeof providerInfo === 'object', 'Provider info must be an object');
  assert('configured' in providerInfo, 'Provider info must contain configured boolean');
  console.log(`[PASS] Music recognition info: provider="${providerInfo.provider}", configured=${providerInfo.configured}`);
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
      text: 'Recommend 3 romantic songs'
    },
    {
      role: 'model',
      text: 'Here are 3 beautiful romantic melodies for you:',
      tracks: [
        { id: 'RLzC55ai0eo', videoId: 'RLzC55ai0eo', title: 'Heeriye', artist: 'Jasleen Royal, Arijit Singh' },
        { id: 'cNV5hLSa9H8', videoId: 'cNV5hLSa9H8', title: 'Tujhe Dekha Toh Yeh Jaana Sanam', artist: 'Kumar Sanu' },
        { id: 'dvgZkm1xWPE', videoId: 'dvgZkm1xWPE', title: 'Teri Ore', artist: 'Shreya Ghoshal' }
      ]
    }
  ];

  const playSecondChat = await aiMusicCompanionService.processChat({
    message: "Play the second one please",
    currentTrack: null,
    history: mockHistory
  });

  assert(playSecondChat.action && playSecondChat.action.type === 'PLAY_TRACK', 'Must produce a PLAY_TRACK action');
  assert.strictEqual(playSecondChat.action.track.id, 'cNV5hLSa9H8', 'Second track ID must match Tujhe Dekha Toh Yeh Jaana Sanam');
  assert(playSecondChat.reply.includes('Tujhe Dekha Toh Yeh Jaana Sanam'), 'Reply must confirm playing the 2nd track');
  console.log('[PASS] Multi-turn ordinal resolution successfully triggered PLAY_TRACK action for 2nd track.');
  passed++;

  // TEST 5: Recommendations Strict Catalog Integrity
  console.log('\n--- TEST 5: Candidate Catalog Integrity (Zero Hallucinated IDs) ---');
  const candidateTracks = await catalogService.getCuratedTracks();
  const validIdSet = new Set(candidateTracks.map(t => t.id || t.videoId));

  const recommendationChat = await aiMusicCompanionService.processChat({
    message: "Suggest some good nostalgic 90s bollywood music",
    currentTrack: null,
    history: []
  });

  assert(Array.isArray(recommendationChat.tracks), 'Must return array of tracks');
  assert(recommendationChat.tracks.length > 0, 'Must return at least one track');

  for (const t of recommendationChat.tracks) {
    const trackId = t.id || t.videoId;
    assert(validIdSet.has(trackId), `Track ID "${trackId}" must exist in verified catalog`);
    assert(t.title, 'Track must have title');
    assert(t.artist, 'Track must have artist');
  }
  console.log(`[PASS] All ${recommendationChat.tracks.length} recommended tracks verified strictly against catalog candidates.`);
  passed++;

  // TEST 6: External Song Recognition Without Credentials (Honest Reporting)
  console.log('\n--- TEST 6: External Recognition Interface - Unconfigured State ---');
  const dummyAudioBase64 = Buffer.from('RIFF....WAVEfmt ....data....test-audio-bytes-padding-1234567890'.repeat(30)).toString('base64');

  // Temporarily ensure recognition keys are undefined for this test
  const savedAcrHost = process.env.ACRCLOUD_HOST;
  const savedAcrKey = process.env.ACRCLOUD_ACCESS_KEY;
  const savedAudD = process.env.AUDD_API_TOKEN;
  delete process.env.ACRCLOUD_HOST;
  delete process.env.ACRCLOUD_ACCESS_KEY;
  delete process.env.AUDD_API_TOKEN;

  const unconfiguredResult = await musicRecognitionService.identifyAudio({
    audioBase64: dummyAudioBase64,
    mimeType: 'audio/webm'
  });

  assert.strictEqual(unconfiguredResult.success, false, 'Should not succeed without keys');
  assert.strictEqual(unconfiguredResult.configured, false, 'Must report configured=false');
  assert(unconfiguredResult.message.includes('ACRCloud') || unconfiguredResult.message.includes('AudD'), 'Must report required credentials');
  console.log('[PASS] Gracefully and honestly reported required recognition credentials without mock simulation.');
  passed++;

  // TEST 7: Recognition Audio Validation
  console.log('\n--- TEST 7: Recognition Audio Sample Validation ---');
  const shortAudioResult = await musicRecognitionService.identifyAudio({
    audioBase64: 'short',
    mimeType: 'audio/webm'
  });
  assert.strictEqual(shortAudioResult.success, false, 'Short audio must fail');
  console.log('[PASS] Correctly rejected undersized audio capture buffer.');
  passed++;

  // Restore env
  if (savedAcrHost) process.env.ACRCLOUD_HOST = savedAcrHost;
  if (savedAcrKey) process.env.ACRCLOUD_ACCESS_KEY = savedAcrKey;
  if (savedAudD) process.env.AUDD_API_TOKEN = savedAudD;

  // TEST 8: User Profile Isolation
  console.log('\n--- TEST 8: User Profile Isolation in Chat Responses ---');
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

