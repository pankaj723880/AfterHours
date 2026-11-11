import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Activity from '../models/Activity.js';
import ApiKey from '../models/ApiKeyConfig.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { metricsService } from '../services/metrics.js';
import { liveUsersService } from '../services/liveUsersService.js';
import { ADMIN_MANAGED_ENTITIES, EXCLUDED_INTERNAL_ENTITIES } from '../config/adminEntityRegistry.js';
import { executeGeminiOperation, sanitizeLogMessage, invalidateGeminiKeyCache } from '../services/geminiKeyManager.js';

const router = express.Router();

// Helper to sanitize IP
const getClientIp = (req) => {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
};

// 1. Live Metrics Snapshot (Admin only)
router.get('/metrics', authenticateToken, requireAdmin, (req, res) => {
  try {
    const snapshot = metricsService.getSnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve live metrics: ' + err.message });
  }
});

// Centralized Admin Entity Registry metadata endpoint
router.get('/registry', authenticateToken, requireAdmin, (req, res) => {
  try {
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      entities: ADMIN_MANAGED_ENTITIES,
      excludedInternalEntities: EXCLUDED_INTERNAL_ENTITIES
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve entity registry: ' + err.message });
  }
});

// 2. Health & Diagnostics (Admin only)
router.get('/health', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const mem = process.memoryUsage();
    let dbPingMs = -1;
    let dbStatus = 'disconnected';

    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const pingStart = process.hrtime.bigint();
      try {
        await mongoose.connection.db.admin().ping();
        dbPingMs = Math.round(Number(process.hrtime.bigint() - pingStart) / 1e6);
        dbStatus = 'connected';
      } catch (e) {
        dbStatus = 'error: ' + e.message;
      }
    }

    const snapshot = metricsService.getSnapshot();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      server: {
        uptimeSeconds: Math.floor(process.uptime()),
        processStartTimeIso: snapshot.processStartTimeIso,
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: {
          heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
          rssMB: Math.round(mem.rss / 1024 / 1024)
        }
      },
      database: {
        status: dbStatus,
        readyState: mongoose.connection.readyState,
        pingLatencyMs: dbPingMs
      },
      sockets: {
        activeVisitors: snapshot.activeVisitors,
        activeAuthenticatedUsers: snapshot.activeAuthenticatedUsers,
        visitorBreakdown: snapshot.visitorBreakdown
      },
      requestsBreakdown: snapshot.requestsBreakdown,
      latency: {
        avgLatencyMs: snapshot.avgLatencyMs,
        p95LatencyMs: snapshot.p95LatencyMs,
        p50LatencyMs: snapshot.p50LatencyMs
      },
      youtube: snapshot.youtubeStats,
      recentErrorsCount: snapshot.recentErrors.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Health diagnostics failed: ' + err.message });
  }
});

// Live Users Display Configuration (Admin only)
const handleGetLiveUsersConfig = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const config = liveUsersService.getAdminConfig();
    return res.json(config);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve live users config: ' + err.message });
  }
};

const handleSaveLiveUsersConfig = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { mode, minUsers, maxUsers } = req.body;
    const adminUsername = req.user?.username || 'admin';

    const previousConfig = liveUsersService.getAdminConfig();
    const updated = await liveUsersService.updateConfig({
      mode,
      minUsers,
      maxUsers,
      updatedBy: adminUsername
    });

    // Create Audit Log entry
    try {
      await AuditLog.create({
        action: 'UPDATE_LIVE_USERS_CONFIG',
        adminId: req.user._id,
        adminUsername,
        details: `Updated Live Users display mode to "${mode}" (Range: ${updated.minUsers} - ${updated.maxUsers})`,
        metadata: {
          previous: previousConfig,
          updated
        },
        ip: getClientIp(req)
      });
    } catch (auditErr) {
      console.warn('[AdminRoutes] Audit log notice:', auditErr.message);
    }

    return res.json({
      success: true,
      message: `Live Users display set to ${mode === 'real' ? 'Real Live Users' : 'Manual Display Range'}`,
      config: updated
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

router.get('/live-users-config', authenticateToken, requireAdmin, handleGetLiveUsersConfig);
router.put('/live-users-config', authenticateToken, requireAdmin, handleSaveLiveUsersConfig);
router.post('/live-users-config', authenticateToken, requireAdmin, handleSaveLiveUsersConfig);

// 3. List Users with Server-Side Pagination, Filtering, & Search
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const query = {};

    // Search filter (username / email)
    if (req.query.search && req.query.search.trim()) {
      const cleanSearch = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.username = { $regex: cleanSearch, $options: 'i' };
    }

    // Role filter
    if (req.query.role && ['user', 'admin'].includes(req.query.role)) {
      query.role = req.query.role;
    }

    // Status filter
    if (req.query.status && ['active', 'suspended', 'deactivated'].includes(req.query.status)) {
      query.status = req.query.status;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query)
    ]);

    const formattedUsers = users.map(u => ({
      id: u._id.toString(),
      _id: u._id.toString(),
      username: u.username,
      role: u.role || 'user',
      status: u.status || 'active',
      lastLogin: u.lastLogin || u.updatedAt || u.createdAt,
      createdAt: u.createdAt,
      stats: {
        likedSongsCount: (u.likedSongs || []).length,
        historyCount: (u.history || []).length,
        playlistsCount: (u.playlists || []).length
      }
    }));

    res.json({
      users: formattedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list users: ' + err.message });
  }
});

// 4. Get User Details by ID
router.get('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Recent audit logs concerning this user
    const userAuditLogs = await AuditLog.find({ targetId: req.params.id })
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();

    res.json({
      id: user._id.toString(),
      username: user.username,
      displayName: user.displayName || '',
      avatarUrl: user.avatarUrl || '',
      bio: user.bio || '',
      isPublic: user.isPublic !== undefined ? user.isPublic : true,
      shareListeningActivity: Boolean(user.shareListeningActivity),
      favoriteGenres: user.favoriteGenres || [],
      role: user.role || 'user',
      status: user.status || 'active',
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      stats: {
        likedSongsCount: (user.likedSongs || []).length,
        historyCount: (user.history || []).length,
        playlistsCount: (user.playlists || []).length
      },
      playlists: (user.playlists || []).map(p => ({
        id: p._id || p.id,
        name: p.name || 'Untitled Playlist',
        tracksCount: (p.tracks || p.songs || []).length
      })),
      recentLikedSample: (user.likedSongs || []).slice(0, 5),
      recentHistorySample: (user.history || []).slice(0, 5),
      auditHistory: userAuditLogs
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve user: ' + err.message });
  }
});

