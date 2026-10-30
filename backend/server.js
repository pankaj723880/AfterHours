import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import axios from 'axios';
import ytSearch from 'yt-search';
import { OAuth2Client } from 'google-auth-library';
import User from './models/User.js';
import AuditLog from './models/AuditLog.js';
import { generateToken, verifyToken, authenticateToken, requireAdmin } from './middleware/auth.js';
import { metricsService } from './services/metrics.js';
import adminRoutes from './routes/admin.js';
import cmsRoutes from './routes/cms.js';
import adminCmsRoutes from './routes/adminCms.js';
import offlineRoutes from './routes/offline.js';
import { seedDefaultLicensedTracks } from './services/offlineLicenseService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { cmsService } from './services/cmsService.js';
import { maintenanceMiddleware } from './middleware/maintenance.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import profileRoutes from './routes/profile.js';
import activityRoutes from './routes/activity.js';
import moodRoutes from './routes/mood.js';
import radioRoutes from './routes/radio.js';
import recommendationRoutes, { handleListeningEvent } from './routes/recommendations.js';
import aiMusicRoutes from './routes/aiMusic.js';
import { isSingleSong, filterSingleSongs } from './services/songFilter.js';
import { liveUsersService } from './services/liveUsersService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Prevent unhandled rejections and exceptions from crashing the server
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err.message, err.stack);
  try { fs.appendFileSync(path.join(__dirname, 'server_error.log'), `[uncaughtException] ${err.stack || err.message}\n`); } catch(e){}
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
  try { fs.appendFileSync(path.join(__dirname, 'server_error.log'), `[unhandledRejection] ${reason?.stack || reason}\n`); } catch(e){}
});

process.on('exit', (code) => {
  console.log('[PROCESS EXIT EVENT] code:', code);
  try { fs.appendFileSync(path.join(__dirname, 'server_error.log'), `[exit] code=${code} at ${new Date().toISOString()}\n`); } catch(e){}
});
process.on('SIGINT', () => {
  console.log('[PROCESS SIGNAL] SIGINT');
  try { fs.appendFileSync(path.join(__dirname, 'server_error.log'), `[SIGINT] at ${new Date().toISOString()}\n`); } catch(e){}
});
process.on('SIGTERM', () => {
  console.log('[PROCESS SIGNAL] SIGTERM');
  try { fs.appendFileSync(path.join(__dirname, 'server_error.log'), `[SIGTERM] at ${new Date().toISOString()}\n`); } catch(e){}
});

dotenv.config();
dotenv.config({ path: '../.env' });

const oauthClient = new OAuth2Client();
const app = express();
const server = http.createServer(app);

// Helper to parse single or comma-separated origins from environment variables
const parseOrigins = (val) => {
  if (!val) return [];
  return val.split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
};

// Allowed origins for CORS (Both Old & New Production Vercel domains + Localhost)
const allowedOrigins = [
  'https://after-hours-five-beryl.vercel.app',
  'https://loopra1.vercel.app',
  'https://loopra.vercel.app',
  ...parseOrigins(process.env.CLIENT_URL),
  ...parseOrigins(process.env.FRONTEND_URL),
  ...parseOrigins(process.env.ALLOWED_ORIGINS),
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow curl, same-origin, or non-browser server requests
  const normalizedOrigin = origin.trim().replace(/\/+$/, '');
  if (allowedOrigins.includes(normalizedOrigin)) return true;
  if (/^https:\/\/(after-hours|loopra1?)[a-z0-9-]*\.vercel\.app$/.test(normalizedOrigin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) return true;
  return false;
};

// Express CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Session-ID'],
  optionsSuccessStatus: 204
}));

// Set Cross-Origin-Opener-Policy header to permit Google Sign-In popups and postMessage communication
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// Generous payload limit so sync never throws 413 or truncates
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

// Normalize redundant slashes in URL pathname to prevent 404s from client URL misconfigurations (e.g. //health, //api/...)
app.use((req, res, next) => {
  const normalize = (urlStr) => {
    if (!urlStr) return urlStr;
    const queryIndex = urlStr.indexOf('?');
    const path = queryIndex !== -1 ? urlStr.slice(0, queryIndex) : urlStr;
    const search = queryIndex !== -1 ? urlStr.slice(queryIndex) : '';
    return path.replace(/\/+/g, '/') + search;
  };
  if (req.url && req.url.includes('//')) req.url = normalize(req.url);
  if (req.originalUrl && req.originalUrl.includes('//')) req.originalUrl = normalize(req.originalUrl);
  next();
});

// Live Request Tracking Middleware for Admin Observability
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
      .toString()
      .split(',')[0]
      .trim();
    metricsService.recordRequest({
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs,
      ip
    });
  });
  next();
});

// Socket.io Setup with CORS & Transports
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 30000,
});

app.set('io', io);

io.engine.on('connection_error', (err) => {
  console.warn('[Socket.io] Engine connection notice:', err.req?.url, err.code, err.message);
});

