import React, { useState, useEffect } from 'react';

export default function ListeningRoomsModal({
  isOpen,
  onClose,
  socket,
  user,
  currentSong,
  isPlaying,
  onPlaySong,
  showToast
}) {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [roomQueue, setRoomQueue] = useState([]);

  useEffect(() => {
    if (!isOpen) return;

    // Fetch active rooms from backend
    fetch('/api/rooms')
      .then(res => res.json())
      .then(data => {
        if (data && data.rooms) setRooms(data.rooms);
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!socket) return;

    const handleRoomState = (state) => {
      setActiveRoom(state);
      setParticipants(state.participants || []);
      setRoomQueue(state.queue || []);
      if (state.currentSong && onPlaySong) {
        onPlaySong(state.currentSong);
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

    socket.on('listening_room_state', handleRoomState);
    socket.on('listening_room_participants', handleParticipants);
    socket.on('room_playback_updated', handlePlayback);
    socket.on('room_queue_updated', handleQueue);

    return () => {
      socket.off('listening_room_state', handleRoomState);
      socket.off('listening_room_participants', handleParticipants);
      socket.off('room_playback_updated', handlePlayback);
      socket.off('room_queue_updated', handleQueue);
    };
  }, [socket, onPlaySong]);

  if (!isOpen) return null;

  const handleJoin = (roomId) => {
    if (!socket) {
      if (showToast) showToast('Connecting to room server...');
      return;
    }
    socket.emit('join_listening_room', { roomId, user });
    if (showToast) showToast('Joined Listening Room');
  };

  const handleLeave = () => {
    if (socket && activeRoom) {
      socket.emit('leave_listening_room', { roomId: activeRoom.id });
    }
    setActiveRoom(null);
    setParticipants([]);
    setRoomQueue([]);
    if (showToast) showToast('Left Listening Room');
  };

  const handleCreate = (e) => {
    e.preventDefault();
    const name = newRoomName.trim() || `${user?.displayName || user?.username || 'Listener'}'s Room`;
    const roomId = `room_${Date.now()}`;
    handleJoin(roomId);
    setIsCreating(false);
    setNewRoomName('');
  };

  const handleSyncToRoom = () => {
    if (socket && activeRoom && currentSong) {
      socket.emit('room_playback_sync', {
        roomId: activeRoom.id,
        currentSong,
        isPlaying,
        seekTime: 0
      });
      if (showToast) showToast('Shared current song to room');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <span className="text-sm">📻</span>
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Listening Rooms</h3>
              <p className="text-[11px] text-neutral-400">Listen together with friends in real-time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
            aria-label="Close Listening Rooms"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {activeRoom ? (
            /* Inside Active Room */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-amber-400 tracking-wider">Active Room</span>
                  <h4 className="text-base font-bold text-white">{activeRoom.name}</h4>
                  <p className="text-xs text-neutral-300">Host: {activeRoom.hostUsername}</p>
                </div>
                <button
                  onClick={handleLeave}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition"
                >
                  Leave Room
                </button>
              </div>

              {/* Sync Controls */}
              {currentSong && (
                <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div className="truncate pr-2">
                    <p className="text-[10px] text-neutral-400 uppercase font-mono">Your Track</p>
                    <p className="text-xs font-semibold text-white truncate">{currentSong.title}</p>
                  </div>
                  <button
                    onClick={handleSyncToRoom}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shrink-0 transition"
                  >
                    Sync to Room
                  </button>
                </div>
              )}

              {/* Participants */}
              <div>
                <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  Listeners ({participants.length})
                </h5>
                <div className="flex flex-wrap gap-2">
                  {participants.map((p, idx) => (
                    <div
                      key={p.socketId || idx}
                      className="px-3 py-1.5 rounded-full bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 flex items-center gap-1.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{p.displayName || p.username}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shared Queue */}
              {roomQueue.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Shared Room Queue</h5>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {roomQueue.map((track, i) => (
                      <div key={i} className="p-2 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between text-xs text-neutral-300">
                        <span className="truncate">{track.title}</span>
                        <span className="text-[10px] text-neutral-500 shrink-0 ml-2">{track.artist}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Room Browser & Creation */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Available Rooms</h4>
                <button
                  onClick={() => setIsCreating(!isCreating)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-xs transition"
                >
                  {isCreating ? 'Cancel' : '+ Create Room'}
                </button>
              </div>

              {/* Creation Form */}
              {isCreating && (
                <form onSubmit={handleCreate} className="p-3 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-2.5">
                  <input
                    type="text"
                    placeholder="Enter room name..."
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                    maxLength={40}
                  />
                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl transition"
                  >
                    Start Listening Room
                  </button>
                </form>
              )}

              {/* Rooms List */}
              {rooms.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  <p>No active listening rooms right now.</p>
                  <p className="mt-1 text-neutral-600">Be the first to create one!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rooms.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-2xl bg-neutral-950/70 border border-neutral-800 hover:border-amber-500/40 flex items-center justify-between transition"
                    >
                      <div>
                        <h5 className="text-xs font-bold text-white">{r.name}</h5>
                        <p className="text-[11px] text-neutral-400">Host: {r.hostUsername} • {r.participantCount} listening</p>
                      </div>
                      <button
                        onClick={() => handleJoin(r.id)}
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-neutral-200 text-xs font-semibold transition"
                      >
                        Join
                      </button>
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

