import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CORE_CATALOG_TRACKS } from '../services/catalogService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Tum Hi Ho is mapped to official ID Umqb9KENgmk and never Butta Bomma (2mDCVzruYzQ)', () => {
  // 1. Verify CORE_CATALOG_TRACKS
  const tumHiHo = CORE_CATALOG_TRACKS.find(
    (t) => t.title && t.title.toLowerCase().includes('tum hi ho')
  );
  assert.ok(tumHiHo, 'Tum Hi Ho should exist in catalogService CORE_CATALOG_TRACKS');
  assert.equal(tumHiHo.id, 'Umqb9KENgmk', 'Tum Hi Ho ID must be Umqb9KENgmk');
  assert.notEqual(tumHiHo.id, '2mDCVzruYzQ', 'Tum Hi Ho must NOT be mapped to 2mDCVzruYzQ (Butta Bomma)');

  // 2. Verify backend/server.js
  const serverPath = path.join(__dirname, '..', 'server.js');
  const serverCode = fs.readFileSync(serverPath, 'utf8');
  assert.ok(
    !serverCode.includes("2mDCVzruYzQ"),
    'backend/server.js must not contain Butta Bomma ID 2mDCVzruYzQ'
  );
  assert.ok(
    serverCode.includes('Umqb9KENgmk'),
    'backend/server.js must contain official Tum Hi Ho ID Umqb9KENgmk'
  );

  // 3. Verify frontend/src/App.jsx
  const appPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'App.jsx');
  const appCode = fs.readFileSync(appPath, 'utf8');
  assert.ok(
    !appCode.includes("2mDCVzruYzQ"),
    'frontend/src/App.jsx must not contain 2mDCVzruYzQ'
  );
  assert.ok(
    appCode.includes('Umqb9KENgmk'),
    'frontend/src/App.jsx must contain official Tum Hi Ho ID Umqb9KENgmk'
  );
});

test('CORE_CATALOG_TRACKS integrity check', () => {
  assert.ok(Array.isArray(CORE_CATALOG_TRACKS) && CORE_CATALOG_TRACKS.length > 0);
  
  for (const track of CORE_CATALOG_TRACKS) {
    assert.ok(track.id && typeof track.id === 'string' && track.id.length >= 5, `Track ${track.title} has invalid id: ${track.id}`);
    assert.ok(track.title && typeof track.title === 'string', `Track ${track.id} has invalid title`);
    assert.ok(track.artist && typeof track.artist === 'string', `Track ${track.id} has invalid artist`);
  }
});

test('aiMusicCompanionClient.js handles streaming without calling json() on consumed stream', () => {
  const clientPath = path.join(
    __dirname,
    '..',
    '..',
    'frontend',
    'src',
    'services',
    'aiMusicCompanionClient.js'
  );
  const clientCode = fs.readFileSync(clientPath, 'utf8');

  // Verify that it reads response stream safely
  assert.ok(
    clientCode.includes('getReader()'),
    'client should use getReader for streaming responses'
  );
  // Verify that if onChunk is provided, it returns inside the streaming block (either donePayload or fallback object)
  assert.ok(
    clientCode.includes('if (donePayload) return donePayload;'),
    'client must return donePayload from the streaming block without falling through to res.json()'
  );
  assert.ok(
    clientCode.includes('return await res.json();'),
    'client retains res.json() fallback for non-streaming callers'
  );
});

test('LoopraAiCompanion.jsx is rendered via Portal to document.body and uses single shared anchor', () => {
  const companionPath = path.join(
    __dirname,
    '..',
    '..',
    'frontend',
    'src',
    'components',
    'AiMusicCompanion',
    'LoopraAiCompanion.jsx'
  );
  const companionCode = fs.readFileSync(companionPath, 'utf8');

  assert.ok(
    companionCode.includes('createPortal('),
    'Companion must be rendered into document.body using createPortal'
  );
  assert.ok(
    companionCode.includes('loopra_ai_companion_anchor'),
    'Companion must use loopra_ai_companion_anchor for persistent unified position'
  );
  assert.ok(
    companionCode.includes('getDisplayMedia'),
    'Companion must support getDisplayMedia for tab/system audio capture'
  );
  assert.ok(
    companionCode.includes('getUserMedia'),
    'Companion must support getUserMedia for acoustic microphone fallback'
  );
});
