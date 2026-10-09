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
import { spawn } from 'child_process';
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
    process.env.VITE_YOUTUBE_KEY_1 || process.env.YOUTUBE_KEY_1,
    process.env.VITE_YOUTUBE_KEY_2 || process.env.YOUTUBE_KEY_2,
    process.env.VITE_YOUTUBE_KEY_3 || process.env.YOUTUBE_KEY_3,
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
  
  try {
    const limit = req.query.limit || 15;
    const ytdlp = spawn('yt-dlp', ['--flat-playlist', '-j', `ytsearch${limit}:${q}`]);
    let output = '';

    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytdlp.on('close', (code) => {
      const items = output.trim().split('\n').map(line => {
        try {
          const v = JSON.parse(line);
          return {
            id: { videoId: v.id },
            snippet: {
              title: v.title,
              channelTitle: v.uploader || "Unknown",
              thumbnails: {
                high: { url: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` },
                medium: { url: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg` }
              }
            }
          };
        } catch(e) {
          return null;
        }
      }).filter(Boolean);
      
      res.json({ items });
    });
  } catch (err) {
    console.error("yt-dlp search failed:", err);
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

const streamUrlCache = new Map();

// Stream endpoint - proxies the direct audio stream bypassing CORS and handling Range requests
app.get('/api/stream/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  
  try {
    let url = streamUrlCache.get(videoId);
    
    if (!url) {
      const output = await youtubedl.exec(`https://www.youtube.com/watch?v=${videoId}`, {
        format: 'bestaudio',
        getUrl: true
      });
      
      const urls = output.stdout.trim().split('\n');
      url = urls[urls.length - 1].trim(); // Take the last one, which is usually the direct media URL
      
      streamUrlCache.set(videoId, url);
      
      // Cache expiration (urls expire after some time, e.g., 2 hours)
      setTimeout(() => {
        if (streamUrlCache.get(videoId) === url) {
          streamUrlCache.delete(videoId);
        }
      }, 1000 * 60 * 60 * 2);
    }

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    };
    
    if (req.headers.range) {
      options.headers.Range = req.headers.range;
    }

    console.log('Fetching stream with options:', options);

    https.get(url, options, (proxyRes) => {
      console.log('Proxy response status:', proxyRes.statusCode);
      console.log('Proxy response headers:', proxyRes.headers);
      if (proxyRes.statusCode >= 400) {
        // If the cached URL is invalid/expired, we could clear cache here, but for now just pass error
        streamUrlCache.delete(videoId);
      }
      
      res.status(proxyRes.statusCode);
      
      // Forward relevant headers
      const headersToForward = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges'
      ];
      
      headersToForward.forEach(header => {
        if (proxyRes.headers[header]) {
          res.setHeader(header, proxyRes.headers[header]);
        }
      });

      // Pipe the stream
      proxyRes.pipe(res);
      
      req.on('close', () => {
        proxyRes.destroy();
      });
    }).on('error', (err) => {
      console.error('HTTPS Proxy error:', err.message);
      if (!res.headersSent) res.status(500).end();
    });

  } catch (err) {
    console.error('Stream proxy failed entirely:', err.message);
    if (!res.headersSent) {
      res.status(500).end();
    }
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
