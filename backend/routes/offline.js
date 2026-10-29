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
    const { q, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Strict filter: only tracks verified with offlineEligible: true, explicit offline_download_permitted permission,
    // and non-expired license
    const baseFilter = {
      offlineEligible: true,
      permissionScope: 'offline_download_permitted',
      $or: [
        { expiresAt: null },
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    };

    const trimmedQuery = typeof q === 'string' ? q.trim() : '';
    let filter = baseFilter;

    if (trimmedQuery) {
      const escaped = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      filter = {
        $and: [
          baseFilter,
          {
            $or: [
              { title: searchRegex },
              { artist: searchRegex },
              { channel: searchRegex },
              { notes: searchRegex },
              { trackId: searchRegex }
            ]
          }
        ]
      };
    }

    const total = await OfflineTrackLicense.countDocuments(filter);
    const totalEligibleInCatalog = await OfflineTrackLicense.countDocuments(baseFilter);

    const licensed = await OfflineTrackLicense.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

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
        verifiedAt: t.verifiedAt,
        expiresAt: t.expiresAt
      }
    }));

    res.json({
      success: true,
      total,
      totalEligibleInCatalog,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      query: trimmedQuery,
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

router.put('/admin/licenses/:trackId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { trackId } = req.params;
    const cleanId = (trackId || '').trim();
    const existing = await OfflineTrackLicense.findOne({ trackId: cleanId });

    if (!existing) {
      return res.status(404).json({ error: `License record for track '${trackId}' not found.` });
    }

    const {
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

    if (title !== undefined) existing.title = title.trim();
    if (artist !== undefined) existing.artist = artist.trim();
    if (channel !== undefined) existing.channel = channel.trim();
    if (thumbnail !== undefined) existing.thumbnail = thumbnail.trim();
    if (duration !== undefined) existing.duration = duration.trim();
    if (offlineEligible !== undefined) existing.offlineEligible = Boolean(offlineEligible);
    if (sourceProvider !== undefined) existing.sourceProvider = sourceProvider.trim();
    if (permissionScope !== undefined) existing.permissionScope = permissionScope.trim();
    if (licenseType !== undefined) existing.licenseType = licenseType.trim();
    if (licenseReference !== undefined) existing.licenseReference = licenseReference.trim();
    if (notes !== undefined) existing.notes = notes.trim();

    existing.verifiedBy = req.user?.username || 'admin';
    existing.verifiedAt = new Date();

    const saved = await existing.save();
    res.json({ success: true, license: saved });
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

