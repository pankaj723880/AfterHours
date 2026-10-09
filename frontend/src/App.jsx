import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleLogin } from '@react-oauth/google';

import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL);

const fetchFromBackend = async (query) => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/youtube/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Backend fetch failed');
    }
    return await res.json();
  } catch (err) {
    console.error("Backend fetch error:", err);
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
    user: <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor" />
  };
  return (
    <svg className={className} viewBox="0 0 24 24" {...props}>
      {icons[name] || icons.music}
    </svg>
  );
};

const DisclaimerFooter = React.memo(() => (
  <div className="mt-8 pt-6 border-t border-neutral-800 text-neutral-400 text-xs space-y-2 leading-relaxed">
    <p>
      Audio plays through YouTube’s embedded player. Nothing is hosted on this site, and all rights stay with the labels, composers and performers. Song credits are put together from film soundtrack listings.
    </p>
    <p>
      If you hold rights to anything here and want it taken off, email{' '}
      <a href="mailto:pankajsss7238@gmail.com" className="text-amber-400 underline font-medium hover:text-amber-300">
        pankajsss7238@gmail.com
      </a>{' '}
      and it comes down.
    </p>
  </div>
));

const SPECIAL_STATIONS = {
  barber: {
    id: "barber",
    title: "डीलक्स सैलून (Deluxe Salon)",
    subtitle: "Classic 90s, 2000s Bollywood Hits & Retro Salon Evergreen Songs",
    badge: "💈 Nai Ki Dukaan • Vintage Barbershop & Drink Aesthetic",
    bgImages: [
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=1600&auto=format&fit=crop"
    ],
    queries: ["90s bollywood hit songs kumar sanu Alka Yagnik"]
  },
  truck: {
    id: "truck",
    title: "Truck Pe Music (MAHAUL SET)",
    subtitle: "Highway Dhaba Hits, Sunset Vibes, Bhojpuri, Altaf Raja & Punjabi Beats",
    badge: "🚛 Highway Truck Driver Vibe • Live Audio",
    bgImages: [
      "https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1508873696983-2df5c92063c7?q=80&w=1600&auto=format&fit=crop"
    ],
    queries: ["altaf raja best songs hindi highway dhaba hits"]
  },
  pauwa: {
    id: "pauwa",
    title: "Pauwa Party",
    subtitle: "Desi Peg Bangers, Yo Yo Honey Singh, Badshah, Sidhu & Local Desi Beats",
    badge: "🍾 Desi Daru & Celebration Mix",
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

const PlayerProgress = React.memo(({ playerRef, isPlaying, onSeek }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  useEffect(() => {
    let interval;
    if (isPlaying && !isSeeking) {
      interval = setInterval(() => {
        try {
          if (playerRef.current?.getCurrentTime) {
            const cur = playerRef.current.getCurrentTime();
            if (typeof cur === 'number' && !isNaN(cur)) setCurrentTime(cur);
          }
          if (playerRef.current?.getDuration) {
            const dur = playerRef.current.getDuration();
            if (typeof dur === 'number' && !isNaN(dur)) setDuration(dur);
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

const TRENDING_SONGS = [
  { title: "Chalray Chalray Waal", artist: "Ravzz Musica", image: "https://images.unsplash.com/photo-1493225457124-a1a2a5f5f9af?w=300&h=300&fit=crop", query: "Chalray Chalray Waal Ravzz Musica" },
  { title: "CHALREH CHALREH WAAL - Acoustic", artist: "Sufi Mafiya", image: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&h=300&fit=crop", query: "CHALREH CHALREH WAAL Acoustic Sufi Mafiya" },
  { title: "Magale", artist: "Sai Abhyankkar, Harini", image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop", query: "Magale Sai Abhyankkar" },
  { title: "Ashke", artist: "Karan Aujla, Mxrci", image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop", query: "Ashke Karan Aujla" },
  { title: "One Name", artist: "Anirudh Ravichander", image: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=300&h=300&fit=crop", query: "One Name Anirudh Ravichander" },
  { title: "BADASS", artist: "Arjan Dhillon", image: "https://images.unsplash.com/photo-1485579149621-3123dd979885?w=300&h=300&fit=crop", query: "BADASS Arjan Dhillon" },
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
  { title: "Aashiqui 2", artist: "Mithoon, Ankit Tiwari", image: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop", query: "Aashiqui 2 songs" },
  { title: "Yeh Jawaani Hai Deewani", artist: "Pritam", image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop", query: "Yeh Jawaani Hai Deewani songs" },
  { title: "Sanam Teri Kasam", artist: "Himesh Reshammiya", image: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&h=300&fit=crop", query: "Sanam Teri Kasam songs" },
  { title: "Finding Her", artist: "Kushagra, Bharath", image: "https://images.unsplash.com/photo-1483000805330-4eaf0a0d81a2?w=300&h=300&fit=crop", query: "Finding Her Kushagra" },
  { title: "Young G.O.A.T", artist: "Cheema Y, Gur Sidhu", image: "https://images.unsplash.com/photo-1516280440502-8692794eb84e?w=300&h=300&fit=crop", query: "Young G.O.A.T Cheema Y" },
  { title: "Raanjhan", artist: "Sachet-Parampara", image: "https://images.unsplash.com/photo-1520872024865-3ff2805d8bb3?w=300&h=300&fit=crop", query: "Raanjhan Do Patti" },
];

const POPULAR_RADIO = [
  { title: "Arijit Singh", artist: "With Pritam, A.R. Rahman", image: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=300&h=300&fit=crop", query: "Arijit Singh radio" },
  { title: "KK", artist: "With Pritam, Roop Kumar", image: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&h=300&fit=crop", query: "KK radio" },
  { title: "Shreya Ghoshal", artist: "With Atif Aslam", image: "https://images.unsplash.com/photo-1493225457124-a1a2a5f5f9af?w=300&h=300&fit=crop", query: "Shreya Ghoshal radio" },
  { title: "Alka Yagnik", artist: "With Vinod Rathod", image: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&h=300&fit=crop", query: "Alka Yagnik radio" },
  { title: "Diljit Dosanjh", artist: "With Harrdy Sandhu", image: "https://images.unsplash.com/photo-1516280440502-8692794eb84e?w=300&h=300&fit=crop", query: "Diljit Dosanjh radio" },
  { title: "A.R. Rahman", artist: "With Hariharan", image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop", query: "A.R. Rahman radio" },
];

const ScrollableRow = ({ items, renderItem, title, subtitle, showAll: controlledShowAll, setShowAll: setControlledShowAll }) => {
  const scrollRef = React.useRef(null);
  const [internalShowAll, setInternalShowAll] = React.useState(false);

  const showAll = controlledShowAll !== undefined ? controlledShowAll : internalShowAll;
  const setShowAll = setControlledShowAll !== undefined ? setControlledShowAll : setInternalShowAll;

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
    <div className="space-y-4">
      <div className="flex items-end justify-between mb-4">
        <div>
          {title && <h2 className="text-2xl font-display font-extrabold text-white tracking-tight">{title}</h2>}
          {subtitle && <p className="text-neutral-400 mt-1 text-sm font-medium">{subtitle}</p>}
        </div>
        <button 
          onClick={() => setShowAll(!showAll)}
          className="text-xs font-bold uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors"
        >
          {showAll ? 'Show Less' : 'View All'}
        </button>
      </div>

      {showAll ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {items.map((item, i) => (
            <React.Fragment key={i}>
              {renderItem(item, i, true)}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="relative group/carousel">
          <button onClick={() => scroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 w-10 h-10 bg-neutral-800/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10 hover:bg-neutral-700 shadow-xl border border-neutral-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <div ref={scrollRef} className="flex gap-6 overflow-x-auto pb-4 hide-scrollbar scroll-smooth">
            {items.map((item, i) => (
              <div key={i} className="w-40 md:w-48 shrink-0">
                {renderItem(item, i, false)}
              </div>
            ))}
          </div>
          <button onClick={() => scroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 -mr-4 w-10 h-10 bg-neutral-800/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10 hover:bg-neutral-700 shadow-xl border border-neutral-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>
      )}
    </div>
  );
};
export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  
  useEffect(() => {
    const handleClickOutsideMenu = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutsideMenu);
    return () => document.removeEventListener('click', handleClickOutsideMenu);
  }, []);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  React.useEffect(() => {
    const loadDynamicContent = async () => {
      try {
        const trendingRes = await fetchFromBackend("latest trending hindi hit songs");
        if(trendingRes && trendingRes.items) {
           setTrendingSongs(trendingRes.items.map(i => ({
             title: i.snippet.title,
             artist: i.snippet.channelTitle,
             image: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url || undefined,
             query: i.snippet.title + " " + i.snippet.channelTitle,
             videoId: i.id?.videoId || i.id
           })));
        }

        const albumRes = await fetchFromBackend("latest popular hindi english pop albums");
        if(albumRes && albumRes.items) {
           setPopularAlbums(albumRes.items.map(i => ({
             title: i.snippet.title,
             artist: i.snippet.channelTitle,
             image: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url || undefined,
             query: i.snippet.title
           })));
        }

        const radioRes = await fetchFromBackend("popular radio station live stream");
        if(radioRes && radioRes.items) {
           setPopularRadio(radioRes.items.map(i => ({
             title: i.snippet.title,
             artist: i.snippet.channelTitle,
             image: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url || undefined,
             query: i.snippet.title
           })));
        }
      } catch (err) {}
    };
    loadDynamicContent();
  }, []);

  const [trendingSongs, setTrendingSongs] = useState(TRENDING_SONGS);
  const [popularAlbums, setPopularAlbums] = useState(POPULAR_ALBUMS);
  const [popularRadio, setPopularRadio] = useState(POPULAR_RADIO);

  useEffect(() => {
    const fetchDynamicContent = async () => {
      try {
        const trendingRes = await fetchFromBackend("latest trending hindi hit songs");
        if(trendingRes && trendingRes.items) {
           setTrendingSongs(trendingRes.items.map(i => ({
             title: i.snippet.title,
             artist: i.snippet.channelTitle,
             image: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url || undefined,
             query: i.snippet.title + " " + i.snippet.channelTitle,
             videoId: i.id?.videoId || i.id
           })));
        }
        
        const albumsRes = await fetchFromBackend("latest hit bollywood albums audio jukebox");
        if(albumsRes && albumsRes.items) {
           setPopularAlbums(albumsRes.items.map(i => ({
             title: i.snippet.title,
             artist: i.snippet.channelTitle,
             image: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url || undefined,
             query: i.snippet.title + " " + i.snippet.channelTitle,
             videoId: i.id?.videoId || i.id
           })));
        }
        
        const radioRes = await fetchFromBackend("bollywood lofi romantic hits radio jukebox");
        if(radioRes && radioRes.items) {
           setPopularRadio(radioRes.items.map(i => ({
             title: i.snippet.title,
             artist: i.snippet.channelTitle,
             image: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url || undefined,
             query: i.snippet.title + " " + i.snippet.channelTitle,
             videoId: i.id?.videoId || i.id
           })));
        }
      } catch(e) { console.error("Failed to fetch dynamic content", e); }
    };
    fetchDynamicContent();
  }, []);

const sanitizeCache = (cache) => {
  try {
    if (!cache) return {};
    const newCache = { ...cache };
    Object.keys(newCache).forEach(k => {
      newCache[k] = newCache[k].map(track => {
        if (track.id && track.thumbnail && (track.thumbnail.includes('?sqp=') || track.thumbnail.includes('hq720'))) {
           track.thumbnail = `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
        }
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
      if (track.id && track.thumbnail && (track.thumbnail.includes('?sqp=') || track.thumbnail.includes('hq720'))) {
         track.thumbnail = `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
      }
      return track;
    });
  } catch(e) { return []; }
};


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

  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);

  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [volume, setVolume] = useState(80);
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

  const [searchQuery, setSearchQuery] = useState("");
  const [songs, setSongs] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchVisibleCount, setSearchVisibleCount] = useState(10);
  const [queue, setQueue] = useState([]);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Sync Data when user logs in or likedSongs/history change
  useEffect(() => {
    const id = user?.userId || user?._id;
    if (user && id) {
      fetch(`${BACKEND_URL}/api/user/${id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ likedSongs, history, playlists })
      }).catch(console.error);
    } else if (user && !id) {
      // Clear invalid old user state
      setUser(null);
      localStorage.removeItem('afterhours_user');
    }
  }, [likedSongs, history, playlists, user]);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setAuthLoading(true);
      setAuthError('');
      const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential,
          // Sending current local state to merge
          likedSongs: likedSongs,
          history: history,
          playlists: playlists
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google Auth failed');
      
      const loggedInUser = { username: data.user.username, userId: data.user.userId || data.user._id };
      setUser(loggedInUser);
      localStorage.setItem('afterhours_user', JSON.stringify(loggedInUser));
      setShowAuthModal(false);

      const mergedLiked = data.user.likedSongs || [];
      const uniqueLiked = Array.from(new Set(mergedLiked.map(a => a.id))).map(id => mergedLiked.find(a => a.id === id));
      setLikedSongs(sanitizeList(uniqueLiked));
      localStorage.setItem('liked_songs', JSON.stringify(sanitizeList(uniqueLiked)));

      const mergedHistory = data.user.history || [];
      const uniqueHistory = Array.from(new Set(mergedHistory.map(a => a.id))).map(id => mergedHistory.find(a => a.id === id)).slice(0, 50);
      setHistory(sanitizeList(uniqueHistory));
      localStorage.setItem('history_songs', JSON.stringify(sanitizeList(uniqueHistory)));

      const mergedPlaylists = data.user.playlists || [];
      const uniquePlaylists = Array.from(new Set(mergedPlaylists.map(a => a.id))).map(id => mergedPlaylists.find(a => a.id === id));
      setPlaylists(sanitizeList(uniquePlaylists));
      localStorage.setItem('playlists', JSON.stringify(sanitizeList(uniquePlaylists)));
      
    } catch (err) {
      console.error('Google Auth Error:', err);
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePlayTrending = async (query) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/youtube/search?limit=1&q=` + encodeURIComponent(query));
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        const formattedSong = {
          id: item.id.videoId || item.id,
          title: item.snippet?.title?.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&") || "Unknown Title",
          artist: item.snippet?.channelTitle || "Unknown Artist",
          thumbnail: (item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || "/default-cover.png").replace(/(\?sqp=.*|hq720\.jpg)/, 'hqdefault.jpg'),
          duration: "Stream"
        };
        playSong(formattedSong);
      }
    } catch (error) {
      console.error("Error playing trending:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArtistClick = (artistName) => {
    setSearchQuery(artistName);
    handleStationSelect('discover');
    fetchYouTubeMusic(artistName);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      
      const loggedInUser = { username: authForm.username, userId: data.userId || (data.user && data.user._id) };
      setUser(loggedInUser);
      localStorage.setItem('afterhours_user', JSON.stringify(loggedInUser));
      setShowAuthModal(false);

      if (isLoginMode && data.user) {
        // Merge local data with remote data
        const mergedLiked = [...likedSongs, ...(data.user.likedSongs || [])];
        const uniqueLiked = Array.from(new Set(mergedLiked.map(a => a.id))).map(id => mergedLiked.find(a => a.id === id));
        setLikedSongs(sanitizeList(uniqueLiked));
        localStorage.setItem('liked_songs', JSON.stringify(sanitizeList(uniqueLiked)));

        const mergedHistory = [...history, ...(data.user.history || [])];
        const uniqueHistory = Array.from(new Set(mergedHistory.map(a => a.id))).map(id => mergedHistory.find(a => a.id === id)).slice(0, 50);
        setHistory(sanitizeList(uniqueHistory));
        localStorage.setItem('history_songs', JSON.stringify(sanitizeList(uniqueHistory)));

        const mergedPlaylists = [...playlists, ...(data.user.playlists || [])];
        const uniquePlaylists = Array.from(new Set(mergedPlaylists.map(a => a.id))).map(id => mergedPlaylists.find(a => a.id === id));
        setPlaylists(sanitizeList(uniquePlaylists));
        localStorage.setItem('playlists', JSON.stringify(sanitizeList(uniquePlaylists)));
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('afterhours_user');
    localStorage.removeItem('liked_songs');
    localStorage.removeItem('history_songs');
    localStorage.removeItem('playlists');
    setLikedSongs([]);
    setHistory([]);
    setPlaylists([]);
  };

  const playerRef = useRef(null);
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

  // Removed unused YouTube iframe API injection to fix [Violation] 'message' handler warning

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

    if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
      try { playerRef.current.stopVideo(); } catch (e) {}
    }

    setCurrentSong(song);
    setIsPlaying(true);

    if (['home', 'barber', 'truck', 'pauwa'].includes(activeTab)) {
      const station = SPECIAL_STATIONS[activeTab];
      if (station && station.bgImages && station.bgImages.length > 0) {
        setCurrentBgIndex(prev => (prev + 1) % station.bgImages.length);
      }
    }
  }, [activeTab, currentSong]);

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
        artist: currentSong.channel || "MAHAUL SET",
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

  const initPlayerInstance = useCallback((videoId) => {
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      gainNodeRef.current = audioContextRef.current.createGain();
      const bands = [60, 230, 910, 3600, 14000];
      eqNodesRef.current = bands.map(freq => {
        const filter = audioContextRef.current.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1;
        filter.gain.value = 0;
        return filter;
      });
    }

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    if (audioElemRef.current && !audioElemRef.current.paused) {
      audioElemRef.current.pause();
    }

    if (!audioElemRef.current) {
      audioElemRef.current = new Audio();
      audioElemRef.current.crossOrigin = 'anonymous';
      audioElemRef.current.sourceNode = audioContextRef.current.createMediaElementSource(audioElemRef.current);
    }

    const audio = audioElemRef.current;
    // Always use stream proxy to avoid direct Google media URL CORS and 206 failures
    audio.src = `${BACKEND_URL}/api/stream/${videoId}`;
    audio.play().catch(() => {});
    
    applySoundProfile(); // connects graph
    
    audio.onended = () => { 
      const currentRepeat = isRepeatRef.current;
      if (currentRepeat === 'one' || currentRepeat === true) {
        audio.currentTime = 0;
        audio.play().catch(()=>{});
      } else {
        handleNextSongRef.current?.();
      }
    };
    audio.onplay = () => { setIsPlaying(true); };
    audio.onpause = () => { setIsPlaying(false); };
    audio.ontimeupdate = () => {
      durationRef.current = audio.duration || 0;
    };

    // Mock YT.Player API
    playerRef.current = {
      playVideo: () => audio.play().catch(()=>{}),
      pauseVideo: () => audio.pause(),
      getCurrentTime: () => audio.currentTime,
      getDuration: () => audio.duration || 0,
      seekTo: (time) => { audio.currentTime = time; },
      setVolume: (vol) => { 
        if(gainNodeRef.current) gainNodeRef.current.gain.value = vol / 100; 
      },
      loadVideoById: ({ videoId }) => {
        audio.src = `${BACKEND_URL}/api/stream/${videoId}`;
        audio.play().catch(()=>{});
      }
    };
    
    setIsPlaying(true);
  }, [soundProfile]);

  useEffect(() => {
    if (!currentSong) return;

    if (loadedVideoIdRef.current === currentSong.id) return;

    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      playerRef.current.loadVideoById({ videoId: currentSong.id });
      playerRef.current.playVideo();
      setIsPlaying(true);
      loadedVideoIdRef.current = currentSong.id;
    } else {
      // Mock player uses AudioContext and does not require YouTube IFrame API
      initPlayerInstance(currentSong.id);
      playerRef.current.playVideo();
      setIsPlaying(true);
      loadedVideoIdRef.current = currentSong.id;
    }

    setHistory(prev => [currentSong, ...prev.filter(s => s.id !== currentSong.id)].slice(0, 50));
  }, [currentSong, initPlayerInstance]);

  // Player progress interval is extracted to PlayerProgress component

  const loadStationSongs = useCallback(async (stationKey, autoPlayIfEmpty = false) => {
    const station = SPECIAL_STATIONS[stationKey];
    if (!station || station.queries.length === 0) return;

    if (stationKey === 'pauwa') {
      if (stationCache[stationKey]) {
        const party = stationCache[stationKey].party || [];
        const heartbreak = stationCache[stationKey].heartbreak || [];
        if (party.length > 0 || heartbreak.length > 0) {
          setPartyTracks(party);
          setHeartbreakTracks(heartbreak);
          if (!currentSong) setQueue([...party, ...heartbreak]);
          if (autoPlayIfEmpty && !currentSong && party.length > 0) playSong(party[0]);
          return;
        }
      }
    } else if (stationCache[stationKey]) {
      const cachedTracks = stationCache[stationKey].tracks || [];
      if (cachedTracks.length > 0) {
        setSongs(cachedTracks);
        if (!currentSong) setQueue(cachedTracks);
        if (autoPlayIfEmpty && !currentSong && cachedTracks.length > 0) {
          const randomTrack = cachedTracks[Math.floor(Math.random() * cachedTracks.length)];
          playSong(randomTrack);
        }
        return;
      }
    }

    setStationLoading(true);

    try {
      if (stationKey === 'pauwa') {
        const partyData = await fetchFromBackend(station.queries[0]);

        const fetchedParty = partyData.items ? partyData.items.map(item => ({
          id: item.id.videoId || item.id,
          title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
          channel: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
        })) : [];

        const sadData = await fetchFromBackend(station.queries[1]);

        const fetchedSad = sadData.items ? sadData.items.map(item => ({
          id: item.id.videoId || item.id,
          title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
          channel: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
        })) : [];

        setPartyTracks(fetchedParty);
        setHeartbreakTracks(fetchedSad);
        if (!currentSong) setQueue([...fetchedParty, ...fetchedSad]);

        setStationCache(prev => ({ 
          ...prev, 
          [stationKey]: { party: fetchedParty, heartbreak: fetchedSad } 
        }));

        if (autoPlayIfEmpty && fetchedParty.length > 0 && !currentSong) playSong(fetchedParty[0]);
      } else {
        const query = station.queries[0];
        const data = await fetchFromBackend(query);

        const fetchedTracks = data.items ? data.items.map(item => ({
          id: item.id.videoId || item.id,
          title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
          channel: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
        })) : [];

        setSongs(fetchedTracks);
        if (!currentSong) setQueue(fetchedTracks);

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
    if (videoModalSong) {
      setVideoModalSong(null);
      setIsPipActive(false);
    }
    if (isPlaying) {
      playerRef.current?.pauseVideo?.();
      if (silentAudioRef.current) silentAudioRef.current.pause();
      setIsPlaying(false);
    } else {
      playerRef.current?.playVideo?.();
      if (silentAudioRef.current) silentAudioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = useCallback((seekTime) => {
    currentTimeRef.current = seekTime;
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
      if (prev.some(s => s.id === song.id)) return prev;
      return [...prev, song];
    });
  };

  const removeFromQueue = (trackId) => {
    setQueue(prev => prev.filter(s => s.id !== trackId));
  };

  const toggleLike = (song) => {
    if (!user) { setShowAuthModal(true); return; }
    setLikedSongs(prev => prev.some(s => s.id === song.id) ? prev.filter(s => s.id !== song.id) : [song, ...prev]);
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
          return { ...pl, songs: [...pl.songs, selectedSongForPlaylist] };
        }
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

    if (searchCache[trimmedQuery]) {
      const cachedSongs = searchCache[trimmedQuery];
      setSearchResults(cachedSongs);
      setQueue(cachedSongs);
      setSearchVisibleCount(10);
      return;
    }

    if (isLoading) return;
    setIsLoading(true);
    try {
      const data = await fetchFromBackend(trimmedQuery + " official video original");

      if (data.items) {
        const fetchedTracks = data.items.map(item => ({
          id: item.id.videoId || item.id,
          title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
          channel: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
        }));

        setSearchResults(fetchedTracks);
        setQueue(fetchedTracks);
        setSearchVisibleCount(10);
        setSearchCache(prev => ({ ...prev, [trimmedQuery]: fetchedTracks }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) fetchYouTubeMusic(searchQuery);
  };

  const currentStation = SPECIAL_STATIONS[activeTab];
  const currentBgImage = currentStation?.bgImages?.[currentBgIndex] || currentStation?.bgImages?.[0];

  return (
    <div className="h-[100dvh] bg-neutral-950 text-neutral-100 font-sans flex flex-col md:flex-row antialiased selection:bg-amber-500 selection:text-white relative overflow-hidden">
      
      <link rel="preconnect" href="https://i.ytimg.com" />
      <link rel="preconnect" href="https://www.youtube.com" />

      <audio 
        ref={silentAudioRef} 
        loop 
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==" 
      />
      
      <div className="fixed top-0 left-0 w-1 h-1 opacity-0 pointer-events-none -z-50 overflow-hidden">
        <div id="yt-player-instance"></div>
      </div>

      {videoModalSong && (
        <div 
          className={
            isPipActive
              ? "fixed bottom-24 right-4 z-[9999] w-72 sm:w-80 bg-neutral-900 border border-neutral-700 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 animate-fadeIn"
              : "fixed inset-0 z-[9999] bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
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
                src={`https://www.youtube.com/embed/${videoModalSong.id}?autoplay=1&enablejsapi=1${videoModalSong.startAt ? '&start='+Math.floor(videoModalSong.startAt) : ''}`}
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

      <header className="md:hidden sticky top-0 z-40 bg-neutral-900/95 backdrop-blur-md border-b border-neutral-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-2xl bg-neutral-800 text-neutral-200 hover:text-white focus:outline-none shrink-0"
            aria-label="Toggle Menu"
          >
            <Icon name={isSidebarOpen ? "close" : "menu"} className="w-6 h-6 text-amber-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-700 via-amber-600 to-amber-500 flex items-center justify-center shadow-md">
              <Icon name="radio" className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-display font-extrabold tracking-tight tracking-wider text-white">MAHAUL SET</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-500 text-white font-medium tracking-wide text-xs shrink-0"
          >
            <Icon name="download" className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <div className="px-2.5 py-1 rounded-xl bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 font-mono text-[11px] text-amber-300">
            {clockString || "00:00"}
          </div>
        </div>
      </header>

      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-neutral-900/80 backdrop-blur-xl backdrop-blur-sm z-40 transition-opacity"
        />
      )}

      <aside 
        className={`fixed md:relative h-screen inset-y-0 left-0 z-50 bg-neutral-900/95 backdrop-blur-xl border-r border-neutral-800/80 p-4 flex flex-col shrink-0 transform transition-all duration-300 ease-in-out overflow-y-auto overflow-x-hidden ${
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
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-700 via-amber-600 to-amber-500 flex items-center justify-center shadow-xl border border-amber-500/35 shrink-0">
                    <Icon name="radio" className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-lg font-display font-extrabold tracking-tight tracking-wider text-white whitespace-nowrap">MAHAUL SET</h1>
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
              title="Barber Shop (सैलून)"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'} rounded-2xl font-medium text-xs transition ${
                activeTab === 'barber' ? 'bg-red-600/25 text-red-200 border border-red-500/50 shadow-lg shadow-red-950/50' : 'text-neutral-400 hover:bg-neutral-800 active:scale-[0.98]/50'
              }`}
            >
              <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                <Icon name="scissors" className="w-5 h-5 shrink-0 text-red-400" />
                {!isSidebarCollapsed && <span className="whitespace-nowrap">Barber Shop (सैलून)</span>}
              </div>
              {!isSidebarCollapsed && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold shrink-0">DRINK BG</span>}
            </button>

            <button
              onClick={() => handleStationSelect('truck')}
              title="Truck Pe Music"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'} rounded-2xl font-medium text-xs transition ${
                activeTab === 'truck' ? 'bg-amber-600/25 text-amber-200 border border-amber-500/50 shadow-lg shadow-amber-950/50' : 'text-neutral-400 hover:bg-neutral-800 active:scale-[0.98]/50'
              }`}
            >
              <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                <Icon name="truck" className="w-5 h-5 shrink-0 text-amber-400" />
                {!isSidebarCollapsed && <span className="whitespace-nowrap">Truck Pe Music</span>}
              </div>
              {!isSidebarCollapsed && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">TRUCK BG</span>}
            </button>

            <button
              onClick={() => handleStationSelect('pauwa')}
              title="Pauwa Party"
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'} rounded-2xl font-medium text-xs transition ${
                activeTab === 'pauwa' ? 'bg-amber-600/25 text-emerald-200 border border-orange-500/50 shadow-lg shadow-amber-950/50' : 'text-neutral-400 hover:bg-neutral-800 active:scale-[0.98]/50'
              }`}
            >
              <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                <Icon name="beer" className="w-5 h-5 shrink-0 text-orange-400" />
                {!isSidebarCollapsed && <span className="whitespace-nowrap">Pauwa Party</span>}
              </div>
              {!isSidebarCollapsed && <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-amber-300 font-bold shrink-0">DUAL LIST</span>}
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
          </nav>
        </div>
      </aside>

      <main className={`flex-1 h-full min-h-0 overflow-y-auto p-4 md:p-8 bg-neutral-950 relative w-full transition-all duration-300 ${isPlayerMinimized ? 'pb-24' : 'pb-64'}`}>
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
          <div className="md:hidden relative z-30 mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-md flex items-start justify-between gap-2 text-xs text-amber-200">
            <div className="flex items-start gap-2">
              <Icon name="info" className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p>
                <strong>Mobile Tip:</strong> If audio pauses when switching apps or locking your phone, pull down your notification panel and tap <strong>Play</strong>!
              </p>
            </div>
            <button onClick={() => setShowMobileTip(false)} className="text-amber-400 font-bold text-sm px-1 shrink-0">✕</button>
          </div>
        )}

        <div className="relative z-20 hidden md:flex items-center justify-between pb-6 mb-2 border-b border-white/10 w-full">
          {/* LEFT: TIME */}
          <div className="flex-1 flex justify-start">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 backdrop-blur-md text-xs font-mono text-amber-300 shadow-md">
              <span>⏳</span>
              <span>{clockString || "00:00:00"}</span>
            </div>
          </div>

          {/* CENTER: ACTIVE USERS */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 backdrop-blur-md shadow-lg shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
            </span>
            <span className="text-xs font-semibold text-neutral-200 tracking-wide">
              <span className="text-orange-400 font-bold">{activeUsersCount}</span> Active Users
            </span>
          </div>

          {/* RIGHT: INSTALL APP & AUTH/LOGOUT */}
          <div className="flex-1 flex justify-end items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-white font-medium tracking-wide text-xs shadow-lg animate-pulse transition shrink-0"
            >
              <Icon name="download" className="w-3.5 h-3.5 text-white shrink-0" />
              <span>Install App</span>
            </button>
            
            {user ? (
              <button
                onClick={logout}
                className="flex items-center gap-2 pr-3 pl-1 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white font-medium tracking-wide text-xs shadow-lg transition shrink-0 border border-neutral-700"
                title="Logout"
              >
                <div className="w-7 h-7 rounded-full bg-neutral-950 text-white flex items-center justify-center font-extrabold uppercase text-sm border border-neutral-700">
                  {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>
                <span>Logout</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 hover:shadow-amber-500/20 text-white font-medium tracking-wide text-xs shadow-lg transition shrink-0"
              >
                <Icon name="user" className="w-3.5 h-3.5 shrink-0" />
                <span>Login</span>
              </button>
            )}
          </div>
        </div>

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
            <div className="p-8 rounded-3xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-xl shadow-2xl">
              <h2 className="text-2xl font-display font-extrabold tracking-tight text-white mb-2">Discover & Search Tracks</h2>
              <p className="text-xs text-neutral-400 mb-6">Type a query to load audio tracks. Results display only after searching.</p>
              
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                    <Icon name="search" className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search song, artist, or album..."
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-neutral-900/50 backdrop-blur-lg border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 font-bold text-xs text-white transition shadow-lg shadow-amber-950/50 flex items-center gap-2 shrink-0"
                >
                  {isLoading ? <Icon name="sparkles" className="w-4 h-4 animate-spin shrink-0" /> : <Icon name="search" className="w-4 h-4 shrink-0" />}
                  <span>Search</span>
                </button>
              </form>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-lg font-display font-extrabold tracking-tight text-white">Search Results</h3>
                  <span className="text-xs text-neutral-400">Showing {Math.min(searchVisibleCount, searchResults.length)} of {searchResults.length} songs</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {searchResults.slice(0, searchVisibleCount).map((track, i) => {
                    const isCurrent = currentSong?.id === track.id;
                    return (
                      <div
                        key={track.id + i}
                        onClick={() => playSong(track)}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition backdrop-blur-md ${
                          isCurrent
                            ? 'bg-neutral-900/90 border-amber-500/80 shadow-xl'
                            : 'bg-neutral-900/50 border-neutral-800/70 hover:bg-neutral-900 active:scale-[0.98]/80'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="text-xs font-mono text-neutral-400 w-6 text-center">{i + 1}</span>
                          <img src={(track.thumbnail && track.thumbnail.replace(/(\\?sqp=.*|hq720\\.jpg)/, "hqdefault.jpg")) || "https://ui-avatars.com/api/?name="+encodeURIComponent(track.title)+"&background=random&size=300"} alt="" loading="lazy" className="w-12 h-12 rounded-2xl object-cover shrink-0 shadow-md" onError={(e) => { if(e.target.src.includes('hq720.jpg') || e.target.src.includes('maxresdefault.jpg')){ e.target.src = e.target.src.replace(/(hq720|maxresdefault)\.jpg.*/, 'hqdefault.jpg'); } else if(!e.target.src.includes('ui-avatars')){ e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(track.title) + '&background=random&size=300'; } }} />
                          <div className="min-w-0">
                            <h4 className={`font-bold text-xs truncate ${isCurrent ? 'text-amber-400' : 'text-white'}`}>
                              {track.title}
                            </h4>
                            <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 relative">
      <button onClick={(e) => handleOpenVideo(track, e)} className="p-1.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition flex items-center shrink-0" title="See Video">
        <Icon name="video" className="w-3.5 h-3.5 shrink-0" />
      </button>
      
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          setOpenMenuId(openMenuId === `${track.id}-${i}` ? null : `${track.id}-${i}`); 
        }} 
        className="p-1 text-neutral-500 hover:text-white transition shrink-0"
      >
        <Icon name="moreVertical" className="w-5 h-5 shrink-0" />
      </button>

      {openMenuId === `${track.id}-${i}` && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-neutral-900 rounded-xl shadow-2xl border border-neutral-800 overflow-hidden z-50">
          {currentSong?.id !== track.id && (
            <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
          )}
          <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{likedSongs.some(s => s.id === track.id) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
          <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
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
                      Show More Songs (+10)
                    </button>
                  </div>
                )}
              </div>
            )}

            <DisclaimerFooter />
          </div>
        )}

        {activeTab === 'pauwa' && currentStation && (
          <div className="max-w-5xl mx-auto space-y-8 relative z-10">
            <div className="p-8 rounded-3xl border border-neutral-700/50 relative overflow-hidden shadow-2xl backdrop-blur-md bg-neutral-900/40">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border border-orange-500/40 bg-neutral-900/80 backdrop-blur-xl text-amber-300 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
                    {currentStation.badge}
                  </span>
                  <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-lg">{currentStation.title}</h1>
                  <p className="text-xs md:text-sm text-neutral-200 max-w-xl font-medium drop-shadow">{currentStation.subtitle}</p>
                </div>
              </div>
            </div>

            {stationLoading && (
              <div className="text-center py-6">
                <span className="text-xs text-orange-400 animate-pulse flex items-center justify-center gap-2">
                  <Icon name="sparkles" className="w-4 h-4 animate-spin shrink-0" /> Loading Party & Heartbreak tracks...
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 pb-1 border-b border-orange-500/30">
                  <h3 className="text-md font-extrabold text-amber-300 flex items-center gap-2">
                    <Icon name="beer" className="w-4 h-4 text-orange-400 shrink-0" />
                    <span>🎉 Party Songs</span>
                  </h3>
                  <span className="text-[10px] text-neutral-400 font-mono">{partyTracks.length} tracks</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {partyTracks.map((track, i) => {
                    const isCurrent = currentSong?.id === track.id;
                    return (
                      <div
                        key={track.id + i}
                        onClick={() => playSong(track)}
                        className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition backdrop-blur-md ${
                          isCurrent
                            ? 'bg-neutral-900/90 border-orange-500/80 shadow-xl'
                            : 'bg-neutral-900/50 border-neutral-800/70 hover:bg-neutral-900 active:scale-[0.98]/80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] font-mono text-neutral-500 w-5 text-center">{i + 1}</span>
                          <img src={(track.thumbnail && track.thumbnail.replace(/(\\?sqp=.*|hq720\\.jpg)/, "hqdefault.jpg")) || "https://ui-avatars.com/api/?name="+encodeURIComponent(track.title)+"&background=random&size=300"} alt="" loading="lazy" className="w-10 h-10 rounded-2xl object-cover shrink-0 shadow-md" onError={(e) => { if(e.target.src.includes('hq720.jpg') || e.target.src.includes('maxresdefault.jpg')){ e.target.src = e.target.src.replace(/(hq720|maxresdefault)\.jpg.*/, 'hqdefault.jpg'); } else if(!e.target.src.includes('ui-avatars')){ e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(track.title) + '&background=random&size=300'; } }} />
                          <div className="min-w-0">
                            <h4 className={`font-bold text-xs truncate ${isCurrent ? 'text-orange-400' : 'text-white'}`}>
                              {track.title}
                            </h4>
                            <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 relative">
      <button onClick={(e) => handleOpenVideo(track, e)} className="p-1.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition flex items-center shrink-0" title="See Video">
        <Icon name="video" className="w-3.5 h-3.5 shrink-0" />
      </button>
      
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          setOpenMenuId(openMenuId === `${track.id}-${i}` ? null : `${track.id}-${i}`); 
        }} 
        className="p-1 text-neutral-500 hover:text-white transition shrink-0"
      >
        <Icon name="moreVertical" className="w-5 h-5 shrink-0" />
      </button>

      {openMenuId === `${track.id}-${i}` && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-neutral-900 rounded-xl shadow-2xl border border-neutral-800 overflow-hidden z-50">
          {currentSong?.id !== track.id && (
            <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
          )}
          <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{likedSongs.some(s => s.id === track.id) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
          <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
        </div>
      )}
    </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 pb-1 border-b border-pink-500/30">
                  <h3 className="text-md font-extrabold text-pink-300 flex items-center gap-2">
                    <Icon name="heart" className="w-4 h-4 text-pink-400 shrink-0" />
                    <span>💔 Heartbreak Songs</span>
                  </h3>
                  <span className="text-[10px] text-neutral-400 font-mono">{heartbreakTracks.length} tracks</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {heartbreakTracks.map((track, i) => {
                    const isCurrent = currentSong?.id === track.id;
                    return (
                      <div
                        key={track.id + i}
                        onClick={() => playSong(track)}
                        className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition backdrop-blur-md ${
                          isCurrent
                            ? 'bg-neutral-900/90 border-pink-500/80 shadow-xl'
                            : 'bg-neutral-900/50 border-neutral-800/70 hover:bg-neutral-900 active:scale-[0.98]/80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] font-mono text-neutral-500 w-5 text-center">{i + 1}</span>
                          <img src={(track.thumbnail && track.thumbnail.replace(/(\\?sqp=.*|hq720\\.jpg)/, "hqdefault.jpg")) || "https://ui-avatars.com/api/?name="+encodeURIComponent(track.title)+"&background=random&size=300"} alt="" loading="lazy" className="w-10 h-10 rounded-2xl object-cover shrink-0 shadow-md" onError={(e) => { if(e.target.src.includes('hq720.jpg') || e.target.src.includes('maxresdefault.jpg')){ e.target.src = e.target.src.replace(/(hq720|maxresdefault)\.jpg.*/, 'hqdefault.jpg'); } else if(!e.target.src.includes('ui-avatars')){ e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(track.title) + '&background=random&size=300'; } }} />
                          <div className="min-w-0">
                            <h4 className={`font-bold text-xs truncate ${isCurrent ? 'text-pink-400' : 'text-white'}`}>
                              {track.title}
                            </h4>
                            <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 relative">
      <button onClick={(e) => handleOpenVideo(track, e)} className="p-1.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition flex items-center shrink-0" title="See Video">
        <Icon name="video" className="w-3.5 h-3.5 shrink-0" />
      </button>
      
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          setOpenMenuId(openMenuId === `${track.id}-${i}` ? null : `${track.id}-${i}`); 
        }} 
        className="p-1 text-neutral-500 hover:text-white transition shrink-0"
      >
        <Icon name="moreVertical" className="w-5 h-5 shrink-0" />
      </button>

      {openMenuId === `${track.id}-${i}` && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-neutral-900 rounded-xl shadow-2xl border border-neutral-800 overflow-hidden z-50">
          {currentSong?.id !== track.id && (
            <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
          )}
          <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{likedSongs.some(s => s.id === track.id) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
          <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
        </div>
      )}
    </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <DisclaimerFooter />
          </div>
        )}

                        {activeTab === 'home' && (
                    <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8 space-y-12">
            <ScrollableRow
              title="Trending songs"
              subtitle="The most played hits right now"
              items={trendingSongs}
              showAll={showAllTrending}
              setShowAll={setShowAllTrending}
              renderItem={(song) => (
                <div onClick={() => handlePlayTrending(song.query || song.title, song)} className="group cursor-pointer">
                  <div className="relative mb-3">
                    <img src={song.image || "https://ui-avatars.com/api/?name="+encodeURIComponent(song.title)+"&background=random&size=300"} alt={song.title} className="w-full aspect-square rounded-md object-cover shadow-lg group-hover:shadow-amber-500/20 transition-all duration-300" onError={(e) => { e.target.src = "https://ui-avatars.com/api/?name="+encodeURIComponent(song.title)+"&background=random&size=300"; }} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                      <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition">
                        <Icon name="play" className="w-5 h-5 text-neutral-950 translate-x-[2px]" />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-400 transition">{song.title}</h3>
                  <p className="text-xs text-neutral-400 truncate mt-1">{song.artist}</p>
                </div>
              )}
            />

            <ScrollableRow
              title="Popular artists"
              subtitle="Find your favorite singers"
              items={POPULAR_ARTISTS}
              showAll={showAllArtists}
              setShowAll={setShowAllArtists}
              renderItem={(artist) => (
                <div onClick={() => handleArtistClick(artist.name)} className="group cursor-pointer flex flex-col items-center">
                  <div className="relative mb-3 w-32 h-32 md:w-full md:aspect-square rounded-full overflow-hidden shadow-lg border-2 border-transparent group-hover:border-amber-500 transition-all duration-300">
                    <img src={artist.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.name)}&background=random&size=300`} alt={artist.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.name)}&background=random&size=300`; }} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <Icon name="search" className="w-8 h-8 text-white drop-shadow-md transform scale-90 group-hover:scale-100 transition" />
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white truncate w-full text-center group-hover:text-amber-400 transition">{artist.name}</h3>
                  <p className="text-xs text-neutral-400 truncate mt-1 w-full text-center">{artist.role}</p>
                </div>
              )}
            />

            <ScrollableRow
              title="Popular albums and singles"
              subtitle="Latest releases"
              items={popularAlbums}
              showAll={showAllAlbums}
              setShowAll={setShowAllAlbums}
              renderItem={(album) => (
                <div onClick={() => handlePlayTrending(album.query || album.title, album)} className="group cursor-pointer">
                  <div className="relative mb-3">
                    <img src={album.image || "https://ui-avatars.com/api/?name="+encodeURIComponent(album.title)+"&background=random&size=300"} alt={album.title} className="w-full aspect-square rounded-md object-cover shadow-lg group-hover:shadow-amber-500/20 transition-all duration-300" onError={(e) => { e.target.src = "https://ui-avatars.com/api/?name="+encodeURIComponent(album.title)+"&background=random&size=300"; }} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                      <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition">
                        <Icon name="play" className="w-5 h-5 text-neutral-950 translate-x-[2px]" />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-400 transition">{album.title}</h3>
                  <p className="text-xs text-neutral-400 truncate mt-1">{album.artist}</p>
                </div>
              )}
            />

            <ScrollableRow
              title="Popular radio"
              subtitle="Live streams 24/7"
              items={popularRadio}
              showAll={showAllRadio}
              setShowAll={setShowAllRadio}
              renderItem={(radio) => (
                <div onClick={() => handlePlayTrending(radio.query || radio.title, radio)} className="group cursor-pointer">
                  <div className="relative mb-3">
                    <img src={radio.image || "https://ui-avatars.com/api/?name="+encodeURIComponent(radio.title)+"&background=random&size=300"} alt={radio.title} className="w-full aspect-square rounded-md object-cover shadow-lg group-hover:shadow-amber-500/20 transition-all duration-300" onError={(e) => { e.target.src = "https://ui-avatars.com/api/?name="+encodeURIComponent(radio.title)+"&background=random&size=300"; }} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                      <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition">
                        <Icon name="play" className="w-5 h-5 text-neutral-950 translate-x-[2px]" />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-400 transition">{radio.title}</h3>
                  <p className="text-xs text-neutral-400 truncate mt-1">{radio.artist}</p>
                </div>
              )}
            />

          </div>
        )}

        {['barber', 'truck'].includes(activeTab) && currentStation && (
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            <div className="p-8 rounded-3xl border border-neutral-700/50 relative overflow-hidden shadow-2xl backdrop-blur-md bg-neutral-900/40">
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
              <div className="grid grid-cols-1 gap-2">
                {songs.map((track, i) => {
                  const isCurrent = currentSong?.id === track.id;
                  return (
                    <div
                      key={track.id + i}
                      onClick={() => playSong(track)}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition backdrop-blur-md ${
                        isCurrent
                          ? 'bg-neutral-900/90 border-amber-500/80 shadow-xl'
                          : 'bg-neutral-900/50 border-neutral-800/70 hover:bg-neutral-900 active:scale-[0.98]/80'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="text-xs font-mono text-neutral-400 w-6 text-center">{i + 1}</span>
                        <img src={(track.thumbnail && track.thumbnail.replace(/(\\?sqp=.*|hq720\\.jpg)/, "hqdefault.jpg")) || "https://ui-avatars.com/api/?name="+encodeURIComponent(track.title)+"&background=random&size=300"} alt="" loading="lazy" className="w-12 h-12 rounded-2xl object-cover shrink-0 shadow-md" onError={(e) => { if(e.target.src.includes('hq720.jpg') || e.target.src.includes('maxresdefault.jpg')){ e.target.src = e.target.src.replace(/(hq720|maxresdefault)\.jpg.*/, 'hqdefault.jpg'); } else if(!e.target.src.includes('ui-avatars')){ e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(track.title) + '&background=random&size=300'; } }} />
                        <div className="min-w-0">
                          <h4 className={`font-bold text-xs truncate ${isCurrent ? 'text-amber-400' : 'text-white'}`}>
                            {track.title}
                          </h4>
                          <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 relative">
      <button onClick={(e) => handleOpenVideo(track, e)} className="p-1.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition flex items-center shrink-0" title="See Video">
        <Icon name="video" className="w-3.5 h-3.5 shrink-0" />
      </button>
      
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          setOpenMenuId(openMenuId === `${track.id}-${i}` ? null : `${track.id}-${i}`); 
        }} 
        className="p-1 text-neutral-500 hover:text-white transition shrink-0"
      >
        <Icon name="moreVertical" className="w-5 h-5 shrink-0" />
      </button>

      {openMenuId === `${track.id}-${i}` && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-neutral-900 rounded-xl shadow-2xl border border-neutral-800 overflow-hidden z-50">
          {currentSong?.id !== track.id && (
            <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
          )}
          <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{likedSongs.some(s => s.id === track.id) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
          <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
        </div>
      )}
    </div>
                    </div>
                  );
                })}
              </div>
            )}

            <DisclaimerFooter />
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
                likedSongs.map((track, i) => (
                  <div key={track.id + i} onClick={() => playSong(track)} className="p-3.5 rounded-2xl border bg-neutral-900/50 border-neutral-800 flex items-center justify-between cursor-pointer hover:bg-neutral-900 active:scale-[0.98] transition">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img src={(track.thumbnail && track.thumbnail.replace(/(\\?sqp=.*|hq720\\.jpg)/, "hqdefault.jpg")) || "https://ui-avatars.com/api/?name="+encodeURIComponent(track.title)+"&background=random&size=300"} alt="" loading="lazy" className="w-12 h-12 rounded-2xl object-cover shrink-0" onError={(e) => { if(e.target.src.includes('hq720.jpg') || e.target.src.includes('maxresdefault.jpg')){ e.target.src = e.target.src.replace(/(hq720|maxresdefault)\.jpg.*/, 'hqdefault.jpg'); } else if(!e.target.src.includes('ui-avatars')){ e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(track.title) + '&background=random&size=300'; } }} />
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-white truncate">{track.title}</h4>
                        <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 relative">
      <button onClick={(e) => handleOpenVideo(track, e)} className="p-1.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition flex items-center shrink-0" title="See Video">
        <Icon name="video" className="w-3.5 h-3.5 shrink-0" />
      </button>
      
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          setOpenMenuId(openMenuId === `${track.id}-${i}` ? null : `${track.id}-${i}`); 
        }} 
        className="p-1 text-neutral-500 hover:text-white transition shrink-0"
      >
        <Icon name="moreVertical" className="w-5 h-5 shrink-0" />
      </button>

      {openMenuId === `${track.id}-${i}` && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-neutral-900 rounded-xl shadow-2xl border border-neutral-800 overflow-hidden z-50">
          {currentSong?.id !== track.id && (
            <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
          )}
          <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{likedSongs.some(s => s.id === track.id) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
          <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
        </div>
      )}
    </div>
                  </div>
                ))
              )}
            </div>
            <DisclaimerFooter />
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
                history.map((track, i) => (
                  <div key={track.id + i} onClick={() => playSong(track)} className="p-3.5 rounded-2xl border bg-neutral-900/50 border-neutral-800 flex items-center justify-between cursor-pointer hover:bg-neutral-900 active:scale-[0.98] transition">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img src={(track.thumbnail && track.thumbnail.replace(/(\\?sqp=.*|hq720\\.jpg)/, "hqdefault.jpg")) || "https://ui-avatars.com/api/?name="+encodeURIComponent(track.title)+"&background=random&size=300"} alt="" loading="lazy" className="w-12 h-12 rounded-2xl object-cover shrink-0" onError={(e) => { if(e.target.src.includes('hq720.jpg') || e.target.src.includes('maxresdefault.jpg')){ e.target.src = e.target.src.replace(/(hq720|maxresdefault)\.jpg.*/, 'hqdefault.jpg'); } else if(!e.target.src.includes('ui-avatars')){ e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(track.title) + '&background=random&size=300'; } }} />
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-white truncate">{track.title}</h4>
                        <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleOpenVideo(track, e)}
                        className="p-1.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition flex items-center text-[10px] shrink-0"
                      >
                        <Icon name="video" className="w-3.5 h-3.5 shrink-0" />
                      </button>
                      <div className="relative">
                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === `${track.id}-${i}` ? null : `${track.id}-${i}`); }} className="p-1.5 rounded-2xl hover:bg-white/10 text-neutral-400 transition flex items-center shrink-0">
                          <Icon name="moreVertical" className="w-4 h-4 shrink-0" />
                        </button>
                        {openMenuId === `${track.id}-${i}` && (
                          <div className="absolute right-0 top-full mt-2 w-40 bg-neutral-900 rounded-xl shadow-2xl border border-neutral-800 overflow-hidden z-50">
                            <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
                            <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{likedSongs.some(s => s.id === track.id) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
                            <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <DisclaimerFooter />
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
                    selectedPlaylistForView.songs.map((track, i) => (
                      <div key={track.id + i} onClick={() => playSong(track)} className="p-3.5 rounded-2xl border bg-neutral-900/50 border-neutral-800 flex items-center justify-between cursor-pointer hover:bg-neutral-900 active:scale-[0.98] transition group">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img src={(track.thumbnail && track.thumbnail.replace(/(\\?sqp=.*|hq720\\.jpg)/, "hqdefault.jpg")) || "https://ui-avatars.com/api/?name="+encodeURIComponent(track.title)+"&background=random&size=300"} alt="" loading="lazy" className="w-12 h-12 rounded-2xl object-cover shrink-0" onError={(e) => { if(e.target.src.includes('hq720.jpg') || e.target.src.includes('maxresdefault.jpg')){ e.target.src = e.target.src.replace(/(hq720|maxresdefault)\.jpg.*/, 'hqdefault.jpg'); } else if(!e.target.src.includes('ui-avatars')){ e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(track.title) + '&background=random&size=300'; } }} />
                          <div className="min-w-0 pr-4">
                            <h4 className="font-bold text-sm text-white truncate group-hover:text-amber-400 transition">{track.title}</h4>
                            <p className="text-[11px] text-amber-500/80 truncate mt-0.5">{track.channel}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition relative">
      
      
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          setOpenMenuId(openMenuId === `${track.id}-${i}` ? null : `${track.id}-${i}`); 
        }} 
        className="p-1 text-neutral-500 hover:text-white transition shrink-0"
      >
        <Icon name="moreVertical" className="w-5 h-5 shrink-0" />
      </button>

      {openMenuId === `${track.id}-${i}` && (
        <div className="absolute right-0 top-full mt-2 w-40 bg-neutral-900 rounded-xl shadow-2xl border border-neutral-800 overflow-hidden z-50">
          {currentSong?.id !== track.id && (
            <button onClick={(e) => { e.stopPropagation(); queue.some(s=>s.id===track.id) ? removeFromQueue(track.id) : addToQueue(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">{queue.some(s=>s.id===track.id) ? 'Remove from Queue' : 'Add to Queue'}</button>
          )}
          <button onClick={(e) => { e.stopPropagation(); toggleLike(track); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition">{likedSongs.some(s => s.id === track.id) ? 'Remove from Favourite' : 'Add to Favourite'}</button>
          <button onClick={(e) => { e.stopPropagation(); handleAddToPlaylistClick(track, e); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition">Add to Playlist</button>
        </div>
      )}
    </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

      </main>

      {currentSong && (
        <footer className={`fixed bottom-0 right-0 z-40 bg-neutral-900/95 backdrop-blur-2xl border-t border-neutral-800/80 transition-all duration-300 shadow-2xl left-0 ${isSidebarCollapsed ? 'md:left-20' : 'md:left-64'} ${isPlayerMinimized ? 'p-2' : 'p-3 md:p-4'}`}>
          <div className="absolute -top-3.5 right-6 z-50 shrink-0">
            <button
              onClick={() => setIsPlayerMinimized(!isPlayerMinimized)}
              className="px-3 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-amber-400 text-[10px] font-bold shadow-lg flex items-center gap-1 transition shrink-0 cursor-pointer"
            >
              <Icon name={isPlayerMinimized ? "chevronUp" : "chevronDown"} className="w-3.5 h-3.5 shrink-0" />
              <span>{isPlayerMinimized ? "Expand Player" : "Minimize"}</span>
            </button>
          </div>

          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-1/4 min-w-0">
              <img src={(currentSong.thumbnail && currentSong.thumbnail.replace(/(\\?sqp=.*|hq720\\.jpg)/, "hqdefault.jpg")) || "https://ui-avatars.com/api/?name="+encodeURIComponent(currentSong.title)+"&background=random&size=300"} alt="" className={`rounded-2xl object-cover shrink-0 shadow-md transition-all duration-300 ${isPlayerMinimized ? 'w-8 h-8' : 'w-12 h-12'}`} onError={(e) => { if(e.target.src.includes('hq720.jpg') || e.target.src.includes('maxresdefault.jpg')){ e.target.src = e.target.src.replace(/(hq720|maxresdefault)\.jpg.*/, 'hqdefault.jpg'); } else if(!e.target.src.includes('ui-avatars')){ e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentSong.title) + '&background=random&size=300'; } }} />
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-xs text-white truncate">{currentSong.title}</h4>
                <p className="text-[10px] text-amber-400 truncate">{currentSong.channel}</p>
              </div>
              {!isPlayerMinimized && (
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button onClick={(e) => handleAddToPlaylistClick(currentSong, e)} className="text-neutral-500 hover:text-amber-500 transition p-1 shrink-0" title="Add to Playlist">
                    <Icon name="plus" className="w-4 h-4 shrink-0" />
                  </button>
                  <button onClick={() => setShowQueuePanel(!showQueuePanel)} className="text-neutral-500 hover:text-amber-500 transition p-1 shrink-0" title="View Queue">
                    <Icon name="list" className="w-4 h-4 shrink-0" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); toggleLike(currentSong); }} className="text-neutral-500 hover:text-pink-500 transition p-1 shrink-0" title="Like">
                    <Icon name={likedSongs.some(s => s.id === currentSong.id) ? "heart" : "heartOutline"} className="w-4 h-4 text-pink-500 shrink-0" />
                  </button>
                </div>
              )}
            </div>

            {!isPlayerMinimized && (
              <div className="flex flex-col items-center w-full md:w-2/4 gap-1.5 animate-fadeIn">
                <div className="flex items-center gap-4 shrink-0">
                  <button onClick={() => setIsShuffle(!isShuffle)} className={`transition ${isShuffle ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`} title={isShuffle ? "Shuffle On" : "Shuffle Off"}>
                    <Icon name="shuffle" className="w-4 h-4 shrink-0" />
                  </button>
                  <button onClick={handlePrevSong} className="text-neutral-300 hover:text-white transition" title="Previous Track">
                    <Icon name="skipPrev" className="w-5 h-5 shrink-0" />
                  </button>
                  <button onClick={togglePlayPause} className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 hover:shadow-amber-500/20 text-white flex items-center justify-center shadow-lg transition shrink-0">
                    <Icon name={isPlaying ? "pause" : "play"} className="w-5 h-5 shrink-0" />
                  </button>
                  <button onClick={handleNextSong} className="text-neutral-300 hover:text-white transition" title="Next Track">
                    <Icon name="skipNext" className="w-5 h-5 shrink-0" />
                  </button>
                  <button 
                    onClick={toggleRepeatMode} 
                    className={`relative transition ${isRepeat ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`} 
                    title={isRepeat === 'one' ? 'Repeat One' : isRepeat === 'all' ? 'Repeat All' : 'Repeat Off'}
                  >
                    <Icon name="repeat" className="w-4 h-4 shrink-0" />
                    {isRepeat === 'one' && (
                      <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-amber-500 text-white rounded-full w-3 h-3 flex items-center justify-center">1</span>
                    )}
                  </button>
                </div>

                <PlayerProgress playerRef={playerRef} isPlaying={isPlaying} onSeek={handleSeek} />
              </div>
            )}

            {isPlayerMinimized && (
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={handlePrevSong} className="text-neutral-300 hover:text-white transition shrink-0" title="Previous Track">
                  <Icon name="skipPrev" className="w-4 h-4 shrink-0" />
                </button>
                <button onClick={togglePlayPause} className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 hover:shadow-amber-500/20 text-white flex items-center justify-center shadow-md transition shrink-0">
                  <Icon name={isPlaying ? "pause" : "play"} className="w-4 h-4 shrink-0" />
                </button>
                <button onClick={handleNextSong} className="text-neutral-300 hover:text-white transition shrink-0" title="Next Track">
                  <Icon name="skipNext" className="w-4 h-4 shrink-0" />
                </button>
              </div>
            )}

            <div className="hidden md:flex items-center justify-end w-1/4 gap-2 shrink-0">
              {!isPlayerMinimized && (
                <>
                  <button
                    onClick={(e) => handleOpenVideo(currentSong, e)}
                    className="px-3 py-1.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 transition flex items-center gap-1.5 text-xs font-bold shrink-0"
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
                </>
              )}
            </div>
          </div>
        </footer>
      )}

      {showQueuePanel && (
        <div className="fixed inset-0 z-[40] bg-neutral-950 flex flex-col md:flex-row overflow-hidden animate-fadeIn pb-24 md:pb-0">
          <button onClick={() => setShowQueuePanel(false)} className="absolute top-6 right-6 text-neutral-400 hover:text-white z-50 bg-neutral-900/50 p-2 rounded-full backdrop-blur-md">
            <Icon name="close" className="w-6 h-6" />
          </button>

          <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col justify-center items-center bg-gradient-to-br from-neutral-900 to-neutral-950 border-r border-neutral-800/50 overflow-y-auto hide-scrollbar">
            {currentSong ? (
              <div className="w-full max-w-sm flex flex-col items-center my-auto">
                {/* Artwork */}
                <div className="relative w-52 h-52 sm:w-64 sm:h-64 md:w-72 md:h-72 aspect-square mb-5 shadow-2xl rounded-3xl overflow-hidden group border border-neutral-800/80 shrink-0">
                  <img src={(currentSong.thumbnail && currentSong.thumbnail.replace(/(\\?sqp=.*|hq720\\.jpg)/, "maxresdefault.jpg")) || "https://ui-avatars.com/api/?name="+encodeURIComponent(currentSong.title)+"&background=random&size=600"} 
                    alt={currentSong.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    onError={(e) => { 
                      if(e.target.src.includes('hq720.jpg') || e.target.src.includes('maxresdefault.jpg')){ 
                        e.target.src = e.target.src.replace(/(hq720|maxresdefault)\.jpg.*/, 'hqdefault.jpg'); 
                      } 
                    }} 
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500"></div>
                </div>

                {/* Song Meta & Actions */}
                <div className="w-full text-center space-y-1 mb-4">
                  <h2 className="text-xl sm:text-2xl font-display font-bold text-white line-clamp-1 leading-tight">{currentSong.title}</h2>
                  <p className="text-sm text-amber-500 font-medium truncate">{currentSong.channel}</p>
                  
                  {/* Secondary buttons */}
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleLike(currentSong); }} 
                      className="p-2 rounded-full bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-pink-500 transition shadow" 
                      title={likedSongs.some(s => s.id === currentSong.id) ? "Remove from Favourite" : "Add to Favourite"}
                    >
                      <Icon name={likedSongs.some(s => s.id === currentSong.id) ? "heart" : "heartOutline"} className="w-4 h-4 text-pink-500" />
                    </button>
                    <button 
                      onClick={(e) => handleAddToPlaylistClick(currentSong, e)} 
                      className="p-2 rounded-full bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 transition shadow" 
                      title="Add to Playlist"
                    >
                      <Icon name="plus" className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleOpenVideo(currentSong, e)} 
                      className="p-2 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 transition shadow" 
                      title="Watch Video"
                    >
                      <Icon name="video" className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full mb-4 px-1">
                  <PlayerProgress playerRef={playerRef} isPlaying={isPlaying} onSeek={handleSeek} />
                </div>

                {/* Main Playback Controls */}
                <div className="flex items-center justify-center gap-6 w-full mb-4">
                  <button 
                    onClick={() => setIsShuffle(!isShuffle)} 
                    className={`p-2 transition ${isShuffle ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`} 
                    title={isShuffle ? "Shuffle On" : "Shuffle Off"}
                  >
                    <Icon name="shuffle" className="w-4 h-4" />
                  </button>
                  
                  <button 
                    onClick={handlePrevSong} 
                    className="p-2 text-neutral-300 hover:text-white hover:scale-110 active:scale-95 transition" 
                    title="Previous Track"
                  >
                    <Icon name="skipPrev" className="w-6 h-6" />
                  </button>
                  
                  <button 
                    onClick={togglePlayPause} 
                    className="w-13 h-13 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 hover:shadow-amber-500/30 text-white flex items-center justify-center shadow-xl transition"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    <Icon name={isPlaying ? "pause" : "play"} className="w-6 h-6" />
                  </button>
                  
                  <button 
                    onClick={handleNextSong} 
                    className="p-2 text-neutral-300 hover:text-white hover:scale-110 active:scale-95 transition" 
                    title="Next Track"
                  >
                    <Icon name="skipNext" className="w-6 h-6" />
                  </button>
                  
                  <button 
                    onClick={toggleRepeatMode} 
                    className={`relative p-2 transition ${isRepeat ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`} 
                    title={isRepeat === 'one' ? 'Repeat One' : isRepeat === 'all' ? 'Repeat All' : 'Repeat Off'}
                  >
                    <Icon name="repeat" className="w-4 h-4" />
                    {isRepeat === 'one' && (
                      <span className="absolute top-1 right-1 text-[8px] font-bold bg-amber-500 text-white rounded-full w-3 h-3 flex items-center justify-center">1</span>
                    )}
                  </button>
                </div>

                {/* Volume Slider */}
                <div className="flex items-center gap-3 w-full max-w-xs justify-center px-4 py-1.5 rounded-2xl bg-neutral-900/50 border border-neutral-800/50">
                  <Icon name="volume" className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="flex-1 h-1 bg-neutral-800 rounded-xl appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-[10px] font-mono text-neutral-400 w-7 text-right">{volume}%</span>
                </div>
              </div>
            ) : (
              <div className="text-neutral-500 text-lg flex flex-col items-center gap-3">
                <Icon name="music" className="w-12 h-12 text-neutral-700" />
                <span>No song playing</span>
              </div>
            )}
          </div>

          <div className="w-full md:w-1/2 bg-neutral-900/30 backdrop-blur-3xl overflow-y-auto hide-scrollbar pb-32">
            <div className="p-6 md:p-12 mt-8 md:mt-0">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-display font-bold text-white flex items-center gap-3">
                  <Icon name="list" className="w-6 h-6 text-amber-500" />
                  Up Next
                </h3>
                <span className="text-xs font-medium bg-neutral-800 text-neutral-400 px-3 py-1 rounded-full">{queue.length} tracks</span>
              </div>
              
              <div className="space-y-2">
                {queue.map((track, idx) => {
                  const isCurrent = currentSong?.id === track.id;
                  return (
                    <div 
                      key={`${track.id}-${idx}`}
                      onClick={() => { playSong(track); }}
                      className={`group flex items-center gap-4 p-3 rounded-2xl transition-all cursor-pointer ${isCurrent ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-neutral-800/50 border border-transparent hover:border-neutral-700/50'}`}
                    >
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md">
                        <img src={track.thumbnail?.replace(/(\\?sqp=.*|hq720\\.jpg)/, "hqdefault.jpg")} alt="" className="w-full h-full object-cover" />
                        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isCurrent ? 'opacity-100' : ''}`}>
                          <Icon name={isCurrent && isPlaying ? "pause" : "play"} className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-medium text-sm truncate ${isCurrent ? 'text-amber-500' : 'text-white'}`}>{track.title}</h4>
                        <p className="text-xs text-neutral-400 truncate">{track.channel}</p>
                      </div>
                      {track.duration && (
                        <span className="text-xs text-neutral-500 font-mono shrink-0">{track.duration}</span>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeFromQueue(track.id); }} 
                        className="text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition p-2 shrink-0" 
                        title="Remove from Queue"
                      >
                        <Icon name="close" className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                {queue.length === 0 && (
                  <div className="text-center py-12">
                    <Icon name="music" className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                    <p className="text-neutral-500">Your queue is empty</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 w-full max-w-sm relative shadow-2xl">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white transition">
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
                  autoComplete="current-password"
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
                onError={() => setAuthError('Google Login Failed')}
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
                <img src={(selectedSongForPlaylist.thumbnail && selectedSongForPlaylist.thumbnail.replace(/(\\?sqp=.*|hq720\\.jpg)/, "hqdefault.jpg")) || "https://ui-avatars.com/api/?name="+encodeURIComponent(selectedSongForPlaylist.title)+"&background=random&size=300"} className="w-10 h-10 rounded object-cover" alt="" onError={(e) => { if(e.target.src.includes('hq720.jpg') || e.target.src.includes('maxresdefault.jpg')){ e.target.src = e.target.src.replace(/(hq720|maxresdefault)\.jpg.*/, 'hqdefault.jpg'); } else if(!e.target.src.includes('ui-avatars')){ e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedSongForPlaylist.title) + '&background=random&size=300'; } }} />
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
    </div>
  );
}


















