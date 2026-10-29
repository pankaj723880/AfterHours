import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

describe('Loopra Canvas Player Controls & Progress Verification', () => {
  const canvasPath = path.join(rootDir, 'frontend', 'src', 'components', 'Player', 'LoopraCanvas.jsx');
  const appPath = path.join(rootDir, 'frontend', 'src', 'App.jsx');

  const canvasContent = fs.readFileSync(canvasPath, 'utf8');
  const appContent = fs.readFileSync(appPath, 'utf8');

  it('1. Verifies App.jsx passes playerRef, onSeek, and navigation handlers to LoopraCanvas', () => {
    assert.ok(appContent.includes('<LoopraCanvas'), 'App.jsx must mount LoopraCanvas');
    assert.ok(appContent.includes('playerRef={playerRef}'), 'App.jsx must pass playerRef to LoopraCanvas');
    assert.ok(appContent.includes('onSeek={handleSeek}'), 'App.jsx must pass onSeek to LoopraCanvas');
    assert.ok(appContent.includes('onNext={handleNextSong}') || appContent.includes('onNextTrack={handleNextSong}'), 'App.jsx must pass next handler');
    assert.ok(appContent.includes('onPrev={handlePrevSong}') || appContent.includes('onPrevTrack={handlePrevSong}'), 'App.jsx must pass prev handler');
  });

  it('2. Verifies LoopraCanvas accepts playerRef, onSeek, and normalizes previous/next handlers', () => {
    assert.ok(canvasContent.includes('playerRef'), 'LoopraCanvas must accept playerRef prop');
    assert.ok(canvasContent.includes('onSeek'), 'LoopraCanvas must accept onSeek prop');
    assert.ok(canvasContent.includes('handleNext'), 'LoopraCanvas must have handleNext');
    assert.ok(canvasContent.includes('handlePrev'), 'LoopraCanvas must have handlePrev');
    assert.ok(canvasContent.includes('onClick={handlePrev}'), 'Prev button must trigger handlePrev');
    assert.ok(canvasContent.includes('onClick={handleNext}'), 'Next button must trigger handleNext');
  });

  it('3. Verifies previous button 3-second restart logic in App.jsx', () => {
    assert.ok(appContent.includes('if (currentPos > 3)'), 'App.jsx must check if currentPos > 3');
    assert.ok(appContent.includes('seekTo(0, true)'), 'Must seek to 0 if position > 3 seconds');
  });

  it('4. Verifies empty-queue fallback handling for Next and Previous', () => {
    // Both handleNextSong and handlePrevSong should fallback to trending or available tracks
    assert.ok(appContent.includes('effectiveQueue'), 'App.jsx must calculate effectiveQueue with fallbacks');
    assert.ok(appContent.includes('trendingSongs') && appContent.includes('TRENDING_SONGS'), 'Must fallback to trending tracks when queue is empty');
  });

  it('5. Verifies LoopraCanvas scrubber is interactive and does NOT hardcode 3:00 duration', () => {
    assert.strictEqual(canvasContent.includes('useState(180)'), false, 'Must NOT hardcode 180s (3:00) duration');
    assert.ok(canvasContent.includes('input') && canvasContent.includes('type="range"'), 'Must have an interactive range input scrubber');
    assert.ok(canvasContent.includes('handleSeekChange'), 'Must handle seek change');
    assert.ok(canvasContent.includes('handleSeekCommit'), 'Must commit seek changes');
    assert.ok(canvasContent.includes('seekTo'), 'Must trigger player seekTo');
  });

  it('6. Verifies Live Radio is handled with continuous broadcast badge without fake duration', () => {
    assert.ok(canvasContent.includes('isRadio'), 'LoopraCanvas must check isRadio');
    assert.ok(canvasContent.includes('LIVE BROADCAST'), 'Must show LIVE BROADCAST for radio');
    assert.ok(canvasContent.includes('--:--'), 'Must display --:-- when duration is unavailable instead of fake time');
  });

  it('7. Verifies honest YouTube iframe audio sandboxing disclaimer is maintained', () => {
    assert.ok(canvasContent.includes('sandboxed'), 'Must include truthful sandboxing notice');
  });

  it('8. Verifies no Equalizer UI or service was reintroduced', () => {
    assert.strictEqual(/EqualizerModal/i.test(appContent), false, 'No EqualizerModal in App.jsx');
    assert.strictEqual(/audioEqualizerService/i.test(appContent), false, 'No audioEqualizerService in App.jsx');
    assert.strictEqual(/isEqualizerOpen/i.test(appContent), false, 'No isEqualizerOpen in App.jsx');
  });
});