// Authenticated Socket.io Handshake for Admin Subscriptions
const activeUserSocketMap = new Map(); // socket.id -> userId string

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || 
      (socket.handshake.headers?.authorization && socket.handshake.headers.authorization.replace('Bearer ', ''));

    if (token) {
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        if (mongoose.connection.readyState === 1) {
          const user = await User.findById(decoded.userId).select('role status username').lean();
          if (user && user.status === 'active') {
            socket.user = user;
            activeUserSocketMap.set(socket.id, user._id.toString());
            if (user.role === 'admin') {
              socket.join('admin_room');
            }
          }
        }
      }
    }
  } catch (err) {
    // Non-fatal, regular socket continues
  }
  next();
});

// MongoDB Connection Resilience & Fail-Fast settings
mongoose.set('bufferCommands', false);

let isMongoConnected = false;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
})
  .then(() => {
    isMongoConnected = true;
    console.log('[MongoDB] Connected successfully');
    seedDefaultAdmin();
    metricsService.initPersistence();
    cmsService.initDefaults();
    liveUsersService.init({ io, metricsService });
  })
  .catch((err) => {
    isMongoConnected = false;
    console.warn('[MongoDB] Initial connection error (will retry in background):', err.message);
  });

mongoose.connection.on('connected', () => {
  isMongoConnected = true;
  console.log('[MongoDB] Connection established');
  seedDefaultAdmin();
  metricsService.initPersistence();
  cmsService.initDefaults();
  seedDefaultLicensedTracks();
  liveUsersService.init({ io, metricsService });
});

mongoose.connection.on('error', (err) => {
  isMongoConnected = false;
  console.warn('[MongoDB] Connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  isMongoConnected = false;
  console.warn('[MongoDB] Disconnected. Waiting for reconnection...');
});

const isDatabaseReady = () => {
  return mongoose.connection.readyState === 1;
};

// Global Maintenance Mode Guard
app.use(maintenanceMiddleware);

// Public Live Users Display Endpoint (never exposes admin config or raw analytics)
app.get('/api/public/live-users', (req, res) => {
  res.json(liveUsersService.getPublicDisplayCount());
});

// Health check endpoints for Render & API monitors
app.get('/', (req, res) => {
  res.send('AfterHours API is running');
});

app.get(['/health', '/api/health'], (req, res) => {
  const ready = isDatabaseReady();
  res.json({
    status: 'ok',
    database: ready ? 'connected' : 'disconnected',
    readyState: mongoose.connection.readyState,
    timestamp: new Date().toISOString()
  });
});

// Socket.io for Real-time Active Users & Admin Streams
io.on('connection', (socket) => {
  const sessionId = socket.handshake.auth?.sessionId || 
    socket.handshake.query?.sessionId || 
    socket.handshake.headers?.['x-session-id'];
  const ip = (socket.handshake.headers?.['x-forwarded-for'] || socket.conn?.remoteAddress || 'unknown')
    .toString().split(',')[0].trim();
  const userAgent = socket.handshake.headers?.['user-agent'] || 'unknown';

  metricsService.registerVisitorConnection({
    socketId: socket.id,
    sessionId,
    user: socket.user,
    ip,
    userAgent
  });

  const snapshot = metricsService.getSnapshot();

  // Send current live display count to connecting client
  socket.emit('active_users', liveUsersService.getPublicDisplayCount().count);

  // If in Real Live Users mode, broadcast newly updated real presence count
  if (liveUsersService.mode === 'real') {
    liveUsersService.broadcastDisplayCount();
  }

  // If newly connected socket is admin, send immediate snapshot & live users config
  if (socket.user && socket.user.role === 'admin') {
    socket.emit('admin_live_metrics', snapshot);
    socket.emit('admin_live_users_config', liveUsersService.getAdminConfig());
  }

  socket.on('disconnect', () => {
    metricsService.handleVisitorDisconnect(socket.id);
    activeUserSocketMap.delete(socket.id);
    // If in Real Live Users mode, update public count immediately on disconnect
    if (liveUsersService.mode === 'real') {
      liveUsersService.broadcastDisplayCount();
    }
  });
});

// Push live metrics to authorized admin room only
setInterval(() => {
  const adminRoom = io.sockets.adapter.rooms.get('admin_room');
  if (adminRoom && adminRoom.size > 0) {
    io.to('admin_room').emit('admin_live_metrics', metricsService.getSnapshot());
  }
}, 2500);

// Helper for Admin Bootstrap Email Checking
const DEFAULT_BOOTSTRAP_ADMIN_EMAILS = [
  'pankajsss7238@gmail.com',
  'pss809352@gmail.com',
  'ps207800@gmail.com',
  'admin@afterhours.com'
];

const getAdminEmails = () => {
  const raw = process.env.ADMIN_EMAILS || DEFAULT_BOOTSTRAP_ADMIN_EMAILS.join(',');
  const list = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set([...list, ...DEFAULT_BOOTSTRAP_ADMIN_EMAILS]));
};

