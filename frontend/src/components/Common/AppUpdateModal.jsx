import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X, Sparkles, Smartphone, ShieldCheck, Loader2, AlertCircle, Globe } from 'lucide-react';
import { triggerApkDownload, snoozeUpdate, dismissUpdateForSession, clearAppCachesAndReload, isRunningInAndroidApp } from '../../services/appUpdateService';

export default function AppUpdateModal({ updateInfo, onClose, showToast }) {
  const [downloadStatus, setDownloadStatus] = useState(null); // null | 'downloading' | 'verifying' | 'ready_to_install' | 'permission_required' | 'installer_opened' | 'reloading' | 'error'
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const handleStatus = (event) => {
      const detail = event?.detail;
      if (!detail) return;
      setDownloadStatus(detail.status);
      setDownloadProgress(detail.progress || 0);
      setStatusMessage(detail.message || '');

      if (detail.status === 'error' && showToast) {
        showToast(detail.message || 'Update download failed', 'error');
      } else if (detail.status === 'installer_opened') {
        if (showToast) {
          showToast('Android package installer launched', 'success');
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    };

    window.addEventListener('loopra-apk-install-status', handleStatus);
    return () => window.removeEventListener('loopra-apk-install-status', handleStatus);
  }, [showToast, onClose]);

  if (!updateInfo) return null;

  const {
    installedVersion = '2.2',
    latestVersion = '2.2',
    installedBuildId,
    latestBuildId,
    downloadUrl,
    releaseNotes,
    whatsNew,
    manifest,
    isNative: isNativeProp
  } = updateInfo;

  const isNative = isNativeProp ?? isRunningInAndroidApp();

  // Strict safety check: Never display update modal in non-native web browser environments
  if (!isNative) {
    return null;
  }
  const publishedCode = manifest?.versionCode || 22;
  const directApkUrl = manifest?.directApkUrl || `https://loopra1.vercel.app/Loopra.apk?v=${publishedCode}`;
  const displayNotes = whatsNew || releaseNotes || manifest?.whatsNew || manifest?.releaseNotes || 'Latest stability, performance enhancements, and bug fixes for Loopra.';

  const handleAction = async () => {
    if (isNative) {
      try {
        setDownloadStatus('downloading');
        setDownloadProgress(100);
        setStatusMessage('Opening in Chrome...');
        triggerApkDownload(downloadUrl, manifest);
        if (showToast) {
          showToast('Opening APK download in Chrome...', 'success');
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (err) {
        if (showToast) {
          showToast('Opening download in Chrome...', 'info');
        }
        onClose();
      }
    } else {
      // Web / PWA client: clear caches and reload
      try {
        setDownloadStatus('reloading');
        setDownloadProgress(100);
        setStatusMessage('Updating app and refreshing cache...');
        if (showToast) {
          showToast('Applying update...', 'info');
        }
        setTimeout(async () => {
          await clearAppCachesAndReload(latestVersion, latestBuildId);
        }, 400);
      } catch (err) {
        window.location.reload();
      }
    }
  };

  const handleDismiss = () => {
    // Snooze update popup for 3 hours and track snoozed version code
    const targetCode = updateInfo?.latestVersionCode || manifest?.versionCode || publishedCode;
    snoozeUpdate(targetCode);
    dismissUpdateForSession(latestVersion, latestBuildId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none">
      <div 
        className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-amber-500/30 shadow-2xl p-6 relative overflow-hidden text-left"
        style={{
          boxShadow: '0 25px 50px -12px rgba(245, 158, 11, 0.25)'
        }}
      >
        {/* Glow ambient background circles */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-orange-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Header Icon + Close Button */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            {isNative ? (
              <Smartphone className="w-6 h-6 text-amber-400" />
            ) : (
              <Globe className="w-6 h-6 text-amber-400" />
            )}
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="Close update modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Section */}
        <div className="space-y-2 mb-6 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            <span>Update Available</span>
          </div>

          <h3 className="text-lg font-display font-extrabold text-white tracking-wide">
            {isNative ? 'New APK Version Available' : 'New Build Available'}
          </h3>
          <p className="text-xs text-neutral-300 leading-relaxed">
            {isNative
              ? 'A newer version of Loopra Android is available for installation.'
              : 'A newer build of Loopra is ready. Refresh now to get the latest features and fixes.'}
          </p>

          {/* Dynamic Version Badges */}
          <div className="flex items-center gap-2 pt-2 pb-1">
            <div className="px-3 py-1.5 rounded-xl bg-neutral-800/80 border border-neutral-700/60 text-neutral-400 text-xs">
              <span className="text-[10px] uppercase font-bold tracking-wider block text-neutral-400">Current</span>
              <span className="font-mono font-bold text-white">v{String(installedVersion).replace(/^v/i, '')}</span>
            </div>

            <div className="text-neutral-500 text-sm font-bold">→</div>

            <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs">
              <span className="text-[10px] uppercase font-bold tracking-wider block text-amber-400">Latest</span>
              <span className="font-mono font-bold text-amber-300">v{String(latestVersion).replace(/^v/i, '')}</span>
            </div>

            {!isNative && installedBuildId && latestBuildId && installedBuildId !== latestBuildId && (
              <div className="ml-auto px-2 py-1 rounded-lg bg-neutral-800/60 border border-neutral-700/50 text-[10px] font-mono text-neutral-400">
                <span>Update</span>
              </div>
            )}
          </div>

          {/* Release Notes */}
          {displayNotes && (
            <div className="p-2.5 rounded-xl bg-black/40 border border-neutral-800 text-[11px] text-neutral-400 leading-snug">
              <span className="font-bold text-neutral-300 block mb-0.5">What's New:</span>
              <span className="line-clamp-2">{displayNotes}</span>
            </div>
          )}

          {/* Progress / Status display if downloading or reloading */}
          {downloadStatus && (
            <div className="p-3 rounded-2xl bg-neutral-950/80 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                  {downloadStatus === 'downloading' || downloadStatus === 'verifying' || downloadStatus === 'reloading' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  ) : downloadStatus === 'error' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span className="capitalize">{downloadStatus.replace(/_/g, ' ')}</span>
                </span>
                <span className="text-amber-400 font-bold">{downloadProgress}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 rounded-full ${
                    downloadStatus === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-amber-500 to-amber-300'
                  }`}
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>

              {statusMessage && (
                <div className="space-y-1">
                  <p className="text-[11px] text-neutral-300 truncate">
                    {statusMessage}
                  </p>
                  {isNative && (
                    <p className="text-[10px] text-neutral-400">
                      If download does not begin automatically,{' '}
                      <a
                        href={directApkUrl}
                        download="Loopra.apk"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-400 hover:text-amber-300 underline font-semibold"
                      >
                        tap here to download directly
                      </a>.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/90 font-medium pt-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>{isNative ? 'Official signed APK release' : 'Official production release'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 relative z-10">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={downloadStatus === 'downloading' || downloadStatus === 'verifying' || downloadStatus === 'reloading'}
            className="flex-1 py-2.5 px-4 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 disabled:opacity-50 text-neutral-300 hover:text-white font-semibold text-xs border border-neutral-700/60 active:scale-95 transition-all cursor-pointer text-center"
          >
            Not Now
          </button>

          <button
            type="button"
            onClick={handleAction}
            disabled={downloadStatus === 'downloading' || downloadStatus === 'verifying' || downloadStatus === 'reloading'}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
          >
            {downloadStatus === 'downloading' || downloadStatus === 'verifying' || downloadStatus === 'reloading' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-950" />
                <span>Updating...</span>
              </>
            ) : isNative ? (
              <>
                <Download className="w-3.5 h-3.5 text-neutral-950" />
                <span>Download Update</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-neutral-950" />
                <span>Update Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
