import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { chatBuddyLearningService } from '../services/chatBuddyLearningService.js';
import { aiMusicCompanionService } from '../services/aiMusicCompanionService.js';
import { parseCommandToAction, INTENT_CATEGORIES } from '../../frontend/src/services/commandActionEngine.js';

console.log('=== CHATBUDDY NATURAL CONVERSATION & LEARNING TEST SUITE ===');

describe('1. Avatar Face Cleanliness & Obsolete Files Verification', () => {
  it('should ensure obsolete female_head_* overlay files are completely deleted', () => {
    const charactersDir = path.resolve('frontend/public/characters');
    const files = fs.readdirSync(charactersDir);
    const obsoleteHeadOverlays = files.filter(f => f.startsWith('female_head_'));
    assert.strictEqual(
      obsoleteHeadOverlays.length,
      0,
      `Expected 0 obsolete head overlays, but found: ${obsoleteHeadOverlays.join(', ')}`
    );
  });

  it('should ensure female_head.png exists and TwoDCharacter does not reference head_speak', () => {
    const headPath = path.resolve('frontend/public/characters/female_head.png');
    assert.ok(fs.existsSync(headPath), 'female_head.png must exist');

    const twoDCode = fs.readFileSync('frontend/src/components/VoiceAgent/TwoDCharacter.jsx', 'utf-8');
    assert.ok(!twoDCode.includes('head_speak:'), 'TwoDCharacter.jsx must not reference head_speak');
    assert.ok(!twoDCode.includes('head_idle:'), 'TwoDCharacter.jsx must not reference head_idle');
  });
});

describe('2. Conversational Intent vs. Task Detection (Deterministic & AI Gate)', () => {
  it('should classify conversational greetings and questions as GENERAL_QUESTION (no action)', () => {
    const conversationalQueries = [
      'Kya haal hai?',
      'Aur batao',
      'Kaise ho?',
      'Aaj ka mausam kaisa hai?',
      'Ye song achha hai na?',
      'Mujhe ye song bahut pasand hai',
      'Arijit Singh kaisa singer hai?',
      'Hello Loopra',
      'Good morning dost'
    ];

    for (const query of conversationalQueries) {
      const parsed = parseCommandToAction(query);
      assert.strictEqual(
        parsed.intent,
        INTENT_CATEGORIES.GENERAL_QUESTION,
        `Expected GENERAL_QUESTION for "${query}", got "${parsed.intent}"`
      );
    }
  });

  it('should distinguish questions about songs from explicit playback commands', () => {
    // Conversational question about what to listen to: must NOT return playback intent
    const question1 = aiMusicCompanionService.detectPlaybackRequest('Aaj kaunsa song sunu?', [], []);
    assert.strictEqual(question1, null, 'detectPlaybackRequest must return null for "Aaj kaunsa song sunu?"');

    const question2 = aiMusicCompanionService.detectPlaybackRequest('Ye song achha play ho raha hai na?', [], []);
    assert.strictEqual(question2, null, 'detectPlaybackRequest must return null for opinion question');

    // Negative playback modifier
    const neg1 = aiMusicCompanionService.detectPlaybackRequest('Song play mat karna', [], []);
    assert.strictEqual(neg1, null, 'detectPlaybackRequest must return null for negative play request');

    const neg2 = aiMusicCompanionService.detectPlaybackRequest('Don\'t play this song', [], []);
    assert.strictEqual(neg2, null, 'detectPlaybackRequest must return null for "Don\'t play this song"');
  });

  it('should strictly distinguish Recap & Stats (Modal) from Listening Activity & History', () => {
    const recap1 = parseCommandToAction('Recap & Stats khol');
    assert.strictEqual(recap1.intent, INTENT_CATEGORIES.OPEN_INSIGHTS);
    assert.strictEqual(recap1.action, 'open_insights');

    const recap2 = parseCommandToAction('Mujhe mera listening recap dikhao');
    assert.strictEqual(recap2.intent, INTENT_CATEGORIES.OPEN_INSIGHTS);

    const activity1 = parseCommandToAction('Listening activity kholo');
    assert.strictEqual(activity1.intent, INTENT_CATEGORIES.OPEN_PAGE);
    assert.strictEqual(activity1.target, 'activity');

    const activity2 = parseCommandToAction('Recently played songs dikhao');
    assert.strictEqual(activity2.intent, INTENT_CATEGORIES.OPEN_PAGE);
    assert.strictEqual(activity2.target, 'activity');

    const history1 = parseCommandToAction('Listening history open karo');
    assert.strictEqual(history1.intent, INTENT_CATEGORIES.OPEN_PAGE);
    assert.strictEqual(history1.target, 'history');
  });
});

