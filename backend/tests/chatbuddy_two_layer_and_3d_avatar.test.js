import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import {
  processChatBuddyMessage,
  fallbackHeuristicClassifier,
  sanitizeAndParseJson,
  CHATBUDDY_SYSTEM_PROMPT
} from '../services/chatBuddyLlmService.js';
import { chatBuddyClient } from '../../frontend/src/services/chatBuddyClient.js';

console.log('=== CHATBUDDY TWO-LAYER PIPELINE & 3D AVATAR TEST SUITE ===');

describe('1. Layer A: Fast Local Media Commands (0ms, No API Call)', () => {
  it('should immediately evaluate pause commands in English, Hindi, and Hinglish', () => {
    const pausePhrases = ['pause', 'gaana roko', 'stop music', 'rok do', 'ruk jao'];
    for (const phrase of pausePhrases) {
      const res = chatBuddyClient.evaluateLocalCommand(phrase);
      assert.ok(res, `Failed for phrase: ${phrase}`);
      assert.strictEqual(res.isLocalFast, true);
      assert.strictEqual(res.type, 'command');
      assert.strictEqual(res.action, 'pause');
    }
  });

  it('should immediately evaluate resume commands in English, Hindi, and Hinglish', () => {
    const resumePhrases = ['resume', 'chalu karo', 'shuru karo', 'continue music'];
    for (const phrase of resumePhrases) {
      const res = chatBuddyClient.evaluateLocalCommand(phrase);
      assert.ok(res, `Failed for phrase: ${phrase}`);
      assert.strictEqual(res.isLocalFast, true);
      assert.strictEqual(res.type, 'command');
      assert.strictEqual(res.action, 'resume');
    }
  });

  it('should immediately evaluate next and previous commands', () => {
    const nextRes = chatBuddyClient.evaluateLocalCommand('next song');
    assert.strictEqual(nextRes.action, 'next');

    const prevRes = chatBuddyClient.evaluateLocalCommand('pichla gaana');
    assert.strictEqual(prevRes.action, 'previous');
  });

  it('should immediately evaluate volume adjustments', () => {
    const volRes = chatBuddyClient.evaluateLocalCommand('volume 80');
    assert.strictEqual(volRes.action, 'volume');
    assert.strictEqual(volRes.params.level, 80);
  });

  it('should return null for casual chat so it is routed to Layer B (LLM layer)', () => {
    const chatPhrases = [
      'I am bored',
      'how are you',
      'that song is nice',
      'kya haal hai',
      'aaj ka mausam kaisa hai',
      'aaj kaunsa gaana sunu'
    ];
    for (const phrase of chatPhrases) {
      const res = chatBuddyClient.evaluateLocalCommand(phrase);
      assert.strictEqual(res, null, `Expected null for casual phrase "${phrase}", got: ${JSON.stringify(res)}`);
    }
  });
});

