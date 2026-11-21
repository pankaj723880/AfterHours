import express from 'express';
import { collaborativeRoomService } from '../services/collaborativeRoomService.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/rooms - List active and persistent collaborative rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await collaborativeRoomService.listRooms(40);
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list rooms: ' + err.message });
  }
});

// POST /api/rooms - Create a collaborative room
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const room = await collaborativeRoomService.createRoom({
      name,
      description,
      user: req.user,
      isPublic: isPublic !== false
    });
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create room: ' + err.message });
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

// POST /api/rooms/:roomId/playlists - Create a playlist inside a room
router.post('/:roomId/playlists', optionalAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const { playlist, room } = await collaborativeRoomService.createPlaylist(req.params.roomId, {
      name,
      description,
      user: req.user || req.body?.user
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

export default router;
