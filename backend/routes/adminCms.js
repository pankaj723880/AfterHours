import express from 'express';
import mongoose from 'mongoose';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { cmsService } from '../services/cmsService.js';
import CuratedCollection from '../models/CuratedCollection.js';
import MediaAsset from '../models/MediaAsset.js';
import ContentVersion from '../models/ContentVersion.js';
import AuditLog from '../models/AuditLog.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import SiteConfig from '../models/SiteConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const router = express.Router();

// Helper to sanitize IP
const getClientIp = (req) => {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
};

// All endpoints in this router require authentication and admin role
router.use(authenticateToken, requireAdmin);

// ==========================================
// 1. GLOBAL SETTINGS & CONFIGURATION
// ==========================================

// Get Draft & Published CMS Configuration
router.get('/config', async (req, res) => {
  try {
    const [draft, published] = await Promise.all([
      cmsService.getDraftConfig(),
      SiteConfig.findOne({ configType: 'published' }).lean()
    ]);

    res.json({
      draft,
      publishedMeta: {
        version: published?.version || 1,
        publishedAt: published?.publishedAt || published?.updatedAt,
        lastModifiedBy: published?.lastModifiedBy || 'system'
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve CMS config: ' + err.message });
  }
});

// Update Draft Configuration (Doesn't affect live website until published)
router.put('/config/draft', async (req, res) => {
  try {
    const updatedDraft = await cmsService.saveDraft(req.body, req.user);

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_DRAFT_SAVE',
      details: { summary: 'Saved draft CMS configuration' },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      message: 'Draft saved successfully',
      draft: updatedDraft
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save draft config: ' + err.message });
  }
});

// Publish Draft to Live Website
router.post('/config/publish', async (req, res) => {
  try {
    const { summary } = req.body;
    const changeSummary = summary?.trim() || 'Admin published CMS configuration';

    const published = await cmsService.publish(req.user, changeSummary);
    const publicConfig = await cmsService.getPublicConfig();

    // Notify connected clients via Socket.io with updated config
    const io = req.app.get('io');
    if (io) {
      io.emit('cms_config_updated', {
        version: published.version,
        publishedAt: published.publishedAt,
        publishedBy: req.user.username,
        config: publicConfig
      });
    }

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_CONFIG_PUBLISH',
      details: { version: published.version, summary: changeSummary },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      message: 'Configuration successfully published to live website!',
      version: published.version,
      publishedAt: published.publishedAt,
      config: publicConfig
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to publish CMS config: ' + err.message });
  }
});

// Quick Maintenance Mode Toggle & Configuration
router.post('/maintenance', async (req, res) => {
  try {
    const { enabled, title, message } = req.body;
    const published = await cmsService.updateMaintenance({ enabled, title, message }, req.user);
    const publicConfig = await cmsService.getPublicConfig();

    const io = req.app.get('io');
    if (io) {
      io.emit('cms_config_updated', {
        version: published.version,
        publishedAt: published.publishedAt,
        publishedBy: req.user.username,
        config: publicConfig
      });
    }

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_MAINTENANCE_TOGGLE',
      details: { enabled, title, message, version: published.version },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      message: `Maintenance mode ${published.maintenance?.enabled ? 'enabled' : 'disabled'} successfully`,
      maintenance: published.maintenance,
      version: published.version
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update maintenance mode: ' + err.message });
  }
});

// ==========================================
// 2. REVISION HISTORY & 1-CLICK ROLLBACK
// ==========================================

// Get Version History
router.get('/versions', async (req, res) => {
  try {
    const versions = await ContentVersion.find({ contentType: 'SITE_CONFIG' })
      .sort({ versionNumber: -1 })
      .limit(30)
      .lean();

    res.json({
      versions: versions.map(v => ({
        id: v._id.toString(),
        versionNumber: v.versionNumber,
        publishedBy: v.publishedBy,
        changeSummary: v.changeSummary,
        createdAt: v.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch version history: ' + err.message });
  }
});

// Restore to a Previous Version
router.post('/versions/:id/restore', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid version ID format' });
    }

    const result = await cmsService.restoreVersion(req.params.id, req.user);

    // Notify connected clients
    const io = req.app.get('io');
    if (io) {
      io.emit('cms_config_updated', {
        version: result.version,
        restored: true,
        restoredBy: req.user.username
      });
    }

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_VERSION_RESTORE',
      targetId: req.params.id,
      details: result,
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore version: ' + err.message });
  }
});

// ==========================================
// 3. CURATED COLLECTIONS & MUSIC MANAGEMENT
// ==========================================

// List all curated collections
router.get('/curated', async (req, res) => {
  try {
    const query = {};
    if (req.query.category) query.category = req.query.category;
    if (req.query.search) {
      const searchRegex = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.name = { $regex: searchRegex, $options: 'i' };
    }

    const collections = await CuratedCollection.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    res.json({
      collections: collections.map(c => ({
        id: c._id.toString(),
        name: c.name,
        slug: c.slug,
        category: c.category,
        description: c.description,
        coverArt: c.coverArt,
        isPublished: c.isPublished,
        isFeaturedOnHome: c.isFeaturedOnHome,
        sortOrder: c.sortOrder || 0,
        tracksCount: (c.tracks || []).length,
        visibleTracksCount: (c.tracks || []).filter(t => !t.isHidden).length,
        updatedAt: c.updatedAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list curated collections: ' + err.message });
  }
});

// Create new curated collection
router.post('/curated', async (req, res) => {
  try {
    const { name, slug, category, description, coverArt, isPublished, isFeaturedOnHome, sortOrder, tracks } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    const cleanSlug = (slug || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const existing = await CuratedCollection.findOne({ slug: cleanSlug });
    if (existing) {
      return res.status(400).json({ error: `A collection with slug "${cleanSlug}" already exists` });
    }

    const newCollection = await CuratedCollection.create({
      name: name.trim(),
      slug: cleanSlug,
      category: category || 'featured',
      description: description?.trim() || '',
      coverArt: coverArt?.trim() || '',
      isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
      isFeaturedOnHome: Boolean(isFeaturedOnHome),
      sortOrder: Number(sortOrder) || 0,
      tracks: Array.isArray(tracks) ? tracks : [],
      createdBy: req.user.username,
      updatedBy: req.user.username
    });

    cmsService.invalidateCache();

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_COLLECTION_CREATE',
      targetId: newCollection._id.toString(),
      targetUsername: newCollection.name,
      details: { slug: cleanSlug, category: newCollection.category },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.status(201).json({
      message: 'Curated collection created successfully',
      collection: newCollection
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create collection: ' + err.message });
  }
});

// Get curated collection by ID with all tracks
router.get('/curated/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid collection ID' });
    }

    const collection = await CuratedCollection.findById(req.params.id).lean();
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    res.json({
      ...collection,
      id: collection._id.toString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get collection: ' + err.message });
  }
});

// Update curated collection metadata
router.put('/curated/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid collection ID' });
    }

    const collection = await CuratedCollection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const { name, category, description, coverArt, isPublished, isFeaturedOnHome, sortOrder } = req.body;

    if (name) collection.name = name.trim();
    if (category) collection.category = category;
    if (description !== undefined) collection.description = description.trim();
    if (coverArt !== undefined) collection.coverArt = coverArt.trim();
    if (isPublished !== undefined) collection.isPublished = Boolean(isPublished);
    if (isFeaturedOnHome !== undefined) collection.isFeaturedOnHome = Boolean(isFeaturedOnHome);
    if (sortOrder !== undefined) collection.sortOrder = Number(sortOrder);

    collection.updatedBy = req.user.username;
    await collection.save();

    cmsService.invalidateCache();

    // Notify clients if featured collection changed
    const io = req.app.get('io');
    if (io && collection.isFeaturedOnHome) {
      io.emit('cms_config_updated', { trigger: 'collection_update', slug: collection.slug });
    }

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_COLLECTION_UPDATE',
      targetId: collection._id.toString(),
      targetUsername: collection.name,
      details: { isPublished: collection.isPublished, isFeaturedOnHome: collection.isFeaturedOnHome },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      message: 'Collection updated successfully',
      collection
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update collection: ' + err.message });
  }
});

// Delete curated collection
router.delete('/curated/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid collection ID' });
    }

    const collection = await CuratedCollection.findByIdAndDelete(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    cmsService.invalidateCache();

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_COLLECTION_DELETE',
      targetId: req.params.id,
      targetUsername: collection.name,
      details: { slug: collection.slug },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({ message: 'Collection deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete collection: ' + err.message });
  }
});

// Add a track to a curated collection
router.post('/curated/:id/tracks', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid collection ID' });
    }

    const collection = await CuratedCollection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const { videoId, title, artist, album, duration, thumbnail, url } = req.body;

    if (!videoId || !videoId.trim()) {
      return res.status(400).json({ error: 'YouTube video ID is required' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Song title is required' });
    }

    const cleanVideoId = videoId.trim();

    // Check if already in collection
    const exists = collection.tracks.some(t => t.videoId === cleanVideoId);
    if (exists) {
      return res.status(400).json({ error: 'Track already exists in this curated collection' });
    }

    const newTrack = {
      id: cleanVideoId,
      videoId: cleanVideoId,
      title: title.trim(),
      artist: artist?.trim() || 'Unknown Artist',
      album: album?.trim() || '',
      duration: duration?.trim() || '',
      thumbnail: thumbnail?.trim() || `https://i.ytimg.com/vi/${cleanVideoId}/hqdefault.jpg`,
      url: url?.trim() || `https://www.youtube.com/watch?v=cleanVideoId`,
      isHidden: false,
      sortOrder: collection.tracks.length + 1
    };

    collection.tracks.push(newTrack);
    collection.updatedBy = req.user.username;
    await collection.save();

    cmsService.invalidateCache();

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_TRACK_ADD',
      targetId: collection._id.toString(),
      targetUsername: collection.name,
      details: { trackTitle: newTrack.title, videoId: cleanVideoId },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.status(201).json({
      message: 'Track added successfully',
      track: newTrack,
      totalTracks: collection.tracks.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add track: ' + err.message });
  }
});

// Update / Reorder tracks in collection
router.put('/curated/:id/tracks', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid collection ID' });
    }

    const collection = await CuratedCollection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const { tracks } = req.body;
    if (!Array.isArray(tracks)) {
      return res.status(400).json({ error: 'Tracks array is required' });
    }

    // Update tracks array with proper sorting order
    collection.tracks = tracks.map((t, idx) => ({
      id: t.id || t.videoId,
      videoId: t.videoId || t.id,
      title: t.title || 'Untitled',
      artist: t.artist || 'Unknown Artist',
      album: t.album || '',
      duration: t.duration || '',
      thumbnail: t.thumbnail || `https://i.ytimg.com/vi/${t.videoId || t.id}/hqdefault.jpg`,
      url: t.url || `https://www.youtube.com/watch?v=${t.videoId || t.id}`,
      isHidden: Boolean(t.isHidden),
      sortOrder: idx + 1
    }));

    collection.updatedBy = req.user.username;
    await collection.save();

    cmsService.invalidateCache();

    res.json({
      message: 'Tracks updated successfully',
      tracks: collection.tracks
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update tracks: ' + err.message });
  }
});

// Remove a track from curated collection
router.delete('/curated/:id/tracks/:trackId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid collection ID' });
    }

    const collection = await CuratedCollection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const initialLen = collection.tracks.length;
    collection.tracks = collection.tracks.filter(
      t => t.id !== req.params.trackId && t.videoId !== req.params.trackId
    );

    if (collection.tracks.length === initialLen) {
      return res.status(404).json({ error: 'Track not found in this collection' });
    }

    collection.updatedBy = req.user.username;
    await collection.save();

    cmsService.invalidateCache();

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_TRACK_REMOVE',
      targetId: collection._id.toString(),
      targetUsername: collection.name,
      details: { removedTrackId: req.params.trackId },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      message: 'Track removed successfully',
      remainingTracks: collection.tracks.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove track: ' + err.message });
  }
});

