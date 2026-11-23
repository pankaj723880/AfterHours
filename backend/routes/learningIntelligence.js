import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { learningEngineService } from '../services/learningEngineService.js';

const router = express.Router();

/**
 * 1. POST /api/learning-intelligence/event
 * Ingests a single genuine user behaviour event (authenticated users only).
 * Non-blocking, passive observation.
 */
router.post('/event', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const { category, eventType, metadata = {}, eventId } = req.body || {};

    if (!category || !eventType) {
      return res.status(400).json({ error: 'category and eventType are required' });
    }

    const result = await learningEngineService.recordEvent({
      userId,
      category,
      eventType,
      metadata,
      eventId
    });

    res.json(result);
  } catch (err) {
    console.error('[Learning Event Ingestion Error]:', err.message);
    res.status(500).json({ error: 'Failed to record event: ' + err.message });
  }
});

/**
 * 2. POST /api/learning-intelligence/batch
 * Ingests an array of genuine user behaviour events in a single HTTP payload.
 */
router.post('/batch', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const { events } = req.body || {};

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required' });
    }

    let recordedCount = 0;
    for (const evt of events.slice(0, 50)) {
      if (evt && evt.category && evt.eventType) {
        await learningEngineService.recordEvent({
          userId,
          category: evt.category,
          eventType: evt.eventType,
          metadata: evt.metadata || {},
          eventId: evt.eventId
        });
        recordedCount += 1;
      }
    }

    res.json({ success: true, recordedCount });
  } catch (err) {
    console.error('[Learning Batch Ingestion Error]:', err.message);
    res.status(500).json({ error: 'Failed to record batch: ' + err.message });
  }
});

/**
 * 2b. GET /api/learning-intelligence/my-dna
 * Returns authenticated user's genuine Music DNA & learned profile (Privacy-Isolated).
 */
router.get('/my-dna', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const detail = await learningEngineService.getUserProfileDetail(userId);

    const profile = detail?.profile;
    const learnedGenres = (profile?.learnedGenres || []).slice(0, 6).map(g => ({
      name: g.name,
      score: g.score,
      confidence: Math.round((g.confidence || 0) * 100),
      playCount: g.playCount
    }));

    const topArtists = (profile?.favoriteArtists || []).slice(0, 8).map(a => ({
      name: a.name,
      score: a.score,
      confidence: Math.round((a.confidence || 0) * 100),
      playCount: a.playCount,
      replayCount: a.replayCount,
      skipCount: a.skipCount
    }));

    const languages = (profile?.preferredLanguages || []).slice(0, 5).map(l => ({
      language: l.language,
      score: l.score,
      count: l.count
    }));

    const eras = (profile?.preferredEras || []).slice(0, 5).map(e => ({
      era: e.era,
      score: e.score,
      count: e.count
    }));

    const moods = (profile?.moodPreferences || []).slice(0, 5).map(m => ({
      mood: m.mood,
      score: m.score,
      count: m.count
    }));

    res.json({
      success: true,
      userId,
      confidenceScore: profile?.confidenceScore || 0,
      confidenceLevel: profile?.confidenceLevel || 'low',
      totalEventsObserved: profile?.totalEventsObserved || 0,
      lastLearnedAt: profile?.lastLearnedAt || null,
      peakTimeOfDay: profile?.listeningTimePatterns?.peakTimeOfDay || 'undetermined',
      totalListeningHours: profile?.listeningTimePatterns?.totalListeningHours || 0,
      replayRatio: profile?.repeatedListening?.replayRatio || 0,
      skipRate: profile?.skipPatterns?.skipRate || 0,
      genres: learnedGenres,
      topArtists,
      languages,
      eras,
      moods,
      strongSignals: profile?.signalsSummary?.strongSignals || [],
      uncertainSignals: profile?.signalsSummary?.uncertainSignals || [],
      aiSeededTracks: profile?.aiSeededTracks || [],
      aiSeededMeta: profile?.aiSeededMeta || null
    });
  } catch (err) {
    console.error('[Learning My-DNA Error]:', err.message);
    res.status(500).json({ error: 'Failed to retrieve music DNA: ' + err.message });
  }
});

/**
 * 2c. POST /api/learning-intelligence/ai-seeds
 * Single-request 100+ song AI seeding per user profile (by category & genre).
 * Checks if user profile already has seeds for this category/genre; if not or if refresh requested,
 * generates and persists 100+ valid music tracks (duration >= 75s) to the user's AI learning profile.
 */
