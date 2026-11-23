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

  normalizeRole(role) {
    if (role === 'owner' || role === 'host') return 'host';
    if (role === 'admin' || role === 'co-host') return 'co-host';
    return 'listener';
  }

  async getRoom(roomIdOrCode) {
    if (!roomIdOrCode) return null;
    const key = String(roomIdOrCode).trim();
    if (!key) return null;
    
    // Check in-memory first
    if (this.roomsCache.has(key)) {
      const cached = this.roomsCache.get(key);
      if (cached && cached.status !== 'deleted' && cached.status !== 'archived') {
        return cached;
      }
    }
    for (const room of this.roomsCache.values()) {
      if ((room.code === key.toUpperCase() || room.roomId === key) && room.status !== 'deleted' && room.status !== 'archived') {
        return room;
      }
    }

    // Check DB strictly for active rooms
    try {
      const room = await CollaborativeRoom.findOne({
        $or: [{ roomId: key }, { code: key.toUpperCase() }],
        status: 'active'
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
    r.members.forEach(m => {
      m.role = this.normalizeRole(m.role);
    });
    if (!Array.isArray(r.playlists)) r.playlists = [];
    r.playlists.forEach(pl => {
      if (!Array.isArray(pl.songs)) pl.songs = [];
      pl.songs.forEach(s => {
        if (!Array.isArray(s.votes)) s.votes = [];
      });
    });
    if (!Array.isArray(r.activities)) r.activities = [];
    if (!Array.isArray(r.chatMessages)) r.chatMessages = [];
    if (!r.status) r.status = 'active';
  }

  async listRooms(limit = 40) {
    const list = [];
    try {
      const dbRooms = await CollaborativeRoom.find({
        isPublic: true,
        status: { $ne: 'deleted' }
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
        if (r.isPublic !== false && r.status !== 'deleted') {
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
      const dbRooms = await CollaborativeRoom.find({
        status: { $ne: 'deleted' },
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
      console.warn('[CollaborativeRoomService] listUserRooms DB error, using cache:', e.message);
      for (const r of this.roomsCache.values()) {
        if (r.status !== 'deleted') {
          const isCreator = r.createdBy?.userId === uid;
          const isMember = (r.members || []).some(m => m.userId === uid);
          if (isCreator || isMember) {
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
      currentSong: r.currentSong,
      isPlaying: Boolean(r.isPlaying),
      isPublic: r.isPublic !== false,
      status: r.status || 'active',
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
    let room = await this.getRoom(roomIdOrCode);
    if (!room) return null;

    this.normalizeRoomState(room);

    const uId = user?._id?.toString?.() || user?.userId || `guest_${Date.now()}`;
    const uName = user?.username || 'Listener';
    const dName = user?.displayName || uName;

    const existingMember = room.members.find(m => m.userId === uId || (m.username === uName && uName !== 'Listener'));
    let isNewJoin = false;
    if (!existingMember) {
      const isCreator = room.createdBy?.userId === uId;
      room.members.push({
        userId: uId,
        username: uName,
        displayName: dName,
        avatar: user?.avatarUrl || '',
        role: isCreator ? 'host' : 'listener',
        joinedAt: new Date(),
        lastActiveAt: new Date()
      });
      isNewJoin = true;
    } else {
      existingMember.lastActiveAt = new Date();
      existingMember.displayName = dName;
      if (user?.avatarUrl) existingMember.avatar = user.avatarUrl;
    }

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
            members: room.members, 
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

    const uId = user?._id?.toString?.() || user?.userId || (typeof user === 'string' ? user : null);
    const uName = user?.username || (typeof user === 'string' ? user : null);
    const member = room.members.find(m => (uId && String(m.userId) === String(uId)) || (uName && String(m.username) === String(uName)));

    if (member) {
      room.members = room.members.filter(m => m !== member && String(m.userId) !== String(uId));
      room.activities.unshift({
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'member_left',
        text: `${member.displayName || member.username} left the room`,
        user: { userId: member.userId, username: member.username, displayName: member.displayName || member.username },
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
            members: room.members, 
            activities: room.activities,
            lastActiveAt: new Date() 
          } 
        }
      );
    } catch (e) {
      console.warn('[CollaborativeRoomService] leaveRoom DB update warning:', e.message);
    }

    return { members: room.members, room };
  }

  async addChatMessage(roomId, { text, user }) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const cleanText = String(text || '').trim().slice(0, 300);
    if (!cleanText) throw new Error('Message cannot be empty');

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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

  async syncPlaybackState(roomId, { currentSong, isPlaying, seekTime, user }) {
    const room = await this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    this.normalizeRoomState(room);

    const now = new Date();
    if (currentSong !== undefined) room.currentSong = currentSong;
    if (isPlaying !== undefined) room.isPlaying = Boolean(isPlaying);
    if (seekTime !== undefined && !isNaN(seekTime)) room.seekTime = Number(seekTime);
    room.playbackUpdatedAt = now;
    room.lastActiveAt = now;

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
      room
    };
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
}

export const collaborativeRoomService = new CollaborativeRoomService();