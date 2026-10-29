import React, { useState, useEffect } from 'react';
import { listeningStatsService } from '../../services/listeningStatsService';

export default function ListeningStatsModal({ isOpen, onClose, showToast }) {
  const [activeTab, setActiveTab] = useState('recap'); // 'recap' | 'all-time'
  const [stats, setStats] = useState(null);
  const [weeklyRecap, setWeeklyRecap] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setStats(listeningStatsService.getOverview());
    setWeeklyRecap(listeningStatsService.getWeeklyRecap());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleShare = () => {
    const summaryText = weeklyRecap
      ? `🎶 My Loopra Weekly Recap:\n⏱️ ${weeklyRecap.totalHours} hrs listened\n🎵 ${weeklyRecap.distinctTracksCount} distinct tracks\n⭐ Top track: ${weeklyRecap.topTracks[0]?.title || 'Various'}\nCheck out retro Bollywood on Loopra!`
      : `🎶 Listening on Loopra - Mehfil & Bollywood Nostalgia without ads!`;

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
        <div className="p-4 sm:p-5 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Listening Insights & Recap</h3>
              <p className="text-[11px] text-neutral-400">Real playback activity & weekly summary</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 pb-2 flex gap-2 border-b border-neutral-800/60 bg-neutral-950/40">
          <button
            onClick={() => setActiveTab('recap')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'recap'
                ? 'bg-amber-500 text-neutral-950'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            Weekly Recap
          </button>
          <button
            onClick={() => setActiveTab('all-time')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'all-time'
                ? 'bg-amber-500 text-neutral-950'
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
                  Listen to songs for at least 20 seconds to generate your weekly recap insights.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Visual Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl text-center">
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold">Hours</p>
                    <p className="text-xl font-bold font-display text-amber-400">{weeklyRecap.totalHours}h</p>
                  </div>
                  <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl text-center">
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold">Plays</p>
                    <p className="text-xl font-bold font-display text-white">{weeklyRecap.totalPlays}</p>
                  </div>
                  <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl text-center">
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold">Tracks</p>
                    <p className="text-xl font-bold font-display text-white">{weeklyRecap.distinctTracksCount}</p>
                  </div>
                  <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl text-center">
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold">Peak Day</p>
                    <p className="text-xl font-bold font-display text-amber-300">{weeklyRecap.peakDay}</p>
                  </div>
                </div>

                {/* Top Tracks */}
                <div>
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Most-Played This Week</h4>
                  <div className="space-y-1.5">
                    {weeklyRecap.topTracks.map((t, i) => (
                      <div key={t.id} className="p-2.5 bg-neutral-950/40 border border-neutral-800/80 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 text-center text-xs font-bold text-amber-500">{i + 1}</span>
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

                {/* Top Artists */}
                {weeklyRecap.topArtists.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Top Artists</h4>
                    <div className="flex flex-wrap gap-2">
                      {weeklyRecap.topArtists.map(a => (
                        <div key={a.artist} className="px-3 py-1.5 bg-neutral-800/60 border border-neutral-700/60 rounded-xl flex items-center gap-2 text-xs">
                          <span className="font-semibold text-white">{a.artist}</span>
                          <span className="text-[10px] text-amber-400 font-mono">({a.count})</span>
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
                  <p className="text-xl font-bold font-display text-amber-400">{stats?.totalHours || 0}h</p>
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

              {stats?.topTracks?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">All-Time Favorites</h4>
                  <div className="space-y-1.5">
                    {stats.topTracks.slice(0, 6).map((t, i) => (
                      <div key={t.id} className="p-2.5 bg-neutral-950/40 border border-neutral-800/80 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 text-center text-xs font-bold text-amber-500">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{t.title}</p>
                            <p className="text-[10px] text-neutral-400 truncate">{t.artist}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-400 shrink-0 bg-neutral-800/60 px-2 py-0.5 rounded-md">
                          {t.count} plays
                        </span>
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
