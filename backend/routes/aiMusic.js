import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';
import { aiMusicCompanionService, aiCompanionDiagnostics } from '../services/aiMusicCompanionService.js';
import { musicRecognitionService } from '../services/musicRecognitionService.js';
import { catalogService } from '../services/catalogService.js';

const router = express.Router();

// In-memory rate limiting map (IP / User -> [timestamps])
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_CHAT_REQUESTS_PER_MIN = 40;
const MAX_IDENTIFY_REQUESTS_PER_MIN = 20;

const checkRateLimit = (key, maxLimit) => {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (valid.length >= maxLimit) {
    return false;
  }

  valid.push(now);
  rateLimitMap.set(key, valid);
  return true;
};

// Cleanup stale rate limit keys periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) rateLimitMap.delete(key);
    else rateLimitMap.set(key, valid);
  }
}, 5 * 60 * 1000);

/**
 * Optional authentication middleware.
 * Attaches req.user if a valid Bearer token is provided.
 */
export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) return next();

  const decoded = verifyToken(token);
  if (decoded && decoded.userId) {
    try {
      const user = await User.findById(decoded.userId).select('-password').maxTimeMS(2500);
      if (user && user.status !== 'suspended' && user.status !== 'deactivated') {
        req.user = user;
      }
    } catch (e) {
      // Gracefully continue as unauthenticated guest
    }
  }
  next();
};

/**
 * GET /api/ai-music/context
 * Returns configuration state of AI companion and music recognition.
 */
router.get('/context', (req, res) => {
  const geminiConfigured = aiMusicCompanionService.isGeminiConfigured();
  const recognitionInfo = musicRecognitionService.getProviderInfo();

  return res.json({
    geminiConfigured,
    recognition: recognitionInfo,
    diagnostics: {
      totalChats: aiCompanionDiagnostics.totalChats,
      successfulAiChats: aiCompanionDiagnostics.successfulAiChats,
      fallbackChats: aiCompanionDiagnostics.fallbackChats
    }
  });
});

/**
 * POST /api/ai-music/chat
 * Multi-turn conversational companion with current-track awareness and candidate-verified playback.
 */
router.post('/chat', optionalAuth, async (req, res) => {
  const clientKey = req.user ? req.user._id.toString() : (req.ip || 'guest');
  if (!checkRateLimit(`chat_${clientKey}`, MAX_CHAT_REQUESTS_PER_MIN)) {
    return res.status(429).json({
      error: 'Too many requests. Please pause for a moment before messaging Loopra AI again.'
    });
  }

  const { message, currentTrack, history } = req.body;

  if (typeof message !== 'string') {
    return res.status(400).json({ error: 'Message field is required and must be a string' });
  }

  if (message.length > 1500) {
    return res.status(400).json({ error: 'Message exceeds 1500 character limit' });
  }

  try {
    const isStream = req.query.stream === 'true';

    const result = await aiMusicCompanionService.processChat({
      user: req.user || null,
      message,
      currentTrack: currentTrack || null,
      history: Array.isArray(history) ? history : []
    });

    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      // Stream words smoothly for immediate perceptual response
      const words = (result.reply || '').split(' ');
      for (let i = 0; i < words.length; i += 3) {
        const slice = words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '');
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: slice })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({
        type: 'done',
        reply: result.reply,
        tracks: result.tracks || [],
        action: result.action || null
      })}\n\n`);
      return res.end();
    }

    return res.json({
      success: true,
      reply: result.reply,
      tracks: result.tracks || [],
      action: result.action || null
    });
  } catch (err) {
    console.error('[AiMusicRoutes] Chat error:', err);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({
        type: 'done',
        reply: 'I had trouble connecting to the music network. Please try again in a moment!',
        tracks: []
      })}\n\n`);
      return res.end();
    }
    return res.status(500).json({
      error: 'An internal error occurred while communicating with Loopra AI',
      details: err.message
    });
  }
});

/**
 * POST /api/ai-music/identify
 * Microphone audio recognition service.
 */
router.post('/identify', optionalAuth, async (req, res) => {
  const clientKey = req.user ? req.user._id.toString() : (req.ip || 'guest');
  if (!checkRateLimit(`identify_${clientKey}`, MAX_IDENTIFY_REQUESTS_PER_MIN)) {
    return res.status(429).json({
      error: 'Recognition rate limit reached. Please wait a minute before identifying another track.'
    });
  }

  const { audioBase64, mimeType, durationSeconds } = req.body;

  if (!audioBase64) {
    return res.status(400).json({ error: 'Audio sample (audioBase64) is required for identification' });
  }

  try {
    const recognitionResult = await musicRecognitionService.identifyAudio({
      audioBase64,
      mimeType: mimeType || 'audio/webm',
      durationSeconds: durationSeconds || 6
    });

    // If provider is not configured
    if (!recognitionResult.configured && recognitionResult.configured === false) {
      return res.status(200).json({
        success: false,
        configured: false,
        message: recognitionResult.message,
        requiredEnvVars: recognitionResult.requiredEnvVars
      });
    }

    // If recognition failed to match
    if (!recognitionResult.success) {
      return res.status(200).json({
        success: false,
        configured: true,
        message: recognitionResult.message || 'No matching song detected. Please try capturing closer to the speakers.'
      });
    }

    // Song was successfully recognized!
    const { title, artist, album, score, releaseDate } = recognitionResult;

    // Search for a playable candidate in Loopra's single-track catalog
    let playableTrack = null;
    try {
      const candidates = await catalogService.fetchDynamicCandidates([`${title} ${artist}`], 1);
      if (candidates && candidates.length > 0) {
        playableTrack = candidates[0];
      }
    } catch (e) {
      console.warn('[AiMusicRoutes] Notice searching playable candidate for identified song:', e.message);
    }

    // If not found in dynamic search, construct verified metadata object
    if (!playableTrack) {
      playableTrack = {
        title,
        artist,
        album: album || 'Identified Single',
        channel: artist,
        thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
        duration: '3:30',
        isIdentified: true
      };
    }

    // Generate short AI commentary if Gemini is configured
    let commentary = `Identified with ${score}% match confidence.`;
    if (aiMusicCompanionService.isGeminiConfigured()) {
      try {
        const client = aiMusicCompanionService.getClient();
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const aiPrompt = `In 2 brief, engaging sentences, share an interesting musical trivia or cultural insight about the song "${title}" by ${artist} (${releaseDate || 'Retro/Contemporary'}). Keep it warm and concise.`;
        const aiRes = await client.models.generateContent({
          model: modelName,
          contents: aiPrompt
        });
        if (aiRes.text) {
          commentary = aiRes.text.trim();
        }
      } catch (e) { }
    }

    return res.json({
      success: true,
      configured: true,
      match: {
        title,
        artist,
        album,
        confidence: score,
        releaseDate,
        playableTrack,
        commentary
      }
    });
  } catch (err) {
    console.error('[AiMusicRoutes] Identification error:', err);
    return res.status(500).json({
      error: 'An error occurred during song recognition',
      details: err.message
    });
  }
});

export default router;

