import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

describe('Mobile Bottom Navigation Bar Verification', () => {
  const bottomNavPath = path.join(rootDir, 'frontend', 'src', 'components', 'Navigation', 'MobileBottomNav.jsx');
  const appPath = path.join(rootDir, 'frontend', 'src', 'App.jsx');

  it('MobileBottomNav.jsx exists and contains exactly 5 ordered navigation destinations', () => {
    assert.ok(fs.existsSync(bottomNavPath), 'MobileBottomNav.jsx file should exist');
    const content = fs.readFileSync(bottomNavPath, 'utf8');

    // Verify imports from lucide-react
    assert.match(content, /import\s+\{.*Home.*Compass.*Heart.*ListMusic.*UserRound.*\}\s+from\s+['"]lucide-react['"]/s,
      'Should import required icons (Home, Compass, Heart, ListMusic, UserRound) from lucide-react');

    // Check exact order of IDs
    const homeIndex = content.indexOf("id: 'home'");
    const discoverIndex = content.indexOf("id: 'discover'");
    const likedIndex = content.indexOf("id: 'liked'");
    const playlistsIndex = content.indexOf("id: 'playlists'");
    const profileIndex = content.indexOf("id: 'profile'");

    assert.ok(homeIndex !== -1, 'Must have Home item');
    assert.ok(discoverIndex !== -1, 'Must have Discover item');
    assert.ok(likedIndex !== -1, 'Must have Liked item');
    assert.ok(playlistsIndex !== -1, 'Must have Playlists item');
    assert.ok(profileIndex !== -1, 'Must have Profile item');

    assert.ok(homeIndex < discoverIndex, 'Home must precede Discover');
    assert.ok(discoverIndex < likedIndex, 'Discover must precede Liked');
    assert.ok(likedIndex < playlistsIndex, 'Liked must precede Playlists');
    assert.ok(playlistsIndex < profileIndex, 'Playlists must precede Profile');
  });

  it('MobileBottomNav has responsive mobile-only classes and safe-area support', () => {
    const content = fs.readFileSync(bottomNavPath, 'utf8');
    assert.match(content, /md:hidden/, 'Bottom nav must be hidden on desktop viewports (md:hidden)');
    assert.match(content, /fixed bottom-0/, 'Bottom nav must be fixed to the bottom');
    assert.match(content, /env\(safe-area-inset-bottom/, 'Bottom nav must support iPhone safe-area insets');
    assert.match(content, /text-amber-400/, 'Active items must have gold/yellow accent');
    assert.match(content, /text-neutral-400/, 'Inactive items must use muted colors');
    assert.match(content, /stopPropagation/, 'Clicks must stop propagation to prevent triggering parent handlers');
    assert.match(content, /aria-label="Mobile Navigation"/, 'Must have accessible navigation aria-label');
  });

  it('App.jsx mounts MobileBottomNav and elevates mini-player layout on mobile', () => {
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.match(appContent, /import MobileBottomNav from '\.\/components\/Navigation\/MobileBottomNav'/,
      'App.jsx must import MobileBottomNav');
    assert.match(appContent, /<MobileBottomNav/, 'App.jsx must render MobileBottomNav');

    // Mini-player elevated above bottom nav on mobile, docked on desktop
    assert.match(appContent, /bottom-\[calc\(3\.75rem\+max\(0\.5rem,env\(safe-area-inset-bottom\)\)\)\]/,
      'Mini-player must be elevated above bottom nav on mobile');
    assert.match(appContent, /md:bottom-0/, 'Mini-player must dock to bottom on desktop');

    // Main scroll container has mobile padding to prevent obscuring content
    assert.match(appContent, /isBottomPlayerVisible \? 'pb-44 md:pb-28' : 'pb-24 md:pb-8'/,
      'Main container must have mobile-aware bottom padding');
  });

  it('Mobile sidebar / drawer preserves all secondary destinations', () => {
    const appContent = fs.readFileSync(appPath, 'utf8');

    // Secondary AI & Discovery destinations
    assert.match(appContent, /handleStationSelect\('mood'\)/, 'Mood-to-Music AI must be preserved');
    assert.match(appContent, /handleStationSelect\('timemachine'\)/, 'Time Machine Radio must be preserved');
    assert.match(appContent, /handleStationSelect\('activity'\)/, 'Listening Activity must be preserved');
    assert.match(appContent, /handleStationSelect\('swipe'\)/, 'Discover Swipe must be preserved');

    // Secondary Nostalgia Stations
    assert.match(appContent, /handleStationSelect\('barber'\)/, 'Saloon FM must be preserved');
    assert.match(appContent, /handleStationSelect\('truck'\)/, 'Horn Ok Please must be preserved');
    assert.match(appContent, /handleStationSelect\('pauwa'\)/, 'Theka Session must be preserved');

    // Secondary Collection & System
    assert.match(appContent, /handleStationSelect\('history'\)/, 'History must be preserved');
    assert.match(appContent, /setIsStatsOpen\(true\)/, 'Recap & Stats must be preserved');
    assert.match(appContent, /handleStationSelect\('admin'\)/, 'Admin Dashboard must be preserved');
  });
});

