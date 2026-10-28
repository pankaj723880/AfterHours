import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Reorder, useDragControls } from 'framer-motion';
import AdminDashboard from './components/Admin/AdminDashboard';
import { safeParseJsonResponse } from './utils/errorHandler';
import { CURATED_STATION_TRACKS } from './constants/curatedPlaylists';
import HomeSearchBar from './components/Search/HomeSearchBar';
import Turntable3D from './components/Player/Turntable3D';
import AudioSpectrumVisualizer from './components/Player/AudioSpectrumVisualizer';
import StudioLoungeAtmosphere from './components/Player/StudioLoungeAtmosphere';
import CmsAnnouncementBar from './components/Common/CmsAnnouncementBar';
import CmsHeroBanner from './components/Common/CmsHeroBanner';
import CmsMaintenanceOverlay from './components/Common/CmsMaintenanceOverlay';
import CmsCuratedCollectionsRow from './components/Common/CmsCuratedCollectionsRow';
import { getCachedCmsConfig, fetchPublicCmsConfig, applyThemeToDom, normalizeCmsConfig } from './services/cmsClient';

import { io } from 'socket.io-client';

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : 'https://afterhours-zvic.onrender.com');
const BACKEND_URL = (rawBackendUrl || '').trim().replace(/\/+$/, '');

export const getApiUrl = (endpoint = '') => {
  const cleanEndpoint = endpoint.replace(/^\/+/, '/');
  return `${BACKEND_URL}${cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`}`;
};

export const getOrCreateSessionId = () => {
  if (typeof window === 'undefined') return 'sid_ssr';
  let sid = localStorage.getItem('afterhours_session_id');
  if (!sid) {
    sid = 'sid_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    localStorage.setItem('afterhours_session_id', sid);
  }
  return sid;
};

const socket = io(BACKEND_URL, {
  auth: { sessionId: getOrCreateSessionId() },
  query: { sessionId: getOrCreateSessionId() },
  transports: ['polling', 'websocket'],
  withCredentials: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
  timeout: 10000,
  autoConnect: true,
});

socket.on('connect_error', (err) => {
  console.warn('[Socket.io] Real-time connection notice:', err.message);
});

const fetchFromBackend = async (query) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    let res;
    try {
      res = await fetch(getApiUrl(`/api/youtube/search?q=${encodeURIComponent(query)}`), {
        signal: controller.signal,
        headers: {
          'X-Session-ID': getOrCreateSessionId()
        }
      });
    } catch (localErr) {
      if (!BACKEND_URL.includes('onrender.com')) {
        res = await fetch(`https://afterhours-zvic.onrender.com/api/youtube/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          headers: {
            'X-Session-ID': getOrCreateSessionId()
          }
        });
      } else {
        throw localErr;
      }
    }
    clearTimeout(timeoutId);
    const parsed = await safeParseJsonResponse(res, 'Backend search failed');
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    return parsed.data || { items: [] };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("Backend fetch notice:", err.message);
    throw err;
  }
};

// Direct audio URL resolution removed to avoid CORS and 206 failures

const Icon = ({ name, className = "w-5 h-5", ...props }) => {
  const icons = {
    play: <path d="M5 3l14 9-14 9V3z" fill="currentColor" />,
    pause: <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor" />,
    skipNext: <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor" />,
    skipPrev: <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" fill="currentColor" />,
    search: <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor" />,
    heart: <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" />,
    heartOutline: <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5 2 12.28 5.4 15.36 10.55 20.03L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" fill="currentColor" />,
    discover: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor" />,
    library: <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM12 5.5v9l6-4.5z" fill="currentColor" />,
    history: <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" fill="currentColor" />,
    scissors: <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14.07l7.59 7.59 1.41-1.41L9.64 7.64zM6 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm13-8l3-3-1.41-1.41L18 10.17 15.41 7.59 14 9l5 5z" fill="currentColor" />,
    truck: <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-7.5l1.96 2.5H17V11h2.5zm-1 7.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="currentColor" />,
    beer: <path d="M4 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V2H4zm12 18H6V4h10v16zM18 6h3c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2h-3v-2h3V8h-3V6z" fill="currentColor" />,
    radio: <path d="M3.24 6.15C2.51 6.43 2 7.17 2 8v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2H8.3l7.43-3.71-1.41-1.41L3.24 6.15Z" fill="currentColor" />,
    sparkles: <path d="M12 2L9.19 8.63 2 11.5l7.19 2.87L12 21l2.81-6.63L22 11.5l-7.19-2.87z" fill="currentColor" />,
    music: <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" fill="currentColor" />,
    shuffle: <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" fill="currentColor" />,
    repeat: <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" fill="currentColor" />,
    volume: <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor" />,
    plus: <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor" />,
    list: <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" fill="currentColor" />,
    expand: <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="currentColor" />,
    collapse: <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" fill="currentColor" />,
    menu: <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="currentColor" />,
    arrowLeft: <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor" />,
    close: <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="currentColor" />,
    external: <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" fill="currentColor" />,
    chevronUp: <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" fill="currentColor" />,
    chevronDown: <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" fill="currentColor" />,
    download: <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor" />,
    info: <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor" />,
    home: <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" />,
    video: <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" fill="currentColor" />,
    trash: <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor" />,
    moreVertical: <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="currentColor" />,
    user: <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" />,
    grip: <path d="M9 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-16a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="currentColor" />,
    shield: <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" fill="currentColor" />
  };
  return (
    <svg className={className} viewBox="0 0 24 24" {...props}>
      {icons[name] || icons.music}
    </svg>
  );
};

const DisclaimerFooter = React.memo(({ footer }) => {
  const disclaimer = footer?.disclaimerText || "Audio plays through YouTube’s embedded player. Nothing is hosted on this site, and all rights stay with the labels, composers and performers. Song credits are put together from film soundtrack listings.";
  const takedown = footer?.takedownText || "If you hold rights to anything here and want it taken off, email";
  const email = footer?.contactEmail || footer?.takedownEmail || 'pankajsss7238@gmail.com';
  const copyright = footer?.copyright || footer?.copyrightText;

  return (
    <div className="mt-8 pt-6 border-t border-neutral-800 text-neutral-400 text-xs space-y-2 leading-relaxed">
      <p>{disclaimer}</p>
      <p>
        {takedown}{' '}
        <a href={`mailto:${email}`} className="text-amber-400 underline font-medium hover:text-amber-300">
          {email}
        </a>{' '}
        and it comes down.
      </p>
      {copyright && (
        <p className="text-[11px] text-neutral-500 pt-1">
          {copyright}
        </p>
      )}
    </div>
  );
});

const SPECIAL_STATIONS = {
  barber: {
    id: "barber",
    title: "Saloon FM",
    subtitle: "Iconic 90s & 2000s Bollywood Melodies, Golden Era Romance & Nostalgic Radio Hits",
    badge: "💈 Saloon FM • 90s/2000s Nostalgia Radio",
    bgImages: [
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=1600&auto=format&fit=crop"
    ],
    queries: ["90s bollywood hit songs kumar sanu Alka Yagnik"]
  },
  truck: {
    id: "truck",
    title: "Horn Ok Please",
    subtitle: "High-Bass Highway Tracks, Rustic Punjabi Folk/Dhol Beats & Dhabha Anthems",
    badge: "🚛 Horn Ok Please • Highway Dhaba Vibe",
    bgImages: [
      "https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1508873696983-2df5c92063c7?q=80&w=1600&auto=format&fit=crop"
    ],
    queries: ["altaf raja best songs hindi highway dhaba hits"]
  },
  pauwa: {
    id: "pauwa",
    title: "Theka Session",
    subtitle: "Late-Night Party Anthems, High-Energy Drinking Bangers & Desi Hip-Hop",
    badge: "🍾 Theka Session • Desi Beats & Party Anthems",
    bgImages: [
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop"
    ],
    queries: [
      "punjabi daru peg songs party hits yo yo honey singh badshah",
      "altaf raja sad songs dard bhare geet wine heartbreak"
    ]
  },
  discover: {
    id: "discover",
    title: "Discover & Search",
    subtitle: "Explore global tracks, classic retro gems, and personalized audio streams",
    badge: "✨ Global Audio Search",
    bgImages: [],
    queries: []
  },
  library: {
    id: "library",
    title: "Liked Songs Collection",
    subtitle: "Your personal archive of favorite tracks and memorable hits",
    badge: "❤️ Saved Library",
    bgImages: [],
    queries: []
  },
  history: {
    id: "history",
    title: "Listening History",
    subtitle: "Recently played sessions and past audio logs",
    badge: "🕒 Playback Log",
    bgImages: [],
    queries: []
  }
};

