import React, { useState, useEffect } from 'react';
import { Play, Plus, Check } from 'lucide-react';
import { getCleanThumbnail, isThumbnailUrlFormatValid } from '../../utils/thumbnailValidator';

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

  const trackId = currentSong?.id || currentSong?.videoId || '';
  const trackTitle = currentSong?.title || '';
  const trackArtist = currentSong?.artist || currentSong?.channel || '';
  const trackGenre = currentSong?.genre || '';

  useEffect(() => {
    if (!trackId && !trackTitle) {
      setSuggestions([]);
      return;
    }

    // 1. Check in-memory cache for instant zero-latency loading
    const cacheKey = `${trackId}_${trackTitle}_${trackArtist}`;
    if (suggestionsCache.has(cacheKey)) {
      const cachedList = suggestionsCache.get(cacheKey) || [];
      setSuggestions(cachedList);
      if (typeof onSuggestionsLoaded === 'function') {
        onSuggestionsLoaded(cachedList);
      }
      return;
    }

    let isMounted = true;
    setLoading(true);

    const params = new URLSearchParams({
      trackId,
      title: trackTitle,
      artist: trackArtist,
      genre: trackGenre
    });

    fetch(`/api/recommendations/similar?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data && (Array.isArray(data.related) || Array.isArray(data.items))) {
          // Normalize current playing track properties for strict exclusion
          const currentId = String(trackId).toLowerCase().trim();
          const currentTitleLower = String(trackTitle).toLowerCase().trim();
          const cleanCurTitle = currentTitleLower.replace(/[^a-z0-9]/g, '');

          const seenIds = new Set();
          if (currentId) seenIds.add(currentId);

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

              const thumb = getCleanThumbnail(item, id);
              if (!isThumbnailUrlFormatValid(thumb)) continue;

              seenIds.add(id.toLowerCase());
              cleaned.push({
                ...item,
                id,
                videoId: id,
                thumbnail: thumb
              });
            }
            return cleaned;
          };

          // Group 1: 5 songs related to currently playing song
          const rawRelated = data.related || (data.items || []).slice(0, 5);
          const validRelated = sanitizeGroup(rawRelated).slice(0, 5);

          // Group 2: 5 diverse Discover Mix songs (deduplicated against Group 1 and current track)
          const rawDiscover = data.discover || (data.items || []).slice(5);
          const validDiscover = sanitizeGroup(rawDiscover).slice(0, 5);

          // All 10 unique suggestions in one sequence: first 5 related, next 5 discover
          const combined10 = [...validRelated, ...validDiscover];

          suggestionsCache.set(cacheKey, combined10);
          setSuggestions(combined10);

          if (typeof onSuggestionsLoaded === 'function') {
            onSuggestionsLoaded(combined10);
          }
        } else {
          setSuggestions([]);
        }
      })
      .catch((err) => {
        console.warn('[SuggestedForYou] Failed to fetch suggestions:', err.message);
        if (isMounted) {
          setSuggestions([]);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [trackId, trackTitle, trackArtist, trackGenre]);

  if (!currentSong || (!loading && suggestions.length === 0)) {
    return null;
  }

  return (
    <section
      aria-label="Suggested Songs"
      className="w-full mt-6 pt-5 border-t border-white/10 shrink-0 select-none pb-12 sm:pb-8"
    >
      <div className="flex items-center justify-between px-1 mb-3">
        <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
          Suggested Songs
        </h3>
        {suggestions.length > 0 && (
          <span className="text-[10px] text-neutral-400 font-medium">
            {suggestions.length} tracks
          </span>
        )}
      </div>

      {/* Single vertical list - all 10 suggestions, one below another */}
      <div className="flex flex-col gap-2 w-full">
        {loading && suggestions.length === 0 ? (
          Array.from({ length: 10 }).map((_, i) => (
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
                  <h4 className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-amber-400 transition">
                    {song.title}
                  </h4>
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