const isEmailBootstrapAdmin = (email) => {
  if (!email) return false;
  const list = getAdminEmails();
  return list.includes(email.toLowerCase());
};

// Automatic administrator seeding on production startup
let hasSeededAdmin = false;
const seedDefaultAdmin = async () => {
  if (hasSeededAdmin || mongoose.connection.readyState !== 1) return;
  try {
    const existing = await User.findOne({ username: 'admin@afterhours.com' }).maxTimeMS(4000);
    if (!existing) {
      await User.create({
        username: 'admin@afterhours.com',
        password: 'admin123',
        role: 'admin',
        status: 'active'
      });
      console.log('[Admin Seed] Successfully initialized default admin@afterhours.com account');
    } else if (existing.role !== 'admin' || existing.password !== 'admin123') {
      existing.role = 'admin';
      existing.password = 'admin123';
      existing.status = 'active';
      await existing.save();
      console.log('[Admin Seed] Updated admin@afterhours.com credentials to active admin');
    }

    // Ensure authorized admin emails have admin role
    await User.updateMany(
      { username: { $in: DEFAULT_BOOTSTRAP_ADMIN_EMAILS }, role: { $ne: 'admin' } },
      { $set: { role: 'admin' } }
    );
    hasSeededAdmin = true;
  } catch (err) {
    console.warn('[Admin Seed Notice]:', err.message);
  }
};

// Rate Limiting Instances
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many authentication attempts. Please wait a minute and try again.'
});

const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many search requests. Please wait a moment.'
});

