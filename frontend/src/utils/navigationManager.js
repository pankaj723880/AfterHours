/**
 * Loopra Centralized Navigation Manager
 * 
 * Provides authoritative in-app history tracking, intelligent back navigation,
 * loop prevention, deep-link safe initialization with Home as ultimate root,
 * and duplicate entry elimination.
 */

const STORAGE_KEY = 'loopra_nav_stack';
const MAX_STACK_SIZE = 40;

/**
 * Builds canonical URL path for a given tab and parameters
 */
export function buildPath(tab, params = {}) {
  if (tab === 'home' || !tab) {
    if (params?.showAll) {
      return `/?view=${encodeURIComponent(params.showAll)}`;
    }
    return '/';
  }
  if (tab === 'discover') {
    if (params?.q) {
      return `/discover?q=${encodeURIComponent(params.q)}`;
    }
    return '/discover';
  }
  if (tab === 'artist') {
    const artistId = params?.id || params?.slug || encodeURIComponent(params?.name || '');
    return `/artist/${artistId}`;
  }
  if (tab === 'playlists') {
    if (params?.id) {
      return `/playlists?id=${encodeURIComponent(params.id)}`;
    }
    return '/playlists';
  }
  if (tab === 'downloads') {
    if (params?.subView === 'explore' || params?.offlineSubView === 'explore') {
      return '/downloads/explore';
    }
    return '/downloads';
  }
  if (tab === 'admin') return '/admin';
  if (tab === 'download' || tab === 'download-app' || tab === 'apk') return '/download';
  if (tab === 'dj-club' || tab === 'djclub' || tab === 'dj') return '/dj-club';
  if (tab === 'radio' || tab === 'indian-radio') return '/radio';
  if (['barber', 'truck', 'pauwa', 'timemachine', 'mood', 'library', 'history', 'activity', 'swipe', 'for-you', 'dj-club'].includes(tab)) {
    return `/${tab}`;
  }
  return `/${tab}`;
}

/**
 * Parses browser pathname and query string into a structured NavRoute
 */
