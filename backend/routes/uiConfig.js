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
 * UI Visibility Configuration Handler
 * Handles GET (fetch visibility) and PATCH/POST/PUT (update visibility)
 */
const handleUiConfig = async (req, res, next) => {
  if (req.method === 'GET') {
    try {
      const configDoc = await UiConfig.findOne({ key: 'global_ui_visibility' }).lean();
      const defaults = getDefaultVisibilityMap();

      let mergedVisibility = { ...defaults };
      if (configDoc && configDoc.visibility) {
        const stored = configDoc.visibility instanceof Map
          ? Object.fromEntries(configDoc.visibility)
          : configDoc.visibility;

        if (stored && typeof stored === 'object') {
          mergedVisibility = {
            ...defaults,
            ...stored
          };
        }
      }

      return res.json({
        success: true,
        visibility: mergedVisibility,
        lastUpdated: configDoc?.lastUpdated || configDoc?.updatedAt || new Date().toISOString()
      });
    } catch (err) {
      console.error('[UiConfig Router] Error fetching ui-config:', err);
      return res.json({
        success: true,
        visibility: getDefaultVisibilityMap(),
        lastUpdated: new Date().toISOString()
      });
    }
  }

  if (['PATCH', 'POST', 'PUT'].includes(req.method)) {
    return authenticateToken(req, res, () => {
      return requireAdmin(req, res, async () => {
        try {
          const { updates, resetAll } = req.body || {};

          let configDoc = await UiConfig.findOne({ key: 'global_ui_visibility' });
          if (!configDoc) {
            configDoc = new UiConfig({
              key: 'global_ui_visibility',
              visibility: {}
            });
          }

          let currentMap = {};
          if (configDoc.visibility instanceof Map) {
            currentMap = Object.fromEntries(configDoc.visibility);
          } else if (configDoc.visibility && typeof configDoc.visibility === 'object') {
            currentMap = { ...configDoc.visibility };
          }

          let nextMap = { ...getDefaultVisibilityMap(), ...currentMap };

          if (resetAll) {
            nextMap = getDefaultVisibilityMap();
          } else if (updates && typeof updates === 'object') {
            const rawUpdates = updates instanceof Map ? Object.fromEntries(updates) : updates;
            for (const [key, val] of Object.entries(rawUpdates)) {
              if (typeof val === 'boolean') {
                nextMap[key] = val;
              } else if (val === 'true' || val === 'false') {
                nextMap[key] = val === 'true';
              }
            }
          }

          // Persist cleanly without Mongoose Cast to Map errors
          configDoc.visibility = nextMap;
          configDoc.markModified('visibility');
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

          return res.json({
            success: true,
            message: resetAll ? 'All UI elements reset to visible' : 'UI visibility configuration updated successfully',
            visibility: nextMap,
            lastUpdated: configDoc.lastUpdated
          });
        } catch (err) {
          console.error('[UiConfig Router] Error updating ui-config:', err);
          return res.status(500).json({
            success: false,
            error: 'Failed to update UI visibility configuration: ' + err.message
          });
        }
      });
    });
  }

  next();
};

router.all(['/', '/ui-config', '/admin/ui-config'], handleUiConfig);
router.use(handleUiConfig);

export default router;