// Auth Routes with Database Availability Guards
app.post(['/api/auth/register', '/auth/register'], authLimiter, async (req, res) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({ error: 'Database service is temporarily unavailable. Please try again shortly.', retryable: true });
  }
  const maintenance = await cmsService.getMaintenanceConfig();
  if (maintenance?.enabled) {
    return res.status(503).json({
      error: 'Registration is temporarily unavailable due to scheduled maintenance.',
      maintenance: true,
      title: maintenance.title,
      message: maintenance.message
    });
  }
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const cleanUsername = username.trim().toLowerCase();
    const existing = await User.findOne({ username: cleanUsername }).maxTimeMS(4000);
    if (existing) return res.status(400).json({ error: 'Username exists' });

    // Enforce least privilege: role is strictly 'user'
    const user = new User({
      username: cleanUsername,
      password,
      role: 'user',
      status: 'active',
      likedSongs: [],
      history: [],
      searchHistory: [],
      playlists: [],
      queue: []
    });
    await user.save();
    const token = generateToken(user);

    res.json({
      message: 'User registered',
      token,
      userId: user._id,
      user: {
        id: user._id,
        userId: user._id,
        username: user.username,
        displayName: user.displayName || user.username,
        avatarUrl: user.avatarUrl || '',
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    console.error('[Register Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/auth/login', '/auth/login'], authLimiter, async (req, res) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({ error: 'Database service is temporarily unavailable. Please try again shortly.', retryable: true });
  }
  const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString().split(',')[0].trim();
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = typeof password === 'string' ? password.trim() : password;
    console.log(`[Auth Login Attempt]: username="${cleanUsername}", password length=${cleanPassword ? cleanPassword.length : 0}`);
    const user = await User.findOne({ 
      username: cleanUsername,
      $or: [
        { password: cleanPassword },
        { password: password }
      ]
    }).maxTimeMS(4000);
    if (!user) {
      console.warn(`[Auth Login Failed]: username="${cleanUsername}" - user not found or password mismatch`);
      metricsService.recordFailedLogin({
        ip: clientIp,
        username: cleanUsername,
        userAgent: req.headers['user-agent'],
        reason: 'invalid_credentials'
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      metricsService.recordFailedLogin({
        ip: clientIp,
        username: cleanUsername,
        userAgent: req.headers['user-agent'],
        reason: 'account_suspended'
      });
      return res.status(403).json({ error: 'Account has been suspended. Please contact support.' });
    }
    if (user.status === 'deactivated') {
      metricsService.recordFailedLogin({
        ip: clientIp,
        username: cleanUsername,
        userAgent: req.headers['user-agent'],
        reason: 'account_deactivated'
      });
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    const maintenance = await cmsService.getMaintenanceConfig();
    if (maintenance?.enabled && user.role !== 'admin') {
      return res.status(503).json({
        error: 'System is currently undergoing scheduled maintenance. Only authorized administrators can log in at this time.',
        maintenance: true,
        title: maintenance.title,
        message: maintenance.message
      });
    }

    user.lastLogin = new Date();
    await user.save();
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      userId: user._id,
      user: {
        id: user._id,
        userId: user._id,
        username: user.username,
        displayName: user.displayName || user.username,
        avatarUrl: user.avatarUrl || '',
        role: user.role,
        status: user.status,
        likedSongs: user.likedSongs,
        history: user.history,
        searchHistory: user.searchHistory || [],
        playlists: user.playlists,
        queue: user.queue
      }
    });
  } catch (err) {
    console.error('[Login Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/auth/me', '/auth/me'], authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      user: {
        id: user._id,
        userId: user._id,
        username: user.username,
        displayName: user.displayName || user.username,
        avatarUrl: user.avatarUrl || '',
        role: user.role,
        status: user.status,
        likedSongs: user.likedSongs,
        history: user.history,
        searchHistory: user.searchHistory || [],
        playlists: user.playlists,
        queue: user.queue
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/auth/google', '/auth/google'], async (req, res) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({ error: 'Database service is temporarily unavailable. Please try again shortly.', retryable: true });
  }
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Google ID token is required' });
    }
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '335095702236-g3n6b7mgq2d3vbdg9qj9vv53b3nuohs7.apps.googleusercontent.com';
    const ticket = await oauthClient.verifyIdToken({
      idToken: token,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    const email = payload?.email;

    if (!email) {
      return res.status(400).json({ error: 'Google account email could not be verified' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const googleName = (payload?.name || '').trim();
    const googlePicture = (payload?.picture || '').trim();
    let user = await User.findOne({ username: cleanEmail }).maxTimeMS(4000);
    const shouldBeAdmin = isEmailBootstrapAdmin(cleanEmail);

    if (!user) {
      // Check if there are no admins at all in DB, allow bootstrapping if explicitly configured
      const existingAdminsCount = await User.countDocuments({ role: 'admin' });
      const makeAdmin = shouldBeAdmin || (existingAdminsCount === 0 && process.env.BOOTSTRAP_FIRST_USER_AS_ADMIN === 'true');

      user = new User({
        username: cleanEmail,
        displayName: googleName || cleanEmail.split('@')[0],
        avatarUrl: googlePicture || '',
        password: 'google_oauth_user',
        role: makeAdmin ? 'admin' : 'user',
        status: 'active',
        lastLogin: new Date(),
        likedSongs: [],
        history: [],
        playlists: [],
        queue: []
      });
      await user.save();
    } else {
      // If user matched bootstrap admin email in environment, promote to admin
      if (shouldBeAdmin && user.role !== 'admin') {
        user.role = 'admin';
      }
      // Populate avatarUrl if empty and available from Google OAuth
      if (!user.avatarUrl && googlePicture) {
        user.avatarUrl = googlePicture;
      }
      // Populate displayName if default or empty
      if ((!user.displayName || user.displayName === user.username) && googleName) {
        user.displayName = googleName;
      }
      user.lastLogin = new Date();
      await user.save();
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account has been suspended.' });
    }
    if (user.status === 'deactivated') {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    const maintenance = await cmsService.getMaintenanceConfig();
    if (maintenance?.enabled && user.role !== 'admin') {
      return res.status(503).json({
        error: 'System is currently undergoing scheduled maintenance. Only authorized administrators can log in at this time.',
        maintenance: true,
        title: maintenance.title,
        message: maintenance.message
      });
    }

    const appToken = generateToken(user);

    res.json({
      message: 'Google Login successful',
      token: appToken,
      userId: user._id,
      user: {
        id: user._id,
        userId: user._id,
        username: user.username,
        displayName: user.displayName || user.username,
        avatarUrl: user.avatarUrl || '',
        role: user.role,
        status: user.status,
        likedSongs: user.likedSongs,
        history: user.history,
        searchHistory: user.searchHistory || [],
        playlists: user.playlists,
        queue: user.queue
      },
      username: user.username,
      role: user.role
    });
  } catch (err) {
    console.warn('[Google Auth Error]:', err.message);
    res.status(401).json({ error: 'Google Auth failed: ' + err.message });
  }
});

// User Data Sync
app.get(['/api/user/:id', '/user/:id'], async (req, res) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({ error: 'Database service is temporarily unavailable. Please retry shortly.', retryable: true });
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  try {
    const user = await User.findById(req.params.id).maxTimeMS(4000);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      likedSongs: user.likedSongs || [],
      history: user.history || [],
      searchHistory: user.searchHistory || [],
      playlists: user.playlists || [],
      queue: user.queue || []
    });
  } catch (err) {
    console.error('[User GET Error]:', err.message);
    res.status(500).json({ error: 'Failed to retrieve user data: ' + err.message });
  }
});

app.post(['/api/user/:id/sync', '/user/:id/sync'], async (req, res) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({ error: 'Database service is temporarily unavailable. Please retry shortly.', retryable: true });
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  try {
    const { likedSongs, history, searchHistory, playlists, queue } = req.body || {};
    const update = {};
    if (Array.isArray(likedSongs)) update.likedSongs = likedSongs.slice(0, 500);
    if (Array.isArray(history)) update.history = history.slice(0, 100);
    if (Array.isArray(searchHistory)) update.searchHistory = searchHistory.slice(0, 50);
    if (Array.isArray(playlists)) update.playlists = playlists.slice(0, 100);
    if (Array.isArray(queue)) update.queue = queue.slice(0, 200);

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { returnDocument: 'after', runValidators: true }
    ).maxTimeMS(4000);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Synced', timestamp: Date.now() });
  } catch (err) {
    console.error('[User Sync Error]:', err.message);
    res.status(500).json({ error: 'Failed to sync user data: ' + err.message });
  }
});

