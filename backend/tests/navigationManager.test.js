import assert from 'node:assert/strict';
import {
  parseRoute,
  buildPath,
  areEntriesEqual,
  initNavigation,
  pushNavigation,
  popNavigation,
  syncPopState,
  canGoBack
} from '../../frontend/src/utils/navigationManager.js';

console.log('🧪 Starting Loopra Navigation Manager Tests...\n');

// 1. Parsing and Path Building
console.log('Test 1: Route parsing & path generation');
const homeRoute = parseRoute('/', '');
assert.equal(homeRoute.tab, 'home');
assert.equal(homeRoute.path, '/');

const discoverRoute = parseRoute('/discover', '?q=Arijit%20Singh');
assert.equal(discoverRoute.tab, 'discover');
assert.equal(discoverRoute.params.q, 'Arijit Singh');
assert.equal(discoverRoute.path, '/discover?q=Arijit%20Singh');

const radioRoute = parseRoute('/radio', '');
assert.equal(radioRoute.tab, 'radio');
assert.equal(radioRoute.path, '/radio');

const barberRoute = parseRoute('/barber', '');
assert.equal(barberRoute.tab, 'barber');
assert.equal(barberRoute.path, '/barber');

const playlistRoute = parseRoute('/playlists', '?id=pl_123');
assert.equal(playlistRoute.tab, 'playlists');
assert.equal(playlistRoute.params.id, 'pl_123');
assert.equal(playlistRoute.path, '/playlists?id=pl_123');

console.log('✅ Test 1 Passed: Routes parsed accurately\n');

// 2. Direct Deep Link Initialization (Requirement 2 & 9D)
console.log('Test 2: Directly open deep link -> Home must be seeded as root');
// Simulated fresh session on deep link:
const deepInit = initNavigation('/discover', '?q=Arijit%20Singh');
assert.equal(deepInit.stack.length, 2);
assert.equal(deepInit.stack[0].tab, 'home');
assert.equal(deepInit.stack[1].tab, 'discover');
assert.equal(deepInit.stack[1].params.q, 'Arijit Singh');

const popDeep = popNavigation(deepInit.stack);
assert.equal(popDeep.target.tab, 'home');
assert.equal(popDeep.isRoot, true);
assert.equal(popDeep.stack.length, 1);

// Popping again at root Home must remain safely at Home
const popRoot = popNavigation(popDeep.stack);
assert.equal(popRoot.target.tab, 'home');
assert.equal(popRoot.isRoot, true);
assert.equal(popRoot.stack.length, 1);
console.log('✅ Test 2 Passed: Direct deep links safely root at Home\n');

// 3. Example Sequence A (Requirement 9A): Home -> Discover -> Artist -> Album -> Back -> Back -> Back = Home
console.log('Test 3: Sequence A (Home -> Discover -> Artist -> Album -> Back -> Back -> Back = Home)');
let stack = [{ tab: 'home', path: '/', params: {} }];

// Home -> Discover
let res = pushNavigation(stack, { tab: 'discover', path: '/discover' });
stack = res.stack;
assert.equal(stack.length, 2);

// Discover -> Artist (Discover?q=Arijit Singh)
res = pushNavigation(stack, { tab: 'discover', path: '/discover?q=Arijit%20Singh', params: { q: 'Arijit Singh' } });
stack = res.stack;
assert.equal(stack.length, 3);

// Artist -> Album (Discover?q=Aashiqui 2)
res = pushNavigation(stack, { tab: 'discover', path: '/discover?q=Aashiqui%202', params: { q: 'Aashiqui 2' } });
stack = res.stack;
assert.equal(stack.length, 4);

// Back 1: Returns to Artist
let back = popNavigation(stack);
assert.equal(back.target.params.q, 'Arijit Singh');
stack = back.stack;
assert.equal(stack.length, 3);

// Back 2: Returns to Discover
back = popNavigation(stack);
assert.equal(back.target.tab, 'discover');
assert.equal(back.target.path, '/discover');
stack = back.stack;
assert.equal(stack.length, 2);

// Back 3: Returns to Home
back = popNavigation(stack);
assert.equal(back.target.tab, 'home');
assert.equal(back.target.path, '/');
assert.equal(back.isRoot, true);
stack = back.stack;
assert.equal(stack.length, 1);

console.log('✅ Test 3 Passed: Sequence A completed perfectly to Home\n');

