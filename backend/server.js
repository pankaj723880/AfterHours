import express from 'express';
import https from 'https';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import axios from 'axios';
import ytSearch from 'yt-search';
import { OAuth2Client } from 'google-auth-library';
import ytdl from '@distube/ytdl-core';
import SC from 'soundcloud-scraper';

const scClient = new SC.Client();

const oauthClient = new OAuth2Client();

dotenv.config();
dotenv.config({ path: '../.env' });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

app.use(cors());
app.use(express.json());

// Health check endpoints for Render
app.get('/', (req, res) => {
  res.send('AfterHours API is running');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

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

// Continuously fluctuate the simulated base to show activity
setInterval(() => {
  // Random fluctuation between -3 and +4
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

// Basic Auth (No strict hashing for simplicity, but recommend bcrypt in production)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
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
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ message: 'Login successful', userId: user._id, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { token, likedSongs, history, playlists } = req.body;
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    const ticket = await oauthClient.verifyIdToken({
      idToken: token,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name;

    // Check if user exists by email (we'll use email as username)
    let user = await User.findOne({ username: email });
    if (!user) {
      // Create new user
      user = new User({ 
        username: email, 
        password: 'google_oauth_user', // dummy password
        likedSongs: likedSongs || [],
        history: history || [],
        playlists: playlists || []
      });
      await user.save();
    } else {
      // Merge data
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
    console.error("Google verify error:", err);
    res.status(401).json({ error: 'Google Auth failed: ' + err.message });
  }
});

// User Data Sync
app.get('/api/user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ likedSongs: user.likedSongs, history: user.history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/:id/sync', async (req, res) => {
  try {
    const { likedSongs, history, playlists } = req.body;
    await User.findByIdAndUpdate(req.params.id, { likedSongs, history, playlists });
    res.json({ message: 'Synced' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
  if (!q) return res.status(400).json({ error: 'Query is required' });

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);

  // 1. Try YouTube Data API v3 search.list with key rotation
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
            q,
            key: apiKey
          },
          timeout: 8000
        });

        if (response.data && response.data.items) {
          const items = response.data.items.map(item => ({
            id: { videoId: item.id?.videoId || item.id },
            snippet: {
              title: item.snippet?.title || '',
              channelTitle: item.snippet?.channelTitle || 'Unknown',
              thumbnails: {
                high: { url: item.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${item.id?.videoId || item.id}/hqdefault.jpg` },
                medium: { url: item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${item.id?.videoId || item.id}/mqdefault.jpg` },
                default: { url: item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${item.id?.videoId || item.id}/default.jpg` }
              }
            }
          }));

          return res.json({ items });
        }
      } catch (apiErr) {
        console.warn(`YouTube Data API request failed with key (attempt ${attempts + 1}/${apiKeys.length}):`, apiErr.response?.data?.error?.message || apiErr.message);
        rotateApiKey();
        attempts++;
      }
    }
  }

  // 2. Pure JS yt-search fallback if API keys are exhausted, invalid, or unconfigured
  try {
    const searchResult = await ytSearch({ query: q, page: 1 });
    const videos = (searchResult?.videos || []).slice(0, limit);
    const items = videos.map(v => ({
      id: { videoId: v.videoId },
      snippet: {
        title: v.title,
        channelTitle: v.author?.name || 'Unknown',
        thumbnails: {
          high: { url: v.image || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` },
          medium: { url: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg` },
          default: { url: `https://i.ytimg.com/vi/${v.videoId}/default.jpg` }
        }
      }
    }));

    return res.json({ items });
  } catch (err) {
    console.error("YouTube search error:", err.message);
    return res.status(500).json({ error: 'Search failed.' });
  }
});

// Fast resolve endpoint - returns direct audio URL as JSON
app.get('/api/resolve/:videoId', async (req, res) => {
  try {
    const info = await ytdl.getInfo(req.params.videoId);
    const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly' });
    if (format && format.url) {
      res.json({ url: format.url });
    } else {
      res.status(404).json({ error: 'No audio format found' });
    }
  } catch (err) {
    console.error('Resolve failed:', err.message);
    res.status(500).json({ error: 'Failed to resolve audio URL' });
  }
});

import youtubedl from 'youtube-dl-exec';
import { ensureYtDlp } from './ensure-ytdlp.js';

// Pre-warm yt-dlp binary
ensureYtDlp().catch(e => console.warn('ensureYtDlp init warning:', e.message));

const streamUrlCache = new Map();

// Stream endpoint - streams direct audio from yt-dlp to bypass CORS and 403 blocks
app.get('/api/stream/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  
  try {
    await ensureYtDlp();
    
    const proc = youtubedl.exec(`https://www.youtube.com/watch?v=${videoId}`, {
      format: 'bestaudio',
      output: '-',
      geoBypass: true,
      noCheckCertificates: true,
      noWarnings: true
    }, { stdio: ['ignore', 'pipe', 'pipe'] });
    
    let headersSent = false;
    let stderrOutput = '';

    proc.stderr.on('data', chunk => {
      stderrOutput += chunk.toString();
    });

    proc.stdout.on('data', chunk => {
      if (!headersSent) {
        res.setHeader('Content-Type', 'audio/webm');
        res.setHeader('Accept-Ranges', 'bytes');
        res.status(200);
        headersSent = true;
      }
      res.write(chunk);
    });

    proc.stdout.on('end', () => {
      if (headersSent) {
        res.end();
      }
    });

    proc.on('close', code => {
      if (code !== 0 && !headersSent) {
        console.error(`yt-dlp stream process failed for ${videoId} (exit ${code}):`, stderrOutput.slice(-300));
        res.status(500).json({ error: 'Stream extraction failed: ' + (stderrOutput.slice(-300) || `Exit code ${code}`) });
      } else if (!headersSent) {
        res.status(404).json({ error: 'No audio data found' });
      }
    });

    proc.on('error', err => {
      console.error(`yt-dlp stream error for ${videoId}:`, err.message);
      if (!headersSent) {
        res.status(500).json({ error: 'Failed to start stream process: ' + err.message });
      }
    });

    req.on('close', () => {
      try {
        proc.kill();
      } catch (e) {}
    });
  } catch (err) {
    console.error(`Stream proxy failed entirely for ${videoId}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Stream proxy error: ' + err.message });
    }
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