// Mount Protected Admin Routes
app.use('/api/admin', adminRoutes);
app.use('/api/admin/cms', adminCmsRoutes);

// Mount Public CMS Routes
app.use(['/api/cms', '/cms'], cmsRoutes);

// Mount Offline Licensing & Authorized Audio Download Routes
app.use(['/api/offline', '/offline'], offlineRoutes);

// Mount Profile & Social Features (Public Profiles, Follows, Collaborative Playlists)
app.use(['/api/user', '/user'], profileRoutes);

// Mount Social Listening Activity Feed
app.use(['/api/activity', '/activity'], activityRoutes);

// Mount Mood-to-Music AI Recommendation Engine
app.use(['/api/mood', '/mood'], moodRoutes);

// Mount Verified Real Indian Radio Streaming Routes
app.use(['/api/radio', '/radio'], radioRoutes);

// Mount Gemini AI-Powered Personalized Recommendations & Listening Events
app.use(['/api/recommendations', '/recommendations'], recommendationRoutes);
app.post('/api/listening-events', authenticateToken, handleListeningEvent);

// Mount Loopra AI Music Companion & External Song Recognition
app.use(['/api/ai-music', '/ai-music'], aiMusicRoutes);

// YouTube API Search with In-Memory Caching & Rotating Keys
const searchCache = new Map();
const SEARCH_CACHE_TTL = 60 * 60 * 1000; // 60 minutes TTL
const deadApiKeys = new Map(); // key -> { reason, time }

const isKeyDead = (key) => {
  if (!deadApiKeys.has(key)) return false;
  const { reason, time } = deadApiKeys.get(key);
  if (reason === 'invalid') return true; // permanently bad key
  if (reason === 'quota' && Date.now() - time < 60 * 60 * 1000) return true; // 1-hour quota cooldown
  deadApiKeys.delete(key);
  return false;
};

const getCachedSearch = (key) => {
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    return cached.data;
  }
  searchCache.delete(key);
  return null;
};

const setCachedSearch = (key, data) => {
  if (searchCache.size > 500) {
    const oldestKey = searchCache.keys().next().value;
    searchCache.delete(oldestKey);
  }
  searchCache.set(key, { data, timestamp: Date.now() });
};

const decodeHtml = (str = '') => {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
};

// Curated fallbacks if YouTube scrapers hit 429 rate limit or keys are exhausted
// Strictly single-song entries only (no jukeboxes, albums, mashups or medleys)
const FALLBACK_TRENDING = [
  { id: { videoId: 'RLzC55ai0eo' }, snippet: { title: 'Heeriye (Official Video) - Jasleen Royal ft Arijit Singh', channelTitle: 'Jasleen Royal', thumbnails: { high: { url: 'https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg' } } } },
  { id: { videoId: 'WWIfHemqSEA' }, snippet: { title: 'Tujhko - Love Song - Arijit Singh', channelTitle: 'iPop Superhits', thumbnails: { high: { url: 'https://i.ytimg.com/vi/WWIfHemqSEA/hqdefault.jpg' } } } },
  { id: { videoId: 'IJJX39HRvlc' }, snippet: { title: 'Mere Humdum | New Songs 2026', channelTitle: 'Vatsal Bhoya', thumbnails: { high: { url: 'https://i.ytimg.com/vi/IJJX39HRvlc/hqdefault.jpg' } } } },
  { id: { videoId: 'BddP6PYo2gs' }, snippet: { title: 'Kesariya (Official Video) - Brahmāstra | Arijit Singh', channelTitle: 'Sony Music India', thumbnails: { high: { url: 'https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg' } } } },
  { id: { videoId: 'cIGd8gm_pYE' }, snippet: { title: 'Lover (Official Music Video) - Diljit Dosanjh', channelTitle: 'Speed Records', thumbnails: { high: { url: 'https://i.ytimg.com/vi/cIGd8gm_pYE/hqdefault.jpg' } } } },
  { id: { videoId: 'Umqb9KENgmk' }, snippet: { title: 'Tum Hi Ho (Official Video) - Aashiqui 2 | Arijit Singh', channelTitle: 'T-Series', thumbnails: { high: { url: 'https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg' } } } }
];