// 4. Example Sequence B (Requirement 9B): Home -> Radio -> Nostalgia Stations -> Station Details
console.log('Test 4: Sequence B (Home -> Radio -> Nostalgia Stations -> Station Details -> Back to Home)');
stack = [{ tab: 'home', path: '/', params: {} }];

// Home -> Radio
res = pushNavigation(stack, { tab: 'radio', path: '/radio' });
stack = res.stack;
assert.equal(stack.length, 2);

// Radio -> Nostalgia Stations (barber)
res = pushNavigation(stack, { tab: 'barber', path: '/barber' });
stack = res.stack;
assert.equal(stack.length, 3);

// Back 1: Barber -> Radio
back = popNavigation(stack);
assert.equal(back.target.tab, 'radio');
stack = back.stack;
assert.equal(stack.length, 2);

// Back 2: Radio -> Home
back = popNavigation(stack);
assert.equal(back.target.tab, 'home');
assert.equal(back.isRoot, true);
stack = back.stack;
assert.equal(stack.length, 1);

console.log('✅ Test 4 Passed: Sequence B completed perfectly to Home\n');

// 5. Example Sequence C (Requirement 9C): Home -> Playlist -> Song Details -> Back -> Back = Home
console.log('Test 5: Sequence C (Home -> Playlist -> Playlist Details -> Back -> Back = Home)');
stack = [{ tab: 'home', path: '/', params: {} }];

// Home -> Playlists
res = pushNavigation(stack, { tab: 'playlists', path: '/playlists' });
stack = res.stack;
assert.equal(stack.length, 2);

// Playlists -> Playlist Details
res = pushNavigation(stack, { tab: 'playlists', path: '/playlists?id=pl_retro', params: { id: 'pl_retro' } });
stack = res.stack;
assert.equal(stack.length, 3);

// Back 1: Playlist Details -> Playlists
back = popNavigation(stack);
assert.equal(back.target.tab, 'playlists');
assert.equal(back.target.path, '/playlists');
stack = back.stack;
assert.equal(stack.length, 2);

// Back 2: Playlists -> Home
back = popNavigation(stack);
assert.equal(back.target.tab, 'home');
assert.equal(back.isRoot, true);
stack = back.stack;
assert.equal(stack.length, 1);

console.log('✅ Test 5 Passed: Sequence C completed perfectly to Home\n');

// 6. Deduplication and Rapid Navigation (Requirement 4 & 9F)
console.log('Test 6: Deduplication on rapid consecutive clicks');
stack = [{ tab: 'home', path: '/', params: {} }];
res = pushNavigation(stack, { tab: 'discover', path: '/discover' });
stack = res.stack;

// Rapidly click Discover 4 more times:
res = pushNavigation(stack, { tab: 'discover', path: '/discover' });
res = pushNavigation(res.stack, { tab: 'discover', path: '/discover' });
res = pushNavigation(res.stack, { tab: 'discover', path: '/discover' });
res = pushNavigation(res.stack, { tab: 'discover', path: '/discover' });
stack = res.stack;

// Stack must NOT contain duplicates:
assert.equal(stack.length, 2);
console.log('✅ Test 6 Passed: Deduplication successfully prevented duplicated stack entries\n');

// 7. PopState Browser Back/Forward Synchronization (Requirement 9G)
console.log('Test 7: Popstate sync with browser history');
stack = [
  { tab: 'home', path: '/', params: {} },
  { tab: 'discover', path: '/discover', params: {} },
  { tab: 'radio', path: '/radio', params: {} }
];

// Browser Back to Discover:
const popSync = syncPopState(stack, '/discover', '');
assert.equal(popSync.target.tab, 'discover');
assert.equal(popSync.stack.length, 2);

console.log('✅ Test 7 Passed: Browser popstate synced correctly\n');

// 8. canGoBack Helper
console.log('Test 8: canGoBack accurately reflects state');
assert.equal(canGoBack([{ tab: 'home' }], 'home', {}), false);
assert.equal(canGoBack([{ tab: 'home' }, { tab: 'radio' }], 'radio', {}), true);
assert.equal(canGoBack([{ tab: 'home' }], 'home', { showAllTrending: true }), true);
assert.equal(canGoBack([{ tab: 'home' }], 'home', { selectedPlaylistForView: { id: '1' } }), true);
assert.equal(canGoBack([{ tab: 'home' }], 'home', { offlineSubView: 'explore' }), true);
console.log('✅ Test 8 Passed: canGoBack conditions verified\n');

console.log('🎉 ALL Loopra Navigation Manager Tests Passed Successfully!');
