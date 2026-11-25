import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Plus, Trash2, Play, Music, Share2, Copy, Check, 
  Sparkles, Radio, Disc, Volume2, Shield, Heart, Flame,
  ThumbsUp, MessageSquare, Send, ChevronDown, ChevronUp,
  RefreshCw, Lock, Globe, LogOut, ArrowUpDown, Award, Crown,
  UserCheck, UserMinus, UserX, ArrowLeft, FolderPlus, X,
  Archive, RotateCcw, AlertTriangle, MoreVertical, ListPlus
} from 'lucide-react';
import { getApiUrl } from '../../utils/apiUrl';
import { getTabAuthToken } from '../../utils/storage';
import { isValidMusicTrack, parseDurationToSeconds, sanitizeTrack } from '../../services/songFilter';
import { useUiConfig } from '../../context/UiConfigContext';

const QUICK_REACTIONS = ['🔥', '❤️', '🕺', '😭'];
const STORAGE_KEY_DELETED_ROOMS = 'afterhours_deleted_room_ids';

const loadDeletedRoomIds = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_ROOMS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const persistDeletedRoomIds = (ids) => {
  try {
    localStorage.setItem(STORAGE_KEY_DELETED_ROOMS, JSON.stringify(ids));
  } catch (e) {}
};

export default function ListeningRoomsView({
  socket,
  user,
  authToken,
  onOpenAuth,
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
  isLiked,
  onAddToQueue
}) {
  const { isVisible: isUiVisible } = useUiConfig();
  const [deletedRoomIds, setDeletedRoomIds] = useState(loadDeletedRoomIds);
  const [rooms, setRooms] = useState([]);
  const [leftRooms, setLeftRooms] = useState([]);
  const [archivedRooms, setArchivedRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'created' | 'joined' | 'left' | 'archived'
  const [roomToDelete, setRoomToDelete] = useState(null); // Host confirmation modal for room permanent deletion
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null); // Playlist deletion confirmation modal
  const [isDeletingPlaylist, setIsDeletingPlaylist] = useState(false);
  const inFlightJoinRef = useRef(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomIsPublic, setNewRoomIsPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [pendingRejoinRoomIds, setPendingRejoinRoomIds] = useState([]);
  const [previewLeftRoom, setPreviewLeftRoom] = useState(null); // Restricted/preview state for room in Left Rooms
  const [selectedPreviewRoom, setSelectedPreviewRoom] = useState(null); // Preview / details state before explicitly joining
  const [searchPreviewRoom, setSearchPreviewRoom] = useState(null); // Preview card for searched room code (never auto-joins)
  const [isSearchingCode, setIsSearchingCode] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
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
  const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);
  const [isListenTogetherMenuOpen, setIsListenTogetherMenuOpen] = useState(false);
  const [openTrackMenuId, setOpenTrackMenuId] = useState(null);
  const [copiedCodeNotice, setCopiedCodeNotice] = useState(false);
  const [isMemberPopoverOpen, setIsMemberPopoverOpen] = useState(false);
  
  // Workspace tabs
  const [activeTab, setActiveTab] = useState('playlists'); // 'playlists' | 'activity' | 'members'
  const [sortByVotes, setSortByVotes] = useState(true);
  const [activities, setActivities] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const isSendingChatRef = useRef(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);

  // Synchronized Playback Request & Ready-Check state
  const [activePlaybackRequest, setActivePlaybackRequest] = useState(null);
  const [hasRespondedToRequest, setHasRespondedToRequest] = useState(false);
  const [livePlaybackSession, setLivePlaybackSession] = useState(null);

  const currentUserId = user?._id?.toString?.() || user?.userId || null;
  const currentUsername = user?.username || user?.displayName || 'Listener';
  const token = authToken || getTabAuthToken() || null;

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  // Close open dropdown menus on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('[data-dropdown]')) {
        setIsRoomMenuOpen(false);
        setIsListenTogetherMenuOpen(false);
        setOpenTrackMenuId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleCopyCodeOnly = (code) => {
    if (!code) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        setCopiedCodeNotice(true);
        setTimeout(() => setCopiedCodeNotice(false), 2000);
        if (showToast) showToast(`Room Code copied: ${code}`);
      }).catch(() => {
        if (showToast) showToast(`Room Code: ${code}`);
      });
    } else if (showToast) {
      showToast(`Room Code: ${code}`);
    }
  };

  const handleCopyInviteLink = (code) => {
    if (!code) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteLink = `${origin}/rooms/${encodeURIComponent(code)}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(inviteLink).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        if (showToast) showToast('Invite link copied to clipboard!');
      }).catch(() => {
        if (showToast) showToast(inviteLink);
      });
    } else if (showToast) {
      showToast(inviteLink);
    }
  };

  // Helper to deduplicate members by userId
  const getUniqueMembers = (mList) => {
    if (!Array.isArray(mList)) return [];
    const seen = new Set();
    const result = [];
    for (const m of mList) {
      if (!m) continue;
      const uid = String(m.userId || '').trim();
      if (!uid) continue;
      if (!seen.has(uid)) {
        seen.add(uid);
        result.push(m);
      }
    }
    return result;
  };

  // Find user's member role in current active room
  const currentMember = (participants || []).find(m => 
    m.userId && currentUserId && String(m.userId) === String(currentUserId)
  );
  const hostMember = (participants || []).find(m => m.role === 'host') || 
    (activeRoom?.createdBy?.userId ? { displayName: activeRoom.createdBy.displayName || activeRoom.createdBy.username, userId: activeRoom.createdBy.userId, role: 'host' } : null);
  const userRole = currentMember?.role || (activeRoom?.createdBy?.userId === currentUserId ? 'host' : 'listener');
  const isHost = userRole === 'host';
  const isCoHost = userRole === 'co-host' || isHost;

  // Refresh rooms from backend
  const refreshRooms = () => {
    if (!token) {
      setRooms([]);
      setLeftRooms([]);
      setArchivedRooms([]);
      setIsLoadingRooms(false);
      return;
    }

    setIsLoadingRooms(true);
    const currentDeleted = loadDeletedRoomIds();
    
    // Fetch active user rooms
    fetch(getApiUrl('/api/rooms'), { headers: authHeaders })
      .then(res => res.json())
      .then(data => {
        if (data && data.rooms) {
          const valid = (data.rooms || []).filter(r => {
            const id = r.roomId || r.id;
            const code = r.code;
            return !r.isDeleted && r.status !== 'deleted' && !currentDeleted.includes(id) && (!code || !currentDeleted.includes(code));
          });
          setRooms(valid);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingRooms(false));

    // Fetch left rooms for Left Rooms tab
    fetch(getApiUrl('/api/rooms/left'), { headers: authHeaders })
      .then(res => res.json())
      .then(data => {
        if (data && data.rooms) {
          const valid = (data.rooms || []).filter(r => {
            const id = r.roomId || r.id;
            const code = r.code;
            return !r.isDeleted && r.status !== 'deleted' && !currentDeleted.includes(id) && (!code || !currentDeleted.includes(code));
          });
          setLeftRooms(valid);
          const pendingIds = valid.filter(r => r.hasPendingRequest).map(r => r.roomId || r.id);
          setPendingRejoinRoomIds(prev => Array.from(new Set([...prev, ...pendingIds])));
        }
      })
      .catch(() => {});

    // Fetch archived rooms for Archived Rooms tab
    fetch(getApiUrl('/api/rooms/archived'), { headers: authHeaders })
      .then(res => res.json())
      .then(data => {
        if (data && data.rooms) {
          const valid = (data.rooms || []).filter(r => {
            const id = r.roomId || r.id;
            const code = r.code;
            return !r.isDeleted && r.status !== 'deleted' && !currentDeleted.includes(id) && (!code || !currentDeleted.includes(code));
          });
          setArchivedRooms(valid);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshRooms();
  }, [currentUserId, token]);

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
    setJoinRequests(activeRoom.joinRequests || []);
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
      if (data.joinRequests) setJoinRequests(data.joinRequests);
      if (data.activities) setActivities(data.activities);
      if (data.chatMessages) setChatMessages(data.chatMessages);
    };

    const handleMembersUpdated = (data) => {
      if (data?.members) {
        setParticipants(data.members);
        if (activeRoom && setActiveRoom) {
          setActiveRoom(prev => prev ? { 
            ...prev, 
            members: data.members, 
            ...(data.createdBy ? { createdBy: data.createdBy } : {}) 
          } : prev);
        }
      }
    };

    const handleJoinRequest = (data) => {
      if (data?.joinRequests) {
        setJoinRequests(data.joinRequests);
      } else if (data?.request) {
        setJoinRequests(prev => [...(prev || []).filter(r => r.userId !== data.request.userId), data.request]);
      }
      if (showToast && data?.request) {
        showToast(`🔔 Re-join request from ${data.request.name || 'a listener'}`);
      }
    };

    const handleJoinApproved = (data) => {
      if (data?.userId === currentUserId) {
        // Current user was approved! Remove from pending and move to active room
        setPendingRejoinRoomIds(prev => prev.filter(id => id !== data.roomId));
        if (showToast) showToast('🎉 Your request to re-join the room was approved!', 'success');
        refreshRooms();
        if (previewLeftRoom && (previewLeftRoom.roomId === data.roomId || previewLeftRoom.id === data.roomId)) {
          setPreviewLeftRoom(null);
          handleJoin(data.roomId);
        }
      }
      if (data?.joinRequests) {
        setJoinRequests(data.joinRequests);
      }
      if (data?.members) {
        setParticipants(data.members);
      }
    };

    const handleJoinRejected = (data) => {
      if (data?.userId === currentUserId) {
        setPendingRejoinRoomIds(prev => prev.filter(id => id !== data.roomId));
        if (showToast) showToast('❌ Your request to re-join the room was declined.', 'warning');
      }
      if (data?.joinRequests) {
        setJoinRequests(data.joinRequests);
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
        const msg = data.message;
        const msgId = msg.id || msg.clientId;
        setChatMessages(prev => {
          const list = prev || [];
          // Deduplicate by id or clientId (replacing optimistic message or skipping if already present)
          const existingIndex = list.findIndex(m => 
            (msgId && (m.id === msgId || m.clientId === msgId)) ||
            (msg.clientId && (m.clientId === msg.clientId || m.id === msg.clientId))
          );
          if (existingIndex > -1) {
            const updated = [...list];
            updated[existingIndex] = { ...updated[existingIndex], ...msg };
            return updated.slice(-50);
          }
          return [...list.slice(-49), msg];
        });
      }
    };

    const handleReaction = (data) => {
      if (data?.emoji) {
        const id = data.id || `react_${Date.now()}_${Math.random()}`;
        setFloatingReactions(prev => {
          const next = [...prev.slice(-14), {
            id,
            emoji: data.emoji,
            user: data.user,
            left: Math.floor(Math.random() * 70) + 15
          }];
          return next;
        });
        setTimeout(() => {
          setFloatingReactions(prev => prev.filter(r => r.id !== id));
        }, 2800);
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
      const targetId = data?.roomId || data?.id;
      if (targetId) {
        if (data?.status === 'archived' || data?.isArchived) {
          setRooms(prev => (prev || []).filter(r => (r.roomId || r.id) !== targetId));
          setLeftRooms(prev => (prev || []).filter(lr => (lr.roomId || lr.id) !== targetId));
        } else if (data?.status === 'deleted') {
          setRooms(prev => (prev || []).filter(r => (r.roomId || r.id) !== targetId));
          setLeftRooms(prev => (prev || []).filter(lr => (lr.roomId || lr.id) !== targetId));
          setArchivedRooms(prev => (prev || []).filter(ar => (ar.roomId || ar.id) !== targetId));
        } else if (data?.status === 'active') {
          setArchivedRooms(prev => (prev || []).filter(ar => (ar.roomId || ar.id) !== targetId));
        }
      }
      refreshRooms();
      if (activeRoom && (activeRoom.roomId === data?.roomId || activeRoom.id === data?.roomId)) {
        if (data?.status === 'archived' || data?.isArchived) {
          if (showToast) showToast('This room was archived by the host', 'warning');
          handleLeave();
        } else if (data?.status === 'deleted') {
          if (showToast) showToast('This room was deleted by the host', 'error');
          handleLeave();
        }
      }
    };

    const handleRoomArchived = (data) => {
      const targetId = data?.roomId || data?.id;
      if (targetId) {
        if (data?.isArchived || data?.status === 'archived') {
          setRooms(prev => (prev || []).filter(r => (r.roomId || r.id) !== targetId));
          setLeftRooms(prev => (prev || []).filter(lr => (lr.roomId || lr.id) !== targetId));
        } else {
          setArchivedRooms(prev => (prev || []).filter(ar => (ar.roomId || ar.id) !== targetId));
        }
      }
      refreshRooms();
      if (activeRoom && (activeRoom.roomId === data?.roomId || activeRoom.id === data?.roomId)) {
        if (data?.isArchived || data?.status === 'archived') {
          if (showToast) showToast('This room was archived by the host', 'warning');
          handleLeave();
        }
      }
    };

    const handleRoomDeleted = (data) => {
      const targetId = data?.roomId || data?.id;
      if (targetId) {
        setDeletedRoomIds(prev => {
          const next = Array.from(new Set([...(prev || []), targetId]));
          persistDeletedRoomIds(next);
          return next;
        });
        setRooms(prev => (prev || []).filter(r => (r.roomId || r.id) !== targetId));
        setLeftRooms(prev => (prev || []).filter(lr => (lr.roomId || lr.id) !== targetId));
        setArchivedRooms(prev => (prev || []).filter(ar => (ar.roomId || ar.id) !== targetId));
      }
      refreshRooms();
      if (activeRoom && (activeRoom.roomId === data?.roomId || activeRoom.id === data?.roomId)) {
        if (showToast) showToast('This room was permanently deleted by the host', 'error');
        handleLeave();
      }
    };

    const handleRoomError = (err) => {
      const errMsg = err?.error || 'Room not found or invalid room code';
      if (showToast) showToast(errMsg, 'error');
    };

    const handleRoomPlaybackRequest = (data) => {
      if (data?.request) {
        setActivePlaybackRequest(data.request);
        setHasRespondedToRequest(false);
        const reqSong = data.request.track;
        if (showToast) {
          showToast(`🎵 ${data.request.initiatorName || 'Host'} wants to play "${reqSong?.title || 'a song'}" together!`);
        }
      }
    };

    const handleRoomPlaybackResponse = (data) => {
      if (data?.requestId && activePlaybackRequest && activePlaybackRequest.requestId === data.requestId) {
        setActivePlaybackRequest(prev => prev ? {
          ...prev,
          readyUsers: data.readyUsers || prev.readyUsers,
          declinedUsers: data.declinedUsers || prev.declinedUsers
        } : prev);
      }
    };

    const handleRoomPlaybackStart = (data) => {
      setActivePlaybackRequest(null);
      setHasRespondedToRequest(false);
      if (data?.track) {
        setLivePlaybackSession({
          track: data.track,
          basePositionSec: typeof data.basePositionSec === 'number' ? data.basePositionSec : 0,
          startedAt: data.startedAt || Date.now(),
          isPlaying: data.isPlaying !== undefined ? Boolean(data.isPlaying) : true
        });
      }
    };

    socket.on('room:state', handleRoomState);
    socket.on('room:members:updated', handleMembersUpdated);
    socket.on('room:join:request', handleJoinRequest);
    socket.on('room:join:approved', handleJoinApproved);
    socket.on('room:join:rejected', handleJoinRejected);
    socket.on('room:member:kicked', handleMemberKicked);
    socket.on('room:activities:updated', handleActivitiesUpdated);
    socket.on('room:chat:message', handleChatMessage);
    socket.on('room:reaction', handleReaction);
    socket.on('room:playlist:updated', handlePlaylistUpdated);
    socket.on('room:invite:updated', handleInviteUpdated);
    socket.on('room:privacy:updated', handlePrivacyUpdated);
    socket.on('room:status:updated', handleStatusUpdated);
    socket.on('room:archived', handleRoomArchived);
    socket.on('room:deleted', handleRoomDeleted);
    socket.on('room:error', handleRoomError);
    socket.on('listening_room_error', handleRoomError);
    socket.on('room:playback:request', handleRoomPlaybackRequest);
    socket.on('room:playback:response', handleRoomPlaybackResponse);
    socket.on('room:playback:start', handleRoomPlaybackStart);

    return () => {
      socket.off('room:state', handleRoomState);
      socket.off('room:members:updated', handleMembersUpdated);
      socket.off('room:join:request', handleJoinRequest);
      socket.off('room:join:approved', handleJoinApproved);
      socket.off('room:join:rejected', handleJoinRejected);
      socket.off('room:member:kicked', handleMemberKicked);
      socket.off('room:activities:updated', handleActivitiesUpdated);
      socket.off('room:chat:message', handleChatMessage);
      socket.off('room:reaction', handleReaction);
      socket.off('room:playlist:updated', handlePlaylistUpdated);
      socket.off('room:invite:updated', handleInviteUpdated);
      socket.off('room:privacy:updated', handlePrivacyUpdated);
      socket.off('room:status:updated', handleStatusUpdated);
      socket.off('room:archived', handleRoomArchived);
      socket.off('room:deleted', handleRoomDeleted);
      socket.off('room:error', handleRoomError);
      socket.off('listening_room_error', handleRoomError);
      socket.off('room:playback:request', handleRoomPlaybackRequest);
      socket.off('room:playback:response', handleRoomPlaybackResponse);
      socket.off('room:playback:start', handleRoomPlaybackStart);
    };
  }, [socket, activeRoom, currentUserId, activeTab, setRoomPlaylists, setActiveRoom, showToast]);

  // Helper to check if current user is already an active member or creator of a room
  const isUserMemberOrHost = (roomItem) => {
    if (!roomItem || !currentUserId) return false;
    const isCreator = String(roomItem.createdBy?.userId || '') === String(currentUserId);
    if (isCreator) return true;
    if (Array.isArray(roomItem.members)) {
      return roomItem.members.some(m => String(m.userId || '') === String(currentUserId));
    }
    return Boolean(roomItem.isMember || roomItem.isHost);
  };

  // Helper to open room preview / details page cleanly without auto-joining
  const handleOpenRoomPreview = async (roomItem) => {
    if (!roomItem) return;
    const rId = roomItem.roomId || roomItem.id;
    const code = roomItem.code;
    const currentDeleted = loadDeletedRoomIds();

    if (
      roomItem.isDeleted || 
      roomItem.status === 'deleted' || 
      (rId && currentDeleted.includes(rId)) || 
      (code && currentDeleted.includes(code))
    ) {
      if (showToast) showToast('This room has been removed or deleted', 'warning');
      return;
    }

    // Helper: directly open room workspace when user is already a participant
    const openRoomDirectly = (targetRoom) => {
      setSearchPreviewRoom(null);
      setSelectedPreviewRoom(null);
      setPreviewLeftRoom(null);
      if (setActiveRoom) setActiveRoom(targetRoom);
      if (setRoomPlaylists) setRoomPlaylists(targetRoom.playlists || []);
      setParticipants(getUniqueMembers(targetRoom.members || []));
      setActivities(targetRoom.activities || []);
      setChatMessages(targetRoom.chatMessages || []);
      const rId = targetRoom.roomId || targetRoom.id;
      socket?.emit('join_listening_room', { roomId: rId, user });
      socket?.emit('room:join', { roomId: rId, user });
    };

    // If user is already host or member, immediately open room workspace directly!
    if (isUserMemberOrHost(roomItem)) {
      openRoomDirectly(roomItem);
      return;
    }

    // Set immediate preview from summary
    setSelectedPreviewRoom(roomItem);

    // Try fetching fresh preview & member details from lookup
    const lookupCode = code || rId;
    if (lookupCode) {
      try {
        const res = await fetch(getApiUrl(`/api/rooms/lookup/${encodeURIComponent(lookupCode)}`), {
          headers: authHeaders
        });
        const data = await res.json();
        if (res.ok && data?.success && data?.preview) {
          // If fresh lookup shows user is already member/host, open room directly!
          if (data.preview.isMember || data.preview.isHost) {
            openRoomDirectly({ ...roomItem, ...data.preview });
            return;
          }
          setSelectedPreviewRoom(prev => ({
            ...(prev || roomItem),
            ...data.preview
          }));
        }
      } catch (_) {}
    }
  };

  // 1. Search Room Code / ID -> Returns Room Preview Card (Never auto-joins)
  const handleLookupCode = async (codeToSearch) => {
    if (!user) {
      if (showToast) showToast('Please sign in to search and join Collaborative Rooms', 'warning');
      if (onOpenAuth) onOpenAuth();
      return;
    }

    const cleanCode = (codeToSearch || joinCodeInput || '').trim();
    if (!cleanCode) return;

    setIsSearchingCode(true);
    setSearchPreviewRoom(null);

    try {
      const res = await fetch(getApiUrl(`/api/rooms/lookup/${encodeURIComponent(cleanCode)}`), {
        headers: authHeaders
      });
      const data = await res.json();
      if (res.ok && data.success && data.preview) {
        // If the user is already a member or host, open the room directly!
        if (data.preview.isMember || data.preview.isHost) {
          setSearchPreviewRoom(null);
          setSelectedPreviewRoom(null);
          setPreviewLeftRoom(null);
          setJoinCodeInput('');
          if (showToast) showToast(`Opening "${data.preview.name}"`);
          if (setActiveRoom) setActiveRoom(data.preview);
          if (setRoomPlaylists) setRoomPlaylists(data.preview.playlists || []);
          setParticipants(getUniqueMembers(data.preview.members || []));
          setActivities(data.preview.activities || []);
          setChatMessages(data.preview.chatMessages || []);
          const rId = data.preview.roomId || data.preview.id;
          socket?.emit('join_listening_room', { roomId: rId, user });
          socket?.emit('room:join', { roomId: rId, user });
          return;
        }

        // Show preview only before joining
        setSearchPreviewRoom(data.preview);
        if (showToast) showToast(`Found room "${data.preview.name}"`);
      } else {
        if (showToast) showToast(data?.error || 'Room not found or invalid room code', 'error');
      }
    } catch (e) {
      if (showToast) showToast('Network error searching for room', 'error');
    } finally {
      setIsSearchingCode(false);
    }
  };

  // 2. Join Room (Explicit click on Join button - strictly single-flight, no auto-retries)
  const handleJoin = async (roomIdOrCode) => {
    if (!user) {
      if (showToast) showToast('Please sign in to join Collaborative Rooms', 'warning');
      if (onOpenAuth) onOpenAuth();
      return;
    }

    if (!roomIdOrCode) return;
    const target = roomIdOrCode.trim();
    if (!target) return;

    const currentDeleted = loadDeletedRoomIds();
    if (currentDeleted.includes(target)) {
      if (showToast) showToast('This room has been removed or deleted', 'warning');
      return;
    }

    if (isJoiningRoom || inFlightJoinRef.current) return;
    setIsJoiningRoom(true);
    inFlightJoinRef.current = true;

    try {
      const res = await fetch(getApiUrl('/api/rooms/join'), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ roomCode: target, code: target, roomId: target })
      });
      const data = await res.json();
      if (res.ok && data.success && data.room) {
        if (setActiveRoom) setActiveRoom(data.room);
        if (setRoomPlaylists) setRoomPlaylists(data.room.playlists || []);
        const uniqueMembers = getUniqueMembers(data.room.members || []);
        setParticipants(uniqueMembers);
        setActivities(data.room.activities || []);
        setChatMessages(data.room.chatMessages || []);
        socket?.emit('join_listening_room', { roomId: data.room.roomId, user });
        socket?.emit('room:join', { roomId: data.room.roomId, user });
        if (showToast) showToast(`Joined "${data.room.name}"`);
        setJoinCodeInput('');
        setSearchPreviewRoom(null);
        setSelectedPreviewRoom(null);
        setPreviewLeftRoom(null);
        refreshRooms();
        return;
      } else {
        const errorMsg = data?.error || 'Room not found or invalid room code';
        if (showToast) showToast(errorMsg, 'error');
        return;
      }
    } catch (e) {
      if (showToast) showToast('Room not found or network error', 'error');
    } finally {
      setIsJoiningRoom(false);
      inFlightJoinRef.current = false;
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
      // Optimistically remove from local joined rooms list and add to left rooms
      setRooms(prev => (prev || []).filter(r => (r.roomId || r.id) !== rId));
      setLeftRooms(prev => {
        const alreadyInLeft = (prev || []).some(lr => (lr.roomId || lr.id) === rId);
        if (alreadyInLeft) return prev;
        return [
          {
            ...activeRoom,
            id: rId,
            roomId: rId,
            leftAt: new Date().toISOString(),
            memberCount: Math.max(0, (activeRoom.members?.length || 1) - 1)
          },
          ...(prev || [])
        ];
      });

      socket?.emit('leave_listening_room', { roomId: rId });
      socket?.emit('room:leave', { roomId: rId, user });
      // Call REST fallback with auth headers to ensure server persistence
      fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/leave`), {
        method: 'POST',
        headers: authHeaders,
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
    refreshRooms();
  };

  // 3. Re-Join Request Flow from Left Rooms
  const handleRequestToJoin = async (targetRoom) => {
    if (!targetRoom) return;
    const rId = targetRoom.roomId || targetRoom.id;
    setPendingRejoinRoomIds(prev => Array.from(new Set([...prev, rId])));

    if (socket) {
      socket.emit('room:join:request', { roomId: rId, user }, (res) => {
        if (res && res.success) {
          if (res.status === 'already_member') {
            handleJoin(rId);
          } else {
            if (showToast) showToast('Join request sent to Host! Waiting for approval.');
          }
        } else {
          if (showToast) showToast(res?.error || 'Failed to send join request', 'error');
        }
      });
    }

    try {
      const res = await fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/join-request`), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ user, userId: currentUserId, guestId: currentUserId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.status === 'already_member') {
          handleJoin(rId);
        } else if (!socket) {
          if (showToast) showToast('Join request sent to Host! Waiting for approval.');
        }
      } else if (!socket) {
        if (showToast) showToast(data?.error || 'Failed to send join request', 'error');
      }
    } catch (e) {
      if (!socket && showToast) showToast('Network error sending request', 'error');
    }
  };

  // Host Approval Controls
  const handleApproveJoinRequest = async (targetUserId) => {
    if (!activeRoom || !isHost || !targetUserId) return;
    const rId = activeRoom.roomId || activeRoom.id;

    if (socket) {
      socket.emit('room:join:approve', { roomId: rId, targetUserId, user }, (res) => {
        if (res && res.success) {
          setJoinRequests(res.joinRequests || []);
          if (res.members) setParticipants(res.members);
          if (showToast) showToast('Member approved and added to room!');
        } else {
          if (showToast) showToast(res?.error || 'Failed to approve request', 'error');
        }
      });
    } else {
      try {
        const res = await fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/join-requests/approve`), {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ targetUserId, user })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setJoinRequests(data.joinRequests || []);
          if (data.members) setParticipants(data.members);
          if (showToast) showToast('Member approved and added to room!');
        } else {
          if (showToast) showToast(data?.error || 'Failed to approve request', 'error');
        }
      } catch (e) {
        if (showToast) showToast('Network error approving member', 'error');
      }
    }
  };

  const handleRejectJoinRequest = async (targetUserId) => {
    if (!activeRoom || !isHost || !targetUserId) return;
    const rId = activeRoom.roomId || activeRoom.id;

    if (socket) {
      socket.emit('room:join:reject', { roomId: rId, targetUserId, user }, (res) => {
        if (res && res.success) {
          setJoinRequests(res.joinRequests || []);
          if (showToast) showToast('Join request rejected');
        } else {
          if (showToast) showToast(res?.error || 'Failed to reject request', 'error');
        }
      });
    } else {
      try {
        const res = await fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/join-requests/reject`), {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ targetUserId, user })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setJoinRequests(data.joinRequests || []);
          if (showToast) showToast('Join request rejected');
        } else {
          if (showToast) showToast(data?.error || 'Failed to reject request', 'error');
        }
      } catch (e) {
        if (showToast) showToast('Network error rejecting request', 'error');
      }
    }
  };

  // 3. Create Room
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user) {
      if (showToast) showToast('Please sign in to create a room', 'warning');
      if (onOpenAuth) onOpenAuth();
      return;
    }

    const name = newRoomName.trim() || `${user?.displayName || user?.username || 'Host'}'s Lounge`;
    try {
      const res = await fetch(getApiUrl('/api/rooms'), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name,
          description: newRoomDesc.trim(),
          isPublic: newRoomIsPublic
        })
      });
      const data = await res.json();
      if ((res.status === 201 || res.status === 200) && data.success && data.room) {
        if (setActiveRoom) setActiveRoom(data.room);
        if (setRoomPlaylists) setRoomPlaylists(data.room.playlists || []);
        const uniqueMembers = getUniqueMembers(data.room.members || []);
        setParticipants(uniqueMembers);
        setActivities(data.room.activities || []);
        socket?.emit('join_listening_room', { roomId: data.room.roomId, user });
        socket?.emit('room:join', { roomId: data.room.roomId, user });
        if (showToast) showToast(`Created Room "${data.room.name}"`);
        refreshRooms();
      } else {
        if (showToast) showToast(data?.error || 'Could not create room', 'error');
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

  // Handler when user clicks a song to play in Room View
  const handleRoomSongClick = (song) => {
    if (!song) return;
    const durSec = parseDurationToSeconds ? parseDurationToSeconds(song) : (song.durationSec || 0);

    // If Listen Together is ON, trigger the Request & "Okay" ready-check flow
    if (isRoomPlaybackSyncEnabled && activeRoom) {
      const rId = activeRoom.roomId || activeRoom.id;
      const reqId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const reqPayload = {
        roomId: rId,
        requestId: reqId,
        track: song,
        initiatorId: currentUserId,
        initiatorName: user?.displayName || user?.username || 'Host',
        user
      };

      // Set local active request immediately for initiator
      setActivePlaybackRequest({
        requestId: reqId,
        track: song,
        initiatorId: String(currentUserId || ''),
        initiatorName: user?.displayName || user?.username || 'You',
        createdAt: Date.now(),
        readyUsers: [String(currentUserId || '')],
        declinedUsers: []
      });
      setHasRespondedToRequest(true);

      if (socket) {
        socket.emit('room:playback:request', reqPayload);
      }
      if (showToast) {
        showToast(`Sent Listen Together request for "${song.title}"`);
      }
    } else {
      // Listen Together is OFF: play independently without disrupting anyone
      if (onPlaySong) onPlaySong(song);
    }
  };

  // Accept / "Okay" Listen Together Request
  const handleAcceptPlaybackRequest = () => {
    if (!activePlaybackRequest || !activeRoom) return;
    const rId = activeRoom.roomId || activeRoom.id;
    setHasRespondedToRequest(true);

    // Keep Listen Together mode ON continuously once accepted
    if (!isRoomPlaybackSyncEnabled && typeof setIsRoomPlaybackSyncEnabled === 'function') {
      setIsRoomPlaybackSyncEnabled(true);
    }

    if (socket) {
      socket.emit('room:playback:respond', {
        roomId: rId,
        requestId: activePlaybackRequest.requestId,
        userId: currentUserId,
        response: 'okay',
        user
      });
    }

    // If initiator, or all ready, initiator can also trigger start
    const isInitiator = String(activePlaybackRequest.initiatorId) === String(currentUserId);
    if (isInitiator) {
      handleTriggerStartPlayback(activePlaybackRequest.track);
    } else {
      if (showToast) showToast('Ready to listen together! Synchronizing playback...');
    }
  };

  // Decline Listen Together Request
  const handleDeclinePlaybackRequest = () => {
    if (!activePlaybackRequest || !activeRoom) return;
    const rId = activeRoom.roomId || activeRoom.id;
    setHasRespondedToRequest(true);
    setActivePlaybackRequest(null);

    if (socket) {
      socket.emit('room:playback:respond', {
        roomId: rId,
        requestId: activePlaybackRequest.requestId,
        userId: currentUserId,
        response: 'decline',
        user
      });
    }
    if (showToast) showToast('Declined synchronized song. Enjoying independent playback.');
  };

  // Initiator triggers playback start once ready check is confirmed with pre-buffer and tight sync
  const handleTriggerStartPlayback = (trackToStart) => {
    if (!activeRoom) return;
    const song = trackToStart || activePlaybackRequest?.track;
    if (!song) return;
    const rId = activeRoom.roomId || activeRoom.id;
    const reqId = activePlaybackRequest?.requestId || `prep_${Date.now()}`;

    // Step 1: Tell all room members to pre-load and buffer the song in paused state
    if (socket) {
      socket.emit('room:playback:prepare', {
        roomId: rId,
        requestId: reqId,
        track: song,
        basePositionSec: 0,
        initiatorId: currentUserId,
        initiatorName: user?.displayName || user?.username || 'You',
        user
      });
    }

    // Preload locally
    if (onPlaySong) onPlaySong(song);

    // Step 2: Schedule simultaneous start at serverNow + 250ms for tight ~30-40ms alignment across all devices
    setTimeout(() => {
      const scheduledStartAt = Date.now() + 250;
      const startPayload = {
        roomId: rId,
        track: song,
        basePositionSec: 0,
        startedAt: scheduledStartAt,
        startAtServerTime: scheduledStartAt,
        isPlaying: true,
        user
      };

      if (socket) {
        socket.emit('room:playback:start', startPayload);
      }
    }, 200);

    setActivePlaybackRequest(null);
    setHasRespondedToRequest(false);
  };

  // Late-Accept / Mid-Playback Joiner Sync (Crucial: NEVER restart from 0:00)
  const handleSyncToLivePlayback = async () => {
    if (!activeRoom) return;
    const rId = activeRoom.roomId || activeRoom.id;

    // Turn Listen Together ON if currently OFF
    if (!isRoomPlaybackSyncEnabled && typeof setIsRoomPlaybackSyncEnabled === 'function') {
      setIsRoomPlaybackSyncEnabled(true);
    }

    const applyLiveState = (liveState) => {
      if (!liveState || !liveState.track) {
        if (showToast) showToast('No live track is currently playing in this room', 'warning');
        return;
      }

      const song = liveState.track;
      let targetPositionSec = typeof liveState.basePositionSec === 'number' ? liveState.basePositionSec : 0;
      if (liveState.isPlaying && liveState.startedAt) {
        const elapsed = Math.max(0, (Date.now() - liveState.startedAt) / 1000);
        targetPositionSec += elapsed;
      }

      if (onPlaySong) onPlaySong(song);
      if (targetPositionSec > 0.5 && onSeek) {
        setTimeout(() => {
          onSeek(targetPositionSec);
        }, 600);
        setTimeout(() => {
          onSeek(targetPositionSec + 0.3);
        }, 1200);
      }
      if (showToast) {
        const mins = Math.floor(targetPositionSec / 60);
        const secs = Math.floor(targetPositionSec % 60);
        const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        showToast(`Synced live to "${song.title}" at ${timeStr}`);
      }
    };

    if (socket) {
      socket.emit('room:playback:getState', { roomId: rId }, (res) => {
        if (res && res.success && res.state) {
          applyLiveState(res.state);
        } else {
          // Fallback to REST
          fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/playback-state`))
            .then(r => r.json())
            .then(data => {
              if (data && data.success && data.playbackState) {
                applyLiveState(data.playbackState);
              }
            })
            .catch(() => {});
        }
      });
    } else {
      try {
        const res = await fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/playback-state`));
        const data = await res.json();
        if (res.ok && data.success && data.playbackState) {
          applyLiveState(data.playbackState);
        }
      } catch (e) {}
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

  // 7. Send Chat Message with Strict Deduplication & Double-Submission Guards
  const handleSendChat = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const text = chatInput.trim();
    if (!text || !activeRoom) return;

    // Guard against rapid duplicate clicks or double submit on Enter + button click
    if (isSendingChatRef.current) return;
    isSendingChatRef.current = true;
    setIsSendingChat(true);

    const rId = activeRoom.roomId || activeRoom.id;
    // Generate canonical clientId for unambiguous optimistic-to-confirmed reconciliation
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

    // Optimistically insert message immediately into sender's local list
    setChatMessages(prev => {
      const list = prev || [];
      const exists = list.some(m => m.id === clientId || m.clientId === clientId);
      if (exists) return list;
      return [...list.slice(-49), optimisticMessage];
    });

    const releaseSendingLock = () => {
      setTimeout(() => {
        isSendingChatRef.current = false;
        setIsSendingChat(false);
      }, 250);
    };

    if (socket) {
      socket.emit('room:chat:send', {
        roomId: rId,
        text,
        clientId,
        messageId: clientId,
        user
      }, (res) => {
        releaseSendingLock();
        if (res && res.success && res.message) {
          const serverMsg = res.message;
          setChatMessages(prev => {
            const list = prev || [];
            const idx = list.findIndex(m => m.id === clientId || m.clientId === clientId);
            if (idx > -1) {
              const updated = [...list];
              updated[idx] = { ...updated[idx], ...serverMsg };
              return updated.slice(-50);
            }
            if (!list.some(m => m.id === serverMsg.id)) {
              return [...list.slice(-49), serverMsg];
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
          releaseSendingLock();
          if (data && data.success && data.message) {
            const serverMsg = data.message;
            setChatMessages(prev => {
              const list = prev || [];
              const idx = list.findIndex(m => m.id === clientId || m.clientId === clientId);
              if (idx > -1) {
                const updated = [...list];
                updated[idx] = { ...updated[idx], ...serverMsg };
                return updated.slice(-50);
              }
              if (!list.some(m => m.id === serverMsg.id)) {
                return [...list.slice(-49), serverMsg];
              }
              return list;
            });
          }
        })
        .catch(() => {
          releaseSendingLock();
        });
    }
  };

  // 8. Send Live Emoji Reaction (Throttled to 350ms to prevent flood/lag)
  const handleSendReaction = (emoji) => {
    if (!activeRoom) return;
    const now = Date.now();
    if (now - (lastReactionTimeRef.current || 0) < 350) return;
    lastReactionTimeRef.current = now;

    const rId = activeRoom.roomId || activeRoom.id;
    if (socket) {
      socket.emit('room:react', {
        roomId: rId,
        emoji,
        user: { 
          displayName: user?.displayName || user?.username || 'Listener',
          username: user?.username || 'Listener',
          avatarUrl: user?.avatarUrl || ''
        }
      });
    }
  };

  // Queue Handlers
  const handleAddTrackToQueue = (track) => {
    if (!activeRoom || !track) return;
    const rId = activeRoom.roomId || activeRoom.id;
    if (socket) {
      socket.emit('room:queue:add', { roomId: rId, track, user }, (res) => {
        if (res && res.success) {
          if (showToast) showToast(`Added "${track.title}" to Room Queue`);
          setIsAddingQueueSong(false);
          setQueueSearchQuery('');
        } else if (res && res.error) {
          if (showToast) showToast(res.error, 'warning');
        }
      });
    }
  };

  const handlePlayNextInRoom = (track) => {
    if (!activeRoom || !track) return;
    const rId = activeRoom.roomId || activeRoom.id;
    if (socket) {
      socket.emit('room:queue:playNext', { roomId: rId, track, user }, (res) => {
        if (res && res.success) {
          if (showToast) showToast(`Set "${track.title}" to Play Next in Room`);
          setIsAddingQueueSong(false);
          setQueueSearchQuery('');
        } else if (res && res.error) {
          if (showToast) showToast(res.error, 'warning');
        }
      });
    }
  };

  const handleReorderRoomQueue = (newQueue) => {
    if (!activeRoom || !Array.isArray(newQueue)) return;
    const rId = activeRoom.roomId || activeRoom.id;
    if (socket) {
      socket.emit('room:queue:reorder', { roomId: rId, queue: newQueue, user }, (res) => {
        if (res && res.error) {
          if (showToast) showToast(res.error, 'warning');
        }
      });
    }
  };

  const handleToggleQueueVote = (queueItemId) => {
    if (!activeRoom || !queueItemId) return;
    const rId = activeRoom.roomId || activeRoom.id;
    if (socket) {
      socket.emit('room:queue:vote', { roomId: rId, queueItemId, user });
    }
  };

  const handleRemoveQueueItem = (queueItemId) => {
    if (!activeRoom || !queueItemId) return;
    const rId = activeRoom.roomId || activeRoom.id;
    if (socket) {
      socket.emit('room:queue:remove', { roomId: rId, queueItemId, user });
    }
  };

  const handleUpdatePermissionMode = (newMode) => {
    if (!activeRoom || !isHost) return;
    const rId = activeRoom.roomId || activeRoom.id;
    if (socket) {
      socket.emit('room:permission:update', { roomId: rId, permissionMode: newMode, user }, (res) => {
        if (res && res.success) {
          setRoomPermissionMode(newMode);
        }
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

  // 14. Archive or restore room
  const handleToggleArchive = async (targetRoomId, shouldArchive = true) => {
    const rId = targetRoomId || activeRoom?.roomId || activeRoom?.id;
    if (!rId) return;

    // Optimistic local state update across tabs
    if (shouldArchive) {
      setRooms(prev => (prev || []).filter(r => (r.roomId || r.id) !== rId));
      setLeftRooms(prev => (prev || []).filter(lr => (lr.roomId || lr.id) !== rId));
      const archivedItem = rooms.find(r => (r.roomId || r.id) === rId) || (activeRoom && (activeRoom.roomId === rId || activeRoom.id === rId) ? activeRoom : null);
      if (archivedItem) {
        setArchivedRooms(prev => {
          if ((prev || []).some(ar => (ar.roomId || ar.id) === rId)) return prev;
          return [{ ...archivedItem, isArchived: true, status: 'archived', archivedAt: new Date().toISOString() }, ...(prev || [])];
        });
      }
    } else {
      setArchivedRooms(prev => (prev || []).filter(ar => (ar.roomId || ar.id) !== rId));
      const restoredItem = archivedRooms.find(ar => (ar.roomId || ar.id) === rId) || (activeRoom && (activeRoom.roomId === rId || activeRoom.id === rId) ? activeRoom : null);
      if (restoredItem) {
        setRooms(prev => {
          if ((prev || []).some(r => (r.roomId || r.id) === rId)) return prev;
          return [{ ...restoredItem, isArchived: false, status: 'active', archivedAt: null }, ...(prev || [])];
        });
      }
    }

    if (socket) {
      socket.emit('room:archive', { roomId: rId, shouldArchive, user }, (res) => {
        if (res && res.success) {
          if (showToast) showToast(shouldArchive ? 'Room archived' : 'Room restored to active');
          refreshRooms();
          if (activeRoom && (activeRoom.roomId === rId || activeRoom.id === rId)) {
            setActiveRoom(prev => prev ? { ...prev, isArchived: shouldArchive, status: shouldArchive ? 'archived' : 'active' } : prev);
          }
        } else {
          if (showToast) showToast(res?.error || 'Failed to archive/restore room', 'error');
        }
      });
    }

    try {
      const res = await fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/archive`), {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ isArchived: shouldArchive })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (!socket && showToast) showToast(shouldArchive ? 'Room archived' : 'Room restored to active');
        refreshRooms();
        if (activeRoom && (activeRoom.roomId === rId || activeRoom.id === rId)) {
          setActiveRoom(prev => prev ? { ...prev, isArchived: shouldArchive, status: shouldArchive ? 'archived' : 'active' } : prev);
        }
      } else if (!socket) {
        if (showToast) showToast(data?.error || 'Failed to archive/restore room', 'error');
      }
    } catch (e) {
      if (!socket && showToast) showToast('Network error archiving room', 'error');
    }
  };

  // 15. Permanently delete room (Strictly authorized Host only or deleting left room)
  const handleConfirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    const rId = roomToDelete.roomId || roomToDelete.id;
    const isFromLeftRooms = roomToDelete._isLeftRoom || filterTab === 'left';
    setIsDeletingRoom(true);

    // Clean URL query param if active
    if (typeof window !== 'undefined' && window.history && window.location) {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('room') === rId || url.searchParams.get('roomCode') === roomToDelete.code) {
          url.searchParams.delete('room');
          url.searchParams.delete('roomCode');
          window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : '') + (url.hash || ''));
        }
      } catch (e) {}
    }

    // Optimistically remove from all room collections immediately
    const toDeleteIds = [rId, roomToDelete.code].filter(Boolean);
    setDeletedRoomIds(prev => {
      const next = Array.from(new Set([...(prev || []), ...toDeleteIds]));
      persistDeletedRoomIds(next);
      return next;
    });

    setRooms(prev => (prev || []).filter(r => (r.roomId || r.id) !== rId));
    setLeftRooms(prev => (prev || []).filter(lr => (lr.roomId || lr.id) !== rId));
    setArchivedRooms(prev => (prev || []).filter(ar => (ar.roomId || ar.id) !== rId));

    if (socket) {
      socket.emit('room:delete', { roomId: rId, user });
    }

    try {
      // If deleting from Left Rooms, call the dedicated left room deletion endpoint (or general DELETE if host)
      const deleteEndpoint = isFromLeftRooms 
        ? `/api/rooms/${encodeURIComponent(rId)}/left` 
        : `/api/rooms/${encodeURIComponent(rId)}`;
        
      const res = await fetch(getApiUrl(deleteEndpoint), {
        method: 'DELETE',
        headers: authHeaders
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (showToast) {
          showToast(isFromLeftRooms ? `Removed "${roomToDelete.name}" from Left Rooms` : `Room "${roomToDelete.name}" permanently deleted`);
        }
        if (activeRoom && (activeRoom.roomId === rId || activeRoom.id === rId)) {
          setActiveRoom(null);
          setParticipants([]);
          setActivities([]);
          setChatMessages([]);
        }
        // Optimistically update states immediately
        setRooms(prev => (prev || []).filter(r => (r.roomId || r.id) !== rId));
        setLeftRooms(prev => (prev || []).filter(lr => (lr.roomId || lr.id) !== rId));
        setArchivedRooms(prev => (prev || []).filter(ar => (ar.roomId || ar.id) !== rId));
        refreshRooms();
      } else {
        if (showToast) showToast(data?.error || 'Failed to delete room', 'error');
      }
    } catch (e) {
      if (showToast) showToast('Network error deleting room', 'error');
    } finally {
      setIsDeletingRoom(false);
      setRoomToDelete(null);
    }
  };

  // Legacy helper
  const handleArchiveOrDeleteRoom = (action) => {
    if (!activeRoom || !isHost) return;
    const rId = activeRoom.roomId || activeRoom.id;
    if (action === 'delete') {
      setRoomToDelete(activeRoom);
      return;
    }
    handleToggleArchive(rId, action === 'archive');
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

  // Delete an entire room playlist
  const handleDeleteRoomPlaylist = (playlist) => {
    if (!activeRoom || !playlist) return;
    if (!isHost && !isCoHost) {
      if (showToast) showToast('Only the host or co-hosts can delete room playlists', 'warning');
      return;
    }
    setPlaylistToDelete(playlist);
  };

  const handleConfirmDeleteRoomPlaylist = async () => {
    if (!activeRoom || !playlistToDelete || isDeletingPlaylist) return;
    const rId = activeRoom.roomId || activeRoom.id;
    const pId = playlistToDelete.id;
    setIsDeletingPlaylist(true);

    // Optimistic local state update
    if (setRoomPlaylists) {
      setRoomPlaylists(prev => (prev || []).filter(p => p.id !== pId));
    }
    if (selectedPlaylistId === pId) {
      setDetailedPlaylistView(false);
      setSelectedPlaylistId(null);
    }

    try {
      if (socket) {
        socket.emit('room:playlist:delete', { roomId: rId, playlistId: pId, user }, (res) => {
          setIsDeletingPlaylist(false);
          setPlaylistToDelete(null);
          if (res?.success) {
            if (showToast) showToast(`Deleted room playlist "${playlistToDelete.name}"`);
          } else {
            if (showToast) showToast(res?.error || 'Failed to delete room playlist', 'error');
          }
        });
      } else {
        const res = await fetch(getApiUrl(`/api/rooms/${encodeURIComponent(rId)}/playlists/${encodeURIComponent(pId)}`), {
          method: 'DELETE',
          headers: authHeaders,
          body: JSON.stringify({ user })
        });
        const data = await res.json();
        setIsDeletingPlaylist(false);
        setPlaylistToDelete(null);
        if (res.ok && data?.success) {
          if (showToast) showToast(`Deleted room playlist "${playlistToDelete.name}"`);
        } else {
          if (showToast) showToast(data?.error || 'Failed to delete room playlist', 'error');
        }
      }
    } catch (e) {
      setIsDeletingPlaylist(false);
      setPlaylistToDelete(null);
      if (showToast) showToast('Network error deleting playlist', 'error');
    }
  };

  const activeSelectedPlaylist = (roomPlaylists || []).find(p => p.id === selectedPlaylistId) || (roomPlaylists && roomPlaylists[0]);

  // Filter active rooms: strictly exclude any room that is archived, left by current user, or deleted
  const activeValidRooms = rooms.filter(r => {
    if (!r) return false;
    const rId = r.roomId || r.id;
    const code = r.code;
    const currentDeleted = deletedRoomIds || [];
    // Strictly exclude deleted locally or on server
    if (r.status === 'deleted' || r.isDeleted) return false;
    if (rId && currentDeleted.includes(rId)) return false;
    if (code && currentDeleted.includes(code)) return false;
    // Exclude any purged or deleted test rooms matching "Devil"
    if (r.name && String(r.name).trim().toLowerCase() === 'devil') return false;
    // Strictly exclude archived
    if (r.status === 'archived' || r.isArchived) return false;
    // Strictly exclude if current user has left this room
    if (leftRooms.some(lr => (lr.roomId || lr.id) === rId)) return false;
    if (Array.isArray(r.leftMembers) && r.leftMembers.some(lm => String(lm.userId || '').trim() === String(currentUserId || '').trim())) {
      const isStillMember = Array.isArray(r.members) && r.members.some(m => String(m.userId || '').trim() === String(currentUserId || '').trim());
      if (!isStillMember) return false;
    }
    return true;
  });

  // Filter rooms according to active chip
  const filteredRooms = activeValidRooms.filter(r => {
    if (filterTab === 'created') {
      return r.createdBy?.userId === currentUserId;
    }
    if (filterTab === 'joined') {
      const isCreator = r.createdBy?.userId === currentUserId;
      if (isCreator) return false;
      // Strictly must be an actual active member of the room!
      const isMember = Array.isArray(r.members) && r.members.some(m => String(m.userId || '').trim() === String(currentUserId || '').trim());
      return Boolean(isMember || r.isMember);
    }
    return true;
  });

  return (
    <div className={`page-transition w-full px-2 sm:px-4 md:px-8 space-y-6 relative z-10 ${currentSong ? 'pb-44 sm:pb-48 md:pb-32' : 'pb-28 sm:pb-32 md:pb-16'}`}>
      {/* Floating live emoji reactions layer */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
        {floatingReactions.map(r => (
          <div
            key={r.id}
            className="absolute bottom-24 animate-floatUp text-3xl select-none flex flex-col items-center will-change-transform"
            style={{
              left: `${r.left}%`,
              transform: 'translate3d(0, 0, 0)'
            }}
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
        <div className="space-y-4 animate-fadeIn">
          {/* Header Bar: Clean, uncluttered with Three-Dot Overflow Menu */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  // Leave active view without disconnecting
                  setActiveRoom(null);
                }}
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer border border-neutral-700/50 shrink-0"
                title="Back to All Rooms"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">All Rooms</span>
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-2xl font-display font-black tracking-tight text-white truncate max-w-[200px] sm:max-w-md">
                    {activeRoom.name}
                  </h2>
                  {activeRoom.code && (
                    <button
                      type="button"
                      onClick={() => handleCopyCodeOnly(activeRoom.code)}
                      className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-amber-300 bg-neutral-800/90 hover:bg-neutral-700 px-2 py-0.5 rounded-lg border border-amber-500/30 transition cursor-pointer active:scale-95 shrink-0"
                      title="Click to copy room code"
                    >
                      <Copy className="w-3 h-3 text-amber-400" />
                      <span>{activeRoom.code}</span>
                      {copiedCodeNotice && <span className="text-[9px] text-emerald-400 font-sans font-semibold ml-1">Copied!</span>}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Header Right Actions: Invite Button + Three-Dot (⋮) Menu */}
            <div className="flex items-center gap-2 shrink-0">
              {isUiVisible('btn.inviteRoom') && (
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer"
                  title="Copy Share Link"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied!' : 'Invite'}</span>
                </button>
              )}

              {/* Three-Dot (⋮) Overflow Menu */}
              <div className="relative" data-dropdown>
                <button
                  type="button"
                  onClick={() => setIsRoomMenuOpen(prev => !prev)}
                  className={`p-2 rounded-xl border transition cursor-pointer active:scale-95 ${
                    isRoomMenuOpen
                      ? 'bg-neutral-700 text-white border-neutral-600'
                      : 'bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 hover:text-white border-neutral-700/50'
                  }`}
                  title="Room Actions"
                  aria-label="Room Actions Menu"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {isRoomMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 rounded-2xl bg-neutral-900 border border-neutral-700/90 shadow-2xl py-1.5 z-50 animate-fadeIn backdrop-blur-xl">
                    <div className="px-3 py-1.5 border-b border-neutral-800 text-[10px] uppercase font-mono tracking-wider text-neutral-400 flex items-center justify-between">
                      <span>Room Settings</span>
                      <span className={`px-1.5 py-0.2 rounded font-bold ${activeRoom.isPublic ? 'text-emerald-400 bg-emerald-500/10' : 'text-purple-400 bg-purple-500/10'}`}>
                        {activeRoom.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>

                    {isHost && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setIsRoomMenuOpen(false);
                            handleTogglePrivacy();
                          }}
                          disabled={isUpdatingPrivacy}
                          className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-neutral-800/80 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isUpdatingPrivacy ? (
                            <RefreshCw className="w-3.5 h-3.5 text-neutral-400 animate-spin" />
                          ) : activeRoom.isPublic ? (
                            <Lock className="w-3.5 h-3.5 text-purple-400" />
                          ) : (
                            <Globe className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          <span>Make {activeRoom.isPublic ? 'Invite-Only (Private)' : 'Public'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsRoomMenuOpen(false);
                            handleRegenerateCode();
                          }}
                          disabled={isRegeneratingCode}
                          className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-neutral-800/80 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRegeneratingCode ? 'animate-spin' : ''}`} />
                          <span>Generate New Code</span>
                        </button>

                        {isUiVisible('btn.archiveRoom') && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsRoomMenuOpen(false);
                              handleToggleArchive(activeRoom.roomId || activeRoom.id, !(activeRoom.isArchived || activeRoom.status === 'archived'));
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-neutral-800/80 transition flex items-center gap-2 cursor-pointer"
                          >
                            {activeRoom.isArchived || activeRoom.status === 'archived' ? (
                              <>
                                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Restore Room</span>
                              </>
                            ) : (
                              <>
                                <Archive className="w-3.5 h-3.5 text-amber-400" />
                                <span>Archive Room</span>
                              </>
                            )}
                          </button>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsRoomMenuOpen(false);
                        handleLeave();
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 transition flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                      <span>Leave Room</span>
                    </button>

                    {isHost && (
                      <div className="border-t border-neutral-800 mt-1 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsRoomMenuOpen(false);
                            setRoomToDelete(activeRoom);
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 transition flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Delete Room</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Active Room Members Strip */}
          <div 
            onClick={() => setIsMemberPopoverOpen(true)}
            className="p-2.5 sm:p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 hover:border-neutral-700 transition flex items-center justify-between gap-3 cursor-pointer group"
            title="Click to view Room Members & invite code"
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMemberPopoverOpen(true);
              }}
              className="text-[11px] text-amber-400 font-semibold hover:underline shrink-0 flex items-center gap-0.5 cursor-pointer"
            >
              <span>View All ({participants.length}) →</span>
            </button>
          </div>

          {/* Minimal Listen Together Card With Three-Dot (⋮) Menu */}
          {isUiVisible('btn.listenTogether') && (
            <div className="p-3 sm:p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
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
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white truncate">Listen Together (Sync Playback)</span>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isRoomPlaybackSyncEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'}`} />
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate">
                    {isRoomPlaybackSyncEnabled 
                      ? (isHost ? 'Synced with Room · Broadcasting Live' : `Synced with Host (${hostMember?.displayName || activeRoom?.createdBy?.displayName || 'Host'}) · Live`)
                      : 'Off: Listen independently to any song'}
                  </p>
                </div>
              </div>

              {/* Right: Three-Dot (⋮) Menu for Listen Together Tools & Reactions */}
              <div className="relative shrink-0" data-dropdown>
                <button
                  type="button"
                  onClick={() => setIsListenTogetherMenuOpen(prev => !prev)}
                  className={`p-2 rounded-xl border transition cursor-pointer active:scale-95 ${
                    isListenTogetherMenuOpen
                      ? 'bg-neutral-700 text-white border-neutral-600'
                      : 'bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 hover:text-white border-neutral-700/50'
                  }`}
                  title="Playback Sync Tools & Reactions"
                  aria-label="Playback Sync Menu"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {isListenTogetherMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl bg-neutral-900 border border-neutral-700/90 shadow-2xl py-2 z-50 animate-fadeIn backdrop-blur-xl space-y-2">
                    <div className="px-3 pb-1.5 border-b border-neutral-800">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-bold block mb-1.5">
                        Sync Actions
                      </span>
                      <div className="space-y-1">
                        {isUiVisible('btn.syncLive') && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsListenTogetherMenuOpen(false);
                              handleSyncToLivePlayback();
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 transition flex items-center gap-2 cursor-pointer"
                            title="Sync player to room's live playback timestamp"
                          >
                            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                            <span>Sync Live Playback</span>
                          </button>
                        )}

                        {isCoHost && isUiVisible('btn.broadcast') && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsListenTogetherMenuOpen(false);
                              handleBroadcastSync();
                            }}
                            disabled={!currentSong}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-300 hover:bg-amber-500/15 transition flex items-center gap-2 cursor-pointer disabled:opacity-40"
                            title="Broadcast your current playing song & timestamp to room"
                          >
                            <Radio className="w-3.5 h-3.5 text-amber-400" />
                            <span>Broadcast My Playback</span>
                          </button>
                        )}

                        {isUiVisible('btn.roomChat') && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsListenTogetherMenuOpen(false);
                              setIsChatOpen(prev => !prev);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition flex items-center gap-2 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                            <span>{isChatOpen ? 'Close Room Chat' : 'Open Room Chat'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quick Reactions inside menu */}
                    {isUiVisible('btn.roomReactions') && (
                      <div className="px-3 pt-0.5">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 font-bold block mb-1.5">
                          Quick Reactions
                        </span>
                        <div className="grid grid-cols-4 gap-1">
                          {QUICK_REACTIONS.map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                handleSendReaction(emoji);
                                setIsListenTogetherMenuOpen(false);
                              }}
                              className="text-lg p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 hover:scale-110 active:scale-95 transition flex items-center justify-center cursor-pointer"
                              title={`Send ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Synchronized Playback Request & Ready-Check Banner */}
          {activePlaybackRequest && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-neutral-900/90 to-purple-950/80 border border-amber-500/50 shadow-xl shadow-amber-500/10 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shrink-0">
                    <Music className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        Listen Together Request
                      </span>
                      <span className="text-[11px] text-neutral-400 font-mono">
                        Ready: {activePlaybackRequest.readyUsers?.length || 1} / {participants.length || 1}
                      </span>
                    </div>
                    <h4 className="text-white font-bold text-sm mt-0.5">
                      <span className="text-amber-400 font-extrabold">{activePlaybackRequest.initiatorName || 'Host'}</span> wants to play "{activePlaybackRequest.track?.title}" together!
                    </h4>
                  </div>
                </div>

                {/* Actions: Okay vs Decline */}
                <div className="flex items-center gap-2">
                  {String(activePlaybackRequest.initiatorId) === String(currentUserId) ? (
                    <button
                      type="button"
                      onClick={() => handleTriggerStartPlayback(activePlaybackRequest.track)}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Now ({activePlaybackRequest.readyUsers?.length || 1} Ready)</span>
                    </button>
                  ) : hasRespondedToRequest ? (
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>You're Ready</span>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleAcceptPlaybackRequest}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Okay</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeclinePlaybackRequest}
                        className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-300 font-semibold text-xs rounded-xl border border-neutral-700 transition cursor-pointer"
                      >
                        Decline
                      </button>
                    </>
                  )}
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
                  disabled={!chatInput.trim() || isSendingChat}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 font-bold text-xs rounded-xl transition disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {/* Navigation Sub-Tabs: Playlists, Activity Feed, Members */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 overflow-x-auto scrollbar-none w-full max-w-full">
            {isUiVisible('card.roomPlaylists') && (
              <button
                type="button"
                onClick={() => setActiveTab('playlists')}
                className={`flex-1 min-w-[90px] py-2 px-2.5 sm:px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'playlists'
                    ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
                }`}
              >
                <Music className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Playlists ({(roomPlaylists || []).length})</span>
              </button>
            )}

            {isUiVisible('card.liveActivity') && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('activity');
                  setUnreadActivityCount(0);
                }}
                className={`flex-1 min-w-[85px] py-2 px-2.5 sm:px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer relative whitespace-nowrap shrink-0 ${
                  activeTab === 'activity'
                    ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
                }`}
              >
                <Radio className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Activity</span>
                {unreadActivityCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping ml-0.5" />
                )}
              </button>
            )}

            {isUiVisible('card.roomMembers') && (
              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className={`flex-1 min-w-[95px] py-2 px-2.5 sm:px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'members'
                    ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Members ({participants.length})</span>
              </button>
            )}
          </div>

          {/* TAB 1: COLLABORATIVE PLAYLISTS */}
          {activeTab === 'playlists' && isUiVisible('card.roomPlaylists') && (
            <div className="space-y-4">
              {/* Clean Playlist Toolbar */}
              <div className="flex items-center justify-between gap-2.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Playlists</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !sortByVotes;
                      setSortByVotes(next);
                      if (showToast) {
                        showToast(next ? '👍 Sorting tracks by upvotes' : '🎵 Default playlist order');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border flex items-center gap-1.5 transition cursor-pointer active:scale-95 ${
                      sortByVotes 
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm' 
                        : 'bg-neutral-800/80 text-neutral-400 hover:text-white border-neutral-700/60'
                    }`}
                    title={sortByVotes ? "Active: Songs sorted by highest upvotes. Click for default order." : "Click to sort songs by most upvotes."}
                    aria-label="Sort tracks by upvotes"
                  >
                    <ArrowUpDown className="w-3 h-3 text-amber-400" />
                    <span>{sortByVotes ? 'Sort: Upvotes' : 'Sort: Default'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {isUiVisible('btn.importPlaylist') && (
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold text-xs border border-purple-500/40 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title="Import one of your personal playlists into this room"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Import My Playlist</span>
                    </button>
                  )}

                  {isUiVisible('btn.newRoomPlaylist') && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingPlaylist(!isCreatingPlaylist)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-500/40 transition flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isCreatingPlaylist ? 'Cancel' : 'New Room Playlist'}</span>
                    </button>
                  )}
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
                <div className="p-3 sm:p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 space-y-3 sm:space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => setDetailedPlaylistView(false)}
                        className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer border border-neutral-700 shrink-0"
                        title="Back to Room Playlists"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>All Playlists</span>
                      </button>

                      <div className="min-w-0">
                        <h5 className="font-bold text-white text-sm sm:text-base flex items-center gap-2 truncate">
                          <span className="truncate">{activeSelectedPlaylist.name}</span>
                          <span className="text-[10px] bg-neutral-800 text-amber-400 font-mono px-2 py-0.5 rounded-full border border-neutral-700/60 font-semibold shrink-0">
                            {activeSelectedPlaylist.songs?.length === 1 ? '1 Track' : `${activeSelectedPlaylist.songs?.length || 0} Tracks`}
                          </span>
                        </h5>
                        {activeSelectedPlaylist.description && (
                          <p className="text-xs text-neutral-400 mt-0.5 truncate">{activeSelectedPlaylist.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {activeSelectedPlaylist.songs?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const s = activeSelectedPlaylist.songs[0];
                            if (s) {
                              handleRoomSongClick(s);
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play All</span>
                        </button>
                      )}

                      {isUiVisible('btn.saveToLibrary') && (
                        <button
                          type="button"
                          onClick={() => handleForkPlaylist(activeSelectedPlaylist)}
                          className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 font-semibold text-[11px] transition cursor-pointer active:scale-95"
                          title="Copy all songs from this room playlist to your personal library"
                        >
                          <Copy className="w-3 h-3 text-amber-400" />
                          <span>Save to My Library</span>
                        </button>
                      )}

                      {(isHost || isCoHost) && (
                        <div className="flex items-center pl-1 sm:border-l sm:border-neutral-800">
                          <button
                            type="button"
                            onClick={() => handleDeleteRoomPlaylist(activeSelectedPlaylist)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 flex items-center gap-1.5 font-semibold text-[11px] transition cursor-pointer active:scale-95"
                            title="Delete this room playlist"
                          >
                            <Trash2 className="w-3 h-3 text-rose-400" />
                            <span>Delete Playlist</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Songs List */}
                  {(!activeSelectedPlaylist.songs || activeSelectedPlaylist.songs.length === 0) ? (
                    <div className="text-center py-10 text-neutral-500 text-xs border border-dashed border-neutral-800 rounded-xl space-y-3 px-4">
                      <Music className="w-8 h-8 text-neutral-600 mx-auto" />
                      <div>
                        <p className="font-semibold text-neutral-300">This room playlist is empty</p>
                        <p className="text-[11px] text-neutral-400 max-w-sm mx-auto mt-1">
                          0 tracks · Tap below or use the global <span className="text-amber-400 font-bold">"Add to Playlist"</span> menu on any song in Loopra!
                        </p>
                      </div>
                      {onOpenAddToPlaylist && (
                        <button
                          type="button"
                          onClick={() => onOpenAddToPlaylist(currentSong || null)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition active:scale-95 cursor-pointer shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Add Song to Playlist</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                      {([...(activeSelectedPlaylist.songs || [])].sort((a, b) => {
                        if (!sortByVotes) return 0;
                        const vA = (a.votes && a.votes.length) || 0;
                        const vB = (b.votes && b.votes.length) || 0;
                        return vB - vA;
                      })).map((song, idx) => {
                        const songId = song.id || song.videoId || `track_${idx}`;
                        const voteCount = song.votes ? song.votes.length : 0;
                        const hasVoted = song.votes && song.votes.includes(currentUserId);
                        const songLiked = typeof isLiked === 'function' ? isLiked(song) : false;
                        const canDeleteTrack = isCoHost || song.addedBy?.userId === currentUserId;
                        const isMenuOpen = openTrackMenuId === songId;

                        return (
                          <div
                            key={songId}
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
                                  type="button"
                                  onClick={() => handleRoomSongClick(song)}
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
                                  {voteCount > 0 && (
                                    <>
                                      <span>•</span>
                                      <span className="text-amber-400 font-mono font-semibold">▲ {voteCount}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Clean Single Three-Dot (⋮) Action Menu */}
                            <div className="relative shrink-0" data-dropdown>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenTrackMenuId(prev => prev === songId ? null : songId);
                                }}
                                className={`p-1.5 rounded-lg border transition cursor-pointer active:scale-95 ${
                                  isMenuOpen
                                    ? 'bg-neutral-700 text-white border-neutral-600'
                                    : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white border-neutral-700/60'
                                }`}
                                title="Song Actions"
                                aria-label="Song Actions Menu"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {isMenuOpen && (
                                <div className="absolute right-0 top-full mt-1 w-48 rounded-2xl bg-neutral-900 border border-neutral-700/90 shadow-2xl py-1.5 z-50 animate-fadeIn backdrop-blur-xl">
                                  {/* Like / Unlike action */}
                                  {onToggleLike && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenTrackMenuId(null);
                                        onToggleLike(song);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-neutral-800/80 transition flex items-center gap-2 cursor-pointer"
                                    >
                                      <Heart className={`w-3.5 h-3.5 ${songLiked ? 'fill-current text-pink-500' : 'text-neutral-400'}`} />
                                      <span>{songLiked ? 'Remove from Favorites' : 'Add to Favorites'}</span>
                                    </button>
                                  )}

                                  {/* Upvote action */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenTrackMenuId(null);
                                      handleVoteTrack(activeSelectedPlaylist.id, song.id || song.videoId);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-neutral-800/80 transition flex items-center gap-2 cursor-pointer"
                                  >
                                    <ThumbsUp className={`w-3.5 h-3.5 ${hasVoted ? 'fill-current text-amber-400' : 'text-neutral-400'}`} />
                                    <span>{hasVoted ? `Upvoted (${voteCount})` : `Upvote (${voteCount})`}</span>
                                  </button>

                                  {/* Add to Queue action */}
                                  {onAddToQueue && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenTrackMenuId(null);
                                        onAddToQueue(song);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-200 hover:text-white hover:bg-neutral-800/80 transition flex items-center gap-2 cursor-pointer"
                                    >
                                      <ListPlus className="w-3.5 h-3.5 text-neutral-400" />
                                      <span>Add to Queue</span>
                                    </button>
                                  )}

                                  {/* Remove Song from Room Playlist */}
                                  {canDeleteTrack && (
                                    <div className="border-t border-neutral-800 mt-1 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenTrackMenuId(null);
                                          handleRemoveTrackFromRoomPlaylist(activeSelectedPlaylist.id, song.id || song.videoId);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 transition flex items-center gap-2 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                        <span>Remove from Playlist</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-4 mt-2">
                  {/* Card 1: Create New Playlist Action Card */}
                  <div
                    onClick={() => setIsCreatingPlaylist(true)}
                    className="p-3 sm:p-4 rounded-2xl border border-dashed border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-neutral-900/40 to-neutral-950/80 hover:border-amber-400 hover:bg-amber-500/15 active:scale-[0.98] cursor-pointer flex flex-col items-center justify-center gap-2 sm:gap-2.5 transition-all group text-center aspect-square shadow-lg backdrop-blur-md"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-400 group-hover:scale-110 flex items-center justify-center transition shadow-[0_0_15px_rgba(245,158,11,0.2)] shrink-0">
                      <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="w-full px-1">
                      <h3 className="font-black text-white text-[11px] sm:text-sm truncate w-full group-hover:text-amber-300 transition">
                        New Playlist
                      </h3>
                      <p className="text-[9px] sm:text-[10px] text-amber-400/90 font-mono mt-0.5 truncate">+ Shared List</p>
                    </div>
                  </div>

                  {/* Card 2: Import My Playlists Action Card */}
                  <div
                    onClick={() => setIsImportModalOpen(true)}
                    className="p-3 sm:p-4 rounded-2xl border border-dashed border-purple-500/35 bg-gradient-to-br from-purple-500/10 via-neutral-900/40 to-neutral-950/80 hover:border-purple-400 hover:bg-purple-500/15 active:scale-[0.98] cursor-pointer flex flex-col items-center justify-center gap-2 sm:gap-2.5 transition-all group text-center aspect-square shadow-lg backdrop-blur-md"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-purple-500/20 border border-purple-400/30 text-purple-400 group-hover:scale-110 flex items-center justify-center transition shadow-[0_0_15px_rgba(168,85,247,0.2)] shrink-0">
                      <FolderPlus className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="w-full px-1">
                      <h3 className="font-black text-white text-[11px] sm:text-sm truncate w-full group-hover:text-purple-300 transition">
                        Import Playlists
                      </h3>
                      <p className="text-[9px] sm:text-[10px] text-purple-400/90 font-mono mt-0.5 truncate">Multi-Select</p>
                    </div>
                  </div>

                  {/* Room Playlist Cards with Cassette Vinyl / Artwork Thumbnails */}
                  {(roomPlaylists || []).map(pl => {
                    const songCount = pl.songs?.length || 0;
                    const isEmpty = songCount === 0;
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
                        className="relative p-2.5 sm:p-3 rounded-2xl border border-white/5 hover:border-amber-500/40 bg-gradient-to-br from-neutral-900/90 via-[#121216] to-[#0c0c0e] active:scale-[0.98] cursor-pointer flex flex-col justify-between transition-all group aspect-square shadow-xl backdrop-blur-md overflow-hidden"
                      >
                        {/* Ambient glow on hover */}
                        <div className="absolute inset-0 bg-amber-500/0 group-hover:bg-amber-500/5 transition-colors pointer-events-none" />

                        {/* Top row: Track Count Micro-Pill & Quick Play/Fork/Add */}
                        <div className="flex items-center justify-between w-full relative z-10" onClick={(e) => e.stopPropagation()}>
                          <span className={`text-[9px] font-mono px-1.5 sm:px-2 py-0.5 rounded-full border font-semibold ${
                            isEmpty 
                              ? 'bg-amber-500/10 text-amber-300/90 border-amber-500/30' 
                              : songCount === 1 
                              ? 'bg-neutral-800/90 text-amber-400 border-neutral-700/60' 
                              : 'bg-neutral-800/90 text-amber-400 border-neutral-700/60'
                          }`}>
                            {isEmpty ? '0 tracks' : songCount === 1 ? '1 Track' : `${songCount} Tracks`}
                          </span>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isEmpty && onOpenAddToPlaylist && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenAddToPlaylist(currentSong || null);
                                }}
                                className="p-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition flex items-center gap-0.5 text-[9px] font-bold"
                                title="Add song to this playlist"
                                aria-label="Add song to this playlist"
                              >
                                <Plus className="w-3 h-3" />
                                <span className="hidden sm:inline">Add</span>
                              </button>
                            )}
                            {(isHost || isCoHost) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRoomPlaylist(pl);
                                }}
                                className="p-1 rounded-lg bg-neutral-800/90 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 border border-neutral-700/60 transition"
                                title="Delete Room Playlist"
                                aria-label="Delete Room Playlist"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
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
                                  if (pl.songs[0]) {
                                    handleRoomSongClick(pl.songs[0]);
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
                            <div className="grid grid-cols-2 gap-1 w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden shadow-lg border border-white/10">
                              {songThumbs.map((t, idx) => (
                                <img key={idx} src={t} alt="" className="w-full h-full object-cover" />
                              ))}
                            </div>
                          ) : songThumbs.length > 0 ? (
                            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden shadow-lg border border-amber-500/20">
                              <img src={songThumbs[0]} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-neutral-800/80 border border-white/10 group-hover:border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner group-hover:scale-105 transition">
                              <Disc className="w-5 h-5 sm:w-7 sm:h-7" />
                            </div>
                          )}
                        </div>

                        {/* Bottom Label */}
                        <div className="relative z-10 text-left pt-1">
                          <h3 className="font-extrabold text-white text-xs sm:text-sm truncate w-full group-hover:text-amber-300 transition">
                            {pl.name}
                          </h3>
                          <p className="text-[10px] text-zinc-400 truncate">
                            {isEmpty ? '0 tracks · Tap to add' : 'Tap to open songs'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIVE ACTIVITY */}
          {activeTab === 'activity' && isUiVisible('card.roomActivity') && (
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
          {activeTab === 'members' && isUiVisible('card.roomMembers') && (
            <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4">
              {/* Host Section: Pending Join Requests */}
              {isHost && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <h5 className="font-bold text-white text-xs uppercase tracking-wider">
                        Re-Join Requests
                      </h5>
                    </div>
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                      {joinRequests.length} pending
                    </span>
                  </div>

                  {joinRequests.length === 0 ? (
                    <p className="text-[11px] text-neutral-400 italic">No pending re-join requests at this time.</p>
                  ) : (
                    <div className="space-y-2">
                      {joinRequests.map(req => (
                        <div 
                          key={req.userId}
                          className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between gap-2.5"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-white block truncate">{req.name}</span>
                            <span className="text-[10px] text-neutral-400 font-mono block truncate">
                              {req.email ? req.email : `User ID: ${req.userId.slice(0, 10)}...`}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleApproveJoinRequest(req.userId)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-[11px] flex items-center gap-1 shadow-md shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
                              title="Approve Member Re-join"
                            >
                              <UserCheck className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectJoinRequest(req.userId)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold text-[11px] flex items-center gap-1 active:scale-95 transition cursor-pointer"
                              title="Reject Request"
                            >
                              <UserX className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
                          {m.avatar || m.avatarUrl ? (
                            <img
                              src={m.avatar || m.avatarUrl}
                              alt=""
                              className="w-9 h-9 rounded-full object-cover border border-amber-500/30"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-md border ${
                              isHostRole 
                                ? 'bg-amber-600/30 text-amber-300 border-amber-500/50' 
                                : isCoHostRole 
                                ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50' 
                                : 'bg-neutral-800 text-neutral-200 border-neutral-700'
                            }`}>
                              {m.displayName ? m.displayName.charAt(0).toUpperCase() : 'U'}
                            </div>
                          )}
                          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-neutral-950 ${
                            memberStatuses[m.userId] === 'Buffering' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                          }`} title={memberStatuses[m.userId] || 'Online Live'} />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white truncate">{m.displayName || m.username}</span>
                            {isUser && <span className="text-[10px] text-amber-400 font-mono font-semibold">(You)</span>}
                            <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-full ${
                              memberStatuses[m.userId] === 'Buffering'
                                ? 'text-amber-400 bg-amber-500/15'
                                : 'text-emerald-400 bg-emerald-500/10'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                memberStatuses[m.userId] === 'Buffering' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'
                              }`} />
                              <span>{memberStatuses[m.userId] || 'Active'}</span>
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
                    {isUiVisible('btn.archiveRoom') && (
                      <button
                        onClick={() => handleToggleArchive(activeRoom.roomId || activeRoom.id, !(activeRoom.isArchived || activeRoom.status === 'archived'))}
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                        title={activeRoom.isArchived || activeRoom.status === 'archived' ? 'Restore Room to Active' : 'Archive Room'}
                      >
                        {activeRoom.isArchived || activeRoom.status === 'archived' ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Restore Room</span>
                          </>
                        ) : (
                          <>
                            <Archive className="w-3.5 h-3.5 text-amber-400" />
                            <span>Archive Room</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => setRoomToDelete(activeRoom)}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                      title="Permanently Delete Room"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Delete Room</span>
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

          {/* Quick Search & Preview Bar (Never auto-joins) */}
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex items-center gap-2">
              <input
                type="text"
                placeholder="Enter room code (e.g. SFSGRP) or room ID to preview..."
                value={joinCodeInput}
                onChange={(e) => {
                  setJoinCodeInput(e.target.value);
                  if (searchPreviewRoom) setSearchPreviewRoom(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && joinCodeInput.trim()) {
                    handleLookupCode(joinCodeInput.trim());
                  }
                }}
                className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-700/80 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 uppercase font-mono tracking-wider"
              />
              <button
                type="button"
                onClick={() => handleLookupCode(joinCodeInput.trim())}
                disabled={!joinCodeInput.trim() || isSearchingCode}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 font-bold text-xs rounded-xl transition disabled:opacity-40 cursor-pointer shadow-md shadow-amber-500/20 flex items-center gap-1.5"
              >
                {isSearchingCode ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <span>Search Room</span>
                )}
              </button>
            </div>

            {/* Room Preview Card (Rendered upon searching, with explicit Join / Open button) */}
            {searchPreviewRoom && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900 to-amber-950/30 border border-amber-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-scaleUp">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-md">
                    <Radio className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white truncate">{searchPreviewRoom.name}</h4>
                      {searchPreviewRoom.code && (
                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {searchPreviewRoom.code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-neutral-400 flex-wrap">
                      <span>Host: <strong className="text-white">{searchPreviewRoom.createdBy?.displayName || searchPreviewRoom.createdBy?.username || 'Host'}</strong></span>
                      <span>•</span>
                      <span className="text-emerald-400 font-mono font-medium">{searchPreviewRoom.memberCount || 1} online</span>
                      <span>•</span>
                      <span>
                        {(searchPreviewRoom.playlistsCount || 0) === 1
                          ? '1 playlist'
                          : `${searchPreviewRoom.playlistsCount || 0} playlists`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setSearchPreviewRoom(null)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition cursor-pointer"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    disabled={isJoiningRoom}
                    onClick={() => handleJoin(searchPreviewRoom.code || searchPreviewRoom.roomId || searchPreviewRoom.id)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
                  >
                    {isJoiningRoom ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>{isJoiningRoom ? 'Joining...' : (searchPreviewRoom.isMember ? 'Open Room' : 'Join Room')}</span>
                  </button>
                </div>
              </div>
            )}
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

          {/* Filter Chips Strip (Matching Your Playlists: All Rooms, Created by You, Joined Rooms, Left Rooms, Archived Rooms) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: 'All Rooms', count: activeValidRooms.length },
              { id: 'created', label: 'Created by You', count: activeValidRooms.filter(r => r.createdBy?.userId === currentUserId).length },
              { id: 'joined', label: 'Joined Rooms', count: activeValidRooms.filter(r => {
                if (r.createdBy?.userId === currentUserId) return false;
                const isMember = Array.isArray(r.members) && r.members.some(m => String(m.userId || '').trim() === String(currentUserId || '').trim());
                return Boolean(isMember || r.isMember);
              }).length },
              { id: 'left', label: 'Left Rooms', count: leftRooms.filter(lr => {
                const id = lr.roomId || lr.id;
                const code = lr.code;
                const currentDeleted = deletedRoomIds || [];
                return lr.status !== 'deleted' && !lr.isDeleted && lr.status !== 'archived' && !lr.isArchived && !currentDeleted.includes(id) && (!code || !currentDeleted.includes(code));
              }).length },
              { id: 'archived', label: 'Archived Rooms', count: archivedRooms.filter(ar => {
                const id = ar.roomId || ar.id;
                const code = ar.code;
                const currentDeleted = deletedRoomIds || [];
                return ar.status !== 'deleted' && !ar.isDeleted && !currentDeleted.includes(id) && (!code || !currentDeleted.includes(code));
              }).length }
            ].map(chip => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilterTab(chip.id)}
                className={`text-xs px-3 py-1 rounded-full whitespace-nowrap cursor-pointer transition select-none flex items-center gap-1.5 ${
                  filterTab === chip.id
                    ? 'bg-amber-400 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10'
                }`}
              >
                <span>{chip.label}</span>
                {chip.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    filterTab === chip.id ? 'bg-neutral-950/20 text-neutral-900 font-bold' : 'bg-white/10 text-neutral-400'
                  }`}>
                    {chip.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Rooms Grid */}
          {filterTab === 'archived' ? (
            /* ARCHIVED ROOMS SECTION (Excluding deleted rooms) */
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-400 flex items-center justify-between">
                <span>Rooms archived by their Host. Archived rooms are frozen until restored.</span>
                <span className="font-mono text-[11px] text-amber-400 font-bold">
                  {archivedRooms.filter(ar => {
                    const id = ar.roomId || ar.id;
                    const code = ar.code;
                    const currentDeleted = deletedRoomIds || [];
                    return ar.status !== 'deleted' && !ar.isDeleted && !currentDeleted.includes(id) && (!code || !currentDeleted.includes(code));
                  }).length} archived room
                  {archivedRooms.filter(ar => {
                    const id = ar.roomId || ar.id;
                    const code = ar.code;
                    const currentDeleted = deletedRoomIds || [];
                    return ar.status !== 'deleted' && !ar.isDeleted && !currentDeleted.includes(id) && (!code || !currentDeleted.includes(code));
                  }).length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-2">
                {archivedRooms.filter(r => {
                  const id = r.roomId || r.id;
                  const code = r.code;
                  const currentDeleted = deletedRoomIds || [];
                  return r.status !== 'deleted' && !r.isDeleted && !currentDeleted.includes(id) && (!code || !currentDeleted.includes(code));
                }).map(r => {
                  const rId = r.roomId || r.id;
                  const isCreator = r.createdBy?.userId === currentUserId;

                  return (
                    <div
                      key={rId}
                      className="group relative p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800/90 hover:border-amber-500/30 transition flex flex-col justify-between shadow-lg"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1">
                            <Archive className="w-3 h-3" />
                            <span>Archived</span>
                          </span>
                          {r.code && (
                            <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded">
                              {r.code}
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="font-bold text-white text-sm truncate">{r.name}</h3>
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                            Host: <span className="text-neutral-300 font-medium">{r.createdBy?.displayName || r.createdBy?.username || 'Host'}</span>
                          </p>
                          {r.description && (
                            <p className="text-[11px] text-neutral-500 line-clamp-2 mt-1">{r.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-neutral-800 mt-3 flex items-center justify-between gap-2">
                        {isCreator ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleArchive(rId, false)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                              title="Restore Room to Active"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRoomToDelete(r)}
                              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                              title="Permanently Delete Room"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-neutral-500 italic">Archived by Host</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {archivedRooms.filter(r => {
                const id = r.roomId || r.id;
                const code = r.code;
                const currentDeleted = deletedRoomIds || [];
                return r.status !== 'deleted' && !r.isDeleted && !currentDeleted.includes(id) && (!code || !currentDeleted.includes(code));
              }).length === 0 && (
                <div className="text-center py-12 text-neutral-500 text-xs border border-dashed border-neutral-800 rounded-2xl space-y-3 px-4">
                  <Archive className="w-10 h-10 text-neutral-600 mx-auto" />
                  <div>
                    <p className="font-bold text-neutral-300 text-sm">No archived rooms</p>
                    <p className="text-neutral-500 text-xs mt-1 max-w-sm mx-auto">
                      Rooms you archive will appear here so you can restore them anytime.
                    </p>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setFilterTab('all')}
                      className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition cursor-pointer active:scale-95"
                    >
                      Browse Active Rooms
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : filterTab === 'left' ? (
            /* LEFT ROOMS SECTION (Excluding archived and deleted rooms) */
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-400 flex items-center justify-between">
                <span>Rooms you previously left. Re-join requires Host approval.</span>
                <span className="font-mono text-[11px] text-amber-400 font-bold">
                  {leftRooms.filter(lr => {
                    const id = lr.roomId || lr.id;
                    const code = lr.code;
                    const currentDeleted = deletedRoomIds || [];
                    return lr.status !== 'deleted' && !lr.isDeleted && lr.status !== 'archived' && !lr.isArchived && !currentDeleted.includes(id) && (!code || !currentDeleted.includes(code));
                  }).length} left room
                  {leftRooms.filter(lr => {
                    const id = lr.roomId || lr.id;
                    const code = lr.code;
                    const currentDeleted = deletedRoomIds || [];
                    return lr.status !== 'deleted' && !lr.isDeleted && lr.status !== 'archived' && !lr.isArchived && !currentDeleted.includes(id) && (!code || !currentDeleted.includes(code));
                  }).length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-2">
                {leftRooms.filter(r => {
                  const id = r.roomId || r.id;
                  const code = r.code;
                  const currentDeleted = deletedRoomIds || [];
                  return r.status !== 'deleted' && !r.isDeleted && r.status !== 'archived' && !r.isArchived && !currentDeleted.includes(id) && (!code || !currentDeleted.includes(code));
                }).map(r => {
                  const rId = r.roomId || r.id;
                  const isPending = pendingRejoinRoomIds.includes(rId) || r.hasPendingRequest;

                  return (
                    <div
                      key={rId}
                      className="group relative p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 transition flex flex-col justify-between shadow-lg"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-md">
                            Left {r.leftAt ? new Date(r.leftAt).toLocaleDateString() : 'Previously'}
                          </span>
                          {r.code && (
                            <span className="text-[10px] font-mono text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              {r.code}
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="font-bold text-white text-sm truncate">{r.name}</h3>
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                            Host: <span className="text-neutral-300 font-medium">{r.createdBy?.displayName || r.createdBy?.username || 'Host'}</span>
                          </p>
                          {r.description && (
                            <p className="text-[11px] text-neutral-500 line-clamp-2 mt-1">{r.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-neutral-800 mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewLeftRoom(r)}
                            className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition cursor-pointer"
                          >
                            Preview
                          </button>

                          <button
                            type="button"
                            onClick={() => setRoomToDelete({ ...r, _isLeftRoom: true })}
                            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition flex items-center gap-1 cursor-pointer active:scale-95"
                            title={r.createdBy?.userId === currentUserId ? 'Permanently Delete Left Room' : 'Remove from Left Rooms'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleRequestToJoin(r)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
                            isPending 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-not-allowed'
                              : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 active:scale-95 cursor-pointer shadow-amber-500/20'
                          }`}
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>{isPending ? 'Pending' : 'Request to Join'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {leftRooms.filter(r => {
                const id = r.roomId || r.id;
                const code = r.code;
                const currentDeleted = deletedRoomIds || [];
                return r.status !== 'deleted' && !r.isDeleted && r.status !== 'archived' && !r.isArchived && !currentDeleted.includes(id) && (!code || !currentDeleted.includes(code));
              }).length === 0 && (
                <div className="text-center py-12 text-neutral-500 text-xs border border-dashed border-neutral-800 rounded-2xl space-y-3 px-4">
                  <LogOut className="w-10 h-10 text-neutral-600 mx-auto" />
                  <div>
                    <p className="font-bold text-neutral-300 text-sm">No left rooms</p>
                    <p className="text-neutral-500 text-xs mt-1 max-w-sm mx-auto">
                      Rooms you leave will appear here if you ever wish to request to re-join.
                    </p>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setFilterTab('all')}
                      className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition cursor-pointer active:scale-95"
                    >
                      Browse Active Rooms
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ACTIVE ROOMS GRID (Matching Your Playlists visual cards grid) */
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
                    onClick={() => handleOpenRoomPreview(r)}
                    className="group relative p-3 sm:p-4 rounded-2xl bg-neutral-900/80 hover:bg-neutral-800/90 border border-neutral-800 hover:border-amber-500/40 transition-all flex flex-col justify-between aspect-square cursor-pointer shadow-lg hover:shadow-amber-500/10 active:scale-[0.98]"
                  >
                    {/* Top Badges & Actions */}
                    <div className="flex items-center justify-between gap-1.5 w-full">
                      {r.code ? (
                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          {r.code}
                        </span>
                      ) : <span />}

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>{r.memberCount || 1} online</span>
                        </span>

                        {isCreator && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleArchive(rId, true);
                            }}
                            className="p-1 rounded-lg bg-neutral-800/90 hover:bg-amber-500/20 hover:text-amber-400 text-neutral-400 border border-neutral-700/80 transition cursor-pointer active:scale-95"
                            title="Archive Room"
                          >
                            <Archive className="w-3 h-3" />
                          </button>
                        )}
                      </div>
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

                    {/* Bottom Stats & Preview CTA */}
                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Music className="w-3 h-3 text-amber-400/80" />
                        <span>{(r.playlistsCount || 0) === 1 ? '1 playlist' : `${r.playlistsCount || 0} playlists`}</span>
                      </span>
                      <span className="font-semibold text-amber-400 group-hover:underline">
                        Preview Room →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filterTab !== 'left' && filterTab !== 'archived' && filteredRooms.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-xs border border-dashed border-neutral-800 rounded-2xl space-y-3 px-4">
              <Radio className="w-10 h-10 text-neutral-600 mx-auto" />
              <div>
                <p className="font-bold text-neutral-300 text-sm">
                  {filterTab === 'created'
                    ? 'You haven’t created any rooms yet'
                    : filterTab === 'joined'
                    ? 'No joined rooms found'
                    : 'No rooms available'}
                </p>
                <p className="text-neutral-500 text-xs mt-1 max-w-sm mx-auto">
                  {filterTab === 'created'
                    ? 'Create your own listening room to host synced playback with friends.'
                    : filterTab === 'joined'
                    ? 'Enter a room code or browse all public rooms to join a live session.'
                    : 'Create a room or search with an invite code to start listening together.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                {filterTab === 'joined' ? (
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
                  >
                    Browse All Rooms
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition cursor-pointer shadow-md shadow-amber-500/20 active:scale-95 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create a Room</span>
                  </button>
                )}
              </div>
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

      {/* MODAL: Room Preview / Details Modal (Open without auto-joining, with explicit Join / Open Action) */}
      {selectedPreviewRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full max-w-md bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Room Details & Preview</h3>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                    selectedPreviewRoom.isPublic !== false
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  }`}>
                    {selectedPreviewRoom.isPublic !== false ? 'Public Room' : 'Invite-Only Room'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreviewRoom(null)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-lg font-black text-white">{selectedPreviewRoom.name}</h2>
                {selectedPreviewRoom.code && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs font-mono text-neutral-400">
                      Code: <strong className="text-amber-400 font-bold">{selectedPreviewRoom.code}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCodeOnly(selectedPreviewRoom.code)}
                      className="px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px] font-medium border border-neutral-700 flex items-center gap-1 transition cursor-pointer active:scale-95"
                      title="Copy Room Code"
                    >
                      {copiedCodeNotice ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-300 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-amber-400" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyInviteLink(selectedPreviewRoom.code)}
                      className="px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px] font-medium border border-neutral-700 flex items-center gap-1 transition cursor-pointer active:scale-95"
                      title="Copy Direct Invite Link"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-300 font-bold">Copied Link!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3 h-3 text-amber-400" />
                          <span>Copy Invite Link</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
                {selectedPreviewRoom.description && (
                  <p className="text-xs text-neutral-400 mt-2 p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800">
                    {selectedPreviewRoom.description}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Host:</span>
                  <span className="text-white font-bold">{selectedPreviewRoom.createdBy?.displayName || selectedPreviewRoom.createdBy?.username || 'Host'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Active Listeners:</span>
                  <span className="text-emerald-400 font-mono font-semibold">{selectedPreviewRoom.memberCount || 1} online</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Room Playlists:</span>
                  <span className="text-neutral-300 font-mono">
                    {(selectedPreviewRoom.playlistsCount || 0) === 1 ? '1 playlist' : `${selectedPreviewRoom.playlistsCount || 0} playlists`}
                  </span>
                </div>
                {(selectedPreviewRoom.queueCount !== undefined) && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Upcoming Queue:</span>
                    <span className="text-amber-300 font-mono font-medium">
                      {selectedPreviewRoom.queueCount === 1 ? '1 song' : `${selectedPreviewRoom.queueCount} songs`}
                    </span>
                  </div>
                )}
                {selectedPreviewRoom.currentSong?.title && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Now Playing:</span>
                    <span className="text-amber-300 font-medium truncate max-w-[200px]">{selectedPreviewRoom.currentSong.title}</span>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-neutral-300 flex items-start gap-2">
                <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Viewing this preview does not join you to the room. Click <strong>"Join & Sync"</strong> below to enter the collaborative session with live audio sync.
                </span>
              </div>
            </div>

            {/* Footer with Explicit Join button */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedPreviewRoom(null)}
                className="px-3.5 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition cursor-pointer"
              >
                Close Preview
              </button>

              <button
                type="button"
                disabled={isJoiningRoom}
                onClick={() => {
                  const targetCodeOrId = selectedPreviewRoom.code || selectedPreviewRoom.roomId || selectedPreviewRoom.id;
                  handleJoin(targetCodeOrId);
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 active:scale-95 cursor-pointer shadow-amber-500/25"
              >
                {isJoiningRoom ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
                <span>
                  {isJoiningRoom
                    ? 'Entering...'
                    : selectedPreviewRoom.isMember || (rooms.some(r => (r.roomId || r.id) === (selectedPreviewRoom.roomId || selectedPreviewRoom.id) && r.createdBy?.userId === currentUserId))
                      ? 'Enter Room'
                      : 'Join & Sync'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Preview Left Room (Restricted / Preview State) */}
      {previewLeftRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full max-w-md bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Room Preview</h3>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                    Restricted Mode
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewLeftRoom(null)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-lg font-black text-white">{previewLeftRoom.name}</h2>
                {previewLeftRoom.code && (
                  <span className="text-xs font-mono text-neutral-400 mt-0.5 inline-block">
                    Code: <strong className="text-amber-400">{previewLeftRoom.code}</strong>
                  </span>
                )}
                {previewLeftRoom.description && (
                  <p className="text-xs text-neutral-400 mt-2 p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800">
                    {previewLeftRoom.description}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Host:</span>
                  <span className="text-white font-bold">{previewLeftRoom.createdBy?.displayName || previewLeftRoom.createdBy?.username || 'Host'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Active Listeners:</span>
                  <span className="text-emerald-400 font-mono font-semibold">{previewLeftRoom.memberCount || 1} online</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Room Playlists:</span>
                  <span className="text-neutral-300 font-mono">{previewLeftRoom.playlistsCount || 0} playlists</span>
                </div>
                {previewLeftRoom.leftAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Left On:</span>
                    <span className="text-neutral-400 font-mono">{new Date(previewLeftRoom.leftAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 flex items-start gap-2">
                <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  You left this room previously. Live listening and playlist management are locked until the room Host approves your re-join request.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const target = { ...previewLeftRoom, _isLeftRoom: true };
                  setPreviewLeftRoom(null);
                  setRoomToDelete(target);
                }}
                className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                title={previewLeftRoom.createdBy?.userId === currentUserId ? 'Permanently Delete Room' : 'Remove from Left Rooms'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{previewLeftRoom.createdBy?.userId === currentUserId ? 'Delete Room' : 'Remove'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewLeftRoom(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition cursor-pointer"
                >
                  Close
                </button>

                {(() => {
                  const rId = previewLeftRoom.roomId || previewLeftRoom.id;
                  const isPending = pendingRejoinRoomIds.includes(rId) || previewLeftRoom.hasPendingRequest;

                  return (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        handleRequestToJoin(previewLeftRoom);
                      }}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg ${
                        isPending
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-not-allowed'
                          : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 active:scale-95 cursor-pointer shadow-amber-500/25'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>{isPending ? 'Request Pending' : 'Request to Join'}</span>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Playlist Confirmation */}
      {playlistToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl p-5 space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm sm:text-base">Delete Room Playlist</h4>
                <p className="text-[11px] text-neutral-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-xs text-neutral-300">
              Are you sure you want to delete <strong className="text-white">"{playlistToDelete.name}"</strong>? All tracks in this room playlist will be removed for all listeners.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                disabled={isDeletingPlaylist}
                onClick={() => setPlaylistToDelete(null)}
                className="px-3.5 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingPlaylist}
                onClick={handleConfirmDeleteRoomPlaylist}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                {isDeletingPlaylist ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeletingPlaylist ? 'Deleting...' : 'Delete Playlist'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Compact Room Members & Code Popover */}
      {isMemberPopoverOpen && activeRoom && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsMemberPopoverOpen(false)}
        >
          <div 
            className="w-full max-w-sm bg-neutral-900 border border-neutral-700/80 rounded-2xl p-5 shadow-2xl space-y-4 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Room Members ({participants.length})</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMemberPopoverOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Room Code & Invite Share */}
            {activeRoom.code && (
              <div className="p-3 rounded-xl bg-neutral-950/80 border border-amber-500/30 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase font-mono block">Room Code</span>
                  <span className="text-sm font-mono font-black text-amber-300">{activeRoom.code}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopyCodeOnly(activeRoom.code)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-500/40 transition flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Copy room code"
                  >
                    {copiedCodeNotice ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer active:scale-95 flex items-center gap-1"
                    title="Share room link"
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Member List */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
              {participants.map(m => {
                const mRole = m.role || 'listener';
                const isHostRole = mRole === 'host';
                const isCoHostRole = mRole === 'co-host';
                const isUser = m.userId === currentUserId || m.username === currentUsername;

                return (
                  <div 
                    key={m.userId || m.socketId}
                    className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          isHostRole 
                            ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50' 
                            : isCoHostRole 
                            ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50' 
                            : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                        }`}>
                          {m.displayName ? m.displayName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-neutral-950" title="Online Live" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white truncate max-w-[120px]">
                            {m.displayName || m.username || 'Listener'}
                          </span>
                          {isUser && <span className="text-[10px] text-amber-400 font-mono font-semibold">(You)</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] font-mono uppercase font-bold px-1.5 py-0.2 rounded border ${
                            isHostRole 
                              ? 'text-amber-300 bg-amber-500/15 border-amber-500/30' 
                              : isCoHostRole 
                              ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' 
                              : 'text-neutral-400 bg-neutral-800 border-neutral-700'
                          }`}>
                            {isHostRole ? 'Host' : isCoHostRole ? 'Co-Host' : 'Listener'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Online</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer with switch to Members tab */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setIsMemberPopoverOpen(false);
                  setActiveTab('members');
                }}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
              >
                Open Full Members & Roles →
              </button>
              <button
                type="button"
                onClick={() => setIsMemberPopoverOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Permanent Room Deletion */}
      {roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full max-w-sm bg-neutral-900 border border-rose-500/40 rounded-2xl p-5 shadow-2xl space-y-4 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  {roomToDelete._isLeftRoom || filterTab === 'left'
                    ? (roomToDelete.createdBy?.userId === currentUserId ? 'Delete Left Room Permanently?' : 'Remove from Left Rooms?')
                    : 'Delete Room Permanently?'}
                </h3>
                <p className="text-[11px] text-neutral-400">
                  {roomToDelete.createdBy?.userId === currentUserId ? 'This room will be permanently destroyed.' : 'Removes this room from your Left Rooms list.'}
                </p>
              </div>
            </div>
            <p className="text-xs text-neutral-300">
              {roomToDelete._isLeftRoom || filterTab === 'left' ? (
                roomToDelete.createdBy?.userId === currentUserId ? (
                  <>Are you sure you want to permanently delete <strong className="text-white">"{roomToDelete.name}"</strong>? Since you created this room, deleting it will remove all playlists and chat history for everyone.</>
                ) : (
                  <>Are you sure you want to remove <strong className="text-white">"{roomToDelete.name}"</strong> from your Left Rooms list? It will no longer show up here.</>
                )
              ) : (
                <>Are you sure you want to delete <strong className="text-white">"{roomToDelete.name}"</strong>? All playlists, chat history, and active listener connections will be permanently removed.</>
              )}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                disabled={isDeletingRoom}
                onClick={() => setRoomToDelete(null)}
                className="px-3.5 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingRoom}
                onClick={handleConfirmDeleteRoom}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                {isDeletingRoom ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>
                  {isDeletingRoom
                    ? 'Deleting...'
                    : (roomToDelete._isLeftRoom || filterTab === 'left') && roomToDelete.createdBy?.userId !== currentUserId
                      ? 'Remove Room'
                      : 'Delete Permanently'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
