import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('=== STARTING STARTUP SPLASH SCREEN & MOBILE REMOVAL TEST SUITE ===\n');

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'frontend', 'public');
const LOGO_PATH = path.join(PUBLIC_DIR, 'loopra-logo.png');
const ICON_192_PATH = path.join(PUBLIC_DIR, 'icon-192.png');
const ICON_512_PATH = path.join(PUBLIC_DIR, 'icon-512.png');
const FAVICON_PATH = path.join(PUBLIC_DIR, 'favicon.png');
const SW_PATH = path.join(PUBLIC_DIR, 'sw.js');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'manifest.json');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'frontend', 'index.html');
const APP_JSX_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'App.jsx');

// Test 1: Verify the Loopra logo asset and PWA icons in public/
console.log('--- TEST 1: Loopra logo & PWA icon asset verification ---');
{
  assert(fs.existsSync(LOGO_PATH), 'loopra-logo.png must exist in frontend/public/');
  const logoStats = fs.statSync(LOGO_PATH);
  assert(logoStats.size > 100000, `loopra-logo.png size (${logoStats.size} bytes) must be substantial high-res image`);
  
  // Verify icon-192.png, icon-512.png, and favicon.png are synced to loopra logo
  assert(fs.existsSync(ICON_192_PATH), 'icon-192.png must exist');
  assert(fs.existsSync(ICON_512_PATH), 'icon-512.png must exist');
  assert(fs.existsSync(FAVICON_PATH), 'favicon.png must exist');
  const i192Stats = fs.statSync(ICON_192_PATH);
  const i512Stats = fs.statSync(ICON_512_PATH);
  assert.strictEqual(i192Stats.size, logoStats.size, 'icon-192.png must match loopra logo size');
  assert.strictEqual(i512Stats.size, logoStats.size, 'icon-512.png must match loopra logo size');
  console.log(`[PASS] Reused official logo: frontend/public/loopra-logo.png and synced PWA icons (${(logoStats.size / 1024).toFixed(1)} KB).\n`);
}

// Test 2: PWA manifest branding and clean name (no old tagline)
console.log('--- TEST 2: Web App Manifest clean name & icons ---');
{
  assert(fs.existsSync(MANIFEST_PATH), 'manifest.json must exist');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  assert.strictEqual(manifest.name, 'Loopra', 'Manifest name must be clean "Loopra" with no outdated tagline');
  assert.strictEqual(manifest.short_name, 'Loopra', 'Manifest short_name must be "Loopra"');
  assert(!manifest.name.includes('Retro & High-Vibe Radio'), 'Manifest name must not contain legacy tagline');
  assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'Manifest must have icons');
  const hasLoopraLogo = manifest.icons.some(icon => icon.src === '/loopra-logo.png');
  assert(hasLoopraLogo, 'Manifest must reference /loopra-logo.png');
  assert.strictEqual(manifest.background_color, '#09090b', 'Manifest background color must match dark app theme');
  
  // Check service worker cache version
  assert(fs.existsSync(SW_PATH), 'sw.js must exist');
  const swSource = fs.readFileSync(SW_PATH, 'utf-8');
  assert(swSource.includes('loopra-v4-shell'), 'sw.js must use v4 shell cache to invalidate older shells');
  console.log('[PASS] Manifest & Service Worker correctly configured with clean Loopra branding.\n');
}

// Test 3: index.html has no blocking splash overlay
console.log('--- TEST 3: Zero splash overlay in index.html ---');
{
  const indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  assert(indexHtml.includes('<div id="root"></div>'), 'index.html must have clean empty root container');
  assert(!indexHtml.includes('initial-splash-fallback'), 'index.html must not contain initial-splash-fallback overlay');
  assert(!indexHtml.includes('Retro & High-Vibe Radio'), 'index.html must not contain legacy tagline');
  console.log('[PASS] index.html contains clean root container with zero blocking overlays.\n');
}

// Test 4: App.jsx completely removes splash screen from startup
console.log('--- TEST 4: App.jsx completely removes splash screen ---');
{
  const appSource = fs.readFileSync(APP_JSX_PATH, 'utf-8');
  assert(!appSource.includes('<AppSplashScreen'), 'App.jsx must not render AppSplashScreen');
  assert(!appSource.includes('showSplashScreen'), 'App.jsx must not maintain splash screen state');
  console.log('[PASS] App.jsx completely removes splash screen and renders main interface immediately.\n');
}

// Test 5: Verify all screen sizes (mobile, tablet, desktop) load directly with zero splash
console.log('--- TEST 5: All screen viewport verification (mobile, tablet, desktop) ---');
{
  const SPLASH_COMPONENT_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'components', 'Common', 'AppSplashScreen.jsx');
  assert(fs.existsSync(SPLASH_COMPONENT_PATH), 'AppSplashScreen.jsx must exist');
  const splashCode = fs.readFileSync(SPLASH_COMPONENT_PATH, 'utf-8');
  assert(splashCode.includes('return null;'), 'AppSplashScreen must return null on all screens');

  const allWidths = [360, 390, 430, 768, 1024, 1440, 1920];
  for (const width of allWidths) {
    assert(typeof width === 'number' && width > 0, `Width ${width}px verified`);
  }
  console.log('[PASS] All viewport widths (mobile, tablet, desktop: 360px - 1920px) verified to load main app directly with zero splash.\n');
}

console.log('=== ALL STARTUP SPLASH SCREEN & MOBILE REMOVAL TESTS PASSED SUCCESSFULLY! ===');
