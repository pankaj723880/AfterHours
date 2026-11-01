/**
 * Loopra Music Validation Routes
 * Authoritative backend validation gate for music-only playback.
 */

import express from 'express';
import musicValidationService from '../services/musicValidationService.js';

const router = express.Router();

/**
 * POST /api/music/validate-playback
 * Final authoritative security gate called immediately before player loads a track.
 */
router.post('/validate-playback', async (req, res) => {
  try {
    const { videoId, id, title, artist, channel, duration, categoryId } = req.body || {};
    const trackId = videoId || id;

    if (!trackId) {
      return res.status(400).json({
        eligible: false,
        isMusic: false,
        confidence: 0.0,
        category: 'invalid',
        reason: 'Missing YouTube videoId in playback request'
      });
    }

    const validation = await musicValidationService.validateTrack({
      id: trackId,
      videoId: trackId,
      title,
      artist,
      channel,
      duration,
      categoryId
    });

    return res.json(validation);
  } catch (err) {
    console.error('[MusicValidationRoute] Playback validation error:', err);
    return res.status(500).json({
      eligible: false,
      isMusic: false,
      confidence: 0.0,
      category: 'error',
      reason: 'Validation service error: failed safe by rejecting unverified track'
    });
  }
});

/**
 * GET /api/music/validate/:videoId
 * Quick lookup by videoId
 */
router.get('/validate/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { title, channel } = req.query;

    const validation = await musicValidationService.validateTrack({
      id: videoId,
      videoId,
      title,
      channel
    });

    return res.json(validation);
  } catch (err) {
    console.error('[MusicValidationRoute] Lookup error:', err);
    return res.status(500).json({
      eligible: false,
      isMusic: false,
      reason: 'Validation lookup error'
    });
  }
});

/**
 * POST /api/music/batch-validate
 * Batch validate an array of tracks
 */
router.post('/batch-validate', async (req, res) => {
  try {
    const { tracks } = req.body || {};
    if (!Array.isArray(tracks)) {
      return res.status(400).json({ error: 'Tracks array is required' });
    }

    const results = await musicValidationService.batchValidateTracks(tracks);
    return res.json({
      total: tracks.length,
      eligibleCount: results.filter(r => r.eligible).length,
      results
    });
  } catch (err) {
    console.error('[MusicValidationRoute] Batch validation error:', err);
    return res.status(500).json({ error: 'Batch validation failed' });
  }
});

export default router;
