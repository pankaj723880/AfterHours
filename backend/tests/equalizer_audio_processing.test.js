import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

describe('Complete Equalizer Feature Removal Verification', () => {
  const modalPath = path.join(rootDir, 'frontend', 'src', 'components', 'Player', 'EqualizerModal.jsx');
  const servicePath = path.join(rootDir, 'frontend', 'src', 'services', 'audioEqualizerService.js');
  const appPath = path.join(rootDir, 'frontend', 'src', 'App.jsx');
  const storagePath = path.join(rootDir, 'frontend', 'src', 'utils', 'storage.js');
  const adminCmsPath = path.join(rootDir, 'backend', 'routes', 'adminCms.js');
  const cmsServicePath = path.join(rootDir, 'backend', 'services', 'cmsService.js');

  it('1. Verifies EqualizerModal.jsx and audioEqualizerService.js are deleted', () => {
    assert.strictEqual(fs.existsSync(modalPath), false, 'EqualizerModal.jsx must be deleted');
    assert.strictEqual(fs.existsSync(servicePath), false, 'audioEqualizerService.js must be deleted');
  });

  it('2. Verifies App.jsx does not import EqualizerModal or audioEqualizerService', () => {
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.strictEqual(/import\s+.*EqualizerModal/i.test(appContent), false, 'App.jsx must not import EqualizerModal');
    assert.strictEqual(/import\s+.*audioEqualizerService/i.test(appContent), false, 'App.jsx must not import audioEqualizerService');
  });

  it('3. Verifies isEqualizerOpen state is completely removed from App.jsx', () => {
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.strictEqual(/isEqualizerOpen/i.test(appContent), false, 'App.jsx must not contain isEqualizerOpen state');
    assert.strictEqual(/setIsEqualizerOpen/i.test(appContent), false, 'App.jsx must not contain setIsEqualizerOpen');
  });

  it('4. Verifies no Equalizer UI buttons or modal tags exist in App.jsx', () => {
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.strictEqual(/<EqualizerModal/i.test(appContent), false, 'EqualizerModal tag must not be rendered');
    assert.strictEqual(/title="10-Band Graphic Equalizer"/i.test(appContent), false, 'No 10-Band Graphic Equalizer title attribute');
    assert.strictEqual(/title="10-Band Equalizer"/i.test(appContent), false, 'No 10-Band Equalizer title attribute');
    assert.strictEqual(/aria-label="Open 10-Band Equalizer"/i.test(appContent), false, 'No Open 10-Band Equalizer aria-label');
    assert.strictEqual(/aria-label="Open Equalizer"/i.test(appContent), false, 'No Open Equalizer aria-label');
    assert.strictEqual(/<span>Equalizer<\/span>/i.test(appContent), false, 'No Equalizer text spans in buttons');
  });

  it('5. Verifies offline audio playback does not call audioEqualizerService', () => {
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.strictEqual(/audioEqualizerService\.attachToAudioElement/.test(appContent), false, 'No attachToAudioElement in App.jsx');
    assert.strictEqual(/audioEqualizerService\.resume/.test(appContent), false, 'No audioEqualizerService.resume in App.jsx');
  });

  it('6. Verifies storage.js does not contain EQUALIZER key and purges legacy settings', () => {
    const storageContent = fs.readFileSync(storagePath, 'utf8');
    assert.strictEqual(/EQUALIZER:\s*'afterhours_equalizer_settings'/.test(storageContent), false, 'EQUALIZER key must be removed from STORAGE_KEYS');
    assert.ok(storageContent.includes('afterhours_equalizer_settings'), 'storage.js must include legacy cleanup for afterhours_equalizer_settings');
  });

  it('7. Verifies backend CMS default navigation and reserved routes omit equalizer', () => {
    const adminCmsContent = fs.readFileSync(adminCmsPath, 'utf8');
    const cmsServiceContent = fs.readFileSync(cmsServicePath, 'utf8');

    assert.strictEqual(/'equalizer'/.test(adminCmsContent), false, 'adminCms.js must not reference equalizer');
    assert.strictEqual(/'equalizer'/.test(cmsServiceContent), false, 'cmsService.js must not reference equalizer');
  });

  it('8. Verifies core music player features are preserved intact in App.jsx', () => {
    const appContent = fs.readFileSync(appPath, 'utf8');

    // Play/Pause, volume, queue, shuffle, repeat, favorites, radio, canvas, lyrics, sleep timer
    assert.ok(appContent.includes('togglePlayPause'), 'togglePlayPause must exist');
    assert.ok(appContent.includes('handleVolumeChange'), 'handleVolumeChange must exist');
    assert.ok(appContent.includes('showQueuePanel') || appContent.includes('queue'), 'Queue must exist');
    assert.ok(appContent.includes('isShuffle'), 'Shuffle must exist');
    assert.ok(appContent.includes('isRepeat'), 'Repeat must exist');
    assert.ok(appContent.includes('toggleLike'), 'Favorites must exist');
    assert.ok(appContent.includes('isLyricsOpen'), 'LyricsModal must exist');
    assert.ok(appContent.includes('isSleepTimerOpen'), 'SleepTimerModal must exist');
    assert.ok(appContent.includes('isCanvasOpen'), 'LoopraCanvas must exist');
    assert.ok(appContent.includes('offlineAudioRef'), 'Offline audio must exist');
  });
});
