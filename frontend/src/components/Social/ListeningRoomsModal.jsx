import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Trash2, Play, Music, Share2, Copy, Check, 
  ExternalLink, Sparkles, Radio, Disc, Volume2, Shield
} from 'lucide-react';

export default function ListeningRoomsModal({
  isOpen,
  onClose,
  socket,
  user,
  currentSong,
  isPlaying,
  onPlaySong,
  showToast,
  activeRoom,
  setActiveRoom,
  roomPlaylists,
  setRoomPlaylists,
  onOpenAddToPlaylist
}) {
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [roomQueue, setRoomQueue] = useState([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  // Fetch active rooms from backend
  const refreshRooms = () => {
    fetch('/api/rooms')
      .then(res => res.json())
      .then(data => {
        if (data && data.rooms) setRooms(data.rooms);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshRooms();
  }, [isOpen]);

  // Keep selected playlist active or select first
  useEffect(() => {
    if (roomPlaylists && roomPlaylists.length > 0) {
      if (!selectedPlaylistId || !roomPlaylists.some(p => p.id === selectedPlaylistId)) {
        setSelectedPlaylistId(roomPlaylists[0].id);
      }
    } else {
      setSelectedPlaylistId(null);
    }
  }, [roomPlaylists, selectedPlaylistId]);

  useEffect(() => {
    if (!socket) return;

    const handleRoomState = (state) => {
      if (state) {
        if (setActiveRoom) setActiveRoom(state);
        setParticipants(state.participants || state.members || []);
        setRoomQueue(state.queue || []);
        if (setRoomPlaylists) {
          setRoomPlaylists(state.playlists || []);
        }
        if (state.currentSong && onPlaySong && (!currentSong || (currentSong.id !== state.currentSong.id && currentSong.videoId !== state.currentSong.videoId))) {
          onPlaySong(state.currentSong);
        }
      }
    };

    const handleParticipants = (parts) => {
      setParticipants(parts || []);
    };

    const handlePlayback = (data) => {
      if (data?.currentSong && onPlaySong) {
        onPlaySong(data.currentSong);
      }
    };

    const handleQueue = (q) => {
      setRoomQueue(q || []);
    };

    const handlePlaylistUpdated = (data) => {
      if (data?.playlists && setRoomPlaylists) {
        setRoomPlaylists(data.playlists);
      }
      if (data?.type === 'song_added' && showToast) {
        showToast(`🎶 Track added: "${data?.song?.title || 'New Song'}"`);
      } else if (data?.type === 'song_removed' && showToast) {
        showToast('Track removed from room playlist');
      } else if (data?.type === 'playlist_created' && showToast) {
        showToast(`📁 Created room playlist: "${data?.playlist?.name}"`);
      }
    };

    socket.on('listening_room_state', handleRoomState);
    socket.on('listening_room_participants', handleParticipants);
    socket.on('room_playback_updated', handlePlayback);
    socket.on('room_queue_updated', handleQueue);
    socket.on('room:playlist:updated', handlePlaylistUpdated);

    return () => {
      socket.off('listening_room_state', handleRoomState);
      socket.off('listening_room_participants', handleParticipants);
      socket.off('room_playback_updated', handlePlayback);
      socket.off('room_queue_updated', handleQueue);
      socket.off('room:playlist:updated', handlePlaylistUpdated);
    };
  }, [socket, onPlaySong, setActiveRoom, setRoomPlaylists, currentSong, showToast]);

  if (!isOpen) return null;

  const handleJoin = async (roomIdOrCode) => {
    if (!roomIdOrCode) return;
    const target = roomIdOrCode.trim();
    if (!socket) {
      if (showToast) showToast('Connecting to room server...');
      return;
    }

    try {
      // First hit REST to ensure persistent member registration
      const res = await fetch(`/api/rooms/${encodeURIComponent(target)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user })
      });
      const data = await res.json();
      if (data.success && data.room) {
        if (setActiveRoom) setActiveRoom(data.room);
        if (setRoomPlaylists) setRoomPlaylists(data.room.playlists || []);
        socket.emit('join_listening_room', { roomId: data.room.roomId, user });
        socket.emit('room:join', { roomId: data.room.roomId, user });
        if (showToast) showToast(`Joined "${data.room.name}"`);
        setJoinCodeInput('');
        return;
      }
    } catch (e) {}

    // Fallback directly to socket
    socket.emit('join_listening_room', { roomId: target, user });
    socket.emit('room:join', { roomId: target, user });
    if (showToast) showToast('Joined Listening Room');
    setJoinCodeInput('');
  };

  const handleLeave = () => {
    if (socket && activeRoom) {
      const rId = activeRoom.roomId || activeRoom.id;
      socket.emit('leave_listening_room', { roomId: rId });
      socket.emit('room:leave', { roomId: rId });
    }
    if (setActiveRoom) setActiveRoom(null);
    if (setRoomPlaylists) setRoomPlaylists([]);
    setParticipants([]);
    setRoomQueue([]);
    if (showToast) showToast('Left Listening Room');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newRoomName.trim() || `${user?.displayName || user?.username || 'Host'}'s Lounge`;
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: newRoomDesc.trim(),
          user,
          isPublic: true
        })
      });
      const data = await res.json();
      if (data.success && data.room) {
        if (setActiveRoom) setActiveRoom(data.room);
        if (setRoomPlaylists) setRoomPlaylists(data.room.playlists || []);
        socket?.emit('join_listening_room', { roomId: data.room.roomId, user });
        socket?.emit('room:join', { roomId: data.room.roomId, user });
        if (showToast) showToast(`Created Room "${data.room.name}"`);
      }
    } catch (err) {
      const roomId = `room_${Date.now()}`;
      handleJoin(roomId);
    }
    setIsCreating(false);
    setNewRoomName('');
    setNewRoomDesc('');
  };

  const handleCopyLink = () => {
    if (!activeRoom) return;
    const rId = activeRoom.roomId || activeRoom.id;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/?room=${encodeURIComponent(rId)}`;
    
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2500);
          if (showToast) showToast('📋 Room link copied to clipboard!');
        })
        .catch(() => {
          if (showToast) showToast(`Share code: ${activeRoom.code || rId}`);
        });
    } else {
      if (showToast) showToast(`Share code: ${activeRoom.code || rId}`);
    }
  };

  const handleSyncToRoom = () => {
    if (socket && activeRoom && currentSong) {
      const rId = activeRoom.roomId || activeRoom.id;
      socket.emit('room_playback_sync', {
        roomId: rId,
        currentSong,
        isPlaying,
        seekTime: 0
      });
      if (showToast) showToast('Broadcasted current song to all room members');
    }
  };

  const handleCreateRoomPlaylist = (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || !activeRoom) return;
    const rId = activeRoom.roomId || activeRoom.id;
    const pName = newPlaylistName.trim();

    if (socket) {
      socket.emit('room:playlist:create', {
        roomId: rId,
        name: pName,
        user
      }, (resp) => {
        if (resp?.success && resp?.playlist) {
          setSelectedPlaylistId(resp.playlist.id);
        }
      });
    } else {
      fetch(`/api/rooms/${encodeURIComponent(rId)}/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pName, user })
      }).catch(() => {});
    }

    setNewPlaylistName('');
    setIsCreatingPlaylist(false);
  };

  const handleRemoveTrackFromRoomPlaylist = (playlistId, songId) => {
    if (!activeRoom || !playlistId || !songId) return;
    const rId = activeRoom.roomId || activeRoom.id;

    if (socket) {
      socket.emit('room:playlist:remove_song', {
        roomId: rId,
        playlistId,
        songId
      });
    } else {
      fetch(`/api/rooms/${encodeURIComponent(rId)}/playlists/${encodeURIComponent(playlistId)}/songs/${encodeURIComponent(songId)}`, {
        method: 'DELETE'
      }).catch(() => {});
    }
  };

  const activeSelectedPlaylist = (roomPlaylists || []).find(p => p.id === selectedPlaylistId) || (roomPlaylists && roomPlaylists[0]);

  return (
    <div
      className="fixed inset-0 z-[10000] bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Collaborative Listening Rooms</h3>
                <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-semibold">
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-neutral-400">Collaborate on playlists and listen together in real-time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
            aria-label="Close Listening Rooms"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {activeRoom ? (
            /* Inside Active Room */
            <div className="space-y-5">
              {/* Active Room Hero Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-neutral-900 to-neutral-950 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase text-amber-400 tracking-wider font-bold">
                      Connected Room
                    </span>
                    {activeRoom.code && (
                      <span className="text-[10px] font-mono bg-neutral-800 text-amber-300 px-2 py-0.5 rounded-md border border-neutral-700">
                        Code: {activeRoom.code}
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-bold text-white">{activeRoom.name}</h4>
                  <p className="text-xs text-neutral-300">
                    Host: <span className="text-amber-400 font-medium">{activeRoom.hostUsername || activeRoom.createdBy?.displayName || 'Host'}</span>
                    {' • '}
                    <span>{participants.length} live members</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
                    title="Copy shareable room link"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-950" /> : <Share2 className="w-4 h-4" />}
                    <span>{copiedLink ? 'Copied Link!' : 'Invite Friends'}</span>
                  </button>
                  <button
                    onClick={handleLeave}
                    className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition"
                  >
                    Leave
                  </button>
                </div>
              </div>

              {/* Sync Controls */}
              {currentSong && (
                <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400">
                      <Disc className="w-4 h-4 animate-spin" style={{ animationDuration: '4s' }} />
                    </div>
                    <div className="truncate">
                      <p className="text-[10px] text-neutral-400 uppercase font-mono">Your Playing Track</p>
                      <p className="text-xs font-semibold text-white truncate">{currentSong.title}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSyncToRoom}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs shrink-0 transition"
                  >
                    Sync to Room
                  </button>
                </div>
              )}

              {/* Live Listeners Badges */}
              <div>
                <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>Room Listeners ({participants.length})</span>
                </h5>
                <div className="flex flex-wrap gap-2">
                  {participants.map((p, idx) => (
                    <div
                      key={p.socketId || p.userId || idx}
                      className="px-3 py-1 rounded-full bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 flex items-center gap-2 shadow-sm"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-medium">{p.displayName || p.username}</span>
                      {p.role === 'owner' && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono">Host</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* COLLABORATIVE ROOM PLAYLISTS SECTION */}
              <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h5 className="text-sm font-bold text-white flex items-center gap-2">
                      <Music className="w-4 h-4 text-amber-400" />
                      <span>Collaborative Playlists</span>
                    </h5>
                    <p className="text-[11px] text-neutral-400">Playlists shared & editable live by all members</p>
                  </div>
                  <button
                    onClick={() => setIsCreatingPlaylist(!isCreatingPlaylist)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Room Playlist</span>
                  </button>
                </div>

                {/* Playlist Creation Form */}
                {isCreatingPlaylist && (
                  <form onSubmit={handleCreateRoomPlaylist} className="p-3 bg-neutral-900 rounded-xl border border-neutral-700/60 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Room playlist name..."
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                      maxLength={60}
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!newPlaylistName.trim()}
                      className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl transition disabled:opacity-50"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingPlaylist(false)}
                      className="px-2.5 py-2 text-neutral-400 hover:text-white text-xs transition"
                    >
                      Cancel
                    </button>
                  </form>
                )}

                {/* Playlist Selector Tabs */}
                {(!roomPlaylists || roomPlaylists.length === 0) ? (
                  <div className="text-center py-6 border border-dashed border-neutral-800 rounded-xl text-xs text-neutral-500">
                    <p>No room playlists yet. Click "New Room Playlist" to create one!</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                      {roomPlaylists.map(pl => {
                        const isSelected = activeSelectedPlaylist?.id === pl.id;
                        return (
                          <button
                            key={pl.id}
                            onClick={() => setSelectedPlaylistId(pl.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition flex items-center gap-2 ${
                              isSelected
                                ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                                : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
                            }`}
                          >
                            <span>{pl.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-black/20 text-neutral-950' : 'bg-neutral-800 text-neutral-400'}`}>
                              {pl.songs ? pl.songs.length : 0}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Active Playlist Songs View */}
                    {activeSelectedPlaylist && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{activeSelectedPlaylist.name}</span>
                            <span className="text-neutral-500">• {activeSelectedPlaylist.songs?.length || 0} tracks</span>
                          </div>
                          {activeSelectedPlaylist.songs?.length > 0 && (
                            <button
                              onClick={() => {
                                if (onPlaySong && activeSelectedPlaylist.songs[0]) {
                                  onPlaySong(activeSelectedPlaylist.songs[0]);
                                  if (showToast) showToast(`Playing room playlist: ${activeSelectedPlaylist.name}`);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-semibold text-[11px] transition"
                            >
                              <Play className="w-3 h-3 fill-emerald-400" />
                              <span>Play All</span>
                            </button>
                          )}
                        </div>

                        {/* Song List */}
                        {(!activeSelectedPlaylist.songs || activeSelectedPlaylist.songs.length === 0) ? (
                          <div className="text-center py-6 bg-neutral-900/60 rounded-xl border border-neutral-800 text-xs text-neutral-500">
                            <p>This room playlist is empty.</p>
                            <p className="mt-1 text-neutral-400">
                              Use the <span className="text-amber-400 font-medium">"Add to Playlist"</span> button on any song to add it here live!
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {activeSelectedPlaylist.songs.map((song, i) => (
                              <div
                                key={song.id || song.videoId || i}
                                className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800/80 hover:border-amber-500/30 flex items-center justify-between gap-3 group transition"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {song.thumbnail ? (
                                    <img
                                      src={song.thumbnail}
                                      alt={song.title}
                                      className="w-9 h-9 rounded-lg object-cover shrink-0"
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0 text-neutral-500">
                                      <Music className="w-4 h-4" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-white truncate">{song.title}</p>
                                    <p className="text-[11px] text-neutral-400 truncate">
                                      {song.artist || song.channel}
                                      {song.addedBy?.displayName && (
                                        <span className="text-neutral-500 ml-1.5">• added by {song.addedBy.displayName}</span>
                                      )}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => onPlaySong && onPlaySong(song)}
                                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-neutral-300 transition"
                                    title="Play track"
                                  >
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveTrackFromRoomPlaylist(activeSelectedPlaylist.id, song.id || song.videoId)}
                                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-500/20 hover:text-rose-400 text-neutral-500 transition opacity-0 group-hover:opacity-100"
                                    title="Remove from room playlist"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Room Browser & Creation */
            <div className="space-y-5">
              {/* Join via Code / Link Input */}
              <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Have a room code or ID? e.g. 7X9K2P..."
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && joinCodeInput.trim()) {
                      handleJoin(joinCodeInput.trim());
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700/80 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 uppercase font-mono tracking-wider"
                />
                <button
                  onClick={() => handleJoin(joinCodeInput.trim())}
                  disabled={!joinCodeInput.trim()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 font-bold text-xs rounded-xl transition disabled:opacity-40"
                >
                  Join
                </button>
              </div>

              {/* Header Action */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Available Rooms</h4>
                  <p className="text-[11px] text-neutral-500">Pick a room to collaborate and listen with others</p>
                </div>
                <button
                  onClick={() => setIsCreating(!isCreating)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-xs transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreating ? 'Cancel' : 'Create Room'}</span>
                </button>
              </div>

              {/* Creation Form */}
              {isCreating && (
                <form onSubmit={handleCreate} className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-3">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider">New Collaborative Room</h5>
                  <input
                    type="text"
                    placeholder="Room name (e.g. Chill Beats & Late Nights)..."
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                    maxLength={50}
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Short description (optional)..."
                    value={newRoomDesc}
                    onChange={(e) => setNewRoomDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                    maxLength={100}
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl transition shadow-lg shadow-amber-500/10"
                  >
                    Start Room & Get Share Link
                  </button>
                </form>
              )}

              {/* Rooms List */}
              {rooms.length === 0 ? (
                <div className="text-center py-10 text-neutral-500 text-xs border border-dashed border-neutral-800/80 rounded-2xl">
                  <Radio className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                  <p className="font-medium text-neutral-400">No active rooms found</p>
                  <p className="mt-1 text-neutral-500">Create the first collaborative room and invite friends!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {rooms.map((r) => (
                    <div
                      key={r.id || r.roomId}
                      className="p-3.5 rounded-2xl bg-neutral-950/70 border border-neutral-800 hover:border-amber-500/40 flex flex-col justify-between gap-3 transition"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-xs font-bold text-white truncate">{r.name}</h5>
                          {r.code && (
                            <span className="text-[10px] font-mono text-amber-400/90 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20 shrink-0">
                              {r.code}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          Host: {r.hostUsername || r.createdBy?.displayName || 'Host'}
                        </p>
                        {r.description && (
                          <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">{r.description}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60">
                        <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{r.memberCount || r.participantCount || 1} members</span>
                        </span>
                        <button
                          onClick={() => handleJoin(r.roomId || r.id)}
                          className="px-3 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500 hover:text-neutral-950 text-amber-300 text-xs font-semibold border border-amber-500/30 transition"
                        >
                          Join Room
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
