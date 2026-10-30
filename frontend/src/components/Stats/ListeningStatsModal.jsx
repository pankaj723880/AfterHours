import React, { useState, useEffect, useCallback, useRef } from 'react';
import { listeningStatsService } from '../../services/listeningStatsService';

export default function ListeningStatsModal({
  isOpen,
  onClose,
  showToast,
  authToken = null,
  user = null,
  backendUrl = ''
}) {
  const [activeTab, setActiveTab] = useState('recap'); // 'recap' | 'all-time'
  const [stats, setStats] = useState(null);
  const [weeklyRecap, setWeeklyRecap] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const isFetchingRef = useRef(false);

  const loadStats = useCallback(async (force = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const data = await listeningStatsService.fetchStats({
        backendUrl,
        token: authToken,
        user,
        forceRefresh: force
      });

      if (data) {
        setWeeklyRecap(data.weeklyRecap || null);
        setStats(data.allTimeStats || null);
        setLastUpdated(data.updatedAt ? new Date(data.updatedAt) : new Date());
      }
    } catch (err) {
      console.warn('[ListeningStatsModal] Refresh error:', err.message);
      setErrorMessage('Could not refresh latest stats. Showing last saved data.');
      if (showToast) showToast('Could not refresh stats right now');
    } finally {
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [backendUrl, authToken, user, showToast]);

  useEffect(() => {
    if (!isOpen) return;

    // Fast initial synchronous paint from local storage
    const local = listeningStatsService.computeLocalStats(user);
    if (local) {
      if (local.weeklyRecap) setWeeklyRecap(local.weeklyRecap);
      if (local.allTimeStats) setStats(local.allTimeStats);
      if (local.updatedAt) setLastUpdated(new Date(local.updatedAt));
    }

    // Immediately fetch fresh stats from backend
    loadStats(false);
  }, [isOpen, loadStats, user]);

  if (!isOpen) return null;

  const handleManualRefresh = () => {
    if (isRefreshing) return;
    loadStats(true);
  };

  const formatLastUpdated = (date) => {
    if (!date) return 'Just now';
    const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
    if (diffSec < 15) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleShare = () => {
    const summaryText = weeklyRecap
      ? `🎶 My Loopra Weekly Recap:\n⏱️ ${weeklyRecap.totalHours} hrs listened\n🎵 ${weeklyRecap.distinctTracksCount} distinct tracks\n⭐ Top track: ${weeklyRecap.topTracks[0]?.title || 'Various'}\nCheck out retro Bollywood on Loopra!`
      : `🎶 Listening on Loopra - Music & Bollywood Nostalgia without ads!`;

    if (navigator.share) {
      navigator.share({
        title: 'My Loopra Music Recap',
        text: summaryText,
        url: window.location.origin
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(summaryText);
      if (showToast) showToast('Recap summary copied to clipboard!');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white truncate">Listening Insights & Recap</h3>
                {user?.username && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 shrink-0">
                    @{user.username}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                <span>Real playback activity</span>
                {lastUpdated && (
                  <>
                    <span>•</span>
                    <span className="text-neutral-500">Updated {formatLastUpdated(lastUpdated)}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Manual Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Refresh Analytics"
              aria-label="Refresh listening statistics"
              className={`p-2 rounded-xl border border-neutral-700/80 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition flex items-center gap-1.5 text-xs font-medium cursor-pointer ${
                isRefreshing ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <svg
                className={`w-3.5 h-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Error Notice if Refresh Failed */}
        {errorMessage && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-amber-400 hover:text-amber-200 ml-2">✕</button>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="px-5 pt-3 pb-2 flex gap-2 border-b border-neutral-800/60 bg-neutral-950/40">
          <button
            onClick={() => setActiveTab('recap')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'recap'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            Weekly Recap
          </button>
          <button
            onClick={() => setActiveTab('all-time')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'all-time'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            All-Time Stats
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {activeTab === 'recap' ? (
            !weeklyRecap ? (
              <div className="py-16 text-center text-neutral-400 space-y-2">
                <span className="text-3xl">📊</span>
                <p className="font-semibold text-neutral-200">No recent activity this week</p>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                  Listen to songs for at least 30 seconds to generate your personalized weekly recap insights.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Visual Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl text-center">
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold">Hours</p>
                    <p className="text-xl font-bold font-display text-amber-400">{weeklyRecap.totalHours || '0.0'}h</p>
                  </div>
                  <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl text-center">
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold">Valid Plays</p>
                    <p className="text-xl font-bold font-display text-white">{weeklyRecap.totalPlays || 0}</p>
                  </div>
                  <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl text-center">
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold">Unique Tracks</p>
                    <p className="text-xl font-bold font-display text-white">{weeklyRecap.distinctTracksCount || 0}</p>
                  </div>
                  <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl text-center">
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold">Peak Day</p>
                    <p className="text-xl font-bold font-display text-amber-300">{weeklyRecap.peakDay || 'This Week'}</p>
                  </div>
                </div>

                {/* Top Tracks */}
                {weeklyRecap.topTracks && weeklyRecap.topTracks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Most-Played This Week</h4>
                    <div className="space-y-1.5">
                      {weeklyRecap.topTracks.map((t, i) => (
                        <div key={t.id || t.trackId || i} className="p-2.5 bg-neutral-950/40 border border-neutral-800/80 rounded-xl flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-5 text-center text-xs font-bold text-amber-500 shrink-0">{i + 1}</span>
                            {t.thumbnail && (
                              <img
                                src={t.thumbnail}
                                alt={t.title}
                                className="w-8 h-8 rounded-lg object-cover shrink-0 border border-neutral-800"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{t.title}</p>
                              <p className="text-[10px] text-neutral-400 truncate">{t.artist}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-neutral-400 shrink-0 bg-neutral-800/60 px-2 py-0.5 rounded-md">
                            {t.count} {t.count === 1 ? 'play' : 'plays'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Artists */}
                {weeklyRecap.topArtists && weeklyRecap.topArtists.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Top Artists</h4>
                    <div className="flex flex-wrap gap-2">
                      {weeklyRecap.topArtists.map(a => (
                        <div key={a.artist} className="px-3 py-1.5 bg-neutral-800/60 border border-neutral-700/60 rounded-xl flex items-center gap-2 text-xs">
                          <span className="font-semibold text-white">{a.artist}</span>
                          <span className="text-[10px] text-amber-400 font-mono">({a.count} {a.count === 1 ? 'play' : 'plays'})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            /* All-Time Stats View */
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl text-center">
                  <p className="text-[10px] text-neutral-500 uppercase font-semibold">Total Time</p>
                  <p className="text-xl font-bold font-display text-amber-400">{stats?.totalHours || '0.0'}h</p>
                </div>
                <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl text-center">
                  <p className="text-[10px] text-neutral-500 uppercase font-semibold">Total Plays</p>
                  <p className="text-xl font-bold font-display text-white">{stats?.totalPlays || 0}</p>
                </div>
                <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl text-center">
                  <p className="text-[10px] text-neutral-500 uppercase font-semibold">Unique Songs</p>
                  <p className="text-xl font-bold font-display text-white">{stats?.distinctTracksCount || 0}</p>
                </div>
              </div>

              {/* Secondary Metrics */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-neutral-950/40 border border-neutral-800/80 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold">Unique Artists</p>
                    <p className="text-base font-bold text-neutral-200">{stats?.distinctArtistsCount || 0}</p>
                  </div>
                  <span className="text-xl">🎙️</span>
                </div>
                <div className="p-3 bg-neutral-950/40 border border-neutral-800/80 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold">Longest Session</p>
                    <p className="text-base font-bold text-amber-300">{stats?.longestSessionFormatted || '0m'}</p>
                  </div>
                  <span className="text-xl">⏱️</span>
                </div>
              </div>

              {/* Listening Activity Over Time */}
              {stats?.activityOverTime && stats.activityOverTime.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Recent Listening Activity</h4>
                  <div className="p-3 bg-neutral-950/50 border border-neutral-800 rounded-2xl flex items-end justify-between gap-1.5 h-24">
                    {stats.activityOverTime.map((d) => {
                      const maxSec = Math.max(...stats.activityOverTime.map(x => x.seconds), 1);
                      const heightPct = Math.max(12, Math.round((d.seconds / maxSec) * 100));
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-amber-600 to-amber-400 transition-all duration-300"
                            title={`${d.dayLabel}: ${Math.round(d.seconds / 60)} mins (${d.plays} plays)`}
                          />
                          <span className="text-[9px] text-neutral-400 font-mono truncate">{d.dayLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top Tracks All-Time */}
              {stats?.topTracks && stats.topTracks.length > 0 ? (
                <div>
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">All-Time Favorites</h4>
                  <div className="space-y-1.5">
                    {stats.topTracks.slice(0, 8).map((t, i) => (
                      <div key={t.id || t.trackId || i} className="p-2.5 bg-neutral-950/40 border border-neutral-800/80 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 text-center text-xs font-bold text-amber-500 shrink-0">{i + 1}</span>
                          {t.thumbnail && (
                            <img
                              src={t.thumbnail}
                              alt={t.title}
                              className="w-8 h-8 rounded-lg object-cover shrink-0 border border-neutral-800"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{t.title}</p>
                            <p className="text-[10px] text-neutral-400 truncate">{t.artist}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-400 shrink-0 bg-neutral-800/60 px-2 py-0.5 rounded-md">
                          {t.count} {t.count === 1 ? 'play' : 'plays'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-neutral-500 text-xs">
                  No lifetime tracks recorded yet. Start listening to build your all-time library stats!
                </div>
              )}

              {/* Top Artists All-Time */}
              {stats?.topArtists && stats.topArtists.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">All-Time Top Artists</h4>
                  <div className="flex flex-wrap gap-2">
                    {stats.topArtists.map(a => (
                      <div key={a.artist} className="px-3 py-1.5 bg-neutral-800/60 border border-neutral-700/60 rounded-xl flex items-center gap-2 text-xs">
                        <span className="font-semibold text-white">{a.artist}</span>
                        <span className="text-[10px] text-amber-400 font-mono">({a.count} {a.count === 1 ? 'play' : 'plays'})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={handleShare}
            className="px-4 py-2 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-xs border border-amber-500/40 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>📤</span>
            <span>Share Summary</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
