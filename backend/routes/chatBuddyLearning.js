import express from 'express';
import { chatBuddyLearningService } from '../services/chatBuddyLearningService.js';
import { optionalAuth } from './aiMusic.js';

const router = express.Router();

/**
 * GET /api/chatbuddy/learning/stats
 * Diagnostic summary of learned patterns and Action Memory cache.
 */
router.get('/stats', (req, res) => {
  const stats = chatBuddyLearningService.getStats();
  return res.json({ success: true, stats });
});

/**
 * POST /api/chatbuddy/learning/resolve
 * Fast 0ms Action Memory lookup.
 */
router.post('/resolve', optionalAuth, (req, res) => {
  const { phrase } = req.body;
  const userId = req.user ? req.user._id.toString() : 'global';
  const match = chatBuddyLearningService.resolveFromMemory(phrase, userId);

  return res.json({
    success: true,
    matched: Boolean(match),
    action: match || null
  });
});

/**
 * POST /api/chatbuddy/learning/record
 * Confirm execution success or report failure to update confidence.
 */
router.post('/record', optionalAuth, async (req, res) => {
  try {
    const { userPhrase, intent, actionType, target, query, value, handler, success } = req.body;
    const userId = req.user ? req.user._id.toString() : 'global';

    const memory = await chatBuddyLearningService.recordExecution({
      userPhrase,
      intent,
      actionType,
      target,
      query,
      value,
      handler,
      success: success !== false,
      userId
    });

    return res.json({ success: true, memory });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/chatbuddy/learning/correct
 * Record user correction when an action was misidentified.
 */
router.post('/correct', optionalAuth, async (req, res) => {
  try {
    const { correctedPhrase } = req.body;
    const userId = req.user ? req.user._id.toString() : 'global';
    await chatBuddyLearningService.recordCorrection(userId, correctedPhrase);
    return res.json({ success: true, message: 'Correction recorded' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/chatbuddy/learning/clear
 * Clear Action Memory safely.
 */
router.post('/clear', optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user._id.toString() : null;
    const result = await chatBuddyLearningService.clearMemories(userId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
