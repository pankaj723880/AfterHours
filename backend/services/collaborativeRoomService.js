import mongoose from 'mongoose';
import CollaborativeRoom from '../models/CollaborativeRoom.js';

class CollaborativeRoomService {
  constructor() {
    // In-memory cache for ultra-fast sync & fallback if MongoDB is briefly unavailable
    this.roomsCache = new Map();
    this.deletedRoomIds = new Set();
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

  normalizeRole(role) {
    if (role === 'owner' || role === 'host') return 'host';
    if (role === 'admin' || role === 'co-host') return 'co-host';
    return 'listener';
  }

  async getRoom(roomIdOrCode, { includeArchived = true } = {}) {
    if (!roomIdOrCode) return null;
    const key = String(roomIdOrCode).trim();
    if (!key) return null;
    
    // Check in-memory first
    if (this.deletedRoomIds.has(key)) return null;
    if (this.roomsCache.has(key)) {
      const cached = this.roomsCache.get(key);
      if (cached && cached.status !== 'deleted' && (includeArchived || cached.status !== 'archived')) {
        return cached;
      }
    }
    for (const room of this.roomsCache.values()) {
      const matches = (
        room.code === key.toUpperCase() ||
        room.roomId === key ||
        (room._id && String(room._id) === key)
      );
      if (matches && room.status !== 'deleted' && !this.deletedRoomIds.has(room.roomId) && (includeArchived || room.status !== 'archived')) {
        return room;
      }
    }

    // Check DB: match by roomId, uppercase code, or MongoDB _id
    try {
      const orConditions = [
        { roomId: key },
        { code: key.toUpperCase() }
      ];
      if (mongoose.Types.ObjectId.isValid(key)) {
        orConditions.push({ _id: key });
      }

      const statusQuery = includeArchived
        ? { status: { $ne: 'deleted' } }
        : { status: 'active' };

      const room = await CollaborativeRoom.findOne({
        $or: orConditions,
        ...statusQuery
      }).lean();
      if (room) {
        this.normalizeRoomState(room);
        this.roomsCache.set(room.roomId, room);
        return room;
      }
    } catch (e) {
      console.warn('[CollaborativeRoomService] getRoom DB fallback warning:', e.message);
    }
    return null;
  }

  normalizeRoomState(r) {
    if (!r) return;
    if (!Array.isArray(r.members)) r.members = [];
    
    // Strict Deduplication: One User = At Most One Member Record by userId
    const seenUserIds = new Set();
    const dedupedMembers = [];
    for (const m of r.members) {
      if (!m) continue;
      const uid = String(m.userId || '').trim();
      if (!uid) continue;
      if (!seenUserIds.has(uid)) {
        seenUserIds.add(uid);
        m.role = this.normalizeRole(m.role);
        dedupedMembers.push(m);
      } else {
        // Merge latest active timestamp or details if seen
        const existing = dedupedMembers.find(dm => String(dm.userId) === uid);
        if (existing && m.lastActiveAt && (!existing.lastActiveAt || new Date(m.lastActiveAt) > new Date(existing.lastActiveAt))) {
          existing.lastActiveAt = m.lastActiveAt;
        }
      }
    }
    r.members = dedupedMembers;

    if (!Array.isArray(r.leftMembers)) r.leftMembers = [];
    if (!Array.isArray(r.joinRequests)) r.joinRequests = [];
    if (!Array.isArray(r.playlists)) r.playlists = [];
    r.playlists.forEach(pl => {
      if (!Array.isArray(pl.songs)) pl.songs = [];
      pl.songs.forEach(s => {
        if (!Array.isArray(s.votes)) s.votes = [];
      });
    });
    if (!Array.isArray(r.activities)) r.activities = [];
    if (!Array.isArray(r.chatMessages)) r.chatMessages = [];
    if (!Array.isArray(r.queue)) r.queue = [];
    if (!r.permissionMode) r.permissionMode = 'open_queue';
    if (!r.playbackState) {
      r.playbackState = {
        trackId: r.currentSong?.id || r.currentSong?.videoId || '',
        isPlaying: Boolean(r.isPlaying),
        positionMs: Math.round((r.seekTime || 0) * 1000),
        anchorServerTimeMs: Date.now(),
        playbackRate: 1.0
      };
    }
    if (!r.status) r.status = 'active';
  }

  async listRooms(limit = 40) {
    const list = [];
    try {
      const dbRooms = await CollaborativeRoom.find({
        isPublic: true,
        status: 'active'
      })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();
      
      for (const r of dbRooms) {
        this.normalizeRoomState(r);
        this.roomsCache.set(r.roomId, r);
        list.push(this.formatRoomSummary(r));
      }
    } catch (e) {
      console.warn('[CollaborativeRoomService] listRooms DB error, using cache:', e.message);
      for (const r of this.roomsCache.values()) {
        if (r.isPublic !== false && r.status === 'active' && !this.deletedRoomIds.has(r.roomId)) {
          list.push(this.formatRoomSummary(r));
        }
      }
    }
    return list;
  }

  async listUserRooms(userIdOrGuestId, limit = 50) {
    if (!userIdOrGuestId) return [];
    const uid = String(userIdOrGuestId).trim();
    const list = [];
    try {
      // A user should only see active rooms where they are currently in the members list
      // and haven't deleted/hidden it.
      const dbRooms = await CollaborativeRoom.find({
        status: { $nin: ['deleted', 'archived'] },
        deletedForUsers: { $ne: uid },
        'members.userId': uid
      })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();

      for (const r of dbRooms) {
        this.normalizeRoomState(r);
        this.roomsCache.set(r.roomId, r);
        list.push(this.formatRoomSummary(r));
      }
    } catch (e) {
      console.warn('[CollaborativeRoomService] listUserRooms DB error, using cache:', e.message);
      for (const r of this.roomsCache.values()) {
        if (r.status !== 'deleted' && r.status !== 'archived') {
          const isDeletedForUser = Array.isArray(r.deletedForUsers) && r.deletedForUsers.includes(uid);
          const isMember = (r.members || []).some(m => String(m.userId) === uid);
          if (isMember && !isDeletedForUser) {
            list.push(this.formatRoomSummary(r));
          }
        }
      }
    }
    return list;
  }

  async listLeftRooms(userIdOrGuestId, limit = 50) {
    if (!userIdOrGuestId) return [];
    const uid = String(userIdOrGuestId).trim();
    const list = [];
    try {
      const dbRooms = await CollaborativeRoom.find({
        status: { $nin: ['deleted', 'archived'] },
        deletedForUsers: { $ne: uid },
        'leftMembers.userId': uid,
        'members.userId': { $ne: uid }
      })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();

      for (const r of dbRooms) {
        this.normalizeRoomState(r);
        this.roomsCache.set(r.roomId, r);
        const summary = this.formatRoomSummary(r);
        summary.leftAt = (r.leftMembers || []).find(lm => String(lm.userId) === uid)?.leftAt || r.updatedAt;
        summary.hasPendingRequest = (r.joinRequests || []).some(jr => String(jr.userId) === uid);
        list.push(summary);
      }
    } catch (e) {
      console.warn('[CollaborativeRoomService] listLeftRooms DB error, using cache:', e.message);
      for (const r of this.roomsCache.values()) {
        if (r.status !== 'deleted' && r.status !== 'archived') {
          const isDeletedForUser = Array.isArray(r.deletedForUsers) && r.deletedForUsers.includes(uid);
          const isLeft = (r.leftMembers || []).some(lm => String(lm.userId) === uid);
          const isCurrentMember = (r.members || []).some(m => String(m.userId) === uid);
          if (isLeft && !isCurrentMember && !isDeletedForUser) {
            const summary = this.formatRoomSummary(r);
            summary.leftAt = (r.leftMembers || []).find(lm => String(lm.userId) === uid)?.leftAt || r.updatedAt;
            summary.hasPendingRequest = (r.joinRequests || []).some(jr => String(jr.userId) === uid);
            list.push(summary);
          }
        }
      }
    }
    return list;
  }

  async listArchivedRooms(userIdOrGuestId, limit = 50) {
    if (!userIdOrGuestId) return [];
    const uid = String(userIdOrGuestId).trim();
    const list = [];
    try {
      const dbRooms = await CollaborativeRoom.find({
        status: 'archived',
        deletedForUsers: { $ne: uid },
        $or: [
          { 'createdBy.userId': uid },
          { 'members.userId': uid }
        ]
      })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();

      for (const r of dbRooms) {
        this.normalizeRoomState(r);
        this.roomsCache.set(r.roomId, r);
        list.push(this.formatRoomSummary(r));
      }
    } catch (e) {
      console.warn('[CollaborativeRoomService] listArchivedRooms DB error, using cache:', e.message);
      for (const r of this.roomsCache.values()) {
        if (r.status === 'archived') {
          const isDeletedForUser = Array.isArray(r.deletedForUsers) && r.deletedForUsers.includes(uid);
          const isCreator = r.createdBy?.userId === uid;
          const isMember = (r.members || []).some(m => String(m.userId) === uid);
          if ((isCreator || isMember) && !isDeletedForUser) {
            list.push(this.formatRoomSummary(r));
          }
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
      queueCount: Array.isArray(r.queue) ? r.queue.length : 0,
      permissionMode: r.permissionMode || 'open_queue',
      playbackState: r.playbackState || null,
      currentSong: r.currentSong,
      isPlaying: Boolean(r.isPlaying),
      isPublic: r.isPublic !== false,
      status: r.status || 'active',
      isArchived: Boolean(r.isArchived || r.status === 'archived'),
      archivedAt: r.archivedAt || null,
      archivedBy: r.archivedBy || null,
      updatedAt: r.updatedAt || r.lastActiveAt
    };
  }

  async createRoom({ name, description = '', user = null, isPublic = true }) {
    const uid = user?._id?.toString?.() || user?.userId;
    if (!uid) {
      throw new Error('Authentication required: You must be logged in to create a room');
    }
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const code = this.generateCode(6);
    const creatorInfo = {
      userId: uid,
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
        email: user?.email || '',
        avatar: user?.avatarUrl || '',
        role: 'host',
        joinedAt: new Date(),
        lastActiveAt: new Date()
      }],
      playlists: [initialPlaylist],
      currentSong: null,
      isPlaying: false,
      seekTime: 0,
      playbackUpdatedAt: new Date(),
      isPublic: Boolean(isPublic),
      status: 'active',
      activities: [{
        id: `act_${Date.now()}_1`,
        type: 'member_joined',
        text: `${creatorInfo.displayName} created the room`,
        user: creatorInfo,
        timestamp: new Date()
      }],
      chatMessages: [],
      lastActiveAt: new Date()
    };

    this.normalizeRoomState(roomData);
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
    let room = await this.getRoom(roomIdOrCode, { includeArchived: true });
    if (!room) return null;

    this.normalizeRoomState(room);

    const uId = user?._id?.toString?.() || user?.userId;
    if (!uId) {
      throw new Error('Authentication required: You must be logged in to join a room');
    }
    const uName = user?.username || 'Listener';
    const dName = user?.displayName || uName;

    // Strict deduplication by userId - prevent duplicate records & counts
    const cleanUid = String(uId).trim();
    const existingMember = room.members.find(m => String(m.userId).trim() === cleanUid);
    const isCreator = String(room.createdBy?.userId || '').trim() === cleanUid;

    // If the room was archived and the host joins/re-opens it, reactivate the room
    if (room.status === 'archived' && isCreator) {
      room.status = 'active';
      room.isArchived = false;
      room.archivedAt = null;
      room.archivedBy = null;
    }

    let isNewJoin = false;
    if (!existingMember) {
      room.members.push({
        userId: cleanUid,
        username: uName,
        displayName: dName,
        email: user?.email || '',
        avatar: user?.avatarUrl || '',
        role: isCreator ? 'host' : 'listener',
        joinedAt: new Date(),
        lastActiveAt: new Date()
      });
      isNewJoin = true;
    } else {
      existingMember.lastActiveAt = new Date();
      existingMember.displayName = dName;
      if (user?.email) existingMember.email = user.email;
      if (user?.avatarUrl) existingMember.avatar = user.avatarUrl;
    }

    // Also remove from leftMembers if present
    if (Array.isArray(room.leftMembers)) {
      room.leftMembers = room.leftMembers.filter(lm => String(lm.userId).trim() !== cleanUid);
    }
    // Clean joinRequests for this user
    if (Array.isArray(room.joinRequests)) {
      room.joinRequests = room.joinRequests.filter(jr => String(jr.userId).trim() !== cleanUid);
    }

    this.normalizeRoomState(room);

    if (isNewJoin) {
      room.activities.unshift({
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'member_joined',
        text: `${dName} joined the room`,
        user: { userId: uId, username: uName, displayName: dName },
        timestamp: new Date()
      });
      if (room.activities.length > 50) room.activities.pop();
    }

    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { 
          $set: { 
            status: room.status,
            isArchived: Boolean(room.isArchived),
            archivedAt: room.archivedAt,
            archivedBy: room.archivedBy,
            members: room.members, 
            leftMembers: room.leftMembers,
            joinRequests: room.joinRequests,
            activities: room.activities,
            lastActiveAt: new Date() 
          }
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] joinRoom DB update warning:', e.message);
    }

    return room;
  }