// 4b. Update User Profile (Admin direct management)
router.patch('/users/:id/profile', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { displayName, avatarUrl, bio, isPublic, shareListeningActivity, favoriteGenres } = req.body;
    const updates = {};
    const changes = {};

    if (displayName !== undefined) {
      const cleanName = String(displayName).trim().slice(0, 60);
      updates.displayName = cleanName;
      changes.displayName = { from: targetUser.displayName, to: cleanName };
    }

    if (avatarUrl !== undefined) {
      const cleanAvatar = String(avatarUrl).trim().slice(0, 500);
      updates.avatarUrl = cleanAvatar;
      changes.avatarUrl = { from: targetUser.avatarUrl, to: cleanAvatar };
    }

    if (bio !== undefined) {
      const cleanBio = String(bio).trim().slice(0, 300);
      updates.bio = cleanBio;
      changes.bio = { from: targetUser.bio, to: cleanBio };
    }

    if (typeof isPublic === 'boolean') {
      updates.isPublic = isPublic;
      changes.isPublic = { from: targetUser.isPublic, to: isPublic };
    }

    if (typeof shareListeningActivity === 'boolean') {
      updates.shareListeningActivity = shareListeningActivity;
      changes.shareListeningActivity = { from: targetUser.shareListeningActivity, to: shareListeningActivity };
    }

    if (Array.isArray(favoriteGenres)) {
      updates.favoriteGenres = favoriteGenres.map(g => String(g).trim()).filter(Boolean).slice(0, 15);
      changes.favoriteGenres = { count: updates.favoriteGenres.length };
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid profile fields provided for update' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      targetUser._id,
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User could not be found to apply profile update' });
    }

    // Cascade privacy updates to Activity collection if privacy flags changed
    if (updates.isPublic !== undefined || updates.shareListeningActivity !== undefined) {
      const makePublic = (updatedUser.isPublic && updatedUser.shareListeningActivity);
      await Activity.updateMany(
        { userId: updatedUser._id },
        { $set: { isPublic: makePublic, displayName: updatedUser.displayName, avatarUrl: updatedUser.avatarUrl } }
      ).catch(() => {});
    } else if (updates.displayName !== undefined || updates.avatarUrl !== undefined) {
      await Activity.updateMany(
        { userId: updatedUser._id },
        { $set: { displayName: updatedUser.displayName, avatarUrl: updatedUser.avatarUrl } }
      ).catch(() => {});
    }

    try {
      await AuditLog.create({
        adminId: req.user._id.toString(),
        adminUsername: req.user.username,
        action: 'USER_PROFILE_UPDATE',
        targetId: updatedUser._id.toString(),
        targetUsername: updatedUser.username,
        details: changes,
        ip: getClientIp(req),
        status: 'SUCCESS'
      });
    } catch (auditErr) {
      console.warn('[AuditLog Warning]:', auditErr.message);
    }

    res.json({
      message: 'User profile updated successfully',
      user: {
        id: updatedUser._id.toString(),
        _id: updatedUser._id.toString(),
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        avatarUrl: updatedUser.avatarUrl,
        bio: updatedUser.bio,
        isPublic: updatedUser.isPublic,
        shareListeningActivity: updatedUser.shareListeningActivity,
        favoriteGenres: updatedUser.favoriteGenres
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user profile: ' + err.message });
  }
});

// 5. Update User Role / Status (with Safeguards)
router.patch('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { role, status } = req.body;
    const updates = {};
    const changes = {};

    // Validate role
    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' });
      }

      // Safeguard: Check if attempting to demote an admin
      if (targetUser.role === 'admin' && role !== 'admin') {
        const activeAdminsCount = await User.countDocuments({
          role: 'admin',
          status: 'active',
          _id: { $ne: targetUser._id }
        });

        if (activeAdminsCount === 0) {
          return res.status(400).json({
            error: 'Action prohibited: Cannot demote the last remaining active administrator.'
          });
        }
      }

      updates.role = role;
      changes.role = { from: targetUser.role, to: role };
    }

    // Validate status
    if (status !== undefined) {
      if (!['active', 'suspended', 'deactivated'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be "active", "suspended", or "deactivated"' });
      }

      // Safeguard: Check if suspending/deactivating the last active admin
      if (targetUser.role === 'admin' && status !== 'active') {
        const activeAdminsCount = await User.countDocuments({
          role: 'admin',
          status: 'active',
          _id: { $ne: targetUser._id }
        });

        if (activeAdminsCount === 0) {
          return res.status(400).json({
            error: 'Action prohibited: Cannot deactivate or suspend the last remaining active administrator.'
          });
        }
      }

      updates.status = status;
      changes.status = { from: targetUser.status, to: status };
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    // Atomic update in MongoDB to ensure persistence without whole-document validation failures
    const updatedUser = await User.findByIdAndUpdate(
      targetUser._id,
      { $set: updates },
      { returnDocument: 'after', runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User could not be found to apply update' });
    }

    // Append to AuditLog safely (do not block update response if audit logging fails)
    try {
      await AuditLog.create({
        adminId: req.user._id.toString(),
        adminUsername: req.user.username,
        action: 'USER_UPDATE',
        targetId: updatedUser._id.toString(),
        targetUsername: updatedUser.username,
        details: changes,
        ip: getClientIp(req),
        status: 'SUCCESS'
      });
    } catch (auditErr) {
      console.warn('[AuditLog Warning]:', auditErr.message);
    }

    // Real-time synchronization of role & status change across all connected clients & sockets
    try {
      const io = req.app.get('io');
      const activeMap = req.app.get('activeUserSocketMap');
      if (io) {
        const targetIdStr = updatedUser._id.toString();

        // 1. Broadcast global role change event for all open tabs/sessions of this user
        io.emit('user_role_changed', {
          userId: targetIdStr,
          role: updatedUser.role,
          status: updatedUser.status
        });

        // 2. Iterate connected sockets to immediately update in-memory session and room memberships
        if (io.sockets?.sockets) {
          for (const [sId, socket] of io.sockets.sockets) {
            const socketUserId = socket.user?._id?.toString() || 
                                 socket.user?.id || 
                                 socket.user?.userId || 
                                 activeMap?.get?.(sId);

            if (socketUserId && socketUserId.toString() === targetIdStr) {
              if (socket.user) {
                socket.user.role = updatedUser.role;
                socket.user.status = updatedUser.status;
              }

              if (updatedUser.role !== 'admin') {
                socket.leave('admin_room');
                socket.emit('admin_access_revoked', {
                  message: 'Your administrator privileges have been revoked by an administrator.'
                });
              } else if (updatedUser.role === 'admin') {
                socket.join('admin_room');
                socket.emit('admin_access_granted', {
                  message: 'You have been granted administrator privileges.'
                });
              }

              if (updatedUser.status === 'suspended' || updatedUser.status === 'deactivated') {
                socket.emit('user_status_changed', {
                  status: updatedUser.status,
                  message: `Your account has been ${updatedUser.status}.`
                });
              }
            }
          }
        }
      }
    } catch (socketSyncErr) {
      console.warn('[AdminRoutes] Socket role sync warning:', socketSyncErr.message);
    }

    res.json({
      message: 'User updated successfully',
      user: {
        id: updatedUser._id.toString(),
        _id: updatedUser._id.toString(),
        username: updatedUser.username,
        role: updatedUser.role,
        status: updatedUser.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user: ' + err.message });
  }
});

// 6. Delete / Deactivate User (with Safeguards)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Safeguard: Cannot delete the last active administrator
    if (targetUser.role === 'admin') {
      const activeAdminsCount = await User.countDocuments({
        role: 'admin',
        status: 'active',
        _id: { $ne: targetUser._id }
      });

      if (activeAdminsCount === 0) {
        return res.status(400).json({
          error: 'Action prohibited: Cannot delete or deactivate the last remaining active administrator.'
        });
      }
    }

    // Soft deletion (deactivation) preserves data integrity & audit references
    targetUser.status = 'deactivated';
    await targetUser.save();

    // Record in AuditLog
    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'USER_DEACTIVATE',
      targetId: targetUser._id.toString(),
      targetUsername: targetUser.username,
      details: { reason: 'Deactivated via admin dashboard' },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    // Real-time revocation & disconnect
    try {
      const io = req.app.get('io');
      const activeMap = req.app.get('activeUserSocketMap');
      if (io) {
        const targetIdStr = targetUser._id.toString();
        io.emit('user_role_changed', {
          userId: targetIdStr,
          role: targetUser.role,
          status: 'deactivated'
        });
        if (io.sockets?.sockets) {
          for (const [sId, socket] of io.sockets.sockets) {
            const socketUserId = socket.user?._id?.toString() || socket.user?.id || activeMap?.get?.(sId);
            if (socketUserId && socketUserId.toString() === targetIdStr) {
              socket.leave('admin_room');
              socket.emit('admin_access_revoked', { message: 'Your account has been deactivated.' });
            }
          }
        }
      }
    } catch (e) {}

    res.json({
      message: 'User successfully deactivated',
      userId: targetUser._id.toString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate user: ' + err.message });
  }
});

// 6b. Hard / Permanent User Deletion (with Cascade and Strict Safeguards)
router.delete('/users/:id/permanent', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const currentAdminId = (req.user._id || req.user.id || req.user.userId)?.toString();
    if (currentAdminId && currentAdminId === req.params.id) {
      return res.status(400).json({
        error: 'Action prohibited: Administrators cannot permanently delete their own account.'
      });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Safeguard: Cannot permanently delete the last active administrator
    if (targetUser.role === 'admin') {
      const activeAdminsCount = await User.countDocuments({
        role: 'admin',
        status: 'active',
        _id: { $ne: targetUser._id }
      });

      if (activeAdminsCount === 0) {
        return res.status(400).json({
          error: 'Action prohibited: Cannot delete the last remaining active administrator.'
        });
      }
    }

    // Cascade: Clean up user activities
    const deletedActivities = await Activity.deleteMany({ userId: targetUser._id });

    // Hard delete user record
    await User.findByIdAndDelete(targetUser._id);

    // Record in AuditLog
    await AuditLog.create({
      adminId: req.user._id ? req.user._id.toString() : currentAdminId,
      adminUsername: req.user.username,
      action: 'USER_DELETE_PERMANENT',
      targetId: targetUser._id.toString(),
      targetUsername: targetUser.username,
      details: {
        reason: 'Hard deleted via admin dashboard',
        cascadedActivitiesRemoved: deletedActivities.deletedCount || 0
      },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      message: 'User permanently deleted and associated data cleaned up',
      userId: targetUser._id.toString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to permanently delete user: ' + err.message });
  }
});

// 7. Audit Logs (Paginated, Append-Only)
router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.action && req.query.action.trim()) {
      query.action = req.query.action.trim();
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    res.json({
      logs: logs.map(l => ({
        id: l._id.toString(),
        adminUsername: l.adminUsername,
        action: l.action,
        targetUsername: l.targetUsername || l.targetId,
        details: l.details,
        ip: l.ip,
        status: l.status,
        timestamp: l.timestamp
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve audit logs: ' + err.message });
  }
});

// 8. Music Analytics (Admin only)
router.get('/music-analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = metricsService.getSnapshot();

    // Total counts from database
    const [totalUsers, activeUsersCount] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' })
    ]);

    // Aggregate library totals safely
    const libraryTotals = await User.aggregate([
      {
        $project: {
          likedCount: {
            $cond: {
              if: { $isArray: '$likedSongs' },
              then: { $size: '$likedSongs' },
              else: 0
            }
          },
          playlistsCount: {
            $cond: {
              if: { $isArray: '$playlists' },
              then: { $size: '$playlists' },
              else: 0
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalLikedSongs: { $sum: '$likedCount' },
          totalPlaylists: { $sum: '$playlistsCount' }
        }
      }
    ]).option({ maxTimeMS: 4000 });

    const libStats = libraryTotals[0] || { totalLikedSongs: 0, totalPlaylists: 0 };

    res.json({
      timestamp: new Date().toISOString(),
      summary: {
        totalRegisteredUsers: totalUsers,
        activeUsersCount,
        totalLikedSongs: libStats.totalLikedSongs,
        totalPlaylists: libStats.totalPlaylists,
        totalPlays: snapshot.musicStats.totalPlays,
        playAttempts: snapshot.musicStats.playAttempts,
        playErrors: snapshot.musicStats.playErrors
      },
      topSearches: snapshot.musicStats.topSearches
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve music analytics: ' + err.message });
  }
});

// 9. Failed-Login Security Monitoring (Admin only)
router.get('/security/failed-logins', authenticateToken, requireAdmin, (req, res) => {
  try {
    const failedLogins = metricsService.getFailedLogins();
    res.json({
      count: failedLogins.length,
      failedLogins
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve login security events: ' + err.message });
  }
});

// 10. Public / Client Telemetry Endpoint for Observability
router.post('/telemetry/event', (req, res) => {
  try {
    const { type, query, trackId, title } = req.body || {};
    if (type) {
      metricsService.recordMusicEvent({
        type: String(type).slice(0, 30),
        query: query ? String(query).slice(0, 100) : undefined,
        trackId: trackId ? String(trackId).slice(0, 50) : undefined,
        title: title ? String(title).slice(0, 100) : undefined
      });
    }
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: 'Invalid telemetry event' });
  }
});

// 11. Activity Feed Moderation List (Admin only)
router.get('/activities', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.type && ['listen', 'like', 'playlist_create', 'playlist_update'].includes(req.query.type)) {
      query.type = req.query.type;
    }
    if (req.query.username && req.query.username.trim()) {
      const cleanUsername = req.query.username.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.username = { $regex: cleanUsername, $options: 'i' };
    }
    if (req.query.search && req.query.search.trim()) {
      const cleanSearch = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { 'track.title': { $regex: cleanSearch, $options: 'i' } },
        { 'track.artist': { $regex: cleanSearch, $options: 'i' } },
        { 'playlist.name': { $regex: cleanSearch, $options: 'i' } },
        { username: { $regex: cleanSearch, $options: 'i' } }
      ];
    }

    const [activities, total] = await Promise.all([
      Activity.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Activity.countDocuments(query)
    ]);

    res.json({
      success: true,
      activities: activities.map(a => ({
        id: a._id.toString(),
        userId: a.userId ? a.userId.toString() : null,
        username: a.username,
        displayName: a.displayName || a.username,
        avatarUrl: a.avatarUrl || '',
        type: a.type,
        track: a.track,
        playlist: a.playlist,
        isPublic: a.isPublic,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve activities: ' + err.message });
  }
});

// 12. Delete / Moderate User Activity (Admin only)
router.delete('/activities/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid activity ID format' });
    }

    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    await Activity.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      adminId: (req.user._id || req.user.id || req.user.userId)?.toString(),
      adminUsername: req.user.username,
      action: 'ACTIVITY_MODERATE_DELETE',
      targetId: activity._id.toString(),
      targetUsername: activity.username,
      details: {
        activityType: activity.type,
        trackTitle: activity.track?.title || activity.playlist?.name || 'N/A'
      },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      message: 'Activity removed successfully',
      id: req.params.id
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete activity: ' + err.message });
  }
});

// Helper to mask key: e.g. "AIzaSyD...4Xk9"
const maskKey = (key = '') => {
  if (!key || typeof key !== 'string') return '';
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
};

// ==========================================
// 13. Dynamic Multi-Key Pool Management
// ==========================================

// GET /api/admin/keys - List all keys (masked for security)
router.get('/keys', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const keys = await ApiKey.find().sort({ createdAt: -1 }).lean();
    const formatted = keys.map(k => ({
      ...k,
      maskedKey: maskKey(k.key),
      rawKeyLength: k.key?.length || 0
    }));
    res.json({ success: true, keys: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve API keys: ' + err.message });
  }
});

// POST /api/admin/keys - Add single or bulk keys
router.post('/keys', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { service, rawKeys, key, label } = req.body;
    const targetService = (service || '').toLowerCase().trim();

    if (!['youtube', 'gemini'].includes(targetService)) {
      return res.status(400).json({ error: 'Service must be either "youtube" or "gemini"' });
    }

    // Support single key or rawKeys containing multiline/comma-separated keys
    const inputString = rawKeys || key || '';
    const parsedKeys = inputString
      .split(/[\r\n,]+/)
      .map(k => k.trim())
      .filter(k => k && k.length > 5);

    if (parsedKeys.length === 0) {
      return res.status(400).json({ error: 'No valid API key strings provided' });
    }

    let addedCount = 0;
    let duplicateCount = 0;
    const addedKeys = [];

    for (const singleKey of parsedKeys) {
      const exists = await ApiKey.findOne({ service: targetService, key: singleKey });
      if (exists) {
        duplicateCount++;
        continue;
      }

      const newKey = await ApiKey.create({
        service: targetService,
        key: singleKey,
        label: label ? label.trim() : '',
        status: 'Active',
        isExhausted: false,
        failureCount: 0,
        createdAt: new Date(),
        lastUsedAt: new Date()
      });

      addedKeys.push({
        _id: newKey._id,
        service: newKey.service,
        maskedKey: maskKey(newKey.key),
        label: newKey.label,
        status: newKey.status,
        isExhausted: newKey.isExhausted
      });
      addedCount++;
    }

    if (targetService === 'gemini') {
      invalidateGeminiKeyCache();
    }

    await AuditLog.create({
      adminId: (req.user._id || req.user.id || req.user.userId)?.toString(),
      adminUsername: req.user.username,
      action: 'API_KEYS_POOL_ADD',
      details: { service: targetService, addedCount, duplicateCount },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      message: `Successfully added ${addedCount} key(s) (${duplicateCount} duplicate(s) skipped)`,
      addedCount,
      duplicateCount,
      keys: addedKeys
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add API keys: ' + err.message });
  }
});

// PATCH /api/admin/keys/:id/toggle - Toggle exhausted / active status
router.patch('/keys/:id/toggle', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const keyDoc = await ApiKey.findById(req.params.id);
    if (!keyDoc) {
      return res.status(404).json({ error: 'API key not found' });
    }

    keyDoc.isExhausted = !keyDoc.isExhausted;
    keyDoc.status = keyDoc.isExhausted ? 'Exhausted' : 'Active';
    if (!keyDoc.isExhausted) {
      keyDoc.failureCount = 0;
    }
    await keyDoc.save();

    if (keyDoc.service && keyDoc.service.toLowerCase() === 'gemini') {
      invalidateGeminiKeyCache();
    }

    res.json({
      success: true,
      message: `Key marked as ${keyDoc.isExhausted ? 'Exhausted' : 'Active'}`,
      key: {
        _id: keyDoc._id,
        service: keyDoc.service,
        maskedKey: maskKey(keyDoc.key),
        status: keyDoc.status,
        isExhausted: keyDoc.isExhausted,
        failureCount: keyDoc.failureCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update key status: ' + err.message });
  }
});

// POST /api/admin/keys/reset-all - Reset all exhausted keys back to active
router.post('/keys/reset-all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await ApiKey.updateMany(
      { $or: [{ isExhausted: true }, { status: 'Exhausted' }] },
      { $set: { isExhausted: false, status: 'Active', failureCount: 0 } }
    );

    invalidateGeminiKeyCache();

    await AuditLog.create({
      adminId: (req.user._id || req.user.id || req.user.userId)?.toString(),
      adminUsername: req.user.username,
      action: 'API_KEYS_POOL_RESET_ALL',
      details: { modifiedCount: result.modifiedCount },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      message: `Successfully reset ${result.modifiedCount} exhausted key(s) to Active`,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset keys: ' + err.message });
  }
});

// DELETE /api/admin/keys/:id - Remove key from pool
router.delete('/keys/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const keyDoc = await ApiKey.findById(req.params.id);
    if (!keyDoc) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await ApiKey.findByIdAndDelete(req.params.id);

    if (keyDoc.service && keyDoc.service.toLowerCase() === 'gemini') {
      invalidateGeminiKeyCache();
    }

    await AuditLog.create({
      adminId: (req.user._id || req.user.id || req.user.userId)?.toString(),
      adminUsername: req.user.username,
      action: 'API_KEYS_POOL_DELETE',
      targetId: req.params.id,
      details: { service: keyDoc.service, label: keyDoc.label },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      message: 'API key deleted from pool successfully',
      id: req.params.id
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete API key: ' + err.message });
  }
});

// ==========================================
// 14. AI In-App Live Code Patcher & Rollback
// ==========================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const FRONTEND_SRC = path.resolve(PROJECT_ROOT, 'frontend', 'src');
const BACKUPS_DIR = path.resolve(PROJECT_ROOT, '.snapshots');
const PATCH_LOG_FILE = path.resolve(BACKUPS_DIR, 'patch_history.json');

// Ensure backups folder and metadata log file exist
const ensureBackupEnvironment = async () => {
  await fs.promises.mkdir(BACKUPS_DIR, { recursive: true });
  try {
    await fs.promises.access(PATCH_LOG_FILE);
  } catch {
    await fs.promises.writeFile(PATCH_LOG_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
};

const readPatchLogs = async () => {
  await ensureBackupEnvironment();
  try {
    const raw = await fs.promises.readFile(PATCH_LOG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const savePatchLogs = async (logs) => {
  await ensureBackupEnvironment();
  await fs.promises.writeFile(PATCH_LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
};

/**
 * Validates and resolves the target file path to an absolute disk path under frontend/src/.
 * Removes strict whitelisting and accepts relative paths like:
 *   - src/App.jsx
 *   - frontend/src/App.jsx
 *   - components/Admin/AdminDashboard.jsx
 *   - /components/Navigation/LoopraFooter.jsx
 */
const resolveSafeTargetFilePath = (targetPath = '') => {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Target file path is required');
  }

  // Normalize path separators and strip leading slashes and prefixes
  let normalizedInput = targetPath.trim().replace(/\\/g, '/');
  normalizedInput = normalizedInput.replace(/^(?:\/+|frontend\/src\/+|src\/+)/i, '');

  const absoluteTarget = path.resolve(FRONTEND_SRC, normalizedInput);

  // Path boundary check to prevent directory traversal outside frontend/src/
  const relativeToSrc = path.relative(FRONTEND_SRC, absoluteTarget);
  if (relativeToSrc.startsWith('..') || path.isAbsolute(relativeToSrc)) {
    throw new Error('Access denied: Operations are restricted strictly within frontend/src/');
  }

  return {
    absoluteTarget,
    relativeTarget: `src/${relativeToSrc.replace(/\\/g, '/')}`
  };
};

/**
 * Strips markdown code fences or backticks generated by LLMs.
 */
const stripMarkdownBackticks = (raw = '') => {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.trim();

  // Strip leading code fences e.g. ```javascript, ```jsx, ```
  cleaned = cleaned.replace(/^```(?:[a-zA-Z0-9_\-+]*\s*\n)?/i, '');
  // Strip trailing code fence
  cleaned = cleaned.replace(/\n?```\s*$/i, '');

  return cleaned.trim();
};

/**
 * Line diff generator: generates structured diff entries for UI consumption
 */
const generateStructuredDiff = (original = '', modified = '') => {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  const diff = [];
  const maxLines = Math.max(origLines.length, modLines.length);
  let changeCount = 0;

  for (let i = 0; i < maxLines && changeCount < 200; i++) {
    const o = origLines[i];
    const m = modLines[i];
    if (o !== m) {
      if (o !== undefined) {
        diff.push({ type: 'delete', lineNum: i + 1, content: o });
        changeCount++;
      }
      if (m !== undefined) {
        diff.push({ type: 'insert', lineNum: i + 1, content: m });
        changeCount++;
      }
    }
  }

  return diff;
};

/**
 * Searches and replaces blocks if LLM returned <<<<<<< SEARCH / ======= / >>>>>>> blocks.
 */
const applySearchReplaceBlocks = (originalCode, patchOutput) => {
  if (patchOutput.includes('<<<<<<< SEARCH') && patchOutput.includes('=======')) {
    const blocks = patchOutput.split('<<<<<<< SEARCH');
    let patched = originalCode;
    for (let i = 1; i < blocks.length; i++) {
      const parts = blocks[i].split('=======');
      if (parts.length >= 2) {
        const searchPart = parts[0].replace(/^\r?\n/, '').replace(/\r?\n$/, '');
        const replacePart = parts[1].split('>>>>>>>')[0].replace(/^\r?\n/, '').replace(/\r?\n$/, '');
        if (searchPart && patched.includes(searchPart)) {
          patched = patched.replace(searchPart, replacePart);
        }
      }
    }
    return patched;
  }
  return patchOutput;
};

/**
 * Recursively scans frontend/src to gather all source file paths (.jsx, .js, .css, .json).
 */
const scanFrontendSourceFiles = async (dir = FRONTEND_SRC) => {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
        return await scanFrontendSourceFiles(fullPath);
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (['.jsx', '.js', '.css', '.json', '.html'].includes(ext)) {
        const relativeToSrc = path.relative(FRONTEND_SRC, fullPath).replace(/\\/g, '/');
        return [`src/${relativeToSrc}`];
      }
      return [];
    })
  );
  return files.flat();
};

/**
 * Checks whether the environment is running in a hosted serverless / read-only production environment (e.g. Vercel, AWS Lambda, Render read-only disk).
 */
const isReadOnlyFilesystem = () => {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.RENDER || process.env.READ_ONLY_FS === 'true') {
    return true;
  }
  try {
    const testFile = path.resolve(FRONTEND_SRC, '.write_test_tmp');
    fs.writeFileSync(testFile, 'test', 'utf-8');
    fs.unlinkSync(testFile);
    return false;
  } catch (err) {
    return true;
  }
};

/**
 * Smart Target Resolver:
 * Resolves keyword mappings instantly in 0ms without reading directories or invoking an AI scan.
 * Never loads the entire codebase or file contents for routing.
 */
const resolveSmartTargetFile = async (instructionPrompt = '') => {
  const promptLower = (instructionPrompt || '').toLowerCase();

  // 1. High-confidence heuristic keyword mapping (0ms instant resolution)
  const keywordMap = [
    { regex: /\b(navbar|brand|logo|dock|header|loopra\s*logo|title\s*bar|brand\s*name)\b/i, file: 'src/App.jsx' },
    { regex: /\b(footer|copyright|disclaimer|policy\s*link)\b/i, file: 'src/components/Navigation/LoopraFooter.jsx' },
    { regex: /\b(bottomnav|mobile\s*nav|bottom\s*bar|mobile\s*tab)\b/i, file: 'src/components/Navigation/MobileBottomNav.jsx' },
    { regex: /\b(sidebar|left\s*nav|navigation\s*menu)\b/i, file: 'src/components/Sidebar.jsx' },
    { regex: /\b(3d\s*character|humanoid|avatar\s*mesh|threejs|three\.js|shader)\b/i, file: 'src/components/VoiceAgent/ThreeDCharacter.jsx' },
    { regex: /\b(character|buddy|avatar\s*widget|roam|floating|speech\s*bubble)\b/i, file: 'src/components/VoiceAgent/CharacterBuddy.jsx' },
    { regex: /\b(voice\s*agent|voice\s*modal|stt|speech|mic\s*modal|talk\s*to\s*loopra)\b/i, file: 'src/components/VoiceAgent/VoiceAgentModal.jsx' },
    { regex: /\b(turntable|vinyl|record\s*player)\b/i, file: 'src/components/Player/Turntable3D.jsx' },
    { regex: /\b(dj\s*club|dj\s*page|lighting|crowd|laser)\b/i, file: 'src/components/DjClub/DjClubPage.jsx' },
    { regex: /\b(indian\s*radio|radio\s*station|station|mirchi|vividh)\b/i, file: 'src/components/Radio/IndianRadioView.jsx' },
    { regex: /\b(time\s*machine|retro|vintage|cassette|radio\s*dial)\b/i, file: 'src/components/Radio/TimeMachineRadio.jsx' },
    { regex: /\b(lyrics|karaoke|sync\s*lyrics)\b/i, file: 'src/components/Player/LyricsModal.jsx' },
    { regex: /\b(offline|download\s*track|cached\s*song)\b/i, file: 'src/components/Offline/OfflineLibraryView.jsx' },
    { regex: /\b(swipe|discover\s*swipe|card\s*deck)\b/i, file: 'src/components/Discover/DiscoverSwipe.jsx' },
    { regex: /\b(discover|explore\s*view)\b/i, file: 'src/components/Discover/DiscoverView.jsx' },
    { regex: /\b(player|audio\s*player|bottom\s*player|seek\s*bar|play\s*button)\b/i, file: 'src/components/AudioPlayer.jsx' },
    { regex: /\b(admin|dashboard|live\s*patch|cms\s*admin)\b/i, file: 'src/components/Admin/AdminDashboard.jsx' },
    { regex: /\b(search\s*bar|query|search\s*input)\b/i, file: 'src/components/Search/HomeSearchBar.jsx' },
    { regex: /\b(recommendation|curated|lounge|personalized)\b/i, file: 'src/components/Recommendations/PersonalizedRecommendationsSection.jsx' },
    { regex: /\b(stats|listening\s*stats|listening\s*history)\b/i, file: 'src/components/Stats/ListeningStatsModal.jsx' }
  ];

  for (const item of keywordMap) {
    if (item.regex.test(promptLower)) {
      return item.file;
    }
  }

  // 2. Direct filename or basename check against top known components
  const commonComponents = [
    'src/App.jsx',
    'src/components/AudioPlayer.jsx',
    'src/components/Sidebar.jsx',
    'src/components/Navigation/LoopraFooter.jsx',
    'src/components/Navigation/MobileBottomNav.jsx',
    'src/components/VoiceAgent/CharacterBuddy.jsx',
    'src/components/VoiceAgent/ThreeDCharacter.jsx',
    'src/components/VoiceAgent/VoiceAgentModal.jsx',
    'src/components/Discover/DiscoverView.jsx',
    'src/components/Discover/DiscoverSwipe.jsx',
    'src/components/Radio/IndianRadioView.jsx',
    'src/components/Radio/TimeMachineRadio.jsx',
    'src/components/DjClub/DjClubPage.jsx',
    'src/components/Player/Turntable3D.jsx',
    'src/components/Player/LyricsModal.jsx',
    'src/components/Admin/AdminDashboard.jsx',
    'src/components/Search/HomeSearchBar.jsx',
    'src/components/Stats/ListeningStatsModal.jsx'
  ];

  for (const f of commonComponents) {
    const base = path.basename(f, path.extname(f)).toLowerCase();
    if (base.length > 2 && promptLower.includes(base)) {
      return f;
    }
  }

  // 3. Fallback: Fast, tight Gemini Flash classification over common component names only (NOT full codebase or file contents)
  try {
    const systemInstruction = `You are a frontend code classifier for Loopra (React/Vite app).
Given a list of file paths and a prompt, return ONLY the single most relevant file path from the list.
Do NOT output markdown, preamble or explanation.`;

    const userPrompt = `FILE PATHS:\n${commonComponents.join('\n')}\n\nUSER PROMPT:\n${instructionPrompt}\n\nCHOSEN FILE:`;

    const detectResult = await executeGeminiOperation(async ({ client, modelName }) => {
      const targetModel = modelName || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
      const response = await client.models.generateContent({
        model: targetModel,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction,
          temperature: 0.1
        }
      });
      return response.text;
    }, {
      operationName: 'AutoDetectTargetFile',
      timeoutMs: 4000
    });

    if (detectResult.success && detectResult.data) {
      const rawPath = stripMarkdownBackticks(detectResult.data).trim().replace(/^['"`]|['"`]$/g, '');
      const matched = commonComponents.find(f => f.toLowerCase() === rawPath.toLowerCase()) ||
                      commonComponents.find(f => f.toLowerCase().endsWith(rawPath.toLowerCase()));
      if (matched) return matched;
    }
  } catch (_) {
    // If classification times out or fails, default immediately to src/App.jsx
  }

  // Default fallback if all else fails
  return 'src/App.jsx';
};

// GET /api/admin/ai-patch-logs & /api/admin/patch-logs - Fetch chronological patch history
router.get(['/ai-patch-logs', '/patch-logs'], authenticateToken, requireAdmin, async (req, res) => {
  try {
    const logs = await readPatchLogs();
    res.json({
      success: true,
      logs: Array.isArray(logs) ? logs.reverse() : []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve patch history: ' + err.message });
  }
});

// In-memory staged patch registry (expires after 15 minutes)
const stagedPatches = new Map();

// Housekeeping: clean up staged patches older than 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, patch] of stagedPatches.entries()) {
    if (now - patch.stagedAt > 15 * 60 * 1000) {
      stagedPatches.delete(id);
    }
  }
}, 5 * 60 * 1000);

// POST /api/admin/ai-stage-patch - Analyzes the targeted file, generates code, and returns staged patch
router.post('/ai-stage-patch', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let { targetFile, instructionPrompt } = req.body;

    if (!instructionPrompt || !instructionPrompt.trim()) {
      return res.status(400).json({ error: 'Instruction prompt is required' });
    }

    let isAutoDetected = false;
    let detectedFile = null;

    if (!targetFile || targetFile === 'auto' || targetFile.trim() === '') {
      try {
        detectedFile = await resolveSmartTargetFile(instructionPrompt);
        targetFile = detectedFile;
        isAutoDetected = true;
      } catch (autoErr) {
        return res.status(400).json({
          error: `Auto file detection failed: ${autoErr.message}. Please select a target file manually.`
        });
      }
    }

    const { absoluteTarget, relativeTarget } = resolveSafeTargetFilePath(targetFile);

    // Read original file content safely
    let originalCode = '';
    try {
      originalCode = await fs.promises.readFile(absoluteTarget, 'utf-8');
    } catch (readErr) {
      return res.status(404).json({
        error: `Target file not found: ${relativeTarget} (${readErr.message})`
      });
    }

    const systemInstruction = `You are an expert AI live code patcher for Loopra (a Vite + React + Tailwind + Three.js application).
You are modifying the file: "${relativeTarget}".

CRITICAL INSTRUCTIONS:
1. For files under 500 lines, return the complete updated file content.
2. For large files, you may return the full modified file OR targeted search-and-replace blocks using:
<<<<<<< SEARCH
[exact original code to replace]
=======
[replacement code]
>>>>>>>
3. Absolutely DO NOT wrap output in markdown code blocks (\`\`\` or \`\`\`jsx). Return raw executable code only.
4. Preserve all necessary imports, state, and exports.`;

    const userPrompt = `ORIGINAL FILE (${relativeTarget}):\n${originalCode}\n\nINSTRUCTION / FIX:\n${instructionPrompt.trim()}\n\nOUTPUT:`;

    const geminiResult = await executeGeminiOperation(async ({ client, modelName }) => {
      const response = await client.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction,
          temperature: 0.15
        }
      });
      return response.text;
    }, {
      operationName: `LiveCodeStage:${relativeTarget}`,
      timeoutMs: 45000
    });

    if (!geminiResult.success || !geminiResult.data) {
      return res.status(500).json({
        error: geminiResult.message || 'Gemini API failed to generate valid code patch.'
      });
    }

    const cleanedOutput = stripMarkdownBackticks(geminiResult.data);
    const cleanedCode = applySearchReplaceBlocks(originalCode, cleanedOutput);

    if (!cleanedCode || cleanedCode.length < 20) {
      return res.status(500).json({
        error: 'AI generated empty or truncated code. Target file was not modified.'
      });
    }

    const patchId = `stage_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const diff = generateStructuredDiff(originalCode, cleanedCode);

    const stagedData = {
      patchId,
      stagedAt: Date.now(),
      targetFile: relativeTarget,
      detectedFile: isAutoDetected ? relativeTarget : null,
      isAutoDetected,
      instructionPrompt: instructionPrompt.trim(),
      originalCode,
      stagedCode: cleanedCode,
      diff,
      linesBefore: originalCode.split('\n').length,
      linesAfter: cleanedCode.split('\n').length,
      stagedBy: req.user?.username || 'admin'
    };

    stagedPatches.set(patchId, stagedData);

    return res.json({
      success: true,
      patchId,
      detectedFile: isAutoDetected ? relativeTarget : null,
      targetFile: relativeTarget,
      linesBefore: stagedData.linesBefore,
      linesAfter: stagedData.linesAfter,
      originalCode,
      stagedCode: cleanedCode,
      diff
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stage patch: ' + err.message });
  }
});

// POST /api/admin/ai-commit-patch - Commits staged patch to disk with .bak backup in .snapshots/ and triggers Vite HMR
router.post('/ai-commit-patch', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { patchId } = req.body;
    if (!patchId) {
      return res.status(400).json({ error: 'patchId is required to commit patch' });
    }

    const staged = stagedPatches.get(patchId);
    if (!staged) {
      return res.status(404).json({ error: 'Staged patch expired or not found. Please regenerate patch.' });
    }

    const { targetFile, originalCode, stagedCode, instructionPrompt, isAutoDetected, detectedFile, diff } = staged;
    const { absoluteTarget, relativeTarget } = resolveSafeTargetFilePath(targetFile);

    // Check if running on hosted/read-only environment (e.g. Vercel, AWS Lambda, Render)
    if (isReadOnlyFilesystem()) {
      stagedPatches.delete(patchId);
      return res.json({
        success: true,
        isReadOnly: true,
        patchId,
        filePath: relativeTarget,
        targetFile: relativeTarget,
        diff: diff || generateStructuredDiff(originalCode, stagedCode),
        stagedCode,
        message: 'Changes generated successfully. In production mode, apply via CMS or push to Git.',
        notice: 'Changes generated successfully. In production mode, apply via CMS or push to Git.',
        detectedFile: isAutoDetected ? relativeTarget : null
      });
    }

    // Prepare backup snapshot directory (.snapshots)
    await ensureBackupEnvironment();
    const timestamp = Date.now();
    const sanitizedFileName = path.basename(relativeTarget).replace(/[^a-zA-Z0-9._-]/g, '_');
    const backupFileName = `${timestamp}_${sanitizedFileName}.bak`;
    const backupPath = path.resolve(BACKUPS_DIR, backupFileName);

    // Save pre-patch backup snapshot
    await fs.promises.writeFile(backupPath, originalCode, 'utf-8');

    // Synchronously write modified code to disk using fs.writeFileSync (triggers Vite HMR in browser)
    fs.writeFileSync(absoluteTarget, stagedCode, 'utf-8');

    // Clean from staged memory
    stagedPatches.delete(patchId);

    // Record in persistent patch history log
    const committedPatchId = `patch_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
    const patchRecord = {
      id: committedPatchId,
      timestamp,
      date: new Date(timestamp).toISOString(),
      targetFile: relativeTarget,
      isAutoDetected: Boolean(isAutoDetected),
      detectedFile: detectedFile || null,
      instructionPrompt,
      backupFile: backupFileName,
      backupPath,
      linesBefore: originalCode.split('\n').length,
      linesAfter: stagedCode.split('\n').length,
      patchedBy: req.user?.username || 'admin',
      status: 'APPLIED'
    };

    const existingLogs = await readPatchLogs();
    existingLogs.push(patchRecord);
    await savePatchLogs(existingLogs);

    await AuditLog.create({
      adminId: (req.user._id || req.user.id || req.user.userId)?.toString(),
      adminUsername: req.user?.username || 'admin',
      action: 'AI_LIVE_CODE_PATCH',
      details: {
        patchId: committedPatchId,
        targetFile: relativeTarget,
        isAutoDetected: Boolean(isAutoDetected),
        prompt: instructionPrompt
      },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      patchId: committedPatchId,
      filePath: relativeTarget,
      targetFile: relativeTarget,
      diff: diff || generateStructuredDiff(originalCode, stagedCode),
      message: `Successfully live patched ${relativeTarget}! Vite HMR updated.`,
      detectedFile: isAutoDetected ? relativeTarget : null,
      patch: patchRecord
    });
  } catch (err) {
    res.status(500).json({ error: 'Commit patch failed: ' + err.message });
  }
});

