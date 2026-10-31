import React, { useState, useEffect, useCallback, useRef } from 'react';
import { recommendationsClient } from '../../services/recommendationsClient';
import { TrackDeduplicator } from '../../utils/trackIdentity';
import { getCleanThumbnail, isThumbnailUrlFormatValid } from '../../utils/thumbnailValidator';

// Track-level runtime failed image cache for graceful component fallbacks
const locallyFailedVideoIds = new Set();

export default function PersonalizedRecommendationsSection({
  backendUrl,
  authToken,
  user,
  onPlayTrack,
  onOpenAuth,
  onToggleLike,
  isLiked,
  onAddToPlaylist,
  showToast,
  onTracksRendered
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [recommendationsEnabled, setRecommendationsEnabled] = useState(true);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const backupPoolRef = useRef([]);

  // Filter helper to ensure tracks have clean, valid, non-placeholder thumbnails
  const sanitizeThumbnailTracks = useCallback((tracks = []) => {
    if (!Array.isArray(tracks)) return [];
    const valid = [];
    for (const t of tracks) {
      if (!t) continue;
      const cleanThumb = getCleanThumbnail(t);
      if (cleanThumb && isThumbnailUrlFormatValid(cleanThumb)) {
        valid.push({
          ...t,
          thumbnail: cleanThumb
        });
      }
    }
    return valid;
  }, []);

  // Proactively fetches extra discovery candidates to guarantee valid replacements are ready
  const refillBackupPool = useCallback(async (existingTracks = []) => {
    try {
      const res = await recommendationsClient.getDiscover(backendUrl, authToken || null, { limit: 30 });
      const raw = res?.items || [];
      const valid = sanitizeThumbnailTracks(raw);
      const dedup = new TrackDeduplicator();
      existingTracks.forEach(t => dedup.add(t));

      const fresh = [];
      for (const t of valid) {
        if (!dedup.isDuplicate(t)) {
          dedup.add(t);
          fresh.push(t);
        }
      }
      backupPoolRef.current = fresh;
    } catch (e) {
      // Graceful fallback
    }
  }, [backendUrl, authToken, sanitizeThumbnailTracks]);

  const fetchRecommendations = useCallback(async (isRefresh = false) => {
    if (!authToken) {
      // Unauthenticated: fetch general discovery tracks with strictly disjoint pools
      try {
        setLoading(true);
        const res = await recommendationsClient.getDiscover(backendUrl, null, { limit: 35 });
        const items = sanitizeThumbnailTracks(res.items || []);
        const deduplicator = new TrackDeduplicator();

        const madeForYou = [];
        const dailyMix = [];
        const discover = [];
        const extras = [];

        for (const t of items) {
          if (deduplicator.isDuplicate(t)) continue;
          deduplicator.add(t);

          if (madeForYou.length < 6) {
            madeForYou.push(t);
          } else if (dailyMix.length < 5) {
            dailyMix.push(t);
          } else if (discover.length < 5) {
            discover.push(t);
          } else {
            extras.push(t);
          }
        }

        backupPoolRef.current = extras;

        const formatted = {
          madeForYou,
          dailyMix,
          discover,
          isGuest: true
        };

        setData(formatted);
        onTracksRendered?.([...madeForYou, ...dailyMix, ...discover]);
        setError(null);
      } catch (err) {
        setError('Failed to load music suggestions');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await recommendationsClient.getPersonalized(backendUrl, authToken, isRefresh);
      if (res?.data) {
        const rawData = res.data;
        const deduplicator = new TrackDeduplicator();

        const madeForYou = deduplicator.filterUnique(sanitizeThumbnailTracks(rawData.madeForYou || [])).slice(0, 6);

        let becauseYouListenedTo = null;
        if (rawData.becauseYouListenedTo && typeof rawData.becauseYouListenedTo === 'object') {
          const rawBase = rawData.becauseYouListenedTo.baseTrack;
          const cleanBaseThumb = getCleanThumbnail(rawBase);
          const rawRecs = sanitizeThumbnailTracks(rawData.becauseYouListenedTo.recommendations || []);
          const becauseRecs = deduplicator.filterUnique(rawRecs).slice(0, 4);

          if (becauseRecs.length > 0 && cleanBaseThumb && isThumbnailUrlFormatValid(cleanBaseThumb)) {
            becauseYouListenedTo = {
              baseTrack: {
                ...rawBase,
                thumbnail: cleanBaseThumb
              },
              recommendations: becauseRecs
            };
          }
        }

        const dailyMix = deduplicator.filterUnique(sanitizeThumbnailTracks(rawData.dailyMix || [])).slice(0, 6);
        const favouriteArtists = deduplicator.filterUnique(sanitizeThumbnailTracks(rawData.favouriteArtists || [])).slice(0, 6);
        const discover = deduplicator.filterUnique(sanitizeThumbnailTracks(rawData.discover || [])).slice(0, 6);
        const moreLikeRecent = deduplicator.filterUnique(sanitizeThumbnailTracks(rawData.moreLikeRecent || [])).slice(0, 4);

        const allRendered = [
          ...madeForYou,
          ...(becauseYouListenedTo?.recommendations || []),
          ...dailyMix,
          ...favouriteArtists,
          ...discover,
          ...moreLikeRecent
        ];

        const formatted = {
          ...rawData,
          madeForYou,
          becauseYouListenedTo,
          dailyMix,
          favouriteArtists,
          discover,
          moreLikeRecent
        };

        setData(formatted);
        onTracksRendered?.(allRendered);

        if (typeof rawData.recommendationsEnabled === 'boolean') {
          setRecommendationsEnabled(rawData.recommendationsEnabled);
        }
        setError(null);

        // Pre-fill backup pool with extra discovery songs
        refillBackupPool(allRendered);
      }
    } catch (err) {
      console.warn('[PersonalizedRecommendations] Notice:', err.message);
      setError(err.message || 'Unable to load personalized recommendations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [backendUrl, authToken, onTracksRendered, sanitizeThumbnailTracks, refillBackupPool]);

  useEffect(() => {
    fetchRecommendations(false);
  }, [fetchRecommendations]);

  const handleManualRefresh = async () => {
    if (!authToken) {
      onOpenAuth?.();
      return;
    }
    try {
      setRefreshing(true);
      const res = await recommendationsClient.refreshRecommendations(backendUrl, authToken);
      if (res?.data) {
        const rawData = res.data;
        const deduplicator = new TrackDeduplicator();

        const madeForYou = deduplicator.filterUnique(sanitizeThumbnailTracks(rawData.madeForYou || [])).slice(0, 6);

        let becauseYouListenedTo = null;
        if (rawData.becauseYouListenedTo && typeof rawData.becauseYouListenedTo === 'object') {
          const rawBase = rawData.becauseYouListenedTo.baseTrack;
          const cleanBaseThumb = getCleanThumbnail(rawBase);
          const rawRecs = sanitizeThumbnailTracks(rawData.becauseYouListenedTo.recommendations || []);
          const becauseRecs = deduplicator.filterUnique(rawRecs).slice(0, 4);

          if (becauseRecs.length > 0 && cleanBaseThumb && isThumbnailUrlFormatValid(cleanBaseThumb)) {
            becauseYouListenedTo = {
              baseTrack: {
                ...rawBase,
                thumbnail: cleanBaseThumb
              },
              recommendations: becauseRecs
            };
          }
        }

        const dailyMix = deduplicator.filterUnique(sanitizeThumbnailTracks(rawData.dailyMix || [])).slice(0, 6);
        const favouriteArtists = deduplicator.filterUnique(sanitizeThumbnailTracks(rawData.favouriteArtists || [])).slice(0, 6);
        const discover = deduplicator.filterUnique(sanitizeThumbnailTracks(rawData.discover || [])).slice(0, 6);
        const moreLikeRecent = deduplicator.filterUnique(sanitizeThumbnailTracks(rawData.moreLikeRecent || [])).slice(0, 4);

        const allRendered = [
          ...madeForYou,
          ...(becauseYouListenedTo?.recommendations || []),
          ...dailyMix,
          ...favouriteArtists,
          ...discover,
          ...moreLikeRecent
        ];

        const formatted = {
          ...rawData,
          madeForYou,
          becauseYouListenedTo,
          dailyMix,
          favouriteArtists,
          discover,
          moreLikeRecent
        };

        setData(formatted);
        onTracksRendered?.(allRendered);
        refillBackupPool(allRendered);
        showToast?.('Fresh recommendations curated by Gemini AI');
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Post-Render Image Failure Handler:
   * When an image fails to load in the browser, immediately discard the candidate
   * from the carousel, pull a valid replacement from backupPoolRef that satisfies
   * BOTH: 1) Valid, usable thumbnail, and 2) Zero duplicate across all homepage sections.
   */
  const handleTrackImageFailure = useCallback((failedTrack, sectionKey) => {
    const failedId = failedTrack?.id || failedTrack?.videoId;
    if (!failedId || !sectionKey) return;
    locallyFailedVideoIds.add(failedId);

    setData(prev => {
      if (!prev) return prev;

      if (sectionKey === 'becauseYouListenedTo') {
        // If baseTrack image failed, discard whole becauseYouListenedTo section
        if ((prev.becauseYouListenedTo?.baseTrack?.id || prev.becauseYouListenedTo?.baseTrack?.videoId) === failedId) {
          return { ...prev, becauseYouListenedTo: null };
        }
        // If one of the recommendations failed, filter it out
        const curRecs = prev.becauseYouListenedTo?.recommendations || [];
        const filtered = curRecs.filter(t => (t.id || t.videoId) !== failedId);
        return {
          ...prev,
          becauseYouListenedTo: filtered.length > 0 ? { ...prev.becauseYouListenedTo, recommendations: filtered } : null
        };
      }

      const currentSection = prev[sectionKey];
      if (!Array.isArray(currentSection)) return prev;

      // Discard failed track
      const updatedSection = currentSection.filter(t => (t.id || t.videoId) !== failedId);

      // Build active deduplicator with all currently rendered songs across all sections
      const activeDeduplicator = new TrackDeduplicator();
      ['madeForYou', 'dailyMix', 'favouriteArtists', 'discover', 'moreLikeRecent'].forEach(k => {
        if (Array.isArray(prev[k])) {
          prev[k].forEach(item => {
            if ((item.id || item.videoId) !== failedId) {
              activeDeduplicator.add(item);
            }
          });
        }
      });
      if (prev.becauseYouListenedTo?.recommendations) {
        prev.becauseYouListenedTo.recommendations.forEach(item => {
          if ((item.id || item.videoId) !== failedId) {
            activeDeduplicator.add(item);
          }
        });
      }

      // Find replacement candidate from backup pool
      let replacement = null;
      const remainingBackup = [];
      for (const candidate of backupPoolRef.current) {
        if (!replacement && !activeDeduplicator.isDuplicate(candidate) && isThumbnailUrlFormatValid(candidate.thumbnail)) {
          replacement = candidate;
          activeDeduplicator.add(candidate);
        } else {
          remainingBackup.push(candidate);
        }
      }
      backupPoolRef.current = remainingBackup;

      if (replacement) {
        updatedSection.push(replacement);
      }

      const updatedData = {
        ...prev,
        [sectionKey]: updatedSection
      };

      onTracksRendered?.([
        ...(updatedData.madeForYou || []),
        ...(updatedData.becauseYouListenedTo?.recommendations || []),
        ...(updatedData.dailyMix || []),
        ...(updatedData.favouriteArtists || []),
        ...(updatedData.discover || []),
        ...(updatedData.moreLikeRecent || [])
      ]);

      return updatedData;
    });
  }, [onTracksRendered]);

  const handleTogglePrivacy = async (enabled) => {
    if (!authToken) return;
    try {
      setRecommendationsEnabled(enabled);
      await recommendationsClient.updatePreferences(backendUrl, authToken, {
        recommendationsEnabled: enabled
      });
      showToast?.(enabled ? 'Personalized recommendations enabled' : 'Personalization disabled');
      fetchRecommendations(false);
    } catch (err) {
      showToast?.('Failed to update privacy preferences');
    }
  };

  // Helper track renderer
  const renderTrackCard = (track, idx, sectionKey) => {
    if (!track) return null;
    const trackLiked = isLiked?.(track);
    const trackId = track.id || track.videoId;
    const thumbnail = getCleanThumbnail(track, trackId);
    if (!thumbnail || !isThumbnailUrlFormatValid(thumbnail)) {
      return null;
    }

    // Ensure clean, verified artist - eliminate "Unknown Artist" when channel or metadata exists
    let cleanArtist = track.artist;
    if (!cleanArtist || cleanArtist === 'Unknown Artist' || cleanArtist === 'Various Artists' || cleanArtist === 'Unknown') {
      cleanArtist = track.channel || 'Loopra Artist';
    }

    const playableTrack = {
      ...track,
      id: trackId,
      videoId: trackId,
      title: track.title,
      artist: cleanArtist,
      channel: track.channel || cleanArtist,
      thumbnail
    };

    return (
      <div
        key={`${trackId || idx}-${idx}`}
        onClick={() => onPlayTrack(playableTrack)}
        className="group relative flex flex-col shrink-0 w-36 sm:w-44 md:w-48 bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-800/80 hover:border-amber-500/40 rounded-2xl p-2.5 sm:p-3 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10 cursor-pointer select-none"
      >
        <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2 sm:mb-2.5 bg-neutral-950">
          <img
            src={thumbnail}
            alt={track.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onLoad={(e) => {
              const target = e.currentTarget;
              const w = target.naturalWidth;
              const h = target.naturalHeight;
              if (w <= 1 || h <= 1 || (w === 120 && h === 90)) {
                handleTrackImageFailure(track, sectionKey);
              }
            }}
            onError={(e) => {
              const target = e.currentTarget;
              const attempts = parseInt(target.dataset.attempts || '0', 10);
              if (attempts === 0 && trackId && !target.src.includes('mqdefault') && !locallyFailedVideoIds.has(trackId)) {
                target.dataset.attempts = '1';
                target.src = `https://i.ytimg.com/vi/${trackId}/mqdefault.jpg`;
              } else {
                target.onerror = null;
                handleTrackImageFailure(track, sectionKey);
              }
            }}
          />
          {/* Subtle Reason Pill */}
          {track.reason && (
            <div className="absolute top-1.5 left-1.5 right-1.5 pointer-events-none">
              <span className="inline-block max-w-full truncate text-[9px] font-semibold text-amber-200 bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-amber-500/30">
                {track.reason}
              </span>
            </div>
          )}

          {/* Quick Play Action Overlay */}
          <div className="absolute inset-0 bg-neutral-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-lg shadow-amber-500/40 transform scale-90 group-hover:scale-100 transition">
              <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Title & Artist */}
        <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-400 transition" title={track.title}>
          {track.title}
        </h4>
        <p className="text-[11px] sm:text-xs text-neutral-400 truncate mt-0.5" title={cleanArtist}>
          {cleanArtist}
        </p>

        {/* Action icons bar on card */}
        <div className="mt-2 pt-2 border-t border-neutral-800/60 flex items-center justify-between opacity-80 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike?.(playableTrack);
            }}
            className={`p-1 rounded-lg transition ${
              trackLiked ? 'text-amber-400 hover:text-amber-300' : 'text-neutral-500 hover:text-white'
            }`}
            title={trackLiked ? 'Remove from favourites' : 'Add to favourites'}
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>

          {onAddToPlaylist && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToPlaylist(playableTrack, e);
              }}
              className="p-1 rounded-lg text-neutral-500 hover:text-white transition"
              title="Add to playlist"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render Horizontal Row of Tracks
  const renderRow = (title, subtitle, items = [], sectionKey) => {
    if (!items || items.length === 0) return null;

    return (
      <div className="space-y-2.5 sm:space-y-3.5">
        <div className="flex items-end justify-between px-1">
          <div className="min-w-0 pr-2">
            <h3 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2 truncate">
              <span>{title}</span>
            </h3>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5 line-clamp-1">{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (items[0]) onPlayTrack(items[0]);
            }}
            className="text-[11px] sm:text-xs font-semibold text-neutral-400 hover:text-white flex items-center gap-0.5 shrink-0 transition-colors"
          >
            <span>View All</span>
            <span className="text-neutral-500 font-bold">&gt;</span>
          </button>
        </div>

        <div className="flex items-stretch gap-2.5 sm:gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          {items.map((track, i) => renderTrackCard(track, i, sectionKey))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="rounded-3xl p-4 sm:p-6 bg-neutral-900/40 border border-neutral-800/80 backdrop-blur-xl animate-pulse">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-xl bg-neutral-800" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-neutral-800 rounded w-1/3" />
            <div className="h-3 bg-neutral-800/60 rounded w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="aspect-square bg-neutral-800/50 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-3xl p-6 bg-neutral-900/50 border border-red-500/20 text-center">
        <p className="text-xs sm:text-sm text-red-400 mb-3">{error}</p>
        <button
          onClick={() => fetchRecommendations(true)}
          className="px-4 py-2 text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition cursor-pointer"
        >
          Retry Loading Recommendations
        </button>
      </div>
    );
  }

  const isGeminiPowered = data?.source === 'gemini';
  const isNewUser = Boolean(data?.isNewUser || data?.isGuest);

  return (
    <section className="relative rounded-3xl p-4 sm:p-6 md:p-8 bg-gradient-to-b from-neutral-900/90 via-neutral-900/60 to-neutral-950/90 border border-amber-500/25 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl space-y-6 sm:space-y-8 overflow-hidden">
      {/* Background ambient warm bloom */}
      <div className="absolute top-0 right-10 w-96 h-96 rounded-full bg-amber-500/8 blur-[100px] pointer-events-none" />

      {/* Header Banner */}
      <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-6 border-b border-neutral-800/80 pb-4 sm:pb-6">
        <div className="flex-1 min-w-0 pr-2">
          {/* Header Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/35 text-amber-300 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_#f59e0b]" />
              <span>PERSONALIZED AI LOUNGE</span>
            </span>

            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-neutral-900 border border-neutral-800 text-neutral-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              <span>{data?.insights?.dominantMood || 'Melodic & Nostalgic'}</span>
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
            Curated Just For You
          </h2>

          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-xl line-clamp-2 leading-relaxed">
            {data?.insights?.summary || (isNewUser
              ? 'Crafted around your affinity for curated favorites and fresh listening explorations.'
              : 'Crafted around your affinity for live streams, curated favorites and nostalgic melodies.')}
          </p>

          {/* Control Actions (Refresh & Privacy) */}
          <div className="flex items-center gap-2 mt-3.5">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="px-3.5 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700/80 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
              title="Refresh recommendations"
            >
              <svg className={`w-3.5 h-3.5 text-amber-400 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>{refreshing ? 'Curating...' : 'Refresh Mix'}</span>
            </button>

            <button
              onClick={() => setShowPrivacySettings(!showPrivacySettings)}
              className="p-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700/80 text-xs transition cursor-pointer shadow-sm"
              title="Recommendation Privacy"
            >
              <svg className="w-4 h-4 text-neutral-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </button>
          </div>
        </div>

        {/* 3D Golden Headphones Visual Graphic on Right */}
        <div className="relative shrink-0 w-24 sm:w-32 md:w-36 h-24 sm:h-32 flex items-center justify-center select-none pointer-events-none">
          <div className="absolute inset-0 bg-amber-500/15 rounded-full blur-xl" />
          <svg className="w-20 h-20 sm:w-28 sm:h-28 drop-shadow-[0_10px_20px_rgba(245,158,11,0.35)]" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="goldHeadband" x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="35%" stopColor="#FDE68A" />
                <stop offset="70%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
              <linearGradient id="goldCup" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="50%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#92400E" />
              </linearGradient>
            </defs>
            {/* Outer Headband */}
            <path d="M45 110 C45 50, 155 50, 155 110" stroke="url(#goldHeadband)" strokeWidth="14" strokeLinecap="round" />
            <path d="M52 105 C52 60, 148 60, 148 105" stroke="#171717" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
            {/* Left Ear Cup */}
            <g transform="rotate(-15 45 125)">
              <rect x="25" y="95" width="28" height="55" rx="14" fill="url(#goldCup)" stroke="#FDE68A" strokeWidth="2" />
              <rect x="30" y="102" width="18" height="41" rx="9" fill="#1C1917" />
              <circle cx="39" cy="122" r="4" fill="#F59E0B" />
            </g>
            {/* Right Ear Cup */}
            <g transform="rotate(15 155 125)">
              <rect x="147" y="95" width="28" height="55" rx="14" fill="url(#goldCup)" stroke="#FDE68A" strokeWidth="2" />
              <rect x="152" y="102" width="18" height="41" rx="9" fill="#1C1917" />
              <circle cx="161" cy="122" r="4" fill="#F59E0B" />
            </g>
          </svg>
        </div>
      </div>

      {/* Privacy Settings Accordion */}
      {showPrivacySettings && (
        <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 text-xs space-y-3 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-white">Personalized Recommendations</h4>
              <p className="text-neutral-400 text-[11px] mt-0.5">
                When enabled, your listening history and preferences are used to curate your AI mix.
              </p>
            </div>
            <button
              onClick={() => handleTogglePrivacy(!recommendationsEnabled)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                recommendationsEnabled ? 'bg-amber-500 text-neutral-950' : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {recommendationsEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          <p className="text-[10px] text-neutral-500">
            Loopra never shares your listening profile or personal data with other users or public feeds.
          </p>
        </div>
      )}

      {/* Recommendation Rows */}
      <div className="space-y-6 sm:space-y-8">
        {/* Row 1: Made For You */}
        {renderRow(
          'Made For You',
          'Handpicked matching your overall music affinity and mood',
          data?.madeForYou,
          'madeForYou'
        )}

        {/* Row 2: Because You Listened To */}
        {data?.becauseYouListenedTo?.baseTrack && (
          renderRow(
            `Because You Listened To "${data.becauseYouListenedTo.baseTrack.title}"`,
            `Songs sharing the same soulful tempo and vibe as ${data.becauseYouListenedTo.baseTrack.artist}`,
            data.becauseYouListenedTo.recommendations,
            'becauseYouListenedTo'
          )
        )}

        {/* Row 3: Your Daily Mix */}
        {renderRow(
          'Your Daily Mix',
          'A cohesive, uninterrupted flow of your favorite genres',
          data?.dailyMix,
          'dailyMix'
        )}

        {/* Row 4: Your Favourite Artists */}
        {data?.favouriteArtists && data.favouriteArtists.length > 0 && (
          renderRow(
            'Your Favourite Artists',
            'Selected songs from the singers you play the most',
            data.favouriteArtists,
            'favouriteArtists'
          )
        )}

        {/* Row 5: Discover Your Next Favourite */}
        {renderRow(
          'Discover Your Next Favourite',
          'Broaden your taste with tracks adjacent to what you love',
          data?.discover,
          'discover'
        )}

        {/* Row 6: More Like Your Recent Plays */}
        {data?.moreLikeRecent && data.moreLikeRecent.length > 0 && (
          renderRow(
            'More Like Your Recent Plays',
            'Fresh tunes that vibe with your recent listening session',
            data.moreLikeRecent,
            'moreLikeRecent'
          )
        )}
      </div>
    </section>
  );
}