// ==========================================
// 4. MEDIA & ASSET MANAGEMENT
// ==========================================

// List Media Assets
router.get('/media', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.category && req.query.category !== 'all') {
      query.category = req.query.category;
    }
    if (req.query.search) {
      const searchRegex = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.name = { $regex: searchRegex, $options: 'i' };
    }

    const [assets, total] = await Promise.all([
      MediaAsset.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MediaAsset.countDocuments(query)
    ]);

    res.json({
      assets: assets.map(a => ({
        id: a._id.toString(),
        name: a.name,
        originalName: a.originalName,
        mimeType: a.mimeType,
        size: a.size,
        url: a.url,
        category: a.category,
        altText: a.altText,
        uploadedBy: a.uploadedBy,
        createdAt: a.createdAt
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list media assets: ' + err.message });
  }
});

// Upload Media Asset (Validates mime type & max size <= 5MB, persists data URI to disk)
router.post('/media/upload', async (req, res) => {
  try {
    const { name, dataUrl, url, mimeType, size, category, altText } = req.body;

    const mediaUrl = dataUrl || url;
    if (!mediaUrl) {
      return res.status(400).json({ error: 'Media URL or Data URI is required' });
    }

    // Supported image mime types
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
      'image/gif'
    ];

    const detectedMime = mimeType || (mediaUrl.startsWith('data:') ? mediaUrl.split(';')[0].replace('data:', '') : 'image/jpeg');
    if (!allowedMimeTypes.includes(detectedMime.toLowerCase())) {
      return res.status(400).json({
        error: `Invalid file type "${detectedMime}". Supported types: JPEG, PNG, WEBP, SVG, GIF.`
      });
    }

    // Size check (max 5MB)
    const byteSize = size || (mediaUrl.length * 0.75);
    if (byteSize > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds maximum allowed limit (5MB)' });
    }

    const assetName = (name || 'image_' + Date.now()).trim();
    let finalUrl = mediaUrl;

    // If payload is a base64 data URI, write it to disk under /uploads
    if (mediaUrl.startsWith('data:')) {
      const mime = detectedMime.toLowerCase();
      let ext = 'jpg';
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('svg')) ext = 'svg';
      else if (mime.includes('gif')) ext = 'gif';

      const base64Content = mediaUrl.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');
      const safeFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const filePath = path.join(uploadsDir, safeFilename);

      await fs.promises.writeFile(filePath, buffer);
      finalUrl = `/uploads/${safeFilename}`;
    }

    const asset = await MediaAsset.create({
      name: assetName,
      originalName: name || 'uploaded_asset',
      mimeType: detectedMime.toLowerCase(),
      size: Math.round(byteSize),
      url: finalUrl,
      category: category || 'artwork',
      altText: altText?.trim() || assetName,
      uploadedBy: req.user.username
    });

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_MEDIA_UPLOAD',
      targetId: asset._id.toString(),
      targetUsername: asset.name,
      details: { mimeType: asset.mimeType, size: asset.size, category: asset.category, url: asset.url },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.status(201).json({
      message: 'Media uploaded successfully',
      asset: {
        id: asset._id.toString(),
        name: asset.name,
        url: asset.url,
        mimeType: asset.mimeType,
        size: asset.size,
        category: asset.category,
        altText: asset.altText,
        createdAt: asset.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload media asset: ' + err.message });
  }
});

// Update Media Asset Metadata
router.put('/media/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    const { name, altText, category } = req.body;
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (altText !== undefined) updateData.altText = altText.trim();
    if (category) updateData.category = category;

    const asset = await MediaAsset.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!asset) {
      return res.status(404).json({ error: 'Media asset not found' });
    }

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_MEDIA_UPDATE',
      targetId: asset._id.toString(),
      targetUsername: asset.name,
      details: updateData,
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      message: 'Media asset updated successfully',
      asset: {
        id: asset._id.toString(),
        name: asset.name,
        url: asset.url,
        mimeType: asset.mimeType,
        size: asset.size,
        category: asset.category,
        altText: asset.altText,
        updatedAt: asset.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update media asset: ' + err.message });
  }
});

// Delete Media Asset (and remove local file if in /uploads)
router.delete('/media/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    const asset = await MediaAsset.findByIdAndDelete(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Media asset not found' });
    }

    // If file was persisted in /uploads, remove from disk
    if (asset.url && asset.url.startsWith('/uploads/')) {
      const filename = path.basename(asset.url);
      const filePath = path.join(uploadsDir, filename);
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } catch (unlinkErr) {
        console.warn('[CMS Media Unlink Notice]:', unlinkErr.message);
      }
    }

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_MEDIA_DELETE',
      targetId: req.params.id,
      targetUsername: asset.name,
      details: { category: asset.category, url: asset.url },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({ message: 'Media asset deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete media asset: ' + err.message });
  }
});

