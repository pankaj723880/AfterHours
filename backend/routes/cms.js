import express from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { cmsService } from '../services/cmsService.js';
import CuratedCollection from '../models/CuratedCollection.js';
import MediaAsset from '../models/MediaAsset.js';
import ContentVersion from '../models/ContentVersion.js';
import AuditLog from '../models/AuditLog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const getClientIp = (req) => {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
};

// ==========================================
// 1. PUBLIC CMS ENDPOINTS (No Auth Required)
// ==========================================

// Get public website configuration (with backward compatible /config alias)
router.get(['/public-config', '/config'], async (req, res) => {
  try {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const config = await cmsService.getPublicConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch public website config: ' + err.message });
  }
});

// Get public maintenance status
router.get('/maintenance-status', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    const maintenance = await cmsService.getMaintenanceConfig();
    res.json(maintenance);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch maintenance status: ' + err.message });
  }
});

// Get public published curated collections
router.get('/curated', async (req, res) => {
  try {
    const collections = await CuratedCollection.find({ isPublished: true })
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
        isFeaturedOnHome: c.isFeaturedOnHome,
        tracksCount: (c.tracks || []).filter(t => !t.isHidden).length
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch curated collections: ' + err.message });
  }
});

// Get tracks for a specific published curated collection by slug or ID
router.get('/curated/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const query = mongoose.Types.ObjectId.isValid(slug)
      ? { $or: [{ slug }, { _id: slug }], isPublished: true }
      : { slug, isPublished: true };

    const collection = await CuratedCollection.findOne(query).lean();
    if (!collection) {
      return res.status(404).json({ error: 'Curated collection not found' });
    }

    res.json({
      id: collection._id.toString(),
      name: collection.name,
      slug: collection.slug,
      category: collection.category,
      description: collection.description,
      coverArt: collection.coverArt,
      tracks: (collection.tracks || [])
        .filter(t => !t.isHidden)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch curated collection: ' + err.message });
  }
});

// ==========================================
// 2. ANDROID APP VERSION MANIFEST ENDPOINT
// ==========================================
router.get(['/app-version', '/version'], async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, s-maxage=60, must-revalidate');
    const versionPath = path.resolve(__dirname, '../../version.json');
    if (fs.existsSync(versionPath)) {
      const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      return res.json(versionData);
    }
    // Fallback default version manifest
    res.json({
      versionName: '2.1',
      versionCode: 21,
      downloadUrl: 'https://loopra1.vercel.app/downloads/loopra.apk',
      directApkUrl: 'https://loopra1.vercel.app/Loopra.apk',
      releaseNotes: 'Official Loopra release',
      releaseDate: new Date().toISOString(),
      minSdkVersion: 24
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read app version: ' + err.message });
  }
});

export default router;
