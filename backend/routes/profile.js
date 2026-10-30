import express from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import { authenticateToken, verifyToken } from '../middleware/auth.js';
import { listeningEventService } from '../services/listeningEventService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const router = express.Router();

// 1. Get Public Profile by Username
router.get('/profile/:username', async (req, res) => {
  try {
    const rawUsername = (req.params.username || '').trim().toLowerCase();
    const user = await User.findOne({ username: rawUsername }).lean();

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    if (user.status === 'suspended' || user.status === 'deactivated') {
      return res.status(404).json({ error: 'User profile unavailable' });
    }

    // Determine if requester is the user itself
    let isSelf = false;
    let isFollowing = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = verifyToken(token);
        if (decoded && decoded.userId === user._id.toString()) {
          isSelf = true;
        }
        if (decoded && user.followers && user.followers.some(f => f.toString() === decoded.userId)) {
          isFollowing = true;
        }
      } catch (e) {}
    }

    // If profile is set to private and requester is not self
    if (!user.isPublic && !isSelf) {
      return res.json({
        isPrivate: true,
        username: user.username,
        displayName: user.displayName || user.username,
        avatarUrl: user.avatarUrl || '',
        followersCount: (user.followers || []).length,
        followingCount: (user.following || []).length,
        isFollowing
      });
    }

    // Extract public playlists
    const publicPlaylists = (user.playlists || [])
      .filter(pl => pl.isPublic !== false)
      .map(pl => ({
        id: pl.id || pl._id,
        name: pl.name,
        songsCount: (pl.songs || []).length,
        coverArt: pl.coverArt || (pl.songs?.[0] ? (pl.songs[0].thumbnail || pl.songs[0].coverArt) : null),
        isCollaborative: Boolean(pl.isCollaborative)
      }));

    res.json({
      id: user._id.toString(),
      username: user.username,
      displayName: user.displayName || user.username,
      avatarUrl: user.avatarUrl || '',
      bio: user.bio || '',
      favoriteGenres: user.favoriteGenres || [],
      isPublic: user.isPublic !== false,
      followersCount: (user.followers || []).length,
      followingCount: (user.following || []).length,
      isFollowing,
      isSelf,
      publicPlaylists,
      createdAt: user.createdAt
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve profile: ' + err.message });
  }
});

// 2. Update Self Profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { displayName, avatarUrl, bio, favoriteGenres, isPublic } = req.body || {};
    const updates = {};

    if (typeof displayName === 'string') updates.displayName = displayName.trim().slice(0, 60);
    if (typeof avatarUrl === 'string') updates.avatarUrl = avatarUrl.trim();
    if (typeof bio === 'string') updates.bio = bio.trim().slice(0, 300);
    if (Array.isArray(favoriteGenres)) {
      updates.favoriteGenres = favoriteGenres.map(g => String(g).trim().slice(0, 30)).slice(0, 10);
    }
    if (typeof isPublic === 'boolean') updates.isPublic = isPublic;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { returnDocument: 'after' }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        favoriteGenres: user.favoriteGenres,
        isPublic: user.isPublic
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile: ' + err.message });
  }
});

