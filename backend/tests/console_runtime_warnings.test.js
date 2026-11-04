import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

test('Console Warning Fixes - No deprecated THREE.Clock in codebase', () => {
  const threeDCode = fs.readFileSync(path.join(ROOT, 'frontend/src/components/VoiceAgent/ThreeDCharacter.jsx'), 'utf-8');
  const twoDCode = fs.readFileSync(path.join(ROOT, 'frontend/src/components/VoiceAgent/TwoDCharacter.jsx'), 'utf-8');
  const widgetCode = fs.readFileSync(path.join(ROOT, 'frontend/src/components/VoiceAgent/LoopraAvatarWidget.jsx'), 'utf-8');

  assert.ok(!threeDCode.includes('new THREE.Clock()'), 'ThreeDCharacter must not instantiate THREE.Clock');
  assert.ok(!twoDCode.includes('new THREE.Clock()'), 'TwoDCharacter must not instantiate THREE.Clock');
  assert.ok(!widgetCode.includes('new THREE.Clock()'), 'LoopraAvatarWidget must not instantiate THREE.Clock');

  assert.ok(threeDCode.includes('performance.now()'), 'ThreeDCharacter must use performance.now() delta timing');
  assert.ok(twoDCode.includes('performance.now()'), 'TwoDCharacter must use performance.now() delta timing');
});

test('Console Warning Fixes - No passive preventDefault wheel listeners', () => {
  const buddyCode = fs.readFileSync(path.join(ROOT, 'frontend/src/components/VoiceAgent/CharacterBuddy.jsx'), 'utf-8');

  // Verify non-passive event listener is registered
  assert.ok(
    buddyCode.includes("addEventListener('wheel', handleNativeWheel, { passive: false })"),
    'Must attach wheel event listener explicitly with passive: false'
  );

  // Verify no inline React onWheel={... e.preventDefault()}
  assert.ok(!buddyCode.includes('onWheel='), 'CharacterBuddy walker element must not use inline passive onWheel');
});

test('Search Timeout Fixes - Resilient backend timeout and instant curated fallback', () => {
  const appCode = fs.readFileSync(path.join(ROOT, 'frontend/src/App.jsx'), 'utf-8');

  // Verify timeout is at least 35s to account for free tier cold starts
  assert.ok(appCode.includes('timeoutMs || 35000'), 'fetchFromBackend must allow at least 35s for cold start');

  // Verify graceful fallback to curated tracks on failure
  assert.ok(
    appCode.includes('CURATED_STATION_TRACKS') && appCode.includes('localMatches'),
    'fetchYouTubeMusic must gracefully fallback to curated matching songs when search is connecting'
  );
});
