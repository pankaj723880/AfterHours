import express from 'express';
import mongoose from 'mongoose';
import Activity from '../models/Activity.js';
import User from '../models/User.js';
import { authenticateToken, verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Helper: Sanitize public activity item
const sanitizeActivity = (act) => ({
  id: act._id.toString(),
  type: act.type,
  createdAt: act.createdAt,
  user: {
    username: act.username,
    displayName: act.displayName || act.username,
    avatarUrl: act.avatarUrl || ''
  },
  track: act.track ? {
    id: act.track.id || act.track.videoId,
    videoId: act.track.videoId || act.track.id,
    title: act.track.title,
    channel: act.track.channel || act.track.artist,
    thumbnail: act.track.thumbnail,
    duration: act.track.duration
  } : null,
  playlist: act.playlist ? {
    id: act.playlist.id,
    name: act.playlist.name,
    songsCount: act.playlist.songsCount
  } : null
});

// 1. GET /api/activity/feed - Public & opt-in activity feed
router.get('/feed', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const before = req.query.before; // ISO date string cursor

    // Build query: only public activities
    const query = { isPublic: true };
    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    // Fetch activities
    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Verify current user settings for activity authors (in case user changed to private)
    const authorUsernames = [...new Set(activities.map(a => a.username))];
    const activeUsers = await User.find({
      username: { $in: authorUsernames },
      status: 'active',
      isPublic: true,
      shareListeningActivity: true
    }).select('username').lean();

    const allowedUsernames = new Set(activeUsers.map(u => u.username));

    const sanitized = activities
      .filter(a => allowedUsernames.has(a.username))
      .map(sanitizeActivity);

    const nextCursor = activities.length === limit ? activities[activities.length - 1].createdAt : null;

    res.json({
      items: sanitized,
      nextCursor,
      hasMore: activities.length === limit
    });
  } catch (err) {
    console.error('[Activity Feed Error]:', err.message);
    res.status(500).json({ error: 'Failed to load activity feed' });
  }
});

// 2. POST /api/activity/log - Log a user activity (Authenticated)
router.post('/log', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { type, track, playlist } = req.body;

    if (!type || !['listen', 'like', 'playlist_create', 'playlist_update'].includes(type)) {
      return res.status(400).json({ error: 'Valid activity type is required' });
    }

    const user = await User.findById(userId).lean();
    if (!user || user.status !== 'active') {
      return res.status(403).json({ error: 'Account inactive or not found' });
    }

    // Privacy rule: Only log public activities if user has opted in to sharing
    if (!user.shareListeningActivity || !user.isPublic) {
      return res.json({ logged: false, reason: 'Activity sharing opted out' });
    }

    const trackId = track ? (track.id || track.videoId) : null;

    // Deduplication rule: If the same track/action occurred within the last 5 minutes, update timestamp
    if (trackId && (type === 'listen' || type === 'like')) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const existing = await Activity.findOne({
        userId,
        type,
        'track.id': trackId,
        createdAt: { $gte: fiveMinutesAgo }
      });

      if (existing) {
        existing.updatedAt = new Date();
        await existing.save();
        return res.json({ logged: true, deduplicated: true, id: existing._id });
      }
    }

    const activity = new Activity({
      userId: user._id,
      username: user.username,
      displayName: user.displayName || user.username,
      avatarUrl: user.avatarUrl || '',
      type,
      track: track ? {
        id: trackId,
        videoId: track.videoId || trackId,
        title: (track.title || '').slice(0, 150),
        channel: (track.channel || track.artist || '').slice(0, 100),
        artist: (track.artist || track.channel || '').slice(0, 100),
        thumbnail: track.thumbnail || '',
        duration: track.duration || ''
      } : null,
      playlist: playlist ? {
        id: playlist.id || playlist._id,
        name: (playlist.name || '').slice(0, 100),
        songsCount: playlist.songsCount || (playlist.songs ? playlist.songs.length : 0)
      } : null,
      isPublic: true
    });

    await activity.save();
    res.status(201).json({ logged: true, id: activity._id });
  } catch (err) {
    console.error('[Activity Log Error]:', err.message);
    res.status(500).json({ error: 'Failed to record activity' });
  }
});

// 3. PATCH /api/activity/privacy - Toggle user activity sharing setting
router.patch('/privacy', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { shareListeningActivity, isPublic } = req.body;

    const updates = {};
    if (typeof shareListeningActivity === 'boolean') {
      updates.shareListeningActivity = shareListeningActivity;
    }
    if (typeof isPublic === 'boolean') {
      updates.isPublic = isPublic;
    }

    const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true })
      .select('username shareListeningActivity isPublic')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If opted out of sharing, update user's past activities to non-public
    if (updates.shareListeningActivity === false || updates.isPublic === false) {
      await Activity.updateMany({ userId }, { $set: { isPublic: false } });
    } else if (updates.shareListeningActivity === true && (updates.isPublic !== false)) {
      await Activity.updateMany({ userId }, { $set: { isPublic: true } });
    }

    res.json({
      message: 'Privacy settings updated successfully',
      shareListeningActivity: user.shareListeningActivity,
      isPublic: user.isPublic
    });
  } catch (err) {
    console.error('[Privacy Update Error]:', err.message);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

// 4. DELETE /api/activity/:id - Remove or hide an activity item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const activity = await Activity.findById(req.params.id);

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Only the author or an admin can delete
    if (activity.userId.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this activity' });
    }

    await Activity.findByIdAndDelete(req.params.id);
    res.json({ message: 'Activity removed successfully' });
  } catch (err) {
    console.error('[Activity Delete Error]:', err.message);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

export default router;