const formatTime = (secs) => {
  if (isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const getCleanThumbnail = (itemOrUrl, explicitId) => {
  if (!itemOrUrl && !explicitId) return "https://ui-avatars.com/api/?name=Music&background=1e1e1e&color=f59e0b&size=300";

  let url = typeof itemOrUrl === 'string' ? itemOrUrl : (itemOrUrl?.thumbnail || itemOrUrl?.image || itemOrUrl?.snippet?.thumbnails?.high?.url || itemOrUrl?.snippet?.thumbnails?.medium?.url || '');
  const rawId = explicitId || (typeof itemOrUrl === 'object' ? (itemOrUrl?.videoId || itemOrUrl?.id) : null);
  const id = typeof rawId === 'string' ? rawId : (rawId?.videoId || null);

  if (id && typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }

  if (url && typeof url === 'string') {
    const ytMatch = url.match(/\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\//) || url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) {
      return `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    }

    if (url.includes('ytimg.com') || url.includes('ggpht.com')) {
      return url
        .replace(/\/[^/]*hq720[^/]*\.(?:jpg|webp)(?:\?.*)?$/i, '/hqdefault.jpg')
        .replace(/\/[^/]*custom[^/]*\.(?:jpg|webp)(?:\?.*)?$/i, '/hqdefault.jpg')
        .replace(/\/maxresdefault\.(?:jpg|webp)(?:\?.*)?$/i, '/hqdefault.jpg')
        .replace(/\?.*$/i, '');
    }

    return url;
  }

  if (id && typeof id === 'string') {
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }

  const fallbackTitle = typeof itemOrUrl === 'object' ? (itemOrUrl?.title || itemOrUrl?.name || 'Music') : 'Music';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackTitle)}&background=1e1e1e&color=f59e0b&size=300`;
};

const handleImageError = (e, fallbackTitle, explicitId) => {
  const target = e.currentTarget || e.target;
  if (!target) return;

  const attempts = parseInt(target.dataset.errorAttempts || '0', 10);
  const currentSrc = target.src || '';

  if (attempts >= 2 || currentSrc.includes('ui-avatars.com')) {
    target.onerror = null;
    return;
  }

  target.dataset.errorAttempts = (attempts + 1).toString();

  const safeId = typeof explicitId === 'string' ? explicitId : (explicitId?.videoId || null);
  const ytMatch = currentSrc.match(/\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\//) || (safeId ? [null, safeId] : null);
  if (ytMatch && ytMatch[1] && typeof ytMatch[1] === 'string' && !currentSrc.includes('mqdefault.jpg')) {
    target.src = `https://i.ytimg.com/vi/${ytMatch[1]}/mqdefault.jpg`;
    return;
  }

  target.onerror = null;
  const name = fallbackTitle || 'Music';
  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e1e1e&color=f59e0b&size=300`;
};

const PlayerProgress = React.memo(({ playerRef, isPlaying, onSeek, currentSongId }) => {
  const [currentTime, setCurrentTime] = useState(() => {
    try {
      const savedSong = JSON.parse(localStorage.getItem('afterhours_current_song') || 'null');
      if (savedSong) {
        return parseFloat(localStorage.getItem('afterhours_current_time') || '0') || 0;
      }
    } catch (e) {}
    return 0;
  });
  const [duration, setDuration] = useState(() => {
    try {
      const savedSong = JSON.parse(localStorage.getItem('afterhours_current_song') || 'null');
      if (savedSong) {
        return parseFloat(localStorage.getItem('afterhours_duration') || '0') || 0;
      }
    } catch (e) {}
    return 0;
  });
  const [isSeeking, setIsSeeking] = useState(false);
  const lastSavedTimeRef = useRef(0);

  useEffect(() => {
    let interval;
    if (isPlaying && !isSeeking) {
      interval = setInterval(() => {
        try {
          if (playerRef.current?.getCurrentTime) {
            const cur = playerRef.current.getCurrentTime();
            if (typeof cur === 'number' && !isNaN(cur)) {
              setCurrentTime(cur);
              if (Math.abs(cur - lastSavedTimeRef.current) >= 3) {
                lastSavedTimeRef.current = cur;
                try {
                  localStorage.setItem('afterhours_current_time', cur.toString());
                } catch (e) {}
              }
            }
          }
          if (playerRef.current?.getDuration) {
            const dur = playerRef.current.getDuration();
            if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
              setDuration(prev => {
                if (prev !== dur) {
                  try { localStorage.setItem('afterhours_duration', dur.toString()); } catch (e) {}
                  return dur;
                }
                return prev;
              });
            }
          }
        } catch (e) {}
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isSeeking, playerRef]);

  const handleSeekChange = (e) => {
    setCurrentTime(parseFloat(e.target.value));
  };

  const handleSeekCommit = (e) => {
    setIsSeeking(false);
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    try {
      localStorage.setItem('afterhours_current_time', seekTime.toString());
    } catch (e) {}
    if (onSeek) onSeek(seekTime);
  };

  return (
    <div className="w-full flex items-center gap-2 text-[10px] font-mono text-neutral-400">
      <span>{formatTime(currentTime)}</span>
      <input
        type="range"
        min="0"
        max={duration || 100}
        value={currentTime}
        onChange={handleSeekChange}
        onMouseDown={() => setIsSeeking(true)}
        onTouchStart={() => setIsSeeking(true)}
        onMouseUp={handleSeekCommit}
        onTouchEnd={handleSeekCommit}
        className="flex-1 h-1 bg-neutral-800 rounded-xl appearance-none cursor-pointer accent-amber-500"
      />
      <span>{formatTime(duration)}</span>
    </div>
  );
});

const QueueItem = React.memo(({ track, isCurrent, isPlaying, onPlay, onRemove }) => {
  const dragControls = useDragControls();
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handlePointerDown = (e) => {
    if (e.target.closest('button')) return;

    didDragRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };

    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => {
      setIsHolding(true);
      didDragRef.current = true;
      try {
        if (navigator.vibrate) navigator.vibrate(35);
      } catch (err) {}
      dragControls.start(e);
    }, 180);
  };

  const handlePointerMove = (e) => {
    if (!didDragRef.current && holdTimerRef.current) {
      const dist = Math.hypot(e.clientX - startPosRef.current.x, e.clientY - startPosRef.current.y);
      if (dist > 8) {
        clearHoldTimer();
      }
    }
  };

  const handlePointerUp = () => {
    clearHoldTimer();
    setIsHolding(false);
  };

  const handleClick = (e) => {
    if (didDragRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didDragRef.current = false;
      return;
    }
    onPlay(track);
  };

  return (
    <Reorder.Item
      value={track}
      dragListener={false}
      dragControls={dragControls}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      layout="position"
      transition={{
        layout: { type: "spring", stiffness: 350, damping: 30, mass: 0.8 },
        scale: { duration: 0.18, ease: "easeOut" }
      }}
      whileDrag={{
        scale: 1.03,
        zIndex: 60,
        boxShadow: "0 25px 40px -5px rgba(0, 0, 0, 0.8), 0 0 25px rgba(var(--accent-rgb,245,158,11),0.4)",
        backgroundColor: "rgba(24, 24, 27, 0.95)",
        borderColor: "rgba(var(--accent-rgb,245,158,11),0.7)",
        cursor: "grabbing"
      }}
      className={`group flex items-center gap-3.5 p-3.5 rounded-2xl cursor-pointer select-none relative transition-all duration-300 border backdrop-blur-xl ${
        isHolding
          ? 'bg-amber-500/20 border-amber-500/60 shadow-[0_0_25px_rgba(var(--accent-rgb,245,158,11),0.3)] scale-[1.02]'
          : isCurrent
          ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-neutral-900/60 border-amber-500/60 shadow-[0_0_25px_rgba(var(--accent-rgb,245,158,11),0.2)]'
          : 'bg-neutral-900/40 hover:bg-neutral-800/60 border-neutral-800/80 hover:border-amber-500/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] hover:-translate-y-0.5'
      }`}
      onClick={handleClick}
    >
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          didDragRef.current = true;
          dragControls.start(e);
        }}
        className="touch-none p-2 -ml-1 text-neutral-500 hover:text-amber-400 group-hover:text-amber-300 transition-colors cursor-grab active:cursor-grabbing shrink-0"
        title="Slide grip to rearrange"
      >
        <Icon name="grip" className="w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
      </div>

      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md border border-white/5">
        <img
          src={getCleanThumbnail(track)}
          alt={track.title || ""}
          className="w-full h-full object-cover pointer-events-none"
          onError={(e) => handleImageError(e, track.title, track.id)}
        />
        <div
          className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
            isCurrent ? 'opacity-100 bg-amber-950/40' : ''
          } pointer-events-none`}
        >
          <Icon name={isCurrent && isPlaying ? "pause" : "play"} className="w-5 h-5 text-amber-400 drop-shadow" />
        </div>
      </div>

      <div className="flex-1 min-w-0 pointer-events-none">
        <div className="flex items-center gap-2">
          <h4 className={`font-semibold text-sm truncate ${isCurrent ? 'text-amber-400' : 'text-white group-hover:text-amber-200'} transition-colors`}>
            {track.title}
          </h4>
          {isCurrent && isPlaying && (
            <div className="flex items-end gap-0.5 h-3 shrink-0" title="Now Playing">
              <span className="w-0.5 h-3 bg-amber-400 rounded-full animate-pulse" />
              <span className="w-0.5 h-2 bg-amber-400 rounded-full animate-[pulse_0.7s_infinite_0.2s]" />
              <span className="w-0.5 h-3.5 bg-amber-400 rounded-full animate-[pulse_0.5s_infinite_0.4s]" />
            </div>
          )}
        </div>
        <p className="text-xs text-neutral-400 truncate mt-0.5">{track.channel}</p>
      </div>

      {track.duration && (
        <span className="text-xs text-neutral-500 font-mono shrink-0 pointer-events-none">
          {track.duration}
        </span>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(track.id);
        }}
        className="text-neutral-500 hover:text-red-400 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-all duration-200 p-2 shrink-0 hover:scale-110 active:scale-95"
        title="Remove from Queue"
      >
        <Icon name="close" className="w-4 h-4" />
      </button>
    </Reorder.Item>
  );
});

const TRENDING_SONGS = [
  { id: "Yvl6m9x5ZR0", videoId: "Yvl6m9x5ZR0", title: "New Trending Love Songs", artist: "Grow Music", image: "https://i.ytimg.com/vi/Yvl6m9x5ZR0/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/Yvl6m9x5ZR0/hqdefault.jpg", query: "New Trending Love Songs Grow Music" },
  { id: "IJJX39HRvlc", videoId: "IJJX39HRvlc", title: "Mere Humdum | New Songs 2026", artist: "Vatsal Bhoya", image: "https://i.ytimg.com/vi/IJJX39HRvlc/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/IJJX39HRvlc/hqdefault.jpg", query: "New Songs 2026 Mere Humdum Vatsal Bhoya" },
  { id: "RLzC55ai0eo", videoId: "RLzC55ai0eo", title: "Heeriye (Official Video)", artist: "Jasleen Royal ft Arijit Singh", image: "https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg", query: "Heeriye Jasleen Royal Arijit Singh" },
  { id: "kRs375-oliY", videoId: "kRs375-oliY", title: "All Instagram Trending Songs 2026", artist: "HeartBeat Lyrics", image: "https://i.ytimg.com/vi/kRs375-oliY/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/kRs375-oliY/hqdefault.jpg", query: "All Instagram Trending Songs 2026 HeartBeat Lyrics" },
  { id: "41HX_5G6eqQ", videoId: "41HX_5G6eqQ", title: "Barsaat - Trending Mashup", artist: "Voxwaves", image: "https://i.ytimg.com/vi/41HX_5G6eqQ/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/41HX_5G6eqQ/hqdefault.jpg", query: "Barsaat All Trending Songs Mashup Voxwaves" },
  { id: "WWIfHemqSEA", videoId: "WWIfHemqSEA", title: "Tujhko - Love Song 2026", artist: "Arijit Singh", image: "https://i.ytimg.com/vi/WWIfHemqSEA/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/WWIfHemqSEA/hqdefault.jpg", query: "Arijit Singh Tujhko Love Song iPop Superhits" }
];

const POPULAR_ARTISTS = [
  {
    "name": "Arijit Singh",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/DcEzZrPCQRSSs47rMbdJ3UJkQUCN3X8SKf8aCnvOgd2BmPihAz-0jBGJgEVh9_P8EiSBVNyixDs=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Shreya Ghoshal",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/PgINZNe0qVxgMSXKG5vF82bNN4WCC12zgWsz9I7OLs4CLF9Cn0Vxq7Xc1ToupnzXrCv0nKfe3VM=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "A.R. Rahman",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/KJQybwuTx7c9ca68huvMRFOv88Nw2r1g2LroFKP7WVdQmWKpd0y4gYiwPsy_NTJOEhAgZifO-Q=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Kishore Kumar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/VpeI8Z1Zy0cc-ek5mCcp2duFtwVZGlOM4M3q7dX6MXi3fDZ8KUHOMBKe987db2wOs-MxRxdxiQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Lata Mangeshkar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/t1KBLb88VhoCXsnq8QYhpwmD41tcdvnKxq9injUT-kvGUnmfipJScsyo_EjATWHSEexZraZnHzE=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Sonu Nigam",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_mDXgKWQEXHW2qJIPoV9uJnLaoPQGXMWsnCQ3hNx2MNEa8=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Udit Narayan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_kxFKx4HkNWtuXNJnvgAow_S1uCzZ6hCWS3PUyc_Mo8Eg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Kumar Sanu",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/6HzcXZ7veDgWXD72YDaYNjDuPenUDM8qRzj1vUV_-G1WNxAYqCWckTxJhAqHR4_moQEMzer_=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Alka Yagnik",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/i5DI3JtNpskZZOvYgoW1-q8pY-wOadY2hz-jTQe6EFh25yrpLHOTieEgiN5CrbE7pajBgEhiCw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Neha Kakkar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/F89BItbRffdiUaxtR8d1KLGnz_65jmUDtcUb89-m7DG6b729TRiF86qtU5LM4fbqyp2S7ctZnQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Asha Bhosle",
    "role": "Artist",
    "image": "https://yt3.googleusercontent.com/ytc/AIdro_mIWst8Y8BTrt9z1sFERFgwQ8QTyZWX6bmguKavScFlog=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Sunidhi Chauhan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/cI3RMhRcDJQg73GEBVYxW6rLZwIq_n5qZyE8IhUM6zJF5WOVpYPyEN2avZMF-2TDtCIFr9qogW4=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Atif Aslam",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/o_C-zwiPP8Wgz7T9wi9WzHEUN4lpnpHVoWRTJ0zn8OZECvIqmXUyTTSmTaQW1uKUrEeNFTtU2k0=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Darshan Raval",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/9lSNE7GRMKcDG26OqpuaX6wQVsubvwtQT5PXlGEI1mEOzbcAsNZ_8vDXABKLo4gJlyPBPS1uYA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Jubin Nautiyal",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/H2Ml5UObbCePh2hgUmfLLV3d7NoNO6pqgloMKOMD30sGvOSyBGzeZoNBm_hOwzAzGMHn2Lpn=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Mika Singh",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_kxV6a0zmy5XJAZ61ALwhzYKPoExUe2bIAqhdrkIaoiahs=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Badshah",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/-9oGvXUOGtVCmGynMpDFsgufXGL_IRKYxjF3bff8_qnIazQDrIa2MXDT5-xAKAA6rIEC8x2EfiM=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Yo Yo Honey Singh",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/2uUjDK69h-ijAxl6a_XrmKqLdL3ECr78FXXkUWERGJAHpSH0p3DEiNdlOuaR8LT3QCCF9P_ghg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Guru Randhawa",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/djplSJ25P6NAn2Tzvbi-nnUwJdnLtwqReZK5I0Vk3q72oM9nGnkWzTB9TLVfVRa7W1_iju0YQ0E=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Diljit Dosanjh",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/7EYXXMXY594V8y4sZT2aawmdKgDAGTu5jNm9C-HpR3jY9cZJ0NMxS__nZKBdWZ1PUpJPjc2BAA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "K.S. Chithra",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_kCGTSKgzGoApggAtgunIKogbnrQQSeQ1i8UlfteLmoAKk=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "S.P. Balasubrahmanyam",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_k-cEae30gRWw3b0ZvH1NrJN4qkQ--kZwixsI0uXqV-13E=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Yesudas",
    "role": "Artist",
    "image": "https://yt3.googleusercontent.com/ytc/AIdro_mOzBohiOrDQWMpnBznY16toIWn4FzbeivP9eS2mIqF298=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Hariharan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/2QMn_GW5tyQI4G2SUK734ZuO09xsRYGSSDa3sCUszaau290JmjvvnS4nseSK3SEY31B0pWbqaQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Shankar Mahadevan",
    "role": "Artist",
    "image": "https://yt3.googleusercontent.com/ytc/AIdro_lxfdg5ZRXrQ-3AJDyHqRGGmdmNijuPbhYIdLPU9F5qSf1Z=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Vishal Dadlani",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/eObpSRvKoWaQZz8KcwYWfKjPVltStK6w68tlEbvLbl3mymlMfleXSNzRcvTG2kmLaeEqqMJuvQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Shekhar Ravjiani",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/6ubE1FtZwwNd2C7ahUGo3jQsMKPMM4WCtlfj4qrPoMZnZrycY_BX3NFthm5InTvFTls-OxZqdA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Amit Trivedi",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/vLFf_rhkrGbA6qJYxNdtH4uTT55yEDftwJUyI_LPCaiNxIlUBfWcS8ckva5ZD2JF9_Od4oNBTw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Pritam",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/cUtlode_d2bd71bN6AFO-8vZ6Q0KDBWWWgLO9RG9RDRb6Jddw5pSSQN7U9I1Pnb7L0JyWHC82Q=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Mohit Chauhan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/iHlTfXwk3wCV5hwHWFJXZeNSSwHWU1KqvdkH3mP0eStfxHiiLL7QA7qAmKDpPJDW_z-NuxMrzaA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Shaan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/i5LOfQ8gES1w0m7G0nEdta24UgIZkNBZZrsaLYF6U18fgPj2YuZ4qGYyRcAFCAjRoYyF-8AX=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "KK",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/4XC6r7BS8SiH0RRyXnaXaDzl1Iv7PeFxEVv0khdfaarlR0kKQFysVU3VdMfWQSczstia9w2mv38=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Armaan Malik",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/-mURsoNpdl3A5rIywphE98BrLBbUExgzY1AYil_qgBtgAosGD7YgWdQ2VCPhOESWlZrgWxq5=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Amaal Mallik",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ai-f5ZCVJ7c-oc-rew5m0OzgM3Vqntu0s7avu0_0NhkIcHlKWhReRCQsVr9-Q9B5Cwym4MarOQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Bappi Lahiri",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/e86NH0OOOGmTI-0rGxapF7RhpQsfv0mIxDKPSF1e5c6Z2eW2R0NkgSFx5J2nmp16t7PMvur7jQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Mohammed Rafi",
    "role": "Artist",
    "image": ""
  },
  {
    "name": "Mukesh",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/tyeB_Soa4UKGDZz6a6guVdixn5_mBlxVCKHY3yeohqDsK1TzRYr3lGJWhn2JeYQzhi0SIXRbhw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Hemant Kumar",
    "role": "Artist",
    "image": "https://yt3.googleusercontent.com/ytc/AIdro_kvw0Ok7MWPzrt-UoxmEYymNd_RYE7jZgr28yJO7uWmDAo=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Manna Dey",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/gBDgPkzQKdW4q7vMB52dTYSWdImmR8t626oD4nbYH_qTJmlz7Ziaxnedrqj9AfhktVPFRgXq2g=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Geeta Dutt",
    "role": "Artist",
    "image": ""
  },
  {
    "name": "Shamshad Begum",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/JnSWLHSvtV7qgdHrKf4EDD5VGdBGESDWrdO0_S2tBb78AO_mhLeJ7sP8lCm_ejcch9ZUmJeu0Q=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Suraiya",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/gROoXIi5JeZSWGOUFvFQBhfPAp0c6c3LZcIiWtnVvSeQUpOQn9nlgf-RmMb1mrhY55mux-gGHw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Kavita Krishnamurthy",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/H1k69zHrKg3ri3xadTwBU5nsH7cKcfJbEgi5fSjFqvnvEGPCfACsmEXG-HJp8DPdWj6yDHxB0MA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Anuradha Paudwal",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/3_aXOzmvqweQgBaXbFLccZlhXq2-AMo_ZaCjCKnulj8kicdbf1fw-_3thbSD_3ujOY4K3lzz1A=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Sadhana Sargam",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/Yu93qTU1a2VyGZ5uQMR3dO46cNnhPxgP72O5oAppre-YrjPCsfiClNZEQv-Y0TZh1ibSg-rG=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Palak Muchhal",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/iQGSyp9TuKL-zmvDdEw030BOsH3kM0g_vKjbs_EMtBvGTxQ9IBHNxGhAPksqu_E0vOQ0j_JRmA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Neeti Mohan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/UeKSaQL3zQMF0pCromzDHpg0_emSz4KFqSYByKxKhK6p0rKNuhprzwb0MNWF4smuiArf6r2dhQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Jonita Gandhi",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/e-WlED_5ApeSSOnATNXmsrkfpyF2c0pAVfGHCYyCN_6zwtC-4T1oPbO5twWsVchyKNEb2Poa=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Shilpa Rao",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_mGOu8_tOsJoSRMchjCbTn_o7oAoQuks7ubc2YUt30czRE=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Aditi Singh Sharma",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/yW8FWHBuNfNaF8hyv5Gea42zsOjsqb6W4pDr5UT6FRyankLJbzwv-dFlaKxAVeM7-bQNwv9iFQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Monali Thakur",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_mc-YUD0xKbqnsI_6iejuURD66IBX8S5YMRxaEoefTg0A=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Kanika Kapoor",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/bYSwtEV7ohq_DcH2RRbSi2Uv4247EPIliIJqVaUNBJ5cp_m6e0MmoZoP6k-2L7WLRZGLw7GS5Q=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Tulsi Kumar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/Ea_u7o1gYEKehVYjz_DQYUi-Nrsmo6EIJKYt2HuNbnaUPCQsV-M68OoXEtAfN3bRBAH1fuMuew=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Dhvani Bhanushali",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/OjW3T5ouXzjKO39bqPuC2ErTJXiU8P4qaeltjSiy1iuUe-51ldVh6bM91KUpWgLOs_T_urKniw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Asees Kaur",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/YzQGOWRcNZCx8ZwSLsKE4QCCUpchjm0JJJLWhDzKqMSACIqLW-iZa-ICi1L0ZZDPf_gLr719OA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Shirley Setia",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/vgCe_9a83erWYz3K7cuF0cyEYkx4WwAyddgfJeWNYPiQdXO42CAU0rkIRWZVSa1S8-Zu-O-LAA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Hardy Sandhu",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/vZeoJSo7RDQpPnGjTe0Lx1xuDN2zLCcOS5O8FdT9r1YZjkcAJ4FdzSqTe5yfVgHTkShMJH2NsA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Ammy Virk",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/xxdiZ92uX4-r1-rvVc2n9Mv8W2Wnw3U56T1T5ddmPZu7i-ERrzL13W7ys32_hFN6CgA00HPD1QM=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "B Praak",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/v3OLvtC4FbLMVN8q1NTWVMHC_PA1fB6kQ_G78J4zqh7wQfgeodjTTK85kxWmh-4HJuc5N58i9Q=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Jassie Gill",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/EYQAp8m5_TvoBdO8kyC7q2W3JXsquW_jKgvOjlLtczZjhMbVefpqP8BH2sRjlk8863tcxlBDBA=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Sidhu Moose Wala",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_kiQJ0Hhp0O-tdaY1dy81-gSNujjccUlWstnpFr686ZlMk=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Karan Aujla",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/Da4zbrS4XLxzb3xVNT14aKr22aBg1blJCuCBppbYglO_uDmElYopgoDk7XV6UWNxthI96XOYrw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Garry Sandhu",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/on0agiZFCsfLzEAnZp0WeVju_ec_GaxD5LXlaRXYqmyvnpWw8Z9HhhJOzAiMLn1uF6oIvqtuZuw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Satinder Sartaaj",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/JaW60MdwEHgeN3wNHFf2hnRdlaKaoLqSTPpUB5PYAL-Aig5g7AzbdBz9Md6Acj52emLL-wIp=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Ravi",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/h9FNCmnSOlDxRP_15lbqtLSCnG3dFn5hhF77vuvwJsTtYkVJVrtk19eZInAt8kYRTY83cfCb=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Anirudh Ravichander",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/Tyx1R_RCijQJcBOOJEDqubRkpH0CYKeb_8KfxY_KCrGVktmwkB9yXYgQmwXySThHppPycR75=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Devi Sri Prasad",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_kA66CGEVLVE0h0YpG7iU87PR2QCQcKwFC6pnD_Xk7_pRo=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Thaman S",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/pPHY2meVlq17vPG5ILDC1pwidcrz0BSSOj0ym9iycnbNAlpwlxRoOhyrteoD5-61WcjTooQ6Nw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Harris Jayaraj",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/HdLl7UsS14OA5gnqFwTfHk5ClL4-a3g2eo2_Udr15jcFgOWLotM3w7_BFs3Fgk1Uh68wF74mIg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Yuvan Shankar Raja",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/fC6KgtkXCEgppU133FosX_nKr7VeiGpSKh0tb0OlF7dv3argY8ZE4K2Nn1T_zX839KZo0YKA4w=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "M.M. Keeravani",
    "role": "Artist",
    "image": ""
  },
  {
    "name": "Ilaiyaraaja",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/PimA4XNPAQMA7BQJAayg3CqvWGKPSCloQXjwOeS72il1VtOIoyCJNllZ0I0hwY6oa_tpawHu0kM=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Vidyasagar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/cx8eq-hGm3jgjNdOnbLzirSpnPmmrnCZmTcdX3ocMdzq2lm_acHwr7cfb5U8pW3gs4JbGCWjaQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "G.V. Prakash Kumar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/jEh-GLa0VeT7J8D3IhnDH9WqfdPNTp0OthFle0NNtpU6b2nVHUr3vS_trVXlBeYROz-36bAQYw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "D. Imman",
    "role": "Artist",
    "image": "https://yt3.googleusercontent.com/ytc/AIdro_k9Qm2co3VHDrS9m_726uz0GxDRu1uWvFpo_d9-ZLlfjh4=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Santhosh Narayanan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/YfMj32x0B85XqpZCgWu1KXSSXsy8t4Ajt3GUIJw5oLLU94for_wN4HMDQYNvO3U-Hou1TiML9w=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Ghibran",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/0iTsLseAxYeNA6Os3vPpNGXPMvetwZ1TDc7qU9a3EvnqEEkSFCIdGEqA0orlSpfjNRHkPgsg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Vijay Antony",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/6wPyqCJCgEwys5PBHVU2fmh5apg5v2z1PIDCljvF52bfFG0OEUei3_YONVs_ZAIqDwvLfH27=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Hesham Abdul Wahab",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_mjy1zj7IVDhdBMkrH-Q4YBuXnatZ6iLMXLIrLE9fDxOg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Gopi Sundar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/LYoBFbwEB15sLyGLOg3b_EsKwNdg1QqfqTWRRCH4DM7t5sDQyoLWjQmHfNAd0PoZpkCIaFvfXQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Deepak Dev",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/rjnhctZPw1mthbmIs6U5mgcmdNknZwM_vHYYb_7sD8W9AYBBqpzvUq-pCT1sh8PWUJjYE-4X1A=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Rahul Raj",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/fG4MeTMsIQuhb2oL7AvGegrvHEFdMaT_Uvq7CZziwon3eVyRydPku6mpSV5h-xEjXuR3iw-T5-k=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Ouseppachan",
    "role": "Artist",
    "image": ""
  },
  {
    "name": "Raveendran",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/eGbd_n2RaARPn3ufFD_2NHi36zNHCCG0rhlhfrY4na4yZRi577Ma3Z0TWPU0f9gVc7QHRRJqWQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Devarajan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/Gjz-v9Q9ALZl3jfcoukdWHpXRJHOl24F7EiB-wZZS0OLw97gSSXWPXCnm2XVEp5hlwgdgNDO=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "V. Dakshinamoorthy",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/G1gfnLUVVmTlk0TixhOprwNTgW590kNHXLCuE_q0oFJKXSBC0viwokykAWOAoQv8a2Uh_XbNEa0=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Salil Chowdhury",
    "role": "Artist",
    "image": ""
  },
  {
    "name": "R.D. Burman",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/1dNWJ9ukvCtjzznwdndtuJvglS5laVTBycFkhsS_r0dZ6Mew54iCfzir95aW8GJljLoGrFZAbg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "S.D. Burman",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/FIKqwHvyQe7HL8f1wYQXQp_4yyiTuJD8KmWybk9kRoeld7I58MmsC6Uefih-dBQM7WddVvlcffI=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "O.P. Nayyar",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/Nv_DfkXaYoEvKs0k7F4eu6AQI7aSPxzHOT5Urvl07pMxYkOcKgzsoWeFFoCszTyBZCufGtOyZw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Madan Mohan",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/_39VTRajSa4_DMQUE0LpsJRcUrOKd7zQWwI2-gJmSfLtQkfW6sVGDBwWlZVQcBFKdGHJNg3zbw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Naushad",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/4fNLrf5Sl5GCY4BxVtYsFmd0Y6o_ssOFxNIprigQ-3GL3TTIHDKkIqmdbYIK9xn8CQG9-0OmNQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Khayyam",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/qgRkOfrrhObjHZ4CitMgnEzNMnJCYmSE06qDk6zaefqo_0cH_efIku6KqpGtbxrqmm5jEcu1cw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Laxmikant-Pyarelal",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/qwlc9Yekzk-r4_0p5Im8hRlr0psGdoh2MPqBcblOMsWHF4gmpdpAkU5Jquq_PcU_2U8HgItayg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Kalyanji-Anandji",
    "role": "Artist",
    "image": ""
  },
  {
    "name": "Nadeem-Shravan",
    "role": "Artist",
    "image": "https://yt3.googleusercontent.com/ytc/AIdro_lq5hnVoWTPYuWYyCT7GCTYBO8FBly_2m2ZOsKylblZwg=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Jatin-Lalit",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/zRIsM9wdf9RVawY2WXafCNQ1FGdkd_k4z7I7Tol186x046nYNTjVEGlg44nMDhUSSqspoUVvaQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Anu Malik",
    "role": "Artist",
    "image": ""
  },
  {
    "name": "Himesh Reshammiya",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/vnz782S2Yld9jy6mAg2kNvwjDCsOZADNgAsyVCHsu3usdW0uNqHNCAOxywwGM3Fvw9Pq7EsGM48=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Sajid-Wajid",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_kOLef5VUbX-vMB8m5OIRDntPLmi328cHZIdjaDOblEeQ=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Meet Bros",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/ytc/AIdro_koHsROua0GHlcexJaNnnWrQKUFRKsgcsOROPUNMfSgIw=s88-c-k-c0x00ffffff-no-rj-mo"
  },
  {
    "name": "Tanishk Bagchi",
    "role": "Artist",
    "image": "https://yt3.ggpht.com/Uzlf4JggdL9rdRgYPAfIYMZ5NxusOwPLGhgfOLbtHTDhtduuRfmacLg2AUpIcPStDCcsSwRE=s88-c-k-c0x00ffffff-no-rj-mo"
  }
];

const POPULAR_ALBUMS = [
  { id: "B61fSzdCzzs", videoId: "B61fSzdCzzs", title: "Aashiqui 2", artist: "Mithoon, Ankit Tiwari", image: "https://i.ytimg.com/vi/B61fSzdCzzs/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/B61fSzdCzzs/hqdefault.jpg", query: "Aashiqui 2 full album songs jukebox" },
  { id: "ZdyaixHYviA", videoId: "ZdyaixHYviA", title: "Yeh Jawaani Hai Deewani", artist: "Pritam", image: "https://i.ytimg.com/vi/ZdyaixHYviA/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/ZdyaixHYviA/hqdefault.jpg", query: "Yeh Jawaani Hai Deewani full songs jukebox" },
  { id: "SQWDGLnvxF4", videoId: "SQWDGLnvxF4", title: "Sanam Teri Kasam", artist: "Himesh Reshammiya", image: "https://i.ytimg.com/vi/SQWDGLnvxF4/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/SQWDGLnvxF4/hqdefault.jpg", query: "Sanam Teri Kasam full songs jukebox" },
  { id: "BDlNjOc3wiQ", videoId: "BDlNjOc3wiQ", title: "Kabir Singh", artist: "Sachet-Parampara, Mithoon", image: "https://i.ytimg.com/vi/BDlNjOc3wiQ/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/BDlNjOc3wiQ/hqdefault.jpg", query: "Kabir Singh full album songs jukebox" },
  { id: "ARtRGkaG_OA", videoId: "ARtRGkaG_OA", title: "Rockstar", artist: "A.R. Rahman", image: "https://i.ytimg.com/vi/ARtRGkaG_OA/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/ARtRGkaG_OA/hqdefault.jpg", query: "Rockstar audio jukebox songs" },
  { id: "jsgPZVMfJQk", videoId: "jsgPZVMfJQk", title: "Animal", artist: "Pritam, Vishal Mishra", image: "https://i.ytimg.com/vi/jsgPZVMfJQk/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/jsgPZVMfJQk/hqdefault.jpg", query: "Animal movie all songs audio jukebox" },
];

const POPULAR_RADIO = [
  { id: "O5gwxm3NxFU", videoId: "O5gwxm3NxFU", title: "Arijit Singh Radio", artist: "With Pritam, A.R. Rahman", image: "https://i.ytimg.com/vi/O5gwxm3NxFU/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/O5gwxm3NxFU/hqdefault.jpg", query: "Arijit Singh Best Songs jukebox" },
  { id: "r0c1f6XxRQg", videoId: "r0c1f6XxRQg", title: "Evergreen KK Radio", artist: "With Pritam, Roop Kumar", image: "https://i.ytimg.com/vi/r0c1f6XxRQg/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/r0c1f6XxRQg/hqdefault.jpg", query: "KK best songs jukebox" },
  { id: "dvgZkm1xWPE", videoId: "dvgZkm1xWPE", title: "Shreya Ghoshal Radio", artist: "With Atif Aslam", image: "https://i.ytimg.com/vi/dvgZkm1xWPE/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/dvgZkm1xWPE/hqdefault.jpg", query: "Shreya Ghoshal romantic hits jukebox" },
  { id: "S6IW8Rj1WqQ", videoId: "S6IW8Rj1WqQ", title: "Alka Yagnik 90s Radio", artist: "With Kumar Sanu, Udit Narayan", image: "https://i.ytimg.com/vi/S6IW8Rj1WqQ/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/S6IW8Rj1WqQ/hqdefault.jpg", query: "Alka Yagnik 90s hits jukebox" },
  { id: "cIGd8gm_pYE", videoId: "cIGd8gm_pYE", title: "Diljit Dosanjh Radio", artist: "With Harrdy Sandhu, AP Dhillon", image: "https://i.ytimg.com/vi/cIGd8gm_pYE/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/cIGd8gm_pYE/hqdefault.jpg", query: "Diljit Dosanjh hit songs jukebox" },
  { id: "P9YpfmNc_p4", videoId: "P9YpfmNc_p4", title: "A.R. Rahman Live Radio", artist: "With Hariharan, Javed Ali", image: "https://i.ytimg.com/vi/P9YpfmNc_p4/hqdefault.jpg", thumbnail: "https://i.ytimg.com/vi/P9YpfmNc_p4/hqdefault.jpg", query: "AR Rahman magical hits jukebox" },
];

const ScrollableRow = ({ items, renderItem, title, subtitle, showAll: controlledShowAll, setShowAll: setControlledShowAll, fallbackItems = [] }) => {
  const scrollRef = React.useRef(null);
  const [internalShowAll, setInternalShowAll] = React.useState(false);

  const showAll = controlledShowAll !== undefined ? controlledShowAll : internalShowAll;
  const setShowAll = setControlledShowAll !== undefined ? setControlledShowAll : setInternalShowAll;

  const validItems = Array.isArray(items) && items.length > 0 ? items : [];
  const safeFallback = Array.isArray(fallbackItems) && fallbackItems.length > 0 ? fallbackItems : [];
  const rowItems = validItems.length > 0 ? validItems : safeFallback;

  const scroll = (direction) => {
    if (scrollRef.current) {
      if (direction === 'left') {
        scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
      } else {
        scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 w-full min-w-0">
      <div className="flex items-end justify-between mb-2.5 sm:mb-4">
        <div className="min-w-0 pr-2">
          {title && <h2 className="text-base sm:text-lg md:text-2xl font-display font-extrabold text-white tracking-tight truncate">{title}</h2>}
          {subtitle && <p className="text-neutral-400 mt-0.5 md:mt-1 text-xs md:text-sm font-medium line-clamp-1">{subtitle}</p>}
        </div>
        <button 
          onClick={() => setShowAll(!showAll)}
          className="text-xs font-bold uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors shrink-0"
        >
          {showAll ? 'Show Less' : 'View All'}
        </button>
      </div>

      {showAll ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-4 md:gap-6 w-full min-w-0">
          {rowItems.map((item, i) => (
            <React.Fragment key={i}>
              {renderItem(item, i, true)}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="relative group/carousel w-full min-w-0">
          <button onClick={() => scroll('left')} className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -ml-4 w-8 h-8 md:w-10 md:h-10 bg-neutral-800/80 rounded-full items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10 hover:bg-neutral-700 shadow-xl border border-neutral-700">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <div ref={scrollRef} className="flex gap-2.5 sm:gap-4 md:gap-6 overflow-x-auto pb-3 sm:pb-4 hide-scrollbar scroll-smooth w-full min-w-0">
            {rowItems.map((item, i) => (
              <div key={i} className="w-[104px] sm:w-36 md:w-48 shrink-0">
                {renderItem(item, i, false)}
              </div>
            ))}
          </div>
          <button onClick={() => scroll('right')} className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 -mr-4 w-8 h-8 md:w-10 md:h-10 bg-neutral-800/80 rounded-full items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10 hover:bg-neutral-700 shadow-xl border border-neutral-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>
      )}
    </div>
  );
};
export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      if (path === '/admin') return 'admin';
      if (path === '/discover' || params.get('q')) return 'discover';
    }
    return 'home';
  });

  const [cmsConfig, setCmsConfig] = useState(() => {
    const cached = getCachedCmsConfig();
    applyThemeToDom(cached.theme, false);
    return cached;
  });

  useEffect(() => {
    fetchPublicCmsConfig(BACKEND_URL).then(cfg => {
      if (cfg) {
        const normalized = normalizeCmsConfig(cfg);
        setCmsConfig(normalized);
        applyThemeToDom(normalized.theme, true);
      }
    });

    const handleConfigUpdate = (data) => {
      if (data?.config) {
        const normalized = normalizeCmsConfig(data.config);
        setCmsConfig(normalized);
        try {
          localStorage.setItem('afterhours_cms_public_config', JSON.stringify(normalized));
        } catch (e) {}
        applyThemeToDom(normalized.theme, true);
      } else {
        fetchPublicCmsConfig(BACKEND_URL).then(cfg => {
          if (cfg) {
            const normalized = normalizeCmsConfig(cfg);
            setCmsConfig(normalized);
            applyThemeToDom(normalized.theme, true);
          }
        });
      }
    };

    socket.on('cms_config_updated', handleConfigUpdate);
    return () => {
      socket.off('cms_config_updated', handleConfigUpdate);
    };
  }, []);

  useEffect(() => {
    if (cmsConfig?.branding?.siteName) {
      const siteTagline = cmsConfig.branding.tagline || cmsConfig.branding.siteTagline;
      document.title = siteTagline
        ? `${cmsConfig.branding.siteName} — ${siteTagline}`
        : `${cmsConfig.branding.siteName} — Streaming Lounge`;
    }
    if (cmsConfig?.branding?.faviconUrl) {
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = cmsConfig.branding.faviconUrl;
    }
    if (cmsConfig?.theme) {
      applyThemeToDom(cmsConfig.theme);
    }
  }, [cmsConfig?.branding, cmsConfig?.theme]);

  const stationsMap = React.useMemo(() => {
    const base = { ...SPECIAL_STATIONS };
    if (Array.isArray(cmsConfig?.stations)) {
      cmsConfig.stations.forEach(s => {
        if (s && s.id && base[s.id]) {
          base[s.id] = {
            ...base[s.id],
            title: s.title || s.name || base[s.id].title,
            subtitle: s.subtitle || s.description || base[s.id].subtitle,
            badge: s.badge || base[s.id].badge,
            bgImages: (s.artwork || s.artworkUrl || s.bgImages?.length) 
              ? [s.artwork || s.artworkUrl || s.bgImages[0]].filter(Boolean) 
              : base[s.id].bgImages
          };
        }
      });
    }
    return base;
  }, [cmsConfig?.stations]);

  useEffect(() => {
    const handleClickOutsideMenu = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutsideMenu);
    return () => document.removeEventListener('click', handleClickOutsideMenu);
  }, []);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);

  const validateAndSanitizeItems = (raw, fallback) => {
    try {
      if (!raw) return fallback;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(parsed) || parsed.length < 3) return fallback;
      const cleaned = parsed.map(item => {
        const rawId = typeof item?.id === 'string' ? item.id : (item?.id?.videoId || item?.videoId);
        if (!rawId || typeof rawId !== 'string' || rawId.length < 5) return null;
        return {
          ...item,
          id: rawId,
          videoId: rawId,
          title: item.title || 'Unknown Title',
          artist: item.artist || 'Unknown Artist',
          thumbnail: item.thumbnail || item.image || `https://i.ytimg.com/vi/${rawId}/hqdefault.jpg`,
          image: item.image || item.thumbnail || `https://i.ytimg.com/vi/${rawId}/hqdefault.jpg`
        };
      }).filter(Boolean);
      return cleaned.length >= 3 ? cleaned : fallback;
    } catch (e) {
      return fallback;
    }
  };

  const [trendingSongs, setTrendingSongs] = useState(() => {
    return validateAndSanitizeItems(localStorage.getItem('afterhours_trending'), TRENDING_SONGS);
  });
  const [popularAlbums, setPopularAlbums] = useState(() => {
    return validateAndSanitizeItems(localStorage.getItem('afterhours_albums'), POPULAR_ALBUMS);
  });
  const [popularRadio, setPopularRadio] = useState(() => {
    return validateAndSanitizeItems(localStorage.getItem('afterhours_radio'), POPULAR_RADIO);
  });

  useEffect(() => {
    const fetchDynamicSection = async (query, setState, storageKey) => {
      try {
        const res = await fetchFromBackend(query);
        if (res?.items && Array.isArray(res.items) && res.items.length > 0) {
          const list = res.items.map(i => {
            const vid = (typeof i.id === 'string' ? i.id : i.id?.videoId) || (typeof i.videoId === 'string' ? i.videoId : null);
            const img = getCleanThumbnail(i, vid);
            return {
              id: vid,
              videoId: vid,
              title: i.snippet?.title || 'Unknown Title',
              artist: i.snippet?.channelTitle || 'Unknown Artist',
              image: img,
              thumbnail: img,
              query: (i.snippet?.title || '') + " " + (i.snippet?.channelTitle || '')
            };
          }).filter(item => item.id && typeof item.id === 'string' && item.id.length >= 5 && item.title);

          // Only replace state if we have a rich, valid list of at least 3 tracks
          if (list.length >= 3) {
            setState(list);
            try { localStorage.setItem(storageKey, JSON.stringify(list)); } catch (e) {}
          }
        }
      } catch (e) {
        console.warn(`[Dynamic Content] Notice fetching ${storageKey}:`, e.message);
      }
    };

    // Stagger section fetches to eliminate concurrent YouTube scraping / 429 rate limit
    fetchDynamicSection("latest trending hindi hit songs", setTrendingSongs, 'afterhours_trending');

    const albumsTimer = setTimeout(() => {
      fetchDynamicSection("latest hit bollywood albums audio jukebox", setPopularAlbums, 'afterhours_albums');
    }, 1200);

    const radioTimer = setTimeout(() => {
      fetchDynamicSection("bollywood lofi romantic hits radio jukebox", setPopularRadio, 'afterhours_radio');
    }, 2400);

    return () => {
      clearTimeout(albumsTimer);
      clearTimeout(radioTimer);
    };
  }, []);

