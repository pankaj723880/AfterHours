import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_REGISTRY, matchActionByAlias, getActionById } from '../../frontend/src/services/actionRegistry.js';
import {
  parseMultiStepInstruction,
  executeTaskPipeline,
  splitVoiceInstructionIntoClauses,
  resolveStepReferences
} from '../../frontend/src/services/voiceTaskEngine.js';

test('=== LOOPRA COMPLETE ACTION REGISTRY & MULTI-STEP ENGINE TEST SUITE ===', async (t) => {

  await t.test('1. Action Registry Integrity & Completeness Audit', async () => {
    assert.ok(ACTION_REGISTRY.length >= 25, `Expected at least 25 registered actions, got ${ACTION_REGISTRY.length}`);

    // Verify mandatory schema properties on EVERY action
    for (const action of ACTION_REGISTRY) {
      assert.ok(action.id, 'Action must have an id');
      assert.ok(action.name, 'Action must have a name');
      assert.ok(action.category, 'Action must have a category');
      assert.ok(action.component, 'Action must have component mapping');
      assert.ok(action.handlerName, 'Action must have handlerName');
      assert.ok(Array.isArray(action.aliases), 'Action must define array of aliases');
      assert.ok(action.aliases.length >= 2, `Action ${action.id} should have multiple aliases`);
      assert.ok(action.expectedResult, `Action ${action.id} must define expectedResult`);
      assert.strictEqual(typeof action.confirmationRequired, 'boolean', `Action ${action.id} must specify confirmationRequired`);
    }

    // Verify destructive actions have confirmationRequired: true
    const clearHistoryAction = getActionById('action_clear_history');
    assert.ok(clearHistoryAction, 'action_clear_history must exist');
    assert.strictEqual(clearHistoryAction.confirmationRequired, true);

    const deletePlaylistAction = getActionById('action_delete_playlist');
    assert.ok(deletePlaylistAction, 'action_delete_playlist must exist');
    assert.strictEqual(deletePlaylistAction.confirmationRequired, true);
  });

  await t.test('2. Multi-Lingual Alias Resolution (English, Hindi, Hinglish)', async () => {
    // English
    assert.strictEqual(matchActionByAlias('go home')?.id, 'nav_home');
    assert.strictEqual(matchActionByAlias('pause music')?.id, 'action_pause_playback');
    assert.strictEqual(matchActionByAlias('next song')?.id, 'action_next_track');

    // Hindi
    assert.strictEqual(matchActionByAlias('ghar jao')?.id, 'nav_home');
    assert.strictEqual(matchActionByAlias('gaana roko')?.id, 'action_pause_playback');
    assert.strictEqual(matchActionByAlias('agla gaana')?.id, 'action_next_track');
    assert.strictEqual(matchActionByAlias('pichla gaana')?.id, 'action_prev_track');

    // Hinglish
    assert.strictEqual(matchActionByAlias('home kholo')?.id, 'nav_home');
    assert.strictEqual(matchActionByAlias('radio kholo')?.id, 'nav_radio');
    assert.strictEqual(matchActionByAlias('history kholo')?.id, 'nav_history');
    assert.strictEqual(matchActionByAlias('playlists kholo')?.id, 'nav_playlists');
  });

  await t.test('3. Test Prompt Multi-Step Scenario 1: Radio kholo, Vividh Bharati search karo aur play karo', async () => {
    const input = 'Radio kholo, Vividh Bharati search karo aur play karo';
    const steps = parseMultiStepInstruction(input);
    assert.ok(steps.length >= 2, `Expected at least 2 steps, got ${steps.length}`);
    assert.strictEqual(steps[0].action, 'navigate_page');
    assert.strictEqual(steps[0].target, 'radio');

    // Execute pipeline with mock handlers
    let radioNavigated = false;
    let stationPlayed = null;
    const result = await executeTaskPipeline(steps, {}, {
      onNavigate: (tab) => { if (tab === 'radio') radioNavigated = true; },
      onPlayRadioStation: (st) => { stationPlayed = st; }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(radioNavigated, true);
    assert.ok(stationPlayed?.toLowerCase().includes('vividh bharati'));
  });

  await t.test('4. Test Prompt Multi-Step Scenario 2: Playlist kholo, Party Songs playlist kholo aur uske saare songs play karo', async () => {
    const input = 'Playlist kholo, Party Songs playlist kholo aur uske saare songs play karo';
    const steps = parseMultiStepInstruction(input);
    assert.ok(steps.length >= 2);

    let openedPlaylist = null;
    let playedPlaylist = null;
    const result = await executeTaskPipeline(steps, {}, {
      onNavigate: () => {},
      onOpenPlaylistByName: (name) => { openedPlaylist = name; },
      onPlayPlaylist: (name) => { playedPlaylist = name; }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(openedPlaylist?.toLowerCase(), 'party songs');
    assert.strictEqual(playedPlaylist?.toLowerCase(), 'party songs');
  });

  await t.test('5. Test Prompt Multi-Step Scenario 3: Favourites kholo aur Kesariya ko favourites se remove karo', async () => {
    const input = 'Favourites kholo aur Kesariya ko favourites se remove karo';
    const steps = parseMultiStepInstruction(input);
    assert.ok(steps.length >= 2);

    let libNavigated = false;
    let removedSong = null;
    const result = await executeTaskPipeline(steps, {}, {
      onNavigate: (tab) => { if (tab === 'library') libNavigated = true; },
      onRemoveFromFavorites: (title) => { removedSong = title; }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(libNavigated, true);
    assert.ok(removedSong?.toLowerCase().includes('kesariya'));
  });

  await t.test('6. Test Prompt Multi-Step Scenario 4: History kholo, last played song play karo', async () => {
    const input = 'History kholo, last played song play karo';
    const context = {
      lastPlayedTrack: { id: 'track_123', title: 'Tum Hi Ho', artist: 'Arijit Singh' }
    };
    const steps = parseMultiStepInstruction(input, context);
    assert.ok(steps.length >= 2);

    let historyNavigated = false;
    let playedTrack = null;
    const result = await executeTaskPipeline(steps, context, {
      onNavigate: (tab) => { if (tab === 'history') historyNavigated = true; },
      onPlayFromHistory: (track) => { playedTrack = track; }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(historyNavigated, true);
    assert.strictEqual(playedTrack?.title, 'Tum Hi Ho');
  });

  await t.test('7. Test Prompt Multi-Step Scenario 5: History kholo aur sirf Arijit Singh ka ye particular song remove karo', async () => {
    const input = 'History kholo aur sirf Arijit Singh ka ye particular song remove karo';
    const steps = parseMultiStepInstruction(input);
    assert.ok(steps.length >= 2);

    let historyNavigated = false;
    let removedItem = null;
    const result = await executeTaskPipeline(steps, {}, {
      onNavigate: (tab) => { if (tab === 'history') historyNavigated = true; },
      onRemoveHistoryItem: (query) => { removedItem = query; }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(historyNavigated, true);
    assert.ok(removedItem?.toLowerCase().includes('arijit singh'));
  });

  await t.test('8. Test Prompt Multi-Step Scenario 6: Meri listening history clear kar do (Requires Confirmation)', async () => {
    const input = 'Meri listening history clear kar do';
    const steps = parseMultiStepInstruction(input);
    assert.strictEqual(steps.length, 1);
    assert.strictEqual(steps[0].action, 'clear_history');
    assert.strictEqual(steps[0].confirmationRequired, true);

    let cleared = false;
    // Attempt execution WITHOUT prior confirmation
    const unconfirmedResult = await executeTaskPipeline(steps, { confirmed: false }, {
      onClearHistory: () => { cleared = true; }
    });

    // Must halt and demand user confirmation
    assert.strictEqual(unconfirmedResult.success, false);
    assert.strictEqual(unconfirmedResult.confirmationRequired, true);
    assert.strictEqual(cleared, false);

    // Now execute WITH confirmation
    const confirmedResult = await executeTaskPipeline(steps, { confirmed: true }, {
      onClearHistory: () => { cleared = true; }
    });

    assert.strictEqual(confirmedResult.success, true);
    assert.strictEqual(cleared, true);
  });

  await t.test('9. Test Prompt Multi-Step Scenario 7: Discover kholo, Arijit Singh search karo, uska artist profile kholo aur uske popular songs play karo', async () => {
    const input = 'Discover kholo, Arijit Singh search karo, uska artist profile kholo aur uske popular songs play karo';
    const steps = parseMultiStepInstruction(input);
    assert.ok(steps.length >= 3);

    let openedArtist = null;
    let playedTrack = null;
    const result = await executeTaskPipeline(steps, {}, {
      onNavigate: () => {},
      searchCatalog: async (q) => [{ id: '1', title: 'Channa Mereya', artist: 'Arijit Singh' }],
      onOpenArtist: (artist) => { openedArtist = artist; },
      onPlayTrack: (t) => { playedTrack = t; }
    });

    assert.strictEqual(result.success, true);
    assert.ok(openedArtist?.toLowerCase().includes('arijit singh'));
  });

  await t.test('10. Test Prompt Multi-Step Scenario 8: Playlist kholo, ek nayi playlist banao, currently playing song add karo aur playlist play karo', async () => {
    const input = 'Playlist kholo, ek nayi playlist banao, currently playing song add karo aur playlist play karo';
    const context = {
      currentSong: { id: 'track_curr', title: 'Apna Bana Le', artist: 'Arijit Singh' }
    };
    const steps = parseMultiStepInstruction(input, context);
    assert.ok(steps.length >= 3);

    let createdName = null;
    let addedTrack = null;
    let playedPlaylist = null;

    const result = await executeTaskPipeline(steps, context, {
      onNavigate: () => {},
      onCreatePlaylist: (name) => { createdName = name; return { id: 'p1', name }; },
      onAddToPlaylist: (track) => { addedTrack = track; },
      onPlayPlaylist: (name) => { playedPlaylist = name; }
    });

    assert.strictEqual(result.success, true);
    assert.ok(createdName);
    assert.strictEqual(addedTrack?.title, 'Apna Bana Le');
  });

  await t.test('11. Test Prompt Multi-Step Scenario 9: Radio band karo, Discover kholo aur latest recommended songs dikhao', async () => {
    const input = 'Radio band karo, Discover kholo aur latest recommended songs dikhao';
    const steps = parseMultiStepInstruction(input);
    assert.ok(steps.length >= 3);

    let paused = false;
    let openedTab = null;
    const result = await executeTaskPipeline(steps, { isPlaying: true }, {
      onTogglePlayPause: () => { paused = true; },
      onNavigate: (tab) => { openedTab = tab; }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(paused, true);
    assert.ok(openedTab === 'for-you' || openedTab === 'discover');
  });

  await t.test('12. Test Prompt Multi-Step Scenario 10: Current song favourite karo, queue mein next add karo aur volume 40% kar do', async () => {
    const input = 'Current song favourite karo, queue mein next add karo aur volume 40% kar do';
    const context = {
      currentSong: { id: 'track_fav', title: 'Heeriye', artist: 'Jasleen Royal' },
      volume: 70
    };
    const steps = parseMultiStepInstruction(input, context);
    assert.ok(steps.length >= 3);

    let liked = false;
    let queued = false;
    let targetVol = null;

    const result = await executeTaskPipeline(steps, context, {
      onToggleLike: (t) => { if (t.title === 'Heeriye') liked = true; },
      onAddToQueue: (t) => { if (t.title === 'Heeriye') queued = true; },
      onSetVolume: (vol) => { targetVol = vol; }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(liked, true);
    assert.strictEqual(queued, true);
    assert.strictEqual(targetVol, 40);
  });

  await t.test('13. Mid-Pipeline Failure Isolation', async () => {
    const steps = [
      { action: 'navigate_page', target: 'home' },
      { action: 'set_volume', value: 'invalid_volume' },
      { action: 'next' }
    ];

    let nextCalled = false;
    const result = await executeTaskPipeline(steps, {}, {
      onNavigate: () => {},
      onSetVolume: () => { throw new Error('Volume must be a valid number'); },
      onNextTrack: () => { nextCalled = true; }
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.completedSteps.length, 1);
    assert.strictEqual(result.failedStep?.index, 1);
    assert.ok(result.message.includes('failed'));
    assert.strictEqual(nextCalled, false, 'Should immediately abort on failed middle step without running subsequent steps');
  });

  await t.test('14. Compound Task: Open Saloon FM and play a song / Saloon FM open karke gaana play karo', async () => {
    const inputs = [
      'Open Saloon FM and play a song',
      'Saloon FM open karke gaana play karo'
    ];

    for (const input of inputs) {
      const steps = parseMultiStepInstruction(input, {});
      assert.strictEqual(steps.length, 2, `Should split "${input}" into 2 steps`);
      assert.strictEqual(steps[0].action, 'navigate_page');
      assert.strictEqual(steps[0].target, 'barber');

      let navigated = false;
      let playedTrack = null;

      const result = await executeTaskPipeline(steps, {}, {
        onNavigate: (target) => {
          if (target === 'barber') navigated = true;
        },
        searchCatalog: async (query) => {
          return [{ id: 's_1', title: 'Chura Ke Dil Mera', artist: 'Kumar Sanu' }];
        },
        onPlayTrack: (track) => {
          playedTrack = track;
        }
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(navigated, true);
      assert.ok(playedTrack !== null);
      assert.strictEqual(playedTrack.title, 'Chura Ke Dil Mera');
    }
  });
});
