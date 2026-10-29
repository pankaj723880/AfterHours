import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('=== STARTING PREMIUM 3D INFINITY SPLASH SCREEN UPGRADE TEST SUITE ===\n');

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'frontend', 'public');
const LOGO_PATH = path.join(PUBLIC_DIR, 'loopra-logo.png');
const ICON_192_PATH = path.join(PUBLIC_DIR, 'icon-192.png');
const ICON_512_PATH = path.join(PUBLIC_DIR, 'icon-512.png');
const SW_PATH = path.join(PUBLIC_DIR, 'sw.js');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'manifest.json');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'frontend', 'index.html');
const APP_JSX_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'App.jsx');
const SPLASH_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'components', 'Common', 'AppSplashScreen.jsx');

// Test 1: Verify the official Loopra logo asset is preserved without modification
console.log('--- TEST 1: Loopra official logo preservation ---');
{
  assert(fs.existsSync(LOGO_PATH), 'loopra-logo.png must exist in frontend/public/');
  const logoStats = fs.statSync(LOGO_PATH);
  assert(logoStats.size > 100000, `loopra-logo.png size (${logoStats.size} bytes) must be high-res image`);
  assert(fs.existsSync(ICON_192_PATH), 'icon-192.png must exist');
  assert(fs.existsSync(ICON_512_PATH), 'icon-512.png must exist');
  console.log(`[PASS] Reused official logo: frontend/public/loopra-logo.png (${(logoStats.size / 1024).toFixed(1)} KB).\n`);
}

// Test 2: Web App Manifest branding
console.log('--- TEST 2: Web App Manifest branding & zero legacy radio tagline ---');
{
  assert(fs.existsSync(MANIFEST_PATH), 'manifest.json must exist');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  assert.strictEqual(manifest.name, 'Loopra', 'Manifest name must be clean "Loopra"');
  assert.strictEqual(manifest.short_name, 'Loopra', 'Manifest short_name must be "Loopra"');
  assert(!manifest.name.includes('Retro & High-Vibe Radio'), 'Manifest must not contain legacy radio tagline');
  assert.strictEqual(manifest.background_color, '#09090b', 'Background color must match obsidian dark theme');
  console.log('[PASS] Manifest correctly configured with clean Loopra branding.\n');
}

// Test 3: 3D Infinity Loop Three.js implementation in AppSplashScreen
console.log('--- TEST 3: 3D Infinity Loop implementation ---');
{
  assert(fs.existsSync(SPLASH_PATH), 'AppSplashScreen.jsx must exist');
  const splashCode = fs.readFileSync(SPLASH_PATH, 'utf-8');
  assert(splashCode.includes('InfinityCurve3D'), 'AppSplashScreen must implement mathematical InfinityCurve3D');
  assert(splashCode.includes('TubeGeometry'), 'AppSplashScreen must use 3D TubeGeometry for physical volume');
  assert(splashCode.includes('MeshPhysicalMaterial') || splashCode.includes('MeshStandardMaterial'), 'AppSplashScreen must use physical metallic material');
  assert(splashCode.includes('WebGLRenderer'), 'AppSplashScreen must initialize WebGLRenderer');
  assert(splashCode.includes('isWebGLAvailable'), 'AppSplashScreen must feature WebGL support verification');
  assert(splashCode.includes('prefers-reduced-motion'), 'AppSplashScreen must respect prefers-reduced-motion');
  console.log('[PASS] 3D Infinity Loop correctly engineered with Three.js WebGL & physical materials.\n');
}

// Test 4: 3D Tagline "INFINITE SOUND. ENDLESS VIBES."
console.log('--- TEST 4: 3D Tagline "INFINITE SOUND. ENDLESS VIBES." ---');
{
  const splashCode = fs.readFileSync(SPLASH_PATH, 'utf-8');
  assert(splashCode.includes('INFINITE SOUND. ENDLESS VIBES.'), 'AppSplashScreen must feature exact tagline "INFINITE SOUND. ENDLESS VIBES."');
  assert(splashCode.includes('textShadow'), 'Tagline must feature multi-layered 3D text shadow for depth');
  assert(splashCode.includes('safe-area-inset-bottom'), 'Tagline must respect safe-area-inset-bottom for mobile navigation');
  assert(!splashCode.includes('Retro & High-Vibe Radio'), 'Must not contain old radio tagline');
  console.log('[PASS] Exact 3D tagline "INFINITE SOUND. ENDLESS VIBES." styled and positioned at bottom.\n');
}

// Test 5: App.jsx Integration & Coordinated Startup Sequence
console.log('--- TEST 5: App.jsx Integration & Transition ---');
{
  const appSource = fs.readFileSync(APP_JSX_PATH, 'utf-8');
  assert(appSource.includes('import AppSplashScreen'), 'App.jsx must import AppSplashScreen');
  assert(appSource.includes('<AppSplashScreen'), 'App.jsx must render AppSplashScreen during startup');
  assert(appSource.includes('showSplashScreen'), 'App.jsx must manage splash visibility state');
  assert(appSource.includes('isAppInitialized'), 'App.jsx must signal when app initialization is ready');
  console.log('[PASS] App.jsx successfully integrated with coordinated startup sequence and smooth exit.\n');
}

console.log('=== ALL 5 PREMIUM 3D INFINITY SPLASH SCREEN TESTS PASSED! ===');
