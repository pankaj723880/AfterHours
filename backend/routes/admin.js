import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { metricsService } from '../services/metrics.js';

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

// 3. List Users with Server-Side Pagination, Filtering, & Search
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
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
      role: user.role || 'user',
      status: user.status || 'active',
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      stats: {
        likedSongsCount: (user.likedSongs || []).length,
        historyCount: (user.history || []).length,
        playlistsCount: (user.playlists || []).length
      },
      auditHistory: userAuditLogs
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve user: ' + err.message });
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

    Object.assign(targetUser, updates);
    await targetUser.save();

    // Append to AuditLog
    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'USER_UPDATE',
      targetId: targetUser._id.toString(),
      targetUsername: targetUser.username,
      details: changes,
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      message: 'User updated successfully',
      user: {
        id: targetUser._id.toString(),
        username: targetUser.username,
        role: targetUser.role,
        status: targetUser.status
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

    res.json({
      message: 'User successfully deactivated',
      userId: targetUser._id.toString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate user: ' + err.message });
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

// 9. Public / Client Telemetry Endpoint for Observability
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

export default router;
