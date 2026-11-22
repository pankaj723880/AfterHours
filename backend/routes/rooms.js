import express from 'express';
import { collaborativeRoomService } from '../services/collaborativeRoomService.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/rooms - List active and persistent collaborative rooms
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?._id?.toString?.() || req.user?.userId || req.query.userId || req.query.guestId;
    let rooms = [];
    if (req.query.scope === 'my' && userId) {
      rooms = await collaborativeRoomService.listUserRooms(userId, 50);
    } else {
      rooms = await collaborativeRoomService.listRooms(50);
    }
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list rooms: ' + err.message });
  }
});

// GET /api/rooms/my - List rooms created or joined by the current user or guest
router.get('/my', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?._id?.toString?.() || req.user?.userId || req.query.userId || req.query.guestId || req.headers['x-guest-id'] || req.headers['x-session-id'];
    if (!userId) {
      return res.json({ success: true, rooms: [] });
    }
    const rooms = await collaborativeRoomService.listUserRooms(userId, 50);
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list user rooms: ' + err.message });
  }
});

// POST /api/rooms - Create a collaborative room
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const room = await collaborativeRoomService.createRoom({
      name,
      description,
      user: req.user || req.body?.user,
      isPublic: isPublic !== false
    });
    res.status(201).json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create room: ' + err.message });
  }
});

// POST /api/rooms/join - Join a room by roomCode or roomId
router.post('/join', optionalAuth, async (req, res) => {
  try {
    const roomCode = (req.body?.roomCode || req.body?.code || req.body?.roomId || '').toString().trim();
    if (!roomCode) {
      return res.status(400).json({ ok: false, success: false, error: 'Room code or Room ID is required' });
    }

    const room = await collaborativeRoomService.joinRoom(roomCode, req.user || req.body?.user);
    if (!room) {
      return res.status(404).json({ ok: false, success: false, error: 'Room not found' });
    }
    res.json({ ok: true, success: true, room });
  } catch (err) {
    res.status(500).json({ ok: false, success: false, error: 'Failed to join room: ' + err.message });
  }
});

// GET /api/rooms/:roomId - Get full room details & playlists
router.get('/:roomId', async (req, res) => {
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
    const { text } = req.body;
    const user = req.user || req.body?.user;
    const result = await collaborativeRoomService.addChatMessage(req.params.roomId, { text, user });

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

// POST /api/rooms/:roomId/archive - Archive or delete room
router.post('/:roomId/archive', optionalAuth, async (req, res) => {
  try {
    const { action } = req.body;
    const user = req.user || req.body?.user;
    const result = await collaborativeRoomService.archiveOrDeleteRoom(req.params.roomId, action, user);

    const io = req.app.get('io');
    if (io) {
      io.to(`room_${req.params.roomId}`).emit('room:archived', {
        roomId: req.params.roomId,
        status: result.status
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to archive room: ' + err.message });
  }
});

export default router;
