import express from 'express';
import { processChatBuddyMessage } from '../services/chatBuddyLlmService.js';
import { optionalAuth } from './aiMusic.js';

const router = express.Router();

/**
 * POST /api/chat
 * Main ChatBuddy conversational & command intent endpoint.
 * Returns strict JSON:
 * {
 *   "type": "chat" | "command",
 *   "action": "play_song|pause|resume|next|previous|volume|open_page|avatar_walk|avatar_jump|avatar_dance|avatar_wave|none",
 *   "params": { ... },
 *   "reply": "..."
 * }
 */
router.post('/', optionalAuth, async (req, res) => {
  const { message, history } = req.body;

  if (typeof message !== 'string') {
    return res.status(400).json({
      type: 'chat',
      action: 'none',
      params: {},
      reply: 'Message must be a string'
    });
  }

  try {
    const result = await processChatBuddyMessage({
      message,
      history: Array.isArray(history) ? history : []
    });

    return res.json(result);
  } catch (err) {
    console.error('[ChatRoute] Processing error:', err);
    return res.json({
      type: 'chat',
      action: 'none',
      params: {},
      reply: 'Main abhi sun nahi payi, kripya dobara kahein!'
    });
  }
});

export default router;