export function parseRoute(pathname = '/', search = '') {
  const cleanPath = (pathname || '/').toLowerCase();
  const searchParams = new URLSearchParams(search || '');
  const q = (searchParams.get('q') || '').trim();
  const id = (searchParams.get('id') || '').trim();
  const view = (searchParams.get('view') || '').trim();

  if (cleanPath === '/admin') {
    return { tab: 'admin', path: '/admin', params: {} };
  }
  if (cleanPath === '/download' || cleanPath === '/download-app' || cleanPath === '/apk') {
    return { tab: 'download', path: '/download', params: {} };
  }
  if (cleanPath === '/dj-club' || cleanPath === '/djclub' || cleanPath === '/dj') {
    return { tab: 'dj-club', path: '/dj-club', params: {} };
  }
  if (cleanPath === '/discover' || q) {
    const p = q ? `/discover?q=${encodeURIComponent(q)}` : '/discover';
    return { tab: 'discover', path: p, params: q ? { q } : {} };
  }
  if (cleanPath === '/downloads/explore' || cleanPath === '/downloads-explore') {
    return { tab: 'downloads', path: '/downloads/explore', params: { subView: 'explore' } };
  }
  if (cleanPath === '/downloads') {
    return { tab: 'downloads', path: '/downloads', params: { subView: 'library' } };
  }
  if (cleanPath === '/playlists') {
    const p = id ? `/playlists?id=${encodeURIComponent(id)}` : '/playlists';
    return { tab: 'playlists', path: p, params: id ? { id } : {} };
  }
  if (cleanPath === '/for-you' || cleanPath === '/recommendations') {
    return { tab: 'for-you', path: '/for-you', params: {} };
  }
  if (cleanPath === '/indian-radio' || cleanPath === '/radio') {
    return { tab: 'radio', path: '/radio', params: {} };
  }
  if (cleanPath.startsWith('/artist/')) {
    const rawArtistId = pathname.replace(/^\/artist\//i, '').split('/')[0].split('?')[0];
    const decoded = decodeURIComponent(rawArtistId);
    return { tab: 'artist', path: `/artist/${rawArtistId}`, params: { id: decoded, slug: decoded } };
  }
  if (cleanPath.startsWith('/station/')) {
    const stationId = cleanPath.replace('/station/', '');
    return { tab: stationId, path: `/${stationId}`, params: {} };
  }
  if (cleanPath === '/saloon') {
    return { tab: 'barber', path: '/saloon', params: {} };
  }
  if (cleanPath === '/theka') {
    return { tab: 'pauwa', path: '/theka', params: {} };
  }
  if (cleanPath === '/truck') {
    return { tab: 'truck', path: '/truck', params: {} };
  }
  const knownTabs = ['barber', 'truck', 'pauwa', 'saloon', 'theka', 'mood', 'timemachine', 'activity', 'library', 'history', 'swipe', 'dj-club'];
  const stripped = cleanPath.replace(/^\//, '');
  if (knownTabs.includes(stripped)) {
    return { tab: stripped, path: `/${stripped}`, params: {} };
  }
  // Default to home
  const homePath = view ? `/?view=${encodeURIComponent(view)}` : '/';
  return { tab: 'home', path: homePath, params: view ? { showAll: view } : {} };
}

/**
 * Checks whether two navigation route entries represent the same exact view
 */
export function areEntriesEqual(a, b) {
  if (!a || !b) return false;
  if (a.tab !== b.tab) return false;
  if (a.path !== b.path) return false;
  const aQ = a.params?.q || '';
  const bQ = b.params?.q || '';
  if (aQ !== bQ) return false;
  const aId = a.params?.id || '';
  const bId = b.params?.id || '';
  if (aId !== bId) return false;
  const aSub = a.params?.subView || '';
  const bSub = b.params?.subView || '';
  if (aSub !== bSub) return false;
  const aShow = a.params?.showAll || '';
  const bShow = b.params?.showAll || '';
  if (aShow !== bShow) return false;
  return true;
}

/**
 * Load navigation stack from sessionStorage
 */
export function loadStoredStack() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter(item => item && typeof item.tab === 'string');
    }
  } catch (e) {
    console.warn('[NavigationManager] Failed to load stored navigation stack:', e);
  }
  return null;
}

/**
 * Save navigation stack to sessionStorage
 */
export function saveStoredStack(stack) {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = Array.isArray(stack) ? stack.slice(-MAX_STACK_SIZE) : [];
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[NavigationManager] Failed to persist navigation stack:', e);
  }
}

/**
 * Initializes navigation history on application startup.
 * If user lands directly on a deep link, safely roots history with Home.
 */
export function initNavigation(pathname = '/', search = '') {
  const currentRoute = parseRoute(pathname, search);
  const stored = loadStoredStack();

  // If stored stack exists and its top entry matches current URL, reuse it
  if (stored && stored.length > 0) {
    const top = stored[stored.length - 1];
    if (areEntriesEqual(top, currentRoute)) {
      return { currentRoute, stack: stored };
    }
  }

  // If current route is home: stack is cleanly rooted at Home
  if (currentRoute.tab === 'home' && !currentRoute.params?.showAll) {
    const initialStack = [currentRoute];
    saveStoredStack(initialStack);
    return { currentRoute, stack: initialStack };
  }

  // Deep link or refresh: seed Home as root so Back safely returns to Home
  const homeEntry = { tab: 'home', path: '/', params: {} };
  const initialStack = [homeEntry, currentRoute];
  saveStoredStack(initialStack);

  if (typeof window !== 'undefined' && window.history) {
    try {
      if (!window.history.state || window.history.state.loopraInit !== true) {
        window.history.replaceState({ ...homeEntry, loopraNavIdx: 0, loopraInit: true }, '', '/');
        window.history.pushState({ ...currentRoute, loopraNavIdx: 1, loopraInit: true }, '', currentRoute.path);
      }
    } catch (e) {
      // Ignore if pushState is restricted
    }
  }

  return { currentRoute, stack: initialStack };
}

/**
 * Pushes a new destination to the navigation stack with deduplication
 */