describe('2. Layer B: LLM Schema, 25+ Few-Shot System Prompt & Strict Rules', () => {
  it('should verify the system prompt contains at least 20 few-shot examples with strict JSON', () => {
    assert.ok(CHATBUDDY_SYSTEM_PROMPT.includes('FEW-SHOT EXAMPLES'), 'Must contain FEW-SHOT EXAMPLES section');
    const exampleMatches = CHATBUDDY_SYSTEM_PROMPT.match(/\[Example \d+/g);
    assert.ok(exampleMatches && exampleMatches.length >= 20, `Expected at least 20 examples, found ${exampleMatches?.length}`);
  });

  it('should enforce strict distinction between "open" and "play"', () => {
    // Open -> open_page (No music play)
    const openLiked = fallbackHeuristicClassifier('open my liked songs');
    assert.strictEqual(openLiked.type, 'command');
    assert.strictEqual(openLiked.action, 'open_page');
    assert.strictEqual(openLiked.params.page, 'favorites');

    const openPlaylists = fallbackHeuristicClassifier('meri playlists kholo');
    assert.strictEqual(openPlaylists.type, 'command');
    assert.strictEqual(openPlaylists.action, 'open_page');
    assert.strictEqual(openPlaylists.params.page, 'playlists');

    // Play -> play_song
    const playLiked = fallbackHeuristicClassifier('play Arijit Singh songs');
    assert.strictEqual(playLiked.type, 'command');
    assert.strictEqual(playLiked.action, 'play_song');
    assert.ok(playLiked.params.query.includes('arijit'), 'Query should contain artist');
  });

  it('should classify casual talk as type "chat" with action "none"', () => {
    const casualMessages = [
      'I am so bored today',
      'how are you doing?',
      'that song was really nice',
      'kya haal chaal hai',
      'aaj ka din kaisa tha'
    ];

    for (const msg of casualMessages) {
      const res = fallbackHeuristicClassifier(msg);
      assert.strictEqual(res.type, 'chat', `Expected type "chat" for "${msg}"`);
      assert.strictEqual(res.action, 'none', `Expected action "none" for "${msg}"`);
    }
  });

  it('should handle negative modifiers safely without playing music', () => {
    const negMsg = fallbackHeuristicClassifier('Arijit Singh ke songs search karo par play mat karna');
    assert.notStrictEqual(negMsg.action, 'play_song', 'Must NOT trigger play_song with negative modifier');
  });

  it('should correctly classify avatar motion commands', () => {
    const dance = fallbackHeuristicClassifier('dance karo');
    assert.strictEqual(dance.action, 'avatar_dance');

    const jump = fallbackHeuristicClassifier('jump karo');
    assert.strictEqual(jump.action, 'avatar_jump');

    const wave = fallbackHeuristicClassifier('wave hello');
    assert.strictEqual(wave.action, 'avatar_wave');
  });

  it('should sanitize and extract valid JSON from LLM text responses', () => {
    const rawWithFences = '```json\n{"type":"command","action":"pause","params":{},"reply":"Paused"}\n```';
    const parsed = sanitizeAndParseJson(rawWithFences);
    assert.ok(parsed, 'JSON should parse successfully');
    assert.strictEqual(parsed.type, 'command');
    assert.strictEqual(parsed.action, 'pause');
    assert.strictEqual(parsed.reply, 'Paused');
  });
});

describe('3. Smooth 3D Animated Avatar Implementation', () => {
  it('should verify CharacterBuddy renders ThreeDCharacter instead of TwoDCharacter', () => {
    const buddyCode = fs.readFileSync('frontend/src/components/VoiceAgent/CharacterBuddy.jsx', 'utf-8');
    assert.ok(buddyCode.includes('<ThreeDCharacter'), 'CharacterBuddy must render ThreeDCharacter');
    assert.ok(!buddyCode.includes('<TwoDCharacter'), 'CharacterBuddy must not render TwoDCharacter');
  });

  it('should verify ThreeDCharacter contains GLTFLoader, DRACOLoader, and AnimationMixer support', () => {
    const threeDCode = fs.readFileSync('frontend/src/components/VoiceAgent/ThreeDCharacter.jsx', 'utf-8');
    assert.ok(threeDCode.includes('GLTFLoader'), 'Must import GLTFLoader');
    assert.ok(threeDCode.includes('DRACOLoader'), 'Must import DRACOLoader');
    assert.ok(threeDCode.includes('AnimationMixer'), 'Must implement AnimationMixer');
    assert.ok(threeDCode.includes('crossFadeTo') || threeDCode.includes('fadeIn'), 'Must implement smooth animation transitions');
    assert.ok(threeDCode.includes('/characters/avatar.glb'), 'Must check for avatar.glb');
  });

  it('should verify ThreeDCharacter includes visibilitychange optimization and pixel ratio cap', () => {
    const threeDCode = fs.readFileSync('frontend/src/components/VoiceAgent/ThreeDCharacter.jsx', 'utf-8');
    assert.ok(threeDCode.includes('visibilitychange'), 'Must pause rendering when tab is hidden');
    assert.ok(threeDCode.includes('setPixelRatio(Math.min('), 'Must cap device pixel ratio');
  });
});

describe('4. Voice Input & Live Feedback Verification', () => {
  it('should verify LoopraAiCompanion includes speechLang toggle, live heard feedback, and speech cooldown', () => {
    const companionCode = fs.readFileSync('frontend/src/components/AiMusicCompanion/LoopraAiCompanion.jsx', 'utf-8');
    assert.ok(companionCode.includes('speechLang'), 'Must support speechLang toggle');
    assert.ok(companionCode.includes('I heard:'), 'Must show live "I heard:" feedback');
    assert.ok(companionCode.includes('speechCooldownTimerRef'), 'Must implement anti-echo cooldown timer');
    assert.ok(companionCode.includes('speakWithNativeOrEdgeTts'), 'Must support speech out loud');
  });
});
