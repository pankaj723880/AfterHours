import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Activity from '../models/Activity.js';
import ApiKey from '../models/ApiKeyConfig.js';
import CodePatcherHistory from '../models/CodePatcherHistory.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { metricsService } from '../services/metrics.js';
import { liveUsersService } from '../services/liveUsersService.js';
import { ADMIN_MANAGED_ENTITIES, EXCLUDED_INTERNAL_ENTITIES } from '../config/adminEntityRegistry.js';
import { executeGeminiOperation, sanitizeLogMessage, invalidateGeminiKeyCache } from '../services/geminiKeyManager.js';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../utils/keyEncryption.js';
import { testKeyHealth, invalidateKeyPoolCache, getEnvironmentFallbackKeys } from '../services/keyResolverService.js';
import { 
  isGitHubConfigured, 
  verifyGitHubConnection, 
  getRepositoryTree, 
  getFileContent, 
  createPatchBranch, 
  commitFilesToBranch, 
  createPullRequest, 
  mergePullRequest, 
  rollbackPatchBranch 
} from '../services/githubService.js';

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
// 13. Dynamic Multi-Key Pool Management (AES-256 Encrypted Storage & Telemetry)
// ==========================================

// GET /api/admin/keys - List all keys (strictly masked for security, with full health telemetry)
router.get('/keys', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const keys = await ApiKey.find().sort({ createdAt: -1 });
    const formatted = keys.map(k => {
      let masked = k.maskedKey;
      if (!masked) {
        const rawKey = decryptApiKey(k);
        masked = maskApiKey(rawKey);
      }
      return {
        _id: k._id,
        service: k.service,
        maskedKey: masked,
        label: k.label || '',
        status: k.status || 'Active',
        isEnabled: k.isEnabled !== false,
        isExhausted: Boolean(k.isExhausted),
        failureCount: k.failureCount || 0,
        successCount: k.successCount || 0,
        lastUsedAt: k.lastUsedAt,
        lastSuccessAt: k.lastSuccessAt,
        lastErrorAt: k.lastErrorAt,
        lastErrorMessage: k.lastErrorMessage || '',
        lastErrorReason: k.lastErrorReason || '',
        cooldownUntil: k.cooldownUntil,
        createdAt: k.createdAt
      };
    });

    // Also get counts of environment fallback keys
    const ytEnvCount = getEnvironmentFallbackKeys('youtube').length;
    const geminiEnvCount = getEnvironmentFallbackKeys('gemini').length;

    res.json({ 
      success: true, 
      keys: formatted,
      envFallbacks: {
        youtube: ytEnvCount,
        gemini: geminiEnvCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve API keys: ' + err.message });
  }
});

// POST /api/admin/keys - Add single or bulk keys with AES-256 encryption at rest
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

    // Pre-fetch existing keys for fast duplicate detection
    const existingDocs = await ApiKey.find({ service: targetService }).lean();
    const existingMasks = new Set(existingDocs.map(d => d.maskedKey || maskApiKey(decryptApiKey(d))));

    for (const singleKey of parsedKeys) {
      const masked = maskApiKey(singleKey);
      if (existingMasks.has(masked)) {
        duplicateCount++;
        continue;
      }

      // Encrypt API key with AES-256-GCM
      const { encryptedKey, iv, authTag } = encryptApiKey(singleKey);

      const newKey = await ApiKey.create({
        service: targetService,
        encryptedKey,
        iv,
        authTag,
        key: '', // Strictly zero plaintext storage
        maskedKey: masked,
        label: label ? label.trim() : '',
        status: 'Active',
        isEnabled: true,
        isExhausted: false,
        failureCount: 0,
        successCount: 0,
        createdAt: new Date(),
        lastUsedAt: new Date()
      });

      existingMasks.add(masked);
      addedKeys.push({
        _id: newKey._id,
        service: newKey.service,
        maskedKey: newKey.maskedKey,
        label: newKey.label,
        status: newKey.status,
        isEnabled: true,
        isExhausted: false
      });
      addedCount++;
    }

    invalidateKeyPoolCache(targetService);
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

// POST /api/admin/keys/:id/test - Run live dry-run health validation test for a specific key

// POST /api/admin/keys/:id/reveal - Reveal decrypted API key for authorized copy action (admin only, audited)
router.post('/keys/:id/reveal', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const keyDoc = await ApiKey.findById(req.params.id);
    if (!keyDoc) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const plainKey = decryptApiKey(keyDoc);
    if (!plainKey) {
      return res.status(400).json({ error: 'Unable to decrypt API key' });
    }

    await AuditLog.create({
      adminId: (req.user._id || req.user.id || req.user.userId)?.toString(),
      adminUsername: req.user.username,
      action: 'REVEAL_API_KEY_COPY',
      details: { keyId: keyDoc._id, service: keyDoc.service, maskedKey: keyDoc.maskedKey },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      service: keyDoc.service,
      maskedKey: keyDoc.maskedKey,
      apiKey: plainKey
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reveal key for copy: ' + err.message });
  }
});

router.post('/keys/:id/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const keyDoc = await ApiKey.findById(req.params.id);
    if (!keyDoc) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const plainKey = decryptApiKey(keyDoc);
    if (!plainKey) {
      return res.status(400).json({ error: 'Unable to decrypt API key for validation' });
    }

    const testResult = await testKeyHealth(keyDoc.service, plainKey);

    // Update key doc telemetry from test result
    if (testResult.success) {
      keyDoc.status = 'Active';
      keyDoc.isExhausted = false;
      keyDoc.cooldownUntil = null;
      keyDoc.lastSuccessAt = new Date();
      keyDoc.lastUsedAt = new Date();
    } else {
      keyDoc.lastErrorAt = new Date();
      keyDoc.lastErrorMessage = testResult.message;
      if (testResult.isQuota) {
        keyDoc.status = 'Exhausted';
        keyDoc.isExhausted = true;
        keyDoc.cooldownUntil = new Date(Date.now() + 6 * 60 * 60 * 1000);
      }
    }
    await keyDoc.save();
    invalidateKeyPoolCache(keyDoc.service);

    res.json({
      success: testResult.success,
      testResult,
      key: {
        _id: keyDoc._id,
        service: keyDoc.service,
        maskedKey: keyDoc.maskedKey,
        status: keyDoc.status,
        isExhausted: keyDoc.isExhausted,
        latencyMs: testResult.latencyMs
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Key health test failed: ' + err.message });
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
      keyDoc.cooldownUntil = null;
    }
    await keyDoc.save();

    invalidateKeyPoolCache(keyDoc.service);
    if (keyDoc.service && keyDoc.service.toLowerCase() === 'gemini') {
      invalidateGeminiKeyCache();
    }

    res.json({
      success: true,
      message: `Key marked as ${keyDoc.isExhausted ? 'Exhausted' : 'Active'}`,
      key: {
        _id: keyDoc._id,
        service: keyDoc.service,
        maskedKey: keyDoc.maskedKey || maskApiKey(decryptApiKey(keyDoc)),
        status: keyDoc.status,
        isExhausted: keyDoc.isExhausted,
        failureCount: keyDoc.failureCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update key status: ' + err.message });
  }
});

// PATCH /api/admin/keys/:id/enable - Enable or disable key from runtime rotation
router.patch('/keys/:id/enable', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const keyDoc = await ApiKey.findById(req.params.id);
    if (!keyDoc) {
      return res.status(404).json({ error: 'API key not found' });
    }

    keyDoc.isEnabled = !keyDoc.isEnabled;
    if (!keyDoc.isEnabled) {
      keyDoc.status = 'Disabled';
    } else {
      keyDoc.status = keyDoc.isExhausted ? 'Exhausted' : 'Active';
    }
    await keyDoc.save();

    invalidateKeyPoolCache(keyDoc.service);
    if (keyDoc.service && keyDoc.service.toLowerCase() === 'gemini') {
      invalidateGeminiKeyCache();
    }

    res.json({
      success: true,
      message: `Key ${keyDoc.isEnabled ? 'Enabled' : 'Disabled'}`,
      key: {
        _id: keyDoc._id,
        service: keyDoc.service,
        maskedKey: keyDoc.maskedKey || maskApiKey(decryptApiKey(keyDoc)),
        isEnabled: keyDoc.isEnabled,
        status: keyDoc.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle key enabled state: ' + err.message });
  }
});

// POST /api/admin/keys/reset-all - Reset all exhausted keys back to active
router.post('/keys/reset-all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await ApiKey.updateMany(
      { $or: [{ isExhausted: true }, { status: 'Exhausted' }] },
      { 
        $set: { 
          isExhausted: false, 
          status: 'Active', 
          failureCount: 0,
          cooldownUntil: null
        } 
      }
    );

    invalidateKeyPoolCache();
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

    invalidateKeyPoolCache(keyDoc.service);
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
// 14. AI Live Code Patcher & GitHub Repository Pipeline
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
 * Validates and resolves the target file path safely.
 * Allows repository-wide safe modifications (frontend, backend, shared config).
 * Strictly forbids directory traversal, .env files, private keys, or credentials.
 */
const resolveSafeTargetFilePath = (targetPath = '') => {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Target file path is required');
  }

  let normalized = targetPath.trim().replace(/\\/g, '/').replace(/^\/+/g, '');
  
  // Security Boundary: Block secrets and system paths
  const blockedPatterns = [/\.env(?:\..*)?$/i, /key.*\.pem$/i, /id_rsa/i, /credentials/i, /secrets/i];
  for (const pattern of blockedPatterns) {
    if (pattern.test(normalized)) {
      throw new Error(`Security Block: Access to sensitive file "${normalized}" is strictly prohibited.`);
    }
  }

  const absoluteTarget = path.resolve(PROJECT_ROOT, normalized);
  const relativeToRoot = path.relative(PROJECT_ROOT, absoluteTarget).replace(/\\/g, '/');

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error('Access denied: Operations are restricted strictly within project workspace');
  }

  return {
    absoluteTarget,
    relativeTarget: relativeToRoot
  };
};

/**
 * Strips markdown code fences or backticks generated by LLMs.
 */
const stripMarkdownBackticks = (raw = '') => {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^\`\`(?:[a-zA-Z0-9_\-+]*\s*\n)?/i, '');
  cleaned = cleaned.replace(/\n?\\`\`\s*$/i, '');
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

  for (let i = 0; i < maxLines && changeCount < 300; i++) {
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

// GET /api/admin/git/status - Check GitHub connectivity and repo config
router.get('/git/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const status = await verifyGitHubConnection();
    res.json({
      success: true,
      githubConfigured: isGitHubConfigured(),
      ...status
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify GitHub connection: ' + err.message });
  }
});

// GET /api/admin/git/tree - Retrieve repository tree for file explorer / target selection
router.get('/git/tree', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tree = await getRepositoryTree();
    res.json({
      success: true,
      tree: Array.isArray(tree) ? tree.slice(0, 500) : []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve repository tree: ' + err.message });
  }
});

// GET /api/admin/ai-patch-logs & /api/admin/patch-logs - Fetch chronological patch history

// GET /api/admin/patch-history - Query persistent MongoDB patch commands history with search & filters
router.get('/patch-history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, search, limit = 50, page = 1 } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { instructionPrompt: { $regex: q, $options: 'i' } },
        { targetFile: { $regex: q, $options: 'i' } },
        { detectedFile: { $regex: q, $options: 'i' } },
        { executionId: { $regex: q, $options: 'i' } }
      ];
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [items, total] = await Promise.all([
      CodePatcherHistory.find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      CodePatcherHistory.countDocuments(filter)
    ]);

    res.json({
      success: true,
      history: items,
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve patch history: ' + err.message });
  }
});

// GET /api/admin/patch-history/:executionId - Get detailed execution report
router.get('/patch-history/:executionId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const item = await CodePatcherHistory.findOne({ executionId: req.params.executionId }).lean();
    if (!item) {
      return res.status(404).json({ error: 'Command history record not found' });
    }
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve record: ' + err.message });
  }
});

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

// In-memory staged patch registry (expires after 30 minutes)
const stagedPatches = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, patch] of stagedPatches.entries()) {
    if (now - patch.stagedAt > 30 * 60 * 1000) {
      stagedPatches.delete(id);
    }
  }
}, 5 * 60 * 1000);

// POST /api/admin/ai-stage-patch - Multi-step AI Code Planning & Staging
router.post('/ai-stage-patch', authenticateToken, requireAdmin, async (req, res) => {
  const startTime = Date.now();
  const executionId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let historyDoc = null;

  try {
    let { targetFile, instructionPrompt } = req.body;

    if (!instructionPrompt || !instructionPrompt.trim()) {
      return res.status(400).json({ error: 'Instruction prompt is required' });
    }

    // 1. Immediately create persistent history document with 'Submitted' status
    try {
      historyDoc = await CodePatcherHistory.create({
        executionId,
        instructionPrompt: instructionPrompt.trim(),
        targetFile: targetFile || 'auto',
        status: 'Submitted',
        adminUsername: req.user?.username || 'admin',
        adminId: (req.user?._id || req.user?.id || req.user?.userId)?.toString(),
        submittedAt: new Date(),
        executionLogs: [{ level: 'step', message: 'Command received and recorded.' }]
      });
    } catch (dbErr) {
      console.warn('[CodePatcherHistory] Error creating initial history record:', dbErr.message);
    }

    // 2. Transition to 'Analyzing'
    if (historyDoc) {
      await CodePatcherHistory.updateOne(
        { executionId },
        { 
          $set: { status: 'Analyzing' },
          $push: { executionLogs: { level: 'step', message: 'Analyzing repository structure and target file.' } }
        }
      );
    }

    let resolvedFiles = [];
    let isAutoDetected = false;

    // If auto-detect requested, inspect repository tree with Gemini to determine exact file(s)
    if (!targetFile || targetFile === 'auto' || targetFile.trim() === '') {
      isAutoDetected = true;
      const tree = await getRepositoryTree();
      
      const fileDiscoveryPrompt = `Given this project tree:
${tree.slice(0, 150).join('\n')}

Which file(s) should be modified for this request?
Request: "${instructionPrompt.trim()}"

Return ONLY a comma-separated list of relative file paths (e.g. "frontend/src/App.jsx"). Do not include any explanations.`;

      const discoveryRes = await executeGeminiOperation(async ({ client, modelName }) => {
        const response = await client.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts: [{ text: fileDiscoveryPrompt }] }],
          config: { temperature: 0.1, maxOutputTokens: 100 }
        });
        return response.text;
      }, { operationName: 'LivePatcher:FileDiscovery', timeoutMs: 7000 });

      if (discoveryRes.success && discoveryRes.data) {
        resolvedFiles = discoveryRes.data
          .split(/[,\n]+/)
          .map(f => f.trim().replace(/^['"`]|['"`]$/g, ''))
          .filter(f => f && tree.includes(f));
      }

      if (resolvedFiles.length === 0) {
        resolvedFiles = ['frontend/src/App.jsx'];
      }
    } else {
      resolvedFiles = [targetFile.trim().replace(/^frontend\//, 'frontend/').replace(/^src\//, 'frontend/src/')];
    }

    const primaryTarget = resolvedFiles[0];
    const { absoluteTarget, relativeTarget } = resolveSafeTargetFilePath(primaryTarget);

    // Read original file content: prioritize GitHub remote (or fallback to local disk)
    let originalCode = '';
    const remoteFile = await getFileContent(relativeTarget);
    if (remoteFile && remoteFile.content) {
      originalCode = remoteFile.content;
    } else {
      try {
        originalCode = await fs.promises.readFile(absoluteTarget, 'utf-8');
      } catch (readErr) {
        if (historyDoc) {
          await CodePatcherHistory.updateOne(
            { executionId },
            { 
              $set: { 
                status: 'Failed', 
                'errorDetails.message': `Target file not found: ${relativeTarget}`,
                completedAt: new Date(),
                executionDurationMs: Date.now() - startTime
              },
              $push: { executionLogs: { level: 'error', message: `Target file not found: ${relativeTarget}` } }
            }
          );
        }
        return res.status(404).json({
          error: `Target file not found in repository: ${relativeTarget}`,
          executionId
        });
      }
    }

    // 3. Transition to 'Generating Patch'
    if (historyDoc) {
      await CodePatcherHistory.updateOne(
        { executionId },
        { 
          $set: { 
            status: 'Generating Patch',
            isAutoDetected,
            detectedFile: isAutoDetected ? relativeTarget : null,
            targetFile: relativeTarget,
            filesInspected: resolvedFiles
          },
          $push: { executionLogs: { level: 'step', message: `Targeting ${relativeTarget} (lines: ${originalCode.split('\n').length}). Generating AI patch.` } }
        }
      );
    }

    const systemInstruction = `You are an expert full-stack AI live code patcher for Loopra (Vite + React + Tailwind + Node/Express backend).
Target file: "${relativeTarget}".

CRITICAL INSTRUCTIONS:
1. For files under 600 lines, return the complete updated file content.
2. For large files, you may return the full code OR precise search-and-replace blocks:
<<<<<<< SEARCH
[exact original code]
=======
[replacement code]
>>>>>>>
3. DO NOT wrap output in markdown code fences or backticks. Return raw executable code only.
4. Maintain all valid imports, hooks, exports, and syntax. Ensure zero syntax errors.`;

    const userPrompt = `ORIGINAL FILE (${relativeTarget}):
${originalCode}

INSTRUCTION:
${instructionPrompt.trim()}

OUTPUT:`;

    const patchResult = await executeGeminiOperation(async ({ client, modelName }) => {
      const response = await client.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction,
          temperature: 0.15,
          maxOutputTokens: 2048
        }
      });
      return response.text;
    }, { operationName: `LiveCodeStage:${relativeTarget}`, timeoutMs: 12000 });

    if (!patchResult.success || !patchResult.data) {
      const errMsg = patchResult.message || 'AI code patcher failed to generate patch.';
      const isQuota = Boolean(patchResult.allKeysExhausted || patchResult.error === 'QUOTA_EXHAUSTED');
      if (historyDoc) {
        await CodePatcherHistory.updateOne(
          { executionId },
          { 
            $set: { 
              status: 'Failed',
              selectedKeyMasked: patchResult.selectedKeyMasked || null,
              'errorDetails.message': errMsg,
              'errorDetails.isQuota': isQuota,
              'errorDetails.code': patchResult.code || (isQuota ? '429' : '500'),
              completedAt: new Date(),
              executionDurationMs: Date.now() - startTime
            },
            $push: { executionLogs: { level: 'error', message: `Generation failed: ${errMsg}` } }
          }
        );
      }
      return res.status(500).json({
        error: errMsg,
        executionId,
        selectedKeyMasked: patchResult.selectedKeyMasked
      });
    }

    const cleanedOutput = stripMarkdownBackticks(patchResult.data);
    const cleanedCode = applySearchReplaceBlocks(originalCode, cleanedOutput);

    if (!cleanedCode || cleanedCode.length < 20) {
      if (historyDoc) {
        await CodePatcherHistory.updateOne(
          { executionId },
          { 
            $set: { 
              status: 'Failed',
              'errorDetails.message': 'AI generated empty or truncated code patch.',
              completedAt: new Date(),
              executionDurationMs: Date.now() - startTime
            },
            $push: { executionLogs: { level: 'error', message: 'Generated code was empty or truncated.' } }
          }
        );
      }
      return res.status(500).json({ error: 'AI generated empty or truncated code patch.', executionId });
    }

    const patchId = `stage_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const diff = generateStructuredDiff(originalCode, cleanedCode);

    const stagedData = {
      patchId,
      executionId,
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
      stagedBy: req.user?.username || 'admin',
      selectedKeyMasked: patchResult.selectedKeyMasked || null,
      selectedKeyId: patchResult.selectedKeyId || null
    };

    stagedPatches.set(patchId, stagedData);

    // 4. Update history to 'Awaiting Approval'
    if (historyDoc) {
      await CodePatcherHistory.updateOne(
        { executionId },
        { 
          $set: { 
            status: 'Awaiting Approval',
            selectedKeyMasked: patchResult.selectedKeyMasked || null,
            selectedKeyId: patchResult.selectedKeyId || null,
            filesModified: [relativeTarget],
            'patchInfo.linesBefore': stagedData.linesBefore,
            'patchInfo.linesAfter': stagedData.linesAfter,
            'patchInfo.diffSummary': `${diff.length} lines affected`,
            'patchInfo.diff': diff.slice(0, 50),
            executionDurationMs: Date.now() - startTime
          },
          $push: { executionLogs: { level: 'step', message: `Diff generated with ${diff.length} changed lines. Ready for confirmation.` } }
        }
      );
    }

    res.json({
      success: true,
      patchId,
      executionId,
      selectedKeyMasked: patchResult.selectedKeyMasked || null,
      detectedFile: isAutoDetected ? relativeTarget : null,
      targetFile: relativeTarget,
      linesBefore: stagedData.linesBefore,
      linesAfter: stagedData.linesAfter,
      originalCode,
      stagedCode: cleanedCode,
      diff,
      githubConnected: isGitHubConfigured()
    });
  } catch (err) {
    if (historyDoc) {
      await CodePatcherHistory.updateOne(
        { executionId },
        { 
          $set: { 
            status: 'Failed',
            'errorDetails.message': err.message,
            completedAt: new Date(),
            executionDurationMs: Date.now() - startTime
          },
          $push: { executionLogs: { level: 'error', message: 'Fatal error: ' + err.message } }
        }
      );
    }
    res.status(500).json({ error: 'Failed to stage code patch: ' + err.message, executionId });
  }
});

// POST /api/admin/ai-commit-patch - Commits to dedicated Git Branch and Creates Pull Request
router.post('/ai-commit-patch', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { patchId, createPr = true } = req.body;
    if (!patchId) {
      return res.status(400).json({ error: 'patchId is required to commit patch' });
    }

    const staged = stagedPatches.get(patchId);
    if (!staged) {
      return res.status(404).json({ error: 'Staged patch expired or not found. Please regenerate.' });
    }

    const { targetFile, originalCode, stagedCode, instructionPrompt, isAutoDetected, detectedFile, diff } = staged;
    const { absoluteTarget, relativeTarget } = resolveSafeTargetFilePath(targetFile);

    const timestamp = Date.now();
    const branchName = `patch/admin-${timestamp}-${Math.random().toString(36).slice(2, 6)}`;
    const commitMessage = `fix(patcher): ${instructionPrompt.slice(0, 72)}`;

    let gitCommitResult = null;
    let prResult = null;

    if (isGitHubConfigured()) {
      // 1. Create dedicated Git branch on GitHub
      await createPatchBranch(branchName);

      // 2. Commit file modification to that branch
      gitCommitResult = await commitFilesToBranch({
        branch: branchName,
        files: [{ path: relativeTarget, content: stagedCode, action: 'modify' }],
        commitMessage
      });

      // 3. Open Pull Request on GitHub
      if (createPr) {
        prResult = await createPullRequest({
          title: `[AI Patcher] ${instructionPrompt.slice(0, 80)}`,
          body: `### Loopra Live Code Patcher Submission\n\n**Prompt:**\n> ${instructionPrompt}\n\n**Modified File:** \`${relativeTarget}\`\n**Diff Summary:** ${diff.length} lines affected.\n\nAutomated PR generated from Loopra Admin Dashboard.`,
          headBranch: branchName
        });
      }
    } else {
      // Local fallback mode: write to local working directory
      await ensureBackupEnvironment();
      const sanitizedFileName = path.basename(relativeTarget).replace(/[^a-zA-Z0-9._-]/g, '_');
      const backupFileName = `${timestamp}_${sanitizedFileName}.bak`;
      const backupPath = path.resolve(BACKUPS_DIR, backupFileName);
      await fs.promises.writeFile(backupPath, originalCode, 'utf-8');
      fs.writeFileSync(absoluteTarget, stagedCode, 'utf-8');
      
      gitCommitResult = {
        mode: 'local',
        branch: 'local',
        commitSha: 'local_' + timestamp
      };
    }

    stagedPatches.delete(patchId);

    // Update persistent MongoDB CodePatcherHistory document
    if (staged.executionId) {
      try {
        await CodePatcherHistory.updateOne(
          { executionId: staged.executionId },
          {
            $set: {
              status: 'Completed',
              gitBranch: branchName,
              commitSha: gitCommitResult?.commitSha,
              prNumber: prResult?.prNumber || null,
              prUrl: prResult?.prUrl || null,
              completedAt: new Date()
            },
            $push: {
              executionLogs: {
                level: 'step',
                message: prResult 
                  ? `Branch ${branchName} created & PR #${prResult.prNumber} opened on GitHub.`
                  : `Changes applied directly to ${relativeTarget}.`
              }
            }
          }
        );
      } catch (histErr) {
        console.warn('[CodePatcherHistory] Error updating completion state:', histErr.message);
      }
    }

    // Save persistent log record
    const committedPatchId = `patch_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
    const patchRecord = {
      id: committedPatchId,
      timestamp,
      date: new Date(timestamp).toISOString(),
      targetFile: relativeTarget,
      isAutoDetected: Boolean(isAutoDetected),
      detectedFile: detectedFile || null,
      instructionPrompt,
      branch: branchName,
      commitSha: gitCommitResult?.commitSha,
      prNumber: prResult?.prNumber || null,
      prUrl: prResult?.prUrl || null,
      linesBefore: originalCode.split('\n').length,
      linesAfter: stagedCode.split('\n').length,
      patchedBy: req.user?.username || 'admin',
      status: prResult ? 'PR_OPENED' : 'COMMITTED'
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
        branch: branchName,
        prNumber: prResult?.prNumber,
        prompt: instructionPrompt
      },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      patchId: committedPatchId,
      branch: branchName,
      targetFile: relativeTarget,
      commitSha: gitCommitResult?.commitSha,
      prNumber: prResult?.prNumber || null,
      prUrl: prResult?.prUrl || null,
      message: prResult 
        ? `Branch ${branchName} created & PR #${prResult.prNumber} opened on GitHub!`
        : `Committed changes to ${relativeTarget}`,
      patch: patchRecord
    });
  } catch (err) {
    res.status(500).json({ error: 'Commit patch failed: ' + err.message });
  }
});

