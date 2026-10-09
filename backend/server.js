import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import axios from 'axios';
import ytSearch from 'yt-search';
import { OAuth2Client } from 'google-auth-library';

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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

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

// MongoDB Connection Resilience
let isMongoConnected = false;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
})
  .then(() => {
    isMongoConnected = true;
    console.log('[MongoDB] Connected successfully');
  })
  .catch((err) => {
    isMongoConnected = false;
    console.warn('[MongoDB] Initial connection error (will retry in background):', err.message);
  });

mongoose.connection.on('connected', () => {
  isMongoConnected = true;
  console.log('[MongoDB] Connection established');
});

mongoose.connection.on('error', (err) => {
  isMongoConnected = false;
  console.warn('[MongoDB] Connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  isMongoConnected = false;
  console.warn('[MongoDB] Disconnected. Waiting for reconnection...');
});

// Health check endpoints for Render
app.get('/', (req, res) => {
  res.send('AfterHours API is running');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: isMongoConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Socket.io for Real-time Active Users
let realActiveUsers = 0;
let simulatedBase = 742;

io.on('connection', (socket) => {
  realActiveUsers++;
  io.emit('active_users', simulatedBase + realActiveUsers * 3);

  socket.on('disconnect', () => {
    realActiveUsers = Math.max(0, realActiveUsers - 1);
    io.emit('active_users', simulatedBase + realActiveUsers * 3);
  });
});

// Fluctuate the simulated active users
setInterval(() => {
  const change = Math.floor(Math.random() * 8) - 3;
  simulatedBase = Math.max(500, simulatedBase + change);
  io.emit('active_users', simulatedBase + realActiveUsers * 3);
}, 3000);

// User Schema & Model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  likedSongs: { type: Array, default: [] },
  history: { type: Array, default: [] },
  playlists: { type: Array, default: [] },
});
const User = mongoose.model('User', userSchema);

// Auth Routes with Database Availability Guards
app.post('/api/auth/register', async (req, res) => {
  if (!isMongoConnected) {
    return res.status(503).json({ error: 'Database service is temporarily unavailable. Please try again in a few moments.' });
  }
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: 'Username exists' });
    const user = new User({ username, password });
    await user.save();
    res.json({ message: 'User registered', userId: user._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (!isMongoConnected) {
    return res.status(503).json({ error: 'Database service is temporarily unavailable. Please try again in a few moments.' });
  }
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const user = await User.findOne({ username, password });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ message: 'Login successful', userId: user._id, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/google', async (req, res) => {
  if (!isMongoConnected) {
    return res.status(503).json({ error: 'Database service is temporarily unavailable. Please try again in a few moments.' });
  }
  try {
    const { token, likedSongs, history, playlists } = req.body;
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

    let user = await User.findOne({ username: email });
    if (!user) {
      user = new User({
        username: email,
        password: 'google_oauth_user',
        likedSongs: likedSongs || [],
        history: history || [],
        playlists: playlists || []
      });
      await user.save();
    } else {
      if (likedSongs && likedSongs.length > 0) {
        const mergedLiked = [...user.likedSongs, ...likedSongs];
        user.likedSongs = Array.from(new Set(mergedLiked.map(a => a.id))).map(id => mergedLiked.find(a => a.id === id));
      }
      if (history && history.length > 0) {
        const mergedHistory = [...user.history, ...history];
        user.history = Array.from(new Set(mergedHistory.map(a => a.id))).map(id => mergedHistory.find(a => a.id === id)).slice(0, 50);
      }
      if (playlists && playlists.length > 0) {
        const mergedPlaylists = [...user.playlists, ...playlists];
        user.playlists = Array.from(new Set(mergedPlaylists.map(a => a.id))).map(id => mergedPlaylists.find(a => a.id === id));
      }
      await user.save();
    }

    res.json({ message: 'Google Login successful', userId: user._id, user, username: user.username });
  } catch (err) {
    console.warn('[Google Auth Error]:', err.message);
    res.status(401).json({ error: 'Google Auth failed: ' + err.message });
  }
});

// User Data Sync
app.get('/api/user/:id', async (req, res) => {
  if (!isMongoConnected) {
    return res.status(503).json({ error: 'Database service is temporarily unavailable.' });
  }
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ likedSongs: user.likedSongs, history: user.history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/:id/sync', async (req, res) => {
  if (!isMongoConnected) {
    return res.status(503).json({ error: 'Database service is temporarily unavailable.' });
  }
  try {
    const { likedSongs, history, playlists } = req.body;
    await User.findByIdAndUpdate(req.params.id, { likedSongs, history, playlists });
    res.json({ message: 'Synced' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// YouTube API Search with In-Memory Caching & Rotating Keys
const searchCache = new Map();
const SEARCH_CACHE_TTL = 15 * 60 * 1000; // 15 minutes TTL

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

let currentApiKeyIndex = 0;
const getYoutubeApiKeys = () => {
  return [
    process.env.YOUTUBE_KEY_1 || process.env.VITE_YOUTUBE_KEY_1,
    process.env.YOUTUBE_KEY_2 || process.env.VITE_YOUTUBE_KEY_2,
    process.env.YOUTUBE_KEY_3 || process.env.VITE_YOUTUBE_KEY_3,
    process.env.YOUTUBE_API_KEY,
  ].filter(Boolean);
};

const rotateApiKey = () => {
  const keys = getYoutubeApiKeys();
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

  const cached = getCachedSearch(cacheKey);
  if (cached) {
    return res.json({ items: cached });
  }

  // 1. Try YouTube Data API v3 with rotating keys
  const apiKeys = getYoutubeApiKeys();
  if (apiKeys.length > 0) {
    let attempts = 0;
    while (attempts < apiKeys.length) {
      const apiKey = apiKeys[currentApiKeyIndex % apiKeys.length];
      try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
          params: {
            part: 'snippet',
            type: 'video',
            maxResults: limit,
            q: queryStr,
            key: apiKey
          },
          timeout: 7000
        });

        if (response.data && Array.isArray(response.data.items)) {
          const items = response.data.items.map(item => {
            const videoId = item.id?.videoId || item.id;
            return {
              id: { videoId },
              snippet: {
                title: decodeHtml(item.snippet?.title || ''),
                channelTitle: decodeHtml(item.snippet?.channelTitle || 'Unknown'),
                thumbnails: {
                  high: { url: item.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` },
                  medium: { url: item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` },
                  default: { url: item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${videoId}/default.jpg` }
                }
              }
            };
          });

          setCachedSearch(cacheKey, items);
          return res.json({ items });
        }
      } catch (apiErr) {
        console.warn(`[YouTube API] Key attempt ${attempts + 1}/${apiKeys.length} failed:`, apiErr.response?.data?.error?.message || apiErr.message);
        rotateApiKey();
        attempts++;
      }
    }
  }

  // 2. Pure JS yt-search fallback if official keys are exhausted, rate-limited, or unconfigured
  try {
    const searchPromise = ytSearch({ query: queryStr, page: 1 });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('yt-search timeout after 6500ms')), 6500)
    );
    const searchResult = await Promise.race([searchPromise, timeoutPromise]);
    const videos = (searchResult?.videos || []).slice(0, limit);
    const items = videos.map(v => ({
      id: { videoId: v.videoId },
      snippet: {
        title: decodeHtml(v.title || ''),
        channelTitle: decodeHtml(v.author?.name || 'Unknown'),
        thumbnails: {
          high: { url: v.image || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` },
          medium: { url: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg` },
          default: { url: `https://i.ytimg.com/vi/${v.videoId}/default.jpg` }
        }
      }
    }));

    setCachedSearch(cacheKey, items);
    return res.json({ items });
  } catch (err) {
    console.error('[YouTube Search Error]:', err.message);
    return res.json({ items: [] });
  }
});

// Stream endpoint - safe placeholder, playback is handled client-side via YouTube IFrame API
app.get('/api/stream/:videoId', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Stream playback handled client-side via YouTube IFrame API'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[AfterHours Backend] Server running on port ${PORT}`);
});