// POST /api/admin/live-patch & /api/admin/ai-patch - Unified Direct Endpoint (stages, snapshots in .snapshots, and writes to disk)
router.post(['/live-patch', '/ai-patch'], authenticateToken, requireAdmin, async (req, res) => {
  try {
    let { targetFile, filePath, instructionPrompt, prompt } = req.body;
    targetFile = targetFile || filePath;
    instructionPrompt = instructionPrompt || prompt;

    if (!instructionPrompt || !instructionPrompt.trim()) {
      return res.status(400).json({ error: 'Instruction prompt is required' });
    }

    let isAutoDetected = false;
    let detectedFile = null;

    if (!targetFile || targetFile === 'auto' || targetFile.trim() === '') {
      try {
        detectedFile = await resolveSmartTargetFile(instructionPrompt);
        targetFile = detectedFile;
        isAutoDetected = true;
      } catch (autoErr) {
        return res.status(400).json({
          error: `Auto file detection failed: ${autoErr.message}. Please select a target file manually.`
        });
      }
    }

    const { absoluteTarget, relativeTarget } = resolveSafeTargetFilePath(targetFile);

    // Read original file content
    let originalCode = '';
    try {
      originalCode = await fs.promises.readFile(absoluteTarget, 'utf-8');
    } catch (readErr) {
      return res.status(404).json({
        error: `Target file not found: ${relativeTarget} (${readErr.message})`
      });
    }

    const systemInstruction = `You are an expert AI live code patcher for Loopra (a Vite + React + Tailwind + Three.js application).
You are modifying the file: "${relativeTarget}".

CRITICAL INSTRUCTIONS:
1. Return the complete updated source code OR targeted search-and-replace blocks:
<<<<<<< SEARCH
[exact original code]
=======
[replacement code]
>>>>>>>
2. Absolutely DO NOT wrap your output in markdown code fences (\`\`\` or \`\`\`jsx).
3. Do NOT include explanations, preamble, or comments.
4. Preserve all existing necessary imports, functions, and state.`;

    const userPrompt = `ORIGINAL FILE (${relativeTarget}):\n${originalCode}\n\nINSTRUCTION / FIX:\n${instructionPrompt.trim()}\n\nOUTPUT:`;

    const geminiResult = await executeGeminiOperation(async ({ client, modelName }) => {
      const response = await client.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction,
          temperature: 0.15
        }
      });
      return response.text;
    }, {
      operationName: `LiveCodePatch:${relativeTarget}`,
      timeoutMs: 45000
    });

    if (!geminiResult.success || !geminiResult.data) {
      return res.status(500).json({
        error: geminiResult.message || 'Gemini API failed to generate valid code patch.'
      });
    }

    const cleanedOutput = stripMarkdownBackticks(geminiResult.data);
    const cleanedCode = applySearchReplaceBlocks(originalCode, cleanedOutput);

    if (!cleanedCode || cleanedCode.length < 20) {
      return res.status(500).json({
        error: 'AI generated empty or truncated code. Original file was preserved.'
      });
    }

    // Check if running on hosted/read-only environment (e.g. Vercel, AWS Lambda, Render)
    if (isReadOnlyFilesystem()) {
      const diff = generateStructuredDiff(originalCode, cleanedCode);
      return res.json({
        success: true,
        isReadOnly: true,
        filePath: relativeTarget,
        targetFile: relativeTarget,
        diff,
        stagedCode: cleanedCode,
        message: 'Changes generated successfully. In production mode, apply via CMS or push to Git.',
        notice: 'Changes generated successfully. In production mode, apply via CMS or push to Git.',
        detectedFile: isAutoDetected ? relativeTarget : null
      });
    }

    // Save pre-patch backup snapshot in .snapshots
    await ensureBackupEnvironment();
    const timestamp = Date.now();
    const sanitizedFileName = path.basename(relativeTarget).replace(/[^a-zA-Z0-9._-]/g, '_');
    const backupFileName = `${timestamp}_${sanitizedFileName}.bak`;
    const backupPath = path.resolve(BACKUPS_DIR, backupFileName);

    await fs.promises.writeFile(backupPath, originalCode, 'utf-8');

    // Write modified code to disk using fs.writeFileSync
    fs.writeFileSync(absoluteTarget, cleanedCode, 'utf-8');

    // Record in patch history log
    const patchId = `patch_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
    const diff = generateStructuredDiff(originalCode, cleanedCode);

    const patchRecord = {
      id: patchId,
      timestamp,
      date: new Date(timestamp).toISOString(),
      targetFile: relativeTarget,
      isAutoDetected,
      detectedFile,
      instructionPrompt: instructionPrompt.trim(),
      backupFile: backupFileName,
      backupPath,
      linesBefore: originalCode.split('\n').length,
      linesAfter: cleanedCode.split('\n').length,
      patchedBy: req.user?.username || 'admin',
      status: 'APPLIED'
    };

    const existingLogs = await readPatchLogs();
    existingLogs.push(patchRecord);
    await savePatchLogs(existingLogs);

    await AuditLog.create({
      adminId: (req.user._id || req.user.id || req.user.userId)?.toString(),
      adminUsername: req.user?.username || 'admin',
      action: 'AI_LIVE_CODE_PATCH',
      details: {
        patchId,
        targetFile: relativeTarget,
        isAutoDetected,
        prompt: instructionPrompt.trim()
      },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      patchId,
      filePath: relativeTarget,
      targetFile: relativeTarget,
      diff,
      message: `Successfully live patched ${relativeTarget}! Vite HMR updated.`,
      detectedFile: isAutoDetected ? relativeTarget : null,
      patch: patchRecord
    });
  } catch (err) {
    res.status(500).json({ error: 'Live patch failed: ' + err.message });
  }
});

// POST /api/admin/ai-rollback - Restore snapshot file to targetFile
router.post('/ai-rollback', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { patchId } = req.body;
    if (!patchId) {
      return res.status(400).json({ error: 'patchId is required' });
    }

    const logs = await readPatchLogs();
    const patchIndex = logs.findIndex(p => p.id === patchId);
    if (patchIndex === -1) {
      return res.status(404).json({ error: 'Patch record not found' });
    }

    const patchRecord = logs[patchIndex];
    const { absoluteTarget, relativeTarget } = resolveSafeTargetFilePath(patchRecord.targetFile);
    const backupFilePath = path.resolve(BACKUPS_DIR, patchRecord.backupFile);

    let backupContent = '';
    try {
      backupContent = await fs.promises.readFile(backupFilePath, 'utf-8');
    } catch (e) {
      return res.status(404).json({
        error: `Backup snapshot file missing: ${patchRecord.backupFile}`
      });
    }

    if (isReadOnlyFilesystem()) {
      return res.json({
        success: true,
        isReadOnly: true,
        message: 'Snapshot rollback acknowledged. On hosted read-only environments, revert code via Git.',
        notice: 'On hosted read-only environments, revert code via Git.'
      });
    }

    // Restore backup snapshot back to original file
    fs.writeFileSync(absoluteTarget, backupContent, 'utf-8');

    // Update patch record status
    patchRecord.status = 'ROLLED_BACK';
    patchRecord.rolledBackAt = new Date().toISOString();
    logs[patchIndex] = patchRecord;
    await savePatchLogs(logs);

    await AuditLog.create({
      adminId: (req.user._id || req.user.id || req.user.userId)?.toString(),
      adminUsername: req.user?.username || 'admin',
      action: 'AI_CODE_ROLLBACK',
      details: {
        patchId,
        targetFile: relativeTarget
      },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      message: `Successfully rolled back ${relativeTarget} to pre-patch version!`,
      targetFile: relativeTarget,
      patchId
    });
  } catch (err) {
    res.status(500).json({ error: 'Rollback failed: ' + err.message });
  }
});
export default router;
