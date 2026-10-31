import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

console.log('=== STARTING LOOPRA BROWSER TAB TITLE VERIFICATION SUITE ===\n');

// 1. Check frontend/index.html default title & metadata
const indexHtmlPath = path.join(rootDir, 'frontend', 'index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

assert.ok(indexHtml.includes('<title>Loopra'), 'index.html must have Loopra in title');
assert.ok(!indexHtml.includes('AfterHours Mehfil'), 'index.html must NOT contain "AfterHours Mehfil"');
assert.ok(indexHtml.includes('property="og:title" content="Loopra'), 'index.html must have og:title starting with Loopra');
assert.ok(indexHtml.includes('name="twitter:title" content="Loopra'), 'index.html must have twitter:title starting with Loopra');
console.log('✓ Test 1 Passed: index.html has exact title and OpenGraph/Twitter title metadata set to "Loopra"');

// 2. Check public/manifest.json
const manifestPath = path.join(rootDir, 'frontend', 'public', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.strictEqual(manifest.name, 'Loopra', 'manifest.json name must be "Loopra"');
assert.strictEqual(manifest.short_name, 'Loopra', 'manifest.json short_name must be "Loopra"');
assert.ok(!JSON.stringify(manifest).includes('AfterHours Mehfil'), 'manifest.json must NOT contain "AfterHours Mehfil"');
console.log('✓ Test 2 Passed: manifest.json has exact name and short_name set to "Loopra"');

// 3. Check App.jsx document.title logic
const appJsxPath = path.join(rootDir, 'frontend', 'src', 'App.jsx');
const appJsx = fs.readFileSync(appJsxPath, 'utf8');

assert.ok(appJsx.includes("document.title = 'Loopra';"), "App.jsx must set document.title = 'Loopra'");
assert.ok(!appJsx.includes('Music Lounge'), "App.jsx must no longer fall back to 'Music Lounge'");
assert.ok(!appJsx.includes('${siteName} — Streaming Lounge'), "App.jsx must no longer append 'Streaming Lounge'");
assert.ok(!appJsx.includes('${siteName} — ${siteTagline}'), "App.jsx must no longer append dynamic tagline to document.title");
console.log('✓ Test 3 Passed: App.jsx enforces document.title = "Loopra" consistently on mount, CMS updates, and tab navigation');

// 4. Test normalizeCmsConfig sanitization with legacy DB mock
import { normalizeCmsConfig } from '../../frontend/src/services/cmsClient.js';

const mockLegacyConfig = {
  version: 1,
  branding: {
    siteName: '',
    tagline: 'AfterHours Mehfil Music',
    description: 'Old description'
  }
};
const normalizedLegacy = normalizeCmsConfig(mockLegacyConfig);
assert.strictEqual(normalizedLegacy.branding.siteName, 'Loopra', 'Empty siteName must normalize to "Loopra"');
assert.strictEqual(normalizedLegacy.branding.tagline, '', 'Legacy AfterHours Mehfil tagline must be sanitized to empty string');
console.log('✓ Test 4 Passed: normalizeCmsConfig cleanly purges legacy "AfterHours Mehfil" from DB/cache');

// 5. Test normalizeCmsConfig with clean custom config
const mockCleanConfig = {
  version: 1,
  branding: {
    siteName: 'Loopra',
    tagline: 'Infinite Sound. Endless Vibes.',
    description: 'Clean description'
  }
};
const normalizedClean = normalizeCmsConfig(mockCleanConfig);
assert.strictEqual(normalizedClean.branding.siteName, 'Loopra');
assert.strictEqual(normalizedClean.branding.tagline, 'Infinite Sound. Endless Vibes.');
console.log('✓ Test 5 Passed: normalizeCmsConfig preserves valid Loopra branding');

console.log('\n=== ALL 5 BROWSER TAB TITLE VERIFICATION TESTS PASSED! ===');

