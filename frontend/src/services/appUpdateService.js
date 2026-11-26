import { BACKEND_URL } from '../utils/apiUrl.js';

const MANIFEST_CACHE_KEY = 'loopra_app_version_manifest';
const DISMISSED_UPDATE_SESSION_KEY = 'loopra_dismissed_update_version';
export const UPDATE_SNOOZE_TIMESTAMP_KEY = 'updateSnoozeUntil';
export const UPDATE_SNOOZE_VERSION_KEY = 'snoozedUpdateVersion';
export const DEFAULT_UPDATE_SNOOZE_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours (configurable between 2-3 hours)

/**
 * Checks whether the update prompt is currently snoozed for the given target version code.
 * Snooze is active only if:
 * 1. Current time is before `updateSnoozeUntil`
 * 2. AND the available version is NOT strictly newer than the version that was snoozed (`snoozedUpdateVersion`).
 */
export function isUpdateSnoozed(targetVersionCode = 0) {
  if (typeof window === 'undefined') return false;
  try {
    const rawSnoozeUntil = localStorage.getItem(UPDATE_SNOOZE_TIMESTAMP_KEY);
    const rawSnoozedVersion = localStorage.getItem(UPDATE_SNOOZE_VERSION_KEY);

    if (!rawSnoozeUntil) return false;

    const snoozeUntil = Number(rawSnoozeUntil) || 0;
    const now = Date.now();

    // If cooldown expired, clear stale keys and allow prompt
    if (now >= snoozeUntil) {
      clearUpdateSnooze();
      return false;
    }

    const snoozedCode = Number(rawSnoozedVersion) || 0;
    const currentTargetCode = Number(targetVersionCode) || 0;

    // If a newer version than snoozedUpdateVersion has been released, break snooze immediately!
    if (currentTargetCode > 0 && snoozedCode > 0 && currentTargetCode > snoozedCode) {
      clearUpdateSnooze();
      return false;
    }

    // Within snooze cooldown for the same or older version code
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Stores snooze timestamp & target version when user taps "Not Now".
 * Sets updateSnoozeUntil to Date.now() + durationMs (default 3 hours)
 * and snoozedUpdateVersion to latestVersionCode.
 * Also synchronizes with native Android SharedPreferences via LoopraAndroid bridge if present.
 */
export function snoozeUpdate(latestVersionCode = 0, durationMs = DEFAULT_UPDATE_SNOOZE_DURATION_MS) {
  if (typeof window === 'undefined') return;
  try {
    const validDuration = (typeof durationMs === 'number' && durationMs >= 2 * 60 * 60 * 1000 && durationMs <= 3 * 60 * 60 * 1000)
      ? durationMs
      : DEFAULT_UPDATE_SNOOZE_DURATION_MS;
    const snoozeUntil = Date.now() + validDuration;
    const targetCode = Number(latestVersionCode) || 0;

    localStorage.setItem(UPDATE_SNOOZE_TIMESTAMP_KEY, String(snoozeUntil));
    if (targetCode > 0) {
      localStorage.setItem(UPDATE_SNOOZE_VERSION_KEY, String(targetCode));
    }

    // Sync with native Android layer if bridge is available
    if (window.LoopraAndroid && typeof window.LoopraAndroid.snoozeUpdatePrompt === 'function') {
      try {
        window.LoopraAndroid.snoozeUpdatePrompt(targetCode, snoozeUntil);
      } catch (_) {}
    }
  } catch (_) {}
}

/**
 * Clears or resets the update snooze state.
 */
export function clearUpdateSnooze() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(UPDATE_SNOOZE_TIMESTAMP_KEY);
    localStorage.removeItem(UPDATE_SNOOZE_VERSION_KEY);
    if (window.LoopraAndroid && typeof window.LoopraAndroid.clearUpdateSnooze === 'function') {
      try {
        window.LoopraAndroid.clearUpdateSnooze();
      } catch (_) {}
    }
  } catch (_) {}
}

/**
 * Built-in client version and build metadata stamped during Vite build.
 */
