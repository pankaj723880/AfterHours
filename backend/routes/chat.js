import express from 'express';
import { processChatBuddyMessage, generateDynamicStartupGreeting } from '../services/chatBuddyLlmService.js';
import { optionalAuth } from './aiMusic.js';

const router = express.Router();

/**
 * POST /api/chat
 * Main ChatBuddy conversational & command intent endpoint.
 * Returns strict JSON:
 * {
 *   "type": "chat" | "command",
 *   "action": "play_song|pause|resume|next|previous|volume|open_page|open_folder|open_application|avatar_walk|avatar_jump|avatar_dance|avatar_wave|none",
 *   "params": { ... },
 *   "reply": "..."
 * }
 */
router.post('/', optionalAuth, async (req, res) => {
  const { message, history, currentMusicState } = req.body || {};

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
      history: Array.isArray(history) ? history : [],
      currentMusicState: currentMusicState || null
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

/**
 * GET /api/chat/greeting & POST /api/chat/greeting
 * Generates a fresh, dynamic startup greeting on Loopra voice activation.
 */
const handleGreeting = async (req, res) => {
  const lang = req.query?.lang || req.body?.lang || 'hi-IN';
  const currentMusicState = req.body?.currentMusicState || null;

  try {
    const greeting = await generateDynamicStartupGreeting({ lang, currentMusicState });
    return res.json({ success: true, greeting });
  } catch (err) {
    return res.json({ success: true, greeting: 'Hey! Main Loopra hoon. Boliye, aaj kya vibe chal rahi hai?' });
  }
};

router.get('/greeting', handleGreeting);
router.post('/greeting', handleGreeting);

export default router;
