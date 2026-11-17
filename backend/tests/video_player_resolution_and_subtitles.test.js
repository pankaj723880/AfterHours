import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const playerPath = path.resolve(__dirname, '../../frontend/src/components/Player/CinematicVideoPlayer.jsx');
const appPath = path.resolve(__dirname, '../../frontend/src/App.jsx');
const serverPath = path.resolve(__dirname, '../server.js');

const playerCode = fs.readFileSync(playerPath, 'utf8');
const appCode = fs.readFileSync(appPath, 'utf8');
const serverCode = fs.readFileSync(serverPath, 'utf8');

test('VIDEO RESOLUTION (144p DEFAULT & PERSISTENCE) & SUBTITLES VERIFICATION', async (t) => {
  await t.test('1. Default resolution is 144p ("tiny") for newly played videos', () => {
    // Check App.jsx initial/fallback resolution logic
    assert.ok(
      appCode.includes("window.sessionStorage?.getItem('loopra_user_selected_quality')) || 'tiny'"),
      'App.jsx must default to 144p (tiny) when no user session quality is set'
    );

    // Check CinematicVideoPlayer initial quality state
    assert.ok(
      playerCode.includes("window.sessionStorage?.getItem('loopra_user_selected_quality') || 'tiny'"),
      'CinematicVideoPlayer must initialize to 144p (tiny)'
    );

    // Check getQualityLabel maps 'tiny' to '144p'
    assert.ok(
      playerCode.includes("case 'tiny': return '144p'"),
      "getQualityLabel must format 'tiny' as '144p'"
    );
  });

  await t.test('2. Manual resolution selection is applied immediately and persists across sessions', () => {
    assert.ok(
      playerCode.includes("playerRef.current.setPlaybackQuality(targetQ)"),
      'Selecting resolution must call setPlaybackQuality immediately'
    );
    assert.ok(
      playerCode.includes("window.sessionStorage?.setItem('loopra_user_selected_quality', targetQ)"),
      'Manual resolution selection must be persisted to sessionStorage'
    );
    assert.ok(
      appCode.includes("window.sessionStorage?.getItem('loopra_user_selected_quality')"),
      'Next played song in App.jsx must read the user selected quality from sessionStorage'
    );
    assert.ok(
      playerCode.includes('unavailable, switched to'),
      'Unavailable resolutions must be handled gracefully by picking nearest lower quality and notifying user'
    );
  });

  await t.test('3. Dedicated captions/subtitles endpoint in backend server', () => {
    assert.ok(
      serverCode.includes("app.get(['/api/youtube/captions/:videoId', '/api/captions/:videoId']"),
      'Backend must expose /api/youtube/captions/:videoId endpoint'
    );
    assert.ok(
      serverCode.includes("playerCaptionsTracklistRenderer"),
      'Backend must retrieve caption tracks from YouTube player data'
    );
    assert.ok(
      serverCode.includes("pRegex.exec(xml)"),
      'Backend must parse timestamped subtitle lines (start, end, text)'
    );
  });

  await t.test('4. Subtitle controls, language selection, and synchronized display in player', () => {
    assert.ok(
      playerCode.includes("captionsMenuRef"),
      'Player must have a captions/subtitles menu container'
    );
    assert.ok(
      playerCode.includes("Subtitles unavailable"),
      'Player must clearly display Subtitles unavailable when no tracks exist'
    );
    assert.ok(
      playerCode.includes("handleSelectLanguage"),
      'Player must allow user to select specific available subtitle language'
    );
    assert.ok(
      playerCode.includes("t >= line.start && t <= line.end"),
      'Player must synchronize subtitle line based on current playback time'
    );
    assert.ok(
      playerCode.includes("activeSubtitleText"),
      'Player must render active subtitle text overlay over video'
    );
  });

  await t.test('5. Song changes immediately clear stale subtitles', () => {
    assert.ok(
      playerCode.includes("setActiveSubtitleText('')"),
      'Changing song must reset active subtitle text to prevent old subtitles on screen'
    );
    assert.ok(
      playerCode.includes("setSubtitleLines([])"),
      'Changing song must reset subtitle lines array'
    );
  });
});
