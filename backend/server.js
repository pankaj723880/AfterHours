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

// Prevent unhandled rejections and exceptions from crashing the server
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err.message, err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

dotenv.config();
dotenv.config({ path: '../.env' });

const oauthClient = new OAuth2Client();
const app = express();
const server = http.createServer(app);

// Allowed origins for CORS (Production Vercel + Localhost)
const allowedOrigins = [
  'https://after-hours-five-beryl.vercel.app',
  process.env.CLIENT_URL,
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow curl, same-origin, or non-browser server requests
  if (allowedOrigins.includes(origin)) return true;
  if (/^https:\/\/after-hours-[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204
}));

// Generous payload limit so sync never throws 413 or truncates
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
  pingInterval: 25000
});

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

// Health check endpoints for Render
app.get('/', (req, res) => {
  res.send('AfterHours API is running');
});

app.get('/health', (req, res) => {
  const ready = isDatabaseReady();
  res.json({
    status: 'ok',
    database: ready ? 'connected' : 'disconnected',
    readyState: mongoose.connection.readyState,
    timestamp: new Date().toISOString()
  });
});

// Socket.io for Real-time Active Users & Admin Streams
let simulatedBase = 742;

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
  io.emit('active_users', simulatedBase + snapshot.activeVisitors * 3);

  // If newly connected socket is admin, send immediate snapshot
  if (socket.user && socket.user.role === 'admin') {
    socket.emit('admin_live_metrics', snapshot);
  }

  socket.on('disconnect', () => {
    metricsService.handleVisitorDisconnect(socket.id);
    activeUserSocketMap.delete(socket.id);
    const updatedSnap = metricsService.getSnapshot();
    io.emit('active_users', simulatedBase + updatedSnap.activeVisitors * 3);
  });
});

// Fluctuate the simulated active users for standard music player
setInterval(() => {
  const change = Math.floor(Math.random() * 8) - 3;
  simulatedBase = Math.max(500, simulatedBase + change);
  const snap = metricsService.getSnapshot();
  io.emit('active_users', simulatedBase + snap.activeVisitors * 3);
}, 3000);

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

