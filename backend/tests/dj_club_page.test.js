import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

test('Loopra DJ Club - Files and Assets exist', () => {
  const djClubPagePath = path.join(ROOT, 'frontend/src/components/DjClub/DjClubPage.jsx');
  const djLightingCanvasPath = path.join(ROOT, 'frontend/src/components/DjClub/DjLightingCanvas.jsx');
  const djWaveformVisualizerPath = path.join(ROOT, 'frontend/src/components/DjClub/DjWaveformVisualizer.jsx');

  assert.ok(fs.existsSync(djClubPagePath), 'DjClubPage.jsx must exist');
  assert.ok(fs.existsSync(djLightingCanvasPath), 'DjLightingCanvas.jsx must exist');
  assert.ok(fs.existsSync(djWaveformVisualizerPath), 'DjWaveformVisualizer.jsx must exist');

  // Verify preset thumbnails and background assets exist in public
  const publicDir = path.join(ROOT, 'frontend/public');
  const stageCleanPath = path.join(publicDir, 'loopra-dj-stage-clean.jpg');
  const stageRefPath = path.join(publicDir, 'loopra-dj-club-bg.jpg');
  const presetsDir = path.join(publicDir, 'presets');

  assert.ok(fs.existsSync(stageCleanPath), 'loopra-dj-stage-clean.jpg must exist');
  assert.ok(fs.existsSync(stageRefPath), 'loopra-dj-club-bg.jpg must exist');
  assert.ok(fs.existsSync(presetsDir), 'presets directory must exist');

  const expectedPresets = [
    'club-pulse.jpg',
    'neon-wave.jpg',
    'strobe-rush.jpg',
    'laser-show.jpg',
    'party-glow.jpg',
    'ultra-rave.jpg',
    'loopra-dj-art.jpg'
  ];

  for (const presetFile of expectedPresets) {
    assert.ok(
      fs.existsSync(path.join(presetsDir, presetFile)),
      `Preset asset ${presetFile} must exist in frontend/public/presets`
    );
  }
});

test('Loopra DJ Club - 6 Visual Presets and Auto Mode defined in DjClubPage', () => {
  const code = fs.readFileSync(path.join(ROOT, 'frontend/src/components/DjClub/DjClubPage.jsx'), 'utf-8');

  // Must include all 6 presets
  assert.ok(code.includes('club-pulse'), 'Must contain club-pulse preset');
  assert.ok(code.includes('neon-wave'), 'Must contain neon-wave preset');
  assert.ok(code.includes('strobe-rush'), 'Must contain strobe-rush preset');
  assert.ok(code.includes('laser-show'), 'Must contain laser-show preset');
  assert.ok(code.includes('party-glow'), 'Must contain party-glow preset');
  assert.ok(code.includes('ultra-rave'), 'Must contain ultra-rave preset');

  // Must include Auto Mode by default
  assert.ok(code.includes('isAutoMode, setIsAutoMode] = useState(true)'), 'Auto mode must be enabled by default');

  // Must include Change Light Show button
  assert.ok(code.includes('Change Light Show'), 'Must have Change Light Show button');

  // Must include reference layout items
  assert.ok(code.includes('Loopra DJ Mix'), 'Must have Loopra DJ Mix title');
  assert.ok(code.includes('Club • EDM • Party'), 'Must have Club • EDM • Party subtitle');
  assert.ok(code.includes('DjLightingCanvas'), 'Must render DjLightingCanvas');
  assert.ok(code.includes('DjWaveformVisualizer'), 'Must render DjWaveformVisualizer');
});

test('Loopra DJ Club - Lighting Canvas contains beat-reactive effects', () => {
  const code = fs.readFileSync(path.join(ROOT, 'frontend/src/components/DjClub/DjLightingCanvas.jsx'), 'utf-8');

  // Check volumetric spotlights
  assert.ok(code.includes('VOLUMETRIC SPOTLIGHT BEAMS') || code.includes('spotlights'), 'Must calculate spotlights');

  // Check laser beams
  assert.ok(code.includes('LASER BEAMS') || code.includes('lasers'), 'Must generate moving lasers');

  // Check strobe flashes
  assert.ok(code.includes('strobeFlash') || code.includes('STROBE FLASH'), 'Must render strobe flashes');

  // Check disco ball sparkles
  assert.ok(code.includes('sparkles') || code.includes('DISCO BALL'), 'Must render disco ball reflections');
});

test('Loopra DJ Club - Navigation Manager supports /dj-club route', async () => {
  const navManager = await import('../../frontend/src/utils/navigationManager.js');

  // Test buildPath
  assert.equal(navManager.buildPath('dj-club'), '/dj-club', 'buildPath("dj-club") must return "/dj-club"');
  assert.equal(navManager.buildPath('djclub'), '/dj-club', 'buildPath("djclub") must return "/dj-club"');

  // Test parseRoute
  const parsed1 = navManager.parseRoute('/dj-club');
  assert.equal(parsed1.tab, 'dj-club', 'parseRoute("/dj-club") must resolve to tab "dj-club"');

  const parsed2 = navManager.parseRoute('/djclub');
  assert.equal(parsed2.tab, 'dj-club', 'parseRoute("/djclub") must resolve to tab "dj-club"');

  const parsed3 = navManager.parseRoute('/dj');
  assert.equal(parsed3.tab, 'dj-club', 'parseRoute("/dj") must resolve to tab "dj-club"');
});

test('Loopra DJ Club - SEO Metadata configured', async () => {
  const seo = await import('../../frontend/src/utils/seo.js');

  assert.ok(seo.ROUTE_SEO_DATA['dj-club'], 'SEO metadata for dj-club must be defined');
  assert.ok(seo.ROUTE_SEO_DATA['dj-club'].title.includes('DJ Club'), 'SEO title must include DJ Club');
});

test('Loopra DJ Club - App.jsx integrates full-screen DJ Club view', () => {
  const code = fs.readFileSync(path.join(ROOT, 'frontend/src/App.jsx'), 'utf-8');

  // Lazy import
  assert.ok(code.includes("import('./components/DjClub/DjClubPage')"), 'DjClubPage must be lazy loaded');

  // Render check
  assert.ok(code.includes("activeTab === 'dj-club'"), 'Must handle activeTab === "dj-club"');
  assert.ok(code.includes('<DjClubPage'), 'Must render <DjClubPage component');

  // Verification of solitary player
  assert.ok(
    code.includes("activeTab !== 'dj-club'") && code.includes('isBottomPlayerVisible'),
    'Global mini player must be suppressed when activeTab === "dj-club"'
  );
});

