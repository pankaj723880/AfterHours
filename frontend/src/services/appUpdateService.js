import { BACKEND_URL } from '../utils/apiUrl.js';

const MANIFEST_CACHE_KEY = 'loopra_app_version_manifest';
const DISMISSED_UPDATE_SESSION_KEY = 'loopra_dismissed_update_version';

/**
 * Current built-in client version for Web / PWA / Browser environments.
 * When a new build or deploy is released, bumping this version or the published
 * version in /version.json ensures clients detect newer versions reliably.
 */
export const CURRENT_CLIENT_VERSION = '2.1.0';
export const CURRENT_CLIENT_VERSION_CODE = 21;

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
 * Determines whether the user is running inside the native Android APK/TWA container.
 */
export function isRunningInAndroidApp() {
  if (typeof window === 'undefined') return false;
  if (window.LoopraAndroid) return true;
  if (navigator?.userAgent && navigator.userAgent.includes('LoopraNativeAndroid')) return true;
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
  try {
    const stored = localStorage.getItem('loopra_installed_version');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.versionName) clientVersionName = parsed.versionName;
      if (parsed?.versionCode) clientVersionCode = Number(parsed.versionCode);
    }
  } catch (_) {}

  return {
    versionName: clientVersionName,
    versionCode: clientVersionCode || CURRENT_CLIENT_VERSION_CODE,
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
          const rawVersionName = manifest.versionName || manifest.version || '2.1.0';
          const normalized = {
            versionName: String(rawVersionName).trim(),
            versionCode: Number(manifest.versionCode) || 21,
            downloadUrl: manifest.directApkUrl || manifest.downloadUrl || 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
            directApkUrl: manifest.directApkUrl || 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
            externalApkUrl: manifest.externalApkUrl || 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
            releaseNotes: manifest.releaseNotes || 'New features, performance enhancements, and bug fixes for Loopra.',
            releaseDate: manifest.releaseDate || new Date().toISOString(),
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
    versionName: '2.1.0',
    versionCode: 21,
    downloadUrl: 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
    directApkUrl: 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
    externalApkUrl: 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
    releaseNotes: 'Official Loopra release',
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
export async function clearAppCachesAndReload(newVersionName = null) {
  if (typeof window === 'undefined') return;

  try {
    if (newVersionName) {
      localStorage.setItem('loopra_installed_version', JSON.stringify({
        versionName: newVersionName,
        versionCode: CURRENT_CLIENT_VERSION_CODE,
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
    // Force a fresh reload from server
    window.location.reload();
  }
}

/**
 * Checks whether an update prompt should be shown.
 * Works seamlessly across native Android WebView container, standalone PWA,
 * and standard web browser clients.
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
          installedVersion: installed.versionName || '2.1.0',
          installedVersionCode: installed.versionCode || 21,
          latestVersion: '2.2.0',
          latestVersionCode: 22,
          downloadUrl: getDirectApkDownloadUrl(),
          releaseNotes: 'Test update prompt triggered successfully. Audio pipeline optimized and real-time sync updated.',
          manifest: { versionName: '2.2.0', versionCode: 22 },
          isNative: installed.isNative,
          isPwa: installed.isPwa
        };
      }
    } catch (_) {}
  }

  const installed = getInstalledAppVersion();
  const published = await fetchPublishedAppVersion(backendUrl);

  if (!published) {
    return { shouldPrompt: false, reason: 'MANIFEST_UNAVAILABLE' };
  }

  // Check if this release was dismissed during the current session
  try {
    const dismissedVer = sessionStorage.getItem(DISMISSED_UPDATE_SESSION_KEY);
    if (dismissedVer) {
      // If the published version is newer than the dismissed version, allow the popup to re-appear
      const isNewerThanDismissed = compareVersions(published.versionName, dismissedVer) > 0;
      if (!isNewerThanDismissed) {
        return { shouldPrompt: false, reason: 'DISMISSED_IN_SESSION', published, installed };
      }
    }
  } catch (_) {}

  // Primary check: Semantic version comparison (major.minor.patch) segment-by-segment
  // Secondary check: Integer versionCode comparison
  let hasNewerVersion = false;
  if (published.versionName && installed.versionName) {
    const semverDiff = compareVersions(published.versionName, installed.versionName);
    if (semverDiff > 0) {
      hasNewerVersion = true;
    } else if (semverDiff === 0 && published.versionCode && installed.versionCode) {
      hasNewerVersion = published.versionCode > installed.versionCode;
    }
  } else if (published.versionCode && installed.versionCode) {
    hasNewerVersion = published.versionCode > installed.versionCode;
  }

  if (hasNewerVersion) {
    return {
      shouldPrompt: true,
      installedVersion: installed.versionName,
      installedVersionCode: installed.versionCode,
      latestVersion: published.versionName,
      latestVersionCode: published.versionCode,
      downloadUrl: published.downloadUrl,
      releaseNotes: published.releaseNotes,
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
export function dismissUpdateForSession(versionName) {
  try {
    sessionStorage.setItem(DISMISSED_UPDATE_SESSION_KEY, versionName || 'dismissed');
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
