import express from 'express';
import { collaborativeRoomService } from '../services/collaborativeRoomService.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Helper to extract verified user ID from authenticated request
const getAuthenticatedUserId = (req) => {
  return req.user?._id?.toString?.() || req.user?.userId || null;
};

// GET /api/rooms - List active collaborative rooms (strict auth: require login)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    let rooms = [];
    if (req.query.scope === 'my') {
      rooms = await collaborativeRoomService.listUserRooms(userId, 50);
    } else {
      // Return active public rooms combined with user's joined/created active rooms, deduplicated by roomId
      const [publicRooms, userRooms] = await Promise.all([
        collaborativeRoomService.listRooms(50),
        collaborativeRoomService.listUserRooms(userId, 50)
      ]);
      const roomMap = new Map();
      const uidStr = String(userId || '').trim();
      for (const r of [...userRooms, ...publicRooms]) {
        const id = r.roomId || r.id;
        // Strictly exclude archived, deleted, or rooms deleted for this user from active rooms feed
        if (id && !roomMap.has(id)) {
          if (r.status === 'active' && !r.isArchived) {
            if (Array.isArray(r.deletedForUsers) && uidStr && r.deletedForUsers.includes(uidStr)) {
              continue;
            }
            roomMap.set(id, r);
          }
        }
      }
      rooms = Array.from(roomMap.values());
    }
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list rooms: ' + err.message });
  }
});

// GET /api/rooms/my - List rooms created or joined strictly by the authenticated user
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const rooms = await collaborativeRoomService.listUserRooms(userId, 50);
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list user rooms: ' + err.message });
  }
});

// GET /api/rooms/left - List rooms previously left by the current authenticated user
router.get('/left', authenticateToken, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const rooms = await collaborativeRoomService.listLeftRooms(userId, 50);
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list left rooms: ' + err.message });
  }
});

// GET /api/rooms/archived - List archived rooms created or joined by the current authenticated user
router.get('/archived', authenticateToken, async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const rooms = await collaborativeRoomService.listArchivedRooms(userId, 50);
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list archived rooms: ' + err.message });
  }
});

// GET /api/rooms/lookup/:code - Room preview lookup without joining (strictly returns preview info)
router.get('/lookup/:code', authenticateToken, async (req, res) => {
  try {
    const code = (req.params.code || '').trim();
    if (!code) {
      return res.status(400).json({ success: false, error: 'Room code or ID is required' });
    }
    const room = await collaborativeRoomService.getRoom(code, { includeArchived: true });
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found or invalid room code' });
    }
    const userId = getAuthenticatedUserId(req);
    const uidStr = String(userId || '').trim();
    if (Array.isArray(room.deletedForUsers) && uidStr && room.deletedForUsers.includes(uidStr)) {
      return res.status(404).json({ success: false, error: 'Room not found or has been deleted' });
    }
    const isMember = (room.members || []).some(m => String(m.userId) === uidStr);
    const isHost = (String(room.createdBy?.userId || '') === uidStr);

    res.json({
      success: true,
      preview: {
        roomId: room.roomId,
        id: room.roomId,
        code: room.code,
        name: room.name,
        description: room.description || '',
        createdBy: room.createdBy,
        memberCount: (room.members || []).length,
        playlistsCount: (room.playlists || []).length,
        isPublic: room.isPublic !== false,
        status: room.status || 'active',
        isArchived: Boolean(room.isArchived || room.status === 'archived'),
        isMember,
        isHost
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to lookup room: ' + err.message });
  }
});

// POST /api/rooms - Create a collaborative room (strictly requires authenticated user)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const room = await collaborativeRoomService.createRoom({
      name,
      description,
      user: req.user,
      isPublic: isPublic !== false
    });
    res.status(201).json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create room: ' + err.message });
  }
});

// POST /api/rooms/join - Join a room by roomCode, roomId, or MongoDB _id (strictly requires authenticated user)
router.post('/join', authenticateToken, async (req, res) => {
  try {
    const roomCode = (req.body?.roomCode || req.body?.code || req.body?.roomId || req.body?.id || '').toString().trim();
    if (!roomCode) {
      return res.status(400).json({ ok: false, success: false, error: 'Room code or Room ID is required' });
    }

    const room = await collaborativeRoomService.joinRoom(roomCode, req.user);
    if (!room) {
      return res.status(404).json({ ok: false, success: false, error: 'Room not found' });
    }
    res.json({ ok: true, success: true, room });
  } catch (err) {
    res.status(500).json({ ok: false, success: false, error: 'Failed to join room: ' + err.message });
  }
});