// 2b. Upload Profile Avatar (local storage persistence)
router.post('/profile/avatar', authenticateToken, async (req, res) => {
  try {
    const { image } = req.body || {};
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Image data is required.' });
    }

    // Supported image formats
    const allowedMimeTypes = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };

    let mimeType = '';
    let base64Data = '';

    if (image.startsWith('data:')) {
      const parts = image.split(';base64,');
      if (parts.length !== 2) {
        return res.status(400).json({ error: 'Malformed base64 image data.' });
      }
      mimeType = parts[0].replace('data:', '').toLowerCase().trim();
      base64Data = parts[1];
    } else {
      return res.status(400).json({ error: 'Invalid image format. Expected a base64 data URI.' });
    }

    if (!allowedMimeTypes[mimeType]) {
      return res.status(400).json({ 
        error: `Unsupported image format (${mimeType}). Please upload a JPEG, PNG, or WebP image.` 
      });
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // 5MB max file size
    const MAX_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({ error: 'File size exceeds maximum allowed limit (5MB).' });
    }
    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Uploaded file is empty.' });
    }

    // Verify magic bytes
    let isValidMagic = false;
    // JPEG: FF D8 FF
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      isValidMagic = buffer.length > 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    else if (mimeType === 'image/png') {
      isValidMagic = buffer.length > 8 && 
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
        buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A;
    }
    // WebP: RIFF ... WEBP
    else if (mimeType === 'image/webp') {
      isValidMagic = buffer.length > 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP';
    }

    if (!isValidMagic) {
      return res.status(400).json({ error: 'Invalid or corrupted image content.' });
    }

    const ext = allowedMimeTypes[mimeType];
    const safeFilename = `avatar-${req.user._id}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = path.join(uploadsDir, safeFilename);

    await fs.promises.writeFile(filePath, buffer);
    const finalAvatarUrl = `/uploads/${safeFilename}`;

    // Clean up replaced image if previously stored in /uploads/
    const existingUser = await User.findById(req.user._id);
    if (existingUser && existingUser.avatarUrl && existingUser.avatarUrl.startsWith('/uploads/avatar-')) {
      const oldFilename = path.basename(existingUser.avatarUrl);
      const oldPath = path.join(uploadsDir, oldFilename);
      try {
        if (fs.existsSync(oldPath)) {
          await fs.promises.unlink(oldPath);
        }
      } catch (err) {
        console.warn('[Avatar Cleanup Notice]:', err.message);
      }
    }

    existingUser.avatarUrl = finalAvatarUrl;
    await existingUser.save();

    res.json({
      success: true,
      message: 'Profile photo updated successfully',
      avatarUrl: finalAvatarUrl,
      user: {
        id: existingUser._id,
        userId: existingUser._id,
        username: existingUser.username,
        displayName: existingUser.displayName || existingUser.username,
        avatarUrl: existingUser.avatarUrl,
        bio: existingUser.bio,
        favoriteGenres: existingUser.favoriteGenres,
        isPublic: existingUser.isPublic
      }
    });
  } catch (err) {
    console.error('[Profile Avatar Upload Error]:', err.message);
    res.status(500).json({ error: 'Failed to upload profile photo: ' + err.message });
  }
});

// 2c. Delete/Reset Profile Avatar
router.delete('/profile/avatar', authenticateToken, async (req, res) => {
  try {
    const existingUser = await User.findById(req.user._id);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (existingUser.avatarUrl && existingUser.avatarUrl.startsWith('/uploads/avatar-')) {
      const oldFilename = path.basename(existingUser.avatarUrl);
      const oldPath = path.join(uploadsDir, oldFilename);
      try {
        if (fs.existsSync(oldPath)) {
          await fs.promises.unlink(oldPath);
        }
      } catch (e) {}
    }

    existingUser.avatarUrl = '';
    await existingUser.save();

    res.json({
      success: true,
      message: 'Profile photo removed',
      avatarUrl: '',
      user: {
        id: existingUser._id,
        userId: existingUser._id,
        username: existingUser.username,
        displayName: existingUser.displayName || existingUser.username,
        avatarUrl: '',
        bio: existingUser.bio,
        favoriteGenres: existingUser.favoriteGenres,
        isPublic: existingUser.isPublic
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove avatar: ' + err.message });
  }
});

// 3. Follow User
router.post('/:id/follow', authenticateToken, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (req.user._id.toString() === targetId) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add to target's followers and current user's following
    await Promise.all([
      User.findByIdAndUpdate(targetId, { $addToSet: { followers: req.user._id } }),
      User.findByIdAndUpdate(req.user._id, { $addToSet: { following: targetId } })
    ]);

    res.json({ message: 'Followed successfully', targetId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to follow user: ' + err.message });
  }
});

// 4. Unfollow User
router.post('/:id/unfollow', authenticateToken, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    await Promise.all([
      User.findByIdAndUpdate(targetId, { $pull: { followers: req.user._id } }),
      User.findByIdAndUpdate(req.user._id, { $pull: { following: targetId } })
    ]);

    res.json({ message: 'Unfollowed successfully', targetId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unfollow user: ' + err.message });
  }
});

// 5. List Followers
router.get('/:id/followers', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await User.findById(id).populate({
      path: 'followers',
      select: 'username displayName avatarUrl isPublic'
    }).lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      followers: (user.followers || []).map(f => ({
        id: f._id,
        username: f.username,
        displayName: f.displayName || f.username,
        avatarUrl: f.avatarUrl || ''
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch followers: ' + err.message });
  }
});

// 6. List Following
router.get('/:id/following', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await User.findById(id).populate({
      path: 'following',
      select: 'username displayName avatarUrl isPublic'
    }).lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      following: (user.following || []).map(f => ({
        id: f._id,
        username: f.username,
        displayName: f.displayName || f.username,
        avatarUrl: f.avatarUrl || ''
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch following: ' + err.message });
  }
});

// 7. Collaborative Playlists: Generate Invite Token, Join, Manage Tracks & Collaborators
router.post('/playlist/:playlistId/invite', authenticateToken, async (req, res) => {
  try {
    const { playlistId } = req.params;
    const user = await User.findById(req.user._id);
    const playlist = (user.playlists || []).find(p => String(p.id || p._id) === String(playlistId));

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found in your library' });
    }

    // Generate stable invite token
    const inviteToken = Buffer.from(`${req.user._id}_${playlistId}_${Date.now()}`).toString('base64url');
    playlist.isCollaborative = true;
    playlist.collaboratorInviteToken = inviteToken;

    user.markModified('playlists');
    await user.save();

    res.json({
      message: 'Collaboration enabled',
      inviteToken,
      inviteUrl: `${req.headers.origin || ''}/playlist/${playlistId}?invite=${inviteToken}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate invite: ' + err.message });
  }
});