export const CURRENT_CLIENT_VERSION = (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) ? __APP_VERSION__ : '2.2';
export const CURRENT_CLIENT_VERSION_CODE = (typeof __APP_VERSION_CODE__ !== 'undefined' && __APP_VERSION_CODE__) ? Number(__APP_VERSION_CODE__) : 22;
export const CURRENT_CLIENT_BUILD_ID = (typeof __APP_BUILD_ID__ !== 'undefined' && __APP_BUILD_ID__) ? __APP_BUILD_ID__ : '';
export const CURRENT_CLIENT_BUILD_TIMESTAMP = (typeof __APP_BUILD_TIMESTAMP__ !== 'undefined' && __APP_BUILD_TIMESTAMP__) ? Number(__APP_BUILD_TIMESTAMP__) : 0;

/**
 * Parses semantic versions like "v2.1", "2.1", "v3.0.1", "2.1.0" into comparable [major, minor, patch] arrays of numbers.
 */
export function parseSemanticVersion(ver) {
  if (!ver) return [0, 0, 0];
  const cleaned = String(ver).trim().replace(/^v/i, '');
  const segments = cleaned.split('.').map(seg => {
    const parsed = parseInt(seg, 10);
    return isNaN(parsed) ? 0 : parsed;
  });
  while (segments.length < 3) segments.push(0);
  return segments.slice(0, 3);
}

/**
 * Compares two semantic version strings numerically:
 * Returns:
 *  1 if verA > verB
 * -1 if verA < verB
 *  0 if verA === verB
 */
export function compareVersions(verA, verB) {
  const [aMaj, aMin, aPatch] = parseSemanticVersion(verA);
  const [bMaj, bMin, bPatch] = parseSemanticVersion(verB);

  if (aMaj !== bMaj) return aMaj > bMaj ? 1 : -1;
  if (aMin !== bMin) return aMin > bMin ? 1 : -1;
  if (aPatch !== bPatch) return aPatch > bPatch ? 1 : -1;
  return 0;
}

/**
 * Determines whether the user is running inside the native Android APK/Capacitor/TWA container.
 * Specifically checks for native Android environment via Capacitor or custom native bridge:
 * - window.Capacitor?.isNativePlatform() === true
 * - window.Capacitor?.getPlatform() === 'android'
 * - window.LoopraAndroid bridge
 * - User agent containing 'LoopraNativeAndroid' or 'Capacitor' on Android
 */
export function isRunningInAndroidApp() {
  if (typeof window === 'undefined') return false;

  // 1. Capacitor global checks (standard Capacitor runtime)
  if (window.Capacitor) {
    if (typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
      if (typeof window.Capacitor.getPlatform === 'function') {
        return window.Capacitor.getPlatform() === 'android';
      }
      return true;
    }
  }

  // 2. Custom native Android bridge
  if (window.LoopraAndroid) return true;

  // 3. User agent check for native Android app container
  if (navigator?.userAgent) {
    if (navigator.userAgent.includes('LoopraNativeAndroid')) return true;
    if (navigator.userAgent.includes('Capacitor') && /android/i.test(navigator.userAgent)) return true;
  }

  // Standard web browser (desktop, mobile web, iOS web, or web-hosted Vercel)
  return false;
}

/**
 * Determines whether the app is running in standalone PWA mode.
 */
export function isRunningInPwa() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true ||
    document.referrer.includes('android-app://');
}

/**
 * Retrieves the currently installed or active client version.
 */
