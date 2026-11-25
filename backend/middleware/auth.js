import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'afterhours_production_jwt_secret_2026_secured';

export const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      username: user.username,
      role: user.role || 'user'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const rawToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1]?.trim() : null;
  const token = rawToken && rawToken !== 'null' && rawToken !== 'undefined' ? rawToken : null;
  req.guestId = (req.headers['x-guest-id'] || '').toString().trim() || null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token is required' });
  }

  const decoded = verifyToken(token);
  const decodedUserId = decoded?.userId || decoded?.id || decoded?._id;
  if (!decoded || !decodedUserId) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  try {
    const user = await User.findById(decodedUserId).select('-password').maxTimeMS(4000);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User account not found' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Forbidden: Account has been suspended' });
    }
    if (user.status === 'deactivated') {
      return res.status(403).json({ error: 'Forbidden: Account has been deactivated' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Internal authentication error: ' + err.message });
  }
};

export const requireAdmin = (req, res, next) => {
  const role = (req.user?.role || '').toLowerCase();
  if (!req.user || (role !== 'admin' && role !== 'superadmin')) {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required' });
  }
  next();
};

export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const rawToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1]?.trim() : null;
  const token = rawToken && rawToken !== 'null' && rawToken !== 'undefined' ? rawToken : null;
  req.guestId = (req.headers['x-guest-id'] || '').toString().trim() || null;

  if (!token) {
    req.user = null;
    return next();
  }
  const decoded = verifyToken(token);
  const decodedUserId = decoded?.userId || decoded?.id || decoded?._id;
  if (!decoded || !decodedUserId) {
    req.user = null;
    return next();
  }
  try {
    const user = await User.findById(decodedUserId).select('-password').maxTimeMS(4000);
    if (user && user.status !== 'suspended' && user.status !== 'deactivated') {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch (_) {
    req.user = null;
  }
  next();
};
