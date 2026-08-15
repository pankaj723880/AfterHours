import React, { useState, useEffect, useRef, useCallback } from 'react';

// ==========================================
// YOUTUBE API ROTATION MANAGER
// ==========================================
const YOUTUBE_API_KEYS = [
  import.meta.env.VITE_YOUTUBE_KEY_1,
  import.meta.env.VITE_YOUTUBE_KEY_2,
  import.meta.env.VITE_YOUTUBE_KEY_3,
].filter(Boolean);

let currentApiKeyIndex = parseInt(localStorage.getItem('yt_key_index') || '0', 10);

const getActiveApiKey = () => {
  if (YOUTUBE_API_KEYS.length === 0) return '';
  return YOUTUBE_API_KEYS[currentApiKeyIndex % YOUTUBE_API_KEYS.length];
};

const rotateApiKey = () => {
  if (YOUTUBE_API_KEYS.length === 0) return;
  currentApiKeyIndex = (currentApiKeyIndex + 1) % YOUTUBE_API_KEYS.length;
  localStorage.setItem('yt_key_index', currentApiKeyIndex.toString());
};

const fetchWithKeyRotation = async (urlGenerator) => {
  if (YOUTUBE_API_KEYS.length === 0) {
    throw new Error("No YouTube API keys provided in environment variables.");
  }
  let attempts = 0;
  while (attempts < YOUTUBE_API_KEYS.length) {
    const apiKey = getActiveApiKey();
    const url = urlGenerator(apiKey);
    try {
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.error && (data.error.code === 403 || data.error.message?.includes('quota') || data.error.errors?.[0]?.reason === 'quotaExceeded')) {
        rotateApiKey();
        attempts++;
        continue;
      }
      return data;
    } catch (err) {
      rotateApiKey();
      attempts++;
    }
  }
  throw new Error("All YouTube API keys have exhausted their daily quotas or failed.");
};

