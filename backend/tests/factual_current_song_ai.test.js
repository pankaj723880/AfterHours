import assert from 'assert';
import { aiMusicCompanionService } from '../services/aiMusicCompanionService.js';

async function runTests() {
  console.log('=== STARTING LOOPRA AI CURRENT SONG FACTUAL ACCURACY TESTS ===\n');

  let passed = 0;

  // Track A: "Kesariya" (simulating global player metadata with channel/label)
  const trackKesariya = {
    id: 'BddP6PYo2gs',
    videoId: 'BddP6PYo2gs',
    title: 'Kesariya - Brahmāstra | Ranbir Kapoor | Alia Bhatt | Pritam | Arijit Singh | Amitabh Bhattacharya',
    artist: 'Sony Music India', // Label passed as artist tag
    channel: 'Sony Music India',
    album: 'Brahmāstra: Part One – Shiva',
    duration: '4:28'
  };

  // Track B: "Agar Tum Saath Ho" (simulating T-Series channel as artist)
  const trackAgarTum = {
    id: 'sK7riqg2mr4',
    videoId: 'sK7riqg2mr4',
    title: 'Agar Tum Saath Ho Full Song | Tamasha | Ranbir Kapoor, Deepika Padukone | Arijit Singh, Alka Yagnik',
    artist: 'T-Series',
    channel: 'T-Series',
    album: 'Tamasha',
    duration: '5:41'
  };

  // Track C: "Iktara" (Wake Up Sid)
  const trackIktara = {
    id: 'fSS_R91Nimw',
    videoId: 'fSS_R91Nimw',
    title: 'Iktara - Wake Up Sid | Ranbir Kapoor | Konkona Sen Sharma | Kavita Seth',
    artist: 'Sony Music India',
    channel: 'SonyMusicIndiaVEVO',
    album: 'Wake Up Sid',
    duration: '4:13'
  };

  // TEST 1: "Who is singing this song?"
  console.log('--- TEST 1: Question: "Who is singing this song?" ---');
  const res1 = await aiMusicCompanionService.processChat({
    message: "Who is singing this song?",
    currentTrack: trackKesariya,
    history: []
  });

  console.log('[Answer 1]:', res1.reply);
  assert(res1.reply && res1.reply.length > 5, 'Reply must not be empty');
  assert(/arijit singh/i.test(res1.reply), 'Must identify Arijit Singh as the singer');
  assert(!/sony music.*is the singer/i.test(res1.reply), 'Must never claim Sony Music is the singer');
  assert(!/various artists.*is the singer/i.test(res1.reply), 'Must never claim Various Artists is the singer');
  assert(Array.isArray(res1.tracks) && res1.tracks.length === 0, 'Factual question must NOT return recommendation track cards');
  console.log('[PASS] Singer accurately identified as Arijit Singh with 0 recommendation cards.\n');
  passed++;

  // TEST 2: "Who composed it?"
  console.log('--- TEST 2: Question: "Who composed it?" ---');
  const res2 = await aiMusicCompanionService.processChat({
    message: "Who composed it?",
    currentTrack: trackKesariya,
    history: [
      { role: 'user', text: 'Who is singing this song?' },
      { role: 'model', text: res1.reply }
    ]
  });

  console.log('[Answer 2]:', res2.reply);
  assert(res2.reply && res2.reply.length > 5, 'Reply must not be empty');
  assert(/pritam/i.test(res2.reply), 'Must identify Pritam as the composer');
  assert(Array.isArray(res2.tracks) && res2.tracks.length === 0, 'Factual question must NOT return recommendation track cards');
  console.log('[PASS] Composer accurately identified as Pritam with 0 recommendation cards.\n');
  passed++;

  // TEST 3: "Who wrote its lyrics?"
  console.log('--- TEST 3: Question: "Who wrote its lyrics?" ---');
  const res3 = await aiMusicCompanionService.processChat({
    message: "Who wrote its lyrics?",
    currentTrack: trackKesariya,
    history: []
  });

  console.log('[Answer 3]:', res3.reply);
  assert(res3.reply && res3.reply.length > 5, 'Reply must not be empty');
  assert(/amitabh bhattacharya/i.test(res3.reply), 'Must identify Amitabh Bhattacharya as the lyricist');
  assert(Array.isArray(res3.tracks) && res3.tracks.length === 0, 'Factual question must NOT return recommendation track cards');
  console.log('[PASS] Lyricist accurately identified as Amitabh Bhattacharya with 0 recommendation cards.\n');
  passed++;

  // TEST 4: "Which movie or album is this from?"
  console.log('--- TEST 4: Question: "Which movie or album is this from?" ---');
  const res4 = await aiMusicCompanionService.processChat({
    message: "Which movie or album is this from?",
    currentTrack: trackKesariya,
    history: []
  });

  console.log('[Answer 4]:', res4.reply);
  assert(res4.reply && res4.reply.length > 5, 'Reply must not be empty');
  assert(/brahm[aā]stra/i.test(res4.reply), 'Must identify Brahmāstra as the movie');
  assert(Array.isArray(res4.tracks) && res4.tracks.length === 0, 'Factual question must NOT return recommendation track cards');
  console.log('[PASS] Movie soundtrack accurately identified as Brahmāstra with 0 recommendation cards.\n');
  passed++;

  // TEST 5: Track Change Context Accuracy (Never use older song from chat history when current track has changed)
  console.log('--- TEST 5: Changing current track to "Agar Tum Saath Ho" with history referencing Kesariya ---');
  const res5 = await aiMusicCompanionService.processChat({
    message: "Who is the singer of this song?",
    currentTrack: trackAgarTum,
    history: [
      { role: 'user', text: 'Who is singing this song?' },
      { role: 'model', text: 'Kesariya is sung by Arijit Singh.' },
      { role: 'user', text: 'Who composed it?' },
      { role: 'model', text: 'Pritam composed Kesariya.' }
    ]
  });

  console.log('[Answer 5]:', res5.reply);
  assert(/alka yagnik|arijit singh/i.test(res5.reply), 'Must answer for the new currentTrack (Agar Tum Saath Ho), not Kesariya');
  assert(!/t-series.*is the singer/i.test(res5.reply), 'Must never claim T-Series is the singer');
  assert(Array.isArray(res5.tracks) && res5.tracks.length === 0, 'Factual question must NOT return recommendation track cards');
  console.log('[PASS] Context accurately bound to new currently playing track ID and metadata.\n');
  passed++;

  // TEST 6: Composer for Second Track
  console.log('--- TEST 6: Question: "Who composed this song?" for Agar Tum Saath Ho ---');
  const res6 = await aiMusicCompanionService.processChat({
    message: "Who composed this song?",
    currentTrack: trackAgarTum,
    history: []
  });

  console.log('[Answer 6]:', res6.reply);
  assert(/a\.?r\.?\s*rahman|rahman/i.test(res6.reply), 'Must identify A.R. Rahman as the composer of Agar Tum Saath Ho');
  assert(Array.isArray(res6.tracks) && res6.tracks.length === 0, 'Factual question must NOT return recommendation track cards');
  console.log('[PASS] Composer accurately identified as A.R. Rahman with 0 recommendation cards.\n');
  passed++;

  // TEST 7: Recommendation Request ("Recommend songs similar to this")
  console.log('--- TEST 7: Recommendation Request: "Recommend songs similar to this" ---');
  const res7 = await aiMusicCompanionService.processChat({
    message: "Recommend songs similar to this",
    currentTrack: trackIktara,
    history: []
  });

  console.log('[Answer 7]:', res7.reply);
  console.log('[Tracks 7]: count =', res7.tracks.length);
  assert(res7.reply && res7.reply.length > 5, 'Reply must not be empty');
  assert(Array.isArray(res7.tracks) && res7.tracks.length > 0, 'Recommendation request MUST return playable recommendation tracks');
  for (const t of res7.tracks) {
    assert(t.title, 'Track must have a title');
    assert(t.id || t.videoId, 'Track must have an ID');
  }
  console.log(`[PASS] Recommendation request successfully returned ${res7.tracks.length} verified recommendation tracks.\n`);
  passed++;

  // TEST 8: When No Music Is Playing
  console.log('--- TEST 8: Question: "Who is singing this song?" when no music is playing ---');
  const res8 = await aiMusicCompanionService.processChat({
    message: "Who is singing this song?",
    currentTrack: null,
    history: []
  });

  console.log('[Answer 8]:', res8.reply);
  assert(/no music currently playing/i.test(res8.reply), 'Must indicate no music is currently playing');
  assert(Array.isArray(res8.tracks) && res8.tracks.length === 0, 'No tracks when no music is playing');
  console.log('[PASS] Accurately handled empty player state without hallucination.\n');
  passed++;

  console.log(`=== ALL ${passed}/8 CURRENT-SONG ACCURACY TESTS PASSED SUCCESSFULLY! ===`);
}

runTests().catch(err => {
  console.error('\n[TEST RUN FAILED]:', err);
  process.exit(1);
});