export function getInstalledAppVersion() {
  if (typeof window === 'undefined') {
    return { versionName: CURRENT_CLIENT_VERSION, versionCode: CURRENT_CLIENT_VERSION_CODE, isNative: false, isPwa: false };
  }

  const isNative = isRunningInAndroidApp();
  const isPwa = isRunningInPwa();

  // 1. Authoritative: Native bridge window.LoopraAndroid
  if (window.LoopraAndroid && typeof window.LoopraAndroid.getAppVersionName === 'function') {
    try {
      const vName = window.LoopraAndroid.getAppVersionName();
      const vCode = typeof window.LoopraAndroid.getAppVersionCode === 'function'
        ? Number(window.LoopraAndroid.getAppVersionCode())
        : 0;
      if (vName && (vCode > 0 || String(vName).trim().length > 0)) {
        return {
          versionName: String(vName).trim(),
          versionCode: vCode || CURRENT_CLIENT_VERSION_CODE,
          isNative: true,
          isPwa: false
        };
      }
    } catch (err) {
      console.warn('[appUpdateService] Native version read error:', err.message);
    }
  }

  // 2. Authoritative fallback: URL search parameters passed by Android MainActivity
  try {
    const params = new URLSearchParams(window.location.search);
    const paramCode = parseInt(params.get('appVersionCode'), 10);
    const paramName = params.get('appVersionName');
    if (!isNaN(paramCode) && paramCode > 0) {
      return {
        versionName: paramName || `v${paramCode}`,
        versionCode: paramCode,
        isNative: true,
        isPwa: false
      };
    }
  } catch (_) {}

  // 3. For Web browser or PWA standalone installations:
  let clientVersionName = CURRENT_CLIENT_VERSION;
  let clientVersionCode = CURRENT_CLIENT_VERSION_CODE;
  let clientBuildId = CURRENT_CLIENT_BUILD_ID;
  let clientBuildTimestamp = CURRENT_CLIENT_BUILD_TIMESTAMP;

  try {
    const stored = localStorage.getItem('loopra_installed_version');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.versionName) clientVersionName = parsed.versionName;
      if (parsed?.versionCode) clientVersionCode = Number(parsed.versionCode);
      if (parsed?.buildId) clientBuildId = parsed.buildId;
      if (parsed?.buildTimestamp) clientBuildTimestamp = Number(parsed.buildTimestamp);
    }
  } catch (_) {}

  return {
    versionName: clientVersionName,
    versionCode: clientVersionCode || CURRENT_CLIENT_VERSION_CODE,
    buildId: clientBuildId,
    buildTimestamp: clientBuildTimestamp,
    isNative,
    isPwa
  };
}

/**
 * Fetches the latest published release manifest from the backend API,
 * falling back to static `/version.json`.
 */
export async function fetchPublishedAppVersion(backendUrl = '') {
  const cleanUrl = (backendUrl && backendUrl.trim().startsWith('http'))
    ? backendUrl.trim().replace(/\/+$/, '')
    : (BACKEND_URL || '').replace(/\/+$/, '');

  const endpoints = [
    `${cleanUrl}/api/app-version`,
    '/api/app-version',
    '/version.json'
  ];

  for (const url of endpoints) {
    try {
      // Bust any HTTP, CDN or Service Worker cache with no-store and unique timestamp query
      const bustUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
      const res = await fetch(bustUrl, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (res.ok) {
        const manifest = await res.json();
        if (manifest && (manifest.versionName || manifest.version)) {
          const rawVersionName = manifest.versionName || manifest.version || '2.2';
          const normalized = {
            version: String(rawVersionName).trim(),
            versionName: String(rawVersionName).trim(),
            versionCode: Number(manifest.versionCode) || 22,
            buildId: manifest.buildId || '',
            buildTimestamp: Number(manifest.buildTimestamp) || (manifest.buildDate ? new Date(manifest.buildDate).getTime() : 0),
            buildDate: manifest.buildDate || manifest.releaseDate || new Date().toISOString(),
            downloadUrl: manifest.directApkUrl || manifest.downloadUrl || 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
            directApkUrl: manifest.directApkUrl || 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
            externalApkUrl: manifest.externalApkUrl || 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
            releaseNotes: manifest.whatsNew || manifest.releaseNotes || 'New features, performance enhancements, and bug fixes for Loopra.',
            whatsNew: manifest.whatsNew || manifest.releaseNotes || 'New features, performance enhancements, and bug fixes for Loopra.',
            releaseDate: manifest.releaseDate || manifest.buildDate || new Date().toISOString(),
            fileSize: manifest.fileSize || 5744624,
            sha256: manifest.sha256 || ''
          };
          try {
            localStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify(normalized));
          } catch (_) {}
          return normalized;
        }
      }
    } catch (_) {
      // Continue to next fallback
    }
  }

  // Fallback to cached manifest if available
  try {
    const cached = localStorage.getItem(MANIFEST_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  // Safe default fallback if network and cache both fail
  return {
    version: '2.2',
    versionName: '2.2',
    versionCode: 22,
    buildId: '',
    buildTimestamp: 0,
    downloadUrl: 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
    directApkUrl: 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
    externalApkUrl: 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
    releaseNotes: 'Official Loopra release',
    whatsNew: 'Official Loopra release',
    releaseDate: new Date().toISOString(),
    fileSize: 5744624,
    sha256: ''
  };
}

export const DEFAULT_DIRECT_APK_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APK_DOWNLOAD_URL)
    ? import.meta.env.VITE_APK_DOWNLOAD_URL
    : 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk';

/**
 * Resolves the direct, non-intercepted download URL for the Loopra APK.
 */
export function getDirectApkDownloadUrl(manifest = null) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APK_DOWNLOAD_URL) {
    return import.meta.env.VITE_APK_DOWNLOAD_URL;
  }
  if (manifest?.externalApkUrl) {
    return manifest.externalApkUrl;
  }
  if (manifest?.directApkUrl && !manifest.directApkUrl.includes('loopra1.vercel.app') && !manifest.directApkUrl.startsWith('/')) {
    return manifest.directApkUrl;
  }
  return DEFAULT_DIRECT_APK_URL;
}

