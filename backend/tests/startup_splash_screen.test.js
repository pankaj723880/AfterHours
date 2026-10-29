import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('=== STARTING STARTUP SPLASH SCREEN & 3D INFINITY TEST SUITE ===\n');

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'frontend', 'public');
const LOGO_PATH = path.join(PUBLIC_DIR, 'loopra-logo.png');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'manifest.json');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'frontend', 'index.html');
const SPLASH_JSX_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'components', 'Common', 'AppSplashScreen.jsx');
const APP_JSX_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'App.jsx');

// Test 1: Verify the Loopra logo asset in public/
console.log('--- TEST 1: Existing Loopra logo asset verification ---');
{
  assert(fs.existsSync(LOGO_PATH), 'loopra-logo.png must exist in frontend/public/');
  const stats = fs.statSync(LOGO_PATH);
  assert(stats.size > 100000, `loopra-logo.png size (${stats.size} bytes) must be substantial high-res image`);
  console.log(`[PASS] Reused official logo: frontend/public/loopra-logo.png (${(stats.size / 1024).toFixed(1)} KB).\n`);
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
  console.log('[PASS] Manifest correctly configured with /loopra-logo.png and official tagline.\n');
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

// Test 4: AppSplashScreen component implementation & WebGL safety
console.log('--- TEST 4: AppSplashScreen 3D infinity & reduced motion ---');
{
  assert(fs.existsSync(SPLASH_JSX_PATH), 'AppSplashScreen.jsx must exist');
  const splashSource = fs.readFileSync(SPLASH_JSX_PATH, 'utf-8');
  assert(splashSource.includes('InfinityCurve3D'), 'Must define 3D infinity space curve');
  assert(splashSource.includes('THREE.TubeGeometry'), 'Must use 3D TubeGeometry for genuine non-flat volume');
  assert(splashSource.includes('MeshPhysicalMaterial') || splashSource.includes('MeshStandardMaterial'), 'Must use physical metallic material');
  assert(splashSource.includes('prefers-reduced-motion'), 'Must respect prefers-reduced-motion');
  assert(splashSource.includes('cancelAnimationFrame'), 'Must properly clean up animation frames');
  assert(splashSource.includes('geometry.dispose()'), 'Must dispose geometry on unmount to prevent memory leaks');
  assert(splashSource.includes('renderer.dispose()'), 'Must dispose renderer on unmount');
  assert(splashSource.includes('logoUrl'), 'Must display centered Loopra logo');
  console.log('[PASS] AppSplashScreen cleanly implements 3D infinity geometry, WebGL disposal, and a11y fallbacks.\n');
}

// Test 5: Splash screen integration in App.jsx
console.log('--- TEST 5: App.jsx startup lifecycle & safety timers ---');
{
  const appSource = fs.readFileSync(APP_JSX_PATH, 'utf-8');
  assert(appSource.includes('AppSplashScreen'), 'App.jsx must import AppSplashScreen');
  assert(appSource.includes('showSplashScreen'), 'App.jsx must manage splash screen visibility');
  assert(appSource.includes('isAppInitialized'), 'App.jsx must coordinate initialization state');
  assert(appSource.includes('maxSafetyTimer'), 'App.jsx must provide a safety timeout so splash never hangs');
  console.log('[PASS] App.jsx manages splash lifecycle with safety timeouts and unmount callback.\n');
}

console.log('=== ALL STARTUP SPLASH SCREEN TESTS PASSED SUCCESSFULLY! ===');

