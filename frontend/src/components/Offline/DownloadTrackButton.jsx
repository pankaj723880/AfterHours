import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { offlineEligibilityService } from '../../services/offlineEligibilityService';
import { offlineStorageService } from '../../services/offlineStorageService';

export default function DownloadTrackButton({
  track,
  showToast,
  className = '',
  variant = 'icon', // 'icon' | 'pill' | 'menu-item'
  onDownloaded
}) {
  const [isEligible, setIsEligible] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const trackId = track?.id;

  useEffect(() => {
    if (!trackId) return;

    if (track?.license && track.offlineEligible && !offlineEligibilityService.hasChecked(trackId)) {
      offlineEligibilityService.registerEligibleTrack(track);
    }

    // Check cached eligibility or queue check
    setIsEligible(offlineEligibilityService.isEligible(trackId) || Boolean(track?.offlineEligible && track?.license));
    if (!offlineEligibilityService.hasChecked(trackId) && !track?.license) {
      offlineEligibilityService.queueEligibilityCheck([trackId]);
    }

    // Check if track is already downloaded
    offlineStorageService.isTrackDownloaded(trackId).then(setIsDownloaded);

    // Subscribe to eligibility and storage changes
    const unsubEligible = offlineEligibilityService.subscribe(() => {
      setIsEligible(offlineEligibilityService.isEligible(trackId));
    });

    const unsubStorage = offlineStorageService.subscribe(() => {
      offlineStorageService.isTrackDownloaded(trackId).then(setIsDownloaded);
    });

    return () => {
      unsubEligible();
      unsubStorage();
    };
  }, [trackId]);

  // STRICT REQUIREMENT: If the song is NOT verified as eligible, hide the button completely.
  // Do NOT show a disabled button or "Offline unavailable" label.
  if (!isEligible) {
    return null;
  }

  const handleDownload = async (e) => {
    e?.stopPropagation();
    if (!track || !trackId) return;

    if (downloadProgress !== null || offlineStorageService.isDownloading(trackId)) {
      return; // Prevent duplicate concurrent downloads
    }

    if (isDownloaded) {
      if (showToast) showToast('This song is already downloaded in your Offline Library', 'info');
      return;
    }

    setErrorMsg('');
    setDownloadProgress(0);

    const license = offlineEligibilityService.getLicense(trackId) || track?.license;

    try {
      await offlineStorageService.downloadAndStoreTrack(track, license, (percent) => {
        setDownloadProgress(percent);
      });

      setIsDownloaded(true);
      setDownloadProgress(null);
      if (showToast) {
        showToast(`Downloaded "${track.title}" for offline playback!`, 'success');
      }
      if (onDownloaded) onDownloaded(track);
    } catch (err) {
      console.error('[Download error]:', err);
      setDownloadProgress(null);
      setErrorMsg(err.message || 'Download failed');
      if (showToast) {
        showToast(err.message || 'Failed to download track for offline listening', 'error');
      }
    }
  };

  const handleDelete = async (e) => {
    e?.stopPropagation();
    if (!trackId) return;
    try {
      await offlineStorageService.deleteTrack(trackId);
      setIsDownloaded(false);
      if (showToast) showToast(`Removed "${track.title}" from Offline Library`, 'info');
    } catch (err) {
      if (showToast) showToast('Failed to remove downloaded song', 'error');
    }
  };

  // 1. Menu Item Variant (for 3-dot popup menus)
  if (variant === 'menu-item') {
    if (downloadProgress !== null) {
      return (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-amber-400 bg-amber-500/10">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Downloading... {downloadProgress}%</span>
          </div>
        </div>
      );
    }

    if (isDownloaded) {
      return (
        <button
          onClick={handleDelete}
          className="w-full text-left px-4 py-2.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-neutral-800 transition flex items-center justify-between cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5" />
            Remove Offline Download
          </span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
            Stored
          </span>
        </button>
      );
    }

    return (
      <button
        onClick={handleDownload}
        className="w-full text-left px-4 py-2.5 text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-neutral-800 transition flex items-center gap-2 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Download for Offline Playback</span>
      </button>
    );
  }

  // 2. Pill Variant (with text)
  if (variant === 'pill') {
    if (downloadProgress !== null) {
      return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono ${className}`}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{downloadProgress}%</span>
        </div>
      );
    }

    if (isDownloaded) {
      return (
        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold ${className}`} title="Downloaded to browser storage">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>Downloaded</span>
        </div>
      );
    }

    return (
      <button
        onClick={handleDownload}
        title="Download for offline playback"
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition active:scale-95 cursor-pointer ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Download</span>
      </button>
    );
  }

  // 3. Icon Variant (default round button)
  if (downloadProgress !== null) {
    return (
      <button
        disabled
        className={`relative p-2 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center text-[10px] font-mono cursor-wait ${className}`}
        title={`Downloading ${downloadProgress}%`}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="sr-only">Downloading {downloadProgress}%</span>
      </button>
    );
  }

  if (isDownloaded) {
    return (
      <button
        onClick={handleDelete}
        title="Offline Ready (Click to remove download)"
        className={`p-2 rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-rose-500/10 hover:text-rose-400 transition cursor-pointer border border-emerald-500/30 group ${className}`}
      >
        <CheckCircle className="w-4 h-4 group-hover:hidden" />
        <Trash2 className="w-4 h-4 hidden group-hover:block" />
      </button>
    );
  }

  return (
    <button
      onClick={handleDownload}
      title="Download song for offline listening"
      className={`p-2 rounded-full bg-neutral-800/80 hover:bg-amber-500/20 text-neutral-300 hover:text-amber-400 transition cursor-pointer active:scale-90 border border-neutral-700/60 hover:border-amber-500/40 ${className}`}
    >
      <Download className="w-4 h-4" />
    </button>
  );
}

