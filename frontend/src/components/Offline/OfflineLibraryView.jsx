import React, { useState, useEffect } from 'react';
import { 
  Download, 
  HardDrive, 
  Play, 
  Trash2, 
  ShieldCheck, 
  FileAudio, 
  RefreshCw, 
  Search, 
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { offlineStorageService } from '../../services/offlineStorageService';

export default function OfflineLibraryView({ 
  onPlayTrack, 
  currentSong, 
  isPlaying, 
  showToast,
  onExploreAuthorizedTracks 
}) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await offlineStorageService.getAllTracks();
      setTracks(all);
      const usage = await offlineStorageService.getStorageUsage();
      setStorageInfo(usage);
    } catch (err) {
      console.error('[Offline Library] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = offlineStorageService.subscribe(loadData);
    return () => unsub();
  }, []);

  const handleDelete = async (trackId, title) => {
    try {
      await offlineStorageService.deleteTrack(trackId);
      if (showToast) showToast(`Deleted "${title}" from offline storage`, 'info');
      loadData();
    } catch (e) {
      if (showToast) showToast('Failed to delete track', 'error');
    }
  };

  const handleClearAll = async () => {
    try {
      await offlineStorageService.clearAllTracks();
      setShowClearModal(false);
      if (showToast) showToast('Cleared all offline downloads', 'info');
      loadData();
    } catch (e) {
      if (showToast) showToast('Failed to clear downloads', 'error');
    }
  };

  const filteredTracks = tracks.filter(t => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.artist && t.artist.toLowerCase().includes(q)) ||
      (t.channel && t.channel.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 relative z-10 px-2 sm:px-0">
      {/* Header and Storage Analytics */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-5 sm:p-7 backdrop-blur-xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" />
              IndexedDB Audio Storage
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Offline Library</h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Locally stored audio files. These tracks play seamlessly through Loopra without any active network connection.
          </p>

          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 mt-4">
            <span className="bg-neutral-800/80 px-3 py-1 rounded-full font-mono text-neutral-300">
              {tracks.length} {tracks.length === 1 ? 'Song Stored' : 'Songs Stored'}
            </span>
            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-mono font-semibold">
              {storageInfo?.formattedTotal || '0 B'} Used
            </span>
            {storageInfo?.quota && (
              <span className="text-neutral-500 font-mono text-[11px]">
                (Browser Quota: {storageInfo.formattedQuota})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onExploreAuthorizedTracks}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-amber-400 hover:text-amber-300 border border-neutral-800 hover:border-amber-500/30 text-xs font-semibold transition cursor-pointer"
            title="Discover tracks with verified offline distribution rights"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Explore Eligible Music</span>
          </button>

          {tracks.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => onPlayTrack(filteredTracks[0])}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play All</span>
              </button>

              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-rose-400 hover:text-rose-300 border border-neutral-800 hover:border-rose-500/30 text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear All</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={loadData}
            title="Refresh Storage"
            className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Bar for Offline Tracks */}
      {tracks.length > 3 && (
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search downloaded songs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900/60 border border-neutral-800 focus:border-amber-500/50 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 outline-none transition"
          />
        </div>
      )}

      {/* Tracks List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-neutral-400 bg-neutral-900/30 rounded-3xl border border-neutral-800 animate-pulse">
          Loading stored audio files from browser IndexedDB...
        </div>
      ) : tracks.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-neutral-900/40 border border-neutral-800 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto shadow-lg shadow-amber-500/10">
            <Download className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No Offline Downloads Stored Yet</h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              Songs with verified offline distribution rights display a Download button. When downloaded, their actual audio files are stored locally in your browser for 100% offline playback.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onExploreAuthorizedTracks}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Explore Verified Offline-Eligible Music</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 text-[11px] text-neutral-400 text-left max-w-lg mx-auto space-y-1.5 mt-4">
            <div className="font-semibold text-neutral-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Licensing Transparency Notice</span>
            </div>
            <p className="text-neutral-400">
              In accordance with Google and YouTube API Terms of Service, standard YouTube video streams are streaming-only and cannot be extracted or cached. Only tracks with verified direct artist agreements or Creative Commons rights are downloadable.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTracks.map((track, idx) => {
            const isCurrent = currentSong?.id === track.id;
            return (
              <div
                key={track.id}
                onClick={() => onPlayTrack(track)}
                className={`flex items-center justify-between p-3 sm:p-3.5 rounded-2xl border transition cursor-pointer group ${
                  isCurrent
                    ? 'bg-amber-500/15 border-amber-500/40 shadow-lg shadow-amber-500/10'
                    : 'bg-neutral-900/40 hover:bg-neutral-900/80 border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-neutral-800 shrink-0 border border-neutral-700/60">
                    {track.thumbnail ? (
                      <img 
                        src={track.thumbnail} 
                        alt={track.title} 
                        className="w-full h-full object-cover" 
                        loading="lazy" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-amber-400">
                        <FileAudio className="w-5 h-5" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                      <Play className="w-4 h-4 fill-white text-white" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-xs sm:text-sm font-bold truncate leading-snug ${isCurrent ? 'text-amber-400' : 'text-white'}`}>
                        {track.title}
                      </h4>
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono px-2 py-0.2 rounded-full shrink-0">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Offline Ready
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                      <span className="text-neutral-300 font-medium truncate max-w-[140px] sm:max-w-none">
                        {track.artist}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-neutral-500">
                        {offlineStorageService.formatBytes(track.fileSize || 0)}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[10px] text-amber-500/80 truncate max-w-[180px]">
                        {track.license?.licenseType || 'Verified License'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(track.id, track.title);
                    }}
                    title="Delete download"
                    className="p-2 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Clear All */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Clear All Downloads?</h3>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              This will remove all downloaded audio files from your browser storage. You will need an active connection to download them again.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

