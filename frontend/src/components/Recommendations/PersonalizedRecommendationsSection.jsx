import React, { useState, useEffect, useCallback } from 'react';
import { recommendationsClient } from '../../services/recommendationsClient';

export default function PersonalizedRecommendationsSection({
  backendUrl,
  authToken,
  user,
  onPlayTrack,
  onOpenAuth,
  onToggleLike,
  isLiked,
  onAddToPlaylist,
  showToast
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [recommendationsEnabled, setRecommendationsEnabled] = useState(true);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);

  const fetchRecommendations = useCallback(async (isRefresh = false) => {
    if (!authToken) {
      // Unauthenticated: fetch general discovery tracks with strictly disjoint Daily Mix and Discover
      try {
        setLoading(true);
        const res = await recommendationsClient.getDiscover(backendUrl);
        const items = res.items || [];
        const dailyMix = items.slice(0, 5);
        const dailyMixIds = new Set(dailyMix.map(t => t.id || t.videoId));
        const discover = items.slice(5).filter(t => !dailyMixIds.has(t.id || t.videoId)).slice(0, 5);

        setData({
          madeForYou: items.slice(0, 6),
          dailyMix,
          discover,
          isGuest: true
        });
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
        const dailyMix = rawData.dailyMix || [];
        const dailyMixIds = new Set(dailyMix.map(t => t.id || t.videoId));
        const dailyMixTitles = new Set(dailyMix.map(t => (t.title || '').toLowerCase().trim()));

        // Client-side cross-section deduplication guarantee
        const distinctDiscover = (rawData.discover || []).filter(t => {
          const id = t.id || t.videoId;
          const title = (t.title || '').toLowerCase().trim();
          return id && !dailyMixIds.has(id) && !dailyMixTitles.has(title);
        });

        setData({
          ...rawData,
          dailyMix,
          discover: distinctDiscover
        });

        if (typeof rawData.recommendationsEnabled === 'boolean') {
          setRecommendationsEnabled(rawData.recommendationsEnabled);
        }
        setError(null);
      }
    } catch (err) {
      console.warn('[PersonalizedRecommendations] Notice:', err.message);
      setError(err.message || 'Unable to load personalized recommendations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [backendUrl, authToken]);

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
        setData(res.data);
        showToast?.('Fresh recommendations curated by Gemini AI');
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

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
  const renderTrackCard = (track, idx) => {
    if (!track) return null;
    const trackLiked = isLiked?.(track);
    const trackId = track.id || track.videoId;
    const thumbnail = track.thumbnail || `https://i.ytimg.com/vi/${trackId}/hqdefault.jpg`;

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
            onError={(e) => {
              if (!e.target.src.includes('hqdefault')) {
                e.target.src = `https://i.ytimg.com/vi/${trackId}/hqdefault.jpg`;
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
  const renderRow = (title, subtitle, items = []) => {
    if (!items || items.length === 0) return null;

    return (
      <div className="space-y-2.5 sm:space-y-3.5">
        <div className="flex items-baseline justify-between px-1">
          <div>
            <h3 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>{title}</span>
            </h3>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          {items.map((track, i) => renderTrackCard(track, i))}
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
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-neutral-800/80 pb-4 sm:pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-1.5 shadow-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
              </span>
              {isGeminiPowered ? 'Gemini 3.8 Flash AI' : 'Personalized AI Lounge'}
            </span>

            {data?.insights?.dominantMood && (
              <span className="text-[11px] text-neutral-400 font-medium">
                • {data.insights.dominantMood}
              </span>
            )}
          </div>

          <h1 className="text-lg sm:text-2xl font-display font-black text-white tracking-tight">
            {isNewUser ? 'Discover Fresh Sounds' : 'Curated Just For You'}
          </h1>

          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl">
            {data?.insights?.summary || (isNewUser
              ? 'Start listening to songs to let Gemini AI learn your unique music taste.'
              : 'Tuned continuously based on your listening sessions, favorites, and skips.')}
          </p>
        </div>

        {/* Control Actions (Refresh & Privacy) */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {authToken && (
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Refresh recommendations"
            >
              <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>{refreshing ? 'Curating...' : 'Refresh Mix'}</span>
            </button>
          )}

          {authToken && (
            <button
              onClick={() => setShowPrivacySettings(!showPrivacySettings)}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs transition cursor-pointer"
              title="Recommendation Privacy"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </button>
          )}

          {!authToken && (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-md cursor-pointer"
            >
              Sign In For AI Personalization
            </button>
          )}
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
          data?.madeForYou
        )}

        {/* Row 2: Because You Listened To */}
        {data?.becauseYouListenedTo?.baseTrack && (
          renderRow(
            `Because You Listened To "${data.becauseYouListenedTo.baseTrack.title}"`,
            `Songs sharing the same soulful tempo and vibe as ${data.becauseYouListenedTo.baseTrack.artist}`,
            data.becauseYouListenedTo.recommendations
          )
        )}

        {/* Row 3: Your Daily Mix */}
        {renderRow(
          'Your Daily Mix',
          'A cohesive, uninterrupted flow of your favorite genres',
          data?.dailyMix
        )}

        {/* Row 4: Your Favourite Artists */}
        {data?.favouriteArtists && data.favouriteArtists.length > 0 && (
          renderRow(
            'Your Favourite Artists',
            'Selected songs from the singers you play the most',
            data.favouriteArtists
          )
        )}

        {/* Row 5: Discover Your Next Favourite */}
        {renderRow(
          'Discover Your Next Favourite',
          'Broaden your taste with tracks adjacent to what you love',
          data?.discover
        )}

        {/* Row 6: More Like Your Recent Plays */}
        {data?.moreLikeRecent && data.moreLikeRecent.length > 0 && (
          renderRow(
            'More Like Your Recent Plays',
            'Fresh tunes that vibe with your recent listening session',
            data.moreLikeRecent
          )
        )}
      </div>
    </section>
  );
}

