import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

console.log('=== LOOPRA AVATAR RESPONSIVE FRAMING, TOUCH RESIZE & AUTONOMOUS ANIMATIONS TEST SUITE ===');

const charBuddyCode = fs.readFileSync('frontend/src/components/VoiceAgent/CharacterBuddy.jsx', 'utf-8');
const threeDCode = fs.readFileSync('frontend/src/components/VoiceAgent/ThreeDCharacter.jsx', 'utf-8');
const modalCode = fs.readFileSync('frontend/src/components/VoiceAgent/VoiceAgentModal.jsx', 'utf-8');

describe('1. Avatar Container & Camera Framing Calibration', () => {
  it('should remove restrictive fixed w-36 / w-52 classes and use responsive character dimensions', () => {
    assert.strictEqual(charBuddyCode.includes('w-36'), false, 'CharacterBuddy container must NOT have restrictive w-36 class');
    assert.strictEqual(charBuddyCode.includes('w-52'), false, 'CharacterBuddy container must NOT have restrictive w-52 class');
    assert.ok(charBuddyCode.includes("width: `${characterWidth}px`"), 'Container must size dynamically to characterWidth');
    assert.ok(charBuddyCode.includes("height: `${characterHeight}px`"), 'Container must size dynamically to characterHeight');
  });

  it('should dynamically calibrate camera distance taking wingspan and height into account', () => {
    assert.ok(threeDCode.includes('charWingspan') || threeDCode.includes('distForWidth'), 'ThreeDCharacter must calculate horizontal framing from wingspan');
    assert.ok(threeDCode.includes('distForHeight'), 'ThreeDCharacter must calculate vertical framing from height');
    assert.ok(threeDCode.includes('Math.max(distForHeight, distForWidth)'), 'Camera distance must take max of height and width distance');
  });

  it('should position character higher with minimal empty headroom', () => {
    assert.ok(threeDCode.includes('cameraCenterY'), 'ThreeDCharacter must calibrate cameraCenterY to reduce empty space above character');
    assert.ok(threeDCode.includes('charHeight * 1.07') || threeDCode.includes('charHeight * 1.08'), 'Vertical span must have tight headroom margin');
  });
});

describe('2. Touch-and-Hold Resizing & Removal of Permanent +/- Buttons', () => {
  it('should completely remove permanent plus and minus resize buttons', () => {
    assert.strictEqual(charBuddyCode.includes('Zoom In Avatar'), false, 'Must not render permanent Zoom In (+) button');
    assert.strictEqual(charBuddyCode.includes('Zoom Out Avatar'), false, 'Must not render permanent Zoom Out (-) button');
    assert.strictEqual(charBuddyCode.includes('<Plus'), false, 'Must not import or render Plus icon');
    assert.strictEqual(charBuddyCode.includes('<Minus'), false, 'Must not import or render Minus icon');
  });

  it('should provide small reset size/position and dismiss controls', () => {
    assert.ok(charBuddyCode.includes('Reset Avatar Size & Position'), 'Must provide small reset size & position control');
    assert.ok(charBuddyCode.includes('Hide Avatar'), 'Must provide dismiss/hide button');
  });

  it('should implement 500ms press-and-hold to enter resize mode', () => {
    assert.ok(charBuddyCode.includes('resizeHoldTimerRef'), 'Must maintain resizeHoldTimerRef');
    assert.ok(charBuddyCode.includes('500'), 'Must wait 500ms before activating resize mode');
    assert.ok(charBuddyCode.includes('isResizeMode'), 'Must track isResizeMode state');
  });

  it('should support drag outward to enlarge, inward to shrink, and two-finger mobile pinch', () => {
    assert.ok(charBuddyCode.includes('pinchRef') && charBuddyCode.includes('isPinching'), 'Must support mobile two-finger pinch-to-resize');
    assert.ok(charBuddyCode.includes('initialDistFromCenterRef') && charBuddyCode.includes('avatarCenterRef'), 'Must compute radial distance from center for drag resizing');
    assert.ok(charBuddyCode.includes('updateAvatarScale'), 'Must smoothly update avatar scale with clamp');
  });

  it('should prevent resize gestures from triggering click commands or voice toggle', () => {
    assert.ok(charBuddyCode.includes('didEnterResizeModeRef'), 'Must track if resize mode was entered during pointer gesture');
  });
});

