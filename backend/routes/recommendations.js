import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { recommendationEngine } from '../services/recommendationEngine.js';
import { listeningEventService } from '../services/listeningEventService.js';
import UserMusicPreference from '../models/UserMusicPreference.js';
import { catalogService } from '../services/catalogService.js';

const router = express.Router();

// Helper rate limiter for recommendation refresh
const refreshCooldowns = new Map();

/**
 * 1. GET /api/recommendations/personalized
 * Retrieves full personalized recommendations (Made For You, Daily Mix, Discover, etc.)
 */
router.get('/personalized', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const forceRefresh = req.query.refresh === 'true';

    const result = await recommendationEngine.getPersonalizedRecommendations(userId, { forceRefresh });
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('[Recommendations Personalized Error]:', err.message);
    res.status(500).json({ error: 'Failed to generate recommendations: ' + err.message });
  }
});

/**
 * 2. GET /api/recommendations/daily-mix
 * Retrieves user's Daily Mix tracks
 */
router.get('/daily-mix', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const result = await recommendationEngine.getPersonalizedRecommendations(userId);
    res.json({
      success: true,
      items: result.dailyMix || []
    });
  } catch (err) {
    console.error('[Recommendations Daily Mix Error]:', err.message);
    res.status(500).json({ error: 'Failed to load Daily Mix' });
  }
});

/**
 * 3. GET /api/recommendations/discover
 * Retrieves fresh discovery recommendations
 */
router.get('/discover', async (req, res) => {
  try {
    const candidates = await catalogService.getCuratedTracks();
    const shuffled = [...candidates].sort(() => 0.5 - Math.random());
    res.json({
      success: true,
      items: shuffled.slice(0, 12).map(t => ({ ...t, reason: 'Curated Discovery' }))
    });
  } catch (err) {
    console.error('[Recommendations Discover Error]:', err.message);
    res.status(500).json({ error: 'Failed to load discovery recommendations' });
  }
});

/**
 * 4. POST /api/recommendations/listening-events (and POST /api/listening-events)
 * Logs playback events (play_start, progress, completed, skip, like, dislike, repeat)
 */
const handleListeningEvent = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const { trackId, title, artist, channel, thumbnail, eventType, duration, listenedDuration, completionPercent, source, playSessionId } = req.body || {};

    if (!trackId || !title) {
      return res.status(400).json({ error: 'trackId and title are required' });
    }

    const result = await listeningEventService.recordEvent(userId, {
      trackId,
      title,
      artist,
      channel,
      thumbnail,
      eventType,
      duration,
      listenedDuration,
      completionPercent,
      source,
      playSessionId
    });

    const io = req.app_io || req.app?.get('io');
    if (io && result.recorded) {
      try {
        io.to(`user_${userId.toString()}`).emit('listening_stats_updated', {
          userId: userId.toString(),
          trackId,
          eventType,
          isValidPlay: Boolean(result.isValidPlay)
        });
      } catch (e) {}
    }

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('[Listening Event Log Error]:', err.message);
    res.status(500).json({ error: 'Failed to record listening event: ' + err.message });
  }
};

router.post('/listening-events', authenticateToken, handleListeningEvent);

/**
 * 5. POST /api/recommendations/refresh
 * Manually requests a fresh recommendation calculation (rate-limited)
 */
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const now = Date.now();
    const lastRefresh = refreshCooldowns.get(userId.toString());

    if (lastRefresh && (now - lastRefresh) < 60 * 1000) {
      // 1 minute user cooldown
      return res.status(429).json({
        error: 'Please wait at least 1 minute before refreshing recommendations again.',
        cooldownRemainingSeconds: Math.ceil((60 * 1000 - (now - lastRefresh)) / 1000)
      });
    }

    refreshCooldowns.set(userId.toString(), now);

    const result = await recommendationEngine.getPersonalizedRecommendations(userId, { forceRefresh: true });
    res.json({
      success: true,
      refreshed: true,
      data: result
    });
  } catch (err) {
    console.error('[Recommendations Refresh Error]:', err.message);
    res.status(500).json({ error: 'Failed to refresh recommendations' });
  }
});

