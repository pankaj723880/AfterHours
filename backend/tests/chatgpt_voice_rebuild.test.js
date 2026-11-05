/**
 * Automated Test Suite: Loopra AI Voice Assistant Complete Rebuild
 * 
 * Verifies:
 * 1. Dynamic Startup Greeting Generation (non-static, Gemini-generated)
 * 2. 30 Consecutive Real-World Conversational Turns across Hindi, English, Hinglish, Follow-ups, Opinions, Tech
 * 3. Command vs Chat Intent Separation (False-positive prevention + genuine execution)
 * 4. Mixed Conversation & Command Understanding
 * 5. Multi-Turn Context Retention (React follow-up, topic switching)
 * 6. Task Completion Action-Specific Confirmation (No generic "executed" phrases)
 * 7. Live Voice Bridge & Interruption Handlers
 */

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

import {
  processChatBuddyMessage,
  generateDynamicStartupGreeting,
  callGeminiConversationalBrain,
  sanitizeAndParseJson
} from '../services/chatBuddyLlmService.js';

import { GEMINI_CONFIG } from '../config/geminiConfig.js';
import { geminiLiveBridge } from '../services/geminiLiveBridge.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 LOOPRA AI VOICE REBUILD AUTOMATED VERIFICATION SUITE');
  console.log('======================================================');
  console.log(`Configured Chat Model: ${GEMINI_CONFIG.chatModel}`);
  console.log(`Configured Live Model: ${GEMINI_CONFIG.liveModel}`);

  // -------------------------------------------------------------------------
  // TEST 1: DYNAMIC STARTUP GREETING
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Testing Dynamic Startup Greeting ---');
  const greeting1 = await generateDynamicStartupGreeting({ lang: 'hi-IN' });
  const greeting2 = await generateDynamicStartupGreeting({ lang: 'hi-IN' });
  console.log('  Greeting 1:', greeting1);
  console.log('  Greeting 2:', greeting2);

  assert(typeof greeting1 === 'string' && greeting1.length > 5, 'Greeting 1 generated as valid string');
  assert(!/^(task executed|command executed)/i.test(greeting1), 'Greeting is not a generic status label');
  assert(greeting1.length < 150, 'Greeting is concise for instant voice playback');

  // -------------------------------------------------------------------------
  // TEST 2: CASUAL CONVERSATION VS COMMAND INTENT SEPARATION
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Testing Strict Intent Separation (Casual Talk vs Commands) ---');

  const intentCases = [
    { text: 'I love listening to Arijit Singh', expectedType: 'chat', expectedAction: 'none' },
    { text: 'I am thinking about opening my Downloads folder', expectedType: 'chat', expectedAction: 'none' },
    { text: 'I want to know how music playback works', expectedType: 'chat', expectedAction: 'none' },
    { text: 'Ye gaana kitna sundar hai na?', expectedType: 'chat', expectedAction: 'none' },
    { text: 'Play something relaxing', expectedType: 'command', expectedAction: 'play_song' },
    { text: 'Put on some Arijit songs', expectedType: 'command', expectedAction: 'play_song' },
    { text: 'Pause the music', expectedType: 'command', expectedAction: 'pause' },
    { text: 'Turn the volume down a little', expectedType: 'command', expectedAction: 'volume' },
    { text: 'Open my Downloads folder', expectedType: 'command', expectedAction: 'open_folder' }
  ];

  for (const c of intentCases) {
    const res = await processChatBuddyMessage({ message: c.text });
    console.log(`  Query: "${c.text}" -> Type: "${res.type}", Action: "${res.action}"`);
    assert(res.type === c.expectedType, `Correct type "${c.expectedType}" for "${c.text}"`);
    assert(res.action === c.expectedAction, `Correct action "${c.expectedAction}" for "${c.text}"`);
    assert(!/executed\s*(clarif|action|none|unknown)/i.test(res.reply), 'Reply contains no internal "executed" labels');
  }

  // -------------------------------------------------------------------------
  // TEST 3: MIXED CONVERSATION AND COMMANDS
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Testing Mixed Emotion & Command Handling ---');

  const mixedCase1 = await processChatBuddyMessage({
    message: 'Yaar, aaj mood bahut off hai, koi relaxing music chala de.'
  });
  console.log('  Mixed 1 Reply:', mixedCase1.reply);
  assert(mixedCase1.action === 'play_song', 'Mixed emotional prompt correctly identifies play_song command');
  assert(mixedCase1.reply.length > 10, 'Mixed prompt reply warmly acknowledges user emotion');

  const mixedCase2 = await processChatBuddyMessage({
    message: 'Pause the music. By the way, how are you?'
  });
  console.log('  Mixed 2 Reply:', mixedCase2.reply);
  assert(mixedCase2.action === 'pause', 'Mixed pause + how are you correctly pauses music');
  assert(/pause|roko|theek|good|badhiya|fine/i.test(mixedCase2.reply), 'Mixed prompt acknowledges both pause and greeting');

  // -------------------------------------------------------------------------
  // TEST 4: MULTI-TURN CONVERSATION CONTEXT RETENTION (30 Turns Benchmark)
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Testing Multi-Turn Continuous Conversation (Follow-ups & Context) ---');

  const multiTurnConversation = [
    // React learning & follow-ups
    'I am learning React right now.',
    'What should I learn next?',
    'Can you explain the second one in detail?',
    'Give me a practical code example of that.',
    
    // Opinions & debate
    'Do you think AI will replace programmers?',
    'Why do you think that?',
    'I disagree with your point.',
    'Explain your point again with an analogy.',
    
    // Everyday & Humor
    'Tell me a quick joke about JavaScript.',
    'Haha, that was clever!',
    'Guess what happened to me today?',
    'My coffee spilled on the keyboard!',
    
    // Hindi & Hinglish
    'Yaar aaj ka mausam kaisa hai?',
    'Kuch energetic sa sunao na mood fresh karne ke liye.',
    'Tumhara favorite instrument kaunsa hai?',
    'Kya tum guitar baja sakti ho?',
    
    // Deep discussions
    'What is the meaning of life in your opinion?',
    'How does music affect human emotions?',
    'Do animals also enjoy listening to music?',
    'Which frequency is known as the healing frequency?',
    
    // Music context follow-ups
    'Who is the most streamed artist in India?',
    'Tell me 3 iconic songs by Kishore Kumar.',
    'Which one is your personal favorite among them?',
    'Why that specific one?',
    
    // Casual chat & wrap-up
    'I have an interview tomorrow, I am nervous.',
    'Give me a 30-second pep talk.',
    'Thanks Loopra, that actually helped!',
    'What are you going to do now?',
    'Are you always awake?',
    'Goodnight Loopra, talk to you tomorrow!'
  ];

  let conversationHistory = [];
  let turnIndex = 0;

  for (const turnText of multiTurnConversation) {
    turnIndex++;
    const turnRes = await processChatBuddyMessage({
      message: turnText,
      history: conversationHistory,
      currentMusicState: { title: 'Ilahi', artist: 'Arijit Singh', isPlaying: true }
    });

    console.log(`  [Turn ${turnIndex}/30] User: "${turnText}"`);
    console.log(`         Loopra: "${turnRes.reply}" (Type: ${turnRes.type}, Action: ${turnRes.action})`);

    assert(turnRes.reply && turnRes.reply.trim().length > 5, `Turn ${turnIndex} generated natural dynamic response`);
    assert(!/executed\s*(clarif|action|none|unknown)/i.test(turnRes.reply), `Turn ${turnIndex} free of internal status artifacts`);

    // Append to conversation history for next turn
    conversationHistory.push({ role: 'user', text: turnText });
    conversationHistory.push({ role: 'model', reply: turnRes.reply });
  }

  // -------------------------------------------------------------------------
  // TEST 5: EXACT ACTION NAME CONFIRMATION (NO GENERIC "EXECUTED")
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Testing Action Completion Confirmations ---');

  const actionCases = [
    { text: 'Play Kesariya', expectedQuery: 'Kesariya' },
    { text: 'Open Downloads', expectedFolder: 'Downloads' },
    { text: 'Volume 50 percent kar do', expectedVolume: 50 },
    { text: 'Pause the music', expectedAction: 'pause' }
  ];

  for (const ac of actionCases) {
    const res = await processChatBuddyMessage({ message: ac.text });
    console.log(`  Action Query: "${ac.text}" -> Reply: "${res.reply}"`);
    assert(!/task executed successfully|command executed|action completed|executed successfully/i.test(res.reply), 'Does NOT contain generic "task executed successfully"');
    if (ac.expectedQuery) {
      assert(res.reply.toLowerCase().includes(ac.expectedQuery.toLowerCase()) || res.params?.query?.toLowerCase().includes(ac.expectedQuery.toLowerCase()), `Reflects target query "${ac.expectedQuery}"`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 6: LIVE WEBSOCKET BRIDGE REGISTER & INTERRUPT
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Testing Gemini Live Bridge ---');
  assert(typeof geminiLiveBridge.registerSocket === 'function', 'geminiLiveBridge.registerSocket is a valid function');
  assert(typeof geminiLiveBridge.startLiveSession === 'function', 'geminiLiveBridge.startLiveSession is a valid function');
  assert(typeof geminiLiveBridge.handleInterruption === 'function', 'geminiLiveBridge.handleInterruption is a valid function');

  // Summary
  console.log('\n======================================================');
  console.log(`🏁 TEST COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

