import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNavigationList, cmsService, getDefaultSiteConfig } from '../services/cmsService.js';
import { normalizeNavigationList as clientNormalizeNav } from '../../frontend/src/services/cmsClient.js';

test('Sidebar Visibility - normalizeNavigationList preserves disabled/hidden state', () => {
  const currentNav = getDefaultSiteConfig().navigation.map(item => {
    if (item.id === 'activity') {
      return { ...item, enabled: false };
    }
    return item;
  });

  const backendNormalized = normalizeNavigationList(currentNav);
  const activityBackend = backendNormalized.find(i => i.id === 'activity');
  assert.ok(activityBackend, 'Activity item must exist in normalized navigation array');
  assert.strictEqual(activityBackend.enabled, false, 'Activity item must have enabled: false preserved in backend');

  const clientNormalized = clientNormalizeNav(backendNormalized);
  const activityClient = clientNormalized.find(i => i.id === 'activity');
  assert.ok(activityClient, 'Activity item must exist in client normalized navigation array');
  assert.strictEqual(activityClient.enabled, false, 'Activity item must have enabled: false preserved in client');
});

test('Sidebar Visibility - App.jsx sidebar rendering logic strictly filters out hidden items', () => {
  const defaultNav = [
    { id: 'home', label: 'Home', icon: 'home', group: 'main' },
    { id: 'discover', label: 'Discover & Search', icon: 'discover', group: 'main' },
    { id: 'radio', label: 'Indian Live Radio', icon: 'radio', badge: 'Live', group: 'main' },
    { id: 'mood', label: 'Mood-to-Music AI', icon: 'sparkles', badge: 'AI', group: 'discovery' },
    { id: 'timemachine', label: 'Time Machine Radio', icon: 'radio', badge: 'Retro', group: 'discovery' },
    { id: 'activity', label: 'Listening Activity', icon: 'flame', group: 'discovery' },
    { id: 'swipe', label: 'Discover Swipe', icon: 'swipe', group: 'discovery' },
    { id: 'barber', label: 'Saloon FM', icon: 'scissors', badge: '90s', group: 'stations' },
    { id: 'truck', label: 'Horn Ok Please', icon: 'truck', badge: 'Dhaba', group: 'stations' },
    { id: 'pauwa', label: 'Theka Session', icon: 'beer', badge: 'Desi', group: 'stations' },
    { id: 'library', label: 'Liked Songs Collection', icon: 'library', group: 'collection' },
    { id: 'history', label: 'Listening History', icon: 'history', group: 'collection' },
    { id: 'playlists', label: 'Playlists', icon: 'list', group: 'collection' },
    { id: 'stats', label: 'Recap & Stats', icon: 'sparkles', group: 'collection' }
  ];

  const canonicalGroup = (id, rawGroup) => {
    if (['home', 'discover', 'radio'].includes(id)) return 'main';
    if (['mood', 'timemachine', 'activity', 'swipe'].includes(id)) return 'discovery';
    if (['barber', 'truck', 'pauwa'].includes(id)) return 'stations';
    if (['library', 'history', 'playlists', 'stats'].includes(id)) return 'collection';
    return rawGroup || 'main';
  };

  // Helper simulating App.jsx sidebar rendering algorithm
  const computeVisibleItems = (cmsConfigNav) => {
    const disabledIds = new Set();
    const configuredItems = Array.isArray(cmsConfigNav) ? cmsConfigNav : [];
    configuredItems.forEach(item => {
      if (item && item.id && item.enabled === false) {
        disabledIds.add(item.id);
      }
    });

    const navMap = new Map();
    if (configuredItems.length > 0) {
      configuredItems.forEach(item => {
        if (!item || !item.id || item.id === 'profile' || item.id === 'equalizer') return;
        if (item.enabled === false || disabledIds.has(item.id)) return;
        const group = canonicalGroup(item.id, item.group);
        navMap.set(item.id, { ...item, group });
      });

      defaultNav.forEach(def => {
        if (disabledIds.has(def.id)) return;
        if (configuredItems.some(c => c && c.id === def.id)) return;
        navMap.set(def.id, { ...def });
      });
    } else {
      defaultNav.forEach(def => {
        if (!disabledIds.has(def.id)) {
          navMap.set(def.id, { ...def });
        }
      });
    }

    return Array.from(navMap.values()).filter(item => item && item.enabled !== false && !disabledIds.has(item.id));
  };

  // 1. When activity is disabled:
  const navWithDisabledActivity = defaultNav.map(item => ({
    ...item,
    enabled: item.id !== 'activity'
  }));

  const visibleWhenHidden = computeVisibleItems(navWithDisabledActivity);
  assert.strictEqual(visibleWhenHidden.some(i => i.id === 'activity'), false, 'Listening Activity MUST NOT be present in visible sidebar items');
  assert.strictEqual(visibleWhenHidden.some(i => i.id === 'home'), true, 'Home must remain visible');
  assert.strictEqual(visibleWhenHidden.some(i => i.id === 'discover'), true, 'Discover must remain visible');
  assert.strictEqual(visibleWhenHidden.some(i => i.id === 'timemachine'), true, 'Time Machine must remain visible');

  // 2. When activity is re-enabled:
  const navWithEnabledActivity = defaultNav.map(item => ({
    ...item,
    enabled: true
  }));

  const visibleWhenActive = computeVisibleItems(navWithEnabledActivity);
  assert.strictEqual(visibleWhenActive.some(i => i.id === 'activity'), true, 'Listening Activity MUST reappear when enabled: true');

  // 3. When multiple items (activity + swipe + truck) are disabled:
  const navMultiDisabled = defaultNav.map(item => ({
    ...item,
    enabled: !['activity', 'swipe', 'truck'].includes(item.id)
  }));

  const visibleMulti = computeVisibleItems(navMultiDisabled);
  assert.strictEqual(visibleMulti.some(i => i.id === 'activity'), false, 'Activity must be hidden');
  assert.strictEqual(visibleMulti.some(i => i.id === 'swipe'), false, 'Swipe must be hidden');
  assert.strictEqual(visibleMulti.some(i => i.id === 'truck'), false, 'Truck station must be hidden');
  assert.strictEqual(visibleMulti.some(i => i.id === 'barber'), true, 'Barber station must remain visible');
  assert.strictEqual(visibleMulti.some(i => i.id === 'mood'), true, 'Mood must remain visible');
});

