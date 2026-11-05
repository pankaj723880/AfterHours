import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseCommandToAction, INTENT_CATEGORIES } from '../../frontend/src/services/commandActionEngine.js';
import { parseVoiceCommandLocally } from '../../frontend/src/services/voiceAgentRegistry.js';
import { parseMultiStepInstruction, executeTaskPipeline } from '../../frontend/src/services/voiceTaskEngine.js';
import { voiceBuddyService } from '../../frontend/src/services/voiceBuddyService.js';
import { fallbackHeuristicClassifier } from '../services/chatBuddyLlmService.js';

describe('Loopra Casual Conversation & No "Executed Clarified" Verification Suite', () => {

  it('1. User says "Hey Loopra, how are you?" -> Natural conversational response, NOT clarify or Executed Clarified', () => {
    const text = 'Hey Loopra, how are you?';
    
    // Direct action MUST be GENERAL_QUESTION (not clarify, not playback)
    const directAction = parseCommandToAction(text, {});
    assert.strictEqual(directAction.intent, INTENT_CATEGORIES.GENERAL_QUESTION);
    assert.strictEqual(directAction.action, 'chat');

    // Local command registry must NOT return a bogus clarify step
    const localParse = parseVoiceCommandLocally(text, {});
    assert.strictEqual(localParse, null, 'parseVoiceCommandLocally must return null for casual chat');

    // Multi-step parser must NOT create a task pipeline for casual speech
    const steps = parseMultiStepInstruction(text, {});
    assert.strictEqual(steps.length, 0, 'parseMultiStepInstruction must return empty array for casual conversation');

    // Backend chat engine returns natural conversational reply
    const chatRes = fallbackHeuristicClassifier(text);
    assert.strictEqual(chatRes.type, 'chat');
    assert.ok(!/executed/i.test(chatRes.reply), 'Reply must not contain "executed"');
    assert.ok(!/clarif/i.test(chatRes.reply), 'Reply must not contain "clarify"');
    assert.ok(chatRes.reply.length > 10, 'Must be a substantive conversational reply');
    console.log('  ✔ "Hey Loopra, how are you?" -> Reply:', chatRes.reply);
  });

  it('2. User says "What are you doing?" -> Natural conversational response', () => {
    const text = 'What are you doing?';
    const directAction = parseCommandToAction(text, {});
    assert.strictEqual(directAction.intent, INTENT_CATEGORIES.GENERAL_QUESTION);

    const steps = parseMultiStepInstruction(text, {});
    assert.strictEqual(steps.length, 0);

    const chatRes = fallbackHeuristicClassifier(text);
    assert.strictEqual(chatRes.type, 'chat');
    assert.ok(!/executed/i.test(chatRes.reply));
    assert.ok(chatRes.reply.length > 10);
    console.log('  ✔ "What are you doing?" -> Reply:', chatRes.reply);
  });

  it('3. User says "Tell me something interesting." -> Natural conversational response', () => {
    const text = 'Tell me something interesting.';
    const directAction = parseCommandToAction(text, {});
    assert.strictEqual(directAction.intent, INTENT_CATEGORIES.GENERAL_QUESTION);

    const steps = parseMultiStepInstruction(text, {});
    assert.strictEqual(steps.length, 0);

    const chatRes = fallbackHeuristicClassifier(text);
    assert.strictEqual(chatRes.type, 'chat');
    assert.ok(!/executed/i.test(chatRes.reply));
    assert.ok(chatRes.reply.length > 10);
    console.log('  ✔ "Tell me something interesting." -> Reply:', chatRes.reply);
  });

  it('4. User says "Play Headlight by Alan Walker." -> Existing music command executes cleanly', () => {
    const text = 'Play Headlight by Alan Walker.';
    const directAction = parseCommandToAction(text, {});
    assert.strictEqual(directAction.intent, INTENT_CATEGORIES.PLAY_SONG);
    assert.strictEqual(directAction.action, 'play_search');
    assert.ok(directAction.query.toLowerCase().includes('headlight'));
    assert.ok(directAction.query.toLowerCase().includes('alan walker'));
    console.log('  ✔ "Play Headlight by Alan Walker." -> Action:', directAction.action, 'Query:', directAction.query);
  });

  it('5. User says "Play that song." -> Asks clarification ONLY if no song in context', () => {
    // A. Empty context -> Asks clarification
    const emptyContextAction = parseCommandToAction('Play that song.', {});
    assert.strictEqual(emptyContextAction.intent, INTENT_CATEGORIES.CLARIFY);
    assert.strictEqual(emptyContextAction.action, 'clarify');
    assert.strictEqual(emptyContextAction.speechResponse, 'Which song would you like to play?');
    console.log('  ✔ "Play that song" (empty context) -> Clarification:', emptyContextAction.speechResponse);

    // B. Context has lastPlayedTrack -> Plays that song without asking!
    const trackContext = { lastPlayedTrack: { id: 'track_alan_1', title: 'Headlight' } };
    const withContextAction = parseCommandToAction('Play that song.', trackContext);
    assert.strictEqual(withContextAction.intent, INTENT_CATEGORIES.PLAY_SONG);
    assert.strictEqual(withContextAction.action, 'play_direct');
    assert.strictEqual(withContextAction.track.title, 'Headlight');
    console.log('  ✔ "Play that song" (with context) -> Direct Play:', withContextAction.track.title);
  });

  it('6. executeTaskPipeline NEVER returns "Executed clarify" or debug labels', async () => {
    // If a step with action='clarify' enters executeTaskPipeline, it must return clarificationRequired, not "Executed clarify"
    const mockSteps = [
      {
        id: 'step_1',
        type: 'clarify',
        action: 'clarify',
        speechResponse: 'Which song would you like to play?'
      }
    ];

    const result = await executeTaskPipeline(mockSteps, {}, {});
    assert.strictEqual(result.clarificationRequired, true);
    assert.ok(!/executed/i.test(result.message), 'Must NOT output "Executed clarify"');
    assert.strictEqual(result.message, 'Which song would you like to play?');
    console.log('  ✔ executeTaskPipeline clarification output:', result.message);
  });

  it('7. voiceBuddyService.generateFriendReply suppresses any string matching /executed\\s*clarif/i', () => {
    const rawBadString = 'Executed clarify';
    const reply = voiceBuddyService.generateFriendReply('Hey Loopra', rawBadString);
    assert.ok(!/executed\s*clarif/i.test(reply), 'generateFriendReply must sanitize internal execution strings');
    console.log('  ✔ Sanitized voiceBuddyService reply:', reply);
  });
});