/**
 * Initiates APK download for Android users.
 */
export function triggerApkDownload(downloadUrl, manifest = null) {
  const publishedCode = manifest?.versionCode || 21;
  const directUrl = downloadUrl || getDirectApkDownloadUrl(manifest);

  // 1. If running inside native Android WebView with LoopraAndroid bridge:
  if (typeof window !== 'undefined' && window.LoopraAndroid) {
    const rawTargetUrl = manifest?.directApkUrl || manifest?.downloadUrl || directUrl;
    if (typeof window.LoopraAndroid.downloadAndInstallApk === 'function') {
      try {
        const expectedSha = manifest?.sha256 || '';
        const expectedCode = manifest?.versionCode ? parseInt(manifest.versionCode, 10) : publishedCode;
        window.LoopraAndroid.downloadAndInstallApk(rawTargetUrl, expectedSha, expectedCode);
        return true;
      } catch (err) {
        console.warn('[appUpdateService] LoopraAndroid.downloadAndInstallApk failed:', err.message);
      }
    }
    if (typeof window.LoopraAndroid.openInBrowser === 'function') {
      try {
        window.LoopraAndroid.openInBrowser(directUrl);
        return true;
      } catch (err) {
        console.warn('[appUpdateService] LoopraAndroid.openInBrowser failed:', err.message);
      }
    }
    if (typeof window.LoopraAndroid.downloadApk === 'function') {
      try {
        window.LoopraAndroid.downloadApk(directUrl);
        return true;
      } catch (err) {
        console.warn('[appUpdateService] LoopraAndroid.downloadApk failed:', err.message);
      }
    }
  }

  // 2. Browser Environment: Trigger direct file download
  if (typeof window !== 'undefined') {
    const targetDownloadUrl = (directUrl.includes('loopra1.vercel.app') || directUrl.startsWith('/'))
      ? getDirectApkDownloadUrl(manifest)
      : directUrl;

    try {
      if (typeof document !== 'undefined') {
        const link = document.createElement('a');
        link.href = targetDownloadUrl;
        link.download = 'Loopra.apk';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          try { document.body.removeChild(link); } catch (_) {}
        }, 300);
        return true;
      }
    } catch (e) {
      console.warn('[appUpdateService] Anchor download attempt failed:', e);
    }

    try {
      const opened = window.open(targetDownloadUrl, '_blank', 'noopener,noreferrer');
      if (opened) return true;
    } catch (_) {}

    if (window.location) {
      window.location.assign(targetDownloadUrl);
      return true;
    }
  }

  return false;
}

/**
 * Clears Web/PWA application caches (excluding offline media cache) and reloads cleanly.
 */
