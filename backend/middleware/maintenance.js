import { cmsService } from '../services/cmsService.js';
import { verifyToken } from './auth.js';
import User from '../models/User.js';

export const maintenanceMiddleware = async (req, res, next) => {
  try {
    const maintenance = await cmsService.getMaintenanceConfig();
    if (!maintenance || !maintenance.enabled) {
      return next();
    }

    const rawPath = (req.originalUrl || req.url || '').split('?')[0];
    const path = rawPath.replace(/\/+/g, '/').toLowerCase();

    // 1. Minimum necessary exemptions: Health checks, static branding assets, public maintenance status
    if (
      path === '/' ||
      path === '/health' ||
      path === '/api/health' ||
      path.startsWith('/uploads/') ||
      path === '/api/cms/public-config' ||
      path === '/cms/public-config' ||
      path === '/api/cms/maintenance-status' ||
      path === '/favicon.ico' ||
      path === '/loopra-logo.png'
    ) {
      return next();
    }

    // 2. Exempt login endpoints so administrators can authenticate while maintenance is active
    if (
      path === '/api/auth/login' ||
      path === '/auth/login' ||
      path === '/api/auth/google' ||
      path === '/auth/google'
    ) {
      return next();
    }

    // 3. For all other endpoints (search, streaming, user data, playlists, downloads, CMS, admin tools):
    // Validate whether the requester is an authenticated, active administrator via Bearer JWT token.
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (token) {
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        try {
          const user = await User.findById(decoded.userId).select('-password').maxTimeMS(3000);
          if (user && user.status === 'active' && user.role === 'admin') {
            // Authorized administrator: grant complete access to all site features, APIs, and tools
            req.user = user;
            return next();
          }
        } catch (dbErr) {
          console.warn('[Maintenance Middleware] User lookup notice:', dbErr.message);
        }
      }
    }

    // 4. If request is directed to admin routes without valid admin token, let downstream auth return 401/403
    if (path.startsWith('/api/admin')) {
      return next();
    }

    // 5. Block all regular users and guests with 503 Service Unavailable
    res.set('Retry-After', '300');
    return res.status(503).json({
      error: 'Service Unavailable',
      maintenance: true,
      title: maintenance.title || 'Scheduled Maintenance',
      message: maintenance.message || 'We are currently performing scheduled maintenance. Please check back shortly.'
    });
  } catch (err) {
    console.error('[Maintenance Middleware Error]:', err.message);
    // If maintenance check fails unexpectedly, allow request to proceed so server does not crash
    return next();
  }
};