const Icon = ({ name, className = "w-5 h-5", ...props }) => {
  const icons = {
    play: <path d="M5 3l14 9-14 9V3z" fill="currentColor" />,
    pause: <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor" />,
    skipNext: <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor" />,
    skipPrev: <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" fill="currentColor" />,
    search: <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor" />,
    heart: <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" />,
    heartOutline: <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" fill="currentColor" />,
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
    expand: <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="currentColor" />,
    collapse: <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" fill="currentColor" />,
    menu: <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="currentColor" />,
    close: <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="currentColor" />,
    external: <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" fill="currentColor" />,
    chevronUp: <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" fill="currentColor" />,
    chevronDown: <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" fill="currentColor" />,
    download: <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor" />,
    info: <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor" />,
    home: <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" />,
    video: <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c0 .55.45-1 1-1v-3.5l4 4v-11l-4 4z" fill="currentColor" />
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
  home: {
    id: "home",
    title: "Continuous Radio Stream",
    subtitle: "Always-on automated playlist playing trending mix & evergreen hits uninterruptedly",
    badge: "📻 Radio Home • Non-Stop Live Audio",
    bgImages: [
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1600&auto=format&fit=crop"
    ],
    queries: ["bollywood top hits trending jukebox"]
  },
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

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [likedSongs, setLikedSongs] = useState(() => JSON.parse(localStorage.getItem('liked_songs') || '[]'));
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('history_songs') || '[]'));

  const [searchCache, setSearchCache] = useState(() => JSON.parse(localStorage.getItem('youtube_search_cache') || '{}'));
  const [stationCache, setStationCache] = useState(() => JSON.parse(localStorage.getItem('youtube_station_cache') || '{}'));

  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [volume, setVolume] = useState(80);

  const [partyTracks, setPartyTracks] = useState([]);
  const [heartbreakTracks, setHeartbreakTracks] = useState([]);
  
  const [stationLoading, setStationLoading] = useState(false);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);
  const [showMobileTip, setShowMobileTip] = useState(true);

  // Dedicated Video Modal & PiP State
  const [videoModalSong, setVideoModalSong] = useState(null);
  const [isPipActive, setIsPipActive] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [songs, setSongs] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchVisibleCount, setSearchVisibleCount] = useState(10);
  const [queue, setQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [clockString, setClockString] = useState("");
  const [activeUsersCount, setActiveUsersCount] = useState(742);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  const playerRef = useRef(null);
  const silentAudioRef = useRef(null);

  useEffect(() => localStorage.setItem('liked_songs', JSON.stringify(likedSongs)), [likedSongs]);
  useEffect(() => localStorage.setItem('history_songs', JSON.stringify(history)), [history]);
  useEffect(() => localStorage.setItem('youtube_search_cache', JSON.stringify(searchCache)), [searchCache]);
  useEffect(() => localStorage.setItem('youtube_station_cache', JSON.stringify(stationCache)), [stationCache]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User installed the PWA');
    }
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
    const userInterval = setInterval(() => {
      setActiveUsersCount(prev => Math.max(500, prev + Math.floor(Math.random() * 7) - 3));
    }, 6000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(userInterval);
    };
  }, []);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  const handleNextSong = useCallback(() => {
    if (queue.length === 0) return;
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * queue.length);
      playSong(queue[randomIndex]);
      return;
    }
    const currentIndex = queue.findIndex(s => s.id === currentSong?.id);
    const nextIdx = (currentIndex + 1) % queue.length;
    playSong(queue[nextIdx]);
  }, [queue, isShuffle, currentSong]);

  const handlePrevSong = useCallback(() => {
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === currentSong?.id);
    const prevIdx = currentIndex - 1 >= 0 ? currentIndex - 1 : queue.length - 1;
    playSong(queue[prevIdx]);
  }, [queue, currentSong]);

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
          setCurrentTime(details.seekTime);
        }
      });
    }
  }, [currentSong, handlePrevSong, handleNextSong]);

  useEffect(() => {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1,
          position: Math.min(currentTime, duration)
        });
      } catch (e) {}
    }
  }, [currentTime, duration]);

  const startSilentAudio = () => {
    if (silentAudioRef.current) {
      silentAudioRef.current.play().catch(() => {});
    }
  };

  const playSong = useCallback((song) => {
    if (!song) return;
    startSilentAudio();

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
  }, [activeTab]);

  useEffect(() => {
    if (!currentSong) return;

    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      playerRef.current.loadVideoById({ videoId: currentSong.id });
      playerRef.current.playVideo();
      setIsPlaying(true);
    } else if (window.YT && window.YT.Player) {
      playerRef.current = new window.YT.Player('yt-player-instance', {
        height: '100%',
        width: '100%',
        videoId: currentSong.id,
        playerVars: { 
          autoplay: 1, 
          controls: 0, 
          disablekb: 1, 
          modestbranding: 1,
          enablejsapi: 1,
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (e) => {
            e.target.setVolume(volume);
            e.target.playVideo();
            setIsPlaying(true);
          },
          onStateChange: (e) => {
            if (e.data === 1) {
              setIsPlaying(true);
              if (silentAudioRef.current) silentAudioRef.current.play().catch(() => {});
              if (playerRef.current?.getDuration) setDuration(playerRef.current.getDuration());
            } else if (e.data === 2) {
              setIsPlaying(false);
            } else if (e.data === 0) {
              if (isRepeat) {
                playerRef.current?.seekTo?.(0, true);
                playerRef.current?.playVideo?.();
              } else {
                handleNextSong();
              }
            }
          }
        }
      });
    }

    setHistory(prev => [currentSong, ...prev.filter(s => s.id !== currentSong.id)].slice(0, 50));
  }, [currentSong, isRepeat, handleNextSong]);

  useEffect(() => {
    let interval;
    if (isPlaying && playerRef.current?.getCurrentTime) {
      interval = setInterval(() => {
        try {
          const cur = playerRef.current.getCurrentTime();
          const dur = playerRef.current.getDuration();
          if (cur) setCurrentTime(cur);
          if (dur) setDuration(dur);
        } catch (e) {}
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const loadStationSongs = async (stationKey, autoPlayIfEmpty = false) => {
    const station = SPECIAL_STATIONS[stationKey];
    if (!station || station.queries.length === 0) return;

    if (stationKey === 'pauwa') {
      if (stationCache[stationKey]?.party && stationCache[stationKey]?.heartbreak) {
        const { party, heartbreak } = stationCache[stationKey];
        setPartyTracks(party);
        setHeartbreakTracks(heartbreak);
        if (!currentSong) setQueue([...party, ...heartbreak]);
        if (autoPlayIfEmpty && !currentSong && party.length > 0) playSong(party[0]);
        return;
      }
    } else if (stationCache[stationKey]?.tracks?.length > 0) {
      const cachedTracks = stationCache[stationKey].tracks;
      setSongs(cachedTracks);
      if (!currentSong) setQueue(cachedTracks);
      if (autoPlayIfEmpty && !currentSong && cachedTracks.length > 0) {
        const randomTrack = cachedTracks[Math.floor(Math.random() * cachedTracks.length)];
        playSong(randomTrack);
      }
      return;
    }

    setStationLoading(true);

    try {
      if (stationKey === 'pauwa') {
        const partyData = await fetchWithKeyRotation(apiKey => 
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=15&q=${encodeURIComponent(station.queries[0])}&key=${apiKey}`
        );

        const fetchedParty = partyData.items ? partyData.items.map(item => ({
          id: item.id.videoId || item.id,
          title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
          channel: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
        })) : [];

        const sadData = await fetchWithKeyRotation(apiKey => 
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=15&q=${encodeURIComponent(station.queries[1])}&key=${apiKey}`
        );

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
        const data = await fetchWithKeyRotation(apiKey => 
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=25&q=${encodeURIComponent(query)}&key=${apiKey}`
        );

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
  };

  const handleStationSelect = (stationKey) => {
    setActiveTab(stationKey);
    setCurrentBgIndex(0);
    setIsSidebarOpen(false);

    // If video modal is open, convert it into floating PiP mini-player when switching tabs
    if (videoModalSong) {
      setIsPipActive(true);
    }

    if (['home', 'barber', 'truck', 'pauwa'].includes(stationKey)) {
      loadStationSongs(stationKey, false);
    }
  };

  useEffect(() => {
    if (['home', 'barber', 'truck', 'pauwa'].includes(activeTab)) {
      loadStationSongs(activeTab, false);
    }
  }, [activeTab]);

  const togglePlayPause = () => {
    if (!currentSong) {
      if (queue.length > 0) playSong(queue[0]);
      return;
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

  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    playerRef.current?.seekTo?.(seekTime, true);
  };

  const handleVolumeChange = (e) => {
    const newVol = parseInt(e.target.value, 10);
    setVolume(newVol);
    try {
      playerRef.current?.setVolume?.(newVol);
    } catch (e) {}
  };

  const toggleLike = (song) => {
    setLikedSongs(prev => prev.some(s => s.id === song.id) ? prev.filter(s => s.id !== song.id) : [song, ...prev]);
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
      const data = await fetchWithKeyRotation(apiKey =>
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=25&q=${encodeURIComponent(trimmedQuery + " official video original")}&key=${apiKey}`
      );

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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col md:flex-row antialiased selection:bg-amber-500 selection:text-white relative">
      
      {/* Preconnect for speed */}
      <link rel="preconnect" href="https://i.ytimg.com" />
      <link rel="preconnect" href="https://www.youtube.com" />

      <audio 
        ref={silentAudioRef} 
        loop 
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==" 
      />
      
      {/* Background YouTube Audio Engine */}
      <div className="fixed top-0 left-0 w-1 h-1 opacity-0 pointer-events-none -z-50 overflow-hidden">
        <div id="yt-player-instance"></div>
      </div>

      {/* Video Modal Player / PiP Overlay */}
      {videoModalSong && (
        <div 
          className={
            isPipActive
              ? "fixed bottom-24 right-4 z-50 w-72 sm:w-80 bg-neutral-900 border border-neutral-700 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 animate-fadeIn"
              : "fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          }
        >
          <div className={`w-full bg-neutral-900 ${isPipActive ? '' : 'max-w-4xl border border-neutral-800 rounded-3xl'} overflow-hidden shadow-2xl relative flex flex-col`}>
            <div className="p-3 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <Icon name="video" className="w-4 h-4 text-amber-400 shrink-0" />
                <h3 className="font-bold text-xs text-white truncate">{videoModalSong.title}</h3>
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsPipActive(!isPipActive)}
                  className="p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
                  title={isPipActive ? "Expand Fullscreen" : "Minimize to PiP"}
                >
                  <Icon name={isPipActive ? "expand" : "collapse"} className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setVideoModalSong(null); setIsPipActive(false); }}
                  className="p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
                  title="Close Video (Audio continues in background)"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="relative w-full aspect-video bg-black">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${videoModalSong.id}?autoplay=1&enablejsapi=1`}
                title={videoModalSong.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>

            {!isPipActive && (
              <div className="p-4 bg-neutral-900 flex items-center justify-between">
                <span className="text-xs text-neutral-400 truncate">{videoModalSong.channel}</span>
                <button
                  onClick={() => playSong(videoModalSong)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <Icon name="play" className="w-4 h-4" />
                  <span>Listen Background Audio</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-40 bg-neutral-900/95 backdrop-blur-md border-b border-neutral-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-xl bg-neutral-800 text-neutral-200 hover:text-white focus:outline-none"
            aria-label="Toggle Menu"
          >
            <Icon name={isSidebarOpen ? "close" : "menu"} className="w-6 h-6 text-amber-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-700 via-orange-600 to-red-500 flex items-center justify-center shadow-md">
              <Icon name="radio" className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-black tracking-wider text-white">MAHAUL SET</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showInstallBtn && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 font-bold text-xs"
            >
              <Icon name="download" className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          )}
          <div className="px-2.5 py-1 rounded-lg bg-black/60 border border-neutral-800 font-mono text-[11px] text-amber-300">
            {clockString || "00:00"}
          </div>
        </div>
      </header>

      {/* Backdrop overlay for Mobile Sidebar */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-64 bg-neutral-900/95 backdrop-blur-xl border-r border-neutral-800/80 p-4 flex flex-col justify-between shrink-0 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          <div className="flex items-center justify-between px-2 py-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-700 via-orange-600 to-red-500 flex items-center justify-center shadow-xl border border-amber-500/35">
                <Icon name="radio" className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-black tracking-wider text-white">MAHAUL SET</h1>
            </div>

            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => handleStationSelect('home')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs transition ${
                activeTab === 'home' ? 'bg-amber-600/20 text-white border border-amber-500/30' : 'text-neutral-400 hover:bg-neutral-800/50'
              }`}
            >
              <Icon name="home" className="w-4 h-4 text-amber-400" />
              <span>Home (Live Stream)</span>
            </button>

            <button
              onClick={() => handleStationSelect('discover')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs transition ${
                activeTab === 'discover' ? 'bg-amber-600/20 text-white border border-amber-500/30' : 'text-neutral-400 hover:bg-neutral-800/50'
              }`}
            >
              <Icon name="discover" className="w-4 h-4 text-amber-400" />
              <span>Discover & Search</span>
            </button>

            <div className="pt-4 pb-1 px-3">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Nostalgia Stations</p>
            </div>

            <button
              onClick={() => handleStationSelect('barber')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition ${
                activeTab === 'barber' ? 'bg-red-600/25 text-red-200 border border-red-500/50 shadow-lg shadow-red-950/50' : 'text-neutral-400 hover:bg-neutral-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon name="scissors" className="w-4 h-4 text-red-400" />
                <span>Barber Shop (सैलून)</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold">DRINK BG</span>
            </button>

            <button
              onClick={() => handleStationSelect('truck')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition ${
                activeTab === 'truck' ? 'bg-amber-600/25 text-amber-200 border border-amber-500/50 shadow-lg shadow-amber-950/50' : 'text-neutral-400 hover:bg-neutral-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon name="truck" className="w-4 h-4 text-amber-400" />
                <span>Truck Pe Music</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">TRUCK BG</span>
            </button>

            <button
              onClick={() => handleStationSelect('pauwa')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition ${
                activeTab === 'pauwa' ? 'bg-emerald-600/25 text-emerald-200 border border-emerald-500/50 shadow-lg shadow-emerald-950/50' : 'text-neutral-400 hover:bg-neutral-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon name="beer" className="w-4 h-4 text-emerald-400" />
                <span>Pauwa Party</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">DUAL LIST</span>
            </button>

            <div className="pt-4 pb-1 px-3">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Your Collection</p>
            </div>

            <button
              onClick={() => handleStationSelect('library')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs transition ${
                activeTab === 'library' ? 'bg-amber-600/20 text-white border border-amber-500/30' : 'text-neutral-400 hover:bg-neutral-800/50'
              }`}
            >
              <Icon name="library" className="w-4 h-4 text-neutral-400" />
              <span>Liked Songs</span>
            </button>

            <button
              onClick={() => handleStationSelect('history')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs transition ${
                activeTab === 'history' ? 'bg-amber-600/20 text-white border border-amber-500/30' : 'text-neutral-400 hover:bg-neutral-800/50'
              }`}
            >
              <Icon name="history" className="w-4 h-4 text-pink-400" />
              <span>History</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* Main App Workspace */}
      <main className={`flex-1 min-h-screen overflow-y-auto p-4 md:p-8 bg-neutral-950 relative w-full transition-all duration-300 ${isPlayerMinimized ? 'pb-24' : 'pb-64'}`}>
        {currentStation && currentBgImage && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden transition-all duration-700">
            <img 
              key={currentBgImage}
              src={currentBgImage} 
              alt="Station Background" 
              loading="lazy"
              className="w-full h-full object-cover filter brightness-[0.75] contrast-100 scale-105 transition-opacity duration-1000 animate-fadeIn"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/70 via-neutral-950/60 to-neutral-950/85" />
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
            <button onClick={() => setShowMobileTip(false)} className="text-amber-400 font-bold text-sm px-1">✕</button>
          </div>
        )}

        <div className="relative z-20 flex items-center justify-between pb-6 mb-2 border-b border-white/10 gap-2 flex-wrap">
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-neutral-800 backdrop-blur-md shadow-lg">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-neutral-200 tracking-wide">
              <span className="text-emerald-400 font-bold">{activeUsersCount}</span> Active Users
            </span>
          </div>

          <div className="ml-auto hidden md:flex items-center gap-2">
            {showInstallBtn && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs shadow-lg animate-pulse transition"
              >
                <Icon name="download" className="w-3.5 h-3.5 text-neutral-950" />
                <span>Install App</span>
              </button>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-neutral-800 backdrop-blur-md text-xs font-mono text-amber-300 shadow-md">
              <span>🕒</span>
              <span>{clockString || "00:00:00"}</span>
            </div>
          </div>
        </div>

        {/* Discover & Search Section */}
        {activeTab === 'discover' && (
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            <div className="p-8 rounded-3xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-xl shadow-2xl">
              <h2 className="text-2xl font-black text-white mb-2">Discover & Search Tracks</h2>
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
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/50 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-xs text-white transition shadow-lg shadow-amber-950/50 flex items-center gap-2"
                >
                  {isLoading ? <Icon name="sparkles" className="w-4 h-4 animate-spin" /> : <Icon name="search" className="w-4 h-4" />}
                  <span>Search</span>
                </button>
              </form>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-lg font-black text-white">Search Results</h3>
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
                            : 'bg-neutral-900/50 border-neutral-800/70 hover:bg-neutral-900/80'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="text-xs font-mono text-neutral-400 w-6 text-center">{i + 1}</span>
                          <img src={track.thumbnail} alt="" loading="lazy" className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md" />
                          <div className="min-w-0">
                            <h4 className={`font-bold text-xs truncate ${isCurrent ? 'text-amber-400' : 'text-white'}`}>
                              {track.title}
                            </h4>
                            <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isCurrent && isPlaying && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 animate-pulse border border-amber-500/30">
                              PLAYING
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setVideoModalSong(track); setIsPipActive(false); }}
                            className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 text-[10px] font-bold"
                            title="See Video"
                          >
                            <Icon name="video" className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Watch Video</span>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); toggleLike(track); }} className="text-neutral-500 hover:text-pink-500 transition p-1">
                            <Icon name={likedSongs.some(s => s.id === track.id) ? "heart" : "heartOutline"} className="w-4 h-4 text-pink-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {searchVisibleCount < searchResults.length && (
                  <div className="text-center pt-6 pb-4">
                    <button
                      onClick={() => setSearchVisibleCount(prev => prev + 10)}
                      className="px-6 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-amber-400 border border-neutral-700 transition shadow-xl"
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

        {/* Pauwa Party View */}
        {activeTab === 'pauwa' && currentStation && (
          <div className="max-w-5xl mx-auto space-y-8 relative z-10">
            <div className="p-8 rounded-3xl border border-neutral-700/50 relative overflow-hidden shadow-2xl backdrop-blur-md bg-neutral-900/40">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/40 bg-black/60 text-emerald-300 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    {currentStation.badge}
                  </span>
                  <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-lg">{currentStation.title}</h1>
                  <p className="text-xs md:text-sm text-neutral-200 max-w-xl font-medium drop-shadow">{currentStation.subtitle}</p>
                </div>
              </div>
            </div>

            {stationLoading && (
              <div className="text-center py-6">
                <span className="text-xs text-emerald-400 animate-pulse flex items-center justify-center gap-2">
                  <Icon name="sparkles" className="w-4 h-4 animate-spin" /> Loading Party & Heartbreak tracks...
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 pb-1 border-b border-emerald-500/30">
                  <h3 className="text-md font-black text-emerald-300 flex items-center gap-2">
                    <Icon name="beer" className="w-4 h-4 text-emerald-400" />
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
                            ? 'bg-neutral-900/90 border-emerald-500/80 shadow-xl'
                            : 'bg-neutral-900/50 border-neutral-800/70 hover:bg-neutral-900/80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] font-mono text-neutral-500 w-5 text-center">{i + 1}</span>
                          <img src={track.thumbnail} alt="" loading="lazy" className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-md" />
                          <div className="min-w-0">
                            <h4 className={`font-bold text-xs truncate ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>
                              {track.title}
                            </h4>
                            <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setVideoModalSong(track); setIsPipActive(false); }}
                            className="p-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition flex items-center text-[10px] font-bold"
                            title="See Video"
                          >
                            <Icon name="video" className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 pb-1 border-b border-pink-500/30">
                  <h3 className="text-md font-black text-pink-300 flex items-center gap-2">
                    <Icon name="heart" className="w-4 h-4 text-pink-400" />
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
                            : 'bg-neutral-900/50 border-neutral-800/70 hover:bg-neutral-900/80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] font-mono text-neutral-500 w-5 text-center">{i + 1}</span>
                          <img src={track.thumbnail} alt="" loading="lazy" className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-md" />
                          <div className="min-w-0">
                            <h4 className={`font-bold text-xs truncate ${isCurrent ? 'text-pink-400' : 'text-white'}`}>
                              {track.title}
                            </h4>
                            <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setVideoModalSong(track); setIsPipActive(false); }}
                            className="p-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 transition flex items-center text-[10px] font-bold"
                            title="See Video"
                          >
                            <Icon name="video" className="w-3.5 h-3.5" />
                          </button>
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

        {/* Home / Barber / Truck Stations */}
        {['home', 'barber', 'truck'].includes(activeTab) && currentStation && (
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            <div className="p-8 rounded-3xl border border-neutral-700/50 relative overflow-hidden shadow-2xl backdrop-blur-md bg-neutral-900/40">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/40 bg-black/60 text-amber-300 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    {currentStation.badge}
                  </span>
                  <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-lg">{currentStation.title}</h1>
                  <p className="text-xs md:text-sm text-neutral-200 max-w-xl font-medium drop-shadow">{currentStation.subtitle}</p>
                </div>
              </div>
            </div>

            {stationLoading ? (
              <div className="text-center py-6">
                <span className="text-xs text-amber-400 animate-pulse flex items-center justify-center gap-2">
                  <Icon name="sparkles" className="w-4 h-4 animate-spin" /> Fetching station music tracks...
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
                          : 'bg-neutral-900/50 border-neutral-800/70 hover:bg-neutral-900/80'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="text-xs font-mono text-neutral-400 w-6 text-center">{i + 1}</span>
                        <img src={track.thumbnail} alt="" loading="lazy" className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md" />
                        <div className="min-w-0">
                          <h4 className={`font-bold text-xs truncate ${isCurrent ? 'text-amber-400' : 'text-white'}`}>
                            {track.title}
                          </h4>
                          <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCurrent && isPlaying && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 animate-pulse border border-amber-500/30">
                            PLAYING
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setVideoModalSong(track); setIsPipActive(false); }}
                          className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 text-[10px] font-bold"
                          title="See Video"
                        >
                          <Icon name="video" className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Watch Video</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); toggleLike(track); }} className="text-neutral-500 hover:text-pink-500 transition p-1">
                          <Icon name={likedSongs.some(s => s.id === track.id) ? "heart" : "heartOutline"} className="w-4 h-4 text-pink-500" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <DisclaimerFooter />
          </div>
        )}

        {/* Library Tab */}
        {activeTab === 'library' && (
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            <h2 className="text-2xl font-black text-white">Liked Songs Collection</h2>
            <div className="grid grid-cols-1 gap-2">
              {likedSongs.length === 0 ? (
                <p className="text-xs text-neutral-500">No liked songs yet.</p>
              ) : (
                likedSongs.map((track, i) => (
                  <div key={track.id + i} onClick={() => playSong(track)} className="p-3.5 rounded-2xl border bg-neutral-900/50 border-neutral-800 flex items-center justify-between cursor-pointer hover:bg-neutral-900 transition">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img src={track.thumbnail} alt="" loading="lazy" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-white truncate">{track.title}</h4>
                        <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setVideoModalSong(track); setIsPipActive(false); }}
                        className="p-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition flex items-center text-[10px]"
                      >
                        <Icon name="video" className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); toggleLike(track); }} className="text-pink-500 p-1">
                        <Icon name="heart" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <DisclaimerFooter />
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            <h2 className="text-2xl font-black text-white">Listening History</h2>
            <div className="grid grid-cols-1 gap-2">
              {history.length === 0 ? (
                <p className="text-xs text-neutral-500">No history available.</p>
              ) : (
                history.map((track, i) => (
                  <div key={track.id + i} onClick={() => playSong(track)} className="p-3.5 rounded-2xl border bg-neutral-900/50 border-neutral-800 flex items-center justify-between cursor-pointer hover:bg-neutral-900 transition">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img src={track.thumbnail} alt="" loading="lazy" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-white truncate">{track.title}</h4>
                        <p className="text-[10px] text-neutral-400 truncate">{track.channel}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setVideoModalSong(track); setIsPipActive(false); }}
                      className="p-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition flex items-center text-[10px]"
                    >
                      <Icon name="video" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <DisclaimerFooter />
          </div>
        )}
      </main>

      {/* Persistent Player Footer */}
      {currentSong && (
        <footer className={`fixed bottom-0 left-0 right-0 z-40 bg-neutral-900/95 backdrop-blur-2xl border-t border-neutral-800/80 transition-all duration-300 shadow-2xl ${isPlayerMinimized ? 'p-2' : 'p-3 md:p-4'}`}>
          <div className="absolute -top-3.5 right-6 z-50">
            <button
              onClick={() => setIsPlayerMinimized(!isPlayerMinimized)}
              className="px-3 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-amber-400 text-[10px] font-bold shadow-lg flex items-center gap-1 transition"
            >
              <Icon name={isPlayerMinimized ? "chevronUp" : "chevronDown"} className="w-3.5 h-3.5" />
              <span>{isPlayerMinimized ? "Expand Player" : "Minimize"}</span>
            </button>
          </div>

          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-1/4 min-w-0">
              <img src={currentSong.thumbnail} alt="" className={`rounded-xl object-cover shrink-0 shadow-md transition-all duration-300 ${isPlayerMinimized ? 'w-8 h-8' : 'w-12 h-12'}`} />
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-white truncate">{currentSong.title}</h4>
                <p className="text-[10px] text-amber-400 truncate">{currentSong.channel}</p>
              </div>
            </div>

            {!isPlayerMinimized && (
              <div className="flex flex-col items-center w-full md:w-2/4 gap-1.5 animate-fadeIn">
                <div className="flex items-center gap-4">
                  <button onClick={() => setIsShuffle(!isShuffle)} className={`transition ${isShuffle ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`}>
                    <Icon name="shuffle" className="w-4 h-4" />
                  </button>
                  <button onClick={handlePrevSong} className="text-neutral-300 hover:text-white transition">
                    <Icon name="skipPrev" className="w-5 h-5" />
                  </button>
                  <button onClick={togglePlayPause} className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center justify-center shadow-lg transition">
                    <Icon name={isPlaying ? "pause" : "play"} className="w-5 h-5" />
                  </button>
                  <button onClick={handleNextSong} className="text-neutral-300 hover:text-white transition">
                    <Icon name="skipNext" className="w-5 h-5" />
                  </button>
                  <button onClick={() => setIsRepeat(!isRepeat)} className={`transition ${isRepeat ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`}>
                    <Icon name="repeat" className="w-4 h-4" />
                  </button>
                </div>

                <div className="w-full flex items-center gap-2 text-[10px] font-mono text-neutral-400">
                  <span>{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            )}

            {isPlayerMinimized && (
              <div className="flex items-center gap-3">
                <button onClick={togglePlayPause} className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center justify-center shadow-md transition">
                  <Icon name={isPlaying ? "pause" : "play"} className="w-4 h-4" />
                </button>
                <button onClick={handleNextSong} className="text-neutral-300 hover:text-white transition">
                  <Icon name="skipNext" className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="hidden md:flex items-center justify-end w-1/4 gap-2">
              {!isPlayerMinimized && (
                <>
                  <button
                    onClick={() => { setVideoModalSong(currentSong); setIsPipActive(false); }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 transition flex items-center gap-1.5 text-xs font-bold"
                  >
                    <Icon name="video" className="w-4 h-4" />
                    <span>Watch Video</span>
                  </button>

                  <Icon name="volume" className="w-4 h-4 text-neutral-400 ml-2" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}