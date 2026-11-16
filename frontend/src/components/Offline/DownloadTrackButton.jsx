import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import { offlineStorageService } from '../../services/offlineStorageService';

export default function DownloadTrackButton({
  track,
  showToast,
  className = '',
  variant = 'icon', // 'icon' | 'pill' | 'menu-item' | 'badge'
  onDownloaded
}) {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);

  const trackId = track?.id || track?.videoId;

  useEffect(() => {
    if (!trackId) return;

    offlineStorageService.isTrackDownloaded(trackId).then(setIsDownloaded);

    const unsub = offlineStorageService.subscribe(() => {
      offlineStorageService.isTrackDownloaded(trackId).then(setIsDownloaded);
    });

    return () => unsub();
  }, [trackId]);

  const handleDownload = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!track || !trackId) return;

    if (downloadProgress !== null || offlineStorageService.isDownloading(trackId)) {
      return;
    }

    if (isDownloaded) {
      if (showToast) showToast('This song is already saved in your Offline Library', 'info');
      return;
    }

    setDownloadProgress(0);

    try {
      await offlineStorageService.cacheTrackAudio(track, (percent) => {
        setDownloadProgress(percent);
      });

      setIsDownloaded(true);
      setDownloadProgress(null);
      if (showToast) {
        showToast(`Downloaded "${track.title || 'Song'}" for offline playback!`, 'success');
      }
      if (onDownloaded) onDownloaded(track);
    } catch (err) {
      console.error('[Download error]:', err);
      setDownloadProgress(null);
      if (showToast) {
        showToast(err.message || 'Failed to download track for offline listening', 'error');
      }
    }
  };

  const handleDelete = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!trackId) return;
    try {
      await offlineStorageService.deleteTrack(trackId);
      setIsDownloaded(false);
      if (showToast) showToast(`Removed "${track.title || 'Song'}" from Downloads`, 'info');
    } catch (err) {
      if (showToast) showToast('Failed to remove downloaded song', 'error');
    }
  };

  // 1. Menu Item Variant (for 3-dot popup menus & context menu)
  if (variant === 'menu-item') {
    if (downloadProgress !== null) {
      return (
        <div className="flex items-center justify-between px-4 py-2.5 text-xs text-amber-400 bg-amber-500/10">
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
          type="button"
          onClick={handleDelete}
          className="w-full text-left px-4 py-2.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-neutral-800 transition flex items-center justify-between cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5" />
            Remove from Downloads
          </span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-semibold">
            Downloaded
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleDownload}
        className="w-full text-left px-4 py-2.5 text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-neutral-800 transition flex items-center gap-2 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Download Song (Offline)</span>
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
        <button
          type="button"
          onClick={handleDelete}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-rose-500/10 hover:text-rose-400 transition cursor-pointer group ${className}`}
          title="Downloaded (Click to remove)"
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 group-hover:hidden" />
          <Trash2 className="w-3.5 h-3.5 text-rose-400 hidden group-hover:block" />
          <span className="group-hover:hidden">Downloaded</span>
          <span className="hidden group-hover:inline">Remove</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleDownload}
        title="Download for offline playback"
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition active:scale-95 cursor-pointer ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Download</span>
      </button>
    );
  }

  // 3. Badge Variant (small checkmark/badge for song cards)
  if (variant === 'badge') {
    if (downloadProgress !== null) {
      return (
        <span className="inline-flex items-center text-amber-400" title={`Downloading ${downloadProgress}%`}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        </span>
      );
    }
    if (isDownloaded) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-full" title="Saved for Offline Playback">
          <CheckCircle className="w-3 h-3 text-emerald-400" />
          <span>Offline</span>
        </span>
      );
    }
    return null;
  }

  // 4. Icon Variant (default round button)
  if (downloadProgress !== null) {
    return (
      <button
        type="button"
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
        type="button"
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
      type="button"
      onClick={handleDownload}
      title="Download song for offline listening"
      className={`p-2 rounded-full bg-neutral-800/80 hover:bg-amber-500/20 text-neutral-300 hover:text-amber-400 transition cursor-pointer active:scale-90 border border-neutral-700/60 hover:border-amber-500/40 ${className}`}
    >
      <Download className="w-4 h-4" />
    </button>
  );
}