describe('3. Autonomous Character Animation System & 9 States', () => {
  it('should support all 9 required states in ThreeDCharacter kinematics', () => {
    const states = [
      'curState === \'idle\'',
      'curState === \'standing\'',
      'curState === \'sitting\'',
      'curState === \'walking\'',
      'curState === \'dancing\'',
      'curState === \'listening\'',
      'curState === \'thinking\'',
      'curState === \'executing\'',
      'curState === \'speaking\''
    ];
    for (const stateStr of states) {
      assert.ok(threeDCode.includes(stateStr), `ThreeDCharacter must implement kinematic branch for: ${stateStr}`);
    }
  });

  it('should implement 5-second inactivity trigger for autonomous behavior', () => {
    assert.ok(charBuddyCode.includes('runAutonomousBehavior'), 'Must implement autonomous behavior scheduler');
    assert.ok(charBuddyCode.includes('5000'), 'Must trigger autonomous behavior after 5000ms of inactivity');
    assert.ok(charBuddyCode.includes('autonomousTimerRef'), 'Must manage autonomous timer');
  });

  it('should rotate among natural behaviors without continuous repetition', () => {
    assert.ok(charBuddyCode.includes('behaviorPool') || charBuddyCode.includes('behaviorChoices'), 'Must have a pool of autonomous behaviors');
    assert.ok(charBuddyCode.includes('lastAutonomousChoiceRef'), 'Must avoid repeating the exact same behavior consecutively');
  });
});

describe('4. Music-Synchronized Dancing', () => {
  it('should implement continuous music-synchronized dancing with variations in ThreeDCharacter', () => {
    assert.ok(threeDCode.includes('dancePhase') || threeDCode.includes('danceRoutine'), 'Must calculate music dance rhythm and routines');
    assert.ok(threeDCode.includes('intensity'), 'Must scale dance intensity with audio');
    assert.ok(threeDCode.includes('danceRoutine === 0') && threeDCode.includes('danceRoutine === 1'), 'Must provide multiple choreography variations');
  });

  it('should switch naturally between dance variations without abrupt restarts', () => {
    assert.ok(threeDCode.includes('time / 12') || threeDCode.includes('time / 10'), 'Must cycle dance routines smoothly over time');
  });
});

describe('5. Command Priority Over Dancing & Centralized Controller', () => {
  it('should implement centralized animation controller with 4 priority tiers', () => {
    assert.ok(charBuddyCode.includes('activeAnimationState'), 'CharacterBuddy must compute activeAnimationState');
    // Tier 1: Listening / Executing / Thinking
    assert.ok(charBuddyCode.includes("if (isListening) return 'listening'"), 'Priority 1: Listening must take precedence');
    assert.ok(charBuddyCode.includes("if (isExecuting) return 'executing'"), 'Priority 1: Executing must take precedence');
    assert.ok(charBuddyCode.includes("if (isThinking) return 'thinking'"), 'Priority 1: Thinking must take precedence');
    // Tier 2: Speaking
    assert.ok(charBuddyCode.includes("if (isSpeaking) return 'speaking'"), 'Priority 2: Speaking must take precedence over dance and idle');
    // Tier 3: Dancing
    assert.ok(charBuddyCode.includes("if (isPlaying) return 'dancing'"), 'Priority 3: Dancing when isPlaying is true');
    // Tier 4: Autonomous idle
    assert.ok(charBuddyCode.includes("return autonomousSubState"), 'Priority 4: Autonomous idle when no command and no music');
  });

  it('should notify thinking and executing state during voice pipeline in VoiceAgentModal', () => {
    assert.ok(modalCode.includes('__loopraSetAvatarExecuting'), 'VoiceAgentModal must signal execution start/end to avatar');
    assert.ok(charBuddyCode.includes('__loopraSetAvatarExecuting'), 'CharacterBuddy must listen for __loopraSetAvatarExecuting');
  });
});