router.post('/ai-seeds', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const { category = '', genre = '', currentTrack = null, forceRefresh = false } = req.body || {};

    const cleanCategory = String(category || '').trim().toLowerCase();
    const cleanGenre = String(genre || currentTrack?.genre || '').trim().toLowerCase();

    const result = await learningEngineService.seedUserProfileTracks({
      userId,
      category: cleanCategory,
      genre: cleanGenre,
      currentTrack,
      forceRefresh: Boolean(forceRefresh)
    });

    res.json({
      success: true,
      cached: result.cached,
      count: result.tracks.length,
      tracks: result.tracks,
      meta: result.meta
    });
  } catch (err) {
    console.error('[Learning AI Seeds Error]:', err.message);
    res.status(500).json({ error: 'Failed to seed profile tracks: ' + err.message, tracks: [] });
  }
});

/**
 * 2d. GET /api/learning-intelligence/ai-seeds
 * Retrieves user's persisted AI seeded tracks from profile for immediate offline/fallback cycling.
 */
router.get('/ai-seeds', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const result = await learningEngineService.getUserSeededTracks(userId);
    res.json({
      success: true,
      count: result.tracks.length,
      tracks: result.tracks,
      meta: result.meta
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get seeded tracks: ' + err.message, tracks: [] });
  }
});

/**
 * 2e. GET /api/learning-intelligence/ai-homepage-pool
 * Retrieves user's personalized 200+ song AI Intelligence Homepage pool.
 * Shuffled via Fisher-Yates on every load/refresh.
 * Evolved weekly (7-day cycle) pruning unplayed tracks and topping up with newly discovered genres.
 */
router.get('/ai-homepage-pool', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const forceRefresh = req.query.refresh === 'true';
    const shuffle = req.query.shuffle !== 'false';

    const result = await learningEngineService.getAiHomepagePool(userId, { forceRefresh, shuffle });
    res.json(result);
  } catch (err) {
    console.error('[AI Homepage Pool Error]:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve AI homepage pool: ' + err.message, tracks: [] });
  }
});

/**
 * 3. GET /api/learning-intelligence/admin/overview
 * Returns full intelligence overview, health, metrics, and trends (Admin only).
 */
router.get('/admin/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const overview = await learningEngineService.getAdminOverview();
    res.json(overview);
  } catch (err) {
    console.error('[Learning Admin Overview Error]:', err.message);
    res.status(500).json({ error: 'Failed to load intelligence overview: ' + err.message });
  }
});

/**
 * 4. GET /api/learning-intelligence/admin/users
 * Returns searchable, paginated list of users and their learning profiles (Admin only).
 */
router.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { search = '', page = 1, limit = 15 } = req.query;
    const result = await learningEngineService.getAdminUsersList({
      search,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 15
    });
    res.json(result);
  } catch (err) {
    console.error('[Learning Admin Users Error]:', err.message);
    res.status(500).json({ error: 'Failed to load users: ' + err.message });
  }
});

/**
 * 5. GET /api/learning-intelligence/admin/users/:id
 * Returns deep learning profile for a specific user (Admin only).
 */
router.get('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const data = await learningEngineService.getUserProfileDetail(req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(data);
  } catch (err) {
    console.error('[Learning Admin User Detail Error]:', err.message);
    res.status(500).json({ error: 'Failed to load user profile: ' + err.message });
  }
});

/**
 * 6. POST /api/learning-intelligence/admin/process-now
 * Triggers an immediate learning processing batch cycle (Admin only).
 */
router.post('/admin/process-now', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.body?.limit, 10) || 100;
    const result = await learningEngineService.processPendingEventsBatch(limit);
    res.json({ success: true, result });
  } catch (err) {
    console.error('[Learning Process Now Error]:', err.message);
    res.status(500).json({ error: 'Failed to run batch: ' + err.message });
  }
});

/**
 * 7. DELETE /api/learning-intelligence/admin/users/:id
 * Deletes user's learning profile and all derived learning intelligence data (Admin only).
 */
router.delete('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await learningEngineService.deleteUserLearningData(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('[Learning Delete Profile Error]:', err.message);
    res.status(500).json({ error: 'Failed to delete user profile: ' + err.message });
  }
});

export default router;

