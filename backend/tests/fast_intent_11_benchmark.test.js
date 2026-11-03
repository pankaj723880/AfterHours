import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseCommandToAction, INTENT_CATEGORIES } from '../../frontend/src/services/commandActionEngine.js';

describe('Loopra Fast Intent Engine - 11 Benchmark Phrases Verification', () => {
  const context = {
    currentSong: { title: 'Tum Hi Ho', artist: 'Arijit Singh' },
    lastPlayedTrack: { title: 'Channa Mereya', artist: 'Arijit Singh' }
  };

  it('1. "Arijit ka koi gaana chala." -> PLAY_SONG with query "arijit"', () => {
    const res = parseCommandToAction('Arijit ka koi gaana chala.', context);
    assert.ok(res, 'Must return action');
    assert.strictEqual(res.intent, INTENT_CATEGORIES.PLAY_SONG);
    assert.strictEqual(res.action, 'play_search');
    assert.ok(res.query.toLowerCase().includes('arijit'));
  });

  it('2. "Woh jo abhi baj raha tha, dobara chala." -> RESUME_PLAYBACK', () => {
    const res = parseCommandToAction('Woh jo abhi baj raha tha, dobara chala.', context);
    assert.ok(res, 'Must return action');
    assert.strictEqual(res.intent, INTENT_CATEGORIES.RESUME_PLAYBACK);
    assert.strictEqual(res.action, 'resume');
  });

  it('3. "Koi romantic song laga." -> PLAY_SONG with query "romantic song"', () => {
    const res = parseCommandToAction('Koi romantic song laga.', context);
    assert.ok(res, 'Must return action');
    assert.strictEqual(res.intent, INTENT_CATEGORIES.PLAY_SONG);
    assert.strictEqual(res.action, 'play_search');
    assert.ok(res.query.toLowerCase().includes('romantic'));
  });

  it('4. "Thoda party mood ka music chala." -> PLAY_SONG with query "party mood"', () => {
    const res = parseCommandToAction('Thoda party mood ka music chala.', context);
    assert.ok(res, 'Must return action');
    assert.strictEqual(res.intent, INTENT_CATEGORIES.PLAY_SONG);
    assert.strictEqual(res.action, 'play_search');
    assert.ok(res.query.toLowerCase().includes('party'));
  });

  it('5. "Is gaane ko favourite kar de." -> ADD_TO_FAVOURITES', () => {
    const res = parseCommandToAction('Is gaane ko favourite kar de.', context);
    assert.ok(res, 'Must return action');
    assert.strictEqual(res.intent, INTENT_CATEGORIES.ADD_TO_FAVOURITES);
    assert.strictEqual(res.action, 'toggle_like');
    assert.strictEqual(res.target?.title, 'Tum Hi Ho');
  });

  it('6. "Volume thoda kam kar." -> CHANGE_VOLUME volume_down', () => {
    const res = parseCommandToAction('Volume thoda kam kar.', context);
    assert.ok(res, 'Must return action');
    assert.strictEqual(res.intent, INTENT_CATEGORIES.CHANGE_VOLUME);
    assert.strictEqual(res.action, 'volume_down');
  });

  it('7. "Play Kesariya" -> PLAY_SONG with query "kesariya"', () => {
    const res = parseCommandToAction('Play Kesariya', context);
    assert.ok(res, 'Must return action');
    assert.strictEqual(res.intent, INTENT_CATEGORIES.PLAY_SONG);
    assert.strictEqual(res.action, 'play_search');
    assert.ok(res.query.toLowerCase().includes('kesariya'));
  });

  it('8. "Pause music" -> PAUSE_PLAYBACK pause', () => {
    const res = parseCommandToAction('Pause music', context);
    assert.ok(res, 'Must return action');
    assert.strictEqual(res.intent, INTENT_CATEGORIES.PAUSE_PLAYBACK);
    assert.strictEqual(res.action, 'pause');
  });

  it('9. "Next song" -> NEXT_TRACK next', () => {
    const res = parseCommandToAction('Next song', context);
    assert.ok(res, 'Must return action');
    assert.strictEqual(res.intent, INTENT_CATEGORIES.NEXT_TRACK);
    assert.strictEqual(res.action, 'next');
  });

  it('10. "Search Arijit Singh ke gaane bina play kare" -> Strict SEARCH_SONG (NEVER play)', () => {
    const res = parseCommandToAction('Search Arijit Singh ke gaane bina play kare', context);
    assert.ok(res, 'Must return action');
    assert.strictEqual(res.intent, INTENT_CATEGORIES.SEARCH_SONG);
    assert.strictEqual(res.action, 'search');
    assert.ok(res.query.toLowerCase().includes('arijit singh'));
  });

  it('11. "Wave karo" -> AVATAR_ACTION gesture "wave"', () => {
    const res = parseCommandToAction('Wave karo', context);
    assert.ok(res, 'Must return action');
    assert.strictEqual(res.intent, INTENT_CATEGORIES.AVATAR_ACTION);
    assert.strictEqual(res.action, 'avatar_action');
    assert.strictEqual(res.gesture, 'wave');
  });
});