const FALLBACK_ALBUMS = [
  { id: { videoId: 'Umqb9KENgmk' }, snippet: { title: 'Tum Hi Ho (Official Video) - Aashiqui 2 | Arijit Singh', channelTitle: 'T-Series', thumbnails: { high: { url: 'https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg' } } } },
  { id: { videoId: 'pElvXl3YvY0' }, snippet: { title: 'Ilahi (Full Video Song) - Yeh Jawaani Hai Deewani | Arijit Singh', channelTitle: 'T-Series', thumbnails: { high: { url: 'https://i.ytimg.com/vi/pElvXl3YvY0/hqdefault.jpg' } } } },
  { id: { videoId: '7ccHMhuE6pA' }, snippet: { title: 'Bekhayali (Official Video) - Kabir Singh | Sachet Tandon', channelTitle: 'T-Series', thumbnails: { high: { url: 'https://i.ytimg.com/vi/7ccHMhuE6pA/hqdefault.jpg' } } } },
  { id: { videoId: 'f6vYp2r6d5o' }, snippet: { title: 'Satranga (Full Video Song) - ANIMAL | Arijit Singh', channelTitle: 'T-Series', thumbnails: { high: { url: 'https://i.ytimg.com/vi/f6vYp2r6d5o/hqdefault.jpg' } } } },
  { id: { videoId: 'P9YpfmNc_p4' }, snippet: { title: 'Kun Faya Kun - Rockstar | A.R. Rahman', channelTitle: 'SonyMusicIndiaVEVO', thumbnails: { high: { url: 'https://i.ytimg.com/vi/P9YpfmNc_p4/hqdefault.jpg' } } } },
  { id: { videoId: 'x_elT6zkqN0' }, snippet: { title: 'Zara Sa (Full Song) - Jannat | KK', channelTitle: 'Sony Music India', thumbnails: { high: { url: 'https://i.ytimg.com/vi/x_elT6zkqN0/hqdefault.jpg' } } } }
];

const FALLBACK_RADIO = [
  { id: { videoId: 'dvgZkm1xWPE' }, snippet: { title: 'Sunn Raha Hai Na Tu (Female) - Aashiqui 2 | Shreya Ghoshal', channelTitle: 'SonyMusicIndiaVEVO', thumbnails: { high: { url: 'https://i.ytimg.com/vi/dvgZkm1xWPE/hqdefault.jpg' } } } },
  { id: { videoId: 'S6IW8Rj1WqQ' }, snippet: { title: 'Tip Tip Barsa Paani - Mohra | Alka Yagnik, Udit Narayan', channelTitle: 'Tips Official', thumbnails: { high: { url: 'https://i.ytimg.com/vi/S6IW8Rj1WqQ/hqdefault.jpg' } } } },
  { id: { videoId: 'cIGd8gm_pYE' }, snippet: { title: 'Lover - Diljit Dosanjh', channelTitle: 'Speed Records', thumbnails: { high: { url: 'https://i.ytimg.com/vi/cIGd8gm_pYE/hqdefault.jpg' } } } },
  { id: { videoId: 'P9YpfmNc_p4' }, snippet: { title: 'Kun Faya Kun - A.R. Rahman', channelTitle: 'SonyMusicIndiaVEVO', thumbnails: { high: { url: 'https://i.ytimg.com/vi/P9YpfmNc_p4/hqdefault.jpg' } } } },
  { id: { videoId: 'RLzC55ai0eo' }, snippet: { title: 'Heeriye - Jasleen Royal ft Arijit Singh', channelTitle: 'Jasleen Royal', thumbnails: { high: { url: 'https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg' } } } },
  { id: { videoId: 'WWIfHemqSEA' }, snippet: { title: 'Tujhko - Arijit Singh', channelTitle: 'iPop Superhits', thumbnails: { high: { url: 'https://i.ytimg.com/vi/WWIfHemqSEA/hqdefault.jpg' } } } }
];

const getCuratedFallback = (queryStr) => {
  const q = queryStr.toLowerCase();
  if (q.includes('album') || q.includes('jukebox')) return FALLBACK_ALBUMS;
  if (q.includes('radio') || q.includes('lofi')) return FALLBACK_RADIO;
  if (q.includes('trending') || q.includes('hit')) return FALLBACK_TRENDING;
  return null;
};

