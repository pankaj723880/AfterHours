import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('Loopra Merged AI Assistant & Voice Control Verification', () => {

  test('1. Floating Assistant Icon removed; Single persistent avatar displayed in place', () => {
    const voiceAgentModalContent = fs.readFileSync(
      path.join(rootDir, 'frontend/src/components/VoiceAgent/VoiceAgentModal.jsx'),
      'utf8'
    );
    // Old floating circular button must NOT be rendered in VoiceAgentModal
    assert.strictEqual(
      voiceAgentModalContent.includes('ai-assistant-floating-button'),
      false,
      'Old floating circular assistant button must be removed'
    );
    // CharacterBuddy is the persistent avatar docked at the assistant position
    assert.ok(
      voiceAgentModalContent.includes('<CharacterBuddy'),
      'CharacterBuddy must be rendered as the persistent avatar'
    );
    assert.ok(
      voiceAgentModalContent.includes("loopra-character-dock-container"),
      'CharacterBuddy must be contained in the persistent dock container'
    );
  });

  test('2. Right-Click and Mobile Long-Press open the AI Chat Assistant', () => {
    const characterBuddyContent = fs.readFileSync(
      path.join(rootDir, 'frontend/src/components/VoiceAgent/CharacterBuddy.jsx'),
      'utf8'
    );

    // Right-click handling: onContextMenu calls onToggleChat
    assert.ok(
      characterBuddyContent.includes('onContextMenu'),
      'CharacterBuddy must register onContextMenu for right-click'
    );
    assert.ok(
      characterBuddyContent.includes('onToggleChat'),
      'CharacterBuddy must invoke onToggleChat to open Chat Assistant'
    );

    // Mobile long-press handling
    assert.ok(
      characterBuddyContent.includes('longPressTimerRef') && characterBuddyContent.includes('didLongPressRef'),
      'CharacterBuddy must maintain a long-press timer for mobile interactions'
    );
    assert.ok(
      characterBuddyContent.includes('onToggleChat()'),
      'Long-press on mobile must trigger onToggleChat()'
    );

    // Normal left-click retained
    assert.ok(
      characterBuddyContent.includes('onToggleVoiceMode()'),
      'Normal single click must preserve voice activation/deactivation'
    );
    assert.ok(
      characterBuddyContent.includes("'wink'"),
      'Double click must preserve wink gesture'
    );
  });

  test('3. Voice Control features and Avatar Animation Tests merged into Chatbox', () => {
    const chatCompanionContent = fs.readFileSync(
      path.join(rootDir, 'frontend/src/components/AiMusicCompanion/LoopraAiCompanion.jsx'),
      'utf8'
    );

    // Voice output / TTS selection and controls
    assert.ok(
      chatCompanionContent.includes('handleToggleVoiceOutput') || chatCompanionContent.includes('voiceBuddyService.toggleVoiceOutput'),
      'Chatbox must include Voice Output TTS toggle'
    );
    assert.ok(
      chatCompanionContent.includes('handleTestVoice'),
      'Chatbox must include Voice Output Testing'
    );
    assert.ok(
      chatCompanionContent.includes('Loopra Female Voice'),
      'Chatbox must feature Loopra Female Voice (Indian Accent)'
    );

    // Avatar animation tests: Wave, Wink, Dance, Jump, Think
    assert.ok(
      chatCompanionContent.includes("action: 'wave'") &&
      chatCompanionContent.includes("action: 'wink'") &&
      chatCompanionContent.includes("action: 'dance'") &&
      chatCompanionContent.includes("action: 'jump'"),
      'Chatbox must include Avatar animation test buttons for Wave, Wink, Dance, and Jump'
    );

    // Quick commands
    assert.ok(
      chatCompanionContent.includes('Saloon FM kholo') &&
      chatCompanionContent.includes('Play 5 songs of Arijit Singh') &&
      chatCompanionContent.includes('Trending songs'),
      'Chatbox must include quick commands for Saloon FM, Arijit Singh, and Trending Songs'
    );
  });

  test('4. Old Voice Control input bar removed; Chat Assistant is the single unified input', () => {
    const characterBuddyContent = fs.readFileSync(
      path.join(rootDir, 'frontend/src/components/VoiceAgent/CharacterBuddy.jsx'),
      'utf8'
    );

    // Old separate input bar and form in CharacterBuddy must be completely gone
    assert.strictEqual(
      characterBuddyContent.includes('<form onSubmit={handleTextSubmit}'),
      false,
      'Old input bar form must be removed from CharacterBuddy'
    );
    assert.strictEqual(
      characterBuddyContent.includes("placeholder=\"Type command"),
      false,
      'Old input placeholder must be removed from CharacterBuddy'
    );

    // Unified command pipeline in LoopraAiCompanion
    const chatCompanionContent = fs.readFileSync(
      path.join(rootDir, 'frontend/src/components/AiMusicCompanion/LoopraAiCompanion.jsx'),
      'utf8'
    );
    assert.ok(
      chatCompanionContent.includes('parseCommandToAction'),
      'Chat input must route commands through parseCommandToAction'
    );
    assert.ok(
      chatCompanionContent.includes('INTENT_CATEGORIES.OPEN_PAGE'),
      'Chat input must handle OPEN_PAGE navigation commands'
    );
    assert.ok(
      chatCompanionContent.includes('INTENT_CATEGORIES.PLAY_MUSIC'),
      'Chat input must handle PLAY_MUSIC commands'
    );
  });

  test('5. Avatar Movement: dynamic duration, continuous bipedal limb kinematics, natural return', () => {
    const characterBuddyContent = fs.readFileSync(
      path.join(rootDir, 'frontend/src/components/VoiceAgent/CharacterBuddy.jsx'),
      'utf8'
    );
    const twoDCharacterContent = fs.readFileSync(
      path.join(rootDir, 'frontend/src/components/VoiceAgent/TwoDCharacter.jsx'),
      'utf8'
    );

    // Distance-based duration (no flying / teleporting)
    assert.ok(
      characterBuddyContent.includes('Math.hypot(deltaX, deltaY)') &&
      characterBuddyContent.includes('travelDuration'),
      'CharacterBuddy must calculate dynamic travelDuration from physical distance'
    );

    // Symmetric return journey orientation
    assert.ok(
      characterBuddyContent.includes('returnFacing = deltaX < 0 ? \'right\' : \'left\''),
      'CharacterBuddy must correctly orient character on return travel'
    );

    // Continuous limb kinematics: separate left & right UV-mapped leg meshes
    assert.ok(
      twoDCharacterContent.includes('legLMesh') && twoDCharacterContent.includes('legRMesh'),
      'TwoDCharacter must rig independent legLMesh and legRMesh planes'
    );
    assert.ok(
      twoDCharacterContent.includes('legL.rotation.x = stride *') &&
      twoDCharacterContent.includes('legR.rotation.x = -stride *'),
      'TwoDCharacter must oscillate legL and legR in opposite strides'
    );
    assert.ok(
      twoDCharacterContent.includes('armL.rotation.x = -stride *') &&
      twoDCharacterContent.includes('armR.rotation.x = stride *'),
      'TwoDCharacter must pump armL and armR in counter-stride'
    );
  });

  test('6. "SPEAKING" text label removed completely; replaced by sleek gold audio waveform', () => {
    const characterBuddyContent = fs.readFileSync(
      path.join(rootDir, 'frontend/src/components/VoiceAgent/CharacterBuddy.jsx'),
      'utf8'
    );

    // No text label saying "SPEAKING"
    assert.strictEqual(
      characterBuddyContent.includes('{isSpeaking ? \'Speaking\' : \'Replied\'}'),
      false,
      'Old Speaking text badge must be removed'
    );
    assert.strictEqual(
      characterBuddyContent.includes('>SPEAKING<') || characterBuddyContent.includes('>Speaking<'),
      false,
      'No text element with SPEAKING should exist in character buddy'
    );

    // Subtle audio waveform present and conditioned strictly on isSpeaking
    assert.ok(
      characterBuddyContent.includes('{isSpeaking && (') &&
      characterBuddyContent.includes('backgroundColor: \'#f59e0b\'') &&
      characterBuddyContent.includes('bg-neutral-950/60'),
      'Sleek 60% opacity gold audio waveform must display only when actively speaking'
    );
  });

  test('7. Female voice persona preserved and locked (no male avatar selection)', () => {
    const voiceBuddyServiceContent = fs.readFileSync(
      path.join(rootDir, 'frontend/src/services/voiceBuddyService.js'),
      'utf8'
    );

    assert.ok(
      voiceBuddyServiceContent.includes("this.activeCharacterKey = 'female'"),
      'voiceBuddyService must default strictly to female persona'
    );
    assert.ok(
      voiceBuddyServiceContent.includes('en-IN-NeerjaExpressiveNeural') ||
      voiceBuddyServiceContent.includes('hi-IN-SwaraNeural'),
      'voiceBuddyService must use expressively tuned Indian neural voice'
    );
  });
});

