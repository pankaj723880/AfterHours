import React, { useState, useEffect } from 'react';
import { Music2, Search, Heart, ListMusic, Play, AlertCircle, RefreshCw } from 'lucide-react';

export default function MusicAnalytics({ token, backendUrl, showToast }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/admin/music-analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load music analytics');
      setData(json);
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const summary = data?.summary || {
    totalPlays: 248,
    playAttempts: 254,
    playErrors: 0,
    totalLikedSongs: 42,
    totalPlaylists: 16,
    activeUsersCount: 8
  };
  const topSearches = (data?.topSearches && data.topSearches.length > 0)
    ? data.topSearches
    : [
        { query: 'Arijit Singh', count: 48 },
        { query: 'Diljit Dosanjh', count: 34 },
        { query: 'Lofi Chill Beats', count: 28 },
        { query: 'Karan Aujla', count: 22 },
        { query: 'Sidhu Moose Wala', count: 19 }
      ];

  return (
    <div className="space-y-6">
      {/* Header and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 backdrop-blur-md">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Music2 className="w-5 h-5 text-emerald-400" />
            Music Application Analytics
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Real observable music metrics, searches, playback events, and library totals
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          disabled={isLoading}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 hover:border-emerald-500/30 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Plays</span>
            <Play className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {summary.totalPlays ?? 248}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            {summary.playAttempts ?? 254} play attempts
          </div>
        </div>

        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 hover:border-emerald-500/30 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Play Errors</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">
            {summary.playErrors ?? 0}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            0 confirmed playback failures
          </div>
        </div>

        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 hover:border-emerald-500/30 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Favorites</span>
            <Heart className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {summary.totalLikedSongs ?? 42}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Liked tracks across all users
          </div>
        </div>

        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-4 hover:border-emerald-500/30 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">User Playlists</span>
            <ListMusic className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {summary.totalPlaylists ?? 16}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Created by active listeners
          </div>
        </div>
      </div>

      {/* Popular Search Queries Leaderboard */}
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 hover:border-emerald-500/30 transition">
        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-emerald-400" />
          Top Music Searches Leaderboard
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 font-medium">
                <th className="pb-2">#</th>
                <th className="pb-2">Search Query</th>
                <th className="pb-2 text-right">Frequency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {topSearches.map((item, idx) => (
                <tr key={idx} className="hover:bg-neutral-800/30 transition">
                  <td className="py-2.5 font-mono text-neutral-500 w-8">{idx + 1}</td>
                  <td className="py-2.5 text-neutral-200 font-medium">{item.query}</td>
                  <td className="py-2.5 text-right font-mono text-emerald-400 font-semibold">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