// Helper: Find playlist and check user's role (owner, editor, viewer, none)
async function findPlaylistAndRole(userId, playlistId) {
  // Check if caller is owner
  let owner = await User.findOne({ _id: userId, 'playlists.id': playlistId });
  if (!owner) {
    owner = await User.findOne({ _id: userId, 'playlists._id': playlistId });
  }
  if (owner) {
    const playlist = (owner.playlists || []).find(p => String(p.id || p._id) === String(playlistId));
    return { owner, playlist, role: 'owner' };
  }

  // Check if caller is an authorized collaborator on another user's playlist
  const collaboratorUser = await User.findOne({
    'playlists.collaborators.userId': userId,
    $or: [{ 'playlists.id': playlistId }, { 'playlists._id': playlistId }]
  });

  if (collaboratorUser) {
    const playlist = (collaboratorUser.playlists || []).find(p => String(p.id || p._id) === String(playlistId));
    if (playlist) {
      const collab = (playlist.collaborators || []).find(c => String(c.userId) === String(userId));
      return { owner: collaboratorUser, playlist, role: collab?.role || 'viewer' };
    }
  }

  return { owner: null, playlist: null, role: 'none' };
}

// Join Collaborative Playlist via invite token
router.post('/playlist/collaborate/join', authenticateToken, async (req, res) => {
  try {
    const { inviteToken } = req.body;
    if (!inviteToken || typeof inviteToken !== 'string') {
      return res.status(400).json({ error: 'Valid inviteToken is required' });
    }

    const owner = await User.findOne({ 'playlists.collaboratorInviteToken': inviteToken });
    if (!owner) {
      return res.status(404).json({ error: 'Invalid or expired collaboration invite token' });
    }

    const playlist = (owner.playlists || []).find(p => p.collaboratorInviteToken === inviteToken);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (String(owner._id) === String(req.user._id)) {
      return res.json({
        message: 'You are the owner of this playlist',
        playlistId: playlist.id || playlist._id,
        playlistName: playlist.name,
        role: 'owner'
      });
    }

    if (!Array.isArray(playlist.collaborators)) {
      playlist.collaborators = [];
    }

    const existingCollab = playlist.collaborators.find(c => String(c.userId) === String(req.user._id));
    if (!existingCollab) {
      playlist.collaborators.push({
        userId: req.user._id,
        username: req.user.username,
        displayName: req.user.displayName || req.user.username,
        role: 'editor',
        addedAt: new Date()
      });
      owner.markModified('playlists');
      await owner.save();
    }

    res.json({
      message: 'Successfully joined collaborative playlist',
      playlistId: playlist.id || playlist._id,
      playlistName: playlist.name,
      role: existingCollab?.role || 'editor'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join playlist: ' + err.message });
  }
});

// Add track to playlist (Owner or Editor)
router.post('/playlist/:playlistId/tracks', authenticateToken, async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { track } = req.body;
    if (!track || (!track.id && !track.videoId)) {
      return res.status(400).json({ error: 'Valid track object is required' });
    }

    const { owner, playlist, role } = await findPlaylistAndRole(req.user._id, playlistId);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found or you do not have permission' });
    }

    if (role !== 'owner' && role !== 'editor') {
      return res.status(403).json({ error: 'Insufficient permissions to add tracks to this playlist' });
    }

    if (!Array.isArray(playlist.songs)) {
      playlist.songs = [];
    }

    const trackId = track.id || track.videoId;
    const alreadyExists = playlist.songs.some(s => (s.id || s.videoId) === trackId);
    if (!alreadyExists) {
      playlist.songs.push({
        id: trackId,
        title: String(track.title || 'Untitled').slice(0, 150),
        channel: String(track.channel || track.artist || 'Unknown Artist').slice(0, 100),
        thumbnail: track.thumbnail || track.coverArt || '',
        addedBy: {
          userId: req.user._id,
          username: req.user.username
        },
        addedAt: new Date()
      });
      owner.markModified('playlists');
      await owner.save();
    }

    res.json({
      message: 'Track added to playlist',
      songsCount: playlist.songs.length,
      track: playlist.songs[playlist.songs.length - 1]
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add track: ' + err.message });
  }
});

// Remove track from playlist (Owner or Editor)
router.delete('/playlist/:playlistId/tracks/:trackId', authenticateToken, async (req, res) => {
  try {
    const { playlistId, trackId } = req.params;
    const { owner, playlist, role } = await findPlaylistAndRole(req.user._id, playlistId);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found or you do not have permission' });
    }

    if (role !== 'owner' && role !== 'editor') {
      return res.status(403).json({ error: 'Insufficient permissions to remove tracks from this playlist' });
    }

    if (Array.isArray(playlist.songs)) {
      playlist.songs = playlist.songs.filter(s => String(s.id || s.videoId) !== String(trackId));
      owner.markModified('playlists');
      await owner.save();
    }

    res.json({
      message: 'Track removed from playlist',
      songsCount: (playlist.songs || []).length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove track: ' + err.message });
  }
});

// Remove collaborator (Owner only)
router.delete('/playlist/:playlistId/collaborator/:targetUserId', authenticateToken, async (req, res) => {
  try {
    const { playlistId, targetUserId } = req.params;
    const owner = await User.findById(req.user._id);
    const playlist = (owner.playlists || []).find(p => String(p.id || p._id) === String(playlistId));

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found in your library or you are not the owner' });
    }

    if (Array.isArray(playlist.collaborators)) {
      playlist.collaborators = playlist.collaborators.filter(c => String(c.userId) !== String(targetUserId));
      owner.markModified('playlists');
      await owner.save();
    }

    res.json({
      message: 'Collaborator removed successfully',
      collaboratorsCount: (playlist.collaborators || []).length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove collaborator: ' + err.message });
  }
});

// Get Playlist details with caller's permission role
router.get('/playlist/:playlistId', authenticateToken, async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { owner, playlist, role } = await findPlaylistAndRole(req.user._id, playlistId);

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    res.json({
      playlist: {
        id: playlist.id || playlist._id,
        name: playlist.name,
        songs: playlist.songs || [],
        isPublic: Boolean(playlist.isPublic),
        isCollaborative: Boolean(playlist.isCollaborative),
        collaborators: playlist.collaborators || [],
        owner: {
          id: owner._id,
          username: owner.username,
          displayName: owner.displayName || owner.username
        }
      },
      userRole: role
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch playlist: ' + err.message });
  }
});

// 17. Get Authenticated User's Listening Insights & Recap
router.get('/listening-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const timezone = req.query.timezone || 'UTC';
    const forceRefresh = req.query.forceRefresh === 'true';

    const result = await listeningEventService.getListeningStats(userId, { timezone, forceRefresh });
    res.json(result);
  } catch (err) {
    console.error('[Listening Stats Route Error]:', err.message);
    res.status(500).json({ error: 'Failed to retrieve listening statistics: ' + err.message });
  }
});

export default router;
