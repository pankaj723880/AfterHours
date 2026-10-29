import React, { useState, useEffect } from 'react';
import { 
  Activity as ActivityIcon, 
  Search, 
  Trash2, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Music, 
  Heart, 
  ListMusic, 
  Eye, 
  EyeOff,
  Filter
} from 'lucide-react';
import { safeParseJsonResponse } from '../../utils/errorHandler';

export default function ActivityModeration({ token, backendUrl, showToast }) {
  const cleanBase = (backendUrl || '').trim().replace(/\/+$/, '');
  const [activities, setActivities] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (search.trim()) params.set('search', search.trim());
      if (typeFilter) params.set('type', typeFilter);
      if (usernameFilter.trim()) params.set('username', usernameFilter.trim());

      const res = await fetch(`${cleanBase}/api/admin/activities?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Failed to fetch activities');
      if (parsed.ok && parsed.data) {
        setActivities(parsed.data.activities || []);
        setTotal(parsed.data.total || 0);
        setTotalPages(parsed.data.totalPages || 1);
      } else {
        showToast?.(parsed.error || 'Failed to fetch activities', 'error');
      }
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [page, typeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchActivities();
  };

  const handleDeleteActivity = async (id, itemDesc) => {
    if (!window.confirm(`Moderate / delete activity: "${itemDesc}"?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${cleanBase}/api/admin/activities/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const parsed = await safeParseJsonResponse(res, 'Failed to delete activity');
      if (parsed.ok) {
        showToast?.('Activity item removed from feed', 'success');
        fetchActivities();
      } else {
        showToast?.(parsed.error || 'Failed to delete activity', 'error');
      }
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const getActivityTypeBadge = (type) => {
    switch (type) {
      case 'listen':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Music className="w-3 h-3" /> Listened
          </span>
        );
      case 'like':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Heart className="w-3 h-3 fill-rose-500/30" /> Liked
          </span>
        );
      case 'playlist_create':
      case 'playlist_update':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <ListMusic className="w-3 h-3" /> Playlist
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ActivityIcon className="w-5 h-5 text-amber-400" />
              Listening Activity Feed Moderation
              <span className="text-xs font-mono font-medium bg-neutral-800 text-amber-400 px-2 py-0.5 rounded-full">
                {total} entries
              </span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Review and moderate real-time public user listening events, likes, and playlist creations across Loopra
            </p>
          </div>

          <button
            onClick={fetchActivities}
            disabled={isLoading}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/30 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-3 pt-2 border-t border-neutral-800/80">
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by song title, artist, playlist, or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-amber-500/50 rounded-xl pl-9 pr-20 py-2 text-xs text-white placeholder-neutral-500 outline-none transition"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] transition cursor-pointer"
            >
              Search
            </button>
          </form>

          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="bg-neutral-950/80 border border-neutral-800 text-neutral-300 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500/50"
            >
              <option value="">All Activity Types</option>
              <option value="listen">Listens</option>
              <option value="like">Likes</option>
              <option value="playlist_create">Playlists Created</option>
              <option value="playlist_update">Playlists Updated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activities Table */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-neutral-950/80 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Track / Playlist</th>
                <th className="py-3 px-4">Visibility</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Moderation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
                    Loading activities...
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-neutral-500">
                    No matching activity events found.
                  </td>
                </tr>
              ) : (
                activities.map((act) => {
                  const trackDesc = act.track 
                    ? `${act.track.title || 'Track'} - ${act.track.channel || act.track.artist || ''}`
                    : act.playlist ? `Playlist: ${act.playlist.name}` : 'Unknown Item';

                  return (
                    <tr key={act.id} className="hover:bg-neutral-800/25 transition">
                      {/* User Column */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={act.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(act.username)}&background=262626&color=f59e0b&size=80`}
                            alt={act.username}
                            className="w-7 h-7 rounded-full object-cover border border-neutral-800"
                            onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(act.username)}&background=262626&color=f59e0b`; }}
                          />
                          <div>
                            <div className="font-semibold text-white">{act.displayName || act.username}</div>
                            <div className="text-[10px] text-neutral-500 font-mono">@{act.username}</div>
                          </div>
                        </div>
                      </td>

                      {/* Event Type Badge */}
                      <td className="py-3 px-4">
                        {getActivityTypeBadge(act.type)}
                      </td>

                      {/* Track / Playlist Item */}
                      <td className="py-3 px-4 max-w-xs">
                        {act.track ? (
                          <div className="flex items-center gap-2">
                            {act.track.thumbnail && (
                              <img
                                src={act.track.thumbnail}
                                alt={act.track.title}
                                className="w-8 h-8 rounded-lg object-cover shrink-0 border border-neutral-800"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-white truncate text-xs">{act.track.title}</p>
                              <p className="text-[10px] text-neutral-400 truncate">{act.track.channel || act.track.artist}</p>
                            </div>
                          </div>
                        ) : act.playlist ? (
                          <div>
                            <p className="font-medium text-white truncate text-xs">{act.playlist.name}</p>
                            <p className="text-[10px] text-neutral-400">{act.playlist.songsCount || 0} songs</p>
                          </div>
                        ) : (
                          <span className="text-neutral-500 italic">No item linked</span>
                        )}
                      </td>

                      {/* Visibility */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          act.isPublic
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}>
                          {act.isPublic ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                          {act.isPublic ? 'Public' : 'Private'}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 text-neutral-400 text-[11px] font-mono whitespace-nowrap">
                        {new Date(act.createdAt).toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteActivity(act.id, trackDesc)}
                          disabled={deletingId === act.id}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400 disabled:opacity-40 transition cursor-pointer"
                          title="Moderate and delete activity item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <div>
            Showing Page <span className="text-white font-semibold">{page}</span> of{' '}
            <span className="text-white font-semibold">{totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:pointer-events-none text-neutral-200 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-neutral-300 px-2">{page}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:pointer-events-none text-neutral-200 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

