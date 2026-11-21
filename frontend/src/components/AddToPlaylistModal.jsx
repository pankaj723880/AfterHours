import React, { useState } from 'react';
import { X, Plus, Check, Radio, User, Disc, Globe } from 'lucide-react';
import { usePlaylists } from '../context/PlaylistContext';

export default function AddToPlaylistModal({ 
  song, 
  isOpen, 
  onClose,
  activeRoom,
  roomPlaylists = [],
  onAddToRoomPlaylist
}) {
  const { playlists, addToPlaylist } = usePlaylists();
  const [selectedTab, setSelectedTab] = useState('personal'); // 'personal' | 'room'

  if (!isOpen || !song) return null;

  const songId = song.id || song.videoId || song._id;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg">Add to Playlist</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Song Preview */}
        <div className="flex items-center gap-3 mb-4 p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800">
          {song.thumbnail ? (
            <img 
              src={song.thumbnail} 
              className="w-9 h-9 rounded-lg object-cover shrink-0" 
              alt={song.title || ''} 
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0 text-neutral-400">
              <Disc className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">{song.title}</p>
            <p className="text-[11px] text-amber-500/80 truncate">{song.artist || song.channel}</p>
          </div>
        </div>

        {/* Tab switch if inside an active room */}
        {activeRoom && (
          <div className="flex items-center p-1 bg-neutral-950 border border-neutral-800 rounded-xl mb-4 text-xs font-semibold">
            <button
              onClick={() => setSelectedTab('personal')}
              className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
                selectedTab === 'personal'
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Personal</span>
            </button>
            <button
              onClick={() => setSelectedTab('room')}
              className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
                selectedTab === 'room'
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span className="truncate">Room: {activeRoom.name || 'Room'}</span>
            </button>
          </div>
        )}

        {/* Content list */}
        {selectedTab === 'room' && activeRoom ? (
          <div className="max-h-60 overflow-y-auto divide-y divide-neutral-800/50 mb-2">
            {(!roomPlaylists || roomPlaylists.length === 0) ? (
              <div className="text-center py-6 text-neutral-500 text-xs">
                <p>No room playlists available.</p>
                <p className="mt-1 text-neutral-600">Create one inside the Listening Room first.</p>
              </div>
            ) : (
              roomPlaylists.map((pl) => {
                const inRoomPlaylist = (pl.songs || []).some(
                  (s) => String(s.id || s.videoId) === String(songId)
                );

                return (
                  <button
                    key={pl.id}
                    disabled={inRoomPlaylist}
                    onClick={() => {
                      if (onAddToRoomPlaylist) {
                        onAddToRoomPlaylist(activeRoom.roomId || activeRoom.id, pl.id, song);
                      }
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 hover:bg-neutral-800/80 disabled:opacity-40 rounded-xl transition-colors text-left group"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white group-hover:text-amber-300 transition">
                        {pl.name}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        {(pl.songs || []).length} tracks • Room playlist
                      </p>
                    </div>
                    {inRoomPlaylist ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                        <Check className="w-3.5 h-3.5" /> Added
                      </span>
                    ) : (
                      <Plus className="w-4 h-4 text-neutral-400 group-hover:text-amber-400 transition" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto divide-y divide-neutral-800/50 mb-2">
            {playlists.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-6">No personal playlists found. Create one first.</p>
            ) : (
              playlists.map((pl) => {
                const inPlaylist = (pl.songs || []).some(
                  (s) => String(s.id || s._id || s.videoId) === String(songId)
                );

                return (
                  <button
                    key={pl.id}
                    disabled={inPlaylist}
                    onClick={() => {
                      addToPlaylist(pl.id, song);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 hover:bg-neutral-800 disabled:opacity-40 rounded-xl transition-colors text-left group"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white group-hover:text-amber-300 transition">
                        {pl.name}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        {(pl.songs || []).length} tracks
                      </p>
                    </div>
                    {inPlaylist ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                        <Check className="w-3.5 h-3.5" /> Added
                      </span>
                    ) : (
                      <Plus className="w-4 h-4 text-neutral-400 group-hover:text-amber-400 transition" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