const sanitizeApiKey = (key) => {
  if (typeof key !== 'string') return '';
  let clean = key.trim().replace(/^['"]|['"]$/g, '');
  if (clean.startsWith('AIzaSy') && clean.length > 39) {
    clean = clean.slice(0, 39);
  }
  return clean;
};

const getYoutubeApiKeys = () => {
  return [
    process.env.YOUTUBE_KEY_1 || process.env.VITE_YOUTUBE_KEY_1,
    process.env.YOUTUBE_KEY_2 || process.env.VITE_YOUTUBE_KEY_2,
    process.env.YOUTUBE_KEY_3 || process.env.VITE_YOUTUBE_KEY_3,
    process.env.YOUTUBE_KEY_4 || process.env.VITE_YOUTUBE_KEY_4,
    process.env.YOUTUBE_KEY_5 || process.env.VITE_YOUTUBE_KEY_5,
    process.env.YOUTUBE_KEY_6 || process.env.VITE_YOUTUBE_KEY_6,
    process.env.YOUTUBE_API_KEY,
  ]
    .map(sanitizeApiKey)
    .filter(Boolean);
};

let currentApiKeyIndex = 0;
const rotateApiKey = () => {
  const keys = getYoutubeApiKeys().filter(k => !isKeyDead(k));
  if (keys.length > 0) {
    currentApiKeyIndex = (currentApiKeyIndex + 1) % keys.length;
  }
};

app.get(['/api/youtube/search', '/api/search', '/search'], searchLimiter, async (req, res) => {
  const { q, pageToken } = req.query;
  if (!q || !q.toString().trim()) {
    return res.json({ items: [], nextPageToken: null });
  }

  const queryStr = q.toString().trim();
  const pageTokenStr = (pageToken || req.query.continuation || '').toString().trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const cacheKey = `${queryStr.toLowerCase()}_${limit}_${pageTokenStr}`;

  // Record search term in music metrics
  metricsService.recordMusicEvent({ type: 'search', query: queryStr });

  const cached = getCachedSearch(cacheKey);
  if (cached) {
    if (Array.isArray(cached)) {
      return res.json({ items: cached, nextPageToken: null });
    }
    return res.json(cached);
  }

  // 1. Try YouTube Data API v3 with active, non-dead rotating keys
  const allKeys = getYoutubeApiKeys();
  const activeKeys = allKeys.filter(k => !isKeyDead(k));

  if (activeKeys.length > 0) {
    for (let i = 0; i < activeKeys.length; i++) {
      const apiKeyIndex = (currentApiKeyIndex + i) % activeKeys.length;
      const apiKey = activeKeys[apiKeyIndex];
      try {
        const upstreamLimit = Math.min(Math.max(limit * 2, 25), 50);
        const params = {
          part: 'snippet',
          type: 'video',
          maxResults: upstreamLimit,
          q: queryStr,
          key: apiKey
        };
        if (pageTokenStr) {
          params.pageToken = pageTokenStr;
        }

        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
          params,
          timeout: 5000
        });

        if (response.data && Array.isArray(response.data.items)) {
          currentApiKeyIndex = apiKeyIndex;
          const rawMapped = response.data.items.map(item => {
            const videoId = item.id?.videoId || item.id;
            return {
              id: videoId,
              title: decodeHtml(item.snippet?.title || ''),
              channel: decodeHtml(item.snippet?.channelTitle || 'Unknown'),
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            };
          });

          const singleSongs = filterSingleSongs(rawMapped);
          const finalTracks = (singleSongs.length > 0 ? singleSongs : rawMapped).slice(0, limit);
          const items = finalTracks.map(item => ({
            id: { videoId: item.id },
            snippet: {
              title: item.title,
              channelTitle: item.channel,
              thumbnails: {
                high: { url: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` },
                medium: { url: `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg` },
                default: { url: `https://i.ytimg.com/vi/${item.id}/default.jpg` }
              }
            }
          }));

          metricsService.recordYouTube('api');
          const resultPayload = {
            items,
            nextPageToken: response.data.nextPageToken || null,
            pageInfo: response.data.pageInfo || null
          };
          setCachedSearch(cacheKey, resultPayload);
          return res.json(resultPayload);
        }
      } catch (apiErr) {
        const status = apiErr.response?.status;
        const errMsg = apiErr.response?.data?.error?.message || apiErr.message;
        console.warn(`[YouTube API Upstream] Key attempt failed (${status}):`, errMsg);

        if (status === 400 || (errMsg && errMsg.includes('API key not valid'))) {
          deadApiKeys.set(apiKey, { reason: 'invalid', time: Date.now() });
          metricsService.recordYouTube('invalid_key');
        } else if (status === 403 || (errMsg && errMsg.includes('quota'))) {
          deadApiKeys.set(apiKey, { reason: 'quota', time: Date.now() });
          metricsService.recordYouTube('quota');
        }
      }
    }
  }

  // If a continuation token was requested, but all YouTube API keys failed or were exhausted,
  // do NOT fallback to page 1 scrapers. Return error so frontend can retry.
  if (pageTokenStr) {
    return res.status(503).json({
      error: 'Search pagination service temporarily unavailable. Please retry.',
      items: [],
      nextPageToken: null
    });
  }

  // 2. Pure JS yt-search fallback if official keys are exhausted, rate-limited, or unconfigured
  try {
    const searchPromise = ytSearch({ query: queryStr, page: 1 });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('yt-search timeout after 10000ms')), 10000)
    );
    const searchResult = await Promise.race([searchPromise, timeoutPromise]);
    let videos = (searchResult?.videos || []);
    if (videos.length === 0 && searchResult?.all) {
      videos = searchResult.all.filter(v => v.videoId || v.type === 'video');
    }

    if (videos.length > 0) {
      const singleSongs = filterSingleSongs(videos);
      const chosen = (singleSongs.length > 0 ? singleSongs : videos).slice(0, limit);
      const items = chosen.map(v => {
        const videoId = v.id || v.videoId;
        return {
          id: { videoId },
          snippet: {
            title: decodeHtml(v.title || ''),
            channelTitle: decodeHtml(v.channel || v.author?.name || 'Unknown'),
            thumbnails: {
              high: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` },
              medium: { url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` },
              default: { url: `https://i.ytimg.com/vi/${videoId}/default.jpg` }
            }
          }
        };
      });

      metricsService.recordYouTube('scraper');
      const resultPayload = { items, nextPageToken: null };
      setCachedSearch(cacheKey, resultPayload);
      return res.json(resultPayload);
    }
  } catch (err) {
    console.error('[YouTube Search Notice]:', err.message);
  }

  // 3. Resilient Curated Fallback if search scraper is rate-limited (e.g. 429) or empty
  const fallback = getCuratedFallback(queryStr);
  if (fallback) {
    const singleFallback = filterSingleSongs(fallback);
    const chosen = (singleFallback.length > 0 ? singleFallback : fallback).slice(0, limit).map(t => ({
      id: { videoId: t.id },
      snippet: {
        title: t.title,
        channelTitle: t.channel,
        thumbnails: {
          high: { url: t.thumbnail },
          medium: { url: t.thumbnail },
          default: { url: t.thumbnail }
        }
      }
    }));
    metricsService.recordYouTube('fallback');
    const resultPayload = { items: chosen, nextPageToken: null };
    setCachedSearch(cacheKey, resultPayload);
    return res.json(resultPayload);
  }

  return res.json({ items: [], nextPageToken: null });
});

