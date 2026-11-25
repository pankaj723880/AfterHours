import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Plus, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { getCleanThumbnail, isThumbnailUrlFormatValid } from '../../utils/thumbnailValidator';
import { getApiUrl } from '../../utils/apiUrl';
import DownloadTrackButton from '../Offline/DownloadTrackButton';

// Client-side in-memory cache keyed by track ID to avoid duplicate network fetches
const suggestionsCache = new Map();

export default function SuggestedForYouSection({
  currentSong,
  onPlaySong,
  onAddToQueue,
  queue = [],
  onSuggestionsLoaded
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const trackId = currentSong?.id || currentSong?.videoId || '';
  const trackTitle = currentSong?.title || '';
  const trackArtist = currentSong?.artist || currentSong?.channel || '';
  const trackGenre = currentSong?.genre || '';
  const trackMood = currentSong?.mood || '';
  const trackCategory = currentSong?.category || '';
  const trackType = currentSong?.songType || currentSong?.type || '';
  const trackMovie = currentSong?.movie || currentSong?.album || '';

  const fetchSuggestions = useCallback((forceRefresh = false) => {
    if (!trackId && !trackTitle) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const cacheKey = `${trackId}_${trackTitle}_${trackArtist}_${trackGenre}_${trackMood}_${trackCategory}_${trackMovie}`;
    if (!forceRefresh && suggestionsCache.has(cacheKey)) {
      const cachedList = suggestionsCache.get(cacheKey) || [];
      setSuggestions(cachedList);
      setLoading(false);
      setError(null);
      if (typeof onSuggestionsLoaded === 'function') {
        onSuggestionsLoaded(cachedList);
      }
      return;
    }

    // Cancel any in-flight request when track changes or retries
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      trackId,
      title: trackTitle,
      artist: trackArtist,
      genre: trackGenre
    });
    if (trackMood) params.set('mood', trackMood);
    if (trackCategory) params.set('category', trackCategory);
    if (trackType) params.set('songType', trackType);
    if (trackMovie) params.set('movie', trackMovie);
    if (forceRefresh) {
      params.set('refresh', 'true');
    }

    const endpointUrl = getApiUrl(`/api/recommendations/similar?${params.toString()}`);

    fetch(endpointUrl, { signal: abortController.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data && (Array.isArray(data.related) || Array.isArray(data.items))) {
          // Normalize current playing track properties for strict exclusion
          const currentId = String(trackId).toLowerCase().trim();
          const currentTitleLower = String(trackTitle).toLowerCase().trim();
          const cleanCurTitle = currentTitleLower.replace(/[^a-z0-9]/g, '');

          const seenIds = new Set();
          if (currentId) seenIds.add(currentId);
          const baseTitleVariantCounts = new Map();

          const sanitizeGroup = (rawList) => {
            const cleaned = [];
            for (const item of (rawList || [])) {
              const id = String(item.id || item.videoId || '').trim();
              if (!id || seenIds.has(id.toLowerCase())) continue;

              const itemTitleLower = String(item.title || '').toLowerCase().trim();
              const cleanItemTitle = itemTitleLower.replace(/[^a-z0-9]/g, '');

              // Exclude identical titles or duplicate uploads of the current song
              if (itemTitleLower === currentTitleLower) continue;
              if (cleanCurTitle.length >= 4 && cleanItemTitle === cleanCurTitle) continue;
              if (cleanCurTitle.length >= 4 && itemTitleLower.includes(currentTitleLower)) continue;

              // Deduplication & variant capping: Avoid flooding multiple versions/remixes of the same song
              const rootTitle = cleanItemTitle.slice(0, 15);
              if (rootTitle.length >= 4) {
                const count = baseTitleVariantCounts.get(rootTitle) || 0;
                if (count >= 1) continue;
              }

              const thumb = getCleanThumbnail(item, id);
              if (!isThumbnailUrlFormatValid(thumb)) continue;

              seenIds.add(id.toLowerCase());
              if (rootTitle.length >= 4) {
                baseTitleVariantCounts.set(rootTitle, (baseTitleVariantCounts.get(rootTitle) || 0) + 1);
              }
              cleaned.push({
                ...item,
                id,
                videoId: id,
                thumbnail: thumb
              });
            }
            return cleaned;
          };

          // Group 1: Exactly 5 songs related to currently playing song
          const rawRelated = data.related || (data.items || []).slice(0, 5);
          let validRelated = sanitizeGroup(rawRelated).slice(0, 5);

          // Group 2: Exactly 5 diverse Discover Mix songs (deduplicated against Group 1 and current track)
          const rawDiscover = data.discover || (data.items || []).slice(5);
          let validDiscover = sanitizeGroup(rawDiscover).slice(0, 5);

          // If either group has fewer than 5 items due to client-side thumbnail/title filtering,
          // backfill from any unused valid candidates in data.items to ensure exactly 10 songs whenever available
          if (validRelated.length + validDiscover.length < 10 && Array.isArray(data.items)) {
            const extraCandidates = sanitizeGroup(data.items);
            for (const candidate of extraCandidates) {
              if (validRelated.length < 5) {
                validRelated.push(candidate);
              } else if (validDiscover.length < 5) {
                validDiscover.push(candidate);
              }
              if (validRelated.length + validDiscover.length >= 10) break;
            }
          }

          // Progressive rendering: immediately publish validated suggestions
          const combined = [...validRelated, ...validDiscover];

          suggestionsCache.set(cacheKey, combined);
          setSuggestions(combined);
          setError(null);

          if (typeof onSuggestionsLoaded === 'function') {
            onSuggestionsLoaded(combined);
          }
        } else {
          setSuggestions([]);
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.warn('[SuggestedForYou] Failed to fetch suggestions:', err.message);
        setError('Failed to load suggestions');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [trackId, trackTitle, trackArtist, trackGenre, trackMood, trackCategory, trackType, trackMovie, onSuggestionsLoaded]);

  useEffect(() => {
    fetchSuggestions(false);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchSuggestions]);

  if (!currentSong) {
    return null;
  }

  return (
    <section
      aria-label="Suggested Songs"
      className="w-full mt-6 pt-5 border-t border-white/10 shrink-0 select-none pb-12 sm:pb-8"
    >
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
            Suggested Songs
          </h3>
          {loading && (
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {suggestions.length > 0 && !loading && (
            <span className="text-[10px] text-neutral-400 font-medium">
              {suggestions.length} tracks
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchSuggestions(true)}
            disabled={loading}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
            title="Refresh suggestions"
            aria-label="Refresh suggestions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Single vertical list - suggestions, one below another */}
      <div className="flex flex-col gap-2 w-full">
        {loading && suggestions.length === 0 ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-full p-2 rounded-xl bg-neutral-900/60 border border-white/5 animate-pulse flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-lg bg-neutral-800 shrink-0" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="w-3/4 h-3 bg-neutral-800 rounded" />
                <div className="w-1/2 h-2.5 bg-neutral-800/60 rounded" />
              </div>
              <div className="w-8 h-8 rounded-lg bg-neutral-800 shrink-0" />
            </div>
          ))
        ) : !loading && suggestions.length === 0 ? (
          <div className="w-full p-4 rounded-xl bg-neutral-900/40 border border-white/5 flex flex-col items-center justify-center text-center gap-2 my-1">
            <AlertCircle className="w-5 h-5 text-neutral-500" />
            <p className="text-xs text-neutral-400">
              {error ? 'Unable to load song suggestions' : 'No relevant suggestions available'}
            </p>
            <button
              type="button"
              onClick={() => fetchSuggestions(true)}
              className="mt-1 px-3 py-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition"
            >
              Try Again
            </button>
          </div>
        ) : (
          suggestions.map((song) => {
            const songId = song.id || song.videoId;
            const inQueue = queue.some((s) => (s.id || s.videoId) === songId);

            return (
              <div
                key={songId}
                onClick={() => onPlaySong && onPlaySong(song)}
                className="group relative w-full p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800/90 border border-white/5 hover:border-amber-500/40 transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md flex items-center gap-3 active:scale-[0.99]"
                title={`Play "${song.title}"`}
              >
                {/* Small square song artwork with overlay play button */}
                <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-neutral-800 shrink-0 border border-white/5 shadow-inner">
                  <img
                    src={song.thumbnail}
                    alt={song.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-4 h-4 text-amber-400 fill-current" />
                  </div>
                </div>

                {/* Song Title & Artist Name */}
                <div className="min-w-0 flex-1 pr-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h4 className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-amber-400 transition">
                      {song.title}
                    </h4>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DownloadTrackButton track={song} variant="badge" />
                    </div>
                  </div>
                  <p className="text-[11px] sm:text-xs text-neutral-400 truncate mt-0.5">
                    {song.artist || song.channel || 'Artist'}
                  </p>
                </div>

                {/* Action button: Add to Queue */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onAddToQueue) onAddToQueue(song, e);
                  }}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer shrink-0 border ${
                    inQueue
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white border-white/5 hover:border-white/10'
                  }`}
                  title={inQueue ? 'In Queue' : 'Add to Queue'}
                  aria-label={inQueue ? 'In Queue' : 'Add to Queue'}
                >
                  {inQueue ? (
                    <Check className="w-4 h-4 text-amber-400 stroke-[2.5]" />
                  ) : (
                    <Plus className="w-4 h-4 text-neutral-300 group-hover:text-amber-400" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
