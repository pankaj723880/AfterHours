import React, { useState, useEffect, useCallback } from 'react';

const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffInSecs = Math.max(0, Math.floor((now.getTime() - past.getTime()) / 1000));

  if (diffInSecs < 60) return 'just now';
  const mins = Math.floor(diffInSecs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return past.toLocaleDateString();
};

export default function ActivityFeed({
  user = null,
  token = null,
  onPlaySong,
  onAddToQueue,
  onToggleFavorite,
  favorites = [],
  currentSong = null,
  isPlaying = false,
  backendUrl = ''
}) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // Privacy toggle state (defaults to false for opt-in privacy)
  const [shareListeningActivity, setShareListeningActivity] = useState(
    Boolean(user?.shareListeningActivity)
  );
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [privacySuccessMsg, setPrivacySuccessMsg] = useState(null);

  const cleanBase = (backendUrl || '').trim().replace(/\/+$/, '');

  // Keep local privacy state in sync if user object updates
  useEffect(() => {
    if (user?.shareListeningActivity !== undefined) {
      setShareListeningActivity(Boolean(user.shareListeningActivity));
    }
  }, [user?.shareListeningActivity]);

  // Fetch initial activity feed
  const fetchFeed = useCallback(async (cursor = null) => {
    if (cursor) {
      setIsPaginating(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const url = cursor
        ? `${cleanBase}/api/activity/feed?limit=15&before=${encodeURIComponent(cursor)}`
        : `${cleanBase}/api/activity/feed?limit=15`;

      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      let res = await fetch(url, { headers });
      if (!res.ok && cleanBase && (res.status === 404 || res.status >= 500)) {
        try {
          const fallbackUrl = cursor
            ? `/api/activity/feed?limit=15&before=${encodeURIComponent(cursor)}`
            : `/api/activity/feed?limit=15`;
          const fallbackRes = await fetch(fallbackUrl, { headers });
          if (fallbackRes.ok) res = fallbackRes;
        } catch (_) {}
      }
      if (!res.ok) {
        throw new Error(`Failed to load activities (${res.status})`);
      }

      const data = await res.json();
      const newItems = Array.isArray(data?.activities) ? data.activities : [];

      if (cursor) {
        setActivities((prev) => [...prev, ...newItems]);
      } else {
        setActivities(newItems);
      }

      setNextCursor(data?.nextCursor || null);
      setHasMore(Boolean(data?.hasMore));
    } catch (err) {
      console.error('ActivityFeed load error:', err);
      setError(err.message || 'Could not load activity feed.');
    } finally {
      setIsLoading(false);
      setIsPaginating(false);
    }
  }, [cleanBase, token]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Handle privacy setting change
  const handleTogglePrivacy = async () => {
    if (!token) {
      alert('Please log in to manage your activity privacy settings.');
      return;
    }

    const nextVal = !shareListeningActivity;
    setIsUpdatingPrivacy(true);
    setPrivacySuccessMsg(null);

    try {
      const res = await fetch(`${cleanBase}/api/activity/privacy`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ shareListeningActivity: nextVal })
      });

      if (!res.ok) {
        throw new Error('Failed to update privacy settings');
      }

      const data = await res.json();
      setShareListeningActivity(data.shareListeningActivity);
      setPrivacySuccessMsg(
        nextVal
          ? 'Listening activity sharing enabled!'
          : 'Listening activity is now private.'
      );
      setTimeout(() => setPrivacySuccessMsg(null), 3500);

      // Refresh feed
      fetchFeed();
    } catch (err) {
      console.error('Privacy update error:', err);
      alert(err.message || 'Error updating privacy setting');
    } finally {
      setIsUpdatingPrivacy(false);
    }
  };

  const isFav = (trackId) => {
    return favorites.some((f) => (f.id || f.videoId) === trackId);
  };

  const getActivityVerb = (type) => {
    switch (type) {
      case 'listen':
        return 'listened to';
      case 'like':
        return 'liked';
      case 'playlist_create':
        return 'created a playlist';
      case 'playlist_update':
        return 'updated a playlist';
      default:
        return 'played';
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'listen':
        return (
          <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        );
      case 'like':
        return (
          <span className="p-1 rounded-full bg-red-500/20 text-red-400">
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </span>
        );
      case 'playlist_create':
      case 'playlist_update':
        return (
          <span className="p-1 rounded-full bg-amber-500/20 text-amber-400">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Community & Friends • Live Stream
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-display bg-gradient-to-r from-white via-amber-200 to-amber-500 bg-clip-text text-transparent">
            Listening Activity
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            See what music other listeners and friends are discovering, streaming, and adding to their collections.
          </p>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={() => fetchFeed()}
          disabled={isLoading}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-amber-500/50 text-xs font-semibold text-neutral-300 hover:text-white transition-all cursor-pointer"
        >
          <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Privacy Opt-in Card */}
      {user && (
        <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/80 border border-amber-500/20 backdrop-blur-xl mb-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <span>Listening Activity Privacy</span>
                  {shareListeningActivity ? (
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Public (Opted-in)
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                      Private (Default)
                    </span>
                  )}
                </h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  {shareListeningActivity
                    ? 'Your music streams and likes are currently visible in the public activity feed. You can turn this off at any time.'
                    : 'Your listening activity is private by default and not broadcast to other users. Turn on to share what you listen to with the community.'}
                </p>
                {privacySuccessMsg && (
                  <p className="text-xs text-emerald-400 font-semibold mt-1.5 animate-in fade-in">
                    ✓ {privacySuccessMsg}
                  </p>
                )}
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              <span className="text-xs text-neutral-400">
                {shareListeningActivity ? 'Sharing' : 'Hidden'}
              </span>
              <button
                type="button"
                onClick={handleTogglePrivacy}
                disabled={isUpdatingPrivacy}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  shareListeningActivity ? 'bg-amber-500' : 'bg-neutral-800'
                } ${isUpdatingPrivacy ? 'opacity-50' : ''}`}
                role="switch"
                aria-checked={shareListeningActivity}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    shareListeningActivity ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activities Timeline */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full border-3 border-amber-500 border-t-transparent animate-spin mb-3" />
          <p className="text-xs font-mono text-neutral-400">Loading listening feed...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-950/30 border border-red-500/40 text-center my-6">
          <p className="text-red-300 text-sm mb-3">{error}</p>
          <button
            type="button"
            onClick={() => fetchFeed()}
            className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      ) : activities.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-neutral-900/50 border border-neutral-800 my-4">
          <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4 text-neutral-500">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h3 className="font-bold text-base text-white">No Public Activity Yet</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1 mb-4">
            Opt-in listeners will appear here as they stream, like songs, and curate playlists.
          </p>
          {user && !shareListeningActivity && (
            <button
              type="button"
              onClick={handleTogglePrivacy}
              className="px-4 py-2 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs hover:bg-amber-400 transition-colors"
            >
              Share My Activity First
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((act) => {
            const track = act.track;
            const playlist = act.playlist;
            const isCurrent = track && (currentSong?.id || currentSong?.videoId) === (track.id || track.videoId);

            return (
              <div
                key={act._id}
                className="p-3.5 sm:p-4 rounded-2xl bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all duration-200"
              >
                {/* Author row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    {/* User Avatar */}
                    {act.avatarUrl ? (
                      <img
                        src={act.avatarUrl}
                        alt={act.displayName || act.username}
                        className="w-8 h-8 rounded-full object-cover border border-amber-500/30"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xs font-bold text-neutral-950">
                        {(act.displayName || act.username || 'U')[0].toUpperCase()}
                      </div>
                    )}

                    <div className="text-xs">
                      <span className="font-bold text-white hover:text-amber-400 transition-colors">
                        {act.displayName || act.username || 'Listener'}
                      </span>
                      <span className="text-neutral-400 ml-1.5 font-normal">
                        {getActivityVerb(act.type)}
                      </span>
                    </div>

                    {getActivityIcon(act.type)}
                  </div>

                  <span className="text-[11px] font-mono text-neutral-500 shrink-0">
                    {formatTimeAgo(act.createdAt)}
                  </span>
                </div>

                {/* Track content card */}
                {track && (
                  <div
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-amber-500/10 border-amber-500/40'
                        : 'bg-neutral-950/60 border-neutral-800/80 hover:border-neutral-700'
                    }`}
                  >
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-neutral-800 shrink-0 group">
                      <img
                        src={track.albumArt || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=80'}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => onPlaySong && onPlaySong(track)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer text-amber-400"
                        title="Play"
                      >
                        {isCurrent && isPlaying ? (
                          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4
                        className={`text-xs sm:text-sm font-semibold truncate cursor-pointer hover:underline ${
                          isCurrent ? 'text-amber-300' : 'text-white'
                        }`}
                        onClick={() => onPlaySong && onPlaySong(track)}
                      >
                        {track.title}
                      </h4>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {track.artist}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {onAddToQueue && (
                        <button
                          type="button"
                          onClick={() => onAddToQueue(track)}
                          className="p-1.5 text-neutral-400 hover:text-amber-400 rounded-lg hover:bg-neutral-800 transition-colors"
                          title="Add to queue"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      )}

                      {onToggleFavorite && (
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(track)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isFav(track.id || track.videoId)
                              ? 'text-red-500 hover:text-red-400'
                              : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                          }`}
                          title={isFav(track.id || track.videoId) ? 'Remove favorite' : 'Add favorite'}
                        >
                          <svg
                            className="w-4 h-4 fill-current"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={isFav(track.id || track.videoId) ? 0 : 2}
                          >
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Playlist info card if playlist activity */}
                {playlist && !track && (
                  <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-white">
                        {playlist.name}
                      </h4>
                      {playlist.description && (
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {playlist.description}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                      Playlist
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Cursor Load More */}
          {hasMore && (
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={() => fetchFeed(nextCursor)}
                disabled={isPaginating}
                className="px-6 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-amber-500/50 text-xs font-bold text-neutral-200 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              >
                {isPaginating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                    <span>Loading more activities...</span>
                  </span>
                ) : (
                  <span>Load More Activity</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