// Stream endpoint - safe placeholder, playback is handled client-side via YouTube IFrame API
app.get(['/api/stream/:videoId', '/stream/:videoId'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Stream playback handled client-side via YouTube IFrame API'
  });
});

// Dedicated 100+ Single-Song Shuffle Pool endpoint
let cachedShufflePool = [];
let lastShufflePoolFetch = 0;
const SHUFFLE_POOL_TTL = 30 * 60 * 1000; // 30 minutes

app.get(['/api/youtube/shuffle-pool', '/api/shuffle/pool', '/api/shuffle-pool'], async (req, res) => {
  try {
    const now = Date.now();
    if (cachedShufflePool.length >= 100 && (now - lastShufflePoolFetch < SHUFFLE_POOL_TTL)) {
      return res.json({
        total: cachedShufflePool.length,
        items: cachedShufflePool,
        source: 'cache'
      });
    }

    const seedQueries = [
      'arijit singh official song video',
      'shreya ghoshal romantic song official',
      'kishore kumar hit songs',
      'lata mangeshkar melody song',
      'kumar sanu 90s romantic song',
      'sonu nigam superhit song',
      'ar rahman official song video',
      'diljit dosanjh hit song official',
      'anuv jain acoustic song',
      'prateek kuhad official song',
      'udit narayan romantic song',
      'alka yagnik melody song',
      'mohit chauhan songs official',
      'kk romantic songs official',
      'atif aslam hit songs official'
    ];

    const accumulated = [...cachedShufflePool];
    const seen = new Set(accumulated.map(t => t.id || t.videoId));

    for (const query of seedQueries) {
      if (accumulated.length >= 120) break;
      try {
        const searchResult = await ytSearch({ query, page: 1 });
        const videos = searchResult?.videos || [];
        const singleSongs = filterSingleSongs(videos);
        for (const track of singleSongs) {
          if (!seen.has(track.id)) {
            seen.add(track.id);
            accumulated.push(track);
          }
          if (accumulated.length >= 120) break;
        }
      } catch (err) {
        console.warn('[Shuffle Pool Build Notice]:', err.message);
      }
    }

    if (accumulated.length > 0) {
      cachedShufflePool = accumulated;
      lastShufflePoolFetch = now;
    }

    return res.json({
      total: cachedShufflePool.length,
      items: cachedShufflePool,
      source: 'live'
    });
  } catch (err) {
    console.error('[Shuffle Pool Error]:', err.message);
    res.status(500).json({ error: 'Failed to generate shuffle pool', items: [] });
  }
});

// Global Express Error Handler ensuring CORS headers are always attached & errors logged
app.use((err, req, res, next) => {
  console.error('[Express Global Error]:', err.message);
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString().split(',')[0].trim();
  metricsService.recordError({
    method: req.method,
    path: req.originalUrl || req.url,
    status: err.status || 500,
    message: err.message,
    ip
  });

  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large to sync' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
server.on('error', (err) => {
  console.error('[HTTP Server Error]:', err.message, err.stack);
});
server.on('close', () => {
  console.warn('[HTTP Server Notice]: Server closed');
});
server.listen(PORT, () => {
  console.log(`[AfterHours Backend] Server running on port ${PORT}`);
});
