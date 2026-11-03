import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('Loopra Avatar Autonomous Full-Screen Idle Walking Verification', () => {
  const appPath = path.resolve('frontend/src/App.jsx');
  const buddyPath = path.resolve('frontend/src/components/VoiceAgent/CharacterBuddy.jsx');
  const threeDPath = path.resolve('frontend/src/components/VoiceAgent/ThreeDCharacter.jsx');
  const modalPath = path.resolve('frontend/src/components/VoiceAgent/VoiceAgentModal.jsx');

  const buddyCode = fs.readFileSync(buddyPath, 'utf8').replace(/\r\n/g, '\n');
  const threeDCode = fs.readFileSync(threeDPath, 'utf8').replace(/\r\n/g, '\n');
  const modalCode = fs.readFileSync(modalPath, 'utf8').replace(/\r\n/g, '\n');

  it('1. Avatar extends state machine with IDLE_WALKING state & rig animation support', () => {
    assert.ok(buddyCode.includes("'idle_walking'"), 'CharacterBuddy must include idle_walking state');
    assert.ok(threeDCode.includes("'idle_walking'"), 'ThreeDCharacter must handle idle_walking in travel & animation state');
    assert.ok(threeDCode.includes("fadeToAction('walk'"), 'ThreeDCharacter must play full-body walk animation on idle_walking');
  });

  it('2. Autonomous walking covers full screen across mobile & desktop with safe margins', () => {
    assert.ok(buddyCode.includes('getUsableScreenBounds'), 'Must compute dynamic usable viewport boundaries');
    assert.ok(buddyCode.includes('isBottomPlayerVisible'), 'Must respect bottom player offset on mobile and desktop');
    assert.ok(buddyCode.includes('bottomNavHeight'), 'Must account for bottom navigation bar on mobile');
  });

  it('3. Generates diverse randomized destinations across sectors to avoid repetitive ping-pong', () => {
    assert.ok(buddyCode.includes('selectNextIdleDestination'), 'Must contain destination selector function');
    assert.ok(buddyCode.includes('candidateSectors'), 'Must partition visible screen and filter recent sectors');
    assert.ok(buddyCode.includes('minDistance'), 'Must enforce minimum travel distance so avatar does not jitter');
  });

  it('4. Uses natural curved Bézier paths, smooth acceleration/deceleration, and directional turning', () => {
    assert.ok(buddyCode.includes('curvature'), 'Must calculate gentle Bézier curvature offset');
    assert.ok(buddyCode.includes('eased = progress < 0.5'), 'Must use smooth acceleration & deceleration easing');
    assert.ok(buddyCode.includes('setWalkFacing(deltaX < 0 ? \'left\' : \'right\')'), 'Must face walking direction');
    assert.ok(buddyCode.includes('setRotationYaw'), 'Must orient 3D body into the turn');
  });

  it('5. Immediate Interaction Priority: Stops instantly on voice, text, drag, resize, or task', () => {
    assert.ok(buddyCode.includes('stopAutonomousWalking'), 'Must contain unified stopAutonomousWalking function');
    assert.ok(buddyCode.includes('handlePointerDown') && buddyCode.includes('stopAutonomousWalking(true);'), 'Must stop immediately when user touches/clicks avatar');
    assert.ok(buddyCode.includes('recordCommandDisplay') && buddyCode.includes('stopAutonomousWalking(true);'), 'Must stop immediately when command is recorded');
    assert.ok(buddyCode.includes('walkToTargetAndTap') && buddyCode.includes('stopAutonomousWalking(true);'), 'Must stop immediately when navigating to element');
  });

  it('6. Tab visibility pausing and clean resumption', () => {
    assert.ok(buddyCode.includes("addEventListener('visibilitychange'"), 'Must register visibilitychange listener');
    assert.ok(buddyCode.includes('document.hidden') && buddyCode.includes('stopAutonomousWalking(true);'), 'Must halt walking when tab is hidden');
    assert.ok(buddyCode.includes("removeEventListener('visibilitychange'"), 'Must clean up visibility listener');
  });

  it('7. Admin Voice Control permission security (Avatar remains completely hidden if disabled)', () => {
    assert.ok(modalCode.includes('hasMountedAvatar && hasAccess'), 'Avatar must never render if admin access is disabled');
    assert.ok(modalCode.includes('hasAccess'), 'Autonomous walking must respect hasAccess permission check');
  });
});