  async createPlaylist(roomId, { name, description = '', user = null, songs = [] }) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const cleanName = (name || '').trim();
    if (!cleanName) throw new Error('Playlist name cannot be empty');

    const userInfo = {
      userId: user?._id?.toString?.() || user?.userId || 'guest',
      username: user?.username || 'Listener',
      displayName: user?.displayName || user?.username || 'Listener'
    };

    const formattedSongs = Array.isArray(songs) ? songs.map((s, idx) => ({
      id: String(s.id || s.videoId || `song_${Date.now()}_${idx}`),
      videoId: s.videoId || s.id || '',
      title: String(s.title || 'Untitled Song').slice(0, 150),
      channel: String(s.channel || s.artist || 'Unknown Artist').slice(0, 100),
      artist: String(s.artist || s.channel || 'Unknown Artist').slice(0, 100),
      thumbnail: s.thumbnail || s.coverArt || '',
      duration: s.duration || '',
      addedBy: userInfo,
      votes: [],
      addedAt: new Date()
    })) : [];

    const newPlaylist = {
      id: `rpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      description: (description || '').trim(),
      createdBy: userInfo,
      createdAt: new Date(),
      updatedAt: new Date(),
      songs: formattedSongs
    };

    room.playlists.push(newPlaylist);
    room.activities.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'playlist_created',
      text: `${userInfo.displayName} created playlist "${cleanName}"`,
      user: userInfo,
      timestamp: new Date()
    });
    if (room.activities.length > 50) room.activities.pop();

    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { 
          $set: { 
            playlists: room.playlists, 
            activities: room.activities,
            lastActiveAt: new Date() 
          }
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
    this.normalizeRoomState(room);

    const playlist = room.playlists.find(p => p.id === playlistId);
    if (!playlist) throw new Error('Playlist not found in this room');

    const songId = String(song.id || song.videoId || '').trim();
    if (!songId) throw new Error('Song must have a valid ID or videoId');

    const exists = playlist.songs.some(s => String(s.id || s.videoId) === songId);
    if (exists) {
      return { alreadyExists: true, playlist, song: null, room };
    }

    const userInfo = {
      userId: user?._id?.toString?.() || user?.userId || 'guest',
      username: user?.username || 'Listener',
      displayName: user?.displayName || user?.username || 'Listener'
    };

    const formattedSong = {
      id: songId,
      videoId: song.videoId || songId,
      title: String(song.title || 'Untitled Song').slice(0, 150),
      channel: String(song.channel || song.artist || 'Unknown Artist').slice(0, 100),
      artist: String(song.artist || song.channel || 'Unknown Artist').slice(0, 100),
      thumbnail: song.thumbnail || song.coverArt || '',
      duration: song.duration || '',
      addedBy: userInfo,
      votes: [],
      addedAt: new Date()
    };

    playlist.songs.push(formattedSong);
    playlist.updatedAt = new Date();

    room.activities.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'song_added',
      text: `${userInfo.displayName} added "${formattedSong.title}" to ${playlist.name}`,
      user: userInfo,
      timestamp: new Date()
    });
    if (room.activities.length > 50) room.activities.pop();

    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { 
          $set: { 
            playlists: room.playlists, 
            activities: room.activities,
            lastActiveAt: new Date() 
          }
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] addSongToPlaylist DB update warning:', e.message);
    }

    return { alreadyExists: false, playlist, song: formattedSong, room };
  }

  async removeSongFromPlaylist(roomId, playlistId, songId, user = null) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const playlist = room.playlists.find(p => p.id === playlistId);
    if (!playlist) throw new Error('Playlist not found');

    const song = playlist.songs.find(s => String(s.id || s.videoId) === String(songId));
    const originalLength = playlist.songs.length;
    playlist.songs = playlist.songs.filter(s => String(s.id || s.videoId) !== String(songId));
    
    if (playlist.songs.length !== originalLength) {
      playlist.updatedAt = new Date();
      const uName = user?.displayName || user?.username || 'A member';
      room.activities.unshift({
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'song_removed',
        text: `${uName} removed "${song?.title || 'track'}" from ${playlist.name}`,
        user: { displayName: uName },
        timestamp: new Date()
      });
      if (room.activities.length > 50) room.activities.pop();

      room.lastActiveAt = new Date();
      this.roomsCache.set(room.roomId, room);

      try {
        await CollaborativeRoom.updateOne(
          { roomId: room.roomId },
          { 
            $set: { 
              playlists: room.playlists, 
              activities: room.activities,
              lastActiveAt: new Date() 
            } 
          }
        );
      } catch (e) {
        console.warn('[CollaborativeRoomService] removeSong DB error:', e.message);
      }
    }

    return { playlist, room };
  }

  async deletePlaylist(roomId, playlistId, user = null) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const playlist = room.playlists.find(p => p.id === playlistId);
    if (!playlist) throw new Error('Playlist not found');

    const requesterId = user?._id?.toString?.() || user?.userId;
    const isCreator = Boolean(
      (room.createdBy?.userId && requesterId && room.createdBy.userId === requesterId) ||
      (room.createdBy?.username && user?.username && room.createdBy.username === user.username)
    );
    const requester = room.members.find(m => m.userId === requesterId || m.username === user?.username);
    const role = this.normalizeRole(requester?.role);
    const isHostOrCoHost = isCreator || role === 'host' || role === 'co-host';
    const isPlaylistOwner = Boolean(
      playlist.createdBy?.userId && requesterId && String(playlist.createdBy.userId) === String(requesterId)
    );

    if (!isHostOrCoHost && !isPlaylistOwner) {
      throw new Error('Only the room Host, Co-Host, or the playlist creator can delete this playlist');
    }

    const removedPlaylistName = playlist.name || 'Untitled playlist';
    room.playlists = room.playlists.filter(p => p.id !== playlistId);
    room.lastActiveAt = new Date();

    const uName = user?.displayName || user?.username || 'A member';
    room.activities.unshift({
      id: "act_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      type: 'playlist_deleted',
      text: uName + ' deleted playlist "' + removedPlaylistName + '"',
      user: { displayName: uName },
      timestamp: new Date()
    });
    if (room.activities.length > 50) room.activities.pop();

    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        {
          $set: {
            playlists: room.playlists,
            activities: room.activities,
            lastActiveAt: new Date()
          }
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] deletePlaylist DB error:', e.message);
    }

    return { success: true, playlistId, playlists: room.playlists, room };
  }

  async toggleSongVote(roomId, playlistId, songId, userId) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const playlist = room.playlists.find(p => p.id === playlistId);
    if (!playlist) throw new Error('Playlist not found');

    const song = playlist.songs.find(s => String(s.id || s.videoId) === String(songId));
    if (!song) throw new Error('Song not found in playlist');

    if (!Array.isArray(song.votes)) song.votes = [];
    const uidStr = String(userId || 'anonymous');
    const existingIndex = song.votes.indexOf(uidStr);
    let voted = false;

    if (existingIndex > -1) {
      song.votes.splice(existingIndex, 1);
      voted = false;
    } else {
      song.votes.push(uidStr);
      voted = true;
    }

    playlist.updatedAt = new Date();
    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { 
          $set: { 
            playlists: room.playlists, 
            lastActiveAt: new Date() 
          } 
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] toggleSongVote DB error:', e.message);
    }

    return {
      songId,
      playlistId,
      votes: song.votes,
      voteCount: song.votes.length,
      voted,
      playlist,
      room
    };
  }

  async updateMemberRole(roomId, targetUserId, newRole, requesterUser) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const requesterId = requesterUser?._id?.toString?.() || requesterUser?.userId;
    const requester = room.members.find(m => m.userId === requesterId || m.username === requesterUser?.username);
    
    // Only host can change roles
    if (!requester || this.normalizeRole(requester.role) !== 'host') {
      throw new Error('Only the room Host can change member roles');
    }

    const targetMember = room.members.find(m => m.userId === targetUserId || m.username === targetUserId);
    if (!targetMember) throw new Error('Member not found in room');

    const cleanRole = this.normalizeRole(newRole);
    targetMember.role = cleanRole;
    room.lastActiveAt = new Date();

    room.activities.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'role_changed',
      text: `${targetMember.displayName} is now a ${cleanRole}`,
      user: { displayName: requester.displayName || 'Host' },
      timestamp: new Date()
    });
    if (room.activities.length > 50) room.activities.pop();

    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { 
          $set: { 
            members: room.members, 
            activities: room.activities,
            lastActiveAt: new Date() 
          } 
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] updateMemberRole DB error:', e.message);
    }

    return { member: targetMember, members: room.members, room };
  }

  async kickMember(roomId, targetUserId, requesterUser) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const requesterId = requesterUser?._id?.toString?.() || requesterUser?.userId;
    const requester = room.members.find(m => m.userId === requesterId || m.username === requesterUser?.username);
    
    // Host or Co-Host can remove a member
    const reqRole = requester ? this.normalizeRole(requester.role) : 'listener';
    if (reqRole !== 'host' && reqRole !== 'co-host') {
      throw new Error('Only Host or Co-Host can kick members');
    }

    const targetMember = room.members.find(m => m.userId === targetUserId || m.username === targetUserId);
    if (!targetMember) throw new Error('Member not found');

    if (this.normalizeRole(targetMember.role) === 'host') {
      throw new Error('Cannot kick the room Host');
    }

    room.members = room.members.filter(m => m.userId !== targetUserId && m.username !== targetUserId);
    
    room.activities.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'member_left',
      text: `${targetMember.displayName} was removed from the room`,
      user: { displayName: requester.displayName || 'Host' },
      timestamp: new Date()
    });
    if (room.activities.length > 50) room.activities.pop();

    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { 
          $set: { 
            members: room.members, 
            activities: room.activities,
            lastActiveAt: new Date() 
          } 
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] kickMember DB error:', e.message);
    }

    return { kickedUserId: targetUserId, members: room.members, room };
  }

  async removeMember(roomId, targetUserId, requesterUser) {
    return this.kickMember(roomId, targetUserId, requesterUser);
  }

  async leaveRoom(roomId, user) {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    this.normalizeRoomState(room);

    // Collect all candidate identifiers for the leaving user
    const candidateIds = new Set();
    const addCandidate = (val) => {
      if (val !== undefined && val !== null && String(val).trim()) {
        candidateIds.add(String(val).trim());
      }
    };

    if (typeof user === 'string') {
      addCandidate(user);
    } else if (user && typeof user === 'object') {
      addCandidate(user._id);
      addCandidate(user.userId);
      addCandidate(user.id);
      addCandidate(user.guestId);
      addCandidate(user.username);
      addCandidate(user.email);
    }

    const isMatch = (m) => {
      if (!m) return false;
      return (
        candidateIds.has(String(m.userId || '').trim()) ||
        candidateIds.has(String(m.username || '').trim()) ||
        (m.email && candidateIds.has(String(m.email).trim()))
      );
    };

    const member = room.members.find(isMatch);
    const prevMemberCount = room.members.length;

    // Filter out from room.members
    room.members = room.members.filter(m => !isMatch(m));

    if (member || room.members.length < prevMemberCount) {
      const leaverName = member?.displayName || member?.username || user?.displayName || user?.username || 'A listener';
      room.activities.unshift({
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'member_left',
        text: `${leaverName} left the room`,
        user: { 
          userId: member?.userId || user?.userId || 'unknown', 
          username: member?.username || user?.username || 'Listener', 
          displayName: leaverName 
        },
        timestamp: new Date()
      });
      if (room.activities.length > 50) room.activities.pop();
    }

    // Check if the leaving user was the host/creator
    const wasHost = (
      (room.createdBy?.userId && candidateIds.has(String(room.createdBy.userId).trim())) ||
      (room.createdBy?.username && candidateIds.has(String(room.createdBy.username).trim())) ||
      (member && (member.role === 'host' || member.role === 'owner'))
    );

    if (wasHost) {
      if (room.members.length === 0) {
        // No members left in the room; archive it so it no longer shows up
        room.status = 'archived';
      } else {
        // Transfer host role to the first remaining member
        const nextHost = room.members[0];
        nextHost.role = 'host';
        room.createdBy = {
          userId: nextHost.userId,
          username: nextHost.username,
          displayName: nextHost.displayName || nextHost.username
        };
        room.activities.unshift({
          id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'role_changed',
          text: `${nextHost.displayName || nextHost.username} is now the room host`,
          user: { userId: nextHost.userId, username: nextHost.username, displayName: nextHost.displayName || nextHost.username },
          timestamp: new Date()
        });
        if (room.activities.length > 50) room.activities.pop();
      }
    }

    // Add leaving user to leftMembers
    const leavingUserId = member?.userId || user?.userId || user?._id?.toString?.() || (typeof user === 'string' ? user : 'guest');
    const leavingUserName = member?.displayName || member?.username || user?.displayName || user?.username || 'Listener';
    const leavingEmail = member?.email || user?.email || '';

    if (leavingUserId) {
      if (!Array.isArray(room.leftMembers)) room.leftMembers = [];
      // Remove any duplicate previous leftMember entry for this user
      room.leftMembers = room.leftMembers.filter(lm => String(lm.userId) !== String(leavingUserId));
      room.leftMembers.push({
        userId: String(leavingUserId),
        name: leavingUserName,
        email: leavingEmail,
        leftAt: new Date()
      });
      // Also remove any stale joinRequests from this user when they leave
      if (Array.isArray(room.joinRequests)) {
        room.joinRequests = room.joinRequests.filter(jr => String(jr.userId) !== String(leavingUserId));
      }
    }

    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { 
          $set: { 
            members: room.members, 
            leftMembers: room.leftMembers,
            joinRequests: room.joinRequests,
            createdBy: room.createdBy,
            status: room.status,
            activities: room.activities,
            lastActiveAt: new Date() 
          } 
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] leaveRoom DB update warning:', e.message);
    }

    return { members: room.members, leftMembers: room.leftMembers, room };
  }

  async addChatMessage(roomId, { text, user, clientId, messageId }) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const cleanText = String(text || '').trim().slice(0, 300);
    if (!cleanText) throw new Error('Message cannot be empty');

    const canonicalId = messageId || clientId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Deduplication check: if message with this canonicalId or clientId already exists in recent chat, return it
    const existing = (room.chatMessages || []).find(m => 
      m.id === canonicalId || (clientId && m.clientId === clientId)
    );
    if (existing) {
      return { message: existing, chatMessages: room.chatMessages, room };
    }

    const message = {
      id: canonicalId,
      clientId: clientId || canonicalId,
      text: cleanText,
      user: {
        userId: user?._id?.toString?.() || user?.userId || 'guest',
        username: user?.username || 'Listener',
        displayName: user?.displayName || user?.username || 'Listener',
        avatar: user?.avatarUrl || ''
      },
      timestamp: new Date()
    };

    room.chatMessages.push(message);
    if (room.chatMessages.length > 100) room.chatMessages.shift();

    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { 
          $set: { 
            chatMessages: room.chatMessages, 
            lastActiveAt: new Date() 
          } 
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] addChatMessage DB error:', e.message);
    }

    return { message, chatMessages: room.chatMessages, room };
  }

  async syncPlaybackState(roomId, { currentSong, isPlaying, seekTime, playbackRate = 1.0, user }) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const now = new Date();
    const nowMs = now.getTime();
    if (currentSong !== undefined) room.currentSong = currentSong;
    if (isPlaying !== undefined) room.isPlaying = Boolean(isPlaying);
    if (seekTime !== undefined && !isNaN(seekTime)) room.seekTime = Number(seekTime);
    room.playbackUpdatedAt = now;
    room.lastActiveAt = now;

    const rate = typeof playbackRate === 'number' && playbackRate > 0 ? playbackRate : 1.0;
    const posMs = Math.round((Number(room.seekTime) || 0) * 1000);

    room.playbackState = {
      trackId: room.currentSong?.id || room.currentSong?.videoId || '',
      isPlaying: Boolean(room.isPlaying),
      positionMs: posMs,
      anchorServerTimeMs: nowMs,
      playbackRate: rate
    };

    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { 
          $set: { 
            currentSong: room.currentSong, 
            isPlaying: room.isPlaying, 
            seekTime: room.seekTime,
            playbackUpdatedAt: now,
            playbackState: room.playbackState,
            lastActiveAt: now 
          } 
        }
      );
    } catch (e) {}

    return {
      currentSong: room.currentSong,
      isPlaying: room.isPlaying,
      seekTime: room.seekTime,
      playbackUpdatedAt: now,
      playbackState: room.playbackState,
      room
    };
  }

  // --- Collaborative Queue & Permission Controls ---

  async updatePermissionMode(roomId, permissionMode, requesterUser) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const validModes = ['host_only', 'open_queue', 'co_dj'];
    if (!validModes.includes(permissionMode)) {
      throw new Error(`Invalid permission mode. Must be one of: ${validModes.join(', ')}`);
    }

    const requesterId = requesterUser?._id?.toString?.() || requesterUser?.userId;
    const isCreator = Boolean(
      (room.createdBy?.userId && requesterId && room.createdBy.userId === requesterId) ||
      (room.createdBy?.username && requesterUser?.username && room.createdBy.username === requesterUser.username)
    );
    const requester = room.members.find(m => m.userId === requesterId || m.username === requesterUser?.username);
    const isHost = isCreator || (requester && this.normalizeRole(requester.role) === 'host');
    if (!isHost) {
      throw new Error('Only the room Host can change permission mode');
    }

    room.permissionMode = permissionMode;
    room.lastActiveAt = new Date();

    const modeLabels = {
      host_only: 'Host Only',
      open_queue: 'Open Queue + Votes',
      co_dj: 'Co-DJ Handoff'
    };

    room.activities.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'permission_changed',
      text: `${requester?.displayName || 'Host'} changed room permissions to ${modeLabels[permissionMode] || permissionMode}`,
      user: { displayName: requester?.displayName || 'Host' },
      timestamp: new Date()
    });
    if (room.activities.length > 50) room.activities.pop();

    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { $set: { permissionMode: room.permissionMode, activities: room.activities, lastActiveAt: new Date() } }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] updatePermissionMode DB error:', e.message);
    }

    return { permissionMode: room.permissionMode, room };
  }

  canUserManageQueue(room, user) {
    if (!room || !user) return false;
    const uid = user?._id?.toString?.() || user?.userId;
    const isCreator = room.createdBy?.userId === uid;
    const member = (room.members || []).find(m => m.userId === uid || m.username === user.username);
    const role = member ? this.normalizeRole(member.role) : (isCreator ? 'host' : 'listener');
    const isHostOrCoHost = isCreator || role === 'host' || role === 'co-host';

    if (isHostOrCoHost) return true;
    if (room.permissionMode === 'host_only') return false;
    if (room.permissionMode === 'co_dj') return role === 'co-host';
    return true; // open_queue allows all members
  }

  canUserControlPlayback(room, user) {
    if (!room || !user) return false;
    const uid = user?._id?.toString?.() || user?.userId;
    const isCreator = room.createdBy?.userId === uid;
    const member = (room.members || []).find(m => m.userId === uid || m.username === user.username);
    const role = member ? this.normalizeRole(member.role) : (isCreator ? 'host' : 'listener');
    if (isCreator || role === 'host') return true;
    if (room.permissionMode === 'co_dj' && role === 'co-host') return true;
    return false;
  }

  async addQueueTrack(roomId, { track, user }) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    if (!track || (!track.id && !track.videoId && !track.trackId)) {
      throw new Error('Valid track is required');
    }

    if (!this.canUserManageQueue(room, user)) {
      throw new Error('You do not have permission to add tracks to the queue in this room');
    }

    const tId = String(track.id || track.videoId || track.trackId);
    // Duplicate / spam guard: reject if already in queue
    const existsInQueue = (room.queue || []).some(q => String(q.trackId || q.id || q.videoId) === tId);
    if (existsInQueue) {
      throw new Error('Track is already in the room queue');
    }

    const uid = user?._id?.toString?.() || user?.userId || 'guest';
    const queueItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      trackId: tId,
      videoId: track.videoId || tId,
      title: track.title || 'Untitled Song',
      artist: track.artist || track.channel || 'Unknown Artist',
      thumbnail: track.thumbnail || '',
      durationSec: Number(track.durationSec || track.duration) || 0,
      addedBy: {
        userId: uid,
        username: user?.username || 'Listener',
        displayName: user?.displayName || user?.username || 'Listener'
      },
      votes: [uid], // Author automatically upvotes
      addedAt: new Date()
    };

    room.queue.push(queueItem);
    this.sortQueueByVotes(room.queue);
    room.lastActiveAt = new Date();

    room.activities.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'queue_track_added',
      text: `${queueItem.addedBy.displayName} added "${queueItem.title}" to the queue`,
      user: { displayName: queueItem.addedBy.displayName },
      timestamp: new Date()
    });
    if (room.activities.length > 50) room.activities.pop();

    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { $set: { queue: room.queue, activities: room.activities, lastActiveAt: new Date() } }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] addQueueTrack DB error:', e.message);
    }

    return { queueItem, queue: room.queue, room };
  }

  async toggleQueueVote(roomId, queueItemId, user) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const item = (room.queue || []).find(q => q.id === queueItemId);
    if (!item) throw new Error('Queue item not found');

    const uid = String(user?._id?.toString?.() || user?.userId || 'guest');
    if (!Array.isArray(item.votes)) item.votes = [];

    const idx = item.votes.indexOf(uid);
    let voted = false;
    if (idx > -1) {
      item.votes.splice(idx, 1);
      voted = false;
    } else {
      item.votes.push(uid);
      voted = true;
    }

    // Dynamically reorder queue based on vote count descending, then FIFO addedAt
    this.sortQueueByVotes(room.queue);
    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { $set: { queue: room.queue, lastActiveAt: new Date() } }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] toggleQueueVote DB error:', e.message);
    }

    return {
      queueItemId,
      votes: item.votes,
      voteCount: item.votes.length,
      voted,
      queue: room.queue,
      room
    };
  }

  async removeQueueTrack(roomId, queueItemId, user) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const uid = user?._id?.toString?.() || user?.userId;
    const item = (room.queue || []).find(q => q.id === queueItemId);
    if (!item) throw new Error('Queue item not found');

    const isAuthor = item.addedBy?.userId === uid;
    const canControl = this.canUserControlPlayback(room, user);
    if (!isAuthor && !canControl) {
      throw new Error('Permission denied to remove this item from queue');
    }

    room.queue = room.queue.filter(q => q.id !== queueItemId);
    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { $set: { queue: room.queue, lastActiveAt: new Date() } }
      );
    } catch (e) {}

    return { removedId: queueItemId, queue: room.queue, room };
  }

  async popNextQueueTrack(roomId) {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    this.normalizeRoomState(room);

    if (!Array.isArray(room.queue) || room.queue.length === 0) {
      return null;
    }

    this.sortQueueByVotes(room.queue);
    const nextTrackItem = room.queue.shift();
    room.lastActiveAt = new Date();

    const nextTrack = {
      id: nextTrackItem.trackId || nextTrackItem.id,
      videoId: nextTrackItem.videoId || nextTrackItem.trackId || nextTrackItem.id,
      title: nextTrackItem.title,
      artist: nextTrackItem.artist,
      thumbnail: nextTrackItem.thumbnail,
      duration: nextTrackItem.durationSec
    };

    // Automatically set next track as currentSong and anchor server time at 0s
    await this.syncPlaybackState(room.roomId, {
      currentSong: nextTrack,
      isPlaying: true,
      seekTime: 0,
      playbackRate: 1.0
    });

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { $set: { queue: room.queue, lastActiveAt: new Date() } }
      );
    } catch (e) {}

    return { nextTrack, queue: room.queue, room };
  }

  async addPlayNextTrack(roomId, { track, user }) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    if (!this.canUserManageQueue(room, user)) {
      throw new Error('You do not have permission to manage the queue in this room');
    }

    const tId = String(track.id || track.videoId || track.trackId);
    // Remove if already in queue to reposition as play-next
    room.queue = (room.queue || []).filter(q => String(q.trackId || q.id || q.videoId) !== tId);

    const uid = user?._id?.toString?.() || user?.userId || 'guest';
    const queueItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      trackId: tId,
      videoId: track.videoId || track.id || tId,
      title: track.title || 'Untitled Track',
      artist: track.artist || track.channel || 'Unknown Artist',
      thumbnail: track.thumbnail || track.thumbnailUrl || '/loopra-logo.png',
      durationSec: track.duration || 0,
      addedBy: {
        userId: uid,
        displayName: user?.displayName || user?.name || 'Listener'
      },
      votes: [uid], // Give play-next top initial vote weight
      playNext: true,
      addedAt: new Date()
    };

    // Prepend to top of queue
    room.queue.unshift(queueItem);
    room.lastActiveAt = new Date();

    room.activities.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'queue_track_play_next',
      text: `${queueItem.addedBy.displayName} prioritized "${queueItem.title}" to play next`,
      user: { displayName: queueItem.addedBy.displayName },
      timestamp: new Date()
    });
    if (room.activities.length > 50) room.activities.pop();

    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { $set: { queue: room.queue, activities: room.activities, lastActiveAt: new Date() } }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] addPlayNextTrack DB error:', e.message);
    }

    return { queueItem, queue: room.queue, room };
  }

  async reorderQueue(roomId, newQueue, user) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    if (!this.canUserManageQueue(room, user)) {
      throw new Error('Permission denied to reorder queue in this room');
    }

    if (!Array.isArray(newQueue)) {
      throw new Error('Invalid queue structure: expected an array');
    }

    // Preserve existing item properties while syncing the reordered index
    const existingMap = new Map((room.queue || []).map(q => [q.id, q]));
    const reordered = [];

    for (const item of newQueue) {
      const match = existingMap.get(item.id || item.trackId);
      if (match) {
        reordered.push(match);
      } else if (item.trackId || item.id) {
        reordered.push(item);
      }
    }

    room.queue = reordered;
    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { $set: { queue: room.queue, lastActiveAt: new Date() } }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] reorderQueue DB error:', e.message);
    }

    return { queue: room.queue, room };
  }

  sortQueueByVotes(queue) {
    if (!Array.isArray(queue)) return;
    queue.sort((a, b) => {
      const vA = (a.votes && a.votes.length) || 0;
      const vB = (b.votes && b.votes.length) || 0;
      if (vB !== vA) return vB - vA;
      return new Date(a.addedAt || 0) - new Date(b.addedAt || 0);
    });
  }

  async recordReaction(roomId, { emoji, user, role }) {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    this.normalizeRoomState(room);

    const displayName = user?.displayName || user?.username || 'Listener';
    const finalRole = (role || 'listener').toUpperCase();
    const actId = `act_react_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const activityItem = {
      id: actId,
      type: 'reaction',
      emoji,
      text: `${displayName} reacted with ${emoji}`,
      user: {
        userId: user?._id?.toString?.() || user?.userId || 'guest',
        displayName,
        username: user?.username || displayName,
        role: finalRole,
        avatar: user?.avatarUrl || ''
      },
      timestamp: new Date()
    };

    room.activities.unshift(activityItem);
    if (room.activities.length > 50) room.activities.pop();

    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        {
          $set: {
            activities: room.activities,
            lastActiveAt: new Date()
          }
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] recordReaction DB warning:', e.message);
    }