// ==========================================
// 5. NOSTALGIA STATIONS MANAGEMENT (CRUD)
// ==========================================

// Get All Stations in Draft
router.get('/stations', async (req, res) => {
  try {
    const draft = await cmsService.getDraftConfig();
    const stations = (draft.stations || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json({ stations });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stations: ' + err.message });
  }
});

// Create New Nostalgia Station
router.post('/stations', async (req, res) => {
  try {
    const title = req.body.title || req.body.name;
    const subtitle = req.body.subtitle || req.body.description;
    const {
      id,
      slug,
      badge,
      artwork,
      icon,
      accentColor,
      category,
      language,
      enabled,
      queries,
      tracks
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Station title is required', message: 'Station title is required' });
    }

    // Slug / ID generation & validation
    const rawSlug = (id || slug || title).trim().toLowerCase();
    const cleanSlug = rawSlug
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!cleanSlug || cleanSlug.length < 2) {
      return res.status(400).json({ error: 'A valid URL-safe station slug is required (at least 2 lowercase alphanumeric characters)', message: 'A valid URL-safe station slug is required' });
    }

    const reservedRoutes = ['home', 'discover', 'mood', 'timemachine', 'activity', 'swipe', 'library', 'history', 'playlists', 'stats', 'equalizer', 'profile', 'admin', 'auth'];
    if (reservedRoutes.includes(cleanSlug)) {
      return res.status(400).json({ error: `The slug "${cleanSlug}" is reserved by core application routes`, message: `The slug "${cleanSlug}" is reserved by core application routes` });
    }

    const draft = await cmsService.getDraftConfig();
    const existingStations = draft.stations || [];
    if (existingStations.some(s => s.id === cleanSlug)) {
      return res.status(409).json({ error: `Station with slug "${cleanSlug}" already exists`, message: `Station with slug "${cleanSlug}" already exists` });
    }

    const newStation = {
      id: cleanSlug,
      title: title.trim().slice(0, 80),
      subtitle: (subtitle || '').trim().slice(0, 300),
      badge: (badge || '').trim().slice(0, 80),
      artwork: (artwork || '').trim().slice(0, 500),
      icon: (icon || 'radio').trim().slice(0, 40),
      accentColor: (accentColor || '#f59e0b').trim().slice(0, 20),
      category: (category || 'Nostalgia Radio').trim().slice(0, 60),
      language: (language || 'Hindi').trim().slice(0, 60),
      enabled: enabled !== false,
      order: existingStations.length + 1,
      bgImages: artwork ? [artwork.trim()] : [],
      queries: Array.isArray(queries) ? queries.map(q => String(q).trim()).filter(Boolean) : [`${title.trim()} songs`],
      tracks: Array.isArray(tracks) ? tracks : []
    };

    const updatedStations = [...existingStations, newStation];
    await cmsService.saveDraft({ stations: updatedStations }, req.user);

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_STATION_CREATE',
      targetId: cleanSlug,
      targetUsername: newStation.title,
      details: { slug: cleanSlug, category: newStation.category },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.status(201).json({
      message: 'Nostalgia Station created in draft',
      station: newStation
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create station: ' + err.message });
  }
});

// Update Nostalgia Station
router.put('/stations/:id', async (req, res) => {
  try {
    const stationId = req.params.id;
    const draft = await cmsService.getDraftConfig();
    const existingStations = [...(draft.stations || [])];
    const index = existingStations.findIndex(s => s.id === stationId);

    if (index === -1) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const cur = existingStations[index];
    const {
      title,
      subtitle,
      badge,
      artwork,
      icon,
      accentColor,
      category,
      language,
      enabled,
      order,
      queries,
      tracks,
      bgImages
    } = req.body;

    const updatedStation = {
      ...cur,
      title: title !== undefined ? String(title).trim().slice(0, 80) : cur.title,
      subtitle: subtitle !== undefined ? String(subtitle).trim().slice(0, 300) : cur.subtitle,
      badge: badge !== undefined ? String(badge).trim().slice(0, 80) : cur.badge,
      artwork: artwork !== undefined ? String(artwork).trim().slice(0, 500) : cur.artwork,
      icon: icon !== undefined ? String(icon).trim().slice(0, 40) : cur.icon,
      accentColor: accentColor !== undefined ? String(accentColor).trim().slice(0, 20) : cur.accentColor,
      category: category !== undefined ? String(category).trim().slice(0, 60) : cur.category,
      language: language !== undefined ? String(language).trim().slice(0, 60) : cur.language,
      enabled: enabled !== undefined ? Boolean(enabled) : cur.enabled,
      order: order !== undefined ? Number(order) : cur.order,
      queries: Array.isArray(queries) ? queries.map(q => String(q).trim()).filter(Boolean) : cur.queries,
      tracks: Array.isArray(tracks) ? tracks : cur.tracks,
      bgImages: Array.isArray(bgImages) ? bgImages : (artwork ? [artwork.trim()] : cur.bgImages)
    };

    existingStations[index] = updatedStation;
    await cmsService.saveDraft({ stations: existingStations }, req.user);

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_STATION_UPDATE',
      targetId: stationId,
      targetUsername: updatedStation.title,
      details: { updatedFields: Object.keys(req.body) },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      message: 'Station updated in draft',
      station: updatedStation
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update station: ' + err.message });
  }
});

// Delete Nostalgia Station
router.delete('/stations/:id', async (req, res) => {
  try {
    const stationId = req.params.id;
    const draft = await cmsService.getDraftConfig();
    const existingStations = draft.stations || [];
    const target = existingStations.find(s => s.id === stationId);

    if (!target) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const filteredStations = existingStations.filter(s => s.id !== stationId);
    await cmsService.saveDraft({ stations: filteredStations }, req.user);

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_STATION_DELETE',
      targetId: stationId,
      targetUsername: target.title,
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({ message: `Station "${target.title}" removed from draft` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete station: ' + err.message });
  }
});

// Add Track to Station
router.post('/stations/:id/tracks', async (req, res) => {
  try {
    const stationId = req.params.id;
    const { videoId, title, artist, album, duration, thumbnail, url } = req.body;

    if (!videoId || !title) {
      return res.status(400).json({ error: 'Track videoId and title are required' });
    }

    const draft = await cmsService.getDraftConfig();
    const existingStations = [...(draft.stations || [])];
    const index = existingStations.findIndex(s => s.id === stationId);

    if (index === -1) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const cleanVid = String(videoId).trim();
    const trackObj = {
      id: cleanVid,
      videoId: cleanVid,
      title: String(title).trim().slice(0, 150),
      artist: String(artist || 'Unknown Artist').trim().slice(0, 100),
      album: String(album || '').trim().slice(0, 100),
      duration: String(duration || '').trim().slice(0, 20),
      thumbnail: thumbnail ? String(thumbnail).trim() : `https://i.ytimg.com/vi/${cleanVid}/hqdefault.jpg`,
      url: url ? String(url).trim() : `https://www.youtube.com/watch?v=${cleanVid}`,
      isHidden: false
    };

    const currentTracks = Array.isArray(existingStations[index].tracks) ? [...existingStations[index].tracks] : [];
    if (!currentTracks.some(t => (t.id === cleanVid || t.videoId === cleanVid))) {
      currentTracks.push(trackObj);
    }

    existingStations[index].tracks = currentTracks;
    await cmsService.saveDraft({ stations: existingStations }, req.user);

    res.status(201).json({
      message: 'Track added to station',
      track: trackObj,
      tracks: currentTracks
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add track: ' + err.message });
  }
});

// Remove Track from Station
router.delete('/stations/:id/tracks/:trackId', async (req, res) => {
  try {
    const { id: stationId, trackId } = req.params;
    const draft = await cmsService.getDraftConfig();
    const existingStations = [...(draft.stations || [])];
    const index = existingStations.findIndex(s => s.id === stationId);

    if (index === -1) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const currentTracks = Array.isArray(existingStations[index].tracks) ? existingStations[index].tracks : [];
    existingStations[index].tracks = currentTracks.filter(t => t.id !== trackId && t.videoId !== trackId);

    await cmsService.saveDraft({ stations: existingStations }, req.user);
    res.json({
      message: 'Track removed from station',
      tracks: existingStations[index].tracks
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove track: ' + err.message });
  }
});

// ==========================================
// 6. WEBSITE NAVIGATION & SIDEBAR MANAGEMENT
// ==========================================

// Get All Navigation Items in Draft
router.get('/navigation', async (req, res) => {
  try {
    const draft = await cmsService.getDraftConfig();
    const navigation = (draft.navigation || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json({ navigation });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch navigation: ' + err.message });
  }
});

// Add Navigation Item
router.post('/navigation', async (req, res) => {
  try {
    const { id, label, icon, badge, group, description, route, enabled } = req.body;
    if (!label || !id) {
      return res.status(400).json({ error: 'Label and destination ID are required' });
    }

    const cleanId = String(id).trim().toLowerCase();
    const cleanLabel = String(label).trim().slice(0, 40);
    const cleanGroup = ['main', 'discovery', 'stations', 'collection', 'system'].includes(group) ? group : 'main';

    const draft = await cmsService.getDraftConfig();
    const existingNav = draft.navigation || [];
    if (existingNav.some(n => n.id === cleanId)) {
      return res.status(400).json({ error: `Navigation item "${cleanId}" already exists` });
    }

    const newItem = {
      id: cleanId,
      label: cleanLabel,
      icon: (icon || 'compass').trim().slice(0, 40),
      badge: (badge || '').trim().slice(0, 20),
      group: cleanGroup,
      description: (description || '').trim().slice(0, 200),
      route: (route || `/${cleanId}`).trim().slice(0, 100),
      enabled: enabled !== false,
      isCore: false,
      order: existingNav.length + 1
    };

    const updatedNav = [...existingNav, newItem];
    await cmsService.saveDraft({ navigation: updatedNav }, req.user);

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_NAV_ADD',
      targetId: cleanId,
      targetUsername: cleanLabel,
      details: { group: cleanGroup, route: newItem.route },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.status(201).json({
      message: 'Navigation item added to draft',
      item: newItem
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add navigation item: ' + err.message });
  }
});

// Update Navigation Item
router.put('/navigation/:id', async (req, res) => {
  try {
    const navId = req.params.id;
    const draft = await cmsService.getDraftConfig();
    const existingNav = [...(draft.navigation || [])];
    const index = existingNav.findIndex(n => n.id === navId);

    if (index === -1) {
      return res.status(404).json({ error: 'Navigation item not found' });
    }

    const cur = existingNav[index];
    const { label, icon, badge, group, description, route, enabled, order } = req.body;

    const updatedItem = {
      ...cur,
      label: label !== undefined ? String(label).trim().slice(0, 40) : cur.label,
      icon: icon !== undefined ? String(icon).trim().slice(0, 40) : cur.icon,
      badge: badge !== undefined ? String(badge).trim().slice(0, 20) : cur.badge,
      group: group && ['main', 'discovery', 'stations', 'collection', 'system'].includes(group) ? group : cur.group,
      description: description !== undefined ? String(description).trim().slice(0, 200) : cur.description,
      route: route !== undefined ? String(route).trim().slice(0, 100) : cur.route,
      enabled: enabled !== undefined ? Boolean(enabled) : cur.enabled,
      order: order !== undefined ? Number(order) : cur.order
    };

    existingNav[index] = updatedItem;
    await cmsService.saveDraft({ navigation: existingNav }, req.user);

    res.json({
      message: 'Navigation item updated in draft',
      item: updatedItem
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update navigation item: ' + err.message });
  }
});

// Delete Navigation Item
router.delete('/navigation/:id', async (req, res) => {
  try {
    const navId = req.params.id;
    const draft = await cmsService.getDraftConfig();
    const existingNav = draft.navigation || [];
    const target = existingNav.find(n => n.id === navId);

    if (!target) {
      return res.status(404).json({ error: 'Navigation item not found' });
    }

    if (target.isCore) {
      return res.status(400).json({
        error: 'Core navigation items cannot be deleted. You can hide them instead.',
        message: 'Core navigation items cannot be deleted. You can hide them instead.'
      });
    }

    const filteredNav = existingNav.filter(n => n.id !== navId);
    await cmsService.saveDraft({ navigation: filteredNav }, req.user);

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_NAV_DELETE',
      targetId: navId,
      targetUsername: target.label,
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({ message: `Navigation item "${target.label}" removed from draft` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete navigation item: ' + err.message });
  }
});

// Reset Navigation Items to System Defaults
router.post('/navigation/reset', async (req, res) => {
  try {
    const defaultNav = [
      { id: 'home', label: 'Home', enabled: true, order: 1, isCore: true, icon: 'home', badge: '', group: 'main', route: '/' },
      { id: 'discover', label: 'Discover & Search', enabled: true, order: 2, isCore: true, icon: 'discover', badge: '', group: 'main', route: '/discover' },
      { id: 'mood', label: 'Mood-to-Music AI', enabled: true, order: 3, isCore: false, icon: 'sparkles', badge: 'AI', group: 'discovery', route: '/mood' },
      { id: 'timemachine', label: 'Time Machine Radio', enabled: true, order: 4, isCore: false, icon: 'radio', badge: 'Retro', group: 'discovery', route: '/timemachine' },
      { id: 'activity', label: 'Listening Activity', enabled: true, order: 5, isCore: false, icon: 'flame', badge: '', group: 'discovery', route: '/activity' },
      { id: 'swipe', label: 'Discover Swipe', enabled: true, order: 6, isCore: false, icon: 'swipe', badge: '', group: 'discovery', route: '/swipe' },
      { id: 'barber', label: 'Saloon FM', enabled: true, order: 7, isCore: false, icon: 'scissors', badge: '90s', group: 'stations', route: '/station/barber' },
      { id: 'truck', label: 'Horn Ok Please', enabled: true, order: 8, isCore: false, icon: 'truck', badge: 'Dhaba', group: 'stations', route: '/station/truck' },
      { id: 'pauwa', label: 'Theka Session', enabled: true, order: 9, isCore: false, icon: 'beer', badge: 'Desi', group: 'stations', route: '/station/pauwa' },
      { id: 'library', label: 'Liked Songs', enabled: true, order: 10, isCore: true, icon: 'library', badge: '', group: 'collection', route: '/library' },
      { id: 'history', label: 'History', enabled: true, order: 11, isCore: true, icon: 'history', badge: '', group: 'collection', route: '/history' },
      { id: 'playlists', label: 'Playlists', enabled: true, order: 12, isCore: true, icon: 'list', badge: '', group: 'collection', route: '/playlists' },
      { id: 'stats', label: 'Recap & Stats', enabled: true, order: 13, isCore: false, icon: 'sparkles', badge: '', group: 'collection', route: '/stats' },
      { id: 'equalizer', label: 'Equalizer', enabled: true, order: 14, isCore: false, icon: 'sliders', badge: '10-Band', group: 'collection', route: '/equalizer' },
      { id: 'profile', label: 'My Profile', enabled: true, order: 15, isCore: false, icon: 'user', badge: '', group: 'collection', route: '/profile' }
    ];

    await cmsService.saveDraft({ navigation: defaultNav }, req.user);

    await AuditLog.create({
      adminId: req.user._id.toString(),
      adminUsername: req.user.username,
      action: 'CMS_NAV_RESET',
      details: { summary: 'Reset navigation to system defaults' },
      ip: getClientIp(req),
      status: 'SUCCESS'
    });

    res.json({
      message: 'Navigation reset to defaults in draft',
      navigation: defaultNav
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset navigation: ' + err.message });
  }
});

export default router;
