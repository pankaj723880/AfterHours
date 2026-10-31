import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const publicDir = path.join(rootDir, 'frontend', 'public');

console.log('====================================================');
console.log('STARTING LOOPRA FAVICON & BRANDING VERIFICATION SUITE');
console.log('====================================================\n');

// TEST 1: Approved Loopra Primary Logo Preservation
console.log('--- TEST 1: Official Loopra Primary Logo Preservation ---');
const logoPath = path.join(publicDir, 'loopra-logo.png');
assert(fs.existsSync(logoPath), 'loopra-logo.png must exist in frontend/public/');
const logoStats = fs.statSync(logoPath);
assert(logoStats.size > 100000, `loopra-logo.png (${logoStats.size} bytes) must be official high-res logo asset`);
console.log(`✓ TEST 1 PASSED: Official Loopra logo preserved intact (${(logoStats.size / 1024).toFixed(1)} KB).\n`);

// TEST 2: Verify favicon.svg has NO infinity loop or legacy curves
console.log('--- TEST 2: Purge of Infinity Icon in SVG ---');
const svgPath = path.join(publicDir, 'favicon.svg');
assert(fs.existsSync(svgPath), 'favicon.svg must exist');
const svgContent = fs.readFileSync(svgPath, 'utf8');
assert(!svgContent.includes('Infinity / Continuous Play Loop Core'), 'Must NOT contain infinity loop comments');
assert(!svgContent.includes('loopGrad'), 'Must NOT contain infinity loop gradient');
assert(!svgContent.includes('C120 192'), 'Must NOT contain infinity curve bezier path');
assert(svgContent.includes('data:image/png;base64,'), 'favicon.svg must embed approved Loopra branding');
console.log('✓ TEST 2 PASSED: favicon.svg is cleanly synchronized with approved Loopra logo, zero infinity paths.\n');

// TEST 3: All Icon Assets Exist and are Valid
console.log('--- TEST 3: Synchronized Favicons & App Icons ---');
const expectedIcons = [
  'favicon.ico',
  'favicon.png',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'loopra-logo.png'
];
expectedIcons.forEach(iconName => {
  const iconPath = path.join(publicDir, iconName);
  assert(fs.existsSync(iconPath), `${iconName} must exist in frontend/public/`);
  const stats = fs.statSync(iconPath);
  assert(stats.size > 500, `${iconName} must be non-empty (size: ${stats.size} bytes)`);
  console.log(`  - Verified ${iconName}: ${stats.size} bytes`);
});
console.log('✓ TEST 3 PASSED: All 6 required website and app icon variants exist.\n');

// TEST 4: index.html Favicon Declarations
console.log('--- TEST 4: index.html Authoritative Favicon Declarations ---');
const indexHtml = fs.readFileSync(path.join(rootDir, 'frontend', 'index.html'), 'utf8');
assert(indexHtml.includes('rel="icon" type="image/png" href="/loopra-logo.png?v=3"'), 'index.html must declare primary Loopra PNG favicon with cache-buster');
assert(indexHtml.includes('rel="icon" type="image/x-icon" href="/favicon.ico?v=3"'), 'index.html must declare favicon.ico with cache-buster');
assert(indexHtml.includes('rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=3"'), 'index.html must declare apple-touch-icon with cache-buster');
assert(!indexHtml.includes('type="image/svg+xml" href="/favicon.svg"'), 'index.html must NOT prioritize SVG infinity over official branding');
console.log('✓ TEST 4 PASSED: index.html strictly declares approved Loopra logo with versioned cache-busters.\n');

// TEST 5: App.jsx Dynamic Favicon Management
console.log('--- TEST 5: App.jsx React Favicon Synchronization ---');
const appJsx = fs.readFileSync(path.join(rootDir, 'frontend', 'src', 'App.jsx'), 'utf8');
assert(!appJsx.includes("|| '/favicon.svg'"), "App.jsx must NOT default to '/favicon.svg'");
assert(appJsx.includes("|| '/loopra-logo.png'"), "App.jsx must default to '/loopra-logo.png'");
assert(!appJsx.includes("link.type = 'image/svg+xml'"), "App.jsx must NOT force image/svg+xml");
console.log('✓ TEST 5 PASSED: App.jsx dynamically enforces approved Loopra logo without reverting to SVG.\n');

// TEST 6: Web App Manifest
console.log('--- TEST 6: Web App Manifest Icons ---');
const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.json'), 'utf8'));
assert.strictEqual(manifest.name, 'Loopra');
assert.strictEqual(manifest.short_name, 'Loopra');
assert(!JSON.stringify(manifest).includes('/favicon.svg'), 'Manifest must NOT reference favicon.svg');
const iconSrcs = manifest.icons.map(i => i.src);
assert(iconSrcs.some(src => src.startsWith('/loopra-logo.png')), 'Manifest must include /loopra-logo.png');
assert(iconSrcs.some(src => src.startsWith('/icon-192.png')), 'Manifest must include /icon-192.png');
assert(iconSrcs.some(src => src.startsWith('/icon-512.png')), 'Manifest must include /icon-512.png');
console.log('✓ TEST 6 PASSED: manifest.json configured with approved Loopra branding icons.\n');

// TEST 7: Service Worker Cache Invalidation (Bust old loopra-v5-shell)
console.log('--- TEST 7: Service Worker Cache Busting ---');
const swJs = fs.readFileSync(path.join(publicDir, 'sw.js'), 'utf8');
assert(swJs.includes("const CACHE_NAME = 'loopra-v6-shell';"), "sw.js must be bumped to loopra-v6-shell");
assert(swJs.includes("'/loopra-logo.png'"), "sw.js APP_SHELL must cache /loopra-logo.png");
assert(swJs.includes("'/favicon.ico'"), "sw.js APP_SHELL must cache /favicon.ico");
console.log('✓ TEST 7 PASSED: Service Worker bumped to loopra-v6-shell to purge stale browser caches.\n');

console.log('====================================================');
console.log('ALL 7 FAVICON & BRANDING TESTS PASSED SUCCESSFULLY!');
console.log('====================================================\n');

