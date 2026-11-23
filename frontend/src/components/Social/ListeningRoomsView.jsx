import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Plus, Trash2, Play, Music, Share2, Copy, Check, 
  Sparkles, Radio, Disc, Volume2, Shield, Heart, Flame,
  ThumbsUp, MessageSquare, Send, ChevronDown, ChevronUp,
  RefreshCw, Lock, Globe, LogOut, ArrowUpDown, Award, Crown,
  UserCheck, UserMinus, UserX, ArrowLeft, FolderPlus, X
} from 'lucide-react';
import { getApiUrl } from '../../utils/apiUrl';
import { isValidMusicTrack, parseDurationToSeconds, sanitizeTrack } from '../../services/songFilter';

const QUICK_REACTIONS = ['🔥', '❤️', '🕺', '😭'];

export default function ListeningRoomsView({
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
  onBackToHome,
  onToggleLike,
  isLiked
}) {
  const [rooms, setRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'created' | 'joined'
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomIsPublic, setNewRoomIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedImportPlaylistIds, setSelectedImportPlaylistIds] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [isRegeneratingCode, setIsRegeneratingCode] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [detailedPlaylistView, setDetailedPlaylistView] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  
  // Workspace tabs
  const [activeTab, setActiveTab] = useState('playlists'); // 'playlists' | 'activity' | 'members'
  const [sortByVotes, setSortByVotes] = useState(true);
  const [activities, setActivities] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);

  const currentUserId = user?._id?.toString?.() || user?.userId || (typeof window !== 'undefined' ? localStorage.getItem('afterhours_session_id') : '') || 'guest';
  const currentUsername = user?.username || 'Listener';

  // Find user's member role in current active room
  const currentMember = (participants || []).find(m => 
    (m.userId && m.userId === currentUserId) || 
    (m.username && m.username === currentUsername)
  );
  const userRole = currentMember?.role || (activeRoom?.createdBy?.userId === currentUserId ? 'host' : 'listener');
  const isHost = userRole === 'host';
  const isCoHost = userRole === 'co-host' || isHost;

  // Refresh rooms from backend
  const refreshRooms = () => {
    setIsLoadingRooms(true);
    const guestId = typeof window !== 'undefined' ? localStorage.getItem('afterhours_session_id') : '';
    const myParam = currentUserId ? `?userId=${encodeURIComponent(currentUserId)}&guestId=${encodeURIComponent(guestId)}` : '';
    
    fetch(getApiUrl(`/api/rooms${myParam}`))
      .then(res => res.json())
      .then(data => {
        if (data && data.rooms) {
          setRooms(data.rooms);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingRooms(false));
  };

  useEffect(() => {
    refreshRooms();
  }, [currentUserId]);

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

  // Listen to incoming live room updates via Socket.io
  useEffect(() => {
    if (!socket) return;

    const handleRoomState = (data) => {
      if (!data) return;
      if (setActiveRoom) setActiveRoom(data);
      if (setRoomPlaylists && data.playlists) setRoomPlaylists(data.playlists);
      if (data.members) setParticipants(data.members);
      if (data.activities) setActivities(data.activities);
      if (data.chatMessages) setChatMessages(data.chatMessages);
    };

    const handleMembersUpdated = (data) => {
      if (data?.members) {
        setParticipants(data.members);
        if (activeRoom && setActiveRoom) {
          setActiveRoom(prev => prev ? { ...prev, members: data.members } : prev);
        }
      }
    };

    const handleMemberKicked = (data) => {
      if (data?.targetUserId === currentUserId) {
        if (showToast) showToast('You were removed from the room by the host', 'warning');
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
        setChatMessages(prev => [...prev.slice(-49), data.message]);
      }
    };

    const handleReaction = (data) => {
      if (data?.emoji) {
        const id = data.id || `react_${Date.now()}_${Math.random()}`;
        setFloatingReactions(prev => [
          ...prev, 
          { id, emoji: data.emoji, user: data.user, left: Math.floor(Math.random() * 70) + 15 }
        ]);
        setTimeout(() => {
          setFloatingReactions(prev => prev.filter(r => r.id !== id));
        }, 3200);
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

  // 1. Join Room
  const handleJoin = async (roomIdOrCode) => {
    if (!roomIdOrCode) return;
    const target = roomIdOrCode.trim();
    if (!target) return;

    try {
      const res = await fetch(getApiUrl('/api/rooms/join'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: target, user })
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
        refreshRooms();
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
    if (activeRoom) {
      const rId = activeRoom.roomId || activeRoom.id;
      socket?.emit('leave_listening_room', { roomId: rId });
      socket?.emit('room:leave', { roomId: rId, user });
      // Call REST fallback to ensure server persistence
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/leave`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, userId: currentUserId })
      }).catch(() => {});
    }
    if (setActiveRoom) setActiveRoom(null);
    if (setRoomPlaylists) setRoomPlaylists([]);
    setParticipants([]);
    setActivities([]);
    setChatMessages([]);
    if (showToast) showToast('Left Listening Room');
    refreshRooms();
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
      if ((res.status === 201 || res.status === 200) && data.success && data.room) {
        if (setActiveRoom) setActiveRoom(data.room);
        if (setRoomPlaylists) setRoomPlaylists(data.room.playlists || []);
        setParticipants(data.room.members || []);
        setActivities(data.room.activities || []);
        socket?.emit('join_listening_room', { roomId: data.room.roomId, user });
        socket?.emit('room:join', { roomId: data.room.roomId, user });
        if (showToast) showToast(`Created Room "${data.room.name}"`);
        refreshRooms();
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
    const rCode = activeRoom.code || activeRoom.roomId;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/?room=${encodeURIComponent(rCode)}`;
    
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2000);
          if (showToast) showToast(`Link copied: ${shareUrl}`);
        })
        .catch(() => {
          if (showToast) showToast(`Room Code: ${rCode}`);
        });
    } else {
      if (showToast) showToast(`Room Code: ${rCode}`);
    }
  };

  // 5. Host broadcast sync
  const handleBroadcastSync = () => {
    if (!activeRoom || !currentSong) return;
    const rId = activeRoom.roomId || activeRoom.id;
    const seekTime = currentTimeRef?.current || 0;
    
    if (socket) {
      socket.emit('room:playback:sync', {
        roomId: rId,
        currentSong,
        isPlaying,
        seekTime,
        user
      });
      if (showToast) showToast('Broadcasted playback state to room!');
    }
  };

  // 6. Upvote / Vote for track with Instant Optimistic State Update
  const handleVoteTrack = (playlistId, songId) => {
    if (!activeRoom || !playlistId || !songId) return;
    const rId = activeRoom.roomId || activeRoom.id;
    const uidStr = String(currentUserId);

    // Save previous state for rollback on error
    let prevPlaylistsSnapshot = null;
    if (setRoomPlaylists) {
      setRoomPlaylists(prev => {
        prevPlaylistsSnapshot = prev;
        return (prev || []).map(pl => {
          if (pl.id !== playlistId) return pl;
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
        playlistId,
        songId,
        userId: currentUserId
      }, (res) => {
        if (res && res.success === false && prevPlaylistsSnapshot && setRoomPlaylists) {
          setRoomPlaylists(prevPlaylistsSnapshot);
        }
      });
    } else {
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/playlists/${encodeURIComponent(playlistId)}/songs/${encodeURIComponent(songId)}/vote`), {
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

  // 7. Send Chat Message
  const handleSendChat = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!chatInput.trim() || !activeRoom) return;
    const rId = activeRoom.roomId || activeRoom.id;
    const text = chatInput.trim();

    // Optimistically show message immediately in sender's chat
    const tempId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const optimisticMessage = {
      id: tempId,
      text,
      user: {
        userId: currentUserId,
        username: user?.username || 'Listener',
        displayName: user?.displayName || user?.username || 'Listener',
        avatar: user?.avatarUrl || ''
      },
      timestamp: new Date()
    };
    setChatMessages(prev => {
      const filtered = (prev || []).filter(m => m.id !== tempId);
      return [...filtered.slice(-49), optimisticMessage];
    });

    if (socket) {
      socket.emit('room:chat:send', {
        roomId: rId,
        text,
        user
      }, (res) => {
        if (res && res.success && res.message) {
          setChatMessages(prev => {
            const list = (prev || []).map(m => m.id === tempId ? res.message : m);
            if (!list.some(m => m.id === res.message.id)) list.push(res.message);
            return list.slice(-50);
          });
        }
      });
    } else {
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/chat`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, user })
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.message) {
            setChatMessages(prev => {
              const list = (prev || []).map(m => m.id === tempId ? data.message : m);
              if (!list.some(m => m.id === data.message.id)) list.push(data.message);
              return list.slice(-50);
            });
          }
        })
        .catch(() => {});
    }
    setChatInput('');
  };

  // 8. Send Live Emoji Reaction
  const handleSendReaction = (emoji) => {
    if (!activeRoom) return;
    const rId = activeRoom.roomId || activeRoom.id;
    if (socket) {
      socket.emit('room:react', {
        roomId: rId,
        emoji,
        user: { displayName: user?.displayName || user?.username || 'Listener' }
      });
    }
  };

  // 9. Fork Room Playlist to Personal Playlists ("Save Copy to My Playlists")
  const handleForkPlaylist = (roomPl) => {
    if (!roomPl || !Array.isArray(roomPl.songs) || roomPl.songs.length === 0) {
      if (showToast) showToast('Playlist is empty, nothing to save', 'warning');
      return;
    }

    const newForked = {
      id: `pl_${Date.now()}_fork_${Math.random().toString(36).substring(2, 6)}`,
      name: `${roomPl.name} (from ${activeRoom?.name || 'Room'})`,
      description: `Copied from collaborative room ${activeRoom?.name || ''} on ${new Date().toLocaleDateString()}`,
      songs: (roomPl.songs || []).map(s => ({
        ...s,
        id: String(s.id || s.videoId),
        videoId: String(s.videoId || s.id),
        title: s.title || 'Untitled Track',
        artist: s.artist || s.channel || 'Unknown Artist',
        thumbnail: s.thumbnail || '',
        duration: s.duration || '',
        durationSec: s.durationSec || 0
      })),
      isCollaborativeCopy: true,
      roomSource: activeRoom?.name || 'Room'
    };

    if (setPlaylists) {
      setPlaylists(prev => {
        const next = [newForked, ...(prev || [])];
        try {
          if (user) {
            localStorage.setItem('playlists', JSON.stringify(next));
          } else {
            localStorage.setItem('guest_playlists', JSON.stringify(next));
            localStorage.setItem('playlists', JSON.stringify(next));
          }
        } catch (e) {}
        return next;
      });
      if (showToast) showToast(`Saved "${newForked.name}" to Your Playlists!`);
    }
  };

  // 10. Admin role change
  const handleChangeRole = (targetUserId, newRole) => {
    if (!activeRoom || !isHost) return;
    const rId = activeRoom.roomId || activeRoom.id;

    if (socket) {
      socket.emit('room:member:set_role', {
        roomId: rId,
        targetUserId,
        role: newRole,
        requesterUser: user
      });
    } else {
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/members/${encodeURIComponent(targetUserId)}/role`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, requesterUser: user })
      }).catch(() => {});
    }
  };

  // 11. Kick member
  const handleKickMember = (targetUserId) => {
    if (!activeRoom || !isHost) return;
    const rId = activeRoom.roomId || activeRoom.id;

    if (socket) {
      socket.emit('room:member:kick', {
        roomId: rId,
        targetUserId,
        requesterUser: user
      });
    } else {
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/members/${encodeURIComponent(targetUserId)}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterUser: user })
      }).catch(() => {});
    }
  };

  // 12. Privacy toggle
  const handleTogglePrivacy = async () => {
    if (!activeRoom || !isHost || isUpdatingPrivacy) return;
    const rId = activeRoom.roomId || activeRoom.id;
    const nextVal = !activeRoom.isPublic;
    setIsUpdatingPrivacy(true);

    // Optimistic UI update
    setActiveRoom(prev => prev ? { ...prev, isPublic: nextVal } : prev);

    if (socket) {
      socket.emit('room:privacy:update', {
        roomId: rId,
        isPublic: nextVal,
        user
      }, (res) => {
        setIsUpdatingPrivacy(false);
        if (res && res.success) {
          if (showToast) showToast(`Room is now ${res.isPublic ? 'Public' : 'Invite-Only'}`);
        } else {
          setActiveRoom(prev => prev ? { ...prev, isPublic: !nextVal } : prev);
          if (showToast) showToast(res?.error || 'Failed to update privacy', 'error');
        }
      });
    } else {
      try {
        const res = await fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/privacy`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublic: nextVal, user })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (showToast) showToast(`Room is now ${data.isPublic ? 'Public' : 'Invite-Only'}`);
        } else {
          setActiveRoom(prev => prev ? { ...prev, isPublic: !nextVal } : prev);
          if (showToast) showToast(data?.error || 'Failed to update privacy', 'error');
        }
      } catch (e) {
        setActiveRoom(prev => prev ? { ...prev, isPublic: !nextVal } : prev);
        if (showToast) showToast('Network error updating privacy', 'error');
      } finally {
        setIsUpdatingPrivacy(false);
      }
    }
  };

  // 13. Regenerate room code
  const handleRegenerateCode = async () => {
    if (!activeRoom || !isHost || isRegeneratingCode) return;
    const rId = activeRoom.roomId || activeRoom.id;
    setIsRegeneratingCode(true);

    if (socket) {
      socket.emit('room:invite:regenerate', {
        roomId: rId,
        user
      }, (res) => {
        setIsRegeneratingCode(false);
        if (res && res.success && res.code) {
          setActiveRoom(prev => prev ? { ...prev, code: res.code } : prev);
          if (showToast) showToast(`🔑 New room invite code: ${res.code}`);
        } else {
          if (showToast) showToast(res?.error || 'Failed to generate new code', 'error');
        }
      });
    } else {
      try {
        const res = await fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/invite/regenerate`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user })
        });
        const data = await res.json();
        if (res.ok && data.success && data.code) {
          setActiveRoom(prev => prev ? { ...prev, code: data.code } : prev);
          if (showToast) showToast(`🔑 New room invite code: ${data.code}`);
        } else {
          if (showToast) showToast(data?.error || 'Failed to generate new code', 'error');
        }
      } catch (e) {
        if (showToast) showToast('Network error generating new code', 'error');
      } finally {
        setIsRegeneratingCode(false);
      }
    }
  };

  // 14. Archive or delete room
  const handleArchiveOrDeleteRoom = (action) => {
    if (!activeRoom || !isHost) return;
    const rId = activeRoom.roomId || activeRoom.id;

    if (socket) {
      socket.emit('room:archive', {
        roomId: rId,
        action,
        user
      });
    } else {
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/archive`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, user })
      }).catch(() => {});
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

  // Import Personal Playlists into Collaborative Room (Multi-Select, with >= 75s duration and isValidMusicTrack gate)
  const handleImportPersonalPlaylists = async (selectedList) => {
    if (!Array.isArray(selectedList) || selectedList.length === 0 || !activeRoom) return;
    const rId = activeRoom.roomId || activeRoom.id;
    setIsImporting(true);

    let successCount = 0;
    let totalImportedTracks = 0;

    for (const personalPl of selectedList) {
      const rawSongs = Array.isArray(personalPl.songs) ? personalPl.songs : [];

      // Filter strictly to valid music tracks >= 75 seconds and deep-clone into independent room track objects
      const validSongs = rawSongs
        .map(s => (sanitizeTrack ? sanitizeTrack(s) : s))
        .filter(s => {
          if (!s) return false;
          const dur = parseDurationToSeconds ? parseDurationToSeconds(s) : (s.durationSec || s.durationSeconds || s.duration || 0);
          return dur >= 75 && (!isValidMusicTrack || isValidMusicTrack(s));
        })
        .map((s, idx) => ({
          id: String(s.id || s.videoId || `track_${Date.now()}_${idx}`),
          videoId: String(s.videoId || s.id || ''),
          title: String(s.title || 'Untitled Track').slice(0, 150),
          artist: String(s.artist || s.channel || 'Unknown Artist').slice(0, 100),
          channel: String(s.channel || s.artist || 'Unknown Artist').slice(0, 100),
          thumbnail: s.thumbnail || s.coverArt || '',
          duration: s.duration || '',
          durationSec: s.durationSec || 0,
          addedBy: {
            userId: currentUserId,
            username: user?.username || 'Listener',
            displayName: user?.displayName || user?.username || 'Listener'
          },
          votes: []
        }));

      const playlistName = personalPl.name?.trim() || 'Imported Playlist';
      const playlistDesc = personalPl.description || `Imported from ${user?.displayName || user?.username || 'user'}'s playlists`;

      try {
        if (socket) {
          await new Promise((resolve) => {
            socket.emit('room:playlist:create', {
              roomId: rId,
              name: playlistName,
              description: playlistDesc,
              user,
              songs: validSongs
            }, (res) => {
              if (res && res.success) {
                successCount++;
                totalImportedTracks += validSongs.length;
                if (res.playlist?.id) setSelectedPlaylistId(res.playlist.id);
              }
              resolve();
            });
          });
        } else {
          const res = await fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/playlists`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: playlistName,
              description: playlistDesc,
              user,
              songs: validSongs
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            successCount++;
            totalImportedTracks += validSongs.length;
            if (data.playlist?.id) setSelectedPlaylistId(data.playlist.id);
          }
        }
      } catch (err) {
        console.warn('Error importing playlist:', personalPl.name, err);
      }
    }

    setIsImporting(false);
    setIsImportModalOpen(false);
    setSelectedImportPlaylistIds([]);

    if (successCount > 0) {
      if (showToast) {
        showToast(`✅ Imported ${successCount} playlist${successCount > 1 ? 's' : ''} (${totalImportedTracks} tracks) to room`);
      }
    } else {
      if (showToast) showToast('Could not import selected playlists', 'error');
    }
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

  // Filter rooms according to active chip
  const filteredRooms = rooms.filter(r => {
    if (filterTab === 'created') {
      return r.createdBy?.userId === currentUserId;
    }
    if (filterTab === 'joined') {
      return r.createdBy?.userId !== currentUserId;
    }
    return true;
  });

  return (
    <div className="page-transition w-full px-2 sm:px-4 md:px-8 space-y-6 relative z-10 pb-32">
      {/* Floating live emoji reactions layer */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
        {floatingReactions.map(r => (
          <div
            key={r.id}
            className="absolute bottom-24 animate-floatUp text-3xl select-none flex flex-col items-center"
            style={{ left: `${r.left}%` }}
          >
            <span>{r.emoji}</span>
            {r.user?.displayName && (
              <span className="text-[9px] font-medium bg-black/60 text-amber-300 px-1.5 py-0.5 rounded-full mt-0.5">
                {r.user.displayName}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* VIEW A: DEDICATED ROOM WORKSPACE (When a room is active/opened) */}
      {activeRoom ? (
        <div className="space-y-5 animate-fadeIn">
          {/* Header Bar */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  // Leave active view without disconnecting or leave completely
                  setActiveRoom(null);
                }}
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer border border-neutral-700/50"
                title="Back to All Rooms"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">All Rooms</span>
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400/90 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                    Live Listening Room
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                    activeRoom.isPublic 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  }`}>
                    {activeRoom.isPublic ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                    <span>{activeRoom.isPublic ? 'Public' : 'Invite-Only'}</span>
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-display font-black tracking-tight text-white mt-1 flex items-center gap-2">
                  <span>{activeRoom.name}</span>
                  {activeRoom.code && (
                    <span className="text-xs font-mono font-bold text-amber-300 bg-neutral-800/90 px-2 py-0.5 rounded-md border border-amber-500/30">
                      {activeRoom.code}
                    </span>
                  )}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer"
                title="Copy Share Link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied!' : 'Invite'}</span>
              </button>

              <button
                onClick={handleLeave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs transition active:scale-95 cursor-pointer"
                title="Leave Room"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Leave Room</span>
              </button>
            </div>
          </div>

          {/* Quick Active Room Members Strip */}
          <div 
            onClick={() => setActiveTab('members')}
            className="p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 hover:border-neutral-700 transition flex items-center justify-between gap-3 cursor-pointer group"
            title="Click to view full Members list"
          >
            <div className="flex items-center gap-2.5 overflow-x-auto py-0.5 scrollbar-none">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Room Members ({participants.length}):</span>
              </span>
              <div className="flex items-center -space-x-1.5 overflow-hidden">
                {participants.slice(0, 6).map((m, idx) => {
                  const mRole = m.role || 'listener';
                  const isHostMember = mRole === 'host';
                  const isCoHostMember = mRole === 'co-host';
                  return (
                    <div
                      key={m.userId || m.socketId || idx}
                      className={`relative w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-neutral-900 shadow-sm ${
                        isHostMember ? 'bg-amber-600 text-amber-100 ring-1 ring-amber-400' :
                        isCoHostMember ? 'bg-emerald-600 text-emerald-100 ring-1 ring-emerald-400' :
                        'bg-neutral-700 text-neutral-200'
                      }`}
                      title={`${m.displayName || m.username || 'Listener'} (${mRole.toUpperCase()}) - Online`}
                    >
                      {m.displayName ? m.displayName.charAt(0).toUpperCase() : 'U'}
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-black" />
                    </div>
                  );
                })}
              </div>
              {participants.length > 6 && (
                <span className="text-[10px] text-neutral-400 font-bold bg-neutral-800 px-1.5 py-0.5 rounded-full">
                  +{participants.length - 6}
                </span>
              )}
            </div>
            <span className="text-[11px] text-amber-400 font-semibold group-hover:underline shrink-0">
              View All ({participants.length}) →
            </span>
          </div>

          {/* Room Controls Strip: Listen Together & Secondary Tools */}
          <div className="p-3 sm:p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const next = !isRoomPlaybackSyncEnabled;
                  if (typeof setIsRoomPlaybackSyncEnabled === 'function') {
                    setIsRoomPlaybackSyncEnabled(next);
                  }
                  if (showToast) {
                    showToast(next ? '🎧 Listen Together enabled! Your player is now synced.' : 'Independent listening enabled');
                  }
                }}
                className={`relative w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 cursor-pointer ${
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
                  <span className="text-xs font-bold text-white">Listen Together (Sync Playback)</span>
                  {isRoomPlaybackSyncEnabled && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>
                <p className="text-[11px] text-neutral-400">
                  {isRoomPlaybackSyncEnabled 
                    ? 'Active: Auto-syncs with host audio & seek' 
                    : 'Off: Listen independently to any song'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {isCoHost && (
                <button
                  onClick={handleBroadcastSync}
                  disabled={!currentSong}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  title="Broadcast your current playing song & timestamp to room"
                >
                  <Radio className="w-3.5 h-3.5 text-amber-400" />
                  <span>Broadcast</span>
                </button>
              )}

              <button
                onClick={() => setShowRoomSettings(prev => !prev)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
                  showRoomSettings
                    ? 'bg-neutral-700 text-white border-neutral-600'
                    : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                }`}
                title="Toggle Room Settings & Tools"
              >
                <span>Room Tools</span>
                {showRoomSettings ? <ChevronUp className="w-3 h-3 text-neutral-400" /> : <ChevronDown className="w-3 h-3 text-neutral-400" />}
              </button>
            </div>
          </div>

          {/* Collapsible Secondary Room Tools (Privacy, New Code, Reactions) */}
          {showRoomSettings && (
            <div className="p-3 rounded-2xl bg-neutral-950/90 border border-neutral-800/90 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
              {/* Privacy & Code generation */}
              <div className="flex items-center gap-2 flex-wrap">
                {isHost && (
                  <>
                    <button
                      onClick={handleTogglePrivacy}
                      disabled={isUpdatingPrivacy}
                      className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium border border-neutral-700/80 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                      title={`Click to switch to ${activeRoom.isPublic ? 'Invite-Only' : 'Public'}`}
                    >
                      {isUpdatingPrivacy ? (
                        <RefreshCw className="w-3.5 h-3.5 text-neutral-400 animate-spin" />
                      ) : activeRoom.isPublic ? (
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-purple-400" />
                      )}
                      <span className="font-semibold">{activeRoom.isPublic ? 'Public' : 'Invite-Only'}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${activeRoom.isPublic ? 'bg-emerald-400' : 'bg-purple-400'}`} />
                    </button>
                    <button
                      onClick={handleRegenerateCode}
                      disabled={isRegeneratingCode}
                      className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium border border-neutral-700/80 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                      title="Generate a new room code"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRegeneratingCode ? 'animate-spin' : ''}`} />
                      <span className="font-semibold">{isRegeneratingCode ? 'Generating...' : 'New Code'}</span>
                    </button>
                  </>
                )}
              </div>

              {/* Live Reactions Inside Tools */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Reactions:</span>
                <div className="flex items-center gap-1">
                  {QUICK_REACTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleSendReaction(emoji)}
                      className="text-base p-1 rounded-lg hover:bg-neutral-800 hover:scale-125 active:scale-95 transition cursor-pointer"
                      title={`Send ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Collapsible Mini Room Chat Box */}
          {isChatOpen && (
            <div className="p-3 rounded-2xl bg-neutral-950/90 border border-amber-500/30 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold border-b border-neutral-800 pb-2">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>Live Room Chat</span>
                </span>
                <span className="text-[10px] text-neutral-500">{participants.length} listeners online</span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin text-xs">
                {chatMessages.length === 0 ? (
                  <p className="text-center py-4 text-neutral-500 text-[11px]">No messages yet. Say hello to the room!</p>
                ) : (
                  chatMessages.map(msg => (
                    <div key={msg.id} className="p-2 rounded-xl bg-neutral-900/80 border border-neutral-800/60 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-amber-400">{msg.user?.displayName || msg.user?.username || 'Listener'}</span>
                        <span className="text-neutral-500 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-neutral-200 text-xs break-words">{msg.text}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendChat} className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Type a message to the room..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={250}
                  className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-700/80 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 font-bold text-xs rounded-xl transition disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {/* Navigation Sub-Tabs: Playlists, Activity Feed, Members */}
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
            <button
              onClick={() => setActiveTab('playlists')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'playlists'
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Room Playlists ({(roomPlaylists || []).length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('activity');
                setUnreadActivityCount(0);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 relative ${
                activeTab === 'activity'
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Activity</span>
              {unreadActivityCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping ml-0.5" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('members')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'members'
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Members ({participants.length})</span>
            </button>
          </div>

          {/* TAB 1: COLLABORATIVE PLAYLISTS */}
          {activeTab === 'playlists' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Playlists</h4>
                  <button
                    onClick={() => setSortByVotes(!sortByVotes)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition ${
                      sortByVotes 
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}
                    title="Toggle sorting songs by vote count"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    <span>{sortByVotes ? 'Sorted by Upvotes' : 'Default Order'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold text-xs border border-purple-500/40 transition flex items-center gap-1.5 cursor-pointer"
                    title="Import one of your personal playlists into this room"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Import My Playlist</span>
                  </button>

                  <button
                    onClick={() => setIsCreatingPlaylist(!isCreatingPlaylist)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-500/40 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isCreatingPlaylist ? 'Cancel' : 'New Room Playlist'}</span>
                  </button>
                </div>
              </div>

              {/* Create Room Playlist Inline Form */}
              {isCreatingPlaylist && (
                <form onSubmit={handleCreateRoomPlaylist} className="p-3 bg-neutral-900 rounded-xl border border-neutral-700/60 flex items-center gap-2 animate-fadeIn">
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
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl transition"
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

              {/* Visual Playlist Cards or Detailed Song List */}
              {detailedPlaylistView && activeSelectedPlaylist ? (
                /* DETAILED PLAYLIST TRACKS VIEW (Matching Personal Playlists drill-down) */
                <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setDetailedPlaylistView(false)}
                        className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer border border-neutral-700"
                        title="Back to Room Playlists"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>All Playlists</span>
                      </button>

                      <div>
                        <h5 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                          <span>{activeSelectedPlaylist.name}</span>
                          <span className="text-[10px] bg-neutral-800 text-amber-400 font-mono px-2 py-0.5 rounded-full border border-neutral-700/60 font-semibold">
                            {activeSelectedPlaylist.songs?.length === 1 ? '1 Track' : `${activeSelectedPlaylist.songs?.length || 0} Tracks`}
                          </span>
                        </h5>
                        {activeSelectedPlaylist.description && (
                          <p className="text-xs text-neutral-400 mt-0.5">{activeSelectedPlaylist.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleForkPlaylist(activeSelectedPlaylist)}
                        className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 font-semibold text-[11px] transition cursor-pointer"
                        title="Copy all songs from this room playlist to your personal library"
                      >
                        <Copy className="w-3 h-3 text-amber-400" />
                        <span>Save to My Library</span>
                      </button>

                      {activeSelectedPlaylist.songs?.length > 0 && (
                        <button
                          onClick={() => {
                            const s = activeSelectedPlaylist.songs[0];
                            if (s && onPlaySong) {
                              onPlaySong(s);
                              if (showToast) showToast(`Playing room playlist "${activeSelectedPlaylist.name}"`);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play All</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Songs List */}
                  {(!activeSelectedPlaylist.songs || activeSelectedPlaylist.songs.length === 0) ? (
                    <div className="text-center py-10 text-neutral-500 text-xs border border-dashed border-neutral-800 rounded-xl space-y-2">
                      <Music className="w-8 h-8 text-neutral-600 mx-auto" />
                      <p className="font-semibold text-neutral-300">This room playlist is empty</p>
                      <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                        Add songs using the global <span className="text-amber-400 font-bold">"Add to Playlist"</span> menu on any song in Loopra and select the Room tab!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                      {(activeSelectedPlaylist.songs || []).map((song, idx) => {
                        const voteCount = song.votes ? song.votes.length : 0;
                        const hasVoted = song.votes && song.votes.includes(currentUserId);
                        const songLiked = typeof isLiked === 'function' ? isLiked(song) : false;

                        return (
                          <div
                            key={song.id || song.videoId || idx}
                            className="group p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 hover:border-amber-500/40 flex items-center justify-between gap-3 transition"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
                                <img
                                  src={song.thumbnail || `https://i.ytimg.com/vi/${song.id || song.videoId}/mqdefault.jpg`}
                                  alt={song.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80';
                                  }}
                                />
                                <button
                                  onClick={() => onPlaySong && onPlaySong(song)}
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer"
                                  aria-label={`Play ${song.title}`}
                                >
                                  <Play className="w-4 h-4 text-amber-400 fill-current" />
                                </button>
                              </div>

                              <div className="min-w-0 flex-1">
                                <h6 className="font-semibold text-xs text-white truncate">{song.title}</h6>
                                <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                                  <span className="truncate">{song.artist || song.channel || 'Loopra Artist'}</span>
                                  {song.addedBy?.displayName && (
                                    <>
                                      <span>•</span>
                                      <span className="text-amber-400/80 truncate">Added by {song.addedBy.displayName}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Like / Favorite Button */}
                              {onToggleLike && (
                                <button
                                  type="button"
                                  onClick={() => onToggleLike(song)}
                                  className={`p-1.5 rounded-lg border transition cursor-pointer active:scale-95 ${
                                    songLiked
                                      ? 'bg-pink-500/10 border-pink-500/30 text-pink-400'
                                      : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-pink-400 border-neutral-700'
                                  }`}
                                  title={songLiked ? 'Remove from Favourites' : 'Add to Favourites'}
                                  aria-label={songLiked ? 'Remove from Favourites' : 'Add to Favourites'}
                                >
                                  <Heart className={`w-3.5 h-3.5 ${songLiked ? 'fill-current text-pink-500' : ''}`} />
                                </button>
                              )}

                              {/* Upvote Pill */}
                              <button
                                onClick={() => handleVoteTrack(activeSelectedPlaylist.id, song.id || song.videoId)}
                                className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 border cursor-pointer ${
                                  hasVoted
                                    ? 'bg-amber-500 text-neutral-950 border-amber-400'
                                    : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                                }`}
                                title="Upvote this song in room ranking"
                              >
                                <ThumbsUp className={`w-3 h-3 ${hasVoted ? 'fill-current' : ''}`} />
                                <span>{voteCount}</span>
                              </button>

                              {/* Remove Song (Host, Co-Host, or submitter) */}
                              {(isCoHost || song.addedBy?.userId === currentUserId) && (
                                <button
                                  onClick={() => handleRemoveTrackFromRoomPlaylist(activeSelectedPlaylist.id, song.id || song.videoId)}
                                  className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
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
              ) : (
                /* PLAYLIST CARD GRID (Matching Personal Playlists page) */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 mt-2">
                  {/* Card 1: Create New Playlist Action Card */}
                  <div
                    onClick={() => setIsCreatingPlaylist(true)}
                    className="p-4 rounded-2xl border border-dashed border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-neutral-900/40 to-neutral-950/80 hover:border-amber-400 hover:bg-amber-500/15 active:scale-[0.98] cursor-pointer flex flex-col items-center justify-center gap-2.5 transition-all group text-center aspect-square shadow-lg backdrop-blur-md"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-400 group-hover:scale-110 flex items-center justify-center transition shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                      <Plus className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-xs sm:text-sm truncate w-full group-hover:text-amber-300 transition">
                        New Playlist
                      </h3>
                      <p className="text-[10px] text-amber-400/80 font-mono mt-0.5">+ Shared List</p>
                    </div>
                  </div>

                  {/* Card 2: Import My Playlists Action Card */}
                  <div
                    onClick={() => setIsImportModalOpen(true)}
                    className="p-4 rounded-2xl border border-dashed border-purple-500/35 bg-gradient-to-br from-purple-500/10 via-neutral-900/40 to-neutral-950/80 hover:border-purple-400 hover:bg-purple-500/15 active:scale-[0.98] cursor-pointer flex flex-col items-center justify-center gap-2.5 transition-all group text-center aspect-square shadow-lg backdrop-blur-md"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-purple-500/20 border border-purple-400/30 text-purple-400 group-hover:scale-110 flex items-center justify-center transition shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                      <FolderPlus className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-xs sm:text-sm truncate w-full group-hover:text-purple-300 transition">
                        Import Playlists
                      </h3>
                      <p className="text-[10px] text-purple-400/80 font-mono mt-0.5">Multi-Select</p>
                    </div>
                  </div>

                  {/* Room Playlist Cards with Cassette Vinyl / Artwork Thumbnails */}
                  {(roomPlaylists || []).map(pl => {
                    const songThumbs = (pl.songs || [])
                      .slice(0, 4)
                      .map(s => s.thumbnail || (s.id || s.videoId ? `https://i.ytimg.com/vi/${s.id || s.videoId}/mqdefault.jpg` : null))
                      .filter(Boolean);

                    return (
                      <div
                        key={pl.id}
                        onClick={() => {
                          setSelectedPlaylistId(pl.id);
                          setDetailedPlaylistView(true);
                        }}
                        className="relative p-3 rounded-2xl border border-white/5 hover:border-amber-500/40 bg-gradient-to-br from-neutral-900/90 via-[#121216] to-[#0c0c0e] active:scale-[0.98] cursor-pointer flex flex-col justify-between transition-all group aspect-square shadow-xl backdrop-blur-md overflow-hidden"
                      >
                        {/* Ambient glow on hover */}
                        <div className="absolute inset-0 bg-amber-500/0 group-hover:bg-amber-500/5 transition-colors pointer-events-none" />

                        {/* Top row: Track Count Micro-Pill & Quick Play/Fork */}
                        <div className="flex items-center justify-between w-full relative z-10" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-neutral-800/90 text-amber-400 border border-neutral-700/60 font-semibold">
                            {pl.songs?.length === 1 ? '1 Track' : !pl.songs?.length ? 'Empty' : `${pl.songs.length} Tracks`}
                          </span>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleForkPlaylist(pl);
                              }}
                              className="p-1 rounded-lg bg-neutral-800/90 hover:bg-amber-500/20 text-neutral-400 hover:text-amber-400 border border-neutral-700/60 transition"
                              title="Save Copy to My Playlists"
                              aria-label="Save Copy to My Playlists"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            {pl.songs?.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (pl.songs[0] && onPlaySong) {
                                    onPlaySong(pl.songs[0]);
                                    if (showToast) showToast(`Playing room playlist "${pl.name}"`);
                                  }
                                }}
                                className="p-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 transition"
                                title="Play Playlist"
                                aria-label="Play Playlist"
                              >
                                <Play className="w-3 h-3 fill-current" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Center Artwork Preview / Disc Icon */}
                        <div className="relative z-10 w-full flex items-center justify-center my-auto">
                          {songThumbs.length >= 4 ? (
                            <div className="grid grid-cols-2 gap-1 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shadow-lg border border-white/10">
                              {songThumbs.map((t, idx) => (
                                <img key={idx} src={t} alt="" className="w-full h-full object-cover" />
                              ))}
                            </div>
                          ) : songThumbs.length > 0 ? (
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shadow-lg border border-amber-500/20">
                              <img src={songThumbs[0]} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-neutral-800/80 border border-white/10 group-hover:border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner group-hover:scale-105 transition">
                              <Disc className="w-6 h-6 sm:w-7 sm:h-7" />
                            </div>
                          )}
                        </div>

                        {/* Bottom Label */}
                        <div className="relative z-10 text-left pt-1">
                          <h3 className="font-extrabold text-white text-xs sm:text-sm truncate w-full group-hover:text-amber-300 transition">
                            {pl.name}
                          </h3>
                          <p className="text-[10px] text-zinc-400 truncate">Tap to open songs</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIVE ACTIVITY FEED */}
          {activeTab === 'activity' && (
            <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-white text-xs uppercase tracking-wider">Live Activity Log</h5>
                <span className="text-[10px] text-neutral-400">Real-time actions in room</span>
              </div>

              {activities.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  <p>No recent activity recorded.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                  {activities.map(act => (
                    <div key={act.id} className="p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/70 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-neutral-300">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{act.text}</span>
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

          {/* TAB 3: MEMBERS & ROLES */}
          {activeTab === 'members' && (
            <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-white text-xs uppercase tracking-wider">Active Room Listeners</h5>
                <span className="text-[10px] text-neutral-400">{participants.length} connected</span>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
                {participants.map(m => {
                  const mRole = m.role || 'listener';
                  const isUser = m.userId === currentUserId || m.username === currentUsername;
                  const isHostRole = mRole === 'host';
                  const isCoHostRole = mRole === 'co-host';

                  return (
                    <div key={m.userId || m.socketId} className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between gap-3 hover:border-neutral-700 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-md border ${
                            isHostRole 
                              ? 'bg-amber-600/30 text-amber-300 border-amber-500/50' 
                              : isCoHostRole 
                              ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50' 
                              : 'bg-neutral-800 text-neutral-200 border-neutral-700'
                          }`}>
                            {m.displayName ? m.displayName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-neutral-950" title="Online Live" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white truncate">{m.displayName || m.username}</span>
                            {isUser && <span className="text-[10px] text-amber-400 font-mono font-semibold">(You)</span>}
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Active</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.2 rounded border ${
                              isHostRole 
                                ? 'text-amber-300 bg-amber-500/15 border-amber-500/30' 
                                : isCoHostRole 
                                ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' 
                                : 'text-neutral-400 bg-neutral-800 border-neutral-700'
                            }`}>
                              {mRole}
                            </span>
                            {m.joinedAt && (
                              <span className="text-[10px] text-neutral-500 font-mono">
                                Joined {new Date(m.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Host Moderation Controls */}
                      {isHost && !isUser && (
                        <div className="flex items-center gap-1.5">
                          {mRole === 'listener' ? (
                            <button
                              onClick={() => handleChangeRole(m.userId, 'co-host')}
                              className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-semibold transition"
                              title="Promote to Co-Host"
                            >
                              Make Co-Host
                            </button>
                          ) : (
                            <button
                              onClick={() => handleChangeRole(m.userId, 'listener')}
                              className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-[10px] transition"
                              title="Demote to Listener"
                            >
                              Demote
                            </button>
                          )}

                          <button
                            onClick={() => handleKickMember(m.userId)}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            title="Remove from room"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Host Room Management Controls */}
              {isHost && (
                <div className="pt-3 border-t border-neutral-800 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs text-neutral-400">Host Room Controls:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleArchiveOrDeleteRoom('archive')}
                      className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition"
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
        /* VIEW B: DEDICATED ROOMS DIRECTORY (Matching "Your Playlists" layout exactly) */
        <div className="space-y-6 animate-fadeIn">
          {/* Header Bar */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400/90 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                Live Collaborative Lounges
              </span>
              <h2 className="text-xl sm:text-2xl font-display font-black tracking-tight text-white mt-1">
                Your <span className="text-amber-400">Rooms</span>
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(!isCreating)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isCreating ? 'Cancel' : 'Create Room'}</span>
              </button>
            </div>
          </div>

          {/* Quick Join Bar */}
          <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter room code (e.g. SFSGRP) or room ID to join..."
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && joinCodeInput.trim()) {
                  handleJoin(joinCodeInput.trim());
                }
              }}
              className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-700/80 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 uppercase font-mono tracking-wider"
            />
            <button
              onClick={() => handleJoin(joinCodeInput.trim())}
              disabled={!joinCodeInput.trim()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 font-bold text-xs rounded-xl transition disabled:opacity-40 cursor-pointer shadow-md shadow-amber-500/20"
            >
              Join Room
            </button>
          </div>

          {/* Create Room Form (Expandable) */}
          {isCreating && (
            <form onSubmit={handleCreate} className="p-4 bg-neutral-900/90 border border-amber-500/30 rounded-2xl space-y-3 animate-fadeIn shadow-xl">
              <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Create a Collaborative Room</span>
              </h5>
              <input
                type="text"
                placeholder="Room name (e.g. Late Night Acoustic, Bollywood Beats)..."
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                maxLength={50}
                autoFocus
              />
              <input
                type="text"
                placeholder="Short description (optional)..."
                value={newRoomDesc}
                onChange={(e) => setNewRoomDesc(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                maxLength={100}
              />
              <div className="flex items-center gap-3 pt-1">
                <label className="text-xs text-neutral-300 flex items-center gap-2 cursor-pointer select-none">
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
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Create Room & Open Workspace
              </button>
            </form>
          )}

          {/* Filter Chips Strip (Matching Your Playlists: All Rooms, Created by You, Joined Rooms) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: 'All Rooms' },
              { id: 'created', label: 'Created by You' },
              { id: 'joined', label: 'Joined Rooms' }
            ].map(chip => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilterTab(chip.id)}
                className={`text-xs px-3 py-1 rounded-full whitespace-nowrap cursor-pointer transition select-none ${
                  filterTab === chip.id
                    ? 'bg-amber-400 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Rooms Grid (Matching Your Playlists visual cards grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 mt-2">
            {/* Create Room Action Card */}
            <div 
              onClick={() => setIsCreating(true)}
              className="p-4 rounded-2xl border border-dashed border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-neutral-900/40 to-neutral-950/80 hover:border-amber-400 hover:bg-amber-500/15 active:scale-[0.98] cursor-pointer flex flex-col items-center justify-center gap-2.5 transition-all group text-center aspect-square shadow-lg backdrop-blur-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-400 group-hover:scale-110 flex items-center justify-center transition shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <Plus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-white text-xs sm:text-sm truncate w-full group-hover:text-amber-300 transition">
                  Create Room
                </h3>
                <p className="text-[10px] text-amber-400/80 font-medium mt-0.5">Start collaborative room</p>
              </div>
            </div>

            {/* Room Cards */}
            {filteredRooms.map(r => {
              const rId = r.roomId || r.id;
              const isCreator = r.createdBy?.userId === currentUserId;

              return (
                <div
                  key={rId}
                  onClick={() => handleJoin(rId)}
                  className="group relative p-3 sm:p-4 rounded-2xl bg-neutral-900/80 hover:bg-neutral-800/90 border border-neutral-800 hover:border-amber-500/40 transition-all flex flex-col justify-between aspect-square cursor-pointer shadow-lg hover:shadow-amber-500/10 active:scale-[0.98]"
                >
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-1.5 w-full">
                    {r.code ? (
                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        {r.code}
                      </span>
                    ) : <span />}

                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{r.memberCount || 1} online</span>
                    </span>
                  </div>

                  {/* Icon & Details */}
                  <div className="my-auto text-center space-y-1">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-105 transition shadow-md">
                      <Radio className="w-6 h-6" />
                    </div>
                    <h3 className="font-extrabold text-white text-xs sm:text-sm truncate w-full group-hover:text-amber-300 transition pt-1">
                      {r.name}
                    </h3>
                    <p className="text-[10px] text-neutral-400 truncate">
                      {isCreator ? 'Created by You' : `Host: ${r.createdBy?.displayName || 'Host'}`}
                    </p>
                  </div>

                  {/* Bottom Stats */}
                  <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Music className="w-3 h-3 text-amber-400/80" />
                      <span>{r.playlistsCount || 0} playlists</span>
                    </span>
                    <span className="font-semibold text-amber-400 group-hover:underline">
                      Open Room →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredRooms.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-xs border border-dashed border-neutral-800 rounded-2xl space-y-2">
              <Radio className="w-10 h-10 text-neutral-600 mx-auto" />
              <p className="font-medium text-neutral-400 text-sm">No rooms found in this tab</p>
              <p className="text-neutral-500">Create a room above or join with a room code to get started!</p>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Import Personal Playlist into Collaborative Room (Multi-Select) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full max-w-lg bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Import to "{activeRoom?.name || 'Room'}"</h3>
                  <p className="text-[11px] text-neutral-400">Select one or more personal playlists to import (≥ 75s songs)</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setSelectedImportPlaylistIds([]);
                }}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Playlist List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 scrollbar-thin">
              {(!userPlaylists || userPlaylists.length === 0) ? (
                <div className="text-center py-12 text-neutral-400 text-xs space-y-2">
                  <Music className="w-10 h-10 mx-auto text-neutral-600" />
                  <p className="font-bold text-white">No personal playlists found</p>
                  <p className="text-neutral-500">Create playlists in "Your Playlists" first, then import them into collaborative rooms!</p>
                </div>
              ) : (
                userPlaylists.map(pl => {
                  const rawSongs = Array.isArray(pl.songs) ? pl.songs : [];
                  const validSongs = rawSongs.filter(s => {
                    if (!s) return false;
                    const dur = parseDurationToSeconds ? parseDurationToSeconds(s) : (s.durationSec || s.durationSeconds || s.duration || 0);
                    return dur >= 75 && (!isValidMusicTrack || isValidMusicTrack(s));
                  });
                  const isSelected = selectedImportPlaylistIds.includes(pl.id);

                  return (
                    <div
                      key={pl.id}
                      onClick={() => {
                        setSelectedImportPlaylistIds(prev => 
                          prev.includes(pl.id) ? prev.filter(id => id !== pl.id) : [...prev, pl.id]
                        );
                      }}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected 
                          ? 'bg-purple-950/40 border-purple-500/80 shadow-md ring-1 ring-purple-500/40' 
                          : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                          isSelected ? 'bg-purple-600 text-white border-purple-400' : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                        }`}>
                          <Music className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-white truncate">{pl.name}</h4>
                          <p className="text-[11px] text-neutral-400 truncate">
                            {validSongs.length} full songs (≥ 75s) {rawSongs.length > validSongs.length && `• ${rawSongs.length - validSongs.length} shorts excluded`}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center">
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                          isSelected ? 'border-purple-400 bg-purple-500 text-white' : 'border-neutral-700 bg-neutral-900'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between gap-3">
              <span className="text-[11px] text-neutral-400 font-mono">
                {selectedImportPlaylistIds.length > 0 
                  ? `${selectedImportPlaylistIds.length} playlist${selectedImportPlaylistIds.length > 1 ? 's' : ''} selected` 
                  : 'Select playlists to import'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setSelectedImportPlaylistIds([]);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedImportPlaylistIds.length === 0 || isImporting}
                  onClick={() => {
                    const targets = (userPlaylists || []).filter(p => selectedImportPlaylistIds.includes(p.id));
                    if (targets.length > 0) handleImportPersonalPlaylists(targets);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-lg shadow-purple-600/25"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Import Selected ({selectedImportPlaylistIds.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
