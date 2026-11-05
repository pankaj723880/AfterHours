import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_REGISTRY, matchActionByAlias, getActionById, ACTION_CATEGORIES } from '../../frontend/src/services/actionRegistry.js';
import { websiteInteractionRegistry } from '../../frontend/src/services/websiteInteractionRegistry.js';
import { parseCommandToAction, INTENT_CATEGORIES } from '../../frontend/src/services/commandActionEngine.js';
import { parseVoiceCommandLocally } from '../../frontend/src/services/voiceAgentRegistry.js';
import { voiceAgentService } from '../services/voiceAgentService.js';
import { executeTaskPipeline, parseMultiStepInstruction } from '../../frontend/src/services/voiceTaskEngine.js';

test('=== LOOPRA AUDITED ROUTES & FEATURES SYNC VERIFICATION SUITE ===', async (t) => {

  await t.test('1. Action Registry: Complete Schema Integrity for Newly Added Features', () => {
    const requiredActionIds = [
      'nav_dj_club',
      'nav_downloads_explore',
      'action_open_listening_rooms',
      'action_open_similar_songs',
      'action_open_player_settings',
      'action_open_canvas',
      'action_open_rating_modal',
      'action_open_reviews_section',
      'action_dj_start_beat',
      'action_dj_stop_beat',
      'action_dj_trigger_sfx',
      'action_dj_drop',
      'action_dj_set_preset',
      'action_dj_set_bpm',
      'action_set_playback_speed',
      'action_set_equalizer_preset'
    ];

    for (const actionId of requiredActionIds) {
      const action = getActionById(actionId);
      assert.ok(action, `Action ${actionId} must be registered in ACTION_REGISTRY`);
      assert.ok(action.name, `Action ${actionId} must have a name`);
      assert.ok(action.category, `Action ${actionId} must have a valid category`);
      assert.ok(action.component, `Action ${actionId} must specify component`);
      assert.ok(action.handlerName, `Action ${actionId} must specify handlerName`);
      assert.ok(Array.isArray(action.aliases) && action.aliases.length >= 2, `Action ${actionId} must have >= 2 aliases`);
      assert.strictEqual(typeof action.verify, 'function', `Action ${actionId} must provide a verify function`);
      assert.strictEqual(typeof action.confirmationRequired, 'boolean', `Action ${actionId} must specify confirmationRequired`);
    }

    // Verify categories enum
    assert.strictEqual(ACTION_CATEGORIES.DJ_CLUB, 'DJ_CLUB');
    assert.strictEqual(ACTION_CATEGORIES.SETTINGS, 'SETTINGS');
    assert.strictEqual(ACTION_CATEGORIES.SOCIAL, 'SOCIAL');
    assert.strictEqual(ACTION_CATEGORIES.REVIEWS, 'REVIEWS');
  });

  await t.test('2. Website Interaction Registry: Discovery & Matching of New Routes & Modals', () => {
    // DJ Club
    const djMatch = websiteInteractionRegistry.findBestMatch('dj club kholo');
    assert.ok(djMatch, 'DJ Club must be matched');
    assert.strictEqual(djMatch.id, 'dj-club');
    assert.strictEqual(djMatch.route, '/dj-club');

    // Downloads Explore
    const exploreMatch = websiteInteractionRegistry.findBestMatch('explore downloads');
    assert.ok(exploreMatch, 'Downloads Explore must be matched');
    assert.strictEqual(exploreMatch.id, 'downloads_explore');
    assert.strictEqual(exploreMatch.route, '/downloads/explore');

    // Listening Rooms Modal
    const roomsMatch = websiteInteractionRegistry.findBestMatch('listening room kholo');
    assert.ok(roomsMatch, 'Listening Rooms must be matched');
    assert.strictEqual(roomsMatch.id, 'listening_rooms');
    assert.strictEqual(roomsMatch.type, 'modal');

    // Similar Songs Modal
    const similarMatch = websiteInteractionRegistry.findBestMatch('similar songs kholo');
    assert.ok(similarMatch, 'Similar Songs must be matched');
    assert.strictEqual(similarMatch.id, 'similar_songs');
    assert.strictEqual(similarMatch.type, 'modal');

    // Player Settings & Equalizer Modal
    const eqMatch = websiteInteractionRegistry.findBestMatch('equalizer kholo');
    assert.ok(eqMatch, 'Equalizer must be matched');
    assert.strictEqual(eqMatch.id, 'player_settings');
    assert.strictEqual(eqMatch.type, 'modal');

    // Sleep Timer Modal
    const sleepMatch = websiteInteractionRegistry.findBestMatch('sleep timer kholo');
    assert.ok(sleepMatch, 'Sleep Timer must be matched');
    assert.strictEqual(sleepMatch.id, 'sleep_timer');
    assert.strictEqual(sleepMatch.type, 'modal');

    // Canvas Modal
    const canvasMatch = websiteInteractionRegistry.findBestMatch('canvas kholo');
    assert.ok(canvasMatch, 'Canvas must be matched');
    assert.strictEqual(canvasMatch.id, 'canvas_modal');
    assert.strictEqual(canvasMatch.type, 'modal');

    // Profile Modal
    const profileMatch = websiteInteractionRegistry.findBestMatch('profile kholo');
    assert.ok(profileMatch, 'Profile must be matched');
    assert.strictEqual(profileMatch.id, 'profile_modal');
    assert.strictEqual(profileMatch.type, 'modal');

    // Rating Modal
    const ratingMatch = websiteInteractionRegistry.findBestMatch('rate karo');
    assert.ok(ratingMatch, 'Rating must be matched');
    assert.strictEqual(ratingMatch.id, 'rating_modal');
    assert.strictEqual(ratingMatch.type, 'modal');
  });

  await t.test('3. Command-to-Action Engine: Natural Language Mapping (English, Hindi, Hinglish)', () => {
    // English
    const djEn = parseCommandToAction('Open DJ Club');
    assert.strictEqual(djEn?.intent, INTENT_CATEGORIES.OPEN_DJ_CLUB);
    assert.strictEqual(djEn?.target, 'dj-club');

    const roomsEn = parseCommandToAction('Open Social Listening Rooms');
    assert.strictEqual(roomsEn?.action, 'open_listening_rooms');

    const similarEn = parseCommandToAction('Find similar songs');
    assert.strictEqual(similarEn?.action, 'open_similar_songs');

    const eqEn = parseCommandToAction('Open player settings and equalizer');
    assert.strictEqual(eqEn?.action, 'open_player_settings');

    const sleepEn = parseCommandToAction('Open sleep timer');
    assert.strictEqual(sleepEn?.action, 'open_sleep_timer');

    const canvasEn = parseCommandToAction('Open fullscreen visualizer canvas');
    assert.strictEqual(canvasEn?.action, 'open_canvas');

    const rateEn = parseCommandToAction('Rate this song');
    assert.strictEqual(rateEn?.action, 'open_rating_modal');

    const dropEn = parseCommandToAction('Drop the beat');
    assert.strictEqual(dropEn?.action, 'dj_drop');

    const hornEn = parseCommandToAction('Play air horn');
    assert.strictEqual(hornEn?.action, 'dj_trigger_sfx');

    const speedEn = parseCommandToAction('Set playback speed to 1.5x');
    assert.strictEqual(speedEn?.action, 'set_playback_speed');
    assert.strictEqual(speedEn?.value, 1.5);

    // Hindi & Hinglish
    const djHi = parseCommandToAction('DJ Club kholo');
    assert.strictEqual(djHi?.intent, INTENT_CATEGORIES.OPEN_DJ_CLUB);
    assert.strictEqual(djHi?.target, 'dj-club');

    const dropHi = parseCommandToAction('Beat drop karo');
    assert.strictEqual(dropHi?.action, 'dj_drop');

    const roomsHi = parseCommandToAction('Dosto ke sath suno listening room kholo');
    assert.strictEqual(roomsHi?.action, 'open_listening_rooms');

    const similarHi = parseCommandToAction('Iske jaise gaane recommend karo');
    assert.strictEqual(similarHi?.action, 'open_similar_songs');

    const eqHi = parseCommandToAction('Equalizer kholo');
    assert.strictEqual(eqHi?.action, 'open_player_settings');

    const sleepHi = parseCommandToAction('Sone ka timer lagao');
    assert.strictEqual(sleepHi?.action, 'open_sleep_timer');

    const canvasHi = parseCommandToAction('Loopra canvas visualizer chalao');
    assert.strictEqual(canvasHi?.action, 'open_canvas');

    const rateHi = parseCommandToAction('Is gaane ko rating do');
    assert.strictEqual(rateHi?.action, 'open_rating_modal');
  });

  await t.test('4. Voice Agent Registry & Backend Service Deterministic Rules', () => {
    // Local Voice Agent Parser
    assert.strictEqual(parseVoiceCommandLocally('DJ Club kholo')?.action, 'navigate_page');
    assert.strictEqual(parseVoiceCommandLocally('DJ Club kholo')?.target, 'dj-club');
    assert.strictEqual(parseVoiceCommandLocally('Listening rooms kholo')?.action, 'open_listening_rooms');
    assert.strictEqual(parseVoiceCommandLocally('Similar songs kholo')?.action, 'open_similar_songs');
    assert.strictEqual(parseVoiceCommandLocally('Equalizer kholo')?.action, 'open_player_settings');
    assert.strictEqual(parseVoiceCommandLocally('Sleep timer kholo')?.action, 'open_sleep_timer');
    assert.strictEqual(parseVoiceCommandLocally('Canvas mode kholo')?.action, 'open_canvas');
    assert.strictEqual(parseVoiceCommandLocally('My profile kholo')?.action, 'open_profile');
    assert.strictEqual(parseVoiceCommandLocally('Beat drop karo')?.action, 'dj_drop');
    assert.strictEqual(parseVoiceCommandLocally('Playback speed 1.25x karo')?.action, 'set_playback_speed');

    // Backend Voice Agent Service Deterministic Rules
    const djBackend = voiceAgentService.evaluateDeterministicRules('Open DJ Club');
    assert.strictEqual(djBackend?.intent, 'open_dj_club');
    assert.strictEqual(djBackend?.steps[0]?.target, 'dj-club');

    const roomsBackend = voiceAgentService.evaluateDeterministicRules('Listening room kholo');
    assert.strictEqual(roomsBackend?.intent, 'open_listening_rooms');

    const similarBackend = voiceAgentService.evaluateDeterministicRules('Recommend similar songs');
    assert.strictEqual(similarBackend?.intent, 'open_similar_songs');

    const eqBackend = voiceAgentService.evaluateDeterministicRules('Equalizer kholo');
    assert.strictEqual(eqBackend?.intent, 'open_player_settings');

    const sleepBackend = voiceAgentService.evaluateDeterministicRules('Sleep timer kholo');
    assert.strictEqual(sleepBackend?.intent, 'open_sleep_timer');

    const dropBackend = voiceAgentService.evaluateDeterministicRules('Drop the beat');
    assert.strictEqual(dropBackend?.intent, 'dj_action');
    assert.strictEqual(dropBackend?.steps[0]?.parameters?.action, 'drop');
  });

  await t.test('5. Multi-Step Execution Pipeline with Real Action Handlers', async () => {
    let navigatedTo = null;
    let roomsOpened = false;
    let eqOpened = false;
    let djActionReceived = null;
    let speedSet = null;

    const mockHandlers = {
      onNavigate: (page) => { navigatedTo = page; },
      onOpenListeningRooms: () => { roomsOpened = true; },
      onOpenPlayerSettings: () => { eqOpened = true; },
      onDjAction: (act) => { djActionReceived = act; },
      onSetPlaybackSpeed: (spd) => { speedSet = spd; }
    };

    // Scenario A: Open DJ Club and trigger beat drop
    const stepsA = [
      { action: 'navigate_page', target: 'dj-club' },
      { action: 'dj_drop', description: 'Trigger DJ Beat Drop' }
    ];
    const resA = await executeTaskPipeline(stepsA, {}, mockHandlers);
    assert.strictEqual(resA.success, true);
    assert.strictEqual(navigatedTo, 'dj-club');
    assert.strictEqual(djActionReceived?.action, 'dj_drop');

    // Scenario B: Open Equalizer and set speed to 1.5x
    const stepsB = [
      { action: 'open_player_settings' },
      { action: 'set_playback_speed', value: 1.5 }
    ];
    const resB = await executeTaskPipeline(stepsB, {}, mockHandlers);
    assert.strictEqual(resB.success, true);
    assert.strictEqual(eqOpened, true);
    assert.strictEqual(speedSet, 1.5);

    // Scenario C: Open Listening Rooms
    const stepsC = [{ action: 'open_listening_rooms' }];
    const resC = await executeTaskPipeline(stepsC, {}, mockHandlers);
    assert.strictEqual(resC.success, true);
    assert.strictEqual(roomsOpened, true);
  });

  await t.test('6. Security Audit: Administrative Operations Strictly Isolated', async () => {
    // Both frontend parser and backend evaluator must strictly block admin access
    const adminCommands = [
      'admin dashboard kholo',
      'open cms',
      'user management kholo',
      'show audit logs',
      'server metrics dikhao',
      'system diagnostics chalao'
    ];

    for (const cmd of adminCommands) {
      const localResult = parseVoiceCommandLocally(cmd);
      assert.strictEqual(localResult?.type, 'security_blocked');
      assert.strictEqual(localResult?.action, 'security_blocked');

      const backendResult = await voiceAgentService.parseIntent({ utterance: cmd });
      assert.strictEqual(backendResult?.intent, 'security_blocked');
      assert.strictEqual(backendResult?.steps[0]?.tool, 'security_blocked');
    }
  });
});