export async function clearAppCachesAndReload(newVersionName = null, newBuildId = null) {
  if (typeof window === 'undefined') return;

  try {
    if (newVersionName || newBuildId) {
      localStorage.setItem('loopra_installed_version', JSON.stringify({
        versionName: newVersionName || CURRENT_CLIENT_VERSION,
        versionCode: CURRENT_CLIENT_VERSION_CODE,
        buildId: newBuildId || '',
        buildTimestamp: Date.now(),
        updatedAt: new Date().toISOString()
      }));
    }

    // Clear CacheStorage (preserving offline tracks)
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => {
          if (key !== 'loopra-offline-songs') {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
    }

    // Unregister or update Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        try {
          await reg.update();
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[appUpdateService] Cache clearing error:', err);
  } finally {
    // Force a fresh reload from server with cache-busting query to break HTTP cache
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_v', Date.now().toString());
      window.location.replace(url.toString());
    } catch (_) {
      window.location.reload();
    }
  }
}

/**
 * Checks whether an update prompt should be shown.
 *
 * Rules:
 * 1. ONLY runs and prompts on Native Android App (Capacitor or native container):
 *    - Never prompt on standard web browser clients (e.g. desktop/mobile Chrome/Safari on loopra1.vercel.app).
 * 2. Compares:
 *    - Version codes: published.versionCode > installed.versionCode
 *    - Semantic version: compareVersions(published.versionName, installed.versionName) > 0
 *    - If semver & version codes are equal: checks published.buildTimestamp > installed.buildTimestamp
 *      or different non-empty buildIds with newer timestamp.
 *    - NEVER triggers when installed build/version is identical to published.
 */
