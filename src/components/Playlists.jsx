import React, { useState } from 'react';
import { Plus, ListMusic, Trash2, Play } from 'lucide-react';
import { usePlaylists } from '../context/PlaylistContext';
import { usePlayer } from '../context/PlayerContext';

export default function Playlists({ onOpenPlaylist }) {
  const { playlists, createPlaylist, deletePlaylist } = usePlaylists();
  const { playTrack, setQueue } = usePlayer();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    createPlaylist(newPlaylistName);
    setNewPlaylistName('');
    setIsModalOpen(false);
  };

  const handlePlayPlaylist = (e, playlist) => {
    e.stopPropagation();
    if (!playlist.songs.length) return;
    setQueue(playlist.songs);
    playTrack(playlist.songs[0], 0);
  };

  return (
    <div className="p-6 text-white max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Your Playlists</h1>
          <p className="text-sm text-neutral-400">Personalize your AfterHours music library</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Playlist</span>
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-neutral-900/50 border border-neutral-800 rounded-xl text-center">
          <ListMusic className="w-16 h-16 text-neutral-600 mb-4 stroke-[1.5]" />
          <h3 className="text-lg font-semibold text-neutral-300">No playlists yet</h3>
          <p className="text-sm text-neutral-500 mt-1 mb-6 max-w-sm">
            Create playlists to organize your favorite tracks and listen anytime.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Create your first playlist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              onClick={() => onOpenPlaylist(pl.id)}
              className="group relative bg-neutral-900/80 hover:bg-neutral-800/80 border border-neutral-800/80 p-4 rounded-xl cursor-pointer transition-all flex flex-col justify-between"
            >
              <div>
                <div className="aspect-square bg-neutral-800 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                  {pl.songs[0]?.thumbnail ? (
                    <img src={pl.songs[0].thumbnail} alt={pl.name} className="w-full h-full object-cover" />
                  ) : (
                    <ListMusic className="w-10 h-10 text-neutral-600" />
                  )}
                  {pl.songs.length > 0 && (
                    <button
                      onClick={(e) => handlePlayPlaylist(e, pl)}
                      className="absolute right-3 bottom-3 w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all"
                      title="Play Playlist"
                    >
                      <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                    </button>
                  )}
                </div>
                <h3 className="font-semibold text-sm truncate">{pl.name}</h3>
                <p className="text-xs text-neutral-400 mt-0.5">{pl.songs.length} tracks</p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deletePlaylist(pl.id);
                }}
                className="absolute top-2 right-2 p-1.5 text-neutral-400 hover:text-red-400 bg-black/40 hover:bg-black/60 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete Playlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleCreate} className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Playlist</h2>
            <input
              type="text"
              placeholder="Playlist name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 mb-6"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-neutral-400 hover:text-white text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newPlaylistName.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}