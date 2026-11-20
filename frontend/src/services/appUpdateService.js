import { BACKEND_URL } from '../utils/apiUrl.js';

const MANIFEST_CACHE_KEY = 'loopra_app_version_manifest';
const DISMISSED_UPDATE_SESSION_KEY = 'loopra_dismissed_update_version';

/**
 * Parses semantic versions like "v2.1", "2.1", "v3.0.1" into comparable [major, minor, patch] arrays.
 */
export function parseSemanticVersion(ver) {
  if (!ver) return [0, 0, 0];
  const cleaned = String(ver).trim().replace(/^v/i, '');
  const parts = cleaned.split('.').map(n => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts;
}

/**
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
  return { versionName: null, versionCode: 0, isNative: isAndroid };
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
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (res.ok) {
        const manifest = await res.json();
        if (manifest && (manifest.versionName || manifest.version)) {
          const normalized = {
            versionName: manifest.versionName || manifest.version || '2.1',
            versionCode: manifest.versionCode || 21,
            downloadUrl: manifest.directApkUrl || manifest.downloadUrl || 'https://loopra1.vercel.app/Loopra.apk',
            directApkUrl: manifest.directApkUrl || '/Loopra.apk',
            releaseNotes: manifest.releaseNotes || 'New features and improvements for Loopra Android.',
            releaseDate: manifest.releaseDate || new Date().toISOString(),
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

  return null;
}

/**
 * Initiates APK download.
 * Opens the direct APK download URL (https://loopra1.vercel.app/Loopra.apk?v=<versionCode>)
 * in Google Chrome (or default external browser) so that Chrome handles the APK download normally.
 * Does not invoke background APK downloading, FileProvider, or PackageInstaller.
 */
export function triggerApkDownload(downloadUrl, manifest = null) {
  const publishedCode = manifest?.versionCode || 21;
  const rawTargetUrl = downloadUrl || manifest?.directApkUrl || manifest?.downloadUrl || 'https://loopra1.vercel.app/Loopra.apk';

  // Ensure targetUrl points to https://loopra1.vercel.app/Loopra.apk?v=<versionCode>
  let browserUrl = rawTargetUrl;
  try {
    const urlObj = new URL(browserUrl, typeof window !== 'undefined' ? (window.location?.origin || 'https://loopra1.vercel.app') : 'https://loopra1.vercel.app');
    urlObj.searchParams.set('v', String(publishedCode));
    browserUrl = urlObj.toString();
  } catch (_) {
    const sep = browserUrl.includes('?') ? '&' : '?';
    browserUrl += `${sep}v=${encodeURIComponent(publishedCode)}`;
  }

  // 1. If running inside native Android WebView with LoopraAndroid bridge:
  if (typeof window !== 'undefined' && window.LoopraAndroid) {
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
        window.LoopraAndroid.openInBrowser(browserUrl);
        return true;
      } catch (err) {
        console.warn('[appUpdateService] LoopraAndroid.openInBrowser failed:', err.message);
      }
    }
    if (typeof window.LoopraAndroid.downloadApk === 'function') {
      try {
        window.LoopraAndroid.downloadApk(browserUrl);
        return true;
      } catch (err) {
        console.warn('[appUpdateService] LoopraAndroid.downloadApk failed:', err.message);
      }
    }
  }

  // 2. Open directly in external browser / Google Chrome tab
  if (typeof window !== 'undefined') {
    try {
      const opened = window.open(browserUrl, '_blank', 'noopener,noreferrer');
      if (opened) return true;
    } catch (_) {}

    try {
      if (typeof document !== 'undefined') {
        const link = document.createElement('a');
        link.href = browserUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.download = 'Loopra.apk';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
      }
    } catch (_) {}

    if (window.location) {
      window.location.href = browserUrl;
      return true;
    }
  }

  return false;
}

/**
 * Checks whether an update prompt should be shown.
 */
export async function checkForAppUpdate(backendUrl = '') {
  // Only check updates when running inside native Android app container or standalone mode
  if (!isRunningInAndroidApp()) {
    return { shouldPrompt: false, reason: 'NOT_ANDROID_APP' };
  }

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
  try {
    const dismissedVer = sessionStorage.getItem(DISMISSED_UPDATE_SESSION_KEY);
    if (dismissedVer && dismissedVer === published.versionName) {
      return { shouldPrompt: false, reason: 'DISMISSED_IN_SESSION', published, installed };
    }
  } catch (_) {}

  // Integer versionCode comparison is authoritative:
  // An update is required if published.versionCode > installed.versionCode.
  // Fall back to semantic version comparison only if versionCode is absent.
  let hasNewerVersion = false;
  if (published.versionCode && installed.versionCode) {
    hasNewerVersion = published.versionCode > installed.versionCode;
  } else if (published.versionName && installed.versionName) {
    hasNewerVersion = compareVersions(published.versionName, installed.versionName) > 0;
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