/**
 * 6. PATCH /api/recommendations/preferences
 * Allows users to toggle personalized recommendations on or off
 */
router.patch('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const { recommendationsEnabled } = req.body;

    if (typeof recommendationsEnabled !== 'boolean') {
      return res.status(400).json({ error: 'recommendationsEnabled must be a boolean' });
    }

    const pref = await UserMusicPreference.findOneAndUpdate(
      { userId },
      { $set: { recommendationsEnabled } },
      { upsert: true, returnDocument: 'after' }
    );

    res.json({
      success: true,
      recommendationsEnabled: pref.recommendationsEnabled
    });
  } catch (err) {
    console.error('[Recommendations Preferences Error]:', err.message);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * 7. GET /api/recommendations/diagnostics
 * Returns recommendation system diagnostics (API latency, cache status, Gemini availability)
 */
router.get('/diagnostics', async (req, res) => {
  try {
    const diagnostics = recommendationEngine.getDiagnostics();
    res.json({
      success: true,
      diagnostics
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get diagnostics' });
  }
});

/**
 * 8. GET /api/recommendations/similar
 * Returns genuine, verified playable tracks similar to a given song
 */
router.get('/similar', async (req, res) => {
  try {
    const trackId = (req.query.trackId || req.query.id || '').trim();
    const title = (req.query.title || '').trim();
    const artist = (req.query.artist || '').trim();
    const genre = (req.query.genre || '').trim();

    if (!title && !artist && !trackId) {
      return res.status(400).json({ error: 'At least trackId, title, or artist is required' });
    }

    const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const cleanArtist = artist.replace(/vevo|official|channel|topic|records/gi, '').trim();

    const searchQueries = [];
    if (cleanArtist && cleanArtist.toLowerCase() !== 'unknown') {
      searchQueries.push(`${cleanArtist} top songs`);
    }
    if (cleanTitle && cleanArtist) {
      searchQueries.push(`${cleanTitle} ${cleanArtist} similar music`);
    } else if (cleanTitle) {
      searchQueries.push(`${cleanTitle} similar songs`);
    }
    if (genre) {
      searchQueries.push(`${genre} music`);
    }

    const candidates = await catalogService.fetchDynamicCandidates(searchQueries, 8);
    // Also include matching curated tracks from catalog
    const curated = await catalogService.getCuratedTracks();
    const matchingCurated = curated.filter(t => {
      const matchArtist = cleanArtist && (t.artist || '').toLowerCase().includes(cleanArtist.toLowerCase());
      const matchGenre = genre && (t.genre || '').toLowerCase().includes(genre.toLowerCase());
      return matchArtist || matchGenre;
    });

    // Merge and deduplicate
    const combined = [...candidates, ...matchingCurated];
    const seen = new Set();
    if (trackId) seen.add(trackId);

    const results = [];
    for (const track of combined) {
      const id = track.id || track.videoId;
      if (!id || seen.has(id)) continue;
      // Do not recommend the exact same title
      if (cleanTitle && (track.title || '').toLowerCase() === cleanTitle.toLowerCase()) continue;
      seen.add(id);
      results.push({
        ...track,
        reason: cleanArtist ? `Similar acoustic vibe to ${cleanArtist}` : 'Recommended based on this track'
      });
      if (results.length >= 12) break;
    }

    res.json({
      success: true,
      originalTrack: { id: trackId, title: cleanTitle || title, artist: cleanArtist || artist },
      items: results
    });
  } catch (err) {
    console.error('[Recommendations Similar Error]:', err.message);
    res.status(500).json({ error: 'Failed to find similar songs: ' + err.message });
  }
});

export default router;
export { handleListeningEvent };