export async function checkForAppUpdate(backendUrl = '') {
  // Check for test mode triggered via URL query (?testUpdate=true or ?forceUpdate=true)
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('testUpdate') === 'true' || params.get('forceUpdate') === 'true') {
        const installed = getInstalledAppVersion();
        return {
          shouldPrompt: true,
          installedVersion: installed.versionName || '2.2',
          installedVersionCode: installed.versionCode || 22,
          installedBuildId: installed.buildId || '',
          latestVersion: '2.3',
          latestVersionCode: 23,
          latestBuildId: 'test_build_' + Date.now(),
          downloadUrl: getDirectApkDownloadUrl(),
          releaseNotes: 'Test update prompt triggered successfully. Audio pipeline optimized and real-time sync updated.',
          whatsNew: 'Test update prompt triggered successfully. Audio pipeline optimized and real-time sync updated.',
          manifest: { versionName: '2.3', versionCode: 23 },
          isNative: true,
          isPwa: false
        };
      }
    } catch (_) {}
  }

  // RESTRICTION: Updates are strictly for Native Android App / Capacitor container only.
  // Standard web browsers (desktop web, mobile web) should NEVER show the update modal or download prompt.
  const isNative = isRunningInAndroidApp();
  if (!isNative) {
    return { shouldPrompt: false, reason: 'WEB_CLIENT_UPDATES_DISABLED' };
  }

  const installed = getInstalledAppVersion();
  const published = await fetchPublishedAppVersion(backendUrl);

  if (!published) {
    return { shouldPrompt: false, reason: 'MANIFEST_UNAVAILABLE' };
  }

  // 2. Snooze Check: If user snoozed within 2-3 hours and target version hasn't incremented, suppress prompt
  const targetCode = Number(published.versionCode) || 0;
  if (isUpdateSnoozed(targetCode)) {
    return { shouldPrompt: false, reason: 'UPDATE_SNOOZED', published, installed };
  }

  // 3. Dismissal check: If dismissed in this session and published version/build hasn't changed, suppress prompt
  try {
    const dismissedKey = sessionStorage.getItem(DISMISSED_UPDATE_SESSION_KEY);
    if (dismissedKey) {
      const isNewerThanDismissed = published.buildId
        ? (dismissedKey !== published.buildId && dismissedKey !== published.versionName)
        : (compareVersions(published.versionName, dismissedKey) > 0);
      if (!isNewerThanDismissed) {
        return { shouldPrompt: false, reason: 'DISMISSED_IN_SESSION', published, installed };
      }
    }
  } catch (_) {}

  let hasNewerVersion = false;

  // --- Native Android APK evaluation ---
  const pCode = Number(published.versionCode) || 0;
  const iCode = Number(installed.versionCode) || 0;

  if (pCode > 0 && iCode > 0) {
    if (pCode > iCode) {
      hasNewerVersion = true;
    } else if (pCode < iCode) {
      hasNewerVersion = false;
    } else {
      // pCode === iCode: compare semver and build timestamp/buildId to prevent false prompts on identical builds
      const semverDiff = (published.versionName && installed.versionName)
        ? compareVersions(published.versionName, installed.versionName)
        : 0;
      if (semverDiff > 0) {
        hasNewerVersion = true;
      } else if (semverDiff === 0) {
        const pubBuildId = String(published.buildId || '').trim();
        const instBuildId = String(installed.buildId || '').trim();
        const pubTs = Number(published.buildTimestamp) || 0;
        const instTs = Number(installed.buildTimestamp) || 0;
        if (pubBuildId && instBuildId && pubBuildId !== instBuildId && pubTs > 0 && instTs > 0) {
          hasNewerVersion = pubTs > instTs;
        } else {
          hasNewerVersion = false;
        }
      } else {
        hasNewerVersion = false;
      }
    }
  } else if (published.versionName && installed.versionName) {
    const semverDiff = compareVersions(published.versionName, installed.versionName);
    if (semverDiff > 0) {
      hasNewerVersion = true;
    } else if (semverDiff === 0) {
      const pubBuildId = String(published.buildId || '').trim();
      const instBuildId = String(installed.buildId || '').trim();
      const pubTs = Number(published.buildTimestamp) || 0;
      const instTs = Number(installed.buildTimestamp) || 0;
      if (pubBuildId && instBuildId && pubBuildId !== instBuildId && pubTs > 0 && instTs > 0) {
        hasNewerVersion = pubTs > instTs;
      } else {
        hasNewerVersion = false;
      }
    } else {
      hasNewerVersion = false;
    }
  }

  if (hasNewerVersion) {
    return {
      shouldPrompt: true,
      installedVersion: installed.versionName,
      installedVersionCode: installed.versionCode,
      installedBuildId: installed.buildId,
      installedBuildTimestamp: installed.buildTimestamp,
      latestVersion: published.versionName,
      latestVersionCode: published.versionCode,
      latestBuildId: published.buildId,
      latestBuildTimestamp: published.buildTimestamp,
      downloadUrl: published.downloadUrl,
      releaseNotes: published.whatsNew || published.releaseNotes,
      whatsNew: published.whatsNew || published.releaseNotes,
      manifest: published,
      isNative: installed.isNative,
      isPwa: installed.isPwa
    };
  }

  return { shouldPrompt: false, reason: 'ALREADY_UP_TO_DATE', published, installed };
}

/**
 * Records user dismissal for the current session.
 */
export function dismissUpdateForSession(versionName, buildId = '') {
  try {
    sessionStorage.setItem(DISMISSED_UPDATE_SESSION_KEY, buildId || versionName || 'dismissed');
  } catch (_) {}
}

/**
 * Expose testing and manual trigger helpers in browser console
 */
if (typeof window !== 'undefined') {
  window.__testAppUpdate = (mockManifest = {}) => {
    const installed = getInstalledAppVersion();
    const mock = {
      shouldPrompt: true,
      installedVersion: installed.versionName || '2.1.0',
      installedVersionCode: installed.versionCode || 21,
      latestVersion: mockManifest.versionName || '2.2.0',
      latestVersionCode: mockManifest.versionCode || 22,
      downloadUrl: mockManifest.downloadUrl || getDirectApkDownloadUrl(),
      releaseNotes: mockManifest.releaseNotes || 'Verification build: all features updated smoothly.',
      manifest: {
        versionName: mockManifest.versionName || '2.2.0',
        versionCode: mockManifest.versionCode || 22,
        ...mockManifest
      },
      isNative: installed.isNative,
      isPwa: installed.isPwa
    };
    window.dispatchEvent(new CustomEvent('loopra-native-update-available', { detail: mock }));
    return mock;
  };
}
