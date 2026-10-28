import express from 'express';
import { 
  checkTrackEligibility, 
  checkBatchEligibility, 
  getAuthorizedAudioBuffer,
  seedDefaultLicensedTracks 
} from '../services/offlineLicenseService.js';
import OfflineTrackLicense from '../models/OfflineTrackLicense.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Batch eligibility check for songs in search results, queues, playlists, home sections
router.post('/eligibility/batch', async (req, res) => {
  try {
    const { trackIds } = req.body || {};
    if (!Array.isArray(trackIds)) {
      return res.status(400).json({ error: 'trackIds must be an array of track IDs.' });
    }

    const results = await checkBatchEligibility(trackIds);
    res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (err) {
    console.error('[Offline Batch Eligibility Error]:', err.message);
    res.status(500).json({ error: 'Failed to verify offline eligibility.' });
  }
});

// Single track eligibility check
router.get('/eligibility/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;
    const result = await checkTrackEligibility(trackId);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('[Offline Eligibility Error]:', err.message);
    res.status(500).json({ error: 'Failed to verify offline eligibility.' });
  }
});

// Download authorized audio binary stream
// STRICT SECURITY RULE: Streaming-only YouTube tracks or unverified tracks are blocked with 403 Forbidden
router.get('/download/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;
    const cleanId = (trackId || '').trim();

    const audioData = await getAuthorizedAudioBuffer(cleanId);
    if (!audioData) {
      return res.status(403).json({
        error: `Forbidden: Offline download is not permitted for track '${cleanId}'. This track is subject to streaming-only provider terms, or offline rights could not be verified.`
      });
    }

    const { buffer, mimeType, filename, record } = audioData;

    res.setHeader('Content-Type', mimeType || 'audio/wav');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Offline-License-Type', record.licenseType || 'Direct-License');
    res.setHeader('X-Offline-Provider', record.sourceProvider || 'admin_upload');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    res.status(200).end(buffer);
  } catch (err) {
    console.error('[Offline Download Error]:', err.message);
    res.status(500).json({ error: 'Failed to retrieve authorized audio download.' });
  }
});

// Discover authorized offline-eligible tracks catalog
router.get('/authorized-tracks', async (req, res) => {
  try {
    const licensed = await OfflineTrackLicense.find({ 
      offlineEligible: true,
      permissionScope: 'offline_download_permitted' 
    }).sort({ createdAt: -1 }).lean();

    const safeTracks = licensed.map(t => ({
      id: t.trackId,
      videoId: t.trackId,
      title: t.title,
      artist: t.artist,
      channel: t.channel || t.artist,
      thumbnail: t.thumbnail,
      duration: t.duration,
      offlineEligible: true,
      license: {
        provider: t.sourceProvider,
        permissionScope: t.permissionScope,
        licenseType: t.licenseType,
        licenseReference: t.licenseReference,
        audioMimeType: t.audioMimeType,
        audioSizeBytes: t.audioSizeBytes,
        downloadEndpoint: `/api/offline/download/${encodeURIComponent(t.trackId)}`,
        verifiedBy: t.verifiedBy,
        verifiedAt: t.verifiedAt
      }
    }));

    res.json({
      success: true,
      tracks: safeTracks
    });
  } catch (err) {
    console.error('[Offline Catalog Error]:', err.message);
    res.status(500).json({ error: 'Failed to list authorized offline tracks.' });
  }
});

// Admin endpoints for managing offline licensing records
router.get('/admin/licenses', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const licenses = await OfflineTrackLicense.find().sort({ createdAt: -1 });
    res.json({ success: true, licenses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/licenses', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      trackId, 
      title, 
      artist, 
      channel, 
      thumbnail, 
      duration, 
      offlineEligible, 
      sourceProvider, 
      permissionScope, 
      licenseType, 
      licenseReference,
      notes 
    } = req.body;

    if (!trackId || !title) {
      return res.status(400).json({ error: 'trackId and title are required.' });
    }

    const updated = await OfflineTrackLicense.findOneAndUpdate(
      { trackId: trackId.trim() },
      {
        trackId: trackId.trim(),
        title: title.trim(),
        artist: artist || 'Unknown Artist',
        channel: channel || '',
        thumbnail: thumbnail || '',
        duration: duration || '',
        offlineEligible: Boolean(offlineEligible),
        sourceProvider: sourceProvider || 'direct_license',
        permissionScope: permissionScope || 'offline_download_permitted',
        licenseType: licenseType || 'Direct-License',
        licenseReference: licenseReference || '',
        verifiedBy: req.user?.username || 'admin',
        verifiedAt: new Date(),
        notes: notes || ''
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ success: true, license: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/licenses/:trackId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { trackId } = req.params;
    await OfflineTrackLicense.findOneAndDelete({ trackId: (trackId || '').trim() });
    res.json({ success: true, message: `License for track '${trackId}' revoked.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