// GET /api/rooms/:roomId - Get full room details & playlists (strictly requires authentication)
router.get('/:roomId', authenticateToken, async (req, res) => {
  try {
    const room = await collaborativeRoomService.getRoom(req.params.roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve room: ' + err.message });
  }
});

// POST /api/rooms/:roomId/leave - Leave a room (handles authenticated user or request body user)
router.post('/:roomId/leave', optionalAuth, async (req, res) => {
  try {
    const user = req.user || req.body?.user || {
      userId: req.body?.userId || req.headers['x-guest-id'] || req.headers['x-session-id']
    };
    const result = await collaborativeRoomService.leaveRoom(req.params.roomId, user);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const io = req.app.get('io');
    if (io && result.room) {
      io.to(`room_${result.room.roomId}`).emit('room:members:updated', {
        roomId: result.room.roomId,
        members: result.members,
        createdBy: result.room.createdBy
      });
      io.to(`room_${result.room.roomId}`).emit('room:activities:updated', {
        roomId: result.room.roomId,
        activities: result.room.activities
      });
      io.to(`room_${result.room.roomId}`).emit('room:host:changed', {
        roomId: result.room.roomId,
        createdBy: result.room.createdBy,
        hostUserId: result.room.createdBy?.userId
      });
      io.emit('room:updated', {
        roomId: result.room.roomId,
        status: result.room.status,
        memberCount: result.members.length,
        createdBy: result.room.createdBy
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to leave room: ' + err.message });
  }
});

// POST /api/rooms/:roomId/join - Join a room
router.post('/:roomId/join', optionalAuth, async (req, res) => {
  try {
    const room = await collaborativeRoomService.joinRoom(req.params.roomId, req.user || req.body?.user);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to join room: ' + err.message });
  }
});

// POST /api/rooms/:roomId/playlists - Create or import a playlist inside a room
router.post('/:roomId/playlists', optionalAuth, async (req, res) => {
  try {
    const { name, description, songs } = req.body;
    const { playlist, room } = await collaborativeRoomService.createPlaylist(req.params.roomId, {
      name,
      description,
      user: req.user || req.body?.user,
      songs: Array.isArray(songs) ? songs : []
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`room_${room.roomId}`).emit('room:playlist:updated', {
        roomId: room.roomId,
        playlists: room.playlists,
        type: 'playlist_created',
        playlist
      });
    }

    res.json({ success: true, playlist, playlists: room.playlists });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create playlist in room: ' + err.message });
  }
});

// POST /api/rooms/:roomId/playlists/:playlistId/songs - Add a song to a room playlist
router.post('/:roomId/playlists/:playlistId/songs', optionalAuth, async (req, res) => {
  try {
    const { song } = req.body;
    const result = await collaborativeRoomService.addSongToPlaylist(
      req.params.roomId,
      req.params.playlistId,
      song,
      req.user || req.body?.user
    );

    if (result.alreadyExists) {
      return res.status(409).json({
        success: false,
        alreadyExists: true,
        message: 'Song is already in this room playlist'
      });
    }

    const io = req.app.get('io');
    if (io && result.room) {
      io.to(`room_${result.room.roomId}`).emit('room:playlist:updated', {
        roomId: result.room.roomId,
        playlists: result.room.playlists,
        type: 'song_added',
        playlistId: req.params.playlistId,
        song: result.song
      });
    }

    res.json({
      success: true,
      message: 'Song added to room playlist',
      playlist: result.playlist,
      song: result.song,
      playlists: result.room.playlists
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add song to room playlist: ' + err.message });
  }
});

// DELETE /api/rooms/:roomId/playlists/:playlistId - Delete an entire room playlist
router.delete("/:roomId/playlists/:playlistId", optionalAuth, async (req, res) => {
  try {
    const result = await collaborativeRoomService.deletePlaylist(
      req.params.roomId,
      req.params.playlistId,
      req.user
    );

    const io = req.app.get("io");
    if (io) {
      io.to(`room_${result.room.roomId}`).emit("room:playlist:updated", {
        roomId: result.room.roomId,
        playlists: result.playlists,
        type: "playlist_deleted",
        playlistId: req.params.playlistId
      });
      io.to(`room_${result.room.roomId}`).emit("room:activities:updated", {
        roomId: result.room.roomId,
        activities: result.room.activities
      });
    }

    res.json({ success: true, playlistId: req.params.playlistId, playlists: result.playlists });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to delete room playlist: " + err.message });
  }
});

// DELETE /api/rooms/:roomId/playlists/:playlistId/songs/:songId - Remove song
router.delete('/:roomId/playlists/:playlistId/songs/:songId', optionalAuth, async (req, res) => {
  try {
    const { playlist, room } = await collaborativeRoomService.removeSongFromPlaylist(
      req.params.roomId,
      req.params.playlistId,
      req.params.songId
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`room_${room.roomId}`).emit('room:playlist:updated', {
        roomId: room.roomId,
        playlists: room.playlists,
        type: 'song_removed',
        playlistId: req.params.playlistId,
        songId: req.params.songId
      });
    }

    res.json({ success: true, playlist, playlists: room.playlists });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to remove song: ' + err.message });
  }
});

// PUT /api/rooms/:roomId/playlists/:playlistId/reorder - Reorder songs
router.put('/:roomId/playlists/:playlistId/reorder', optionalAuth, async (req, res) => {
  try {
    const { songs } = req.body;
    const { playlist, room } = await collaborativeRoomService.reorderPlaylistSongs(
      req.params.roomId,
      req.params.playlistId,
      songs
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`room_${room.roomId}`).emit('room:playlist:updated', {
        roomId: room.roomId,
        playlists: room.playlists,
        type: 'reordered',
        playlistId: req.params.playlistId
      });
    }

    res.json({ success: true, playlist, playlists: room.playlists });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to reorder playlist: ' + err.message });
  }
});

// POST /api/rooms/:roomId/playlists/:playlistId/songs/:songId/vote - Toggle song vote
router.post('/:roomId/playlists/:playlistId/songs/:songId/vote', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?._id?.toString?.() || req.user?.userId || req.body?.userId || 'guest';
    const result = await collaborativeRoomService.toggleSongVote(
      req.params.roomId,
      req.params.playlistId,
      req.params.songId,
      userId
    );

    const io = req.app.get('io');
    if (io && result.room) {
      io.to(`room_${result.room.roomId}`).emit('room:playlist:updated', {
        roomId: result.room.roomId,
        playlists: result.room.playlists,
        type: 'song_voted',
        playlistId: req.params.playlistId,
        songId: req.params.songId,
        votes: result.votes
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to vote: ' + err.message });
  }
});

// POST /api/rooms/:roomId/chat - Send chat message
router.post('/:roomId/chat', optionalAuth, async (req, res) => {
  try {
    const { text, clientId, messageId } = req.body;
    const user = req.user || req.body?.user;
    const result = await collaborativeRoomService.addChatMessage(req.params.roomId, { text, user, clientId, messageId });

    const io = req.app.get('io');
    if (io && result.room) {
      io.to(`room_${result.room.roomId}`).emit('room:chat:message', {
        roomId: result.room.roomId,
        message: result.message
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to send chat: ' + err.message });
  }
});

// PUT /api/rooms/:roomId/members/:targetUserId/role - Change member role
router.put('/:roomId/members/:targetUserId/role', optionalAuth, async (req, res) => {
  try {
    const { role } = req.body;
    const user = req.user || req.body?.requesterUser;
    const result = await collaborativeRoomService.updateMemberRole(req.params.roomId, req.params.targetUserId, role, user);

    const io = req.app.get('io');
    if (io && result.room) {
      io.to(`room_${result.room.roomId}`).emit('room:members:updated', {
        roomId: result.room.roomId,
        members: result.members
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update member role: ' + err.message });
  }
});

// DELETE /api/rooms/:roomId/members/:targetUserId - Remove member
router.delete('/:roomId/members/:targetUserId', optionalAuth, async (req, res) => {
  try {
    const user = req.user || req.body?.requesterUser;
    const result = await collaborativeRoomService.removeMember(req.params.roomId, req.params.targetUserId, user);

    const io = req.app.get('io');
    if (io && result.room) {
      io.to(`room_${result.room.roomId}`).emit('room:members:updated', {
        roomId: result.room.roomId,
        members: result.members
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to remove member: ' + err.message });
  }
});

// PUT /api/rooms/:roomId/privacy - Update room privacy
router.put('/:roomId/privacy', optionalAuth, async (req, res) => {
  try {
    const { isPublic } = req.body;
    const user = req.user || req.body?.user;
    const result = await collaborativeRoomService.updateRoomPrivacy(req.params.roomId, isPublic, user);

    const io = req.app.get('io');
    if (io && result.room) {
      io.to(`room_${result.room.roomId}`).emit('room:privacy:updated', {
        roomId: result.room.roomId,
        isPublic: result.isPublic
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update privacy: ' + err.message });
  }
});

// POST /api/rooms/:roomId/invite/regenerate - Regenerate room code
router.post('/:roomId/invite/regenerate', optionalAuth, async (req, res) => {
  try {
    const user = req.user || req.body?.user;
    const result = await collaborativeRoomService.regenerateInviteCode(req.params.roomId, user);

    const io = req.app.get('io');
    if (io && result.room) {
      io.to(`room_${result.room.roomId}`).emit('room:code:updated', {
        roomId: result.room.roomId,
        code: result.code
      });
      io.to(`room_${result.room.roomId}`).emit('room:invite:updated', {
        roomId: result.room.roomId,
        code: result.code
      });
      io.to(`room_${result.room.roomId}`).emit('room:activities:updated', {
        roomId: result.room.roomId,
        activities: result.room.activities
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to regenerate code: ' + err.message });
  }
});

// PATCH /api/rooms/:roomId/archive - Archive or unarchive (restore) room
router.patch('/:roomId/archive', authenticateToken, async (req, res) => {
  try {
    const shouldArchive = req.body?.isArchived !== false && req.body?.action !== 'restore' && req.body?.action !== 'unarchive';
    const result = await collaborativeRoomService.toggleArchiveRoom(req.params.roomId, shouldArchive, req.user);

    const io = req.app.get('io');
    if (io && result.room) {
      io.to(`room_${result.room.roomId}`).emit('room:archived', {
        roomId: result.room.roomId,
        isArchived: result.isArchived,
        status: result.status,
        archivedAt: result.archivedAt,
        archivedBy: result.archivedBy
      });
      io.to(`room_${result.room.roomId}`).emit('room:activities:updated', {
        roomId: result.room.roomId,
        activities: result.room.activities
      });
      // Global broadcast so active room views can refresh lists
      io.emit('room:status:updated', {
        roomId: result.room.roomId,
        isArchived: result.isArchived,
        status: result.status
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to archive/restore room: ' + err.message });
  }
});

// DELETE /api/rooms/:roomId - Permanently delete room (strictly authorized Host only)
router.delete('/:roomId', authenticateToken, async (req, res) => {
  try {
    const result = await collaborativeRoomService.deleteRoomPermanently(req.params.roomId, req.user);

    const io = req.app.get('io');
    if (io) {
      io.to(`room_${req.params.roomId}`).emit('room:deleted', {
        roomId: req.params.roomId,
        deleted: true
      });
      io.emit('room:deleted', {
        roomId: req.params.roomId,
        deleted: true
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete room: ' + err.message });
  }
});

// DELETE /api/rooms/:roomId/left - Direct deletion of left room (deletes room if host, or clears left membership)
router.delete('/:roomId/left', authenticateToken, async (req, res) => {
  try {
    const result = await collaborativeRoomService.deleteLeftRoomForUser(req.params.roomId, req.user);

    const io = req.app.get('io');
    if (io) {
      if (result.deleted) {
        io.to(`room_${req.params.roomId}`).emit('room:deleted', {
          roomId: req.params.roomId,
          deleted: true
        });
        io.emit('room:deleted', {
          roomId: req.params.roomId,
          deleted: true
        });
      } else {
        io.to(`room_${req.params.roomId}`).emit('room:member:removed', {
          roomId: req.params.roomId,
          userId: req.user?._id?.toString?.() || req.user?.userId
        });
      }
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete left room: ' + err.message });
  }
});

// POST /api/rooms/purge - Admin / cleanup endpoint to purge rooms by name pattern (e.g. "Devil")
router.post('/purge', authenticateToken, async (req, res) => {
  try {
    const { namePattern } = req.body;
    if (!namePattern) {
      return res.status(400).json({ success: false, error: 'namePattern is required' });
    }
    const result = await collaborativeRoomService.purgeRoomsByName(namePattern);
    const io = req.app.get('io');
    if (io && result.purgedIds?.length > 0) {
      for (const pId of result.purgedIds) {
        io.to(`room_${pId}`).emit('room:deleted', { roomId: pId, deleted: true });
        io.emit('room:deleted', { roomId: pId, deleted: true });
      }
    }
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to purge rooms: ' + err.message });
  }
});

// POST /api/rooms/:roomId/archive - Legacy support for archive/delete
router.post('/:roomId/archive', authenticateToken, async (req, res) => {
  try {
    const { action } = req.body;
    if (action === 'delete') {
      const result = await collaborativeRoomService.deleteRoomPermanently(req.params.roomId, req.user);
      const io = req.app.get('io');
      if (io) {
        io.to(`room_${req.params.roomId}`).emit('room:deleted', { roomId: req.params.roomId, deleted: true });
        io.emit('room:deleted', { roomId: req.params.roomId, deleted: true });
      }
      return res.json({ success: true, ...result });
    }

    const shouldArchive = action !== 'restore' && action !== 'unarchive';
    const result = await collaborativeRoomService.toggleArchiveRoom(req.params.roomId, shouldArchive, req.user);
    const io = req.app.get('io');
    if (io && result.room) {
      io.to(`room_${result.room.roomId}`).emit('room:archived', {
        roomId: result.room.roomId,
        isArchived: result.isArchived,
        status: result.status
      });
      io.emit('room:status:updated', {
        roomId: result.room.roomId,
        isArchived: result.isArchived,
        status: result.status
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to archive room: ' + err.message });
  }
});

// POST /api/rooms/:roomId/join-request - Request to re-join room
router.post('/:roomId/join-request', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const mergedUser = {
      userId: user._id.toString(),
      name: user.displayName || user.username || 'Listener',
      email: user.email || ''
    };

    const result = await collaborativeRoomService.requestToJoin(req.params.roomId, mergedUser);
    const io = req.app.get('io');
    if (io && result.room) {
      // Broadcast to room workspace (for the host) and host's specific notifications
      io.to(`room_${result.room.roomId}`).emit('room:join:request', {
        roomId: result.room.roomId,
        request: result.request,
        joinRequests: result.room.joinRequests
      });
      io.to(`room_${result.room.roomId}`).emit('room:activities:updated', {
        roomId: result.room.roomId,
        activities: result.room.activities
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to submit join request: ' + err.message });
  }
});

// POST /api/rooms/:roomId/join-requests/approve - Host approves a re-join request
router.post('/:roomId/join-requests/approve', authenticateToken, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'targetUserId is required' });
    }
    const requester = req.user;
    const result = await collaborativeRoomService.approveJoinRequest(req.params.roomId, targetUserId, requester);

    const io = req.app.get('io');
    if (io && result.room) {
      io.to(`room_${result.room.roomId}`).emit('room:join:approved', {
        roomId: result.room.roomId,
        userId: result.approvedUserId,
        member: result.member,
        members: result.members,
        joinRequests: result.joinRequests
      });
      io.to(`room_${result.room.roomId}`).emit('room:members:updated', {
        roomId: result.room.roomId,
        members: result.members
      });
      io.to(`room_${result.room.roomId}`).emit('room:activities:updated', {
        roomId: result.room.roomId,
        activities: result.room.activities
      });
      // Global broadcast so user's client outside the room socket room receives it
      io.emit('room:join:approved', {
        roomId: result.room.roomId,
        userId: result.approvedUserId,
        room: result.room
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to approve join request: ' + err.message });
  }
});

// POST /api/rooms/:roomId/join-requests/reject - Host rejects a re-join request
router.post('/:roomId/join-requests/reject', authenticateToken, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'targetUserId is required' });
    }
    const requester = req.user;
    const result = await collaborativeRoomService.rejectJoinRequest(req.params.roomId, targetUserId, requester);

    const io = req.app.get('io');
    if (io && result.room) {
      io.to(`room_${result.room.roomId}`).emit('room:join:rejected', {
        roomId: result.room.roomId,
        userId: result.rejectedUserId,
        joinRequests: result.joinRequests
      });
      io.emit('room:join:rejected', {
        roomId: result.room.roomId,
        userId: result.rejectedUserId
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to reject join request: ' + err.message });
  }
});

// GET /api/rooms/:roomId/playback-state - Fetch current live room playback state (with elapsed timestamp)
router.get('/:roomId/playback-state', optionalAuth, async (req, res) => {
  try {
    const state = await collaborativeRoomService.getCurrentPlaybackState(req.params.roomId);
    if (!state) {
      return res.status(404).json({ success: false, error: 'Room not found or no playback state' });
    }
    res.json({ success: true, playbackState: state });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get playback state: ' + err.message });
  }
});

// GET /api/rooms/:roomId/playback-state - Fetch current live room playback state (with elapsed timestamp)
router.get('/:roomId/playback-state', optionalAuth, async (req, res) => {
  try {
    const state = await collaborativeRoomService.getCurrentPlaybackState(req.params.roomId);
    if (!state) {
      return res.status(404).json({ success: false, error: 'Room not found or no playback state' });
    }
    res.json({ success: true, playbackState: state });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get playback state: ' + err.message });
  }
});

export default router;
