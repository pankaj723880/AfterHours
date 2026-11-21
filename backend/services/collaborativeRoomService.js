import CollaborativeRoom from '../models/CollaborativeRoom.js';

class CollaborativeRoomService {
  constructor() {
    // In-memory cache for ultra-fast sync & fallback if MongoDB is briefly unavailable
    this.roomsCache = new Map();
    this.io = null;
  }

  setIO(ioInstance) {
    this.io = ioInstance;
  }

  generateCode(len = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < len; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async getRoom(roomIdOrCode) {
    if (!roomIdOrCode) return null;
    const key = String(roomIdOrCode).trim();
    
    // Check in-memory first
    if (this.roomsCache.has(key)) {
      return this.roomsCache.get(key);
    }
    for (const room of this.roomsCache.values()) {
      if (room.code === key.toUpperCase() || room.roomId === key) {
        return room;
      }
    }

    // Check DB
    try {
      const room = await CollaborativeRoom.findOne({
        $or: [{ roomId: key }, { code: key.toUpperCase() }]
      }).lean();
      if (room) {
        this.roomsCache.set(room.roomId, room);
        return room;
      }
    } catch (e) {
      console.warn('[CollaborativeRoomService] getRoom DB fallback warning:', e.message);
    }
    return null;
  }

  async listRooms(limit = 30) {
    const list = [];
    try {
      const dbRooms = await CollaborativeRoom.find({ isPublic: true })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();
      
      for (const r of dbRooms) {
        this.roomsCache.set(r.roomId, r);
        list.push(this.formatRoomSummary(r));
      }
    } catch (e) {
      console.warn('[CollaborativeRoomService] listRooms DB error, using cache:', e.message);
      for (const r of this.roomsCache.values()) {
        if (r.isPublic !== false) {
          list.push(this.formatRoomSummary(r));
        }
      }
    }
    return list;
  }

  formatRoomSummary(r) {
    return {
      id: r.roomId,
      roomId: r.roomId,
      code: r.code,
      name: r.name,
      description: r.description || '',
      createdBy: r.createdBy,
      memberCount: r.members ? r.members.length : 1,
      playlistsCount: r.playlists ? r.playlists.length : 0,
      currentSong: r.currentSong,
      isPlaying: Boolean(r.isPlaying),
      updatedAt: r.updatedAt || r.lastActiveAt
    };
  }

  async createRoom({ name, description = '', user = null, isPublic = true }) {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const code = this.generateCode(6);
    const creatorInfo = {
      userId: user?._id?.toString?.() || user?.userId || `guest_${Date.now()}`,
      username: user?.username || 'Host',
      displayName: user?.displayName || user?.username || 'Host'
    };

    const initialPlaylist = {
      id: `rpl_${Date.now()}_1`,
      name: 'Main Room Playlist',
      description: 'Collaborative playlist for this room',
      createdBy: creatorInfo,
      createdAt: new Date(),
      updatedAt: new Date(),
      songs: []
    };

    const roomData = {
      roomId,
      code,
      name: name?.trim() || `${creatorInfo.displayName}'s Room`,
      description: description?.trim() || '',
      createdBy: creatorInfo,
      members: [{
        userId: creatorInfo.userId,
        username: creatorInfo.username,
        displayName: creatorInfo.displayName,
        avatar: user?.avatarUrl || '',
        role: 'owner',
        joinedAt: new Date(),
        lastActiveAt: new Date()
      }],
      playlists: [initialPlaylist],
      currentSong: null,
      isPlaying: false,
      seekTime: 0,
      isPublic: Boolean(isPublic),
      lastActiveAt: new Date()
    };

    // Cache locally immediately
    this.roomsCache.set(roomId, roomData);

    try {
      const doc = new CollaborativeRoom(roomData);
      await doc.save();
    } catch (e) {
      console.warn('[CollaborativeRoomService] createRoom DB save warning:', e.message);
    }

    return roomData;
  }

  async joinRoom(roomIdOrCode, user) {
    let room = await this.getRoom(roomIdOrCode);
    if (!room) return null;

    const uId = user?._id?.toString?.() || user?.userId || `guest_${Date.now()}`;
    const uName = user?.username || 'Listener';
    const dName = user?.displayName || uName;

    if (!Array.isArray(room.members)) {
      room.members = [];
    }

    const existingMember = room.members.find(m => m.userId === uId || (m.username === uName && uName !== 'Listener'));
    if (!existingMember) {
      room.members.push({
        userId: uId,
        username: uName,
        displayName: dName,
        avatar: user?.avatarUrl || '',
        role: 'member',
        joinedAt: new Date(),
        lastActiveAt: new Date()
      });
    } else {
      existingMember.lastActiveAt = new Date();
      existingMember.displayName = dName;
    }

    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { 
          $set: { members: room.members, lastActiveAt: new Date() }
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] joinRoom DB update warning:', e.message);
    }

    return room;
  }

