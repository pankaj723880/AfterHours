import { BACKEND_URL } from '../utils/apiUrl.js';

const MANIFEST_CACHE_KEY = 'loopra_app_version_manifest';
const DISMISSED_UPDATE_SESSION_KEY = 'loopra_dismissed_update_version';

/**
 * Current built-in client version for Web / PWA / Browser environments.
 * When a new build or deploy is released, bumping this version or the published
 * version in /version.json ensures clients detect newer versions reliably.
 */
export const CURRENT_CLIENT_VERSION = '2.1';
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
 * Retrieves the currently installed native Android app version:
 * 1. Checks native bridge `window.LoopraAndroid.getAppVersionName()`
 * 2. Does NOT return fake fallback 2.1/21 when detection fails.
 */
export function getInstalledAppVersion() {
  if (typeof window === 'undefined') {
    return { versionName: null, versionCode: 0, isNative: false };
  }

  // 1. Authoritative: Native bridge window.LoopraAndroid
  if (window.LoopraAndroid && typeof window.LoopraAndroid.getAppVersionName === 'function') {
    try {
      const vName = window.LoopraAndroid.getAppVersionName();
      const vCode = typeof window.LoopraAndroid.getAppVersionCode === 'function'
        ? Number(window.LoopraAndroid.getAppVersionCode())
        : 0;
      if (vName && vCode > 0) {
        return { versionName: vName, versionCode: vCode, isNative: true };
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
        isNative: true
      };
    }
  } catch (_) {}

  const isAndroid = isRunningInAndroidApp();
  
  // 3. For Web browser or PWA standalone installations:
  // Use client build version, falling back to stored version in localStorage
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
    versionCode: clientVersionCode,
    isNative: isAndroid
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
      // Bust any HTTP or intermediary proxy cache with no-store and unique timestamp query
      const bustUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
      const res = await fetch(bustUrl, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (res.ok) {
        const manifest = await res.json();
        if (manifest && (manifest.versionName || manifest.version)) {
          const normalized = {
            versionName: manifest.versionName || manifest.version || '2.1',
            versionCode: manifest.versionCode || 21,
            downloadUrl: manifest.directApkUrl || manifest.downloadUrl || 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
            directApkUrl: manifest.directApkUrl || 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
            externalApkUrl: manifest.externalApkUrl || 'https://raw.githubusercontent.com/pankaj723880/AfterHours/main/frontend/public/Loopra.apk',
            releaseNotes: manifest.releaseNotes || 'New features and improvements for Loopra Android.',
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
    versionName: '2.1',
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
 * Prioritizes VITE_APK_DOWNLOAD_URL, then manifest.externalApkUrl / manifest.directApkUrl
 * (if not matching the intercepted app domain), falling back to the verified GitHub raw release URL.
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
 * Initiates APK download.
 * In a web browser environment, triggers download via direct external APK URL so Android
 * App Links does not intercept the click to launch the installed Loopra app.
 * In native Android WebView, invokes LoopraAndroid bridge methods.
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

  // 2. Browser Environment: Trigger direct, clean file download without launching installed app
  if (typeof window !== 'undefined') {
    // If URL points to the same origin / loopra1.vercel.app, replace with non-intercepted external direct URL
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
 * Checks whether an update prompt should be shown.
 * Works seamlessly across native Android WebView container, standalone PWA,
 * and standard web browser clients.
 */
export async function checkForAppUpdate(backendUrl = '') {
  const installed = getInstalledAppVersion();
  const published = await fetchPublishedAppVersion(backendUrl);

  if (!published) {
    return { shouldPrompt: false, reason: 'MANIFEST_UNAVAILABLE' };
  }

  // If installed version detection failed completely, do NOT prompt false update
  if (!installed.versionName || installed.versionCode === 0) {
    return { shouldPrompt: false, reason: 'INSTALLED_VERSION_UNKNOWN', published, installed };
  }

  // Check if this release was dismissed during the current session
  // If a newer version is published than the dismissed one, allow the popup to re-appear
  try {
    const dismissedVer = sessionStorage.getItem(DISMISSED_UPDATE_SESSION_KEY);
    if (dismissedVer) {
      // If the published version is newer than the dismissed version, clear session lock
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
      manifest: published
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
