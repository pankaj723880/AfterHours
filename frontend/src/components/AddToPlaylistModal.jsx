import React from 'react';
import { X, Plus, Check } from 'lucide-react';
import { usePlaylists } from '../context/PlaylistContext';

export default function AddToPlaylistModal({ song, isOpen, onClose }) {
  const { playlists, addToPlaylist } = usePlaylists();

  if (!isOpen || !song) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-sm p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Add to Playlist</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-60 overflow-y-auto divide-y divide-neutral-800/50 mb-4">
          {playlists.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-6">No playlists found. Create one first.</p>
          ) : (
            playlists.map((pl) => {
              const songId = song.id || song._id;
              const inPlaylist = pl.songs.some((s) => (s.id || s._id) === songId);

              return (
                <button
                  key={pl.id}
                  disabled={inPlaylist}
                  onClick={() => {
                    addToPlaylist(pl.id, song);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 hover:bg-neutral-800 disabled:opacity-50 rounded-lg transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium">{pl.name}</p>
                    <p className="text-xs text-neutral-400">{pl.songs.length} tracks</p>
                  </div>
                  {inPlaylist ? <Check className="w-4 h-4 text-emerald-400" /> : <Plus className="w-4 h-4 text-neutral-400" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}