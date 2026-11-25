import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Plus, Trash2, Play, Music, Share2, Copy, Check, 
  Sparkles, Radio, Disc, Volume2, Shield, Heart, Flame,
  ThumbsUp, MessageSquare, Send, ChevronDown, ChevronUp,
  RefreshCw, Lock, Globe, LogOut, ArrowUpDown, Award, Crown,
  UserCheck, UserMinus, UserX
} from 'lucide-react';
import { getApiUrl } from '../../utils/apiUrl';
import { getTabAuthToken } from '../../utils/storage';
import { useUiConfig } from '../../context/UiConfigContext';

const QUICK_REACTIONS = ['🔥', '❤️', '🕺', '😭'];

export default function ListeningRoomsModal({
  isOpen,
  onClose,
  socket,
  user,
  currentSong,
  isPlaying,
  currentTimeRef,
  onPlaySong,
  onSeek,
  showToast,
  activeRoom,
  setActiveRoom,
  joinedRooms,
  setJoinedRooms,
  roomPlaylists,
  setRoomPlaylists,
  userPlaylists,
  setPlaylists,
  isRoomPlaybackSyncEnabled,
  setIsRoomPlaybackSyncEnabled,
  onOpenAddToPlaylist,
  onToggleLike,
  isLiked
}) {
  const { isVisible: isUiVisible } = useUiConfig();
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomIsPublic, setNewRoomIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [selectedPreviewRoom, setSelectedPreviewRoom] = useState(null); // Preview state before explicit join
  
  // Upgrades State
  const [activeTab, setActiveTab] = useState('playlists'); // 'playlists' | 'activity' | 'members'
  const [sortByVotes, setSortByVotes] = useState(true);
  const [activities, setActivities] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);
  const [isSendingChatMessage, setIsSendingChatMessage] = useState(false);
  const isSendingChatMessageRef = useRef(false);

  const currentUserId = user?._id?.toString?.() || user?.userId || 'guest';
  const currentUsername = user?.username || 'Listener';
  const token = getTabAuthToken() || null;
  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  // Find user's member role in current active room
  const currentMember = (participants || []).find(m => 
    (m.userId && m.userId === currentUserId) || 
    (m.username && m.username === currentUsername)
  );
  const userRole = currentMember?.role || (activeRoom?.createdBy?.userId === currentUserId ? 'host' : 'listener');
  const isHost = userRole === 'host';
  const isCoHost = userRole === 'co-host' || isHost;

  // Refresh public rooms from backend
  const refreshRooms = () => {
    if (!token) {
      setRooms([]);
      return;
    }
    fetch(getApiUrl('/api/rooms'), { headers: authHeaders })
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

  // Initial load of room details when activeRoom changes
  useEffect(() => {
    if (!activeRoom) return;
    setParticipants(activeRoom.members || []);
    setActivities(activeRoom.activities || []);
    setChatMessages(activeRoom.chatMessages || []);
  }, [activeRoom]);

  // Socket event listeners for collaborative features
  useEffect(() => {
    if (!socket) return;

    const handleRoomState = (state) => {
      if (state) {
        if (setActiveRoom) setActiveRoom(state);
        setParticipants(state.members || []);
        if (state.activities) setActivities(state.activities);
        if (state.chatMessages) setChatMessages(state.chatMessages);
        if (setRoomPlaylists && state.playlists) {
          setRoomPlaylists(state.playlists);
        }
      }
    };

    const handleMembersUpdated = (data) => {
      if (data?.members) {
        setParticipants(data.members);
      }
    };

    const handleMemberKicked = (data) => {
      if (data?.userId === currentUserId) {
        if (showToast) showToast('You were removed from this room by the host', 'error');
        handleLeave();
      }
    };

    const handleActivitiesUpdated = (data) => {
      if (data?.activities) {
        setActivities(data.activities);
        if (activeTab !== 'activity') {
          setUnreadActivityCount(prev => prev + 1);
        }
      }
    };

    const handleChatMessage = (data) => {
      if (data?.message) {
        const msg = data.message;
        const msgId = msg.id || msg.clientId;
        setChatMessages(prev => {
          const list = prev || [];
          const existingIndex = list.findIndex(m => 
            (msgId && (m.id === msgId || m.clientId === msgId)) ||
            (msg.clientId && (m.clientId === msg.clientId || m.id === msg.clientId))
          );
          if (existingIndex > -1) {
            const updated = [...list];
            updated[existingIndex] = { ...updated[existingIndex], ...msg };
            return updated.slice(-100);
          }
          return [...list.slice(-99), msg];
        });
      }
    };

    const handleReaction = (data) => {
      if (data?.emoji) {
        const id = data.id || `react_${Date.now()}_${Math.random()}`;
        const sender = data.senderName || data.user?.displayName || data.user?.username || 'Listener';
        const role = (data.role || data.user?.role || 'LISTENER').toUpperCase();
        const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();

        // 1. Floating reaction animation
        setFloatingReactions(prev => [
          ...prev, 
          { 
            id, 
            emoji: data.emoji, 
            user: { displayName: sender, role }, 
            senderName: sender,
            role,
            left: Math.floor(Math.random() * 60) + 20 
          }
        ]);
        setTimeout(() => {
          setFloatingReactions(prev => prev.filter(r => r.id !== id));
        }, 3200);

        // 2. Append reaction event into Live Activity feed state
        setActivities(prev => [
          {
            id: `act_${id}`,
            type: 'reaction',
            emoji: data.emoji,
            text: `${sender} reacted with ${data.emoji}`,
            user: { displayName: sender, role },
            timestamp
          },
          ...(prev || []).slice(0, 49)
        ]);
      }
    };

    const handlePlaylistUpdated = (data) => {
      if (data?.playlists && setRoomPlaylists) {
        setRoomPlaylists(data.playlists);
      }
      if (data?.type === 'song_added' && showToast) {
        showToast(`🎶 Added: "${data?.song?.title || 'New Song'}"`);
      } else if (data?.type === 'song_removed' && showToast) {
        showToast('Track removed from room playlist');
      } else if (data?.type === 'playlist_created' && showToast) {
        showToast(`📁 Created room playlist: "${data?.playlist?.name}"`);
      } else if (data?.type === 'song_voted' && showToast) {
        // quiet vote feedback
      }
    };

    const handleInviteUpdated = (data) => {
      if (data?.code && activeRoom) {
        setActiveRoom(prev => prev ? { ...prev, code: data.code } : prev);
        if (showToast) showToast(`🔑 Invite code refreshed: ${data.code}`);
      }
    };

    const handlePrivacyUpdated = (data) => {
      if (typeof data?.isPublic === 'boolean' && activeRoom) {
        setActiveRoom(prev => prev ? { ...prev, isPublic: data.isPublic } : prev);
        if (showToast) showToast(`Room is now ${data.isPublic ? 'Public' : 'Invite-Only'}`);
      }
    };

    const handleStatusUpdated = (data) => {
      if (data?.status === 'archived') {
        if (showToast) showToast('This room was archived by the host', 'warning');
        handleLeave();
      } else if (data?.status === 'deleted') {
        if (showToast) showToast('This room was deleted by the host', 'error');
        handleLeave();
      }
    };

    const handleRoomError = (err) => {
      const errMsg = err?.error || 'Room not found or invalid room code';
      if (showToast) showToast(errMsg, 'error');
    };

    socket.on('room:state', handleRoomState);
    socket.on('room:members:updated', handleMembersUpdated);
    socket.on('room:member:kicked', handleMemberKicked);
    socket.on('room:activities:updated', handleActivitiesUpdated);
    socket.on('room:chat:message', handleChatMessage);
    socket.on('room:reaction', handleReaction);
    socket.on('room:playlist:updated', handlePlaylistUpdated);
    socket.on('room:invite:updated', handleInviteUpdated);
    socket.on('room:privacy:updated', handlePrivacyUpdated);
    socket.on('room:status:updated', handleStatusUpdated);
    socket.on('room:error', handleRoomError);
    socket.on('listening_room_error', handleRoomError);

    return () => {
      socket.off('room:state', handleRoomState);
      socket.off('room:members:updated', handleMembersUpdated);
      socket.off('room:member:kicked', handleMemberKicked);
      socket.off('room:activities:updated', handleActivitiesUpdated);
      socket.off('room:chat:message', handleChatMessage);
      socket.off('room:reaction', handleReaction);
      socket.off('room:playlist:updated', handlePlaylistUpdated);
      socket.off('room:invite:updated', handleInviteUpdated);
      socket.off('room:privacy:updated', handlePrivacyUpdated);
      socket.off('room:status:updated', handleStatusUpdated);
      socket.off('room:error', handleRoomError);
      socket.off('listening_room_error', handleRoomError);
    };
  }, [socket, activeRoom, currentUserId, activeTab, setRoomPlaylists, setActiveRoom, showToast]);

  if (!isOpen) return null;

  // 1. Join Room
  const handleJoin = async (roomIdOrCode) => {
    if (!roomIdOrCode) return;
    const target = roomIdOrCode.trim();
    if (!target) return;

    try {
      const res = await fetch(getApiUrl(`/api/rooms/${encodeURIComponent(target)}/join`), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ user })
      });
      const data = await res.json();
      if (res.ok && data.success && data.room) {
        if (setActiveRoom) setActiveRoom(data.room);
        if (setRoomPlaylists) setRoomPlaylists(data.room.playlists || []);
        setParticipants(data.room.members || []);
        setActivities(data.room.activities || []);
        setChatMessages(data.room.chatMessages || []);
        socket?.emit('join_listening_room', { roomId: data.room.roomId, user });
        socket?.emit('room:join', { roomId: data.room.roomId, user });
        if (showToast) showToast(`Joined "${data.room.name}"`);
        setJoinCodeInput('');
        return;
      } else {
        const errorMsg = data?.error || 'Room not found or invalid room code';
        if (showToast) showToast(errorMsg, 'error');
        return;
      }
    } catch (e) {
      if (showToast) showToast('Room not found or network error', 'error');
    }
  };

  // 2. Leave Room
  const handleLeave = () => {
    // Immediately clear ?room= or ?roomCode= query parameters from URL so auto-join doesn't re-trigger
    if (typeof window !== 'undefined' && window.history && window.location) {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('room') || url.searchParams.has('roomCode')) {
          url.searchParams.delete('room');
          url.searchParams.delete('roomCode');
          window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : '') + (url.hash || ''));
        }
      } catch (e) {}
    }

    if (activeRoom) {
      const rId = activeRoom.roomId || activeRoom.id;
      // Optimistically remove from local rooms list if setRooms is present
      if (typeof setRooms === 'function') {
        setRooms(prev => (prev || []).filter(r => (r.roomId || r.id) !== rId));
      }

      socket?.emit('leave_listening_room', { roomId: rId });
      socket?.emit('room:leave', { roomId: rId, user });
      // Call REST fallback to ensure server persistence
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/leave`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, userId: currentUserId, guestId: currentUserId })
      }).then(res => {
        if (!res.ok) {
          console.warn('[ListeningRooms] Failed to leave room on server:', res.status);
        }
      }).catch(err => {
        console.warn('[ListeningRooms] Network error leaving room:', err.message);
      });
    }
    if (setActiveRoom) setActiveRoom(null);
    if (setRoomPlaylists) setRoomPlaylists([]);
    setParticipants([]);
    setActivities([]);
    setChatMessages([]);
    if (showToast) showToast('Left Listening Room');
    if (typeof refreshRooms === 'function') {
      refreshRooms();
    }
  };

  // 3. Create Room
  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newRoomName.trim() || `${user?.displayName || user?.username || 'Host'}'s Lounge`;
    try {
      const res = await fetch(getApiUrl('/api/rooms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: newRoomDesc.trim(),
          user,
          isPublic: newRoomIsPublic
        })
      });
      const data = await res.json();
      if (data.success && data.room) {
        if (setActiveRoom) setActiveRoom(data.room);
        if (setRoomPlaylists) setRoomPlaylists(data.room.playlists || []);
        setParticipants(data.room.members || []);
        setActivities(data.room.activities || []);
        socket?.emit('join_listening_room', { roomId: data.room.roomId, user });
        socket?.emit('room:join', { roomId: data.room.roomId, user });
        if (showToast) showToast(`Created Room "${data.room.name}"`);
      }
    } catch (err) {
      if (showToast) showToast('Could not create room, please try again', 'error');
    }
    setIsCreating(false);
    setNewRoomName('');
    setNewRoomDesc('');
  };

  // 4. Share Invite Link / Code
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
          if (showToast) showToast(`Invite code: ${activeRoom.code || rId}`);
        });
    } else {
      if (showToast) showToast(`Invite code: ${activeRoom.code || rId}`);
    }
  };

  // 5. Host/Co-Host Broadcasts Active Playback to All Room Listeners
  const handleBroadcastSync = () => {
    if (!isCoHost) {
      if (showToast) showToast('Only Host or Co-Host can broadcast playback sync');
      return;
    }
    if (socket && activeRoom && currentSong) {
      const rId = activeRoom.roomId || activeRoom.id;
      const currentPos = currentTimeRef?.current || 0;
      socket.emit('room:playback:sync', {
        roomId: rId,
        currentSong,
        isPlaying,
        seekTime: currentPos,
        user
      });
      if (showToast) showToast('📡 Broadcasted current playback to all listeners');
    }
  };

  // 6. Upvote Song with Instant Optimistic State Update
  const handleVoteTrack = (playlistId, songId) => {
    const targetPlaylistId = playlistId || selectedPlaylistId;
    if (!activeRoom || !targetPlaylistId || !songId) return;
    const rId = activeRoom.roomId || activeRoom.id;
    const uidStr = String(currentUserId);

    let prevPlaylistsSnapshot = null;
    if (setRoomPlaylists) {
      setRoomPlaylists(prev => {
        prevPlaylistsSnapshot = prev;
        return (prev || []).map(pl => {
          if (pl.id !== targetPlaylistId) return pl;
          return {
            ...pl,
            songs: (pl.songs || []).map(s => {
              if (String(s.id || s.videoId) !== String(songId)) return s;
              const currentVotes = Array.isArray(s.votes) ? [...s.votes] : [];
              const idx = currentVotes.indexOf(uidStr);
              if (idx > -1) {
                currentVotes.splice(idx, 1);
              } else {
                currentVotes.push(uidStr);
              }
              return { ...s, votes: currentVotes };
            })
          };
        });
      });
    }
    
    if (socket) {
      socket.emit('room:playlist:vote', {
        roomId: rId,
        playlistId: targetPlaylistId,
        songId,
        userId: currentUserId
      }, (res) => {
        if (res && res.success === false && prevPlaylistsSnapshot && setRoomPlaylists) {
          setRoomPlaylists(prevPlaylistsSnapshot);
        }
      });
    } else {
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/playlists/${encodeURIComponent(targetPlaylistId)}/songs/${encodeURIComponent(songId)}/vote`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
      })
        .then(res => res.json())
        .then(data => {
          if (!data?.success && prevPlaylistsSnapshot && setRoomPlaylists) {
            setRoomPlaylists(prevPlaylistsSnapshot);
          }
        })
        .catch(() => {
          if (prevPlaylistsSnapshot && setRoomPlaylists) {
            setRoomPlaylists(prevPlaylistsSnapshot);
          }
        });
    }
  };

  const handleVoteSong = (songId) => handleVoteTrack(selectedPlaylistId, songId);

  // 7. Emoji Quick Reaction
  const handleSendReaction = (emoji) => {
    if (!activeRoom || !emoji) return;
    const rId = activeRoom.roomId || activeRoom.id;
    const senderName = user?.displayName || user?.username || 'You';
    const role = (isHost ? 'HOST' : isCoHost ? 'CO-HOST' : 'LISTENER').toUpperCase();
    const timestamp = new Date();

    const payload = {
      roomId: rId,
      emoji,
      senderName,
      role,
      user: {
        userId: currentUserId,
        displayName: senderName,
        username: user?.username || senderName,
        role,
        avatar: user?.avatarUrl || ''
      },
      timestamp
    };

    // Optimistically render reaction immediately on active room screen
    const localId = `react_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setFloatingReactions(prev => [
      ...prev,
      {
        id: localId,
        emoji,
        senderName: 'You',
        role,
        user: { displayName: 'You', role },
        left: Math.floor(Math.random() * 60) + 20
      }
    ]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== localId));
    }, 3200);

    // Optimistically add to Live Activity feed
    setActivities(prev => [
      {
        id: `act_${localId}`,
        type: 'reaction',
        emoji,
        text: `You reacted with ${emoji}`,
        user: { displayName: 'You', role },
        timestamp
      },
      ...(prev || []).slice(0, 49)
    ]);

    if (socket) {
      socket.emit('room:reaction', payload);
    }
  };

  // 8. Mini Chat Send with Strict Deduplication & Double-Submission Guards
  const handleSendChatMessage = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const text = chatInput.trim();
    if (!text || !activeRoom) return;

    if (isSendingChatMessageRef.current) return;
    isSendingChatMessageRef.current = true;
    setIsSendingChatMessage(true);

    const rId = activeRoom.roomId || activeRoom.id;
    const clientId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optimisticMessage = {
      id: clientId,
      clientId,
      text,
      user: {
        userId: currentUserId,
        username: user?.username || 'Listener',
        displayName: user?.displayName || user?.username || 'Listener',
        avatar: user?.avatarUrl || ''
      },
      timestamp: new Date()
    };

    setChatInput('');

    setChatMessages(prev => {
      const list = prev || [];
      const exists = list.some(m => m.id === clientId || m.clientId === clientId);
      if (exists) return list;
      return [...list.slice(-99), optimisticMessage];
    });

    const releaseLock = () => {
      setTimeout(() => {
        isSendingChatMessageRef.current = false;
        setIsSendingChatMessage(false);
      }, 250);
    };

    if (socket) {
      socket.emit('room:chat:send', { roomId: rId, text, clientId, messageId: clientId, user }, (res) => {
        releaseLock();
        if (res && res.success && res.message) {
          const serverMsg = res.message;
          setChatMessages(prev => {
            const list = prev || [];
            const idx = list.findIndex(m => m.id === clientId || m.clientId === clientId);
            if (idx > -1) {
              const updated = [...list];
              updated[idx] = { ...updated[idx], ...serverMsg };
              return updated.slice(-100);
            }
            if (!list.some(m => m.id === serverMsg.id)) {
              return [...list.slice(-99), serverMsg];
            }
            return list;
          });
        }
      });
    } else {
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/chat`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, clientId, messageId: clientId, user })
      })
        .then(res => res.json())
        .then(data => {
          releaseLock();
          if (data && data.success && data.message) {
            const serverMsg = data.message;
            setChatMessages(prev => {
              const list = prev || [];
              const idx = list.findIndex(m => m.id === clientId || m.clientId === clientId);
              if (idx > -1) {
                const updated = [...list];
                updated[idx] = { ...updated[idx], ...serverMsg };
                return updated.slice(-100);
              }
              if (!list.some(m => m.id === serverMsg.id)) {
                return [...list.slice(-99), serverMsg];
              }
              return list;
            });
          }
        })
        .catch(() => {
          releaseLock();
        });
    }
  };

  // 9. Fork Room Playlist to Personal Playlists ("Save Copy to My Playlists")
  const handleForkPlaylist = (roomPl) => {
    if (!roomPl || !Array.isArray(roomPl.songs) || roomPl.songs.length === 0) {
      if (showToast) showToast('Playlist is empty, nothing to save', 'warning');
      return;
    }

    const clonedSongs = roomPl.songs.map(s => ({ ...s }));
    const newPersonalPl = {
      id: Date.now().toString(),
      name: `${roomPl.name} (from Room)`,
      songs: clonedSongs
    };

    if (setPlaylists) {
      setPlaylists(prev => {
        const next = [...(prev || []), newPersonalPl];
        try {
          if (user) {
            localStorage.setItem('playlists', JSON.stringify(next));
          } else {
            localStorage.setItem('guest_playlists', JSON.stringify(next));
          }
        } catch (_) {}
        return next;
      });
      if (showToast) {
        showToast(`💾 Saved copy of "${roomPl.name}" (${clonedSongs.length} tracks) to your personal playlists!`);
      }
    }
  };

  // 10. Member Role Management & Kick
  const handleChangeRole = (targetUserId, newRole) => {
    if (!isHost || !activeRoom) return;
    const rId = activeRoom.roomId || activeRoom.id;
    if (socket) {
      socket.emit('room:member:role', { roomId: rId, targetUserId, role: newRole, user });
    } else {
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/members/${encodeURIComponent(targetUserId)}/role`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, requesterUser: user })
      }).catch(() => {});
    }
  };

  const handleKickMember = (targetUserId) => {
    if (!isCoHost || !activeRoom) return;
    const rId = activeRoom.roomId || activeRoom.id;
    if (socket) {
      socket.emit('room:member:kick', { roomId: rId, targetUserId, user });
    } else {
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/members/${encodeURIComponent(targetUserId)}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterUser: user })
      }).catch(() => {});
    }
  };

  // 11. Room Privacy, Invite Code & Archive Controls
  const handleTogglePrivacy = () => {
    if (!isHost || !activeRoom) return;
    const rId = activeRoom.roomId || activeRoom.id;
    const nextPublic = !activeRoom.isPublic;
    if (socket) {
      socket.emit('room:privacy:update', { roomId: rId, isPublic: nextPublic, user });
    } else {
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/privacy`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: nextPublic, requesterUser: user })
      }).catch(() => {});
    }
  };

  const handleRegenerateInviteCode = () => {
    if (!isHost || !activeRoom) return;
    const rId = activeRoom.roomId || activeRoom.id;
    if (socket) {
      socket.emit('room:invite:regenerate', { roomId: rId, user });
    } else {
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/invite/regenerate`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterUser: user })
      }).catch(() => {});
    }
  };

  const handleArchiveOrDeleteRoom = (action = 'archive') => {
    if (!isHost || !activeRoom) return;
    const rId = activeRoom.roomId || activeRoom.id;
    if (confirm(`Are you sure you want to ${action} this room?`)) {
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/archive`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, requesterUser: user })
      })
      .then(() => {
        handleLeave();
        refreshRooms();
      })
      .catch(() => {});
    }
  };

  // 12. Create / Remove Room Playlists
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
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/playlists`), {
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
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/playlists/${encodeURIComponent(playlistId)}/songs/${encodeURIComponent(songId)}`), {
        method: 'DELETE'
      }).catch(() => {});
    }
  };

  const activeSelectedPlaylist = (roomPlaylists || []).find(p => p.id === selectedPlaylistId) || (roomPlaylists && roomPlaylists[0]);

  // Sort playlist tracks by vote count if requested
  const displayedSongs = activeSelectedPlaylist?.songs ? [...activeSelectedPlaylist.songs].sort((a, b) => {
    if (sortByVotes) {
      const vA = (a.votes && a.votes.length) || 0;
      const vB = (b.votes && b.votes.length) || 0;
      if (vB !== vA) return vB - vA;
    }
    return 0;
  }) : [];

  return (
    <div
      className="fixed inset-0 z-[10000] bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating live emoji reactions layer */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-50">
          {floatingReactions.map(r => (
            <div
              key={r.id}
              className="absolute bottom-20 animate-floatUp select-none flex flex-col items-center drop-shadow-xl"
              style={{ left: `${r.left}%` }}
            >
              <span className="text-4xl filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">{r.emoji}</span>
              {(r.senderName || r.user?.displayName) && (
                <span className="text-[10px] font-bold bg-neutral-950/90 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full mt-1 shadow-lg backdrop-blur-md flex items-center gap-1">
                  <span>{r.senderName || r.user?.displayName}</span>
                  {r.role && (
                    <span className={`text-[8px] px-1 py-0.2 rounded font-mono font-black ${
                      r.role === 'HOST' ? 'bg-amber-500/30 text-amber-200' : 'bg-neutral-800 text-neutral-300'
                    }`}>
                      {r.role}
                    </span>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Collaborative Listening Rooms</h3>
                <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-semibold">
                  Live Rooms
                </span>
              </div>
              <p className="text-xs text-neutral-400">Sync playback, upvote songs, react with live emojis & collaborate</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer shrink-0"
            aria-label="Close Listening Rooms"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 pb-24 sm:pb-8 overflow-y-auto space-y-5 flex-1">
          {activeRoom ? (
            /* INSIDE ACTIVE ROOM */
            <div className="space-y-4">
              {/* Room Hero Banner */}
              <div className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-neutral-900 to-neutral-950 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono uppercase text-amber-400 tracking-wider font-bold">
                      Active Room
                    </span>
                    {activeRoom.code && (
                      <span className="text-[10px] font-mono bg-neutral-800 text-amber-300 px-2 py-0.5 rounded-md border border-neutral-700 flex items-center gap-1">
                        Code: {activeRoom.code}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 ${
                      activeRoom.isPublic ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    }`}>
                      {activeRoom.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      <span>{activeRoom.isPublic ? 'Public' : 'Invite-Only'}</span>
                    </span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-md uppercase font-mono">
                      Your Role: {userRole}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-white truncate">{activeRoom.name}</h4>
                  <p className="text-xs text-neutral-300 truncate">
                    Host: <span className="text-amber-400 font-medium">{activeRoom.createdBy?.displayName || 'Host'}</span>
                    {' • '}
                    <span>{participants.length} live members</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:justify-end shrink-0">
                  <button
                    onClick={() => setActiveTab(prev => prev === 'members' ? 'playlists' : 'members')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border shrink-0 whitespace-nowrap ${
                      activeTab === 'members'
                        ? 'bg-amber-500 text-neutral-950 border-amber-400'
                        : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-200'
                    }`}
                    title="View Room Members"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Members ({participants?.length || 0})</span>
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
                    title="Copy shareable room link"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-950" /> : <Share2 className="w-4 h-4" />}
                    <span>{copiedLink ? 'Copied Link!' : 'Invite'}</span>
                  </button>
                  <button
                    onClick={handleLeave}
                    className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition flex items-center gap-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Leave</span>
                  </button>
                </div>
              </div>

              {/* 1. Synchronized Listen-Along Mode Toggle & Controls */}
              {isUiVisible('btn.listenTogether') && (
                <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const next = !isRoomPlaybackSyncEnabled;
                        setIsRoomPlaybackSyncEnabled(next);
                        if (showToast) {
                          showToast(next ? '🎧 Listen Together enabled! Your player is now synced.' : 'Independent listening enabled');
                        }
                      }}
                      className={`relative w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                        isRoomPlaybackSyncEnabled ? 'bg-amber-500' : 'bg-neutral-700'
                      }`}
                      title="Toggle Synchronized Listen-Along"
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          isRoomPlaybackSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Listen Together / Sync Playback</span>
                        {isRoomPlaybackSyncEnabled && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        {isRoomPlaybackSyncEnabled 
                          ? 'Active: Your player auto-syncs with room host/co-host playback'
                          : 'Off: You can browse and listen independently'}
                      </p>
                    </div>
                  </div>

                  {isCoHost && isUiVisible('btn.broadcast') && (
                    <button
                      onClick={handleBroadcastSync}
                      disabled={!currentSong}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40 self-end sm:self-auto"
                      title="Broadcast your current playing song & timestamp to room"
                    >
                      <Radio className="w-3.5 h-3.5 text-amber-400" />
                      <span>Broadcast My Playback</span>
                    </button>
                  )}
                </div>
              )}

              {/* Quick Floating Emoji Reactions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                <div className="flex items-center gap-1 min-w-0">
                  {isUiVisible('btn.roomReactions') && (
                    <>
                      <span className="text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider shrink-0">Reactions:</span>
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        {QUICK_REACTIONS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => handleSendReaction(emoji)}
                            className="text-base sm:text-lg p-1 rounded-lg hover:bg-neutral-800 hover:scale-125 active:scale-95 transition cursor-pointer shrink-0"
                            title={`Send ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Collapsible Mini Chat Toggle */}
                {isUiVisible('btn.roomChat') && (
                  <button
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className="px-2.5 py-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ml-auto"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    <span>Room Chat</span>
                    {chatMessages.length > 0 && (
                      <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full">
                        {chatMessages.length}
                      </span>
                    )}
                    {isChatOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {/* Collapsible Mini Room Chat Box */}
              {isChatOpen && (
                <div className="p-3 rounded-2xl bg-neutral-950/90 border border-amber-500/30 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold border-b border-neutral-800 pb-2">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                      <span>Live Room Chat</span>
                    </span>
                    <span className="text-[10px] font-mono text-neutral-500">{chatMessages.length} messages</span>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1 text-xs scrollbar-thin">
                    {chatMessages.length === 0 ? (
                      <p className="text-center text-neutral-500 py-3 text-[11px]">No messages yet. Say hello!</p>
                    ) : (
                      chatMessages.map(m => (
                        <div key={m.id} className="p-2 rounded-xl bg-neutral-900/80 border border-neutral-800">
                          <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-0.5">
                            <span className="font-bold text-amber-400">{m.user?.displayName || 'Listener'}</span>
                            <span className="text-neutral-500 font-mono">
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-neutral-200 text-xs break-words">{m.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleSendChatMessage} className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Type a message to the room..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-700/80 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                      maxLength={200}
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isSendingChatMessage}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl transition disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}

              {/* DIRECT ROOM SONGS LIST */}
              {activeTab !== 'members' && (() => {
                const allRoomSongs = [];
                const seenIds = new Set();
                for (const pl of (roomPlaylists || [])) {
                  for (const s of (pl.songs || [])) {
                    const sid = s.id || s.videoId;
                    if (sid && !seenIds.has(sid)) {
                      seenIds.add(sid);
                      allRoomSongs.push({ ...s, _playlistId: pl.id });
                    }
                  }
                }
                const sortedSongs = [...allRoomSongs].sort((a, b) => {
                  if (!sortByVotes) return 0;
                  return ((b.votes && b.votes.length) || 0) - ((a.votes && a.votes.length) || 0);
                });

                return (
                  <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4 text-amber-400" />
                        <h5 className="text-xs font-bold text-white uppercase tracking-wider">ROOM SONGS</h5>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-amber-400 font-mono font-semibold">
                          {sortedSongs.length}
                        </span>
                      </div>
                      <button
                        onClick={() => setSortByVotes(!sortByVotes)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition flex items-center gap-1 ${
                          sortByVotes
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>{sortByVotes ? 'Top Voted' : 'Default'}</span>
                      </button>
                    </div>

                    {sortedSongs.length === 0 ? (
                      <div className="text-center py-6 text-neutral-500 text-xs">
                        No songs in this room yet. Use "Add to Playlist" on any song to add it here.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {sortedSongs.map((song, idx) => {
                          const sid = song.id || song.videoId;
                          const voteCount = song.votes ? song.votes.length : 0;
                          const hasVoted = song.votes && song.votes.includes(currentUserId);
                          return (
                            <div
                              key={sid || idx}
                              className="group p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80 hover:border-amber-500/40 flex items-center justify-between gap-3 transition"
                            >
                              <div
                                onClick={() => onPlaySong && onPlaySong(song)}
                                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                              >
                                <img
                                  src={song.thumbnail || `https://i.ytimg.com/vi/${sid}/mqdefault.jpg`}
                                  alt={song.title}
                                  className="w-9 h-9 rounded-lg object-cover shrink-0 bg-neutral-800"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition">{song.title}</p>
                                  <p className="text-[11px] text-neutral-400 truncate">{song.artist || song.channel || 'Loopra Artist'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => handleVoteTrack(song._playlistId, sid)}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 ${
                                    hasVoted
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                      : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                                  }`}
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                  <span>{voteCount}</span>
                                </button>
                                <button
                                  onClick={() => onPlaySong && onPlaySong(song)}
                                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-neutral-300 transition"
                                  title="Play track"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                </button>
                                {isCoHost && (
                                  <button
                                    onClick={() => handleRemoveTrackFromRoomPlaylist(song._playlistId, sid)}
                                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-500/20 hover:text-rose-400 text-neutral-500 transition"
                                    title="Remove from room"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {false && (
                <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h5 className="text-sm font-bold text-white flex items-center gap-2">
                        <Music className="w-4 h-4 text-amber-400" />
                        <span>Room Playlists & Upvote Queue</span>
                      </h5>
                      <p className="text-[11px] text-neutral-400">Upvoted tracks live-rank higher in the collaborative queue</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSortByVotes(!sortByVotes)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition flex items-center gap-1 ${
                          sortByVotes
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                        title="Sort songs by upvotes"
                      >
                        <ArrowUpDown className="w-3 h-3" />
                        <span>{sortByVotes ? 'Ranked by Upvotes' : 'Default Order'}</span>
                      </button>

                      <button
                        onClick={() => setIsCreatingPlaylist(!isCreatingPlaylist)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-medium transition flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Room Playlist</span>
                      </button>
                    </div>
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

                      {/* Active Playlist Header & Actions */}
                      {activeSelectedPlaylist && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{activeSelectedPlaylist.name}</span>
                              <span className="text-neutral-500">• {activeSelectedPlaylist.songs?.length || 0} tracks</span>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Save Copy to My Playlists (Fork Button) */}
                              <button
                                onClick={() => handleForkPlaylist(activeSelectedPlaylist)}
                                className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center gap-1 font-semibold text-[11px] transition"
                                title="Copy all songs from this room playlist to your personal library"
                              >
                                <Copy className="w-3 h-3 text-amber-400" />
                                <span>Save Copy to My Playlists</span>
                              </button>

                              {activeSelectedPlaylist.songs?.length > 0 && (
                                <button
                                  onClick={() => {
                                    if (onPlaySong && displayedSongs[0]) {
                                      onPlaySong(displayedSongs[0]);
                                      if (showToast) showToast(`Playing: ${activeSelectedPlaylist.name}`);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-semibold text-[11px] transition"
                                >
                                  <Play className="w-3 h-3 fill-emerald-400" />
                                  <span>Play Top</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Song List */}
                          {(!displayedSongs || displayedSongs.length === 0) ? (
                            <div className="text-center py-6 bg-neutral-900/60 rounded-xl border border-neutral-800 text-xs text-neutral-500">
                              <p>This room playlist is empty.</p>
                              <p className="mt-1 text-neutral-400">
                                Use the <span className="text-amber-400 font-medium">"Add to Playlist"</span> button on any song to add it here live!
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                              {displayedSongs.map((song, i) => {
                                const songKey = song.id || song.videoId || i;
                                const votes = song.votes || [];
                                const hasVoted = votes.includes(String(currentUserId));
                                const voteCount = votes.length;
                                const songLiked = typeof isLiked === 'function' ? isLiked(song) : false;

                                return (
                                  <div
                                    key={songKey}
                                    className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800/80 hover:border-amber-500/30 flex items-center justify-between gap-3 group transition"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                      {/* Upvote Button with Live Counter */}
                                      <button
                                        onClick={() => handleVoteSong(song.id || song.videoId)}
                                        className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                                          hasVoted 
                                            ? 'bg-amber-500 text-neutral-950 shadow-sm shadow-amber-500/20' 
                                            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-amber-300'
                                        }`}
                                        title={hasVoted ? 'Remove your upvote' : 'Upvote this track'}
                                      >
                                        <ThumbsUp className={`w-3.5 h-3.5 ${hasVoted ? 'fill-neutral-950' : ''}`} />
                                        <span>{voteCount}</span>
                                      </button>

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

                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-white truncate">{song.title}</p>
                                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 truncate">
                                          <span className="truncate">{song.artist || song.channel}</span>
                                          {song.addedBy?.displayName && (
                                            <span className="text-[10px] font-medium bg-neutral-800 text-amber-300 px-1.5 py-0.2 rounded shrink-0">
                                              Added by {song.addedBy.displayName}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      {/* Like / Favorite Button */}
                                      {onToggleLike && (
                                        <button
                                          type="button"
                                          onClick={() => onToggleLike(song)}
                                          className={`p-1.5 rounded-lg border transition cursor-pointer active:scale-95 ${
                                            songLiked
                                              ? 'bg-pink-500/10 border-pink-500/30 text-pink-400'
                                              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-pink-400 border-neutral-700'
                                          }`}
                                          title={songLiked ? 'Remove from Favourites' : 'Add to Favourites'}
                                          aria-label={songLiked ? 'Remove from Favourites' : 'Add to Favourites'}
                                        >
                                          <Heart className={`w-3.5 h-3.5 ${songLiked ? 'fill-current text-pink-500' : ''}`} />
                                        </button>
                                      )}

                                      <button
                                        onClick={() => onPlaySong && onPlaySong(song)}
                                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-neutral-300 transition"
                                        title="Play track"
                                      >
                                        <Play className="w-3.5 h-3.5 fill-current" />
                                      </button>
                                      {isCoHost && (
                                        <button
                                          onClick={() => handleRemoveTrackFromRoomPlaylist(activeSelectedPlaylist.id, song.id || song.videoId)}
                                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-500/20 hover:text-rose-400 text-neutral-500 transition opacity-0 group-hover:opacity-100"
                                          title="Remove from room playlist"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: LIVE ACTIVITY FEED (Removed) */}
              {false && activeTab === 'activity' && (
                <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Live Activity Feed</span>
                    </h5>
                    <span className="text-[10px] text-neutral-500 font-mono">{activities.length} events</span>
                  </div>

                  {activities.length === 0 ? (
                    <p className="text-center text-xs text-neutral-500 py-6">No recent activity logged in this room yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {activities.map((act, idx) => (
                        <div key={act.id || idx} className="p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <p className="text-neutral-200 truncate">{act.text}</p>
                          </div>
                          <span className="text-[10px] text-neutral-500 font-mono shrink-0">
                            {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: MEMBER ROLES & PRIVACY MANAGEMENT */}
              {activeTab === 'members' && (
                <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>Room Members & Roles</span>
                    </h5>
                    <span className="text-xs text-neutral-400">{participants.length} connected</span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {participants.map(m => {
                      const isTargetHost = m.role === 'host';
                      const isTargetCoHost = m.role === 'co-host';

                      return (
                        <div
                          key={m.userId || m.username}
                          className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white">{m.displayName || m.username}</span>
                                {isTargetHost ? (
                                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono font-bold flex items-center gap-0.5">
                                    <Crown className="w-2.5 h-2.5" /> Host
                                  </span>
                                ) : isTargetCoHost ? (
                                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-mono font-bold">
                                    Co-Host
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.2 rounded font-mono">
                                    Listener
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-neutral-500">
                                Joined {new Date(m.joinedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          {/* Host Controls */}
                          {isHost && m.userId !== currentUserId && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isTargetCoHost ? (
                                <button
                                  onClick={() => handleChangeRole(m.userId, 'listener')}
                                  className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] rounded-lg transition"
                                  title="Demote to Listener"
                                >
                                  Demote
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleChangeRole(m.userId, 'co-host')}
                                  className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] rounded-lg transition"
                                  title="Promote to Co-Host"
                                >
                                  Promote
                                </button>
                              )}
                              <button
                                onClick={() => handleKickMember(m.userId)}
                                className="p-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition"
                                title="Remove member from room"
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Host Room Settings Section */}
                  {isHost && (
                    <div className="mt-4 pt-3 border-t border-neutral-800 space-y-3">
                      <h6 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-amber-400" />
                        <span>Host Room Settings</span>
                      </h6>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleTogglePrivacy}
                          className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          {activeRoom.isPublic ? <Lock className="w-3.5 h-3.5 text-purple-400" /> : <Globe className="w-3.5 h-3.5 text-emerald-400" />}
                          <span>Change to {activeRoom.isPublic ? 'Invite-Only' : 'Public'}</span>
                        </button>

                        <button
                          onClick={handleRegenerateInviteCode}
                          className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition"
                          title="Revoke existing code and issue a fresh 6-char code"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                          <span>Regenerate Invite Code</span>
                        </button>

                        <button
                          onClick={() => handleArchiveOrDeleteRoom('archive')}
                          className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-amber-500/30 hover:bg-amber-500/10 text-amber-300 text-xs font-semibold transition"
                        >
                          Archive Room
                        </button>

                        <button
                          onClick={() => handleArchiveOrDeleteRoom('delete')}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition"
                        >
                          Delete Room
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ROOM BROWSER & CREATION SCREEN */
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
                <form onSubmit={handleCreate} className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-3 animate-fadeIn">
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
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs text-neutral-300 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newRoomIsPublic}
                        onChange={(e) => setNewRoomIsPublic(e.target.checked)}
                        className="rounded border-neutral-700 text-amber-500 focus:ring-0"
                      />
                      <span>Make Room Public (visible in directory)</span>
                    </label>
                  </div>
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
                          Host: {r.createdBy?.displayName || 'Host'}
                        </p>
                        {r.description && (
                          <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">{r.description}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60">
                        <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{r.memberCount || 1} members</span>
                        </span>
                        <button
                          onClick={() => setSelectedPreviewRoom(r)}
                          className="px-3 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500 hover:text-neutral-950 text-amber-300 text-xs font-semibold border border-amber-500/30 transition"
                        >
                          Preview Room
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Room Details & Preview Sub-Modal with Explicit Join button */}
          {selectedPreviewRoom && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
              <div 
                className="w-full max-w-sm bg-neutral-900 border border-neutral-700/80 rounded-2xl p-5 shadow-2xl space-y-4 animate-scaleUp"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-amber-400" />
                    <h3 className="font-bold text-sm text-white">{selectedPreviewRoom.name}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPreviewRoom(null)}
                    className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Host:</span>
                    <span className="text-white font-bold">{selectedPreviewRoom.createdBy?.displayName || selectedPreviewRoom.createdBy?.username || 'Host'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Active Listeners:</span>
                    <span className="text-emerald-400 font-mono font-semibold">{selectedPreviewRoom.memberCount || 1} online</span>
                  </div>
                  {selectedPreviewRoom.code && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Room Code:</span>
                      <span className="text-amber-400 font-mono font-bold">{selectedPreviewRoom.code}</span>
                    </div>
                  )}
                  {selectedPreviewRoom.description && (
                    <p className="text-[11px] text-neutral-400 pt-1 border-t border-neutral-800/80">
                      {selectedPreviewRoom.description}
                    </p>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-neutral-400">
                  Preview mode does not join or count you as an active member until you click Join Room.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setSelectedPreviewRoom(null)}
                    className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedPreviewRoom.code || selectedPreviewRoom.roomId || selectedPreviewRoom.id;
                      setSelectedPreviewRoom(null);
                      handleJoin(target);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition active:scale-95"
                  >
                    Join Room
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}