import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNavigationList, STANDARD_NAVIGATION } from '../services/cmsService.js';

test('Sidebar Categories Restoration - Standard Navigation Requirements', () => {
  const nav = normalizeNavigationList(STANDARD_NAVIGATION);

  // 1. Verify item count and absence of profile
  assert.equal(nav.some(item => item.id === 'profile'), false, 'My Profile must not be in sidebar navigation');
  assert.equal(nav.some(item => item.id === 'equalizer'), false, 'Equalizer must not be in sidebar navigation');

  // 2. Primary Navigation (main group)
  const mainItems = nav.filter(item => item.group === 'main');
  const mainIds = mainItems.map(i => i.id);
  assert.deepEqual(mainIds, ['home', 'discover'], 'Primary navigation should only contain Home and Discover & Search');
  assert.equal(mainItems.some(i => ['barber', 'truck', 'pauwa'].includes(i.id)), false, 'Stations must not be in Primary navigation');

  // 3. AI & DISCOVERY (discovery group)
  const discoveryItems = nav.filter(item => item.group === 'discovery');
  const discoveryIds = discoveryItems.map(i => i.id);
  assert.deepEqual(discoveryIds, ['mood', 'timemachine', 'activity', 'swipe'], 'AI & DISCOVERY must contain all 4 items');
  
  const mood = discoveryItems.find(i => i.id === 'mood');
  assert.equal(mood.label, 'Mood-to-Music AI');
  const timemachine = discoveryItems.find(i => i.id === 'timemachine');
  assert.equal(timemachine.label, 'Time Machine Radio');
  const activity = discoveryItems.find(i => i.id === 'activity');
  assert.equal(activity.label, 'Listening Activity');
  const swipe = discoveryItems.find(i => i.id === 'swipe');
  assert.equal(swipe.label, 'Discover Swipe');

  // 4. NOSTALGIA STATIONS (stations group)
  const stationItems = nav.filter(item => item.group === 'stations');
  const stationIds = stationItems.map(i => i.id);
  assert.deepEqual(stationIds, ['barber', 'truck', 'pauwa'], 'NOSTALGIA STATIONS must contain Saloon FM, Horn Ok Please, Theka Session');

  // 5. YOUR COLLECTION (collection group)
  const collectionItems = nav.filter(item => item.group === 'collection');
  const collectionIds = collectionItems.map(i => i.id);
  assert.deepEqual(collectionIds, ['library', 'history', 'playlists', 'stats'], 'YOUR COLLECTION must contain all 4 items');
  
  const library = collectionItems.find(i => i.id === 'library');
  assert.equal(library.label, 'Liked Songs Collection');
  const history = collectionItems.find(i => i.id === 'history');
  assert.equal(history.label, 'Listening History');
  const stats = collectionItems.find(i => i.id === 'stats');
  assert.equal(stats.label, 'Recap & Stats');
});

test('Sidebar Categories Restoration - Normalizes Legacy Configurations', () => {
  // Scenario: Legacy DB record with no group, old labels, and profile present
  const legacyNav = [
    { id: 'home', label: 'Home' },
    { id: 'discover', label: 'Discover & Search' },
    { id: 'barber', label: 'Saloon FM' },
    { id: 'truck', label: 'Horn Ok Please' },
    { id: 'pauwa', label: 'Theka Session' },
    { id: 'library', label: 'Liked Songs' },
    { id: 'history', label: 'History' },
    { id: 'playlists', label: 'Playlists' },
    { id: 'profile', label: 'My Profile' }
  ];

  const normalized = normalizeNavigationList(legacyNav);

  // Profile must be purged
  assert.equal(normalized.some(i => i.id === 'profile'), false, 'Profile must be purged from legacy configs');

  // Missing categories must be restored
  assert.equal(normalized.some(i => i.id === 'mood'), true, 'Mood AI must be restored');
  assert.equal(normalized.some(i => i.id === 'timemachine'), true, 'Time Machine Radio must be restored');
  assert.equal(normalized.some(i => i.id === 'activity'), true, 'Listening Activity must be restored');
  assert.equal(normalized.some(i => i.id === 'swipe'), true, 'Discover Swipe must be restored');
  assert.equal(normalized.some(i => i.id === 'stats'), true, 'Recap & Stats must be restored');

  // Stations must be mapped to 'stations', not 'main'
  const stations = normalized.filter(i => ['barber', 'truck', 'pauwa'].includes(i.id));
  stations.forEach(st => {
    assert.equal(st.group, 'stations', `Station ${st.id} must be in group 'stations'`);
  });

  // Old labels updated
  const library = normalized.find(i => i.id === 'library');
  assert.equal(library.label, 'Liked Songs Collection');
  const history = normalized.find(i => i.id === 'history');
  assert.equal(history.label, 'Listening History');
});

