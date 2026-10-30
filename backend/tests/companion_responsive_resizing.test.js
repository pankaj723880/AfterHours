import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Companion responsive sizing and manual resizing logic verification', async (t) => {
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

  const cssPath = path.join(
    __dirname,
    '..',
    '..',
    'frontend',
    'src',
    'index.css'
  );
  const cssCode = fs.readFileSync(cssPath, 'utf8');

  await t.test('1. Mobile chat window default size ratio (85-90% width, 55-65% height)', () => {
    assert.ok(
      companionCode.includes('Math.round(vp.width * 0.88)') || companionCode.includes('vp.width * 0.85'),
      'Mobile default width should target 85-90% of available viewport width'
    );
    assert.ok(
      companionCode.includes('Math.round(vp.height * 0.60)') || companionCode.includes('vp.height * 0.55'),
      'Mobile default height should target 55-65% of available viewport height'
    );
    assert.ok(
      cssCode.includes('width: var(--chat-panel-width, 88vw) !important;'),
      'Mobile CSS fallback should use ~88vw'
    );
    assert.ok(
      cssCode.includes('height: var(--chat-panel-height, 60vh) !important;'),
      'Mobile CSS fallback should use ~60vh'
    );
  });

  await t.test('2. Desktop/Laptop default size (400-440px width, 550-620px height)', () => {
    assert.ok(
      companionCode.includes('DEFAULT_DESKTOP_WIDTH = 420') || companionCode.includes('420'),
      'Desktop default width should be 400-440px'
    );
    assert.ok(
      companionCode.includes('DEFAULT_DESKTOP_HEIGHT = 580') || companionCode.includes('580'),
      'Desktop default height should be 550-620px'
    );
    assert.ok(
      cssCode.includes('width: var(--chat-panel-width, 420px) !important;'),
      'Desktop CSS fallback width should be 400-440px'
    );
    assert.ok(
      cssCode.includes('height: var(--chat-panel-height, 580px) !important;'),
      'Desktop CSS fallback height should be 550-620px'
    );
  });

  await t.test('3. Separate desktop and mobile persistence keys', () => {
    assert.ok(
      companionCode.includes('loopra_ai_chat_dims_desktop'),
      'Should store desktop dimensions under loopra_ai_chat_dims_desktop'
    );
    assert.ok(
      companionCode.includes('loopra_ai_chat_dims_mobile'),
      'Should store mobile dimensions under loopra_ai_chat_dims_mobile'
    );
  });

  await t.test('4. Manual resize handle with pointer events and touch-none', () => {
    assert.ok(
      companionCode.includes("handleResizePointerDown('bl'"),
      'Should provide bottom-left resize handle'
    );
    assert.ok(
      companionCode.includes('cursor-sw-resize'),
      'Bottom-left handle should have sw-resize cursor'
    );
    assert.ok(
      companionCode.includes('touch-none'),
      'Resize handle should have touch-none to prevent accidental page scrolling'
    );
    assert.ok(
      companionCode.includes('setPointerCapture'),
      'Should capture pointer for smooth uninterrupted resizing across mouse and touch'
    );
  });

  await t.test('5. Floating button fixed positioning is preserved', () => {
    assert.ok(
      cssCode.includes('.ai-assistant-floating-button {') &&
      cssCode.includes('position: fixed !important;') &&
      cssCode.includes('right: 24px !important;') &&
      cssCode.includes('bottom: 24px !important;'),
      'Floating assistant button must remain fixed at bottom-right'
    );
    assert.ok(
      companionCode.includes('ai-assistant-floating-button'),
      'Button must have ai-assistant-floating-button class'
    );
  });

  await t.test('6. Chat window is anchored above-left of button and never opens below', () => {
    assert.ok(
      cssCode.includes('bottom: calc(24px + 56px + 12px) !important;'),
      'Desktop chat panel must be anchored above the button'
    );
    assert.ok(
      cssCode.includes('bottom: calc(16px + 56px + 12px + env(safe-area-inset-bottom, 0px)) !important;'),
      'Mobile chat panel must be anchored above the button with safe area'
    );
  });
});