// Auth Routes with Database Availability Guards
app.post('/api/auth/register', async (req, res) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({ error: 'Database service is temporarily unavailable. Please try again shortly.', retryable: true });
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
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    console.error('[Register Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({ error: 'Database service is temporarily unavailable. Please try again shortly.', retryable: true });
  }
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = typeof password === 'string' ? password.trim() : password;
    console.log(`[Auth Login Attempt]: username="${cleanUsername}", password length=${cleanPassword.length}`);
    const user = await User.findOne({ username: cleanUsername, password: cleanPassword }).maxTimeMS(4000);
    if (!user) {
      console.warn(`[Auth Login Failed]: username="${cleanUsername}" - user not found or password mismatch`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account has been suspended. Please contact support.' });
    }
    if (user.status === 'deactivated') {
      return res.status(403).json({ error: 'Account is deactivated.' });
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
        role: user.role,
        status: user.status,
        likedSongs: user.likedSongs,
        history: user.history,
        playlists: user.playlists,
        queue: user.queue
      }
    });
  } catch (err) {
    console.error('[Login Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      user: {
        id: user._id,
        userId: user._id,
        username: user.username,
        role: user.role,
        status: user.status,
        likedSongs: user.likedSongs,
        history: user.history,
        playlists: user.playlists,
        queue: user.queue
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/google', async (req, res) => {
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
    let user = await User.findOne({ username: cleanEmail }).maxTimeMS(4000);
    const shouldBeAdmin = isEmailBootstrapAdmin(cleanEmail);

    if (!user) {
      // Check if there are no admins at all in DB, allow bootstrapping if explicitly configured
      const existingAdminsCount = await User.countDocuments({ role: 'admin' });
      const makeAdmin = shouldBeAdmin || (existingAdminsCount === 0 && process.env.BOOTSTRAP_FIRST_USER_AS_ADMIN === 'true');

      user = new User({
        username: cleanEmail,
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
      user.lastLogin = new Date();
      await user.save();
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account has been suspended.' });
    }
    if (user.status === 'deactivated') {
      return res.status(403).json({ error: 'Account is deactivated.' });
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
        role: user.role,
        status: user.status,
        likedSongs: user.likedSongs,
        history: user.history,
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
app.get('/api/user/:id', async (req, res) => {
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
      playlists: user.playlists || [],
      queue: user.queue || []
    });
  } catch (err) {
    console.error('[User GET Error]:', err.message);
    res.status(500).json({ error: 'Failed to retrieve user data: ' + err.message });
  }
});

app.post('/api/user/:id/sync', async (req, res) => {
  if (!isDatabaseReady()) {
    return res.status(503).json({ error: 'Database service is temporarily unavailable. Please retry shortly.', retryable: true });
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  try {
    const { likedSongs, history, playlists, queue } = req.body || {};
    const update = {};
    if (Array.isArray(likedSongs)) update.likedSongs = likedSongs.slice(0, 500);
    if (Array.isArray(history)) update.history = history.slice(0, 100);
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
const FALLBACK_TRENDING = [
  { id: { videoId: 'Yvl6m9x5ZR0' }, snippet: { title: 'New Trending Love Songs | Best Hindi Romantic Songs Playlist', channelTitle: 'Grow Music', thumbnails: { high: { url: 'https://i.ytimg.com/vi/Yvl6m9x5ZR0/hqdefault.jpg' } } } },
  { id: { videoId: 'IJJX39HRvlc' }, snippet: { title: 'New Songs 2026 | Mere Humdum | Emraan Hashmi, Rashmika', channelTitle: 'Vatsal Bhoya', thumbnails: { high: { url: 'https://i.ytimg.com/vi/IJJX39HRvlc/hqdefault.jpg' } } } },
  { id: { videoId: 'RLzC55ai0eo' }, snippet: { title: 'Heeriye | Jasleen Royal ft Arijit Singh | Dulquer Salmaan', channelTitle: 'Jasleen Royal', thumbnails: { high: { url: 'https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg' } } } },
  { id: { videoId: 'kRs375-oliY' }, snippet: { title: 'All Instagram Trending Songs 2026 | Taare x Pal Pal x Aarzu', channelTitle: 'HeartBeat Lyrics', thumbnails: { high: { url: 'https://i.ytimg.com/vi/kRs375-oliY/hqdefault.jpg' } } } },
  { id: { videoId: '41HX_5G6eqQ' }, snippet: { title: 'Barsaat | All Trending Songs Mashup', channelTitle: 'Voxwaves', thumbnails: { high: { url: 'https://i.ytimg.com/vi/41HX_5G6eqQ/hqdefault.jpg' } } } },
  { id: { videoId: 'WWIfHemqSEA' }, snippet: { title: 'Arijit Singh - Tujhko | Love Song', channelTitle: 'iPop Superhits', thumbnails: { high: { url: 'https://i.ytimg.com/vi/WWIfHemqSEA/hqdefault.jpg' } } } }
];

const FALLBACK_ALBUMS = [
  { id: { videoId: 'B61fSzdCzzs' }, snippet: { title: 'Aashiqui 2 | All Best Songs Audio Jukebox', channelTitle: 'Love Mashup', thumbnails: { high: { url: 'https://i.ytimg.com/vi/B61fSzdCzzs/hqdefault.jpg' } } } },
  { id: { videoId: 'ZdyaixHYviA' }, snippet: { title: 'Yeh Jawaani Hai Deewani Full Songs Jukebox', channelTitle: 'T-Series', thumbnails: { high: { url: 'https://i.ytimg.com/vi/ZdyaixHYviA/hqdefault.jpg' } } } },
  { id: { videoId: 'SQWDGLnvxF4' }, snippet: { title: 'Sanam Teri Kasam All Songs Jukebox', channelTitle: 'ASIF INDIAN VLOGS', thumbnails: { high: { url: 'https://i.ytimg.com/vi/SQWDGLnvxF4/hqdefault.jpg' } } } },
  { id: { videoId: 'BDlNjOc3wiQ' }, snippet: { title: 'FULL ALBUM: Kabir Singh | Audio Jukebox', channelTitle: 'T-Series', thumbnails: { high: { url: 'https://i.ytimg.com/vi/BDlNjOc3wiQ/hqdefault.jpg' } } } },
  { id: { videoId: 'ARtRGkaG_OA' }, snippet: { title: 'Rockstar | Audio Jukebox | A.R. Rahman', channelTitle: 'AmZe Music', thumbnails: { high: { url: 'https://i.ytimg.com/vi/ARtRGkaG_OA/hqdefault.jpg' } } } },
  { id: { videoId: 'jsgPZVMfJQk' }, snippet: { title: 'ANIMAL (AUDIO JUKEBOX): Ranbir Kapoor', channelTitle: 'T-Series', thumbnails: { high: { url: 'https://i.ytimg.com/vi/jsgPZVMfJQk/hqdefault.jpg' } } } }
];

const FALLBACK_RADIO = [
  { id: { videoId: 'O5gwxm3NxFU' }, snippet: { title: 'Best Of Arijit Singh 2024 Hits Radio Jukebox', channelTitle: 'ABT Lofi Music', thumbnails: { high: { url: 'https://i.ytimg.com/vi/O5gwxm3NxFU/hqdefault.jpg' } } } },
  { id: { videoId: 'r0c1f6XxRQg' }, snippet: { title: 'Evergreen Hits of KK (Audio Jukebox)', channelTitle: 'T-Series', thumbnails: { high: { url: 'https://i.ytimg.com/vi/r0c1f6XxRQg/hqdefault.jpg' } } } },
  { id: { videoId: 'dvgZkm1xWPE' }, snippet: { title: 'Shreya Ghoshal Romantic Hits Radio', channelTitle: 'SonyMusicIndiaVEVO', thumbnails: { high: { url: 'https://i.ytimg.com/vi/dvgZkm1xWPE/hqdefault.jpg' } } } },
  { id: { videoId: 'S6IW8Rj1WqQ' }, snippet: { title: 'Alka Yagnik 90s Melodies Radio', channelTitle: 'Tips Official', thumbnails: { high: { url: 'https://i.ytimg.com/vi/S6IW8Rj1WqQ/hqdefault.jpg' } } } },
  { id: { videoId: 'cIGd8gm_pYE' }, snippet: { title: 'Diljit Dosanjh Superhits Radio', channelTitle: 'Speed Records', thumbnails: { high: { url: 'https://i.ytimg.com/vi/cIGd8gm_pYE/hqdefault.jpg' } } } },
  { id: { videoId: 'P9YpfmNc_p4' }, snippet: { title: 'A.R. Rahman Magical Hits Live Radio', channelTitle: 'SonyMusicIndiaVEVO', thumbnails: { high: { url: 'https://i.ytimg.com/vi/P9YpfmNc_p4/hqdefault.jpg' } } } }
];

const getCuratedFallback = (queryStr) => {
  const q = queryStr.toLowerCase();
  if (q.includes('album') || q.includes('jukebox')) return FALLBACK_ALBUMS;
  if (q.includes('radio') || q.includes('lofi')) return FALLBACK_RADIO;
  if (q.includes('trending') || q.includes('hit')) return FALLBACK_TRENDING;
  return null;
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
  ].filter(Boolean);
};

let currentApiKeyIndex = 0;
const rotateApiKey = () => {
  const keys = getYoutubeApiKeys().filter(k => !isKeyDead(k));
  if (keys.length > 0) {
    currentApiKeyIndex = (currentApiKeyIndex + 1) % keys.length;
  }
};

app.get('/api/youtube/search', async (req, res) => {
  const { q } = req.query;
  if (!q || !q.toString().trim()) {
    return res.json({ items: [] });
  }

  const queryStr = q.toString().trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
  const cacheKey = `${queryStr.toLowerCase()}_${limit}`;

  // Record search term in music metrics
  metricsService.recordMusicEvent({ type: 'search', query: queryStr });

  const cached = getCachedSearch(cacheKey);
  if (cached) {
    return res.json({ items: cached });
  }

  // 1. Try YouTube Data API v3 with active, non-dead rotating keys
  const allKeys = getYoutubeApiKeys();
  const activeKeys = allKeys.filter(k => !isKeyDead(k));

  if (activeKeys.length > 0) {
    let attempts = 0;
    while (attempts < activeKeys.length) {
      const apiKey = activeKeys[currentApiKeyIndex % activeKeys.length];
      try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
          params: {
            part: 'snippet',
            type: 'video',
            maxResults: limit,
            q: queryStr,
            key: apiKey
          },
          timeout: 5000
        });

        if (response.data && Array.isArray(response.data.items) && response.data.items.length > 0) {
          const items = response.data.items.map(item => {
            const videoId = item.id?.videoId || item.id;
            return {
              id: { videoId },
              snippet: {
                title: decodeHtml(item.snippet?.title || ''),
                channelTitle: decodeHtml(item.snippet?.channelTitle || 'Unknown'),
                thumbnails: {
                  high: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` },
                  medium: { url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` },
                  default: { url: `https://i.ytimg.com/vi/${videoId}/default.jpg` }
                }
              }
            };
          });

          metricsService.recordYouTube('api');
          setCachedSearch(cacheKey, items);
          return res.json({ items });
        }
      } catch (apiErr) {
        const status = apiErr.response?.status;
        const errMsg = apiErr.response?.data?.error?.message || apiErr.message;
        console.warn(`[YouTube API] Key attempt failed (${status}):`, errMsg);

        if (status === 400 || errMsg.includes('API key not valid')) {
          deadApiKeys.set(apiKey, { reason: 'invalid', time: Date.now() });
          metricsService.recordYouTube('invalid_key');
        } else if (status === 403 || errMsg.includes('quota')) {
          deadApiKeys.set(apiKey, { reason: 'quota', time: Date.now() });
          metricsService.recordYouTube('quota');
        }

        rotateApiKey();
        attempts++;
      }
    }
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
      const items = videos.slice(0, limit).map(v => ({
        id: { videoId: v.videoId },
        snippet: {
          title: decodeHtml(v.title || ''),
          channelTitle: decodeHtml(v.author?.name || 'Unknown'),
          thumbnails: {
            high: { url: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` },
            medium: { url: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg` },
            default: { url: `https://i.ytimg.com/vi/${v.videoId}/default.jpg` }
          }
        }
      }));

      metricsService.recordYouTube('scraper');
      setCachedSearch(cacheKey, items);
      return res.json({ items });
    }
  } catch (err) {
    console.error('[YouTube Search Notice]:', err.message);
  }

  // 3. Resilient Curated Fallback if search scraper is rate-limited (e.g. 429) or empty
  const fallback = getCuratedFallback(queryStr);
  if (fallback) {
    metricsService.recordYouTube('fallback');
    setCachedSearch(cacheKey, fallback);
    return res.json({ items: fallback });
  }

  return res.json({ items: [] });
});

// Stream endpoint - safe placeholder, playback is handled client-side via YouTube IFrame API
app.get('/api/stream/:videoId', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Stream playback handled client-side via YouTube IFrame API'
  });
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
server.listen(PORT, () => {
  console.log(`[AfterHours Backend] Server running on port ${PORT}`);
});