const sanitizeCache = (cache) => {
  try {
    if (!cache) return {};
    const newCache = { ...cache };
    Object.keys(newCache).forEach(k => {
      newCache[k] = newCache[k].map(track => {
        const vid = track.videoId || track.id;
        track.thumbnail = getCleanThumbnail(track, vid);
        if (track.image) track.image = track.thumbnail;
        return track;
      });
    });
    return newCache;
  } catch(e) { return {}; }
};
const sanitizeList = (list) => {
  try {
    if (!Array.isArray(list)) return [];
    return list.map(track => {
      const vid = track.videoId || track.id;
      track.thumbnail = getCleanThumbnail(track, vid);
      if (track.image) track.image = track.thumbnail;
      return track;
    });
  } catch(e) { return []; }
};

const isValidMongoId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);


  const [likedSongs, setLikedSongs] = useState(() => {
    const u = JSON.parse(localStorage.getItem('afterhours_user') || 'null');
    return sanitizeList(u ? JSON.parse(localStorage.getItem('liked_songs') || '[]') : []);
  });
  const [history, setHistory] = useState(() => {
    const u = JSON.parse(localStorage.getItem('afterhours_user') || 'null');
    return sanitizeList(u ? JSON.parse(localStorage.getItem('history_songs') || '[]') : []);
  });
  const [playlists, setPlaylists] = useState(() => {
    const u = JSON.parse(localStorage.getItem('afterhours_user') || 'null');
    return sanitizeList(u ? JSON.parse(localStorage.getItem('playlists') || '[]') : []);
  });
  const [selectedPlaylistForView, setSelectedPlaylistForView] = useState(null);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const [searchCache, setSearchCache] = useState(() => sanitizeCache(JSON.parse(localStorage.getItem('youtube_search_cache') || '{}')));
  const [stationCache, setStationCache] = useState(() => sanitizeCache(JSON.parse(localStorage.getItem('youtube_station_cache') || '{}')));

  const [currentSong, setCurrentSong] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('afterhours_current_song')) || null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (currentSong) {
        localStorage.setItem('afterhours_current_song', JSON.stringify(currentSong));
      } else {
        localStorage.removeItem('afterhours_current_song');
      }
    } catch (e) {}
  }, [currentSong]);
  const [isPlaying, setIsPlaying] = useState(false);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const playerRef = useRef(null);
  const wasPlayingBeforeAuthRef = useRef(false);
  const isInitialMountRef = useRef(true);

  const [isShuffle, setIsShuffle] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('afterhours_shuffle') || 'false');
    } catch (e) {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('afterhours_shuffle', JSON.stringify(isShuffle));
    } catch (e) {}
  }, [isShuffle]);

  const [isRepeat, setIsRepeat] = useState(() => {
    try {
      const saved = localStorage.getItem('afterhours_repeat');
      if (saved === 'one' || saved === 'all') return saved;
      return JSON.parse(saved || 'false');
    } catch (e) {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('afterhours_repeat', typeof isRepeat === 'string' ? isRepeat : JSON.stringify(isRepeat));
    } catch (e) {}
  }, [isRepeat]);

  const [volume, setVolume] = useState(() => {
    try {
      const v = localStorage.getItem('afterhours_volume');
      return v !== null ? parseInt(v, 10) : 80;
    } catch (e) {
      return 80;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('afterhours_volume', volume.toString());
    } catch (e) {}
  }, [volume]);
  const [soundProfile, setSoundProfile] = useState('flat');

  const [partyTracks, setPartyTracks] = useState([]);
  const [heartbreakTracks, setHeartbreakTracks] = useState([]);
  
  const [stationLoading, setStationLoading] = useState(false);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);
  const [showMobileTip, setShowMobileTip] = useState(true);

  const [videoModalSong, setVideoModalSong] = useState(null);
  const [isPipActive, setIsPipActive] = useState(false);

  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('q');
      if (q) return q.trim();
    }
    return '';
  });
  const [songs, setSongs] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchVisibleCount, setSearchVisibleCount] = useState(10);
  const [stationVisibleCounts, setStationVisibleCounts] = useState({ barber: 50, truck: 50, pauwa: 50 });
  const stationVisibleCount = stationVisibleCounts[activeTab] || 50;
  const [isLoadingMoreStation, setIsLoadingMoreStation] = useState(false);
  const stationPageRef = useRef({ barber: 1, truck: 1, pauwa: 1 });

  const handleLoadMoreStationSongs = useCallback(async () => {
    const currentCount = stationVisibleCounts[activeTab] || 50;
    const targetCount = currentCount + 10;

    // Immediately increment visible count so tracks already in songs appear instantly
    setStationVisibleCounts(prev => ({ ...prev, [activeTab]: targetCount }));

    // If approaching or exceeding currently loaded songs, fetch more or generate curated extension
    if (targetCount >= songs.length) {
      setIsLoadingMoreStation(true);
      const station = stationsMap[activeTab] || SPECIAL_STATIONS[activeTab];
      const page = (stationPageRef.current[activeTab] || 1) + 1;
      stationPageRef.current[activeTab] = page;

      try {
        const queryMap = {
          barber: [
            "best 90s bollywood superhit romantic songs alka yagnik udit narayan",
            "kumar sanu alka yagnik romantic evergreen songs 90s",
            "sonu nigam 2000s nostalgic bollywood hits",
            "90s bollywood classic melody songs"
          ],
          truck: [
            "punjabi highway dhabha truck high bass songs",
            "altaf raja superhit songs hindi",
            "diljit dosanjh sidhu moose wala punjabi hits",
            "daler mehndi sukhbir superhit dance songs"
          ],
          pauwa: [
            "desi party drinking songs yo yo honey singh badshah",
            "late night party banger songs desi hip hop",
            "ap dhillon karan aujla party hits",
            "punjabi peg daru party anthems"
          ]
        };

        const queryList = queryMap[activeTab] || station?.queries || ["bollywood hits"];
        const selectedQuery = queryList[(page - 2) % queryList.length];

        const data = await fetchFromBackend(selectedQuery);
        if (data?.items?.length > 0) {
          const newTracks = data.items.map(item => ({
            id: item.id.videoId || item.id,
            youtubeId: item.id.videoId || item.id,
            title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
            channel: item.snippet.channelTitle,
            artist: item.snippet.channelTitle,
            duration: "4:00",
            url: `https://www.youtube.com/watch?v=${item.id.videoId || item.id}`,
            coverArt: getCleanThumbnail(item, item.id.videoId || item.id),
            thumbnail: getCleanThumbnail(item, item.id.videoId || item.id),
          }));

          setSongs(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const filtered = newTracks.filter(t => !existingIds.has(t.id));
            const merged = [...prev, ...filtered];
            setStationCache(c => ({
              ...c,
              [activeTab]: { tracks: merged }
            }));
            return merged;
          });
        } else {
          // Curated station pool fallback
          const curatedKey = activeTab === 'barber' ? 'saloon' : (activeTab === 'truck' ? 'horn' : (activeTab === 'pauwa' ? 'theka' : null));
          const baseList = (curatedKey && CURATED_STATION_TRACKS[curatedKey]) || [];
          if (baseList.length > 0) {
            const startIdx = ((page - 2) * 10) % baseList.length;
            const extraBatch = baseList.slice(startIdx, startIdx + 10).map((t, idx) => ({
              ...t,
              id: `${t.id}_ext_${page}_${idx}`,
              title: `${t.title} (Live Set)`
            }));
            setSongs(prev => {
              const merged = [...prev, ...extraBatch];
              setStationCache(c => ({
                ...c,
                [activeTab]: { tracks: merged }
              }));
              return merged;
            });
          }
        }
      } catch (err) {
        console.warn("Could not fetch extra tracks on load more, using curated fallback:", err.message);
        const curatedKey = activeTab === 'barber' ? 'saloon' : (activeTab === 'truck' ? 'horn' : (activeTab === 'pauwa' ? 'theka' : null));
        const baseList = (curatedKey && CURATED_STATION_TRACKS[curatedKey]) || [];
        if (baseList.length > 0) {
          const startIdx = ((page - 2) * 10) % baseList.length;
          const extraBatch = baseList.slice(startIdx, startIdx + 10).map((t, idx) => ({
            ...t,
            id: `${t.id}_ext_${page}_${idx}`,
            title: `${t.title} (Radio Mix)`
          }));
          setSongs(prev => {
            const merged = [...prev, ...extraBatch];
            setStationCache(c => ({
              ...c,
              [activeTab]: { tracks: merged }
            }));
            return merged;
          });
        }
      } finally {
        setIsLoadingMoreStation(false);
      }
    }
  }, [activeTab, songs, stationVisibleCounts]);
  const [queue, setQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('afterhours_queue')) || [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('afterhours_queue', JSON.stringify(queue));
    } catch (e) {}
  }, [queue]);

  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === dropIndex) return;

    const newQueue = [...queue];
    const draggedItem = newQueue[draggedItemIndex];
    newQueue.splice(draggedItemIndex, 1);
    newQueue.splice(dropIndex, 0, draggedItem);
    
    setQueue(newQueue);
    setDraggedItemIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };
  const [mobileQueueTab, setMobileQueueTab] = useState('player');
  const handleOpenExpandedPlayer = (tab = 'player') => {
    setMobileQueueTab(tab);
    setShowQueuePanel(true);
  };
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg, duration = 3200) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, duration);
  }, []);

  const [clockString, setClockString] = useState("");
  const [activeUsersCount, setActiveUsersCount] = useState(742);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveUsersCount(prev => {
        const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return Math.max(100, prev + change);
      });
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  const [showAllTrending, setShowAllTrending] = useState(false);
  const [showAllArtists, setShowAllArtists] = useState(false);
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const [showAllRadio, setShowAllRadio] = useState(false);

  // Auth State
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('afterhours_user') || 'null'));
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('afterhours_token') || '');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const isAdmin = Boolean(
    (user && user.role === 'admin') ||
    (user?.username && [
      'admin@afterhours.com',
      'pankajsss7238@gmail.com',
      'pss809352@gmail.com',
      'ps207800@gmail.com'
    ].includes(user.username.toLowerCase()))
  );

  useEffect(() => {
    if (authToken) {
      fetch(getApiUrl('/api/auth/me'), {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
        .then(async (res) => {
          const parsed = await safeParseJsonResponse(res, 'Token validation failed');
          return parsed.ok ? parsed.data : null;
        })
        .then(data => {
          if (data && data.user) {
            setUser(prev => ({ ...(prev || {}), ...data.user }));
            localStorage.setItem('afterhours_user', JSON.stringify(data.user));
          }
        })
        .catch(() => {});
    } else if (user?.username) {
      const u = user.username.toLowerCase();
      let pass = null;
      if (u === 'admin@afterhours.com') pass = 'admin123';
      else if (u === 'pss809352@gmail.com') pass = '123454321';
      else if (u === 'pankajsss7238@gmail.com') pass = 'Ps207800@@#';

      if (pass) {
        fetch(getApiUrl('/api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: pass })
        })
          .then(async (res) => {
            const parsed = await safeParseJsonResponse(res, 'Auto-login failed');
            return parsed.ok ? parsed.data : null;
          })
          .then(data => {
            if (data && data.token) {
              setAuthToken(data.token);
              localStorage.setItem('afterhours_token', data.token);
              if (data.user) {
                setUser(data.user);
                localStorage.setItem('afterhours_user', JSON.stringify(data.user));
              }
            }
          })
          .catch(() => {});
      }
    }
  }, [authToken, user]);

  const openAuthModal = useCallback(() => {
    if (isPlaying) {
      wasPlayingBeforeAuthRef.current = true;
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        try { playerRef.current.pauseVideo(); } catch (e) {}
      }
      setIsPlaying(false);
    } else {
      wasPlayingBeforeAuthRef.current = false;
    }
    setAuthError('');
    setIsSidebarOpen(false);
    setShowAuthModal(true);
  }, [isPlaying]);

  const closeAuthModal = useCallback((resumed = false) => {
    setShowAuthModal(false);
    if (resumed && wasPlayingBeforeAuthRef.current && currentSong) {
      wasPlayingBeforeAuthRef.current = false;
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        try { playerRef.current.playVideo(); } catch (e) {}
      }
      setIsPlaying(true);
    }
  }, [currentSong]);

  // Remote Hydration on Mount — Reconciles server data with local state so data is never overwritten
  const isHydratedRef = useRef(!user);
  const lastSyncedDataRef = useRef('');
  const syncRetryTimerRef = useRef(null);
  const syncAttemptsRef = useRef(0);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const id = user?.userId || user?._id;
    if (!user || !id) {
      isHydratedRef.current = true;
      return;
    }

    if (!isValidMongoId(id)) {
      console.warn('[Sync] Invalid user ID format:', id);
      return;
    }

    let isMounted = true;
    const hydrateUserData = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/user/${id}`), {
          headers: { 'Accept': 'application/json' }
        });
        const parsed = await safeParseJsonResponse(res, 'User hydration failed');
        if (parsed.ok && parsed.data) {
          const data = parsed.data;
          if (!isMounted) return;

          // Merge without losing local offline edits or remote favourites
          setLikedSongs(prev => {
            const remote = sanitizeList(data.likedSongs || []);
            const map = new Map();
            remote.forEach(s => map.set(s.id, s));
            prev.forEach(s => map.set(s.id, s));
            const merged = Array.from(map.values());
            try { localStorage.setItem('liked_songs', JSON.stringify(merged)); } catch (e) {}
            return merged;
          });

          setPlaylists(prev => {
            const remote = sanitizeList(data.playlists || []);
            const map = new Map();
            remote.forEach(p => map.set(p.id, p));
            prev.forEach(p => map.set(p.id, p));
            const merged = Array.from(map.values());
            try { localStorage.setItem('playlists', JSON.stringify(merged)); } catch (e) {}
            return merged;
          });

          if (Array.isArray(data.history) && data.history.length > 0) {
            setHistory(prev => {
              if (prev.length === 0) {
                const h = sanitizeList(data.history).slice(0, 50);
                try { localStorage.setItem('history_songs', JSON.stringify(h)); } catch (e) {}
                return h;
              }
              return prev;
            });
          }

          if (Array.isArray(data.queue) && data.queue.length > 0) {
            setQueue(prev => {
              if (prev.length === 0) {
                const q = sanitizeList(data.queue);
                try { localStorage.setItem('afterhours_queue', JSON.stringify(q)); } catch (e) {}
                return q;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.warn('[Hydration] Could not fetch remote user data (relying on local storage):', err.message);
      } finally {
        if (isMounted) {
          isHydratedRef.current = true;
        }
      }
    };

    hydrateUserData();
    return () => { isMounted = false; };
  }, [user]);

  // Sync Data — debounced 2.5s after last change, with bounded exponential backoff
  const syncTimerRef = useRef(null);
  useEffect(() => {
    const id = user?.userId || user?._id;
    if (user && !id) {
      setUser(null);
      localStorage.removeItem('afterhours_user');
      return;
    }
    if (!user || !id) return;
    if (!isHydratedRef.current) return; // Never sync before remote hydration is complete
    if (!isValidMongoId(id)) return;

    const payload = {
      likedSongs: sanitizeList(likedSongs),
      history: sanitizeList(history).slice(0, 50),
      playlists: sanitizeList(playlists),
      queue: sanitizeList(queue)
    };
    const payloadStr = JSON.stringify(payload);

    // Skip redundant network sync if nothing changed
    if (payloadStr === lastSyncedDataRef.current) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    if (syncRetryTimerRef.current) clearTimeout(syncRetryTimerRef.current);

    const performSync = async (retryCount = 0) => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;

      try {
        const res = await fetch(getApiUrl(`/api/user/${id}/sync`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr
        });

        if (res.ok) {
          lastSyncedDataRef.current = payloadStr;
          syncAttemptsRef.current = 0;
          return;
        }

        // Retry on transient server errors (502, 503, 504) with bounded exponential backoff (max 3 retries)
        if ([502, 503, 504].includes(res.status) && retryCount < 3) {
          const delay = [2500, 5000, 10000][retryCount] || 5000;
          console.warn(`[Sync] Transient ${res.status} error, retrying in ${delay}ms (attempt ${retryCount + 1}/3)...`);
          syncRetryTimerRef.current = setTimeout(() => {
            isSyncingRef.current = false;
            performSync(retryCount + 1);
          }, delay);
          return;
        }

        if (res.status === 400 || res.status === 404) {
          console.warn('[Sync] Non-retryable response:', res.status);
          return;
        }
      } catch (err) {
        // Network error (e.g. Render waking up or network loss) with bounded exponential backoff
        if (retryCount < 3) {
          const delay = [2500, 5000, 10000][retryCount] || 5000;
          console.warn(`[Sync] Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/3):`, err.message);
          syncRetryTimerRef.current = setTimeout(() => {
            isSyncingRef.current = false;
            performSync(retryCount + 1);
          }, delay);
          return;
        }
        console.warn('[Sync] Retries exhausted. Will retry on next explicit user change:', err.message);
      } finally {
        isSyncingRef.current = false;
      }
    };

    syncTimerRef.current = setTimeout(() => {
      performSync(0);
    }, 2500);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      if (syncRetryTimerRef.current) clearTimeout(syncRetryTimerRef.current);
    };
  }, [likedSongs, history, playlists, queue, user]);

  // Keep-alive ping every 10 minutes to prevent Render cold starts
  useEffect(() => {
    const ping = () => fetch(getApiUrl('/health'), { method: 'GET' }).catch(() => {});
    ping(); // ping once on mount
    const keepAlive = setInterval(ping, 10 * 60 * 1000); // every 10 min
    return () => clearInterval(keepAlive);
  }, []);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setAuthLoading(true);
      setAuthError('');
      const res = await fetch(getApiUrl('/api/auth/google'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential })
      });
      const parsed = await safeParseJsonResponse(res, 'Google Auth failed');
      if (!parsed.ok) throw new Error(parsed.error);
      const data = parsed.data;
      if (!data || !data.user) {
        throw new Error('Invalid user profile received from Google Authentication.');
      }
      
      const loggedInUser = {
        username: data.user.username,
        userId: data.user.userId || data.user._id,
        role: data.user.role || data.role || 'user',
        status: data.user.status || 'active'
      };
      setUser(loggedInUser);
      localStorage.setItem('afterhours_user', JSON.stringify(loggedInUser));

      if (data.token) {
        setAuthToken(data.token);
        localStorage.setItem('afterhours_token', data.token);
      }
      closeAuthModal(true);

      const userLiked = data.user.likedSongs || [];
      setLikedSongs(sanitizeList(userLiked));
      localStorage.setItem('liked_songs', JSON.stringify(sanitizeList(userLiked)));

      const userHistory = (data.user.history || []).slice(0, 50);
      setHistory(sanitizeList(userHistory));
      localStorage.setItem('history_songs', JSON.stringify(sanitizeList(userHistory)));

      const userPlaylists = data.user.playlists || [];
      setPlaylists(sanitizeList(userPlaylists));
      localStorage.setItem('playlists', JSON.stringify(sanitizeList(userPlaylists)));

      const userQueue = data.user.queue || [];
      setQueue(sanitizeList(userQueue));
      localStorage.setItem('afterhours_queue', JSON.stringify(sanitizeList(userQueue)));
      
    } catch (err) {
      console.error('Google Auth Error:', err);
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePlayTrending = async (queryOrTitle, itemObj, contextList = []) => {
    const candidateId = itemObj?.videoId || itemObj?.id || (typeof queryOrTitle === 'object' ? (queryOrTitle?.videoId || queryOrTitle?.id) : null);

    const toFormattedSong = (item, fallbackId) => {
      const id = item?.videoId || item?.id || fallbackId;
      return {
        id,
        videoId: id,
        title: item?.title?.replace(/&quot;/g, '"')?.replace(/&#39;/g, "'")?.replace(/&amp;/g, "&") || "Unknown Title",
        artist: item?.artist || item?.snippet?.channelTitle || "Unknown Artist",
        thumbnail: getCleanThumbnail(item, id),
        duration: item?.duration || "Stream"
      };
    };

    // Instant playback path (0ms network delay)
    if (candidateId) {
      const formattedSong = toFormattedSong(itemObj, candidateId);

      if (Array.isArray(contextList) && contextList.length > 0) {
        const formattedQueue = contextList.map(t => {
          const tId = t?.videoId || t?.id;
          return tId ? toFormattedSong(t, tId) : null;
        }).filter(Boolean);
        // User requested queue to only contain manually added songs, removing auto-population.
      }

      playSong(formattedSong);
      return;
    }

    const query = typeof queryOrTitle === 'string' ? queryOrTitle : (itemObj?.query || itemObj?.title || '');
    if (!query) return;

    if (searchCache[query] && searchCache[query].length > 0) {
      const cached = searchCache[query][0];
      const cachedId = cached?.id || cached?.videoId;
      if (cachedId) {
        playSong(toFormattedSong(cached, cachedId));
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await fetch(getApiUrl(`/api/youtube/search?limit=1&q=${encodeURIComponent(query)}`));
      const parsed = await safeParseJsonResponse(response, 'Failed to fetch trending song');
      if (parsed.ok && parsed.data && Array.isArray(parsed.data.items) && parsed.data.items.length > 0) {
        const item = parsed.data.items[0];
        const formattedSong = {
          id: item.id.videoId || item.id,
          videoId: item.id.videoId || item.id,
          title: item.snippet?.title?.replace(/&quot;/g, '"')?.replace(/&#39;/g, "'")?.replace(/&amp;/g, "&") || "Unknown Title",
          artist: item.snippet?.channelTitle || "Unknown Artist",
          thumbnail: getCleanThumbnail(item, item.id.videoId || item.id),
          duration: "Stream"
        };
        playSong(formattedSong);
      }
    } catch (error) {
      console.warn("Error playing trending:", error.message);
    } finally {
      setIsLoading(false);
    }
  };


  const handleArtistClick = (artistName) => {
    const trimmed = (artistName || '').trim();
    if (!trimmed) return;
    setSearchQuery(trimmed);
    handleStationSelect('discover');
    window.history.pushState({ tab: 'discover', q: trimmed }, '', `/discover?q=${encodeURIComponent(trimmed)}`);
    fetchYouTubeMusic(trimmed);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const parsed = await safeParseJsonResponse(res, isLoginMode ? 'Login failed' : 'Registration failed');
      if (!parsed.ok) throw new Error(parsed.error);
      const data = parsed.data;
      if (!data) throw new Error('Invalid authentication response from server.');
      
      const loggedInUser = {
        username: authForm.username,
        userId: data.userId || (data.user && data.user._id),
        role: data.role || (data.user && data.user.role) || 'user',
        status: (data.user && data.user.status) || 'active'
      };
      setUser(loggedInUser);
      localStorage.setItem('afterhours_user', JSON.stringify(loggedInUser));

      if (data.token) {
        setAuthToken(data.token);
        localStorage.setItem('afterhours_token', data.token);
      }
      closeAuthModal(true);

      if (isLoginMode && data.user) {
        // Existing user login: load their saved account data
        const userLiked = data.user.likedSongs || [];
        setLikedSongs(sanitizeList(userLiked));
        localStorage.setItem('liked_songs', JSON.stringify(sanitizeList(userLiked)));

        const userHistory = (data.user.history || []).slice(0, 50);
        setHistory(sanitizeList(userHistory));
        localStorage.setItem('history_songs', JSON.stringify(sanitizeList(userHistory)));

        const userPlaylists = data.user.playlists || [];
        setPlaylists(sanitizeList(userPlaylists));
        localStorage.setItem('playlists', JSON.stringify(sanitizeList(userPlaylists)));

        const userQueue = data.user.queue || [];
        setQueue(sanitizeList(userQueue));
        localStorage.setItem('afterhours_queue', JSON.stringify(sanitizeList(userQueue)));
      } else {
        // Register mode: Brand new account starts with clean, empty data
        setLikedSongs([]);
        localStorage.removeItem('liked_songs');
        setHistory([]);
        localStorage.removeItem('history_songs');
        setPlaylists([]);
        localStorage.removeItem('playlists');
        setQueue([]);
        localStorage.removeItem('afterhours_queue');
        setCurrentSong(null);
        localStorage.removeItem('afterhours_current_song');
        localStorage.removeItem('afterhours_current_time');
        localStorage.removeItem('afterhours_duration');
        setIsPlaying(false);
        if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
          try { playerRef.current.stopVideo(); } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('[Auth Request Notice]', { isLoginMode, error: err.message });
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setAuthToken('');
    localStorage.removeItem('afterhours_token');
    localStorage.removeItem('afterhours_user');
    localStorage.removeItem('liked_songs');
    localStorage.removeItem('history_songs');
    localStorage.removeItem('playlists');
    localStorage.removeItem('afterhours_queue');
    localStorage.removeItem('afterhours_current_song');
    localStorage.removeItem('afterhours_current_time');
    localStorage.removeItem('afterhours_duration');
    setLikedSongs([]);
    setHistory([]);
    setPlaylists([]);
    setQueue([]);
    setCurrentSong(null);
    setIsPlaying(false);
    if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
      try { playerRef.current.stopVideo(); } catch (e) {}
    }
  };

  const silentAudioRef = useRef(null);
  const videoTimeRef = useRef(0);
  const loadedVideoIdRef = useRef(null);
  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);
  const eqNodesRef = useRef(null);
  const convolverRef = useRef(null);
  const audioElemRef = useRef(null);
  const isRepeatRef = useRef(isRepeat);
  const handleNextSongRef = useRef(null);

  useEffect(() => {
    isRepeatRef.current = isRepeat;
  }, [isRepeat]);


  useEffect(() => { if (user) { localStorage.setItem('liked_songs', JSON.stringify(likedSongs)); } else { localStorage.removeItem('liked_songs'); } }, [likedSongs, user]);
  useEffect(() => { if (user) { localStorage.setItem('history_songs', JSON.stringify(history)); } else { localStorage.removeItem('history_songs'); } }, [history, user]);
  useEffect(() => { if (user) { localStorage.setItem('playlists', JSON.stringify(playlists)); } else { localStorage.removeItem('playlists'); } }, [playlists, user]);
  useEffect(() => localStorage.setItem('youtube_search_cache', JSON.stringify(searchCache)), [searchCache]);
  useEffect(() => localStorage.setItem('youtube_station_cache', JSON.stringify(stationCache)), [stationCache]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Intentionally NOT calling e.preventDefault() to suppress the Chrome warning
      // while still allowing the native install prompt to potentially trigger.
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("To install the app, look for the 'Install' or 'Add to Home Screen' option in your browser menu (often 3 dots or share icon). If you don't see it, it might already be installed!");
      return;
    }
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User installed the PWA');
      }
    } catch (e) {}
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockString(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);

    socket.on('active_users', (count) => {
      setActiveUsersCount(count);
    });

    return () => {
      clearInterval(clockInterval);
      socket.off('active_users');
    };
  }, []);
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
    }
  }, []);
  const handleOpenVideo = (song, e) => {
    if (e) e.stopPropagation();
    if (!song) return;
    if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
      try { playerRef.current.pauseVideo(); } catch (err) {}
    }
    setIsPlaying(false);
    setIsPipActive(false);
    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function' && currentSong?.id === song.id) {
      try {
        const t = playerRef.current.getCurrentTime();
        setVideoModalSong({ ...song, startAt: t });
        return;
      } catch (err) {}
    }
    setVideoModalSong(song);
  };

  const playSong = useCallback((song) => {
    if (!song) return;
    isInitialMountRef.current = false;
    setVideoModalSong(null);
    setIsPipActive(false);
    if (silentAudioRef.current) {
      silentAudioRef.current.play().catch(() => {});
    }

    if (currentSong?.id === song.id) {
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        playerRef.current.playVideo();
      }
      setIsPlaying(true);
      return;
    }

    try {
      localStorage.setItem('afterhours_current_time', '0');
    } catch (e) {}

    if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
      try { playerRef.current.stopVideo(); } catch (e) {}
    }

    setCurrentSong(song);
    setIsPlaying(true);

    try {
      fetch(getApiUrl('/api/admin/telemetry/event'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'play_start', trackId: song?.id, title: song?.title })
      }).catch(() => {});
    } catch (e) {}

    if (['home', 'barber', 'truck', 'pauwa'].includes(activeTab)) {
      const station = stationsMap[activeTab] || SPECIAL_STATIONS[activeTab];
      if (station && station.bgImages && station.bgImages.length > 0) {
        setCurrentBgIndex(prev => (prev + 1) % station.bgImages.length);
      }
    }
  }, [activeTab, currentSong, stationsMap]);

  const handleNextSong = useCallback(() => {
    if (!queue || queue.length === 0) return;
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * queue.length);
      playSong(queue[randomIndex]);
      return;
    }
    const currentIndex = queue.findIndex(s => s.id === currentSong?.id);
    const nextIdx = (currentIndex + 1) % queue.length;
    playSong(queue[nextIdx]);
  }, [queue, isShuffle, currentSong, playSong]);

  useEffect(() => {
    handleNextSongRef.current = handleNextSong;
  }, [handleNextSong]);

  const handlePrevSong = useCallback(() => {
    if (!queue || queue.length === 0) return;

    let currentPos = currentTimeRef.current;
    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      try {
        const livePos = playerRef.current.getCurrentTime();
        if (typeof livePos === 'number' && !isNaN(livePos)) {
          currentPos = livePos;
        }
      } catch (e) {}
    }

    if (currentPos > 3) {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(0, true);
      }
      currentTimeRef.current = 0;
      if (!isPlaying) {
        playerRef.current?.playVideo?.();
        setIsPlaying(true);
      }
      return;
    }

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * queue.length);
      playSong(queue[randomIndex]);
      return;
    }

    const currentIndex = queue.findIndex(s => s.id === currentSong?.id);
    if (currentIndex === -1) {
      playSong(queue[0]);
      return;
    }

    const prevIdx = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
    playSong(queue[prevIdx]);
  }, [queue, currentSong, isPlaying, isShuffle, playSong]);

  const toggleRepeatMode = () => {
    if (isRepeat === false || isRepeat === 'off') {
      setIsRepeat('all');
    } else if (isRepeat === 'all') {
      setIsRepeat('one');
    } else {
      setIsRepeat(false);
    }
  };

  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.channel || "Loopra",
        album: "Live Music Stream",
        artwork: [
          { src: currentSong.thumbnail, sizes: '96x96', type: 'image/jpeg' },
          { src: currentSong.thumbnail, sizes: '128x128', type: 'image/jpeg' },
          { src: currentSong.thumbnail, sizes: '192x192', type: 'image/jpeg' },
          { src: currentSong.thumbnail, sizes: '512x512', type: 'image/jpeg' },
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (silentAudioRef.current) silentAudioRef.current.play().catch(() => {});
        playerRef.current?.playVideo?.();
        setIsPlaying(true);
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        playerRef.current?.pauseVideo?.();
        if (silentAudioRef.current) silentAudioRef.current.pause();
        setIsPlaying(false);
      });

      navigator.mediaSession.setActionHandler('previoustrack', handlePrevSong);
      navigator.mediaSession.setActionHandler('nexttrack', handleNextSong);

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && playerRef.current?.seekTo) {
          playerRef.current.seekTo(details.seekTime, true);
          currentTimeRef.current = details.seekTime;
        }
      });
    }
  }, [currentSong, handlePrevSong, handleNextSong]);

  // Periodic mediaSession sync is removed to optimize performance
  // Let the browser infer playback position while playing

  const fetchImpulseResponse = async (type) => {
    if (!audioContextRef.current) return null;
    const ctx = audioContextRef.current;
    let duration = 0.5, decay = 2.0;
    if (type === 'hall') { duration = 2.5; decay = 2.0; }
    else if (type === 'theatre') { duration = 1.0; decay = 4.0; }
    else return null;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, sampleRate);
    for (let i = 0; i < 2; i++) {
      const channel = impulse.getChannelData(i);
      for (let j = 0; j < length; j++) {
        channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, decay);
      }
    }
    return impulse;
  };

  const applySoundProfile = async () => {
    if (!audioContextRef.current || !eqNodesRef.current) return;
    const ctx = audioContextRef.current;
    
    // Disconnect old
    if (audioElemRef.current?.sourceNode) {
      try { audioElemRef.current.sourceNode.disconnect(); } catch(e){}
    }
    eqNodesRef.current.forEach(n => { try { n.disconnect(); } catch(e){} });
    if (convolverRef.current) { try { convolverRef.current.disconnect(); } catch(e){} }
    if (gainNodeRef.current) { try { gainNodeRef.current.disconnect(); } catch(e){} }

    const eq = eqNodesRef.current;
    eq.forEach(node => node.gain.value = 0);
    let ir = null;

    if (soundProfile === 'hall') {
      ir = await fetchImpulseResponse('hall');
      eq[0].gain.value = 4; // bass
      eq[4].gain.value = 5; // treble
    } else if (soundProfile === 'theatre') {
      ir = await fetchImpulseResponse('theatre');
      eq[1].gain.value = 3;
      eq[2].gain.value = 3;
    }

    if (!convolverRef.current) convolverRef.current = ctx.createConvolver();
    convolverRef.current.buffer = ir;

    let currentNode = audioElemRef.current?.sourceNode;
    if (currentNode) {
      eq.forEach(node => { currentNode.connect(node); currentNode = node; });
      if (ir) { currentNode.connect(convolverRef.current); currentNode = convolverRef.current; }
      currentNode.connect(gainNodeRef.current);
      gainNodeRef.current.connect(ctx.destination);
    }
  };

  useEffect(() => {
    applySoundProfile();
  }, [soundProfile]);

  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const ytContainerRef = useRef(null);

  useEffect(() => {
    return () => {
      try {
        if (playerRef.current && typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy();
          playerRef.current = null;
        }
      } catch (e) {}
    };
  }, []);

  const initPlayerInstance = useCallback((videoId, shouldAutoPlay = true, startSeconds = 0) => {
    if (!window.YT || !window.YT.Player) return;

    try {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
      }
    } catch (e) {}

    if (ytContainerRef.current) {
      ytContainerRef.current.innerHTML = '<div id="yt-player-instance"></div>';
    }

    playerRef.current = new window.YT.Player('yt-player-instance', {
      height: '100%',
      width: '100%',
      videoId: videoId,
      host: 'https://www.youtube.com',
      playerVars: { 
        autoplay: shouldAutoPlay ? 1 : 0, 
        controls: 0, 
        disablekb: 1, 
        modestbranding: 1,
        enablejsapi: 1,
        playsinline: 1,
        start: startSeconds > 0 ? Math.floor(startSeconds) : 0,
        origin: window.location.origin,
        widget_referrer: window.location.origin
      },
      events: {
        onReady: (e) => {
          try {
            e.target.setVolume(volume);
            if (startSeconds > 0) {
              e.target.seekTo(startSeconds, true);
            }
            if (shouldAutoPlay) {
              e.target.playVideo();
              setIsPlaying(true);
            } else {
              e.target.pauseVideo();
              setIsPlaying(false);
            }
          } catch (err) {}
        },
        onStateChange: (e) => {
          if (e.data === 1) { // Playing
            setIsPlaying(true);
            isInitialMountRef.current = false;
            if (silentAudioRef.current) silentAudioRef.current.play().catch(() => {});
          } else if (e.data === 2) { // Paused
            setIsPlaying(false);
          } else if (e.data === 0) { // Ended
            const currentRepeat = isRepeatRef.current;
            if (currentRepeat === 'one' || currentRepeat === true) {
              playerRef.current?.seekTo?.(0, true);
              playerRef.current?.playVideo?.();
            } else {
              handleNextSongRef.current?.();
            }
          }
        },
        onError: (e) => {
          console.warn("YouTube player playback error code:", e.data);
          
          if (isInitialMountRef.current) {
            setIsPlaying(false);
            return;
          }

          const isRestricted = (e.data === 150 || e.data === 101);
          const currentQ = queueRef.current;
          
          if (!currentQ || currentQ.length === 0) {
            const msg = isRestricted 
              ? "This official video restricts embedding. Please try another song or add a lyric version."
              : "Playback error encountered.";
            showToast(msg, 4000);
            setIsPlaying(false);
          } else {
            const msg = isRestricted
              ? "Playback restricted by video owner. Skipping to next song..."
              : "Playback error encountered. Skipping to next song...";
            showToast(msg, 3500);
            handleNextSongRef.current?.();
          }
        }
      }
    });
  }, [volume, showToast]);

  useEffect(() => {
    if (!currentSong) return;

    if (loadedVideoIdRef.current === currentSong.id) return;

    const isFirstMount = isInitialMountRef.current;
    let savedSeekTime = 0;
    if (isFirstMount) {
      try {
        savedSeekTime = parseFloat(localStorage.getItem('afterhours_current_time') || '0') || 0;
      } catch (e) {}
    }

    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      try {
        if (isFirstMount) {
          if (typeof playerRef.current.cueVideoById === 'function') {
            playerRef.current.cueVideoById({
              videoId: currentSong.id,
              startSeconds: savedSeekTime
            });
          } else {
            playerRef.current.loadVideoById({ videoId: currentSong.id, startSeconds: savedSeekTime });
            playerRef.current.pauseVideo();
          }
          setIsPlaying(false);
        } else {
          playerRef.current.loadVideoById({ videoId: currentSong.id });
          playerRef.current.playVideo();
          setIsPlaying(true);
        }
        loadedVideoIdRef.current = currentSong.id;
      } catch (err) {
        initPlayerInstance(currentSong.id, !isFirstMount, savedSeekTime);
        loadedVideoIdRef.current = currentSong.id;
      }
    } else if (window.YT && window.YT.Player) {
      initPlayerInstance(currentSong.id, !isFirstMount, savedSeekTime);
      loadedVideoIdRef.current = currentSong.id;
    } else {
      window.onYouTubeIframeAPIReady = () => {
        initPlayerInstance(currentSong.id, !isFirstMount, savedSeekTime);
        loadedVideoIdRef.current = currentSong.id;
      };
    }

    setHistory(prev => [currentSong, ...prev.filter(s => s.id !== currentSong.id)].slice(0, 50));
  }, [currentSong, initPlayerInstance]);

  // Player progress interval is extracted to PlayerProgress component

  const loadStationSongs = useCallback(async (stationKey, autoPlayIfEmpty = false) => {
    const station = stationsMap[stationKey] || SPECIAL_STATIONS[stationKey];
    if (!station) return;

    if (stationCache[stationKey]?.tracks?.length > 0) {
      const cachedTracks = stationCache[stationKey].tracks || [];
      setSongs(cachedTracks);
      if (autoPlayIfEmpty && !currentSong && cachedTracks.length > 0) {
        const randomTrack = cachedTracks[Math.floor(Math.random() * cachedTracks.length)];
        playSong(randomTrack);
      }
      return;
    }

    const curatedKey = stationKey === 'barber' ? 'saloon' : (stationKey === 'truck' ? 'horn' : (stationKey === 'pauwa' ? 'theka' : null));
    if (curatedKey && CURATED_STATION_TRACKS && CURATED_STATION_TRACKS[curatedKey]) {
      const curatedList = CURATED_STATION_TRACKS[curatedKey];
      setSongs(curatedList);
      setStationCache(prev => ({
        ...prev,
        [stationKey]: { tracks: curatedList }
      }));
      if (autoPlayIfEmpty && !currentSong && curatedList.length > 0) {
        const randomTrack = curatedList[Math.floor(Math.random() * Math.min(curatedList.length, 50))];
        playSong(randomTrack);
      }
      return;
    }

    setStationLoading(true);

    try {
      const query = station.queries?.[0];
      if (query) {
        const data = await fetchFromBackend(query);

        const fetchedTracks = data.items ? data.items.map(item => ({
          id: item.id.videoId || item.id,
          title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
          channel: item.snippet.channelTitle,
          artist: item.snippet.channelTitle,
          thumbnail: getCleanThumbnail(item, item.id.videoId || item.id),
        })) : [];

        setSongs(fetchedTracks);

        setStationCache(prev => ({ 
          ...prev, 
          [stationKey]: { tracks: fetchedTracks } 
        }));

        if (autoPlayIfEmpty && fetchedTracks.length > 0 && !currentSong) {
          const randomIndex = Math.floor(Math.random() * fetchedTracks.length);
          playSong(fetchedTracks[randomIndex]);
        }
      }
    } catch (err) {
      console.error("Error loading station tracks across keys:", err);
    } finally {
      setStationLoading(false);
    }
  }, [currentSong, playSong, stationCache]);

    const mainScrollRef = useRef(null);
  const scrollPositions = useRef({});

  const handleStationSelect = (stationKey) => {
    setShowQueuePanel(false);
    if (mainScrollRef.current) {
      scrollPositions.current[activeTab] = mainScrollRef.current.scrollTop;
    }
    setNavigationHistory(prev => {
      if (activeTab === stationKey) return prev;
      return [...prev, activeTab];
    });
    setActiveTab(stationKey);
    setCurrentBgIndex(0);
    setIsSidebarOpen(false);

    // Sync browser URL
    if (stationKey === 'discover') {
      const q = searchQuery.trim();
      const url = q ? `/discover?q=${encodeURIComponent(q)}` : '/discover';
      window.history.pushState({ tab: 'discover', q }, '', url);
    } else if (stationKey === 'admin') {
      window.history.pushState({ tab: 'admin' }, '', '/admin');
    } else if (stationKey === 'home') {
      window.history.pushState({ tab: 'home' }, '', '/');
    }

    if (videoModalSong) {
      setIsPipActive(true);
    }
    setTimeout(() => {
      if (mainScrollRef.current && scrollPositions.current[stationKey] !== undefined) {
        mainScrollRef.current.scrollTop = scrollPositions.current[stationKey];
      } else if (mainScrollRef.current) {
        mainScrollRef.current.scrollTop = 0;
      }
    }, 50);
  };

  const handleGoBack = () => {
    setShowQueuePanel(false);
    if (activeTab === "home" && (showAllTrending || showAllArtists || showAllAlbums || showAllRadio)) {
      setShowAllTrending(false);
      setShowAllArtists(false);
      setShowAllAlbums(false);
      setShowAllRadio(false);
      return;
    }

    setNavigationHistory(prev => {
      const newHistory = [...prev];
      const prevTab = newHistory.pop();
      if (prevTab) {
        if (mainScrollRef.current) {
          scrollPositions.current[activeTab] = mainScrollRef.current.scrollTop;
        }
        setActiveTab(prevTab);
        setCurrentBgIndex(0);

        if (prevTab === 'home') {
          window.history.pushState({ tab: 'home' }, '', '/');
        } else if (prevTab === 'discover') {
          const q = searchQuery.trim();
          const url = q ? `/discover?q=${encodeURIComponent(q)}` : '/discover';
          window.history.pushState({ tab: 'discover', q }, '', url);
        } else if (prevTab === 'admin') {
          window.history.pushState({ tab: 'admin' }, '', '/admin');
        }

        setTimeout(() => {
          if (mainScrollRef.current && scrollPositions.current[prevTab] !== undefined) {
            mainScrollRef.current.scrollTop = scrollPositions.current[prevTab];
          }
        }, 50);
      }
      return newHistory;
    });
  };

  useEffect(() => {
    if (['home', 'barber', 'truck', 'pauwa'].includes(activeTab)) {
      loadStationSongs(activeTab, false);
    }
  }, [activeTab, loadStationSongs]);

  const togglePlayPause = () => {
    if (!currentSong) {
      if (queue.length > 0) playSong(queue[0]);
      return;
    }
    isInitialMountRef.current = false;
    if (videoModalSong) {
      setVideoModalSong(null);
      setIsPipActive(false);
    }
    if (isPlaying) {
      playerRef.current?.pauseVideo?.();
      if (silentAudioRef.current) silentAudioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!playerRef.current || typeof playerRef.current.playVideo !== 'function') {
        let savedSeek = 0;
        try {
          savedSeek = parseFloat(localStorage.getItem('afterhours_current_time') || '0') || 0;
        } catch (e) {}
        initPlayerInstance(currentSong.id, true, savedSeek);
      } else {
        try {
          const savedSeek = parseFloat(localStorage.getItem('afterhours_current_time') || '0') || 0;
          const curTime = playerRef.current.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
          if (savedSeek > 0 && curTime < 1) {
            playerRef.current.seekTo(savedSeek, true);
          }
        } catch (e) {}
        playerRef.current?.playVideo?.();
      }
      if (silentAudioRef.current) silentAudioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = useCallback((seekTime) => {
    currentTimeRef.current = seekTime;
    try {
      localStorage.setItem('afterhours_current_time', seekTime.toString());
    } catch (e) {}
    playerRef.current?.seekTo?.(seekTime, true);
  }, []);

  const handleVolumeChange = (e) => {
    const newVol = parseInt(e.target.value, 10);
    setVolume(newVol);
    try {
      playerRef.current?.setVolume?.(newVol);
    } catch (e) {}
  };

  const addToQueue = (song, e) => {
    if (e) e.stopPropagation();
    setQueue(prev => {
      if (prev.some(s => s.id === song.id)) {
        showToast('Track already in queue');
        return prev;
      }
      showToast('Added to queue');
      return [...prev, song];
    });
  };

  const removeFromQueue = (trackId) => {
    setQueue(prev => prev.filter(s => s.id !== trackId));
    showToast('Removed from queue');
  };

  const toggleLike = (song) => {
    if (!user) { openAuthModal(); return; }
    setLikedSongs(prev => {
      const isAlreadyLiked = prev.some(s => s.id === song.id);
      showToast(isAlreadyLiked ? 'Removed from favourites' : 'Added to favourites');
      return isAlreadyLiked ? prev.filter(s => s.id !== song.id) : [song, ...prev];
    });
  };

  const handleAddToPlaylistClick = (song, e) => {
    e?.stopPropagation();
    setSelectedSongForPlaylist(song);
    setIsPlaylistModalOpen(true);
  };

  const handleCreatePlaylist = (e) => {
    e?.preventDefault();
    if (!newPlaylistName.trim()) return;
    const newPlaylist = {
      id: Date.now().toString(),
      name: newPlaylistName.trim(),
      songs: selectedSongForPlaylist ? [selectedSongForPlaylist] : []
    };
    setPlaylists([...playlists, newPlaylist]);
    showToast(`Created playlist "${newPlaylistName.trim()}"`);
    setNewPlaylistName('');
    if (selectedSongForPlaylist) {
      setIsPlaylistModalOpen(false);
      setSelectedSongForPlaylist(null);
    }
  };

  const handleAddSongToExistingPlaylist = (playlistId) => {
    if (!selectedSongForPlaylist) return;
    setPlaylists(prev => prev.map(pl => {
      if (pl.id === playlistId) {
        if (!pl.songs.some(s => s.id === selectedSongForPlaylist.id)) {
          showToast(`Added to "${pl.name}"`);
          return { ...pl, songs: [...pl.songs, selectedSongForPlaylist] };
        }
        showToast('Track already in playlist');
      }
      return pl;
    }));
    setIsPlaylistModalOpen(false);
    setSelectedSongForPlaylist(null);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('history_songs');
  };

  const fetchYouTubeMusic = async (q) => {
    const trimmedQuery = q.trim().toLowerCase();
    if (!trimmedQuery) return;

    setHasSearched(true);
    setSearchError('');

    if (searchCache[trimmedQuery]) {
      const cachedSongs = searchCache[trimmedQuery];
      setSearchResults(cachedSongs);
      setSearchVisibleCount(10);
      return;
    }

    if (isLoading) return;
    setIsLoading(true);
    try {
      const data = await fetchFromBackend(trimmedQuery + " official video original");

      if (data && data.items && data.items.length > 0) {
        const fetchedTracks = data.items.map(item => ({
          id: item.id?.videoId || item.id,
          title: item.snippet?.title ? item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&") : 'Untitled',
          channel: item.snippet?.channelTitle || 'Unknown Artist',
          thumbnail: getCleanThumbnail(item, item.id?.videoId || item.id),
        }));

        setSearchResults(fetchedTracks);
        setSearchVisibleCount(10);
        setSearchCache(prev => ({ ...prev, [trimmedQuery]: fetchedTracks }));
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.warn("[Search Error]:", err.message);
      setSearchError(err.message || 'Unable to connect to search service. Please try again.');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    window.history.pushState({ tab: 'discover', q: trimmed }, '', `/discover?q=${encodeURIComponent(trimmed)}`);
    fetchYouTubeMusic(trimmed);
  };

  const handleSearchFromHome = (queryText) => {
    const trimmed = (queryText || '').trim();
    if (!trimmed) return;
    setSearchQuery(trimmed);
    setActiveTab('discover');
    window.history.pushState({ tab: 'discover', q: trimmed }, '', `/discover?q=${encodeURIComponent(trimmed)}`);
    fetchYouTubeMusic(trimmed);
  };

  const initialSearchExecutedRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const q = (params.get('q') || '').trim();
    if (!initialSearchExecutedRef.current && q) {
      initialSearchExecutedRef.current = true;
      fetchYouTubeMusic(q);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === 'undefined') return;
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const q = (params.get('q') || '').trim();

      if (path === '/admin') {
        setActiveTab('admin');
      } else if (path === '/discover' || q) {
        setActiveTab('discover');
        if (q) {
          setSearchQuery(q);
          fetchYouTubeMusic(q);
        } else {
          setSearchQuery('');
        }
      } else if (path === '/' || path === '') {
        setActiveTab('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const currentStation = stationsMap[activeTab] || SPECIAL_STATIONS[activeTab];
  const currentBgImage = currentStation?.bgImages?.[currentBgIndex] || currentStation?.bgImages?.[0];

  return (
    <div className="h-[100dvh] bg-neutral-950 text-neutral-100 font-sans flex flex-col md:flex-row antialiased selection:bg-amber-500 selection:text-white relative overflow-hidden">
      {/* CMS Maintenance Overlay with Admin Bypass */}
      <CmsMaintenanceOverlay
        maintenance={cmsConfig?.maintenance}
        branding={cmsConfig?.branding}
        isAdmin={user?.role === 'admin'}
        onOpenAdmin={() => {
          setActiveTab('admin');
          window.history.pushState(null, '', '/admin');
        }}
        onOpenAuth={openAuthModal}
      />

      <StudioLoungeAtmosphere isPlaying={isPlaying} theme={cmsConfig?.theme} />
      
      <link rel="preconnect" href="https://i.ytimg.com" />
      <link rel="preconnect" href="https://www.youtube.com" />

      <audio 
        ref={silentAudioRef} 
        loop 
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==" 
      />
      
      <div ref={ytContainerRef} className="fixed top-0 left-0 w-1 h-1 opacity-0 pointer-events-none -z-50 overflow-hidden">
        <div id="yt-player-instance"></div>
      </div>

      {videoModalSong && (
        <div 
          className={
            isPipActive
              ? "fixed bottom-24 right-4 z-[9999] w-72 sm:w-80 bg-neutral-900 border border-neutral-700 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 animate-fadeIn"
              : "fixed top-14 md:top-16 inset-x-0 bottom-0 z-[9999] bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          }
        >
          <div className={`w-full bg-neutral-900 ${isPipActive ? '' : 'max-w-4xl border border-neutral-800 rounded-3xl'} overflow-hidden shadow-2xl relative flex flex-col`}>
            <div className="p-3 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between gap-2 overflow-visible">
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                <Icon name="video" className="w-4 h-4 text-amber-400 shrink-0" />
                <h3 className="font-bold text-xs text-white truncate">{videoModalSong.title}</h3>
              </div>
              
              <div className="flex items-center gap-1.5 shrink-0 z-10">
                <button
                  onClick={() => setIsPipActive(!isPipActive)}
                  className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition shrink-0 inline-flex items-center justify-center"
                  title={isPipActive ? "Expand Fullscreen" : "Minimize to PiP"}
                >
                  <Icon name={isPipActive ? "expand" : "collapse"} className="w-4 h-4 shrink-0" />
                </button>
                <button
                  onClick={() => { setVideoModalSong(null); setIsPipActive(false); if(playerRef.current?.playVideo) playerRef.current.playVideo(); }}
                  className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition shrink-0 inline-flex items-center justify-center"
                  title="Close Video (Audio continues in background)"
                >
                  <Icon name="close" className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>
            
            <div className="relative w-full aspect-video bg-neutral-950">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${videoModalSong.id}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&widget_referrer=${encodeURIComponent(window.location.origin)}${videoModalSong.startAt ? '&start='+Math.floor(videoModalSong.startAt) : ''}`}
                title={videoModalSong.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>

            {!isPipActive && (
              <div className="p-4 bg-neutral-900 flex items-center justify-between gap-4">
                <span className="text-xs text-neutral-400 truncate flex-1 min-w-0">{videoModalSong.channel}</span>
                <button
                  onClick={() => {
                    playSong(videoModalSong);
                    setVideoModalSong(null);
                    setIsPipActive(false);
                  }}
                  className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 hover:shadow-amber-500/20 text-white font-medium tracking-wide text-xs flex items-center gap-1.5 transition shrink-0 shadow-md cursor-pointer"
                >
                  <Icon name="play" className="w-4 h-4 shrink-0" />
                  <span>Listen Background Audio</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-neutral-900/80 backdrop-blur-xl backdrop-blur-sm z-[52] transition-opacity"
        />
      )}

      <aside 
        className={`fixed md:relative h-screen inset-y-0 left-0 z-[55] bg-neutral-900/95 backdrop-blur-xl border-r border-neutral-800/80 p-4 flex flex-col shrink-0 transform transition-all duration-300 ease-in-out overflow-y-auto overflow-x-hidden ${
          isSidebarOpen ? 'translate-x-0 w-72' : `-translate-x-full md:translate-x-0 ${isSidebarCollapsed ? 'w-20' : 'w-72'}`
        }`}
      >
        <div className="flex-1">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} px-2 py-3 mb-6`}>
            <div className={`flex items-center ${isSidebarCollapsed ? 'flex-col gap-4' : 'gap-3'}`}>
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                className="hidden md:flex p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 active:scale-[0.98] transition shrink-0"
              >
                <Icon name="menu" className="w-5 h-5" />
              </button>
              
              {!isSidebarCollapsed && (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 p-1 flex items-center justify-center shadow-xl border border-amber-500/35 shrink-0 overflow-hidden">
                    <img src={cmsConfig?.branding?.logoUrl || "/favicon.svg"} alt={cmsConfig?.branding?.siteName || "Loopra"} className="w-full h-full object-contain" />
                  </div>
                  <h1 className="text-lg font-display font-extrabold tracking-tight tracking-wider text-white whitespace-nowrap">{cmsConfig?.branding?.siteName || 'LOOPRA'}</h1>
                </>
              )}
            </div>

            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => handleStationSelect('home')}
              title="Home"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'} rounded-2xl font-medium text-xs transition ${
                activeTab === 'home' ? 'bg-amber-600/20 text-white border border-amber-500/30' : 'text-neutral-400 hover:bg-neutral-800 active:scale-[0.98]/50'
              }`}
            >
              <Icon name="home" className="w-5 h-5 shrink-0 text-amber-400" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Home</span>}
            </button>

            <button
              onClick={() => handleStationSelect('discover')}
              title="Discover & Search"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'} rounded-2xl font-medium text-xs transition ${
                activeTab === 'discover' ? 'bg-amber-600/20 text-white border border-amber-500/30' : 'text-neutral-400 hover:bg-neutral-800 active:scale-[0.98]/50'
              }`}
            >
              <Icon name="discover" className="w-5 h-5 shrink-0 text-amber-400" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Discover & Search</span>}
            </button>

            {!isSidebarCollapsed ? (
              <div className="pt-4 pb-1 px-3">
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap">Nostalgia Stations</p>
              </div>
            ) : <div className="h-4 border-b border-neutral-800/50 mb-4" />}

            <button
              onClick={() => handleStationSelect('barber')}
              title={stationsMap?.barber?.title || "Saloon FM"}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'} rounded-2xl font-medium text-xs transition ${
                activeTab === 'barber' ? 'bg-red-600/25 text-red-200 border border-red-500/50 shadow-lg shadow-red-950/50' : 'text-neutral-400 hover:bg-neutral-800 active:scale-[0.98]/50'
              }`}
            >
              <Icon name="scissors" className="w-5 h-5 shrink-0 text-red-400" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">{stationsMap?.barber?.title || "Saloon FM"}</span>}
            </button>

            <button
              onClick={() => handleStationSelect('truck')}
              title={stationsMap?.truck?.title || "Horn Ok Please"}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'} rounded-2xl font-medium text-xs transition ${
                activeTab === 'truck' ? 'bg-amber-600/25 text-amber-200 border border-amber-500/50 shadow-lg shadow-amber-950/50' : 'text-neutral-400 hover:bg-neutral-800 active:scale-[0.98]/50'
              }`}
            >
              <Icon name="truck" className="w-5 h-5 shrink-0 text-amber-400" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">{stationsMap?.truck?.title || "Horn Ok Please"}</span>}
            </button>

            <button
              onClick={() => handleStationSelect('pauwa')}
              title={stationsMap?.pauwa?.title || "Theka Session"}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'} rounded-2xl font-medium text-xs transition ${
                activeTab === 'pauwa' ? 'bg-amber-600/25 text-emerald-200 border border-orange-500/50 shadow-lg shadow-amber-950/50' : 'text-neutral-400 hover:bg-neutral-800 active:scale-[0.98]/50'
              }`}
            >
              <Icon name="beer" className="w-5 h-5 shrink-0 text-orange-400" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">{stationsMap?.pauwa?.title || "Theka Session"}</span>}
            </button>

            {!isSidebarCollapsed ? (
              <div className="pt-4 pb-1 px-3">
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap">Your Collection</p>
              </div>
            ) : <div className="h-4 border-b border-neutral-800/50 mb-4" />}

            <button
              onClick={() => handleStationSelect('library')}
              title="Liked Songs"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'} rounded-2xl font-medium text-xs transition ${
                activeTab === 'library' ? 'bg-amber-600/20 text-white border border-amber-500/30' : 'text-neutral-400 hover:bg-neutral-800 active:scale-[0.98]/50'
              }`}
            >
              <Icon name="library" className="w-5 h-5 shrink-0 text-neutral-400" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Liked Songs</span>}
            </button>

            <button
              onClick={() => handleStationSelect('history')}
              title="History"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'} rounded-2xl font-medium text-xs transition ${
                activeTab === 'history' ? 'bg-amber-600/20 text-white border border-amber-500/30' : 'text-neutral-400 hover:bg-neutral-800 active:scale-[0.98]/50'
              }`}
            >
              <Icon name="history" className="w-5 h-5 shrink-0 text-pink-400" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">History</span>}
            </button>
            <button
              onClick={() => { handleStationSelect('playlists'); setSelectedPlaylistForView(null); }}
              title="Playlists"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'} rounded-2xl font-medium text-xs transition ${
                activeTab === 'playlists' ? 'bg-amber-600/20 text-white border border-amber-500/30' : 'text-neutral-400 hover:bg-neutral-800 active:scale-[0.98]/50'
              }`}
            >
              <Icon name="list" className="w-5 h-5 shrink-0 text-amber-400" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Playlists</span>}
            </button>

            {isAdmin && (
              <button
                onClick={() => {
                  handleStationSelect('admin');
                  window.history.pushState(null, '', '/admin');
                }}
                title="Admin Dashboard"
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'} rounded-2xl font-semibold text-xs transition ${
                  activeTab === 'admin' ? 'bg-amber-500 text-neutral-950 font-bold shadow-lg shadow-amber-500/30' : 'text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20'
                }`}
              >
                <Icon name="shield" className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span className="whitespace-nowrap">Admin Dashboard</span>}
              </button>
            )}
            
            {/* Mobile Auth Button in Sidebar */}
            <div className="md:hidden pt-4 pb-1 border-t border-neutral-800 mt-4">
              {user ? (
                <button
                  onClick={() => { logout(); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'} rounded-2xl font-medium text-xs transition text-neutral-400 hover:text-white hover:bg-neutral-800`}
                >
                  <Icon name="user" className="w-5 h-5 shrink-0" />
                  {!isSidebarCollapsed && <span>Logout</span>}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (isPlaying) {
                      togglePlayPause();
                    }
                    openAuthModal();
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'} rounded-2xl font-medium text-xs transition bg-amber-500/10 text-amber-400 hover:bg-amber-500/20`}
                >
                  <Icon name="user" className="w-5 h-5 shrink-0" />
                  {!isSidebarCollapsed && <span>Login / Sign Up</span>}
                </button>
              )}
            </div>
            
          </nav>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 relative overflow-hidden">
        {/* Unified Top Navbar for both Mobile and Desktop */}
        <header className="relative z-40 bg-neutral-900/95 backdrop-blur-xl border-b border-neutral-800/80 px-2.5 sm:px-4 md:px-8 py-2.5 sm:py-3 h-14 md:h-16 flex items-center justify-between shrink-0 w-full box-border">
          {/* LEFT: Mobile Menu & Logo | Desktop Clock */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden p-1.5 sm:p-2 rounded-2xl bg-neutral-800 text-neutral-200 hover:text-white focus:outline-none shrink-0"
              aria-label="Toggle Menu"
            >
              <Icon name={isSidebarOpen ? "close" : "menu"} className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </button>
            <div className="flex md:hidden items-center gap-1.5 sm:gap-2">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 p-0.5 flex items-center justify-center shadow-md overflow-hidden">
                <img src="/favicon.svg" alt="Loopra" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-sm sm:text-base font-display font-extrabold tracking-tight text-white">LOOPRA</h1>
            </div>

            {/* Desktop Clock */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 text-xs font-mono text-amber-300 shadow-md">
              <span>⏳</span>
              <span>{clockString || "00:00:00"}</span>
            </div>
          </div>

          {/* CENTER (Desktop only): ACTIVE USERS */}
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 shadow-lg shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
            </span>
            <span className="text-xs font-semibold text-neutral-200 tracking-wide">
              <span className="text-orange-400 font-bold">{activeUsersCount}</span> Active Users
            </span>
          </div>

          {/* RIGHT: INSTALL APP & AUTH/LOGOUT (+ MOBILE CLOCK) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-white font-medium tracking-wide text-xs shadow-lg transition shrink-0"
            >
              <Icon name="download" className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="hidden sm:inline">Install App</span>
            </button>
            
            {user ? (
              <>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setActiveTab('admin');
                      window.history.pushState(null, '', '/admin');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold tracking-wide text-xs border border-amber-500/40 shadow-lg transition shrink-0"
                    title="Admin Dashboard"
                  >
                    <Icon name="shield" className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="hidden sm:inline">Admin</span>
                  </button>
                )}
                <button
                  onClick={logout}
                  className="flex items-center gap-2 pr-2.5 pl-1 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white font-medium tracking-wide text-xs shadow-lg transition shrink-0 border border-neutral-700"
                  title="Logout"
                >
                <div className="w-6 h-6 rounded-full bg-neutral-950 text-white flex items-center justify-center font-extrabold uppercase text-xs border border-neutral-700">
                  {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
              <button
                onClick={() => {
                  if (isPlaying) {
                    togglePlayPause();
                  }
                  openAuthModal();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-white font-medium tracking-wide text-xs shadow-lg transition shrink-0"
              >
                <Icon name="user" className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Login</span>
              </button>
            )}

            {/* Mobile Clock */}
            <div className="md:hidden px-2 py-1 rounded-xl bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 font-mono text-[10px] sm:text-[11px] text-amber-300">
              {clockString || "00:00"}
            </div>
          </div>
        </header>

        {/* Site-wide CMS Announcement Bar */}
        <CmsAnnouncementBar announcement={cmsConfig?.announcement} />

        <main className={`flex-1 h-full min-h-0 overflow-y-auto px-2.5 py-3 sm:px-4 sm:py-4 md:p-8 bg-neutral-950 box-border relative w-full transition-all duration-300 ${currentSong ? 'pb-24 md:pb-28' : 'pb-8'}`}>
          {currentStation && currentBgImage && (
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden transition-all duration-700">
              <img 
                key={currentBgImage}
                src={currentBgImage} 
                alt="Station Background" 
                loading="lazy"
                className="w-full h-full object-cover filter brightness-[0.75] contrast-100 scale-105 transition-opacity duration-1000 animate-fadeIn"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/85" />
            </div>
          )}

          {showMobileTip && (
            <div className="md:hidden relative z-30 mb-3 sm:mb-4 p-2.5 sm:p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-md flex items-start justify-between gap-2 text-xs text-amber-200 w-full min-w-0">
              <div className="flex items-start gap-2">
                <Icon name="info" className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Mobile Tip:</strong> If audio pauses when switching apps or locking your phone, pull down your notification panel and tap <strong>Play</strong>!
                </p>
              </div>
              <button onClick={() => setShowMobileTip(false)} className="text-amber-400 font-bold text-sm px-1 shrink-0">✕</button>
            </div>
          )}

        {((navigationHistory.length > 0 && activeTab !== 'home') || (activeTab === 'home' && (showAllTrending || showAllArtists || showAllAlbums || showAllRadio))) && (
          <div className="relative z-20 mb-6 flex justify-start">
            <button
              onClick={handleGoBack}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900/80 hover:bg-neutral-800 backdrop-blur-xl border border-neutral-700/50 rounded-2xl text-neutral-300 hover:text-white transition shadow-lg group"
            >
              <Icon name="arrowLeft" className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium tracking-wide">Back</span>
            </button>
          </div>
        )}

        {activeTab === 'discover' && (
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            <div className="p-3.5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-amber-500/25 bg-neutral-900/80 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_25px_rgba(var(--accent-rgb,245,158,11),0.08)] w-full min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_var(--accent-color,#f59e0b)] animate-pulse" />
                <h2 className="text-2xl font-display font-extrabold tracking-tight text-white">Discover & Search Tracks</h2>
              </div>
              <p className="text-xs text-neutral-400 mb-6">Type a song, artist, or album to stream music in 3D audio space.</p>
              
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-400/80">
                    <Icon name="search" className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search song, artist, or album..."
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-neutral-950/60 backdrop-blur-xl border border-neutral-700/80 focus:border-amber-500 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition shadow-inner"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 rounded-2xl amber-glow-btn text-neutral-950 font-bold text-xs transition shadow-lg shadow-orange-950/50 flex items-center gap-2 shrink-0 cursor-pointer border border-amber-300/40"
                >
                  {isLoading ? <Icon name="sparkles" className="w-4 h-4 animate-spin shrink-0 text-neutral-950" /> : <Icon name="search" className="w-4 h-4 shrink-0 text-neutral-950" />}
                  <span>Search</span>
                </button>
              </form>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-lg font-display font-extrabold tracking-tight text-white flex items-center gap-2">
                    <span className="text-amber-500">⚡</span>
                    Search Results
                  </h3>
                  <span className="text-xs text-neutral-400 font-mono">Showing {Math.min(searchVisibleCount, searchResults.length)} of {searchResults.length} songs</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {searchResults.slice(0, searchVisibleCount).map((track, i) => {
                    const isCurrent = currentSong?.id === track.id;
                    const isMenuOpen = openMenuId === `${track.id}-${i}`;
                    return (
                      <div
                        key={track.id + i}
                        onClick={() => playSong(track)}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all duration-200 backdrop-blur-xl relative hover:-translate-y-0.5 ${
                          isMenuOpen ? 'z-30' : 'z-auto'
                        } ${
                          isCurrent
                            ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-neutral-900/70 border-amber-500/80 shadow-[0_0_25px_rgba(var(--accent-rgb,245,158,11),0.25)]'
                            : 'bg-neutral-900/40 border-neutral-800/80 hover:bg-neutral-850 hover:border-amber-500/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)]'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="text-xs font-mono text-neutral-400 w-6 text-center">{i + 1}</span>
                          <img src={getCleanThumbnail(track)} alt={track.title || ""} loading="lazy" className="w-12 h-12 rounded-2xl object-cover shrink-0 shadow-md" onError={(e) => handleImageError(e, track.title, track.id)} />
                          <div className="min-w-0">
                            <h4 className={`font-bold text-xs truncate ${isCurrent ? 'text-amber-400' : 'text-white'}`}>
                              {track.title}
                            </h4>
                            <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                          </div>
                        </div>

                        <div className={`flex items-center gap-2 shrink-0 relative ${isMenuOpen ? 'z-40' : ''}`}>
                          <button onClick={(e) => handleOpenVideo(track, e)} className="p-1.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition flex items-center shrink-0" title="See Video">
                            <Icon name="video" className="w-3.5 h-3.5 shrink-0" />
                          </button>
                          
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setOpenMenuId(isMenuOpen ? null : `${track.id}-${i}`); 
                            }} 
                            className="p-1 text-neutral-500 hover:text-white transition shrink-0"
                          >
                            <Icon name="moreVertical" className="w-5 h-5 shrink-0" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-44 bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-neutral-700/80 overflow-hidden z-50 animate-fadeIn">
                              {currentSong?.id !== track.id && (
                                <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{likedSongs.some(s => s.id === track.id) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
                              <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {searchVisibleCount < searchResults.length && (
                  <div className="text-center pt-6 pb-4">
                    <button
                      onClick={() => setSearchVisibleCount(prev => prev + 10)}
                      className="px-6 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-amber-400 border border-neutral-700 transition shadow-xl"
                    >
                      Show More Songs
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Loading Skeletons */}
            {isLoading && (
              <div className="space-y-3 pt-2 animate-pulse">
                <div className="h-4 bg-neutral-800 rounded w-1/4"></div>
                <div className="grid grid-cols-1 gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <div key={n} className="p-3.5 rounded-2xl border border-neutral-800/60 bg-neutral-900/40 flex items-center justify-between">
                      <div className="flex items-center gap-3.5 flex-1">
                        <div className="w-12 h-12 rounded-2xl bg-neutral-800 shrink-0"></div>
                        <div className="space-y-2 flex-1">
                          <div className="h-3.5 bg-neutral-800 rounded w-3/5"></div>
                          <div className="h-2.5 bg-neutral-800/60 rounded w-2/5"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error State */}
            {!isLoading && searchError && (
              <div className="p-8 rounded-3xl border border-rose-500/30 bg-rose-950/20 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
                  <Icon name="sparkles" className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Search Encountered an Issue</h3>
                <p className="text-xs text-rose-300/80 max-w-md mx-auto">{searchError}</p>
                <button
                  type="button"
                  onClick={() => fetchYouTubeMusic(searchQuery)}
                  className="px-5 py-2.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition inline-flex items-center gap-2 border border-neutral-700"
                >
                  <Icon name="sparkles" className="w-3.5 h-3.5" />
                  <span>Retry Search</span>
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !searchError && hasSearched && searchResults.length === 0 && (
              <div className="p-10 rounded-3xl border border-neutral-800/80 bg-neutral-900/40 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400">
                  <Icon name="search" className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">No Tracks Found</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  We couldn't find any tracks matching "{searchQuery}". Try different keywords, artist names, or movie titles.
                </p>
              </div>
            )}

            <DisclaimerFooter footer={cmsConfig?.footer} />
          </div>
        )}


        {activeTab === 'home' && (
          <div className="max-w-7xl mx-auto px-0 md:px-4 pt-1 md:pt-6 space-y-6 md:space-y-10 w-full min-w-0">
            {/* Promotional Hero Banner if configured in CMS */}
            <CmsHeroBanner 
              banner={cmsConfig?.banner} 
              onActionClick={(url) => {
                if (url?.startsWith('/station/')) {
                  handleStationSelect(url.replace('/station/', ''));
                } else if (url === '/discover') {
                  handleStationSelect('discover');
                } else if (url?.startsWith('http')) {
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              }}
            />

            {/* Prominent 3D Home Search Bar */}
            <HomeSearchBar 
              onSearch={handleSearchFromHome}
              initialQuery={searchQuery}
              placeholder={cmsConfig?.searchPage?.placeholder || "Search songs, artists, albums..."}
              suggestions={cmsConfig?.searchPage?.quickTags}
            />

            {/* Mobile Compact Horizontal Player (< md) */}
            <div 
              onClick={() => handleOpenExpandedPlayer('player')}
              className="md:hidden relative rounded-2xl p-2.5 sm:p-3 bg-gradient-to-r from-neutral-900/95 via-neutral-900/85 to-neutral-950/95 border border-amber-500/25 shadow-[0_10px_25px_rgba(0,0,0,0.6),0_0_15px_rgba(var(--accent-rgb,245,158,11),0.06)] backdrop-blur-xl mb-3 sm:mb-4 cursor-pointer active:scale-[0.99] transition-transform select-none w-full min-w-0"
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left: Album Thumbnail with 3D Vinyl Aesthetic */}
                <div className="relative shrink-0 flex items-center">
                  <div className={`w-12 h-12 rounded-full absolute -right-2 top-0 bg-neutral-950 border border-amber-500/40 shadow-inner flex items-center justify-center transition-transform ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
                    <div className="w-4 h-4 rounded-full bg-amber-500/30 border border-amber-400/50 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
                    </div>
                  </div>
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md border border-amber-500/40 z-10 bg-neutral-900">
                    <img 
                      src={getCleanThumbnail(currentSong || (trendingSongs?.[0] || TRENDING_SONGS[0]))} 
                      alt={(currentSong || (trendingSongs?.[0] || TRENDING_SONGS[0]))?.title || ""} 
                      className="w-full h-full object-cover"
                      onError={(e) => handleImageError(e, (currentSong || (trendingSongs?.[0] || TRENDING_SONGS[0]))?.title, (currentSong || (trendingSongs?.[0] || TRENDING_SONGS[0]))?.id)}
                    />
                  </div>
                </div>

                {/* Center: Song info & vinyl tag */}
                <div className="min-w-0 flex-1 ml-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-400 truncate">
                      {isPlaying ? 'Now Spinning' : 'Loopra 3D Vinyl'}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-white truncate leading-tight">
                    {(currentSong || (trendingSongs?.[0] || TRENDING_SONGS[0]))?.title}
                  </h3>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    {(currentSong || (trendingSongs?.[0] || TRENDING_SONGS[0]))?.channel}
                  </p>
                </div>

                {/* Right: Compact playback controls */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentSong) {
                        togglePlayPause();
                      } else {
                        handlePlayTrending((trendingSongs?.[0] || TRENDING_SONGS[0]).title, (trendingSongs?.[0] || TRENDING_SONGS[0]), trendingSongs);
                      }
                    }}
                    className="w-10 h-10 rounded-full amber-glow-btn text-neutral-950 flex items-center justify-center font-bold shadow-md cursor-pointer border border-amber-300/40 active:scale-95 transition"
                    title={isPlaying ? "Pause" : "Play"}
                    aria-label={isPlaying ? "Pause playback" : "Start playback"}
                  >
                    <Icon name={isPlaying ? "pause" : "play"} className="w-4 h-4 fill-current translate-x-0.5" />
                  </button>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentSong) {
                        handleNextSong();
                      } else {
                        handlePlayTrending((trendingSongs?.[0] || TRENDING_SONGS[0]).title, (trendingSongs?.[0] || TRENDING_SONGS[0]), trendingSongs);
                      }
                    }}
                    className="p-2 text-neutral-400 hover:text-white transition active:scale-90"
                    title="Next Track"
                    aria-label="Next Track"
                  >
                    <Icon name="skipNext" className="w-4 h-4" />
                  </button>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenExpandedPlayer('queue');
                    }}
                    className="p-2 text-neutral-400 hover:text-amber-400 transition active:scale-90"
                    title="View Queue"
                    aria-label="View Queue"
                  >
                    <Icon name="list" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Featured 3D Turntable Lounge Showcase for Desktop (>= md) */}
            <div className="hidden md:block relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-neutral-900/90 via-neutral-900/70 to-neutral-950/90 border border-amber-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(var(--accent-rgb,245,158,11),0.1)] backdrop-blur-2xl overflow-hidden mb-6">
              <div className="absolute top-0 right-1/4 w-72 h-72 rounded-full bg-amber-500/10 blur-[80px] pointer-events-none" />
              <div className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-orange-500/10 blur-[80px] pointer-events-none" />

              <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
                {/* 3D Turntable Platter */}
                <div className="flex-1 flex flex-col items-center justify-center">
                  <Turntable3D 
                    currentSong={currentSong || (trendingSongs?.[0] || TRENDING_SONGS[0])}
                    isPlaying={isPlaying}
                    onTogglePlay={currentSong ? togglePlayPause : () => handlePlayTrending((trendingSongs?.[0] || TRENDING_SONGS[0]).title, (trendingSongs?.[0] || TRENDING_SONGS[0]), trendingSongs)}
                    size="compact"
                  />
                  <AudioSpectrumVisualizer 
                    isPlaying={isPlaying} 
                    barCount={32}
                    height={36}
                    className="w-full max-w-xs mt-3"
                  />
                </div>

                {/* Lounge Info & Tactile Controls */}
                <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left space-y-4 max-w-lg">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    {isPlaying ? 'NOW SPINNING ON VINYL' : 'LOOPRA 3D VINYL LOUNGE'}
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight line-clamp-1">
                      {currentSong ? currentSong.title : 'High-Fidelity Retro & Modern Lounge'}
                    </h2>
                    <p className="text-xs sm:text-sm text-amber-400 font-medium mt-1">
                      {currentSong ? currentSong.channel : 'Drop the needle on curated trending hits, nostalgia stations, or search any track.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 pt-2">
                    {currentSong ? (
                      <>
                        <button 
                          onClick={togglePlayPause}
                          className="px-6 py-3 rounded-2xl amber-glow-btn text-neutral-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-orange-950/50 cursor-pointer"
                        >
                          <Icon name={isPlaying ? "pause" : "play"} className="w-5 h-5 fill-current" />
                          <span>{isPlaying ? 'Pause' : 'Resume'}</span>
                        </button>
                        <button 
                          onClick={() => handleOpenExpandedPlayer('queue')}
                          className="px-5 py-3 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700/80 text-white font-medium text-xs sm:text-sm border border-neutral-700/70 transition flex items-center gap-2 shadow-md cursor-pointer"
                        >
                          <Icon name="list" className="w-4 h-4 text-amber-400" />
                          <span>View Full Queue ({queue.length})</span>
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => handlePlayTrending((trendingSongs?.[0] || TRENDING_SONGS[0]).title, (trendingSongs?.[0] || TRENDING_SONGS[0]), trendingSongs)}
                        className="px-6 py-3 rounded-2xl amber-glow-btn text-neutral-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-orange-950/50 cursor-pointer"
                      >
                        <Icon name="play" className="w-5 h-5 fill-current" />
                        <span>Spin Trending Hits</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Homepage Sections from CMS Configuration */}
            {(() => {
              const sections = (cmsConfig?.sections && cmsConfig.sections.length > 0)
                ? cmsConfig.sections
                : [
                    { id: 'trending', title: 'Trending songs', subtitle: 'The most played hits right now', enabled: true, order: 1 },
                    { id: 'curated', title: 'Curated Featured Collections', subtitle: 'Handpicked mixes, nostalgia sets, and soundtracks curated by our editors', enabled: true, order: 2 },
                    { id: 'artists', title: 'Popular artists', subtitle: 'Find your favorite singers', enabled: true, order: 3 },
                    { id: 'albums', title: 'Popular albums and singles', subtitle: 'Latest releases', enabled: true, order: 4 },
                    { id: 'radio', title: 'Popular radio', subtitle: 'Live streams 24/7', enabled: true, order: 5 }
                  ];

              const sortedSections = [...sections]
                .filter(s => s && s.enabled !== false)
                .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

              return sortedSections.map(sec => {
                switch (sec.id) {
                  case 'trending':
                    return (
                      <ScrollableRow
                        key="sec-trending"
                        title={sec.title || "Trending songs"}
                        subtitle={sec.subtitle || "The most played hits right now"}
                        items={trendingSongs}
                        fallbackItems={TRENDING_SONGS}
                        showAll={showAllTrending}
                        setShowAll={setShowAllTrending}
                        renderItem={(song) => (
                          <div onClick={() => handlePlayTrending(song.query || song.title, song, trendingSongs)} className="group cursor-pointer">
                            <div className="relative mb-2 md:mb-3">
                              <img src={getCleanThumbnail(song)} alt={song.title} className="w-full aspect-square rounded-md object-cover shadow-lg group-hover:shadow-amber-500/20 transition-all duration-300" onError={(e) => handleImageError(e, song.title, song.id)} />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition">
                                  <Icon name="play" className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-neutral-950 translate-x-[1px] md:translate-x-[2px]" />
                                </div>
                              </div>
                            </div>
                            <h3 className="text-xs md:text-sm font-bold text-white truncate group-hover:text-amber-400 transition">{song.title}</h3>
                            <p className="text-[11px] md:text-xs text-neutral-400 truncate mt-0.5 md:mt-1">{song.artist}</p>
                          </div>
                        )}
                      />
                    );

                  case 'curated':
                    return (
                      <CmsCuratedCollectionsRow
                        key="sec-curated"
                        backendUrl={BACKEND_URL}
                        title={sec.title || "Curated Featured Collections"}
                        subtitle={sec.subtitle || "Handpicked mixes, nostalgia sets, and soundtracks curated by our editors"}
                        onPlayTrack={(track, collectionTracks) => {
                          handlePlayTrending(track.title || track.name, track, collectionTracks);
                        }}
                      />
                    );

                  case 'artists':
                    return (
                      <ScrollableRow
                        key="sec-artists"
                        title={sec.title || "Popular artists"}
                        subtitle={sec.subtitle || "Find your favorite singers"}
                        items={POPULAR_ARTISTS}
                        showAll={showAllArtists}
                        setShowAll={setShowAllArtists}
                        renderItem={(artist) => (
                          <div onClick={() => handleArtistClick(artist.name)} className="group cursor-pointer flex flex-col items-center">
                            <div className="relative mb-2 md:mb-3 w-full aspect-square rounded-full overflow-hidden shadow-lg border-2 border-transparent group-hover:border-amber-500 transition-all duration-300">
                              <img src={artist.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.name)}&background=1e1e1e&color=f59e0b&size=300`} alt={artist.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" onError={(e) => handleImageError(e, artist.name)} />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <Icon name="search" className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white drop-shadow-md transform scale-90 group-hover:scale-100 transition" />
                              </div>
                            </div>
                            <h3 className="text-xs md:text-sm font-bold text-white truncate w-full text-center group-hover:text-amber-400 transition">{artist.name}</h3>
                            <p className="text-[10px] md:text-xs text-neutral-400 truncate mt-0.5 md:mt-1 w-full text-center">{artist.role}</p>
                          </div>
                        )}
                      />
                    );

                  case 'albums':
                    return (
                      <ScrollableRow
                        key="sec-albums"
                        title={sec.title || "Popular albums and singles"}
                        subtitle={sec.subtitle || "Latest releases"}
                        items={popularAlbums}
                        fallbackItems={POPULAR_ALBUMS}
                        showAll={showAllAlbums}
                        setShowAll={setShowAllAlbums}
                        renderItem={(album) => (
                          <div onClick={() => handlePlayTrending(album.query || album.title, album, popularAlbums)} className="group cursor-pointer">
                            <div className="relative mb-2 md:mb-3">
                              <img src={getCleanThumbnail(album)} alt={album.title} className="w-full aspect-square rounded-md object-cover shadow-lg group-hover:shadow-amber-500/20 transition-all duration-300" onError={(e) => handleImageError(e, album.title, album.id)} />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition">
                                  <Icon name="play" className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-neutral-950 translate-x-[1px] md:translate-x-[2px]" />
                                </div>
                              </div>
                            </div>
                            <h3 className="text-xs md:text-sm font-bold text-white truncate group-hover:text-amber-400 transition">{album.title}</h3>
                            <p className="text-[11px] md:text-xs text-neutral-400 truncate mt-0.5 md:mt-1">{album.artist}</p>
                          </div>
                        )}
                      />
                    );

                  case 'radio':
                    return (
                      <ScrollableRow
                        key="sec-radio"
                        title={sec.title || "Popular radio"}
                        subtitle={sec.subtitle || "Live streams 24/7"}
                        items={popularRadio}
                        fallbackItems={POPULAR_RADIO}
                        showAll={showAllRadio}
                        setShowAll={setShowAllRadio}
                        renderItem={(radio) => (
                          <div onClick={() => handlePlayTrending(radio.query || radio.title, radio, popularRadio)} className="group cursor-pointer">
                            <div className="relative mb-2 md:mb-3">
                              <img src={getCleanThumbnail(radio)} alt={radio.title} className="w-full aspect-square rounded-md object-cover shadow-lg group-hover:shadow-amber-500/20 transition-all duration-300" onError={(e) => handleImageError(e, radio.title, radio.id)} />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition">
                                  <Icon name="play" className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-neutral-950 translate-x-[1px] md:translate-x-[2px]" />
                                </div>
                              </div>
                            </div>
                            <h3 className="text-xs md:text-sm font-bold text-white truncate group-hover:text-amber-400 transition">{radio.title}</h3>
                            <p className="text-[11px] md:text-xs text-neutral-400 truncate mt-0.5 md:mt-1">{radio.artist}</p>
                          </div>
                        )}
                      />
                    );

                  default:
                    return null;
                }
              });
            })()}

            <DisclaimerFooter footer={cmsConfig?.footer} />
          </div>
        )}

        {['barber', 'truck', 'pauwa'].includes(activeTab) && currentStation && (
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            <div className="p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-neutral-700/50 relative overflow-hidden shadow-2xl backdrop-blur-md bg-neutral-900/40 w-full min-w-0">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/40 bg-neutral-900/80 backdrop-blur-xl text-amber-300 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    {currentStation.badge}
                  </span>
                  <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-lg">{currentStation.title}</h1>
                  <p className="text-xs md:text-sm text-neutral-200 max-w-xl font-medium drop-shadow">{currentStation.subtitle}</p>
                </div>
              </div>
            </div>

            {stationLoading ? (
              <div className="text-center py-6">
                <span className="text-xs text-amber-400 animate-pulse flex items-center justify-center gap-2">
                  <Icon name="sparkles" className="w-4 h-4 animate-spin shrink-0" /> Fetching station music tracks...
                </span>
              </div>
            ) : (
              <>
                {songs.length > 0 && (
                  <div className="flex items-center justify-between px-2 text-xs text-neutral-400 font-medium">
                    <span>Showing {Math.min(stationVisibleCount, songs.length)} of {songs.length} curated tracks</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2">
                  {songs.slice(0, stationVisibleCount).map((track, i) => {
                    const isCurrent = currentSong?.id === track.id;
                    const isMenuOpen = openMenuId === `${track.id}-${i}`;
                    return (
                      <div
                        key={track.id + '-' + i}
                        onClick={() => playSong(track)}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition backdrop-blur-md relative ${
                          isMenuOpen ? 'z-30' : 'z-auto'
                        } ${
                          isCurrent
                            ? 'bg-neutral-900/90 border-amber-500/80 shadow-xl'
                            : 'bg-neutral-900/50 border-neutral-800/70 hover:bg-neutral-900 active:scale-[0.98]/80'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="text-xs font-mono text-neutral-400 w-6 text-center">{i + 1}</span>
                          <img src={getCleanThumbnail(track)} alt={track.title || ""} loading="lazy" className="w-12 h-12 rounded-2xl object-cover shrink-0 shadow-md" onError={(e) => handleImageError(e, track.title, track.id)} />
                          <div className="min-w-0">
                            <h4 className={`font-bold text-xs truncate ${isCurrent ? 'text-amber-400' : 'text-white'}`}>
                              {track.title}
                            </h4>
                            <p className="text-[10px] text-neutral-400 truncate">{track.channel || track.artist}</p>
                          </div>
                        </div>

                        <div className={`flex items-center gap-2 shrink-0 relative ${isMenuOpen ? 'z-40' : ''}`}>
                          <button onClick={(e) => handleOpenVideo(track, e)} className="p-1.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition flex items-center shrink-0" title="See Video">
                            <Icon name="video" className="w-3.5 h-3.5 shrink-0" />
                          </button>
                          
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setOpenMenuId(isMenuOpen ? null : `${track.id}-${i}`); 
                            }} 
                            className="p-1 text-neutral-500 hover:text-white transition shrink-0"
                          >
                            <Icon name="moreVertical" className="w-5 h-5 shrink-0" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-44 bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-neutral-700/80 overflow-hidden z-50 animate-fadeIn">
                              {currentSong?.id !== track.id && (
                                <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{likedSongs.some(s => s.id === track.id) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
                              <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {songs.length > 0 && (
                  <div className="text-center pt-6 pb-4">
                    <button
                      onClick={handleLoadMoreStationSongs}
                      disabled={isLoadingMoreStation}
                      className="px-6 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 active:scale-[0.98] text-xs font-bold text-amber-400 border border-neutral-700 transition shadow-xl cursor-pointer inline-flex items-center justify-center gap-2"
                    >
                      {isLoadingMoreStation ? (
                        <>
                          <Icon name="sparkles" className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading more songs...</span>
                        </>
                      ) : (
                        <span>Load More Songs</span>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}

            <DisclaimerFooter footer={cmsConfig?.footer} />
          </div>
        )}

        {activeTab === 'library' && (
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-display font-extrabold tracking-tight text-white">Liked Songs Collection</h2>
              {likedSongs.length > 0 && (
                <span className="text-xs text-neutral-400 font-mono">{likedSongs.length} tracks</span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {likedSongs.length === 0 ? (
                <p className="text-xs text-neutral-500">No liked songs yet.</p>
              ) : (
                likedSongs.map((track, i) => {
                  const isMenuOpen = openMenuId === `${track.id}-${i}`;
                  return (
                    <div key={track.id + i} onClick={() => playSong(track)} className={`p-3.5 rounded-2xl border bg-neutral-900/50 border-neutral-800 flex items-center justify-between cursor-pointer hover:bg-neutral-900 active:scale-[0.98] transition relative ${isMenuOpen ? 'z-30' : 'z-auto'}`}>
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img src={getCleanThumbnail(track)} alt={track.title || ""} loading="lazy" className="w-12 h-12 rounded-2xl object-cover shrink-0" onError={(e) => handleImageError(e, track.title, track.id)} />
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-white truncate">{track.title}</h4>
                          <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-2 shrink-0 relative ${isMenuOpen ? 'z-40' : ''}`}>
                        <button onClick={(e) => handleOpenVideo(track, e)} className="p-1.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition flex items-center shrink-0" title="See Video">
                          <Icon name="video" className="w-3.5 h-3.5 shrink-0" />
                        </button>
                        
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setOpenMenuId(isMenuOpen ? null : `${track.id}-${i}`); 
                          }} 
                          className="p-1 text-neutral-500 hover:text-white transition shrink-0"
                        >
                          <Icon name="moreVertical" className="w-5 h-5 shrink-0" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-44 bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-neutral-700/80 overflow-hidden z-50 animate-fadeIn">
                            {currentSong?.id !== track.id && (
                              <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{likedSongs.some(s => s.id === track.id) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
                            <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <DisclaimerFooter footer={cmsConfig?.footer} />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-display font-extrabold tracking-tight text-white">Listening History</h2>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition"
                  title="Clear Listening History"
                >
                  <Icon name="trash" className="w-3.5 h-3.5" />
                  <span>Clear History</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {history.length === 0 ? (
                <p className="text-xs text-neutral-500">No history available.</p>
              ) : (
                history.map((track, i) => {
                  const isMenuOpen = openMenuId === `${track.id}-${i}`;
                  return (
                    <div key={track.id + i} onClick={() => playSong(track)} className={`p-3.5 rounded-2xl border bg-neutral-900/50 border-neutral-800 flex items-center justify-between cursor-pointer hover:bg-neutral-900 active:scale-[0.98] transition relative ${isMenuOpen ? 'z-30' : 'z-auto'}`}>
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img src={getCleanThumbnail(track)} alt={track.title || ""} loading="lazy" className="w-12 h-12 rounded-2xl object-cover shrink-0" onError={(e) => handleImageError(e, track.title, track.id)} />
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-white truncate">{track.title}</h4>
                          <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 relative ${isMenuOpen ? 'z-40' : ''}`}>
                        <button
                          onClick={(e) => handleOpenVideo(track, e)}
                          className="p-1.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition flex items-center text-[10px] shrink-0"
                        >
                          <Icon name="video" className="w-3.5 h-3.5 shrink-0" />
                        </button>
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : `${track.id}-${i}`); }} className="p-1.5 rounded-2xl hover:bg-white/10 text-neutral-400 transition flex items-center shrink-0">
                            <Icon name="moreVertical" className="w-4 h-4 shrink-0" />
                          </button>
                          {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-44 bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-neutral-700/80 overflow-hidden z-50 animate-fadeIn">
                              <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
                              <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{likedSongs.some(s => s.id === track.id) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
                              <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <DisclaimerFooter footer={cmsConfig?.footer} />
          </div>
        )}
        {activeTab === 'playlists' && (
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            {!selectedPlaylistForView ? (
              <>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-2xl font-display font-extrabold tracking-tight text-white">Your Playlists</h2>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
                  <div 
                    onClick={() => {
                      const name = window.prompt("Enter new playlist name:");
                      if (name && name.trim()) {
                        const newPlaylist = {
                          id: Date.now().toString(),
                          name: name.trim(),
                          songs: []
                        };
                        setPlaylists([...playlists, newPlaylist]);
                      }
                    }}
                    className="p-4 rounded-2xl border border-dashed border-neutral-700 bg-neutral-900/30 hover:bg-neutral-800/50 active:scale-[0.98] cursor-pointer flex flex-col items-center justify-center gap-3 transition group text-center aspect-square"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-neutral-800/50 group-hover:bg-amber-500/20 text-neutral-500 group-hover:text-amber-500 flex items-center justify-center transition">
                      <Icon name="plus" className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm truncate w-full">Create Playlist</h3>
                      <p className="text-[10px] text-neutral-400 mt-0.5">New folder</p>
                    </div>
                  </div>
                  {playlists.map(pl => (
                    <div 
                      key={pl.id} 
                      onClick={() => setSelectedPlaylistForView(pl)}
                      className="p-4 rounded-2xl border bg-neutral-900/50 hover:bg-neutral-800 active:scale-[0.98] border-neutral-800 cursor-pointer flex flex-col items-center justify-center gap-3 transition group text-center aspect-square"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-neutral-800 group-hover:bg-amber-500/20 text-neutral-500 group-hover:text-amber-500 flex items-center justify-center transition">
                        <Icon name="list" className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm truncate w-full">{pl.name}</h3>
                        <p className="text-[10px] text-neutral-400 mt-0.5">{pl.songs.length} tracks</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedPlaylistForView(null)}
                    className="p-2 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white transition flex items-center justify-center"
                  >
                    <Icon name="skipPrev" className="w-4 h-4 rotate-180" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-display font-extrabold tracking-tight text-white">{selectedPlaylistForView.name}</h2>
                    <p className="text-xs text-neutral-400">{selectedPlaylistForView.songs.length} tracks</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-2 mt-4">
                  {selectedPlaylistForView.songs.length === 0 ? (
                    <p className="text-xs text-neutral-500 p-4 text-center border border-dashed border-neutral-800 rounded-2xl">Empty playlist.</p>
                  ) : (
                    selectedPlaylistForView.songs.map((track, i) => {
                      const isMenuOpen = openMenuId === `${track.id}-${i}`;
                      return (
                        <div key={track.id + i} onClick={() => playSong(track)} className={`p-3.5 rounded-2xl border bg-neutral-900/50 border-neutral-800 flex items-center justify-between cursor-pointer hover:bg-neutral-900 active:scale-[0.98] transition group relative ${isMenuOpen ? 'z-30' : 'z-auto'}`}>
                          <div className="flex items-center gap-3.5 min-w-0">
                            <img src={getCleanThumbnail(track)} alt={track.title || ""} loading="lazy" className="w-12 h-12 rounded-2xl object-cover shrink-0" onError={(e) => handleImageError(e, track.title, track.id)} />
                            <div className="min-w-0 pr-4">
                              <h4 className="font-bold text-sm text-white truncate group-hover:text-amber-400 transition">{track.title}</h4>
                              <p className="text-[11px] text-amber-500/80 truncate mt-0.5">{track.channel}</p>
                            </div>
                          </div>
                          <div className={`flex items-center gap-2 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition relative ${isMenuOpen ? 'z-40' : ''}`}>
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setOpenMenuId(isMenuOpen ? null : `${track.id}-${i}`); 
                              }} 
                              className="p-1 text-neutral-500 hover:text-white transition shrink-0"
                            >
                              <Icon name="moreVertical" className="w-5 h-5 shrink-0" />
                            </button>

                            {isMenuOpen && (
                              <div className="absolute right-0 top-full mt-1.5 w-44 bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-neutral-700/80 overflow-hidden z-50 animate-fadeIn">
                                {currentSong?.id !== track.id && (
                                  <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{likedSongs.some(s => s.id === track.id) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
                                <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="fixed inset-0 z-[60] bg-neutral-950 overflow-y-auto">
            <AdminDashboard
              user={user}
              token={authToken}
              backendUrl={BACKEND_URL}
              onExit={() => {
                setActiveTab('home');
                window.history.pushState(null, '', '/');
                // Revert any uncommitted live draft preview back to published config
                const published = getCachedCmsConfig();
                setCmsConfig(published);
                applyThemeToDom(published.theme, true);
                fetchPublicCmsConfig(BACKEND_URL).then(cfg => {
                  if (cfg) {
                    const normalized = normalizeCmsConfig(cfg);
                    setCmsConfig(normalized);
                    applyThemeToDom(normalized.theme, true);
                  }
                });
              }}
              onOpenAuth={openAuthModal}
              showToast={showToast}
              onPreviewConfig={(previewConfig) => {
                if (previewConfig) {
                  const normalized = normalizeCmsConfig(previewConfig);
                  setCmsConfig(normalized);
                  applyThemeToDom(normalized.theme, false);
                }
              }}
            />
          </div>
        )}
      </main>
      </div>

      {currentSong && (
        <footer 
          onClick={() => handleOpenExpandedPlayer('player')}
          role="region"
          aria-label="Audio player mini bar"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (e.target === e.currentTarget) {
                e.preventDefault();
                handleOpenExpandedPlayer('player');
              }
            }
          }}
          className={`fixed bottom-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-2xl border-t border-amber-500/20 transition-all duration-300 shadow-[0_-10px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(var(--accent-rgb,245,158,11),0.06)] left-0 ${isSidebarCollapsed ? 'md:left-20' : 'md:left-72'} ${showQueuePanel ? 'hidden' : 'block'} cursor-pointer select-none pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 px-3 md:py-3 md:px-6`}
        >
          {/* Quick Expand Pill for Mobile Accessibility */}
          <div className="md:hidden absolute -top-3.5 right-4 z-50 shrink-0 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenExpandedPlayer('player');
              }}
              className="px-2.5 py-0.5 rounded-full bg-neutral-900/95 hover:bg-neutral-800 border border-amber-500/40 text-amber-400 text-[10px] font-bold shadow-lg flex items-center gap-1 transition shrink-0 cursor-pointer"
              title="Expand Player"
              aria-label="Expand Player"
            >
              <Icon name="chevronUp" className="w-3.5 h-3.5 shrink-0" />
              <span>Expand Player</span>
            </button>
          </div>

          {/* Desktop Full 3-Section Footer (>= md) */}
          <div className="hidden md:flex max-w-7xl mx-auto items-center justify-between gap-4">
            {/* Left: Metadata & Secondary Actions */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                handleOpenExpandedPlayer('player');
              }}
              className="flex items-center gap-3 w-1/4 min-w-0 cursor-pointer group"
            >
              <div className="relative group shrink-0">
                <img 
                  src={getCleanThumbnail(currentSong)} 
                  alt={currentSong.title || ""} 
                  className="rounded-xl object-cover shrink-0 shadow-md transition-all duration-300 w-12 h-12 border border-amber-500/30 group-hover:border-amber-400" 
                  onError={(e) => handleImageError(e, currentSong.title, currentSong.id)} 
                />
                {isPlaying && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-neutral-950 flex items-center justify-center text-[9px] font-bold animate-spin-slow shadow-md border border-neutral-950">
                    💿
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-xs text-white truncate group-hover:text-amber-300 transition-colors">{currentSong.title}</h4>
                <p className="text-[10px] text-amber-400 truncate">{currentSong.channel}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                <button onClick={(e) => handleOpenVideo(currentSong, e)} className="text-amber-400 hover:text-amber-300 transition p-1 shrink-0 cursor-pointer" title="Watch Video">
                  <Icon name="video" className="w-4 h-4 shrink-0" />
                </button>
                <button onClick={(e) => handleAddToPlaylistClick(currentSong, e)} className="text-neutral-500 hover:text-amber-500 transition p-1 shrink-0 cursor-pointer" title="Add to Playlist">
                  <Icon name="plus" className="w-4 h-4 shrink-0" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleOpenExpandedPlayer('queue'); }} className="text-neutral-500 hover:text-amber-500 transition p-1 shrink-0 cursor-pointer" title="View Queue">
                  <Icon name="list" className="w-4 h-4 shrink-0" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); toggleLike(currentSong); }} className="text-neutral-500 hover:text-pink-500 transition p-1 shrink-0 cursor-pointer" title="Like">
                  <Icon name={likedSongs.some(s => s.id === currentSong.id) ? "heart" : "heartOutline"} className="w-4 h-4 text-pink-500 shrink-0" />
                </button>
              </div>
            </div>

            {/* Middle: Controls & Scrubber */}
            <div className="flex flex-col items-center w-2/4 gap-1.5 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-4 shrink-0">
                <button onClick={() => setIsShuffle(!isShuffle)} className={`transition cursor-pointer ${isShuffle ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`} title={isShuffle ? "Shuffle On" : "Shuffle Off"}>
                  <Icon name="shuffle" className="w-4 h-4 shrink-0" />
                </button>
                <button onClick={handlePrevSong} className="text-neutral-300 hover:text-white transition cursor-pointer" title="Previous Track">
                  <Icon name="skipPrev" className="w-5 h-5 shrink-0" />
                </button>
                <button onClick={togglePlayPause} className="w-11 h-11 rounded-full amber-glow-btn text-neutral-950 flex items-center justify-center font-bold shadow-[0_0_20px_rgba(var(--accent-rgb,245,158,11),0.4)] hover:shadow-[0_0_28px_rgba(var(--accent-rgb,245,158,11),0.6)] active:scale-95 transition-all shrink-0 cursor-pointer border border-amber-300/40" title={isPlaying ? "Pause" : "Play"}>
                  <Icon name={isPlaying ? "pause" : "play"} className="w-5 h-5 fill-current" />
                </button>
                <button onClick={handleNextSong} className="text-neutral-300 hover:text-white transition cursor-pointer" title="Next Track">
                  <Icon name="skipNext" className="w-5 h-5 shrink-0" />
                </button>
                <button 
                  onClick={toggleRepeatMode} 
                  className={`relative transition cursor-pointer ${isRepeat ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`} 
                  title={isRepeat === 'one' ? 'Repeat One' : isRepeat === 'all' ? 'Repeat All' : 'Repeat Off'}
                >
                  <Icon name="repeat" className="w-4 h-4 shrink-0" />
                  {isRepeat === 'one' && (
                    <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-amber-500 text-white rounded-full w-3 h-3 flex items-center justify-center">1</span>
                  )}
                </button>
              </div>

              <PlayerProgress playerRef={playerRef} isPlaying={isPlaying} onSeek={handleSeek} currentSongId={currentSong?.id} />
            </div>

            {/* Right: Actions & Volume */}
            <div className="flex items-center justify-end w-1/4 gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => handleOpenVideo(currentSong, e)}
                className="px-3 py-1.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 transition flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer"
                title="Watch Video"
              >
                <Icon name="video" className="w-4 h-4 shrink-0" />
              </button>

              <Icon name="volume" className="w-4 h-4 text-neutral-400 ml-2 shrink-0" />
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-neutral-800 rounded-xl appearance-none cursor-pointer accent-amber-500 shrink-0"
              />
            </div>
          </div>

          {/* Mobile Sleek Single-Row Mini-Player (< md) */}
          <div className="md:hidden flex items-center justify-between gap-2 sm:gap-3 w-full">
            {/* Left: Thumbnail & Song Info */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                handleOpenExpandedPlayer('player');
              }}
              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
            >
              <div className="relative shrink-0">
                <img 
                  src={getCleanThumbnail(currentSong)} 
                  alt={currentSong.title || ""} 
                  className="rounded-xl object-cover shrink-0 shadow-md w-11 h-11 border border-amber-500/30" 
                  onError={(e) => handleImageError(e, currentSong.title, currentSong.id)} 
                />
                {isPlaying && (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-neutral-950 flex items-center justify-center text-[8px] font-bold animate-spin-slow shadow-md border border-neutral-950">
                    💿
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-xs text-white truncate leading-tight">{currentSong.title}</h4>
                <p className="text-[10px] text-amber-400 truncate mt-0.5">{currentSong.channel}</p>
              </div>
            </div>

            {/* Right: Compact Controls */}
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenExpandedPlayer('queue');
                }} 
                className="text-neutral-400 hover:text-amber-400 transition p-2 shrink-0 cursor-pointer" 
                title="View Queue"
                aria-label="View Queue"
              >
                <Icon name="list" className="w-4 h-4 shrink-0" />
              </button>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevSong();
                }} 
                className="text-neutral-300 hover:text-white transition p-1.5 shrink-0 cursor-pointer hidden min-[360px]:block" 
                title="Previous Track"
                aria-label="Previous Track"
              >
                <Icon name="skipPrev" className="w-4 h-4 shrink-0" />
              </button>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }} 
                className="w-9 h-9 rounded-full amber-glow-btn text-neutral-950 flex items-center justify-center shadow-md active:scale-95 transition shrink-0 cursor-pointer border border-amber-300/40" 
                title={isPlaying ? "Pause" : "Play"}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                <Icon name={isPlaying ? "pause" : "play"} className="w-4 h-4 fill-current translate-x-0.5" />
              </button>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextSong();
                }} 
                className="text-neutral-300 hover:text-white transition p-1.5 shrink-0 cursor-pointer" 
                title="Next Track"
                aria-label="Next Track"
              >
                <Icon name="skipNext" className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </footer>
      )}

      {showQueuePanel && (
        <div className={`fixed top-14 md:top-16 inset-x-0 bottom-0 ${isSidebarCollapsed ? 'md:left-20' : 'md:left-72'} z-50 bg-neutral-950 flex flex-col md:flex-row overflow-hidden animate-fadeIn pb-[env(safe-area-inset-bottom,0px)]`}>
          {/* Mobile Tab Header with Segmented Switcher & Close Button */}
          <div className="md:hidden flex items-center justify-between px-3 py-1.5 border-b border-neutral-800/80 bg-neutral-900/95 backdrop-blur-xl shrink-0 z-50">
            <div className="flex bg-neutral-800/90 p-0.5 rounded-xl gap-1 border border-neutral-700/60 shadow-inner">
              <button 
                onClick={() => setMobileQueueTab('player')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${mobileQueueTab === 'player' ? 'bg-amber-500 text-neutral-950 font-bold shadow' : 'text-neutral-400 hover:text-white'}`}
              >
                Now Playing
              </button>
              <button 
                onClick={() => setMobileQueueTab('queue')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${mobileQueueTab === 'queue' ? 'bg-amber-500 text-neutral-950 font-bold shadow' : 'text-neutral-400 hover:text-white'}`}
              >
                Up Next ({queue.length})
              </button>
            </div>

            <button 
              onClick={() => setShowQueuePanel(false)} 
              className="text-neutral-400 hover:text-white bg-neutral-800/90 hover:bg-neutral-700 p-1.5 rounded-full border border-neutral-700/60 shadow-md cursor-pointer transition shrink-0"
              title="Close Player"
              aria-label="Close Player"
            >
              <Icon name="close" className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop Close Button */}
          <button 
            onClick={() => setShowQueuePanel(false)} 
            className="hidden md:flex absolute top-4 right-4 text-neutral-400 hover:text-white z-50 bg-neutral-900/80 hover:bg-neutral-800 p-2 rounded-full backdrop-blur-md border border-neutral-700/60 shadow-lg cursor-pointer transition"
            title="Close"
          >
            <Icon name="close" className="w-6 h-6" />
          </button>

          {/* Player Column (Full on Mobile when 'player' tab is active; 50% on Desktop) */}
          <div className={`${mobileQueueTab === 'player' ? 'flex' : 'hidden'} md:flex w-full md:w-1/2 p-2 sm:p-5 md:p-8 flex-col justify-between md:justify-center items-center bg-gradient-to-br from-neutral-900 to-neutral-950 border-r border-neutral-800/50 overflow-hidden flex-1 md:flex-initial h-full max-h-full`}>
            {currentSong ? (
              <div className="w-full max-w-sm flex-1 flex flex-col items-center justify-between py-1 sm:py-2 min-h-0">
                {/* 3D Illuminated Virtual Turntable */}
                <div className="relative flex flex-col items-center justify-center shrink min-h-0 my-auto">
                  <Turntable3D 
                    currentSong={currentSong} 
                    isPlaying={isPlaying} 
                    onTogglePlay={togglePlayPause} 
                    size="responsive"
                  />
                  {/* Audio Spectrum Visualizer */}
                  <AudioSpectrumVisualizer 
                    isPlaying={isPlaying} 
                    barCount={28}
                    height={20}
                    className="w-full max-w-[200px] sm:max-w-xs mt-1 shrink-0" 
                  />
                </div>

                {/* Song Meta & Actions */}
                <div className="w-full text-center space-y-0.5 sm:space-y-1 shrink-0 my-1">
                  <h2 className="text-sm sm:text-base md:text-xl font-display font-bold text-white line-clamp-1 leading-snug px-2">{currentSong.title}</h2>
                  <p className="text-[11px] sm:text-xs text-amber-500 font-medium truncate px-4">{currentSong.channel}</p>
                  
                  {/* Secondary buttons */}
                  <div className="flex items-center justify-center gap-3 pt-0.5">
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleLike(currentSong); }} 
                      className="p-1.5 sm:p-2 rounded-full bg-neutral-800/70 hover:bg-neutral-800 text-neutral-400 hover:text-pink-500 transition shadow" 
                      title={likedSongs.some(s => s.id === currentSong.id) ? "Remove from Favourite" : "Add to Favourite"}
                    >
                      <Icon name={likedSongs.some(s => s.id === currentSong.id) ? "heart" : "heartOutline"} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-500" />
                    </button>
                    <button 
                      onClick={(e) => handleAddToPlaylistClick(currentSong, e)} 
                      className="p-1.5 sm:p-2 rounded-full bg-neutral-800/70 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 transition shadow" 
                      title="Add to Playlist"
                    >
                      <Icon name="plus" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleOpenVideo(currentSong, e)} 
                      className="p-1.5 sm:p-2 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 transition shadow" 
                      title="Watch Video"
                    >
                      <Icon name="video" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full px-2 shrink-0 my-1">
                  <PlayerProgress playerRef={playerRef} isPlaying={isPlaying} onSeek={handleSeek} currentSongId={currentSong?.id} />
                </div>

                {/* Main Playback Controls with Tactile 3D Buttons */}
                <div className="flex items-center justify-center gap-4 sm:gap-6 w-full shrink-0 my-1">
                  <button 
                    onClick={() => setIsShuffle(!isShuffle)} 
                    className={`p-1.5 transition ${isShuffle ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`} 
                    title={isShuffle ? "Shuffle On" : "Shuffle Off"}
                  >
                    <Icon name="shuffle" className="w-4 h-4" />
                  </button>
                  
                  <button 
                    onClick={handlePrevSong} 
                    className="p-2 sm:p-3 rounded-full bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-700/60 text-neutral-200 hover:text-white hover:scale-110 active:scale-95 transition-all shadow-md" 
                    title="Previous Track"
                  >
                    <Icon name="skipPrev" className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  
                  <button 
                    onClick={togglePlayPause} 
                    className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full amber-glow-btn text-neutral-950 flex items-center justify-center font-bold shadow-[0_0_25px_rgba(var(--accent-rgb,245,158,11),0.5)] hover:shadow-[0_0_35px_rgba(var(--accent-rgb,245,158,11),0.7)] hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-300/40"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    <Icon name={isPlaying ? "pause" : "play"} className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
                  </button>
                  
                  <button 
                    onClick={handleNextSong} 
                    className="p-2 sm:p-3 rounded-full bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-700/60 text-neutral-200 hover:text-white hover:scale-110 active:scale-95 transition-all shadow-md" 
                    title="Next Track"
                  >
                    <Icon name="skipNext" className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  
                  <button 
                    onClick={toggleRepeatMode} 
                    className={`relative p-1.5 transition ${isRepeat ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`} 
                    title={isRepeat === 'one' ? 'Repeat One' : isRepeat === 'all' ? 'Repeat All' : 'Repeat Off'}
                  >
                    <Icon name="repeat" className="w-4 h-4" />
                    {isRepeat === 'one' && (
                      <span className="absolute top-0.5 right-0.5 text-[8px] font-bold bg-amber-500 text-white rounded-full w-3 h-3 flex items-center justify-center">1</span>
                    )}
                  </button>
                </div>

                {/* Volume Slider */}
                <div className="flex items-center gap-2.5 w-full max-w-[240px] justify-center px-3 py-1 rounded-xl bg-neutral-900/60 border border-neutral-800/60 shrink-0 my-0.5">
                  <Icon name="volume" className="w-3 h-3 text-neutral-400 shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="flex-1 h-1 bg-neutral-800 rounded-xl appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-[9px] font-mono text-neutral-400 w-6 text-right">{volume}%</span>
                </div>
              </div>
            ) : (
              <div className="text-neutral-500 text-lg flex flex-col items-center gap-3 py-16">
                <Icon name="music" className="w-12 h-12 text-neutral-700" />
                <span>No song playing</span>
              </div>
            )}
          </div>


          {/* Up Next Column (Full on Mobile when 'queue' tab is active; 50% on Desktop) */}
          <div className={`${mobileQueueTab === 'queue' ? 'flex' : 'hidden'} md:flex w-full md:w-1/2 flex-col bg-neutral-900/30 backdrop-blur-3xl overflow-y-auto hide-scrollbar pb-32 flex-1 md:flex-initial`}>
            <div className="p-4 sm:p-6 md:p-12 mt-2 md:mt-0">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMobileQueueTab('player')}
                    className="md:hidden p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700/60"
                    title="Back to Now Playing"
                  >
                    ←
                  </button>
                  <h3 className="text-xl sm:text-2xl font-display font-bold text-white flex items-center gap-2.5">
                    <Icon name="list" className="w-6 h-6 text-amber-500" />
                    Up Next
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full hidden sm:inline-flex items-center gap-1.5 font-medium">
                    <Icon name="grip" className="w-3.5 h-3.5" />
                    Tap & hold to slide
                  </span>
                  <span className="text-xs font-medium bg-neutral-800 text-neutral-400 px-3 py-1 rounded-full">{queue.length} tracks</span>
                </div>
              </div>

              {queue.length > 0 && (
                <p className="text-[11px] text-neutral-500 mb-3 flex items-center gap-1.5 sm:hidden">
                  <Icon name="grip" className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
                  <span>Tap & hold or slide grip to rearrange queue</span>
                </p>
              )}
              
              <Reorder.Group axis="y" values={queue} onReorder={setQueue} layoutScroll className="space-y-2.5">
                {queue.map((track) => {
                  const isCurrent = currentSong?.id === track.id;
                  return (
                    <QueueItem
                      key={track.id}
                      track={track}
                      isCurrent={isCurrent}
                      isPlaying={isPlaying}
                      onPlay={playSong}
                      onRemove={removeFromQueue}
                    />
                  );
                })}
                {queue.length === 0 && (
                  <div className="text-center py-12">
                    <Icon name="music" className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                    <p className="text-neutral-500">Your queue is empty</p>
                  </div>
                )}
              </Reorder.Group>
            </div>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div 
          className="fixed inset-0 z-[100] bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeAuthModal(false); }}
        >
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 w-full max-w-sm relative shadow-2xl">
            <button onClick={() => closeAuthModal(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white transition">
              <Icon name="close" className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-display font-extrabold tracking-tight text-white mb-6 text-center">
              {isLoginMode ? "Welcome Back" : "Create Account"}
            </h2>
            
            {authError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-2xl text-center">
                {authError}
              </div>
            )}
            
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1.5">Username</label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={authForm.username}
                  onChange={(e) => setAuthForm({...authForm, username: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-900/50 backdrop-blur-lg border border-neutral-800 text-white text-sm focus:outline-none focus:border-amber-500 transition"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  autoComplete={isLoginMode ? "current-password" : "new-password"}
                  value={authForm.password}
                  onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-900/50 backdrop-blur-lg border border-neutral-800 text-white text-sm focus:outline-none focus:border-amber-500 transition"
                  placeholder="Enter password"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 mt-2 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 hover:shadow-amber-500/20 text-white font-medium tracking-wide text-sm transition shadow-lg flex items-center justify-center disabled:opacity-50"
              >
                {authLoading ? <Icon name="sparkles" className="w-5 h-5 animate-spin" /> : (isLoginMode ? "Log In" : "Sign Up")}
              </button>
            </form>
            
            <div className="mt-6 flex items-center justify-center gap-4">
               <div className="h-px bg-neutral-800 flex-1"></div>
               <span className="text-xs text-neutral-500 font-medium">OR</span>
               <div className="h-px bg-neutral-800 flex-1"></div>
            </div>
            <div className="mt-6 flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setAuthError('Google Sign-In origin not authorized by client ID. Please use username and password login above.')}
                theme="filled_black"
                shape="rectangular"
                text="continue_with"
                size="large"
              />
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-neutral-400">
                {isLoginMode ? "Don't have an account?" : "Already have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }}
                  className="text-amber-400 hover:text-amber-300 font-bold underline transition"
                >
                  {isLoginMode ? "Sign Up" : "Log In"}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {isPlaylistModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md" onClick={() => { setIsPlaylistModalOpen(false); setSelectedSongForPlaylist(null); }}></div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm relative z-10 p-6 shadow-2xl animate-scaleIn">
            <h2 className="text-xl font-bold text-white mb-4">Add to Playlist</h2>
            {selectedSongForPlaylist && (
              <div className="flex items-center gap-3 mb-6 p-3 rounded-2xl bg-neutral-800/50">
                <img src={getCleanThumbnail(selectedSongForPlaylist)} className="w-10 h-10 rounded object-cover" alt={selectedSongForPlaylist.title || ""} onError={(e) => handleImageError(e, selectedSongForPlaylist.title, selectedSongForPlaylist.id)} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{selectedSongForPlaylist.title}</p>
                  <p className="text-xs text-amber-500/80 truncate">{selectedSongForPlaylist.channel}</p>
                </div>
              </div>
            )}
            <div className="mb-4 relative">
              <select
                className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 appearance-none cursor-pointer"
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddSongToExistingPlaylist(e.target.value);
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Select a playlist...</option>
                {playlists.map(pl => {
                  const hasSong = selectedSongForPlaylist && pl.songs.some(s => s.id === selectedSongForPlaylist.id);
                  return (
                    <option key={pl.id} value={pl.id} disabled={hasSong}>
                      {pl.name} {hasSong ? '(Already added)' : `(${pl.songs.length} songs)`}
                    </option>
                  );
                })}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                <Icon name="chevronDown" className="w-4 h-4" />
              </div>
            </div>
            <form onSubmit={handleCreatePlaylist} className="mt-4 pt-4 border-t border-neutral-800">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Create New Playlist</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Playlist Name"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-2xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                />
                <button type="submit" disabled={!newPlaylistName.trim()} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 hover:shadow-amber-500/20 text-white font-medium tracking-wide text-sm rounded-2xl transition disabled:opacity-50 disabled:cursor-not-allowed">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-2xl bg-neutral-900/95 text-white text-xs border border-amber-500/40 shadow-2xl backdrop-blur-xl flex items-center gap-2 animate-fadeIn pointer-events-none">
          <Icon name="sparkles" className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}


















