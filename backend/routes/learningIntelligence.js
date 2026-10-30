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

