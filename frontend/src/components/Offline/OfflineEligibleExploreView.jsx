import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, 
  Search, 
  X, 
  ShieldCheck, 
  Download, 
  CheckCircle2, 
  Play, 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  FileAudio, 
  Clock, 
  Music2,
  HardDrive
} from 'lucide-react';
import { offlineStorageService } from '../../services/offlineStorageService';
import { offlineEligibilityService } from '../../services/offlineEligibilityService';
import DownloadTrackButton from './DownloadTrackButton';

export default function OfflineEligibleExploreView({
  onBack,
  onPlayTrack,
  currentSong,
  isPlaying,
  showToast,
  backendUrl = ''
}) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [downloadedMap, setDownloadedMap] = useState({});
  const [storageUsage, setStorageUsage] = useState(null);

  const debounceTimerRef = useRef(null);

  // Sync downloaded status from IndexedDB
  const syncDownloadedTracks = useCallback(async () => {
    try {
      const allDownloaded = await offlineStorageService.getAllTracks();
      const map = {};
      allDownloaded.forEach(t => { map[t.id] = true; });
      setDownloadedMap(map);
      const usage = await offlineStorageService.getStorageUsage();
      setStorageUsage(usage);
    } catch (e) {
      console.warn('[Offline Explore] Error syncing downloaded tracks:', e);
    }
  }, []);

  // Fetch authorized tracks from the backend API
  const fetchAuthorizedCatalog = useCallback(async (query = '') => {
    setLoading(true);
    setError(null);

    try {
      const cleanQuery = (query || '').trim();
      const params = new URLSearchParams();
      if (cleanQuery) params.set('q', cleanQuery);
      params.set('limit', '50');

      const url = `${backendUrl}/api/offline/authorized-tracks?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to retrieve authorized offline catalogue.');
      }

      const receivedTracks = Array.isArray(data.tracks) ? data.tracks : [];
      setTracks(receivedTracks);
      setCatalogTotal(typeof data.totalEligibleInCatalog === 'number' ? data.totalEligibleInCatalog : receivedTracks.length);

      // Pre-register verified tracks and their explicit licenses into eligibility service
      offlineEligibilityService.registerEligibleTracks(receivedTracks);
    } catch (err) {
      console.error('[Offline Explore] Fetch error:', err);
      setError(err.message || 'Unable to connect to offline licensing server.');
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  // Initial load
  useEffect(() => {
    fetchAuthorizedCatalog(activeQuery);
    syncDownloadedTracks();

    const unsubStorage = offlineStorageService.subscribe(syncDownloadedTracks);
    return () => unsubStorage();
  }, [fetchAuthorizedCatalog, syncDownloadedTracks, activeQuery]);

  // Handle Search Input Change with 300ms debounce
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setActiveQuery(val.trim());
    }, 300);
  };

  // Submit search immediately (e.g. on Enter)
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setActiveQuery(searchInput.trim());
  };

  // Clear search
  const handleClearSearch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSearchInput('');
    setActiveQuery('');
  };

  const isSearching = Boolean(activeQuery.trim());
  const hasNoMatches = !loading && !error && tracks.length === 0 && isSearching;
  const isCatalogCompletelyEmpty = !loading && !error && tracks.length === 0 && !isSearching;

  return (
    <div className="max-w-5xl mx-auto space-y-6 relative z-10 px-2 sm:px-0 pb-16">
      {/* Top Navigation & Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition text-xs font-semibold cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Offline Library</span>
          </button>

          {storageUsage && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-neutral-400 bg-neutral-900/60 border border-neutral-800 px-3 py-1.5 rounded-xl">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Offline Stored: <strong className="text-emerald-400">{storageUsage.trackCount}</strong></span>
              <span className="text-neutral-600">•</span>
              <span>{storageUsage.formattedTotal}</span>
            </div>
          )}
        </div>

        {/* Hero Banner */}
        <div className="bg-gradient-to-r from-neutral-900/90 via-neutral-900/60 to-amber-950/20 border border-neutral-800/80 rounded-3xl p-5 sm:p-7 backdrop-blur-xl shadow-xl space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Verified Offline Rights
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400 font-mono">
              100% Genuine Audio Playback
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Offline-Ready Music</span>
              <Sparkles className="w-5 h-5 text-amber-400" />
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 mt-1.5 max-w-2xl leading-relaxed">
              Every track listed in this verified catalogue comes with explicit offline-distribution rights. 
              Audio files are downloaded directly and stored safely in your browser IndexedDB for authentic offline listening.
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-2 sm:p-3 backdrop-blur-md shadow-md">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Search className="w-4 h-4 text-amber-400/80 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search offline-ready music by title, artist, or tags..."
            value={searchInput}
            onChange={handleSearchChange}
            className="w-full bg-neutral-950/60 border border-neutral-800/80 focus:border-amber-500/50 rounded-xl pl-10 pr-24 py-2.5 text-xs text-white placeholder-neutral-500 outline-none transition"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                title="Clear search query"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition cursor-pointer shadow-sm shadow-amber-500/20"
            >
              Search
            </button>
          </div>
        </form>

        {isSearching && (
          <div className="flex items-center justify-between text-[11px] text-neutral-400 px-2 pt-2">
            <span>
              Searching verified catalogue for: <strong className="text-amber-400">"{activeQuery}"</strong>
            </span>
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-amber-400/80 hover:text-amber-300 underline cursor-pointer"
            >
              Reset search
            </button>
          </div>
        )}
      </div>

      {/* Content States */}

      {/* State 1: Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 animate-pulse flex items-center gap-3.5"
            >
              <div className="w-16 h-16 rounded-xl bg-neutral-800 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-neutral-800 rounded w-3/4" />
                <div className="h-3 bg-neutral-800/60 rounded w-1/2" />
                <div className="h-2 bg-neutral-800/40 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* State 2: Catalog API Error */}
      {!loading && error && (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-neutral-900/50 border border-rose-500/30 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Catalogue Unavailable</h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchAuthorizedCatalog(activeQuery)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* State 3: No matches for search query */}
      {hasNoMatches && (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-neutral-900/40 border border-neutral-800 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No downloadable songs found for your search</h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              No verified offline-eligible tracks matched "{activeQuery}". All search queries filter only verified downloadable music.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearSearch}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition cursor-pointer shadow-md shadow-amber-500/20"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Search & View All Tracks</span>
          </button>
        </div>
      )}

      {/* State 4: Entire Catalogue is empty */}
      {isCatalogCompletelyEmpty && (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-neutral-900/40 border border-neutral-800 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 mx-auto">
            <Music2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No Verified Tracks in Catalogue Yet</h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              The licensing database currently has no tracks authorized for offline distribution. Check back shortly as new licenses are approved.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchAuthorizedCatalog('')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Catalogue</span>
          </button>
        </div>
      )}

      {/* State 5: Tracks Available */}
      {!loading && !error && tracks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
            <span>
              Showing <strong className="text-white">{tracks.length}</strong> {tracks.length === 1 ? 'eligible track' : 'eligible tracks'}
              {catalogTotal > 0 && !isSearching && ` of ${catalogTotal} in verified catalogue`}
            </span>
            <span className="text-[11px] font-mono text-neutral-500">IndexedDB Direct Audio</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {tracks.map((track) => {
              const isCurrent = currentSong?.id === track.id;
              const isAlreadyDownloaded = Boolean(downloadedMap[track.id]);

              return (
                <div
                  key={track.id}
                  className={`group relative flex flex-col justify-between p-4 rounded-2xl border transition-all duration-200 backdrop-blur-md ${
                    isCurrent
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10'
                      : 'bg-neutral-900/50 hover:bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Artwork thumbnail with hover play */}
                    <div 
                      onClick={() => onPlayTrack && onPlayTrack(track, tracks)}
                      className="relative w-16 h-16 rounded-xl overflow-hidden bg-neutral-800 shrink-0 border border-neutral-700/60 cursor-pointer shadow-md group/art"
                    >
                      {track.thumbnail ? (
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-full h-full object-cover transition duration-300 group-hover/art:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-amber-400">
                          <FileAudio className="w-6 h-6" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/art:opacity-100 flex items-center justify-center transition">
                        <Play className="w-5 h-5 fill-white text-white drop-shadow" />
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 
                          onClick={() => onPlayTrack && onPlayTrack(track, tracks)}
                          className={`text-sm font-bold truncate leading-snug cursor-pointer transition ${
                            isCurrent ? 'text-amber-400' : 'text-white group-hover:text-amber-300'
                          }`}
                          title={track.title}
                        >
                          {track.title}
                        </h3>
                      </div>

                      <p className="text-xs text-neutral-400 truncate" title={track.artist}>
                        {track.artist}
                        {track.channel && track.channel !== track.artist && (
                          <span className="text-neutral-500"> • {track.channel}</span>
                        )}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-neutral-400">
                        {track.duration && (
                          <span className="inline-flex items-center gap-1 font-mono text-neutral-400">
                            <Clock className="w-3 h-3 text-neutral-500" />
                            {track.duration}
                          </span>
                        )}

                        {track.license?.audioSizeBytes > 0 && (
                          <span className="font-mono text-neutral-500 text-[10px]">
                            {offlineStorageService.formatBytes(track.license.audioSizeBytes)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom: License details & Download Action */}
                  <div className="mt-3 pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span 
                        className="inline-flex items-center gap-1 text-[10px] font-mono bg-amber-500/10 text-amber-400/90 border border-amber-500/20 px-2 py-0.5 rounded-md truncate max-w-[200px]"
                        title={track.license?.licenseType || 'Direct License'}
                      >
                        <ShieldCheck className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{track.license?.licenseType || 'Verified License'}</span>
                      </span>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <DownloadTrackButton
                        track={track}
                        showToast={showToast}
                        variant="pill"
                        onDownloaded={() => syncDownloadedTracks()}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

