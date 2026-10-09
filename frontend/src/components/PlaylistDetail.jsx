import React from 'react';
import { Play, Plus, Trash2, ArrowLeft, Music2 } from 'lucide-react';
import { usePlaylists } from '../context/PlaylistContext';
import { usePlayer } from '../context/PlayerContext';

export default function PlaylistDetail({ playlistId, onBack }) {
  const { playlists, removeFromPlaylist, deletePlaylist } = usePlaylists();
  const { playTrack, setQueue, addToQueue, currentTrack, isPlaying } = usePlayer();

  const playlist = playlists.find((p) => p.id === playlistId);

  if (!playlist) {
    return (
      <div className="p-6 text-neutral-400">
        <button onClick={onBack} className="flex items-center space-x-2 text-sm hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4" /> <span>Back to Playlists</span>
        </button>
        <p>Playlist not found.</p>
      </div>
    );
  }

  const handlePlayAll = () => {
    if (!playlist.songs.length) return;
    setQueue(playlist.songs);
    playTrack(playlist.songs[0], 0);
  };

  const handleAddPlaylistToQueue = () => {
    if (!playlist.songs.length) return;
    playlist.songs.forEach((song) => addToQueue(song));
  };

  return (
    <div className="p-6 text-white max-w-7xl mx-auto">
      <button onClick={onBack} className="flex items-center space-x-2 text-sm text-neutral-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> <span>Back to Playlists</span>
      </button>

      <div className="flex flex-col sm:flex-row items-start sm:items-end space-y-4 sm:space-y-0 sm:space-x-6 mb-8">
        <div className="w-40 h-40 bg-neutral-800 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 border border-neutral-700">
          {playlist.songs[0]?.thumbnail ? (
            <img src={playlist.songs[0].thumbnail} alt={playlist.name} className="w-full h-full object-cover" />
          ) : (
            <Music2 className="w-16 h-16 text-neutral-600" />
          )}
        </div>

        <div className="flex-1">
          <p className="text-xs uppercase font-semibold text-indigo-400 tracking-wider">Playlist</p>
          <h1 className="text-3xl font-extrabold mt-1">{playlist.name}</h1>
          <p className="text-sm text-neutral-400 mt-2">{playlist.songs.length} tracks</p>

          <div className="flex items-center space-x-3 mt-4">
            <button
              onClick={handlePlayAll}
              disabled={!playlist.songs.length}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-full font-medium transition-colors"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Play All</span>
            </button>
            <button
              onClick={handleAddPlaylistToQueue}
              disabled={!playlist.songs.length}
              className="flex items-center space-x-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-full text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Queue</span>
            </button>
            <button
              onClick={() => {
                deletePlaylist(playlist.id);
                onBack();
              }}
              className="p-2.5 text-neutral-400 hover:text-red-400 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 rounded-full transition-colors"
              title="Delete Playlist"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Song List */}
      <div className="divide-y divide-neutral-800/60">
        {playlist.songs.length === 0 ? (
          <div className="py-12 text-center text-neutral-500">
            <p>This playlist is empty.</p>
            <p className="text-xs mt-1">Add songs from Search, Stations, or Liked Songs.</p>
          </div>
        ) : (
          playlist.songs.map((song, index) => {
            const isCurrent = currentTrack?.id === song.id || currentTrack?._id === song._id;

            return (
              <div
                key={`${song.id || song._id}-${index}`}
                onClick={() => {
                  setQueue(playlist.songs);
                  playTrack(song, index);
                }}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                  isCurrent ? 'bg-neutral-800/80 text-indigo-400' : 'hover:bg-neutral-800/40 text-neutral-200'
                }`}
              >
                <div className="flex items-center space-x-4 min-w-0 flex-1">
                  <span className="text-xs text-neutral-500 w-5 text-right font-mono">{index + 1}</span>
                  <div className="w-10 h-10 rounded overflow-hidden bg-neutral-800 flex-shrink-0">
                    <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate font-medium ${isCurrent ? 'text-indigo-400' : 'text-neutral-100'}`}>
                      {song.title}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">{song.artist || song.channelTitle}</p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromPlaylist(playlist.id, song.id || song._id);
                  }}
                  className="p-2 text-neutral-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove from playlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}