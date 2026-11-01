/**
 * Loopra Voice Agent API Routes
 * Exposes AI intent parsing, permission gates, and execution validation.
 */

import express from 'express';
import { voiceAgentService } from '../services/voiceAgentService.js';
import { featureFlagService } from '../services/featureFlagService.js';
import { verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * Optional user authentication helper
 */
const resolveCallingUser = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) return null;

  try {
    const user = await User.findById(decoded.userId).select('role status username email').lean();
    if (user && (user.status === 'suspended' || user.status === 'deactivated')) {
      return null;
    }
    return user;
  } catch (_) {
    return null;
  }
};

/**
 * POST /api/voice-agent/parse-intent
 * Translates multi-lingual voice/typed utterance into structured execution plan
 */
router.post('/parse-intent', async (req, res) => {
  try {
    const user = await resolveCallingUser(req);

    // Validate feature flag permission gate
    const config = await featureFlagService.getFeatureConfig('voice_control');
    const allowed = featureFlagService.evaluateAccess(config, user);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: 'Voice Control is not enabled for your account.',
        allowed: false
      });
    }

    const { utterance, currentTrack, activeTab, history } = req.body;
    if (!utterance || typeof utterance !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid "utterance" in request body.'
      });
    }

    const plan = await voiceAgentService.parseIntent({
      utterance,
      currentTrack,
      activeTab: activeTab || 'home',
      history: Array.isArray(history) ? history : []
    });

    return res.json({
      success: true,
      allowed: true,
      ...plan
    });
  } catch (err) {
    console.error('[VoiceAgentRoute] parse-intent error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to parse voice command intent: ' + err.message
    });
  }
});

/**
 * GET /api/voice-agent/tools
 * Returns registry of all native Loopra tools
 */
router.get('/tools', (req, res) => {
  return res.json({
    success: true,
    tools: voiceAgentService.getTools ? voiceAgentService.getTools() : []
  });
});

export default router;