describe('3. Action Memory & Self-Improving AI System', () => {
  it('should resolve pre-seeded verified routes in 0ms from in-memory Action Memory', () => {
    const matchStats = chatBuddyLearningService.resolveFromMemory('recap and stats');
    assert.ok(matchStats, 'Should resolve "recap and stats"');
    assert.strictEqual(matchStats.actionType, 'OPEN_STATS');
    assert.strictEqual(matchStats.handler, 'onOpenInsights');

    const matchActivity = chatBuddyLearningService.resolveFromMemory('listening activity');
    assert.ok(matchActivity, 'Should resolve "listening activity"');
    assert.strictEqual(matchActivity.actionType, 'NAVIGATE');
    assert.strictEqual(matchActivity.target, 'activity');

    const matchHistory = chatBuddyLearningService.resolveFromMemory('listening history');
    assert.ok(matchHistory, 'Should resolve "listening history"');
    assert.strictEqual(matchHistory.actionType, 'NAVIGATE');
    assert.strictEqual(matchHistory.target, 'history');
  });

  it('should record successful execution, boost confidence, and update Action Memory', async () => {
    const testPhrase = 'mera favorite Punjabi gaana chalao';
    const entry = await chatBuddyLearningService.recordExecution({
      userPhrase: testPhrase,
      intent: 'play_music',
      actionType: 'PLAY_TRACK',
      query: 'Punjabi',
      handler: 'onPlayTrack',
      success: true,
      userId: 'test_user_123'
    });

    assert.ok(entry, 'Execution should be recorded');
    assert.strictEqual(entry.successCount, 1);
    assert.ok(entry.confidenceScore >= 0.85);

    // Now resolve it
    const resolved = chatBuddyLearningService.resolveFromMemory(testPhrase, 'test_user_123');
    assert.ok(resolved, 'Should resolve newly learned action from memory');
    assert.strictEqual(resolved.actionType, 'PLAY_TRACK');
  });

  it('should penalize action on user correction', async () => {
    const userId = 'test_user_corr';
    await chatBuddyLearningService.recordExecution({
      userPhrase: 'kuch badal do',
      intent: 'change_volume',
      actionType: 'VOLUME',
      value: 50,
      handler: 'onSetVolume',
      success: true,
      userId
    });

    // User immediately corrects: "nahi volume nahi gaana badlo"
    await chatBuddyLearningService.recordCorrection(userId, 'nahi gaana badlo');

    const afterCorrection = chatBuddyLearningService.resolveFromMemory('kuch badal do', userId);
    // Verified should be false and confidence penalized
    assert.strictEqual(afterCorrection, null, 'Unverified / penalized memory should not resolve');
  });
});

describe('4. Single Consistent Female Voice Verification', () => {
  it('should ensure en-IN-NeerjaExpressiveNeural is default voice in voiceAgent route', () => {
    const routeCode = fs.readFileSync('backend/routes/voiceAgent.js', 'utf-8');
    assert.ok(
      routeCode.includes('en-IN-NeerjaExpressiveNeural'),
      'voiceAgent.js must use en-IN-NeerjaExpressiveNeural'
    );
  });
});
