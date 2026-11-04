import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Home,
  Music,
  Headphones,
  PartyPopper,
  Radio,
  Search,
  Bell,
  Shuffle,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Repeat,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Sparkles,
  Layers
} from 'lucide-react';
import DjLightingCanvas from './DjLightingCanvas';
import DjWaveformVisualizer from './DjWaveformVisualizer';
import { getCleanThumbnail } from '../../utils/thumbnailValidator';

// 6 Visual Presets matching the reference design
const LIGHT_PRESETS = [
  {
    id: 'club-pulse',
    name: 'Club Pulse',
    thumbnail: '/presets/club-pulse.jpg',
    description: 'Bass-driven magenta & violet audio pulse'
  },
  {
    id: 'neon-wave',
    name: 'Neon Wave',
    thumbnail: '/presets/neon-wave.jpg',
    description: 'Electric cyan & purple sweeping beams'
  },
  {
    id: 'strobe-rush',
    name: 'Strobe Rush',
    thumbnail: '/presets/strobe-rush.jpg',
    description: 'High-speed white & gold strobe bursts'
  },
  {
    id: 'laser-show',
    name: 'Laser Show',
    thumbnail: '/presets/laser-show.jpg',
    description: 'Crisp green & cyan geometric laser fan'
  },
  {
    id: 'party-glow',
    name: 'Party Glow',
    thumbnail: '/presets/party-glow.jpg',
    description: 'Warm amber & neon purple party wash'
  },
  {
    id: 'ultra-rave',
    name: 'Ultra Rave',
    thumbnail: '/presets/ultra-rave.jpg',
    description: 'Full-spectrum multi-color hyper rave'
  }
];

// Default high-energy DJ track for immediate playback
const DEFAULT_DJ_TRACK = {
  id: 'slUoxZedJwE',
  videoId: 'slUoxZedJwE',
  title: 'Loopra DJ Mix',
  artist: 'Club • EDM • Party',
  channel: 'Club • EDM • Party',
  thumbnail: '/presets/loopra-dj-art.jpg',
  coverArt: '/presets/loopra-dj-art.jpg'
};