// POST /api/admin/ai-merge-pr - Admin Approval to Merge Pull Request
router.post('/ai-merge-pr', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { prNumber, patchId } = req.body;
    if (!prNumber) {
      return res.status(400).json({ error: 'prNumber is required for merge' });
    }

    const mergeRes = await mergePullRequest(prNumber);

    if (patchId) {
      const logs = await readPatchLogs();
      const patch = logs.find(p => p.id === patchId || p.prNumber === prNumber);
      if (patch) {
        patch.status = 'MERGED';
        patch.mergedAt = new Date().toISOString();
        await savePatchLogs(logs);
      }
    }

    await AuditLog.create({
      adminId: (req.user._id || req.user.id || req.user.userId)?.toString(),
      adminUsername: req.user?.username || 'admin',
      action: 'AI_PR_MERGE',
      details: { prNumber, mergeSha: mergeRes?.sha },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      message: `PR #${prNumber} merged successfully into main! Vercel deployment triggered.`,
      mergeResult: mergeRes
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to merge PR: ' + err.message });
  }
});

// POST /api/admin/ai-rollback - Rollback branch or revert pre-patch code
router.post('/ai-rollback', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { patchId, branchName, prNumber } = req.body;
    if (!patchId && !branchName) {
      return res.status(400).json({ error: 'patchId or branchName is required' });
    }

    const logs = await readPatchLogs();
    const patchIndex = logs.findIndex(p => p.id === patchId);
    const patchRecord = patchIndex !== -1 ? logs[patchIndex] : null;

    const targetBranch = branchName || patchRecord?.branch;
    const targetPr = prNumber || patchRecord?.prNumber;

    if (isGitHubConfigured() && targetBranch) {
      await rollbackPatchBranch(targetBranch, targetPr);
    }

    if (patchRecord) {
      patchRecord.status = 'ROLLED_BACK';
      patchRecord.rolledBackAt = new Date().toISOString();
      logs[patchIndex] = patchRecord;
      await savePatchLogs(logs);
    }

    await AuditLog.create({
      adminId: (req.user._id || req.user.id || req.user.userId)?.toString(),
      adminUsername: req.user?.username || 'admin',
      action: 'AI_CODE_ROLLBACK',
      details: { patchId, branch: targetBranch, prNumber: targetPr },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      message: `Successfully rolled back patch and closed branch ${targetBranch || 'local'}`,
      patchId
    });
  } catch (err) {
    res.status(500).json({ error: 'Rollback failed: ' + err.message });
  }
});

import { openverseAudioService } from '../services/openverseAudioService.js';

router.get('/relax/search-openverse', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.status(400).json({ error: 'Search query "q" is required' });
    }
    const results = await openverseAudioService.searchAudio(q, {
      pageSize: parseInt(req.query.pageSize || '12', 10),
      licenseType: req.query.licenseType || 'all-cc'
    });
    res.json({ success: true, count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: 'Openverse search failed: ' + err.message });
  }
});

router.post('/relax/verify-audio', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { audioUrl } = req.body || {};
    if (!audioUrl) return res.status(400).json({ error: 'audioUrl is required' });
    const verification = await openverseAudioService.verifyAudioUrl(audioUrl);
    res.json({ success: true, verification });
  } catch (err) {
    res.status(500).json({ error: 'Audio verification failed: ' + err.message });
  }
});

export default router;