  async createPlaylist(roomId, { name, description = '', user = null }) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');

    const cleanName = (name || '').trim();
    if (!cleanName) throw new Error('Playlist name cannot be empty');

    const newPlaylist = {
      id: `rpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      description: (description || '').trim(),
      createdBy: {
        userId: user?._id?.toString?.() || user?.userId || 'guest',
        username: user?.username || user?.displayName || 'Listener'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      songs: []
    };

    if (!Array.isArray(room.playlists)) {
      room.playlists = [];
    }
    room.playlists.push(newPlaylist);
    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { 
          $set: { playlists: room.playlists, lastActiveAt: new Date() }
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] createPlaylist DB save warning:', e.message);
    }

    return { playlist: newPlaylist, room };
  }

  async addSongToPlaylist(roomId, playlistId, song, user = null) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');

    if (!Array.isArray(room.playlists)) {
      room.playlists = [];
    }

    const playlist = room.playlists.find(p => p.id === playlistId);
    if (!playlist) throw new Error('Playlist not found in this room');

    const songId = String(song.id || song.videoId || '').trim();
    if (!songId) throw new Error('Song must have a valid ID or videoId');

    if (!Array.isArray(playlist.songs)) {
      playlist.songs = [];
    }

    // Duplicate check
    const exists = playlist.songs.some(s => String(s.id || s.videoId) === songId);
    if (exists) {
      return { alreadyExists: true, playlist, song: null };
    }

    const formattedSong = {
      id: songId,
      videoId: song.videoId || songId,
      title: String(song.title || 'Untitled Song').slice(0, 150),
      channel: String(song.channel || song.artist || 'Unknown Artist').slice(0, 100),
      artist: String(song.artist || song.channel || 'Unknown Artist').slice(0, 100),
      thumbnail: song.thumbnail || song.coverArt || '',
      duration: song.duration || '',
      addedBy: {
        userId: user?._id?.toString?.() || user?.userId || 'guest',
        username: user?.username || 'Listener',
        displayName: user?.displayName || user?.username || 'Listener'
      },
      addedAt: new Date()
    };

    playlist.songs.push(formattedSong);
    playlist.updatedAt = new Date();
    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { 
          $set: { playlists: room.playlists, lastActiveAt: new Date() }
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] addSongToPlaylist DB update warning:', e.message);
    }

    return { alreadyExists: false, playlist, song: formattedSong, room };
  }

  async removeSongFromPlaylist(roomId, playlistId, songId) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');

    const playlist = (room.playlists || []).find(p => p.id === playlistId);
    if (!playlist) throw new Error('Playlist not found');

    const originalLength = playlist.songs.length;
    playlist.songs = (playlist.songs || []).filter(s => String(s.id || s.videoId) !== String(songId));
    
    if (playlist.songs.length !== originalLength) {
      playlist.updatedAt = new Date();
      room.lastActiveAt = new Date();
      this.roomsCache.set(room.roomId, room);

      try {
        await CollaborativeRoom.updateOne(
          { roomId: room.roomId },
          { $set: { playlists: room.playlists, lastActiveAt: new Date() } }
        );
      } catch (e) {
        console.warn('[CollaborativeRoomService] removeSong DB error:', e.message);
      }
    }

    return { playlist, room };
  }

  async reorderPlaylistSongs(roomId, playlistId, songs) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');

    const playlist = (room.playlists || []).find(p => p.id === playlistId);
    if (!playlist) throw new Error('Playlist not found');

    if (Array.isArray(songs)) {
      playlist.songs = songs;
      playlist.updatedAt = new Date();
      room.lastActiveAt = new Date();
      this.roomsCache.set(room.roomId, room);

      try {
        await CollaborativeRoom.updateOne(
          { roomId: room.roomId },
          { $set: { playlists: room.playlists, lastActiveAt: new Date() } }
        );
      } catch (e) {
        console.warn('[CollaborativeRoomService] reorderSongs DB error:', e.message);
      }
    }

    return { playlist, room };
  }
}

export const collaborativeRoomService = new CollaborativeRoomService();
