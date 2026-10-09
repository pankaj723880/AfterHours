# AfterHours - Music Streaming Platform

A sleek, high-fidelity music streaming application with real-time active listener counters, YouTube & audio streaming fallback, audio/video switching, playlists, favorites, and dynamic queues.

---

## 📁 Project Architecture

The project is cleanly split into two standalone services:

```text
afterhours/
├── frontend/             # Vite + React application (Deploy on Vercel)
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── vercel.json       # SPA routing rewrites for Vercel
│   ├── package.json
│   └── .env.example
├── backend/              # Node.js + Express + Socket.io (Deploy on Render)
│   ├── models/
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── package.json          # Root scripts for monorepo development
├── .gitignore            # Strict security rules (protects all .env files)
└── README.md
```

---

## 🚀 How to Deploy

### 1. Deploy Backend on Render (Deploy this first to get your API URL)

1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
2. Connect your GitHub repository (`pankaj723880/AfterHours`).
3. Fill in the deployment settings:
   - **Name**: `afterhours-api` (or your choice)
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add **Environment Variables** in Render:
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `GOOGLE_CLIENT_ID`: Google OAuth client ID
   - `YOUTUBE_KEY_1`: Your YouTube Data API Key 1
   - `YOUTUBE_KEY_2`: Your YouTube Data API Key 2
   - `YOUTUBE_KEY_3`: Your YouTube Data API Key 3
   - `PORT`: `5000` (optional, Render assigns one automatically)
5. Set **Health Check Path** (under Advanced): `/health`
6. Click **Create Web Service**.
7. Copy your live backend URL (e.g., `https://afterhours-api.onrender.com`).

---

### 2. Deploy Frontend on Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New...** -> **Project**.
2. Import your GitHub repository (`pankaj723880/AfterHours`).
3. In the configuration settings:
   - **Framework Preset**: `Vite` (auto-detected)
   - **Root Directory**: Click *Edit* and select `frontend`
4. Add **Environment Variables** in Vercel:
   - `VITE_BACKEND_URL`: Paste your Render backend URL (e.g. `https://afterhours-api.onrender.com` without trailing slash)
   - `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth client ID
   - `VITE_YOUTUBE_KEY_1`: Your YouTube API key 1
   - `VITE_YOUTUBE_KEY_2`: Your YouTube API key 2
   - `VITE_YOUTUBE_KEY_3`: Your YouTube API key 3
5. Click **Deploy**.

---

## 💻 Local Development

You can run both or either service locally from the project root:

```bash
# Run frontend locally (http://localhost:5173)
npm run dev:frontend

# Run backend locally (http://localhost:5000)
npm run dev:backend
```
