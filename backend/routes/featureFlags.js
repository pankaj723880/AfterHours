import express from 'express';
import { featureFlagService } from '../services/featureFlagService.js';
import { authenticateToken, requireAdmin, verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

const getClientIp = (req) => {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
};

/**
 * Public/User status endpoint
 * Evaluates whether the calling user (guest, normal user, or admin) has permission
 * to use Voice Control based on the current configuration.
 */
router.get(['/voice-control/status', '/voice-control-status', '/status'], async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let user = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        user = await User.findById(decoded.userId).select('role status username').lean();
        if (user && (user.status === 'suspended' || user.status === 'deactivated')) {
          user = null; // Deny suspended or deactivated accounts
        }
      }
    }

    const config = await featureFlagService.getFeatureConfig('voice_control');
    const allowed = featureFlagService.evaluateAccess(config, user);

    res.json({
      featureKey: 'voice_control',
      allowed,
      enabled: config.enabled,
      globalRollout: config.globalRollout,
      adminAccess: config.adminAccess
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to evaluate voice control status: ' + err.message
    });
  }
});

/**
 * Admin: Get Voice Control management configuration & real-time rollout statistics
 */
router.get(['/admin/voice-control', '/voice-control'], authenticateToken, requireAdmin, async (req, res) => {
  try {
    const config = await featureFlagService.getFeatureConfig('voice_control');
    const stats = await featureFlagService.getVoiceControlRolloutStats();

    res.json({
      success: true,
      config,
      stats
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to retrieve voice control management data: ' + err.message
    });
  }
});

/**
 * Admin: Update Voice Control configuration toggles
 */
router.put(['/admin/voice-control', '/voice-control'], authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { enabled, globalRollout, adminAccess } = req.body;

    if (
      typeof enabled !== 'boolean' ||
      typeof globalRollout !== 'boolean' ||
      typeof adminAccess !== 'boolean'
    ) {
      return res.status(400).json({
        error: 'Invalid configuration: enabled, globalRollout, and adminAccess must be boolean values'
      });
    }

    const ip = getClientIp(req);
    const result = await featureFlagService.updateVoiceControlConfig(
      { enabled, globalRollout, adminAccess },
      req.user,
      ip
    );

    // Notify all connected clients via Socket.IO in real-time
    const io = req.app.get('io');
    if (io) {
      io.emit('feature_flag_updated', {
        featureKey: 'voice_control',
        config: {
          enabled: result.config.enabled,
          globalRollout: result.config.globalRollout,
          adminAccess: result.config.adminAccess,
          updatedAt: result.config.updatedAt
        }
      });
    }

    res.json({
      success: true,
      message: 'Voice control configuration successfully updated',
      config: result.config,
      stats: result.stats
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to update voice control configuration: ' + err.message
    });
  }
});

export default router;
