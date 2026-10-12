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
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token is required' });
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  try {
    const user = await User.findById(decoded.userId).select('-password').maxTimeMS(4000);
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
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required' });
  }
  next();
};
