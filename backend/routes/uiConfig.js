import express from 'express';
import UiConfig from '../models/UiConfig.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { getDefaultVisibilityMap, UI_VISIBILITY_REGISTRY } from '../constants/uiVisibilityRegistry.js';
import AuditLog from '../models/AuditLog.js';

const router = express.Router();

// Helper to sanitize IP
const getClientIp = (req) => {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
};

/**
 * GET /api/ui-config
 * Publicly readable on app boot, cached locally as fallback.
 * Returns combined visibility map with defaults guaranteed true.
 */
router.get('/', async (req, res) => {
  try {
    const configDoc = await UiConfig.findOne({ key: 'global_ui_visibility' }).lean();
    const defaults = getDefaultVisibilityMap();

    let mergedVisibility = { ...defaults };
    if (configDoc && configDoc.visibility) {
      const stored = configDoc.visibility instanceof Map
        ? Object.fromEntries(configDoc.visibility)
        : configDoc.visibility;

      mergedVisibility = {
        ...defaults,
        ...stored
      };
    }

    res.json({
      success: true,
      visibility: mergedVisibility,
      lastUpdated: configDoc?.lastUpdated || configDoc?.updatedAt || new Date().toISOString()
    });
  } catch (err) {
    console.error('[UiConfig Router] Error fetching ui-config:', err);
    // Graceful fallback to all true
    res.json({
      success: true,
      visibility: getDefaultVisibilityMap(),
      lastUpdated: new Date().toISOString()
    });
  }
});

/**
 * PATCH /api/admin/ui-config
 * Strictly protected by Admin authorization.
 * Accepts partial or full visibility object updates, persists in MongoDB,
 * logs to AuditLog, and emits Socket.io 'ui:config:updated' to all connected clients.
 */
router.patch('/admin/ui-config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { updates, resetAll } = req.body;

    let configDoc = await UiConfig.findOne({ key: 'global_ui_visibility' });
    if (!configDoc) {
      configDoc = new UiConfig({
        key: 'global_ui_visibility',
        visibility: new Map()
      });
    }

    const currentMap = configDoc.visibility instanceof Map
      ? Object.fromEntries(configDoc.visibility)
      : (configDoc.visibility || {});

    let nextMap = { ...currentMap };

    if (resetAll) {
      // Reset all elements in registry to true
      nextMap = getDefaultVisibilityMap();
    } else if (updates && typeof updates === 'object') {
      // Validate and apply keys
      for (const [key, val] of Object.entries(updates)) {
        if (typeof val === 'boolean') {
          nextMap[key] = val;
        }
      }
    }

    configDoc.visibility = nextMap;
    configDoc.updatedBy = req.user?.username || req.user?.email || 'admin';
    configDoc.lastUpdated = new Date();
    await configDoc.save();

    // Create Audit Log
    try {
      await AuditLog.create({
        adminId: req.user?._id?.toString() || req.user?.userId || 'unknown',
        adminUsername: req.user?.username || 'admin',
        action: resetAll ? 'UI_CONFIG_RESET' : 'UI_CONFIG_UPDATE',
        details: {
          summary: resetAll ? 'Reset all UI elements to visible' : 'Updated UI element visibility',
          updates: updates || {},
          totalKeys: Object.keys(nextMap).length
        },
        ip: getClientIp(req),
        status: 'SUCCESS'
      });
    } catch (auditErr) {
      console.warn('[UiConfig Router] AuditLog write warning:', auditErr.message);
    }

    // Broadcast 'ui:config:updated' over Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('ui:config:updated', {
        visibility: nextMap,
        updatedBy: configDoc.updatedBy,
        lastUpdated: configDoc.lastUpdated
      });
    }

    res.json({
      success: true,
      message: resetAll ? 'All UI elements reset to visible' : 'UI visibility configuration updated successfully',
      visibility: nextMap,
      lastUpdated: configDoc.lastUpdated
    });
  } catch (err) {
    console.error('[UiConfig Router] Error updating ui-config:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update UI visibility configuration: ' + err.message
    });
  }
});

export default router;
