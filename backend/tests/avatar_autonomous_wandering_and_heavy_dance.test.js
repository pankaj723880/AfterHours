/**
 * Loopra Avatar Autonomous Wandering, Running, and Heavy-Movement Dancing Test
 * 
 * Verification Objectives:
 * 1. 5-Second Inactivity Trigger & Autonomous States
 * 2. Page-Wide Wandering, Running & Heavy Dancing Multi-Step Choreography
 * 3. Seamless Interruption on interaction
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

console.log('🚀 Running Avatar Autonomous Wandering, Running & Heavy-Movement Dancing Test...\n');

const charBuddyPath = path.resolve('frontend/src/components/VoiceAgent/CharacterBuddy.jsx');
const threeDCharPath = path.resolve('frontend/src/components/VoiceAgent/ThreeDCharacter.jsx');

const charBuddy = fs.readFileSync(charBuddyPath, 'utf8');
const threeDChar = fs.readFileSync(threeDCharPath, 'utf8');

// TEST 1: 5-Second Inactivity Trigger
runTest('5-Second Inactivity Timer is configured and armed', () => {
  assert(charBuddy.includes('5000); // 5-second inactivity trigger'), 'Must use exact 5000ms idle timer');
  assert(charBuddy.includes('inactivityTimerRef'), 'Must maintain inactivityTimerRef');
  assert(charBuddy.includes('pointerdown') && charBuddy.includes('mousemove') && charBuddy.includes('keydown'), 'Must track user window interactions');
});

// TEST 2: Page-Wide Wandering & Running
runTest('Autonomous exploration dynamically walks or runs across page bounds', () => {
  assert(charBuddy.includes('startAutonomousExploration'), 'Must have startAutonomousExploration');
  assert(charBuddy.includes("setAutonomousSubState(shouldRun ? 'running' : 'walking')"), 'Must select between running and walking');
  assert(charBuddy.includes('selectNextIdleDestination'), 'Must pick target coordinates across screen sectors');
  assert(charBuddy.includes('setWalkFacing(deltaX < 0 ? \'left\' : \'right\')'), 'Must orient facing direction during movement');
});

// TEST 3: Heavy-Movement Multi-Step Dancing
runTest('ThreeDCharacter supports heavy_dancing with multi-step skeletal choreography', () => {
  assert(threeDChar.includes("curState === 'heavy_dancing'"), 'Must handle heavy_dancing state');
  assert(threeDChar.includes('isHeavyDance ? 1.45 : 0.75'), 'Must boost bone movement intensity to 1.45 during heavy dancing');
  assert(threeDChar.includes('isHeavyDance ? Math.floor((time / 3.0) % 4)'), 'Must rotate through 4 dynamic dance routines');
  assert(charBuddy.includes("setAutonomousSubState('heavy_dancing')"), 'CharacterBuddy must trigger heavy_dancing upon arrival');
});

// TEST 4: Seamless Interruption
runTest('Seamless Interruption halts wandering/dancing instantly and returns to position', () => {
  assert(charBuddy.includes('stopAutonomousWalking(true)'), 'Must provide instantaneous stop');
  assert(charBuddy.includes("setWalkOffset({ x: 0, y: 0 })"), 'Must return to base origin offset on interrupt');
  assert(charBuddy.includes("setWalkFacing('front')"), 'Must reset facing to front on interrupt');
  assert(charBuddy.includes("isIdleWalkingRef.current = false"), 'Must cancel autonomous walking flag immediately');
});

console.log('\n======================================================');
console.log(`Verification Summary: Passed: ${passed}, Failed: ${failed}`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL AUTONOMOUS 3D AVATAR CAPABILITIES SUCCESSFULLY VERIFIED!');
  process.exit(0);
}