    return { activityItem, activities: room.activities, room };
  }

  async regenerateInviteCode(roomId, requesterUser) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const requesterId = requesterUser?._id?.toString?.() || requesterUser?.userId;
    const isCreator = Boolean(
      (room.createdBy?.userId && requesterId && room.createdBy.userId === requesterId) ||
      (room.createdBy?.username && requesterUser?.username && room.createdBy.username === requesterUser.username)
    );
    const requester = room.members.find(m => m.userId === requesterId || m.username === requesterUser?.username);
    const isHost = isCreator || (requester && this.normalizeRole(requester.role) === 'host');
    if (!isHost) {
      throw new Error('Only the room Host can regenerate the invite code');
    }

    const newCode = this.generateCode(6);
    room.code = newCode;
    room.lastActiveAt = new Date();

    room.activities.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'invite_regenerated',
      text: `${requester.displayName} regenerated the room invite code`,
      user: { displayName: requester.displayName || 'Host' },
      timestamp: new Date()
    });
    if (room.activities.length > 50) room.activities.pop();

    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { $set: { code: newCode, activities: room.activities, lastActiveAt: new Date() } }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] regenerateInviteCode DB error:', e.message);
    }

    return { code: newCode, room };
  }

  async updateRoomPrivacy(roomId, isPublic, requesterUser) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const requesterId = requesterUser?._id?.toString?.() || requesterUser?.userId;
    const isCreator = Boolean(
      (room.createdBy?.userId && requesterId && room.createdBy.userId === requesterId) ||
      (room.createdBy?.username && requesterUser?.username && room.createdBy.username === requesterUser.username)
    );
    const requester = room.members.find(m => m.userId === requesterId || m.username === requesterUser?.username);
    const isHost = isCreator || (requester && this.normalizeRole(requester.role) === 'host');
    if (!isHost) {
      throw new Error('Only the room Host can change room privacy');
    }

    room.isPublic = Boolean(isPublic);
    room.lastActiveAt = new Date();

    room.activities.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'privacy_changed',
      text: `${requester.displayName} changed room to ${room.isPublic ? 'Public' : 'Invite-Only'}`,
      user: { displayName: requester.displayName || 'Host' },
      timestamp: new Date()
    });
    if (room.activities.length > 50) room.activities.pop();

    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { $set: { isPublic: room.isPublic, activities: room.activities, lastActiveAt: new Date() } }
      );
    } catch (e) {}

    return { isPublic: room.isPublic, room };
  }

  async toggleArchiveRoom(roomId, shouldArchive = true, requesterUser) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const requesterId = requesterUser?._id?.toString?.() || requesterUser?.userId;
    const isCreator = Boolean(
      (room.createdBy?.userId && requesterId && room.createdBy.userId === requesterId) ||
      (room.createdBy?.username && requesterUser?.username && room.createdBy.username === requesterUser.username)
    );
    const requester = room.members.find(m => m.userId === requesterId || m.username === requesterUser?.username);
    const isHost = isCreator || (requester && this.normalizeRole(requester.role) === 'host');
    if (!isHost) {
      throw new Error('Only the room Host can archive or restore this room');
    }

    const isArchived = Boolean(shouldArchive);
    room.isArchived = isArchived;
    room.status = isArchived ? 'archived' : 'active';
    room.archivedAt = isArchived ? new Date() : null;
    room.archivedBy = isArchived ? {
      userId: requesterId || 'unknown',
      username: requesterUser?.username || 'Host',
      displayName: requesterUser?.displayName || requesterUser?.username || 'Host'
    } : null;
    room.lastActiveAt = new Date();

    room.activities.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: isArchived ? 'room_archived' : 'room_restored',
      text: isArchived 
        ? `${room.archivedBy.displayName} archived the room` 
        : `${requesterUser?.displayName || requesterUser?.username || 'Host'} restored the room to active`,
      user: { userId: requesterId, username: requesterUser?.username, displayName: requesterUser?.displayName || requesterUser?.username },
      timestamp: new Date()
    });
    if (room.activities.length > 50) room.activities.pop();

    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        { 
          $set: { 
            status: room.status,
            isArchived: room.isArchived,
            archivedAt: room.archivedAt,
            archivedBy: room.archivedBy,
            activities: room.activities,
            lastActiveAt: new Date() 
          } 
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] toggleArchiveRoom DB error:', e.message);
    }

    return { 
      isArchived: room.isArchived, 
      status: room.status, 
      archivedAt: room.archivedAt, 
      archivedBy: room.archivedBy, 
      room 
    };
  }

  async deleteRoomPermanently(roomId, requesterUser) {
    const room = await this.getRoom(roomId);
    if (!room) return { deleted: true, roomId };
    this.normalizeRoomState(room);

    const requesterId = requesterUser?._id?.toString?.() || requesterUser?.userId;
    const isCreator = Boolean(
      (room.createdBy?.userId && requesterId && room.createdBy.userId === requesterId) ||
      (room.createdBy?.username && requesterUser?.username && room.createdBy.username === requesterUser.username)
    );
    const requester = room.members.find(m => m.userId === requesterId || m.username === requesterUser?.username);
    const isHost = isCreator || (requester && this.normalizeRole(requester.role) === 'host');
    if (!isHost) {
      throw new Error('Only the room Host can permanently delete this room');
    }

    const rId = room.roomId || roomId;
    this.deletedRoomIds.add(String(rId));
    if (room.code) this.deletedRoomIds.add(String(room.code).toUpperCase());
    if (room._id) this.deletedRoomIds.add(String(room._id));

    this.roomsCache.delete(rId);
    if (room.code) this.roomsCache.delete(room.code);
    if (room._id) this.roomsCache.delete(String(room._id));

    try {
      const orConditions = [{ roomId: rId }];
      if (room.code) orConditions.push({ code: String(room.code).toUpperCase() });
      if (room._id) orConditions.push({ _id: room._id });
      await CollaborativeRoom.deleteMany({ $or: orConditions });
    } catch (e) {
      console.warn('[CollaborativeRoomService] deleteRoomPermanently DB error:', e.message);
    }

    return { deleted: true, roomId: rId };
  }

  // Remove a room from a user's Left Rooms list (or permanently delete if host)
  async deleteLeftRoomForUser(roomId, requesterUser) {
    const room = await this.getRoom(roomId);
    if (!room) return { success: true, removed: true, roomId };
    this.normalizeRoomState(room);

    const requesterId = requesterUser?._id?.toString?.() || requesterUser?.userId;
    const isCreator = Boolean(
      (room.createdBy?.userId && requesterId && room.createdBy.userId === requesterId) ||
      (room.createdBy?.username && requesterUser?.username && room.createdBy.username === requesterUser.username)
    );

    // If the requester is the host/creator, permanently delete the entire room
    if (isCreator) {
      return this.deleteRoomPermanently(roomId, requesterUser);
    }

    // Otherwise, mark room as deleted/hidden for this specific user so it never re-appears in active/joined/left rooms
    const uidStr = String(requesterId).trim();
    if (!Array.isArray(room.deletedForUsers)) {
      room.deletedForUsers = [];
    }
    if (uidStr && !room.deletedForUsers.includes(uidStr)) {
      room.deletedForUsers.push(uidStr);
    }

    // Also purge from members, leftMembers, and joinRequests
    if (Array.isArray(room.members)) {
      room.members = room.members.filter(m => String(m.userId) !== uidStr);
    }
    if (Array.isArray(room.leftMembers)) {
      room.leftMembers = room.leftMembers.filter(lm => String(lm.userId) !== uidStr);
    }
    if (Array.isArray(room.joinRequests)) {
      room.joinRequests = room.joinRequests.filter(jr => String(jr.userId) !== uidStr);
    }

    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        {
          $set: {
            members: room.members,
            leftMembers: room.leftMembers,
            joinRequests: room.joinRequests,
            lastActiveAt: new Date()
          },
          $addToSet: {
            deletedForUsers: uidStr
          }
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] deleteLeftRoomForUser DB error:', e.message);
    }

    return { success: true, removed: true, roomId: room.roomId, deletedPermanently: false };
  }

  async archiveOrDeleteRoom(roomId, action = 'archive', requesterUser) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const requesterId = requesterUser?._id?.toString?.() || requesterUser?.userId;
    const isCreator = Boolean(
      (room.createdBy?.userId && requesterId && room.createdBy.userId === requesterId) ||
      (room.createdBy?.username && requesterUser?.username && room.createdBy.username === requesterUser.username)
    );
    const requester = room.members.find(m => m.userId === requesterId || m.username === requesterUser?.username);
    const isHost = isCreator || (requester && this.normalizeRole(requester.role) === 'host');
    if (!isHost) {
      throw new Error('Only the room Host can archive or delete this room');
    }

    room.status = action === 'delete' ? 'deleted' : 'archived';
    room.lastActiveAt = new Date();

    if (action === 'delete') {
      this.roomsCache.delete(room.roomId);
    } else {
      this.roomsCache.set(room.roomId, room);
    }

    try {
      if (action === 'delete') {
        await CollaborativeRoom.deleteOne({ roomId: room.roomId });
      } else {
        await CollaborativeRoom.updateOne(
          { roomId: room.roomId },
          { $set: { status: 'archived', lastActiveAt: new Date() } }
        );
      }
    } catch (e) {}

    return { status: room.status, roomId: room.roomId };
  }

  async reorderPlaylistSongs(roomId, playlistId, songs) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

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

  // --- Re-Join Request & Host Approval / Rejection ---

  async requestToJoin(roomId, user) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const uid = String(user?._id?.toString?.() || user?.userId || user?.id || (typeof user === 'string' ? user : '')).trim();
    if (!uid) throw new Error('Valid user identifier is required');

    const name = String(user?.displayName || user?.name || user?.username || 'Listener').trim();
    const email = String(user?.email || '').trim();

    // Check if user is already a member
    const alreadyMember = room.members.some(m => String(m.userId) === uid);
    if (alreadyMember) {
      return { status: 'already_member', room, request: null };
    }

    // Add or update in joinRequests
    if (!Array.isArray(room.joinRequests)) room.joinRequests = [];
    room.joinRequests = room.joinRequests.filter(jr => String(jr.userId) !== uid);
    const newRequest = {
      userId: uid,
      name,
      email,
      requestedAt: new Date()
    };
    room.joinRequests.push(newRequest);

    room.activities.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'join_requested',
      text: `${name} requested to re-join the room`,
      user: { userId: uid, username: name, displayName: name },
      timestamp: new Date()
    });
    if (room.activities.length > 50) room.activities.pop();

    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        {
          $set: {
            joinRequests: room.joinRequests,
            activities: room.activities,
            lastActiveAt: new Date()
          }
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] requestToJoin DB update warning:', e.message);
    }

    return { status: 'pending', request: newRequest, room, hostUserId: room.createdBy?.userId };
  }

  async approveJoinRequest(roomId, targetUserId, requesterUser) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    // Verify requester is Host
    const requesterId = requesterUser?._id?.toString?.() || requesterUser?.userId;
    const isCreator = Boolean(
      (room.createdBy?.userId && requesterId && room.createdBy.userId === requesterId) ||
      (room.createdBy?.username && requesterUser?.username && room.createdBy.username === requesterUser.username)
    );
    const requester = room.members.find(m => m.userId === requesterId || m.username === requesterUser?.username);
    const isHost = isCreator || (requester && this.normalizeRole(requester.role) === 'host');
    if (!isHost) {
      throw new Error('Only the room Host can approve join requests');
    }

    const tUid = String(targetUserId).trim();
    const reqIndex = room.joinRequests.findIndex(jr => String(jr.userId) === tUid);
    const joinReq = reqIndex !== -1 ? room.joinRequests[reqIndex] : null;

    // Remove from joinRequests
    room.joinRequests = room.joinRequests.filter(jr => String(jr.userId) !== tUid);

    // Remove from leftMembers
    if (Array.isArray(room.leftMembers)) {
      room.leftMembers = room.leftMembers.filter(lm => String(lm.userId) !== tUid);
    }

    // Add back to members if not already there
    let member = room.members.find(m => String(m.userId) === tUid);
    if (!member) {
      member = {
        userId: tUid,
        username: joinReq?.name || 'Listener',
        displayName: joinReq?.name || 'Listener',
        email: joinReq?.email || '',
        avatar: '',
        role: 'listener',
        joinedAt: new Date(),
        lastActiveAt: new Date()
      };
      room.members.push(member);
    }

    const approvedName = joinReq?.name || member?.displayName || member?.username || 'Listener';
    room.activities.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'member_joined',
      text: `${approvedName} was approved to rejoin by the Host`,
      user: { userId: tUid, username: approvedName, displayName: approvedName },
      timestamp: new Date()
    });
    if (room.activities.length > 50) room.activities.pop();

    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        {
          $set: {
            members: room.members,
            leftMembers: room.leftMembers,
            joinRequests: room.joinRequests,
            activities: room.activities,
            lastActiveAt: new Date()
          }
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] approveJoinRequest DB update warning:', e.message);
    }

    return { 
      approvedUserId: tUid, 
      member, 
      members: room.members, 
      joinRequests: room.joinRequests, 
      room 
    };
  }

  async rejectJoinRequest(roomId, targetUserId, requesterUser) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    // Verify requester is Host
    const requesterId = requesterUser?._id?.toString?.() || requesterUser?.userId;
    const isCreator = Boolean(
      (room.createdBy?.userId && requesterId && room.createdBy.userId === requesterId) ||
      (room.createdBy?.username && requesterUser?.username && room.createdBy.username === requesterUser.username)
    );
    const requester = room.members.find(m => m.userId === requesterId || m.username === requesterUser?.username);
    const isHost = isCreator || (requester && this.normalizeRole(requester.role) === 'host');
    if (!isHost) {
      throw new Error('Only the room Host can reject join requests');
    }

    const tUid = String(targetUserId).trim();
    room.joinRequests = (room.joinRequests || []).filter(jr => String(jr.userId) !== tUid);

    room.lastActiveAt = new Date();
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        {
          $set: {
            joinRequests: room.joinRequests,
            lastActiveAt: new Date()
          }
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] rejectJoinRequest DB update warning:', e.message);
    }

    return { rejectedUserId: tUid, joinRequests: room.joinRequests, room };
  }
  // Active Playback Session Management (Listen Together Ready-Check, Pre-Buffer & Mid-Playback Sync)
  async preparePlayback(roomId, { requestId, track, basePositionSec, initiatorId, initiatorName }) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const reqId = requestId || `prep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const prepareState = {
      requestId: reqId,
      track,
      basePositionSec: typeof basePositionSec === 'number' ? basePositionSec : 0,
      initiatorId: String(initiatorId || ''),
      initiatorName: initiatorName || 'A listener',
      preparedAt: Date.now(),
      readyUsers: [String(initiatorId || '')]
    };

    room.activePlaybackPrepare = prepareState;
    this.roomsCache.set(room.roomId, room);

    return { prepareState, room };
  }

  async markPlaybackBuffered(roomId, { requestId, userId }) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const prep = room.activePlaybackPrepare;
    if (!prep || prep.requestId !== requestId) {
      return { prepareState: null, room };
    }

    const uIdStr = String(userId || '');
    if (!prep.readyUsers.includes(uIdStr)) {
      prep.readyUsers.push(uIdStr);
    }

    this.roomsCache.set(room.roomId, room);
    return { prepareState: prep, room };
  }

  async createPlaybackRequest(roomId, { requestId, track, initiatorId, initiatorName }) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const reqId = requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRequest = {
      requestId: reqId,
      track,
      initiatorId: String(initiatorId || ''),
      initiatorName: initiatorName || 'A listener',
      createdAt: Date.now(),
      readyUsers: [String(initiatorId || '')], // Initiator is ready by default
      declinedUsers: []
    };

    room.activePlaybackRequest = newRequest;
    this.roomsCache.set(room.roomId, room);

    return { request: newRequest, room };
  }

  async respondPlaybackRequest(roomId, { requestId, userId, response }) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const activeReq = room.activePlaybackRequest;
    if (!activeReq || activeReq.requestId !== requestId) {
      return { request: null, room };
    }

    const uIdStr = String(userId || '');
    if (response === 'okay' || response === 'ready' || response === true) {
      if (!activeReq.readyUsers.includes(uIdStr)) {
        activeReq.readyUsers.push(uIdStr);
      }
      activeReq.declinedUsers = activeReq.declinedUsers.filter(id => id !== uIdStr);
    } else if (response === 'decline' || response === false) {
      if (!activeReq.declinedUsers.includes(uIdStr)) {
        activeReq.declinedUsers.push(uIdStr);
      }
      activeReq.readyUsers = activeReq.readyUsers.filter(id => id !== uIdStr);
    }

    this.roomsCache.set(room.roomId, room);
    return { request: activeReq, room };
  }

  async startPlaybackSession(roomId, { track, basePositionSec, startedAt, isPlaying, user }) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const now = Date.now();
    const finalStartedAt = typeof startedAt === 'number' ? startedAt : now;
    const finalBasePos = typeof basePositionSec === 'number' && !isNaN(basePositionSec) ? Number(basePositionSec) : 0;
    const finalIsPlaying = isPlaying !== undefined ? Boolean(isPlaying) : true;

    room.currentSong = track || room.currentSong;
    room.seekTime = finalBasePos;
    room.isPlaying = finalIsPlaying;
    room.playbackUpdatedAt = new Date(finalStartedAt);
    room.lastActiveAt = new Date();

    // Store live session data for precise current-timestamp calculation on late join / late accept
    room.playbackSession = {
      track: room.currentSong,
      basePositionSec: finalBasePos,
      startedAt: finalStartedAt,
      isPlaying: finalIsPlaying,
      updatedAt: now,
      updatedBy: user?.displayName || user?.username || 'Host'
    };

    // Clear active playback request once session starts
    room.activePlaybackRequest = null;
    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        {
          $set: {
            currentSong: room.currentSong,
            isPlaying: room.isPlaying,
            seekTime: room.seekTime,
            playbackUpdatedAt: new Date(finalStartedAt),
            playbackSession: room.playbackSession,
            lastActiveAt: new Date()
          }
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] startPlaybackSession DB warning:', e.message);
    }

    return {
      playbackSession: room.playbackSession,
      room
    };
  }

  async getCurrentPlaybackState(roomId) {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    this.normalizeRoomState(room);

    const session = room.playbackSession || {
      track: room.currentSong,
      basePositionSec: room.seekTime || 0,
      startedAt: room.playbackUpdatedAt ? new Date(room.playbackUpdatedAt).getTime() : Date.now(),
      isPlaying: Boolean(room.isPlaying),
      updatedAt: Date.now()
    };

    // Calculate live position taking elapsed playback time into account
    let currentPositionSec = typeof session.basePositionSec === 'number' ? session.basePositionSec : 0;
    if (session.isPlaying && session.startedAt) {
      const now = Date.now();
      const elapsedSec = Math.max(0, (now - session.startedAt) / 1000);
      currentPositionSec += elapsedSec;
    }

    return {
      track: session.track,
      basePositionSec: session.basePositionSec,
      currentPositionSec: Math.max(0, currentPositionSec),
      startedAt: session.startedAt,
      isPlaying: session.isPlaying,
      updatedAt: session.updatedAt || Date.now(),
      activePlaybackRequest: room.activePlaybackRequest || null
    };
  }

  async updatePlaybackSession(roomId, { isPlaying, seekTime, user }) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const now = Date.now();
    const curPos = typeof seekTime === 'number' && !isNaN(seekTime)
      ? Number(seekTime)
      : (room.playbackSession?.basePositionSec || room.seekTime || 0);

    const nextIsPlaying = isPlaying !== undefined ? Boolean(isPlaying) : (room.playbackSession?.isPlaying ?? room.isPlaying);

    room.seekTime = curPos;
    room.isPlaying = nextIsPlaying;
    room.playbackUpdatedAt = new Date(now);
    room.lastActiveAt = new Date(now);

    room.playbackSession = {
      track: room.currentSong,
      basePositionSec: curPos,
      startedAt: now,
      isPlaying: nextIsPlaying,
      updatedAt: now,
      updatedBy: user?.displayName || user?.username || 'Member'
    };

    this.roomsCache.set(room.roomId, room);

    try {
      await CollaborativeRoom.updateOne(
        { roomId: room.roomId },
        {
          $set: {
            isPlaying: room.isPlaying,
            seekTime: room.seekTime,
            playbackUpdatedAt: new Date(now),
            playbackSession: room.playbackSession,
            lastActiveAt: new Date(now)
          }
        }
      );
    } catch (e) {}

    return {
      playbackSession: room.playbackSession,
      room
    };
  }

  // Purge any room matching name/title completely (e.g. "Devil") from DB and cache
  async purgeRoomsByName(namePattern) {
    if (!namePattern) return { purgedCount: 0 };
    const regex = new RegExp(namePattern, 'i');

    const purgedIds = [];

    // Purge from cache
    for (const [key, r] of this.roomsCache.entries()) {
      if (r && r.name && regex.test(r.name)) {
        const rId = r.roomId || r.id;
        purgedIds.push(String(rId));
        this.deletedRoomIds.add(String(rId));
        if (r.code) this.deletedRoomIds.add(String(r.code).toUpperCase());
        if (r._id) this.deletedRoomIds.add(String(r._id));
        this.roomsCache.delete(key);
      }
    }

    // Purge from MongoDB
    try {
      const matchingRooms = await CollaborativeRoom.find({ name: regex }).lean();
      for (const r of matchingRooms) {
        const rId = r.roomId || r._id?.toString?.();
        if (rId) {
          purgedIds.push(String(rId));
          this.deletedRoomIds.add(String(rId));
          if (r.code) this.deletedRoomIds.add(String(r.code).toUpperCase());
          if (r._id) this.deletedRoomIds.add(String(r._id));
          this.roomsCache.delete(r.roomId);
          if (r.code) this.roomsCache.delete(r.code);
          if (r._id) this.roomsCache.delete(String(r._id));
        }
      }

      const res = await CollaborativeRoom.deleteMany({ name: regex });
      console.log(`[CollaborativeRoomService] Purged ${res.deletedCount || matchingRooms.length} room(s) matching pattern "${namePattern}"`);
      return { purgedCount: res.deletedCount || matchingRooms.length, purgedIds };
    } catch (e) {
      console.warn('[CollaborativeRoomService] purgeRoomsByName DB error:', e.message);
      return { purgedCount: purgedIds.length, purgedIds };
    }
  }
}

export const collaborativeRoomService = new CollaborativeRoomService();