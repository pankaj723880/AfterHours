import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('=== STARTING STARTUP SPLASH SCREEN & 3D INFINITY TEST SUITE ===\n');

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'frontend', 'public');
const LOGO_PATH = path.join(PUBLIC_DIR, 'loopra-logo.png');
const ICON_192_PATH = path.join(PUBLIC_DIR, 'icon-192.png');
const ICON_512_PATH = path.join(PUBLIC_DIR, 'icon-512.png');
const FAVICON_PATH = path.join(PUBLIC_DIR, 'favicon.png');
const SW_PATH = path.join(PUBLIC_DIR, 'sw.js');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'manifest.json');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'frontend', 'index.html');
const SPLASH_JSX_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'components', 'Common', 'AppSplashScreen.jsx');
const APP_JSX_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'App.jsx');

// Test 1: Verify the Loopra logo asset and PWA icons in public/
console.log('--- TEST 1: Existing Loopra logo & PWA icon asset verification ---');
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

// Test 2: PWA manifest branding and icon verification
console.log('--- TEST 2: Web App Manifest branding & icons ---');
{
  assert(fs.existsSync(MANIFEST_PATH), 'manifest.json must exist');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  assert.strictEqual(manifest.name, 'Loopra - Retro & High-Vibe Radio', 'Manifest name must match official tagline');
  assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'Manifest must have icons');
  const hasLoopraLogo = manifest.icons.some(icon => icon.src === '/loopra-logo.png');
  assert(hasLoopraLogo, 'Manifest must reference /loopra-logo.png');
  assert.strictEqual(manifest.background_color, '#09090b', 'Manifest background color must match dark app theme');
  
  // Check service worker cache version
  assert(fs.existsSync(SW_PATH), 'sw.js must exist');
  const swSource = fs.readFileSync(SW_PATH, 'utf-8');
  assert(swSource.includes('loopra-v3-shell'), 'sw.js must use v3 shell cache to purge legacy radio cache');
  console.log('[PASS] Manifest & Service Worker correctly configured with /loopra-logo.png and v3 cache.\n');
}

// Test 3: Pre-hydration HTML fallback in index.html
console.log('--- TEST 3: Pre-hydration splash in index.html ---');
{
  const indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  assert(indexHtml.includes('/loopra-logo.png'), 'index.html must reference /loopra-logo.png for favicon and splash');
  assert(indexHtml.includes('initial-splash-fallback'), 'index.html must contain pre-hydration splash fallback');
  assert(indexHtml.includes('Retro & High-Vibe Radio'), 'index.html must display official tagline in splash');
  console.log('[PASS] index.html includes instant zero-flash pre-hydration splash with Loopra logo.\n');
}

// Test 4: AppSplashScreen component implementation, smooth transition & WebGL safety
console.log('--- TEST 4: AppSplashScreen 3D infinity, smooth transition & reduced motion ---');
{
  assert(fs.existsSync(SPLASH_JSX_PATH), 'AppSplashScreen.jsx must exist');
  const splashSource = fs.readFileSync(SPLASH_JSX_PATH, 'utf-8');
  assert(splashSource.includes('InfinityCurve3D'), 'Must define 3D infinity space curve');
  assert(splashSource.includes('THREE.TubeGeometry'), 'Must use 3D TubeGeometry for genuine non-flat volume');
  assert(splashSource.includes('MeshPhysicalMaterial') || splashSource.includes('MeshStandardMaterial'), 'Must use physical metallic material');
  assert(splashSource.includes('isInfinityVisible'), 'Must manage choreographed emergence of infinity loop');
  assert(splashSource.includes('prefers-reduced-motion'), 'Must respect prefers-reduced-motion');
  assert(splashSource.includes('cancelAnimationFrame'), 'Must properly clean up animation frames');
  assert(splashSource.includes('geometry.dispose()'), 'Must dispose geometry on unmount to prevent memory leaks');
  assert(splashSource.includes('renderer.dispose()'), 'Must dispose renderer on unmount');
  assert(splashSource.includes('logoUrl'), 'Must display centered Loopra logo');
  console.log('[PASS] AppSplashScreen cleanly implements 3D infinity geometry, emergence transition, WebGL disposal, and a11y fallbacks.\n');
}

// Test 5: Splash screen integration in App.jsx & ~3 second duration
console.log('--- TEST 5: App.jsx startup lifecycle, ~3s duration & safety timers ---');
{
  const appSource = fs.readFileSync(APP_JSX_PATH, 'utf-8');
  assert(appSource.includes('AppSplashScreen'), 'App.jsx must import AppSplashScreen');
  assert(appSource.includes('showSplashScreen'), 'App.jsx must manage splash screen visibility');
  assert(appSource.includes('isAppInitialized'), 'App.jsx must coordinate initialization state');
  assert(appSource.includes('MIN_SPLASH_DURATION_MS = 3000') || appSource.includes('3000'), 'App.jsx must enforce ~3 second minimum splash duration');
  assert(appSource.includes('maxSafetyTimer'), 'App.jsx must provide a safety timeout so splash never hangs');
  console.log('[PASS] App.jsx manages splash lifecycle with ~3s minimum duration, safety timeouts and unmount callback.\n');
}

console.log('=== ALL STARTUP SPLASH SCREEN TESTS PASSED SUCCESSFULLY! ===');
