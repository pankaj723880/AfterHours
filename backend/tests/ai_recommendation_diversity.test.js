import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanSongTitle,
  cleanArtistName,
  getCanonicalSongKey,
  recommendationHistoryService,
} from '../services/recommendationHistoryService.js';
import { catalogService, CORE_CATALOG_TRACKS } from '../services/catalogService.js';
import { isSingleSong, verifySingleSong } from '../services/songFilter.js';
import { aiMusicCompanionService } from '../services/aiMusicCompanionService.js';

test('AI Recommendation Diversity & Deduplication Suite', async (t) => {
  recommendationHistoryService.clearMemoryHistory();

  await t.test('Scenario 1: Ask for romantic songs twice -> second response contains different songs', async () => {
    const userKey = 'test-user-scenario-1';
    
    // First turn
    const res1 = await aiMusicCompanionService.processChat({
      message: 'Recommend some romantic songs',
      userId: userKey,
      history: [],
    });
    
    assert(res1.tracks && res1.tracks.length > 0, 'First response should have tracks');
    const firstSongIds = res1.tracks.map(r => r.id);
    const firstSongKeys = res1.tracks.map(r => getCanonicalSongKey(r));
    
    // Second turn
    const res2 = await aiMusicCompanionService.processChat({
      message: 'Recommend more romantic songs please',
      userId: userKey,
      history: [
        { role: 'user', content: 'Recommend some romantic songs' },
        { role: 'assistant', content: res1.reply, tracks: res1.tracks },
      ],
    });

    assert(res2.tracks && res2.tracks.length > 0, 'Second response should have tracks');
    const secondSongIds = res2.tracks.map(r => r.id);
    const secondSongKeys = res2.tracks.map(r => getCanonicalSongKey(r));

    // Ensure no overlap between first and second recommendations
    for (const id of secondSongIds) {
      assert(!firstSongIds.includes(id), `Song ID ${id} was repeated in second response`);
    }
    for (const key of secondSongKeys) {
      assert(!firstSongKeys.includes(key), `Canonical song key ${key} was repeated in second response`);
    }
  });

  await t.test('Scenario 2: Ask for sad songs after romantic songs -> results reflect sad mood and no duplicates', async () => {
    const userKey = 'test-user-scenario-2';
    
    const resRomantic = await aiMusicCompanionService.processChat({
      message: 'Give me romantic songs',
      userId: userKey,
      history: [],
    });
    const romanticKeys = (resRomantic.tracks || []).map(r => getCanonicalSongKey(r));

    const resSad = await aiMusicCompanionService.processChat({
      message: 'Now suggest sad heartbreak songs',
      userId: userKey,
      history: [
        { role: 'user', content: 'Give me romantic songs' },
        { role: 'assistant', content: resRomantic.reply, tracks: resRomantic.tracks },
      ],
    });

    assert(resSad.tracks && resSad.tracks.length > 0, 'Sad response should have tracks');
    const sadKeys = resSad.tracks.map(r => getCanonicalSongKey(r));

    // No romantic songs repeated
    for (const key of sadKeys) {
      assert(!romanticKeys.includes(key), `Romantic song ${key} was repeated in sad response`);
    }

    // Intent extracted correctly
    const intent = catalogService.extractRecommendationIntent('Now suggest sad heartbreak songs');
    assert.equal(intent.mood, 'sad');
  });

  await t.test('Scenario 3: Ask for 90s songs -> intent reflects 90s era and candidate songs match', async () => {
    const intent = catalogService.extractRecommendationIntent('Suggest best 90s bollywood retro songs');
    assert.equal(intent.era, '90s');
    assert(intent.dynamicQueries.some(q => q.includes('90s') || q.includes('retro')));
  });

  await t.test('Scenario 4: Ask for underrated songs -> curationType detects underrated', async () => {
    const intent = catalogService.extractRecommendationIntent('Give me some underrated indie songs');
    assert.equal(intent.curationType, 'underrated');
  });

  await t.test('Scenario 5: Refresh / new turn with persistent user ID -> previous recommendations remain excluded', async () => {
    const userKey = 'test-user-persistent-turn';
    
    const res1 = await aiMusicCompanionService.processChat({
      message: 'Play good songs',
      userId: userKey,
      history: [],
    });

    const recommendedIds = (res1.tracks || []).map(r => r.id);
    
    // Simulate user refreshing page: history array is empty, but same userId/sessionKey
    const { excludedIds } = await recommendationHistoryService.getExclusionSets(userKey, []);
    for (const id of recommendedIds) {
      assert(excludedIds.has(id), `Previously recommended ID ${id} should be in exclusion set after refresh`);
    }
  });

  await t.test('Scenario 6: Generate multiple batches -> zero duplicate canonical song keys', async () => {
    const userKey = 'test-user-batches';
    const allSeenKeys = new Set();
    let currentHistory = [];

    for (let batch = 0; batch < 4; batch++) {
      const res = await aiMusicCompanionService.processChat({
        message: 'Give me good Hindi songs batch ' + batch,
        userId: userKey,
        history: currentHistory,
      });

      for (const song of (res.tracks || [])) {
        const key = getCanonicalSongKey(song);
        assert(!allSeenKeys.has(key), `Batch ${batch} contained duplicate song key ${key}`);
        allSeenKeys.add(key);
      }

      currentHistory.push({ role: 'user', content: 'batch ' + batch });
      currentHistory.push({ role: 'assistant', content: res.reply, tracks: res.tracks });
    }
  });

  await t.test('Scenario 7: Two different user accounts -> histories are completely isolated', async () => {
    const userA = 'user-isolated-A';
    const userB = 'user-isolated-B';

    const resA = await aiMusicCompanionService.processChat({
      message: 'Recommend workout songs',
      userId: userA,
      history: [],
    });

    const exclA = await recommendationHistoryService.getExclusionSets(userA, []);
    const exclB = await recommendationHistoryService.getExclusionSets(userB, []);

    for (const id of (resA.tracks || []).map(r => r.id)) {
      assert(exclA.excludedIds.has(id), `User A should have ${id} excluded`);
      assert(!exclB.excludedIds.has(id), `User B should NOT have ${id} excluded by User A activity`);
    }
  });

  await t.test('Scenario 8: All core catalog tracks pass single song verification', () => {
    for (const track of CORE_CATALOG_TRACKS) {
      const res = verifySingleSong(track);
      assert.equal(res.isValid, true, `Core track "${track.title}" failed single song verification: ${res.reason}`);
    }
  });

  await t.test('Scenario 9: Explicit repetition allowed when user asks for a specific song', async () => {
    const userKey = 'test-user-explicit';
    
    // First recommend Kesariya
    await recommendationHistoryService.recordRecommendations(userKey, [{ id: 'BddP6PY42Yo', title: 'Kesariya', artist: 'Arijit Singh' }], 'romantic');
    
    const exclBefore = await recommendationHistoryService.getExclusionSets(userKey, []);
    assert(exclBefore.excludedIds.has('BddP6PY42Yo'));

    // User explicitly says "play kesariya again"
    const explicit = recommendationHistoryService.checkExplicitRequest('Please play Kesariya again', exclBefore.excludedList);
    assert(explicit && explicit.isExplicit, 'Should detect explicit request for Kesariya');
    assert.equal(explicit.trackId || explicit.videoId, 'BddP6PY42Yo');
  });
});