export default function DjClubPage({
  currentSong,
  isPlaying = false,
  onPlaySong,
  onTogglePlay,
  onNextSong,
  onPrevSong,
  volume = 80,
  onVolumeChange,
  isShuffle = false,
  onToggleShuffle,
  isRepeat = 'off',
  onToggleRepeat,
  onNavigate,
  user,
  cmsConfig,
  onOpenSearch,
  onOpenProfile
}) {
  const [activePreset, setActivePreset] = useState('club-pulse');
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [notificationCount] = useState(1);
  const autoTimerRef = useRef(null);

  // Active track info
  const activeTrack = currentSong && (currentSong.title || currentSong.name) ? currentSong : DEFAULT_DJ_TRACK;
  const trackTitle = activeTrack.title || 'Loopra DJ Mix';
  const trackSubtitle = activeTrack.channel || activeTrack.artist || 'Club • EDM • Party';
  const trackArt = activeTrack.thumbnail || activeTrack.coverArt || '/presets/loopra-dj-art.jpg';

  // Preset cycling function
  const handleCyclePreset = useCallback(() => {
    setActivePreset((current) => {
      const idx = LIGHT_PRESETS.findIndex((p) => p.id === current);
      const nextIdx = (idx + 1) % LIGHT_PRESETS.length;
      return LIGHT_PRESETS[nextIdx].id;
    });
  }, []);

  // Automatic preset rotation when Auto mode is enabled
  useEffect(() => {
    if (!isAutoMode) {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
      return;
    }

    autoTimerRef.current = setInterval(() => {
      handleCyclePreset();
    }, 11000); // Rotate every 11 seconds

    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, [isAutoMode, handleCyclePreset]);

  // Handle Play/Pause
  const handlePlayToggle = () => {
    if (!currentSong) {
      if (onPlaySong) {
        onPlaySong(DEFAULT_DJ_TRACK);
      }
    } else {
      if (onTogglePlay) {
        onTogglePlay();
      }
    }
  };

  // Handle Mute/Unmute
  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      onVolumeChange?.({ target: { value: prevVolume || 80 } });
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
      onVolumeChange?.({ target: { value: 0 } });
    }
  };

  // Handle Fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black select-none text-white font-sans">
      {/* 1. CINEMATIC NIGHTCLUB STAGE BACKGROUND */}
      <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
        <img
          src="/loopra-dj-stage-clean.jpg"
          onError={(e) => {
            // Fallback to original image if needed
            e.currentTarget.src = '/loopra-dj-club-bg.jpg';
          }}
          alt="Loopra DJ Club Arena"
          className="w-full h-full object-cover object-center filter brightness-[0.92] contrast-[1.08] transition-transform duration-1000 ease-out"
          style={{
            transform: isPlaying ? 'scale(1.02)' : 'scale(1.0)'
          }}
        />

        {/* Ambient Dark Gradient Vignette for UI readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/85" />
      </div>

      {/* 2. DYNAMIC BEAT-REACTIVE LIGHTING CANVAS */}
      <DjLightingCanvas
        preset={activePreset}
        isPlaying={isPlaying}
        beatIntensity={1}
      />

      {/* 3. STAGE BARRIER EQUALIZER WAVEFORM (Across Crowd Horizon) */}
      <div className="absolute bottom-[20%] md:bottom-[21%] left-1/2 -translate-x-1/2 w-full max-w-3xl px-6 z-20 flex justify-center pointer-events-none opacity-90">
        <DjWaveformVisualizer
          variant="stage"
          isPlaying={isPlaying}
          barCount={48}
          height={38}
          className="w-full max-w-xl h-9 drop-shadow-[0_0_12px_rgba(236,72,153,0.7)]"
        />
      </div>

      {/* 4. TOP NAVBAR MATCHING REFERENCE */}
      <header className="absolute top-0 left-0 right-0 z-40 h-16 px-4 md:px-8 flex items-center justify-between bg-black/40 backdrop-blur-xl border-b border-white/10">
        {/* Left: Brand Logo & Title */}
        <div
          onClick={() => onNavigate?.('home')}
          className="flex items-center gap-2.5 cursor-pointer group"
          title="Return to Home"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 via-purple-600 to-amber-500 p-0.5 shadow-[0_0_15px_rgba(236,72,153,0.5)] group-hover:shadow-[0_0_20px_rgba(236,72,153,0.8)] transition-all">
            <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
              <span className="flex items-center gap-0.5">
                <span className="w-0.5 h-3 bg-pink-400 rounded-full animate-pulse" />
                <span className="w-0.5 h-4.5 bg-purple-300 rounded-full animate-pulse delay-75" />
                <span className="w-0.5 h-2.5 bg-amber-400 rounded-full animate-pulse delay-150" />
              </span>
            </div>
          </div>
          <span className="text-xl font-display font-extrabold tracking-tight text-white group-hover:text-amber-300 transition-colors">
            Loopra
          </span>
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8">
          {/* Home */}
          <button
            type="button"
            onClick={() => onNavigate?.('home')}
            className="flex items-center gap-2 text-sm font-medium text-neutral-300 hover:text-white transition cursor-pointer"
          >
            <Home className="w-4 h-4 text-neutral-400" />
            <span>Home</span>
          </button>

          {/* Music */}
          <button
            type="button"
            onClick={() => onNavigate?.('discover')}
            className="flex items-center gap-2 text-sm font-medium text-neutral-300 hover:text-white transition cursor-pointer"
          >
            <Music className="w-4 h-4 text-neutral-400" />
            <span>Music</span>
          </button>

          {/* DJ Club (Active) */}
          <button
            type="button"
            className="relative flex items-center gap-2 text-sm font-semibold text-orange-400 transition cursor-default pb-1"
          >
            <Headphones className="w-4 h-4 text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
            <span className="drop-shadow-[0_0_10px_rgba(249,115,22,0.6)]">DJ Club</span>
            {/* Glowing Orange Underline */}
            <span className="absolute -bottom-2 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
          </button>

          {/* Party */}
          <button
            type="button"
            onClick={() => {
              if (onPlaySong) {
                onPlaySong(DEFAULT_DJ_TRACK);
              }
            }}
            className="flex items-center gap-2 text-sm font-medium text-neutral-300 hover:text-white transition cursor-pointer"
            title="Start Party Mode"
          >
            <PartyPopper className="w-4 h-4 text-neutral-400" />
            <span>Party</span>
          </button>

          {/* Radio */}
          <button
            type="button"
            onClick={() => onNavigate?.('radio')}
            className="flex items-center gap-2 text-sm font-medium text-neutral-300 hover:text-white transition cursor-pointer"
          >
            <Radio className="w-4 h-4 text-neutral-400" />
            <span>Radio</span>
          </button>
        </nav>

        {/* Right: Search, Notifications & User Avatar */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Search */}
          <button
            type="button"
            onClick={() => onOpenSearch?.()}
            className="p-2 rounded-full text-neutral-300 hover:text-white hover:bg-white/10 transition active:scale-95 cursor-pointer"
            title="Search Music"
            aria-label="Search Music"
          >
            <Search className="w-4.5 h-4.5" />
          </button>

          {/* Notifications with Orange Badge */}
          <div className="relative">
            <button
              type="button"
              className="p-2 rounded-full text-neutral-300 hover:text-white hover:bg-white/10 transition active:scale-95 cursor-pointer"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4.5 h-4.5" />
            </button>
            {notificationCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-orange-500 text-neutral-950 text-[9px] font-extrabold flex items-center justify-center shadow-[0_0_8px_rgba(249,115,22,0.8)]">
                {notificationCount}
              </span>
            )}
          </div>

          {/* User Avatar */}
          <button
            type="button"
            onClick={() => onOpenProfile?.()}
            className="w-9 h-9 rounded-full ring-2 ring-purple-500/60 hover:ring-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)] overflow-hidden transition active:scale-95 cursor-pointer"
            title={user?.displayName || user?.name || 'Account'}
            aria-label="User Account"
          >
            <img
              src={user?.avatar || '/man.png'}
              alt="User"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = '/favicon.png';
              }}
            />
          </button>
        </div>
      </header>

      {/* 5. FLOATING RIGHT-SIDE "LIGHT SHOW" PANEL */}
      <aside
        aria-label="Light Show Presets"
        className={`absolute top-20 md:top-24 right-4 md:right-8 z-30 transition-all duration-300 ${
          isPanelCollapsed
            ? 'w-14 h-14 rounded-full p-0 flex items-center justify-center bg-neutral-950/90 border border-white/20 shadow-2xl cursor-pointer hover:scale-105'
            : 'w-72 sm:w-80 bg-neutral-950/85 backdrop-blur-2xl border border-white/15 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.85)]'
        }`}
      >
        {isPanelCollapsed ? (
          <button
            type="button"
            onClick={() => setIsPanelCollapsed(false)}
            className="w-full h-full flex items-center justify-center text-orange-400"
            title="Open Light Show Presets"
          >
            <Sparkles className="w-6 h-6 animate-pulse" />
          </button>
        ) : (
          <>
            {/* Header: Title + Auto Toggle */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Light Show
                </h3>
              </div>

              {/* Auto Mode Switch Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400 font-medium">Auto</span>
                <button
                  type="button"
                  onClick={() => setIsAutoMode((prev) => !prev)}
                  className={`w-14 h-6 px-1 rounded-full flex items-center transition-all duration-200 cursor-pointer ${
                    isAutoMode
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 justify-end shadow-[0_0_10px_rgba(249,115,22,0.5)]'
                      : 'bg-neutral-800 justify-start border border-neutral-700'
                  }`}
                  title={isAutoMode ? 'Disable Auto Light Show' : 'Enable Auto Light Show'}
                  aria-pressed={isAutoMode}
                >
                  <span
                    className={`h-4.5 px-2 rounded-full text-[10px] font-bold flex items-center justify-center shadow-md ${
                      isAutoMode ? 'bg-white text-orange-600' : 'bg-neutral-500 text-white'
                    }`}
                  >
                    Auto
                  </span>
                </button>
              </div>
            </div>

            {/* 6 Visual Presets Grid (2 Columns x 3 Rows) */}
            <div className="grid grid-cols-2 gap-2.5 mt-3.5">
              {LIGHT_PRESETS.map((p) => {
                const isActive = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setActivePreset(p.id);
                      // If user manually clicks, keep auto or reset timer
                    }}
                    className={`group relative flex flex-col p-1.5 rounded-2xl transition-all duration-200 text-left cursor-pointer overflow-hidden ${
                      isActive
                        ? 'border-2 border-orange-500 ring-2 ring-orange-500/30 bg-neutral-900/90 shadow-[0_0_15px_rgba(249,115,22,0.4)]'
                        : 'border border-white/10 hover:border-white/30 bg-neutral-900/50 hover:bg-neutral-900/80 opacity-80 hover:opacity-100'
                    }`}
                    title={p.description}
                  >
                    {/* Thumbnail */}
                    <div className="w-full h-13 rounded-xl overflow-hidden bg-neutral-950 relative">
                      <img
                        src={p.thumbnail}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {/* Active glowing indicator pill */}
                      {isActive && (
                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(249,115,22,1)]" />
                      )}
                    </div>

                    {/* Preset Name */}
                    <span
                      className={`text-[11px] font-semibold tracking-wide mt-1.5 truncate text-center ${
                        isActive ? 'text-orange-400 font-bold' : 'text-neutral-200'
                      }`}
                    >
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bottom "Change Light Show" Button */}
            <button
              type="button"
              onClick={handleCyclePreset}
              className="w-full mt-3.5 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 hover:from-amber-400 hover:via-orange-400 hover:to-pink-400 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.7)] active:scale-95 transition-all cursor-pointer"
            >
              <Shuffle className="w-4 h-4 text-white" />
              <span>Change Light Show</span>
            </button>
          </>
        )}
      </aside>

      {/* 6. BOTTOM GLASSMORPHISM MUSIC PLAYER */}
      <footer
        role="region"
        aria-label="Loopra DJ Club Player"
        className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-5xl z-40 rounded-3xl bg-neutral-950/90 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.85)] px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sm:gap-6"
      >
        {/* Left: Album Art + Track Info */}
        <div className="flex items-center gap-3 min-w-0 max-w-[28%] sm:max-w-[32%] shrink-0">
          <div className="relative group shrink-0">
            <img
              src={trackArt}
              alt={trackTitle}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border border-white/15 shadow-md group-hover:border-orange-500/60 transition-colors"
              onError={(e) => {
                e.currentTarget.src = '/presets/loopra-dj-art.jpg';
              }}
            />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-orange-500 text-[8px] flex items-center justify-center animate-spin-slow shadow-md">
                ⚡
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-white truncate hover:text-orange-400 transition-colors">
              {trackTitle}
            </h4>
            <p className="text-[10px] sm:text-xs text-neutral-400 truncate flex items-center gap-1 mt-0.5">
              <span>{trackSubtitle}</span>
            </p>
          </div>
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          {/* Shuffle */}
          <button
            type="button"
            onClick={onToggleShuffle}
            className={`p-1.5 rounded-xl transition cursor-pointer ${
              isShuffle ? 'text-orange-400' : 'text-neutral-400 hover:text-white'
            }`}
            title={isShuffle ? 'Shuffle On' : 'Shuffle Off'}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Previous */}
          <button
            type="button"
            onClick={onPrevSong}
            className="p-1.5 rounded-xl text-neutral-300 hover:text-white transition active:scale-95 cursor-pointer"
            title="Previous Track"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Play / Pause Circular Glowing Button */}
          <button
            type="button"
            onClick={handlePlayToggle}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 border-orange-400 bg-gradient-to-tr from-amber-500/20 via-orange-500/25 to-pink-500/20 text-orange-400 hover:text-white hover:border-orange-300 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] active:scale-95 transition-all cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 sm:w-5.5 sm:h-5.5 fill-current" />
            ) : (
              <Play className="w-5 h-5 sm:w-5.5 sm:h-5.5 fill-current ml-0.5" />
            )}
          </button>

          {/* Next */}
          <button
            type="button"
            onClick={onNextSong}
            className="p-1.5 rounded-xl text-neutral-300 hover:text-white transition active:scale-95 cursor-pointer"
            title="Next Track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          {/* Repeat */}
          <button
            type="button"
            onClick={onToggleRepeat}
            className={`p-1.5 rounded-xl transition cursor-pointer ${
              isRepeat && isRepeat !== 'off' ? 'text-orange-400' : 'text-neutral-400 hover:text-white'
            }`}
            title={isRepeat === 'one' ? 'Repeat One' : 'Repeat Off'}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Center-Right: Beat-Reactive Waveform Visualizer */}
        <div className="hidden lg:flex items-center px-2 shrink-0">
          <DjWaveformVisualizer
            variant="player"
            isPlaying={isPlaying}
            height={26}
            className="w-28 sm:w-32 h-6"
          />
        </div>

        {/* Right: Volume Slider & Fullscreen */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Mute / Volume Icon */}
          <button
            type="button"
            onClick={handleToggleMute}
            className="text-neutral-400 hover:text-white transition cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4.5 h-4.5 text-neutral-500" />
            ) : (
              <Volume2 className="w-4.5 h-4.5" />
            )}
          </button>

          {/* Volume Slider */}
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              if (isMuted) setIsMuted(false);
              onVolumeChange?.(e);
            }}
            className="w-16 sm:w-20 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500 shrink-0"
            title={`Volume: ${isMuted ? 0 : volume}%`}
            aria-label="Volume"
          />

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition active:scale-95 cursor-pointer ml-1"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4.5 h-4.5" />
            ) : (
              <Maximize2 className="w-4.5 h-4.5" />
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}

