import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { analyticsService } from '../services/analyticsService.js';

const router = express.Router();

/**
 * 1. GET /api/analytics/overview
 * Centralized unified single source of truth for both weekly recap & all-time stats.
 */
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const timezone = req.query.timezone || 'UTC';
    const forceRefresh = req.query.forceRefresh === 'true';
    const month = req.query.month;
    const year = req.query.year;

    const result = await analyticsService.getUnifiedOverview(userId, { timezone, forceRefresh, month, year });
    res.json(result);
  } catch (err) {
    console.error('[Analytics Overview Error]:', err.message);
    res.status(500).json({ error: 'Failed to retrieve analytics overview: ' + err.message });
  }
});

/**
 * 2. GET /api/analytics/weekly
 * Dedicated Weekly Recap statistics and daily breakdown.
 */
router.get('/weekly', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const timezone = req.query.timezone || 'UTC';
    const forceRefresh = req.query.forceRefresh === 'true';

    const recap = await analyticsService.getWeeklyRecap(userId, { timezone, forceRefresh });
    res.json({ success: true, userId, weeklyRecap: recap, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Analytics Weekly Error]:', err.message);
    res.status(500).json({ error: 'Failed to retrieve weekly recap: ' + err.message });
  }
});

/**
 * 2b. GET /api/analytics/monthly
 * Dedicated Monthly Recap statistics and daily activity.
 */
router.get('/monthly', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const timezone = req.query.timezone || 'UTC';
    const forceRefresh = req.query.forceRefresh === 'true';
    const month = req.query.month;
    const year = req.query.year;

    const recap = await analyticsService.getMonthlyRecap(userId, { timezone, forceRefresh, month, year });
    res.json({ success: true, userId, monthlyRecap: recap, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Analytics Monthly Error]:', err.message);
    res.status(500).json({ error: 'Failed to retrieve monthly recap: ' + err.message });
  }
});

/**
 * 3. GET /api/analytics/all-time
 * Dedicated All-Time statistics.
 */
router.get('/all-time', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const timezone = req.query.timezone || 'UTC';
    const forceRefresh = req.query.forceRefresh === 'true';

    const allTime = await analyticsService.getAllTimeStats(userId, { timezone, forceRefresh });
    res.json({ success: true, userId, allTimeStats: allTime, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Analytics All-Time Error]:', err.message);
    res.status(500).json({ error: 'Failed to retrieve all-time stats: ' + err.message });
  }
});

/**
 * 4. GET /api/analytics/top-songs
 * Authenticated user's genuine most-played songs.
 */
router.get('/top-songs', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const timezone = req.query.timezone || 'UTC';
    const range = req.query.range || 'weekly'; // 'weekly' | 'monthly' | 'all-time'
    const month = req.query.month;
    const year = req.query.year;

    const data = range === 'all-time'
      ? await analyticsService.getAllTimeStats(userId, { timezone })
      : range === 'monthly'
        ? await analyticsService.getMonthlyRecap(userId, { timezone, month, year })
        : await analyticsService.getWeeklyRecap(userId, { timezone });

    res.json({ success: true, range, topSongs: data.topTracks || [] });
  } catch (err) {
    console.error('[Analytics Top Songs Error]:', err.message);
    res.status(500).json({ error: 'Failed to retrieve top songs: ' + err.message });
  }
});

/**
 * 5. GET /api/analytics/top-artists
 * Authenticated user's genuine most-played artists.
 */
router.get('/top-artists', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const timezone = req.query.timezone || 'UTC';
    const range = req.query.range || 'weekly';
    const month = req.query.month;
    const year = req.query.year;

    const data = range === 'all-time'
      ? await analyticsService.getAllTimeStats(userId, { timezone })
      : range === 'monthly'
        ? await analyticsService.getMonthlyRecap(userId, { timezone, month, year })
        : await analyticsService.getWeeklyRecap(userId, { timezone });

    res.json({ success: true, range, topArtists: data.topArtists || [] });
  } catch (err) {
    console.error('[Analytics Top Artists Error]:', err.message);
    res.status(500).json({ error: 'Failed to retrieve top artists: ' + err.message });
  }
});

/**
 * 6. GET /api/analytics/listening-activity
 * 7-Day daily listening activity bars matching weekly recap totals.
 */
router.get('/listening-activity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const timezone = req.query.timezone || 'UTC';

    const recap = await analyticsService.getWeeklyRecap(userId, { timezone });
    res.json({
      success: true,
      dailyActivity: recap.dailyActivity,
      totalHours: recap.totalHours,
      totalPlays: recap.totalPlays,
      peakDay: recap.peakDay
    });
  } catch (err) {
    console.error('[Analytics Activity Error]:', err.message);
    res.status(500).json({ error: 'Failed to retrieve listening activity: ' + err.message });
  }
});

/**
 * 7. GET /api/analytics/usage
 * Website active usage duration and session count.
 */
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const forceRefresh = req.query.forceRefresh === 'true';
    const stats = await analyticsService.getAllTimeStats(userId, { forceRefresh });
    res.json({
      success: true,
      totalActiveWebsiteSeconds: stats.totalActiveWebsiteSeconds,
      activeDurationSeconds: stats.totalActiveWebsiteSeconds,
      totalActiveWebsiteHours: stats.totalActiveWebsiteHours,
      activeHours: parseFloat(stats.totalActiveWebsiteHours) || 0.0,
      totalSessions: stats.totalSessions,
      sessionCount: stats.totalSessions
    });
  } catch (err) {
    console.error('[Analytics Usage Error]:', err.message);
    res.status(500).json({ error: 'Failed to retrieve usage stats: ' + err.message });
  }
});

/**
 * 8. POST /api/analytics/playback-event
 * Ingests genuine playback telemetry with server-validated timestamps.
 */
router.post('/playback-event', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const result = await analyticsService.recordPlaybackEvent(userId, req.body);
    const io = req.app?.get('io');
    if (io && result.recorded) {
      try {
        io.to(`user_${userId.toString()}`).emit('listening_stats_updated', {
          userId: userId.toString(),
          trackId: req.body?.trackId,
          eventType: req.body?.eventType,
          isValidPlay: Boolean(result.isValidPlay)
        });
      } catch (e) {}
    }
    res.json(result);
  } catch (err) {
    console.error('[Analytics Playback Event Error]:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * 9. POST /api/analytics/website-heartbeat
 * Records active web presence with idle detection.
 */
router.post('/website-heartbeat', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const userAgent = req.headers['user-agent'] || '';
    const result = await analyticsService.recordWebsiteHeartbeat(userId, {
      ...req.body,
      userAgent
    });
    res.json(result);
  } catch (err) {
    console.error('[Analytics Heartbeat Error]:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * 10. POST /api/analytics/website-session-end
 * Concludes a website session.
 */
router.post('/website-session-end', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const { sessionId } = req.body || {};
    await analyticsService.closeWebsiteSession(userId, sessionId);
    res.json({ success: true });
  } catch (err) {
    console.error('[Analytics Session End Error]:', err.message);
    res.status(400).json({ error: err.message });
  }
});

export default router;