export function pushNavigation(currentStack = [], target) {
  const entry = typeof target === 'string'
    ? parseRoute(target.startsWith('/') ? target : `/${target}`, '')
    : {
        tab: target.tab,
        path: target.path || buildPath(target.tab, target.params),
        params: target.params || {}
      };

  const stack = Array.isArray(currentStack) ? [...currentStack] : [];

  // If navigating directly to the Home root, Home is the final destination:
  // Reset stack cleanly to [Home root] to prevent history buildup or loops
  if (entry.tab === 'home' && !entry.params?.showAll) {
    const rootHome = { tab: 'home', path: '/', params: {} };
    saveStoredStack([rootHome]);
    return { entry: rootHome, stack: [rootHome] };
  }

  // Deduplication: if exact same entry as current top, return existing stack without duplicate
  if (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (areEntriesEqual(top, entry)) {
      return { entry: top, stack };
    }
  }

  // Ensure root is home if stack is empty
  if (stack.length === 0 && entry.tab !== 'home') {
    stack.push({ tab: 'home', path: '/', params: {} });
  }

  stack.push(entry);
  const trimmed = stack.slice(-MAX_STACK_SIZE);
  saveStoredStack(trimmed);

  return { entry, stack: trimmed };
}

/**
 * Pops the current route from the stack and returns the previous destination.
 * Never leaves Loopra; falls back to Home as root.
 */
export function popNavigation(currentStack = []) {
  const stack = Array.isArray(currentStack) ? [...currentStack] : [];

  if (stack.length <= 1) {
    // Already at root or empty: safely return Home
    const rootHome = { tab: 'home', path: '/', params: {} };
    saveStoredStack([rootHome]);
    return { target: rootHome, stack: [rootHome], isRoot: true };
  }

  // Pop current route
  stack.pop();
  const target = stack[stack.length - 1] || { tab: 'home', path: '/', params: {} };
  saveStoredStack(stack);

  return {
    target,
    stack,
    isRoot: stack.length <= 1 && target.tab === 'home' && !target.params?.showAll
  };
}

/**
 * Synchronizes navigation stack with native browser popstate (Back/Forward)
 */
export function syncPopState(currentStack = [], pathname = '/', search = '') {
  const destination = parseRoute(pathname, search);
  const stack = Array.isArray(currentStack) ? [...currentStack] : [];

  // If destination is Home root, reset stack strictly to [Home root]
  if (destination.tab === 'home' && !destination.params?.showAll) {
    const rootHome = { tab: 'home', path: '/', params: {} };
    saveStoredStack([rootHome]);
    return { target: rootHome, stack: [rootHome] };
  }

  // Look for destination in the stack from top down
  let foundIndex = -1;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (areEntriesEqual(stack[i], destination)) {
      foundIndex = i;
      break;
    }
  }

  if (foundIndex !== -1) {
    // Trim stack back to the matched entry
    const newStack = stack.slice(0, foundIndex + 1);
    saveStoredStack(newStack);
    return { target: destination, stack: newStack };
  }

  // If not found in stack (e.g. forward navigation or external URL jump)
  return pushNavigation(stack, destination);
}

/**
 * Determines whether current route represents the root Home page.
 * Returns true ONLY when on Home with NO expanded "See all" sub-views.
 */
export function isHomePage(activeTab = 'home', extraState = {}) {
  if (activeTab !== 'home') return false;
  if (
    extraState.showAllTrending ||
    extraState.showAllArtists ||
    extraState.showAllAlbums ||
    extraState.showAllRadio ||
    extraState.selectedPlaylistForView ||
    extraState.offlineSubView === 'explore'
  ) {
    return false;
  }
  return true;
}

/**
 * Authoritative Back Button visibility checker:
 * - Completely hides the Back button on the Home page (`/`).
 * - Displays the Back button on every non-Home page where back navigation is applicable.
 * - Displays the Back button on expanded "See all" sub-views on Home to return to Home root.
 */
export function canGoBack(stack = [], activeTab = 'home', extraState = {}) {
  // 1. Home page root view: absolutely hide the Back button (Home is final destination)
  if (isHomePage(activeTab, extraState)) {
    return false;
  }

  // 2. All other pages & sub-views: Back button is visible
  return true;
}

