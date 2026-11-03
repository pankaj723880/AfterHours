import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('LOOPRA VIDEO PLAYER SINGLE ENGINE & ORIGINAL THEME VERIFICATION', () => {
  const playerFilePath = path.join(projectRoot, 'frontend/src/components/Player/CinematicVideoPlayer.jsx');
  const appFilePath = path.join(projectRoot, 'frontend/src/App.jsx');

  const playerCode = fs.readFileSync(playerFilePath, 'utf8');
  const appCode = fs.readFileSync(appFilePath, 'utf8');

  it('1. Single persistent player engine without duplicate returns or unmounting', () => {
    // There must NOT be early returns unmounting the ytContainerRef
    const earlyReturnPattern = /if\s*\(!videoModalSong\)\s*\{\s*return/g;
    assert.strictEqual(
      earlyReturnPattern.test(playerCode),
      false,
      'CinematicVideoPlayer must NOT unmount via early return when videoModalSong is false'
    );

    // ytContainerRef and #yt-player-instance must exist exactly once in CinematicVideoPlayer
    const ytContainerMatches = playerCode.match(/ref=\{ytContainerRef\}/g) || [];
    assert.strictEqual(
      ytContainerMatches.length,
      1,
      `Expected exactly 1 ref={ytContainerRef} in CinematicVideoPlayer, found ${ytContainerMatches.length}`
    );

    const ytPlayerInstanceMatches = playerCode.match(/id="yt-player-instance"/g) || [];
    assert.strictEqual(
      ytPlayerInstanceMatches.length,
      1,
      `Expected exactly 1 id="yt-player-instance" in CinematicVideoPlayer, found ${ytPlayerInstanceMatches.length}`
    );
  });

  it('2. Seamless Switch to Music Mode and zero background playback leaks', () => {
    // Container must collapse to hidden/invisible when !videoModalSong while maintaining iframe in DOM
    assert.ok(
      playerCode.includes('fixed top-0 left-0 w-1 h-1 opacity-0 pointer-events-none -z-50 overflow-hidden'),
      'Must contain hidden background class for audio-only music mode'
    );

    // Switch to Music Mode button must exist with correct title and action
    assert.ok(
      playerCode.includes('Switch to Music Mode'),
      'Must include Switch to Music Mode button'
    );
    assert.ok(
      playerCode.includes('(Audio continues)'),
      'Must inform user that audio continues playing'
    );
  });

  it('3. Clean removal of Video Quality and Playback Speed features', () => {
    // Quality options must NOT be present in CinematicVideoPlayer
    assert.strictEqual(playerCode.includes('hd1080'), false, 'Must NOT contain hd1080 quality option');
    assert.strictEqual(playerCode.includes('hd720'), false, 'Must NOT contain hd720 quality option');
    assert.strictEqual(playerCode.includes('1080p Full HD'), false, 'Must NOT contain 1080p Full HD string');
    assert.strictEqual(playerCode.includes('720p HD'), false, 'Must NOT contain 720p HD string');
    assert.strictEqual(playerCode.includes('getAvailableQualityLevels'), false, 'Must NOT call getAvailableQualityLevels');
    assert.strictEqual(playerCode.includes('setPlaybackQuality'), false, 'Must NOT force setPlaybackQuality');

    // Playback speed options must NOT be present in CinematicVideoPlayer
    assert.strictEqual(playerCode.includes('SPEED_OPTIONS'), false, 'Must NOT contain SPEED_OPTIONS');
    assert.strictEqual(playerCode.includes('handleSpeedSelect'), false, 'Must NOT contain handleSpeedSelect');

    // No quality badges or dropdown settings
    assert.strictEqual(playerCode.includes('Auto (Adaptive)'), false, 'Must NOT contain Auto (Adaptive) badge');
    assert.strictEqual(playerCode.includes('<Settings'), false, 'Must NOT render Settings dropdown');
  });

  it('4. Elimination of duplicate native controls and removal of Add to Playlist from player header', () => {
    // Assert App.jsx embeds configure playerVars without native YouTube controls
    assert.ok(appCode.includes('controls: 0'), 'playerVars must set controls: 0 to hide duplicate native seekbar/play controls');
    assert.ok(appCode.includes('rel: 0'), 'playerVars must set rel: 0 to eliminate related video clutter');
    assert.ok(appCode.includes('iv_load_policy: 3'), 'playerVars must set iv_load_policy: 3 to suppress annotations');
    assert.ok(appCode.includes('disablekb: 1'), 'playerVars must set disablekb: 1 to prevent native keyboard conflict');

    // Add to Playlist button must be absent from CinematicVideoPlayer header
    assert.strictEqual(playerCode.includes('<ListPlus'), false, 'Add to Playlist icon must be removed from player');
    assert.strictEqual(playerCode.includes('title="Add to Playlist"'), false, 'Add to Playlist button must be removed from player');

    // Favourite and Share must be preserved
    assert.ok(playerCode.includes('Heart'), 'Must preserve Heart favourite icon');
    assert.ok(playerCode.includes('Share2'), 'Must preserve Share2 icon');
  });

  it('5. Restoration of Loopra original color theme (black, charcoal, gold/amber, emerald)', () => {
    // Must NOT contain unwanted purple/pink gradients or magenta glows
    assert.strictEqual(
      playerCode.includes('from-pink-600/15 via-purple-600/15'),
      false,
      'Must NOT contain purple-pink ambient glow'
    );
    assert.strictEqual(
      playerCode.includes('shadow-purple-950'),
      false,
      'Must NOT contain purple shadow outlines'
    );
    assert.strictEqual(
      playerCode.includes('bg-pink-500'),
      false,
      'Must NOT contain pink background accents'
    );

    // Must use Loopra original gold/amber theme
    assert.ok(playerCode.includes('amber-500'), 'Must use amber-500 gold accents');
    assert.ok(playerCode.includes('amber-400'), 'Must use amber-400 gold accents');
    assert.ok(playerCode.includes('text-emerald-400'), 'Must use emerald green for verified checkmark');
    assert.ok(playerCode.includes('bg-neutral-900'), 'Must use dark charcoal surfaces');
    assert.ok(playerCode.includes('bg-neutral-950'), 'Must use deep black backgrounds');
  });

  it('6. Complete feature preservation in Cinematic layout', () => {
    // Play/Pause, Rewind, FastForward, Volume, Mute, Speed, Captions, Theater, Fullscreen
    assert.ok(playerCode.includes('onTogglePlayPause'), 'Must preserve onTogglePlayPause');
    assert.ok(playerCode.includes('onSeekRelative'), 'Must preserve onSeekRelative');
    assert.ok(playerCode.includes('onVolumeChange'), 'Must preserve onVolumeChange');
    assert.ok(playerCode.includes('onToggleMute'), 'Must preserve onToggleMute');
    assert.ok(playerCode.includes('isTheaterMode'), 'Must preserve isTheaterMode');
    assert.ok(playerCode.includes('toggleFullscreen'), 'Must preserve toggleFullscreen');
    assert.ok(playerCode.includes('toggleCaptions'), 'Must preserve toggleCaptions');
    assert.ok(playerCode.includes('onToggleLike'), 'Must preserve onToggleLike');
    assert.ok(playerCode.includes('onAddToPlaylist'), 'Must preserve onAddToPlaylist');
    assert.ok(playerCode.includes('onShare'), 'Must preserve onShare');
  });

  it('7. Verification of App.jsx integration without duplicate video modals', () => {
    // Only one CinematicVideoPlayer mount in App.jsx
    const playerMounts = appCode.match(/<CinematicVideoPlayer/g) || [];
    assert.strictEqual(
      playerMounts.length,
      1,
      `Expected exactly 1 CinematicVideoPlayer mount in App.jsx, found ${playerMounts.length}`
    );

    // ytContainerRef passed to CinematicVideoPlayer
    assert.ok(
      appCode.includes('ytContainerRef={ytContainerRef}'),
      'App.jsx must pass ytContainerRef to CinematicVideoPlayer'
    );
  });
});

