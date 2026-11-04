import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Home,
  Headphones,
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
  Sliders,
  SlidersHorizontal,
  Flame,
  Zap,
  Radio,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import DjLightingCanvas from './DjLightingCanvas';
import DjWaveformVisualizer from './DjWaveformVisualizer';
import { djAudio } from './djAudioEngine';
import { getCleanThumbnail } from '../../utils/thumbnailValidator';

// 6 Visual Presets matching the reference design
const LIGHT_PRESETS = [
  {
    id: 'club-pulse',
    name: 'Club Pulse',
    thumbnail: '/presets/club-pulse.jpg',
    description: 'Fast rhythmic multicolor pulses and synchronized beams'
  },
  {
    id: 'neon-wave',
    name: 'Neon Wave',
    thumbnail: '/presets/neon-wave.jpg',
    description: 'Rapid moving cyan, blue, purple and pink waves'
  },
  {
    id: 'strobe-rush',
    name: 'Strobe Rush',
    thumbnail: '/presets/strobe-rush.jpg',
    description: 'Powerful rapid multicolor flashes and alternating light bursts'
  },
  {
    id: 'laser-show',
    name: 'Laser Show',
    thumbnail: '/presets/laser-show.jpg',
    description: 'Dense moving laser beams sweeping across the entire screen'
  },
  {
    id: 'party-glow',
    name: 'Party Glow',
    thumbnail: '/presets/party-glow.jpg',
    description: 'Dynamic colorful ambient lighting with pulsing glow'
  },
  {
    id: 'ultra-rave',
    name: 'Ultra Rave',
    thumbnail: '/presets/ultra-rave.jpg',
    description: 'Maximum-energy combination of lasers, strobes, flashes and color transitions'
  }
];

// Default high-energy DJ track for immediate playback in music player
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
  // Preset State
  const [activePreset, setActivePreset] = useState('club-pulse');
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume);
  const [showVolumeFader, setShowVolumeFader] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState('lighting'); // 'lighting' | 'audio'
  const autoTimerRef = useRef(null);

  // Laser & Lighting Controls (Requirement 4 & 7)
  const [laserSpeed, setLaserSpeed] = useState('normal'); // 'slow' | 'normal' | 'fast' | 'extreme'
  const [laserDensity, setLaserDensity] = useState('medium'); // 'low' | 'medium' | 'high' | 'max'
  const [flashIntensity, setFlashIntensity] = useState(80); // 0 to 100
  const [lightBrightness, setLightBrightness] = useState(90); // 10 to 100
  const [reducedMotion, setReducedMotion] = useState(false);

  // DJ Beats & Sound Effects State (Requirement 5)
  const [isDjBeatsPlaying, setIsDjBeatsPlaying] = useState(false);
  const [djBeatsVolume, setDjBeatsVolume] = useState(75);
  const [djSfxVolume, setDjSfxVolume] = useState(85);
  const [djPattern, setDjPattern] = useState('edm'); // 'edm' | 'tech-house' | 'hyper-rave'
  const [isDjAudioMuted, setIsDjAudioMuted] = useState(false);
  const [lastSfxTriggered, setLastSfxTriggered] = useState(null);

  // Active track info
  const activeTrack = currentSong && (currentSong.title || currentSong.name) ? currentSong : DEFAULT_DJ_TRACK;
  const trackTitle = activeTrack.title || 'Loopra DJ Mix';
  const trackSubtitle = activeTrack.channel || activeTrack.artist || 'Club • EDM • Party';
  const trackArt = activeTrack.thumbnail || activeTrack.coverArt || '/presets/loopra-dj-art.jpg';

  // Clean up DJ beats playback on component unmount
  useEffect(() => {
    return () => {
      djAudio.pauseBeats();
    };
  }, []);

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

  // Handle Play/Pause for Main Music Player
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

  // Handle Mute/Unmute for Main Music Player
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

  // DJ Beats Engine Controls
  const handleToggleDjBeats = async () => {
    const isNowPlaying = await djAudio.toggleBeats();
    setIsDjBeatsPlaying(isNowPlaying);
  };

  const handleDjPatternChange = (pattern) => {
    setDjPattern(pattern);
    djAudio.setPattern(pattern);
  };

  const handleDjBeatsVolumeChange = (e) => {
    const val = Number(e.target.value);
    setDjBeatsVolume(val);
    djAudio.setBeatsVolume(val / 100);
  };

  const handleDjSfxVolumeChange = (e) => {
    const val = Number(e.target.value);
    setDjSfxVolume(val);
    djAudio.setSfxVolume(val / 100);
  };

  const handleToggleDjAudioMute = () => {
    const muted = djAudio.toggleMute();
    setIsDjAudioMuted(muted);
  };

  // Trigger DJ Sound Effects
  const handleTriggerSfx = (type) => {
    setLastSfxTriggered(type);
    setTimeout(() => setLastSfxTriggered(null), 400);

    if (type === 'airhorn') djAudio.triggerAirHorn();
    else if (type === 'laser') djAudio.triggerLaserZap();
    else if (type === 'drop') djAudio.triggerSubDrop();
    else if (type === 'scratch') djAudio.triggerScratch();
    else if (type === 'riser') djAudio.triggerRiser(1.8);
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
            e.currentTarget.src = '/loopra-dj-club-bg.jpg';
          }}
          alt="Loopra DJ Club Arena"
          className="w-full h-full object-cover object-center filter brightness-[0.92] contrast-[1.08] transition-transform duration-1000 ease-out"
          style={{
            transform: isPlaying || isDjBeatsPlaying ? 'scale(1.025)' : 'scale(1.0)'
          }}
        />

        {/* Ambient Dark Gradient Vignette for UI readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-transparent to-black/90" />
      </div>

      {/* 2. DYNAMIC BEAT-REACTIVE VOLUMETRIC LIGHTING & MULTI-COLOR LASER CANVAS */}
      <DjLightingCanvas
        preset={activePreset}
        isPlaying={isPlaying || isDjBeatsPlaying}
        speed={laserSpeed}
        density={laserDensity}
        flashIntensity={flashIntensity}
        brightness={lightBrightness}
        reducedMotion={reducedMotion}
      />

      {/* 3. STAGE BARRIER EQUALIZER WAVEFORM (Across Crowd Horizon) */}
      <div className="absolute bottom-[20%] md:bottom-[21%] left-1/2 -translate-x-1/2 w-full max-w-3xl px-6 z-20 flex justify-center pointer-events-none opacity-90">
        <DjWaveformVisualizer
          variant="stage"
          isPlaying={isPlaying || isDjBeatsPlaying}
          barCount={48}
          height={38}
          className="w-full max-w-xl h-9 drop-shadow-[0_0_12px_rgba(236,72,153,0.7)]"
        />
      </div>

      {/* 4. TOP NAVBAR - CLEANED UP: STRICTLY HOME & DJ CLUB ONLY (Requirement 1) */}
      <header className="absolute top-0 left-0 right-0 z-40 h-16 px-4 md:px-8 flex items-center justify-between bg-black/45 backdrop-blur-xl border-b border-white/10">
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

        {/* Center: Top Navigation Links (STRICT REQUIREMENT 1: Only Home & DJ Club) */}
        <nav className="flex items-center gap-5 sm:gap-8">
          {/* Home */}
          <button
            type="button"
            onClick={() => onNavigate?.('home')}
            className="flex items-center gap-2 text-sm font-medium text-neutral-300 hover:text-white transition cursor-pointer px-2 py-1 rounded-lg hover:bg-white/5"
            title="Return to Home"
          >
            <Home className="w-4 h-4 text-neutral-400 group-hover:text-white" />
            <span>Home</span>
          </button>

          {/* DJ Club (Active) */}
          <div className="relative flex items-center gap-2 text-sm font-semibold text-orange-400 transition cursor-default px-2 py-1">
            <Headphones className="w-4 h-4 text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
            <span className="drop-shadow-[0_0_10px_rgba(249,115,22,0.6)]">DJ Club</span>
            {/* Glowing Orange Underline Indicator */}
            <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.9)]" />
          </div>
        </nav>

        {/* Right: Spacer for balanced header alignment without icons */}
        <div className="w-9 sm:w-16 hidden sm:block pointer-events-none" />
      </header>

      {/* 5. FLOATING RIGHT-SIDE "LIGHT SHOW & DJ AUDIO" CONTROL PANEL (100% Permanent Opacity & Compact) */}
      <aside
        aria-label="Light Show & DJ Controls"
        className={`absolute top-16 sm:top-20 md:top-22 right-2 sm:right-5 md:right-6 z-30 transition-all duration-200 ${
          isPanelCollapsed
            ? 'w-9 h-9 sm:w-11 sm:h-11 rounded-full p-0 flex items-center justify-center bg-neutral-950/95 border border-white/20 shadow-2xl cursor-pointer hover:scale-105 opacity-100'
            : 'w-[72vw] min-w-[230px] max-w-[265px] sm:w-76 md:w-80 max-h-[calc(100vh-140px)] sm:max-h-[calc(100vh-165px)] overflow-y-auto opacity-100 bg-neutral-950/95 backdrop-blur-2xl border border-white/20 rounded-2xl sm:rounded-3xl p-2 sm:p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.95)] custom-scrollbar'
        }`}
      >
        {isPanelCollapsed ? (
          <button
            type="button"
            onClick={() => setIsPanelCollapsed(false)}
            className="w-full h-full flex items-center justify-center text-orange-400 cursor-pointer"
            title="Open Light Show & DJ Controls"
          >
            <Sparkles className="w-5 h-5 sm:w-5.5 sm:h-5.5 animate-pulse" />
          </button>
        ) : (
          <div className="space-y-2 sm:space-y-2.5">
            {/* Header: Title + Auto Toggle + Collapse Button */}
            <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                  Light Show & DJ
                </h3>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                {/* Auto Light Show Toggle */}
                <div className="flex items-center gap-1" title="Auto Light Show Mode">
                  <span className="text-[9px] sm:text-[10px] text-neutral-400 font-medium">Auto</span>
                  <button
                    type="button"
                    onClick={() => setIsAutoMode((prev) => !prev)}
                    className={`w-9 sm:w-10 h-4.5 sm:h-5 px-0.5 rounded-full flex items-center transition-all duration-200 cursor-pointer ${
                      isAutoMode
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 justify-end shadow-[0_0_8px_rgba(249,115,22,0.5)]'
                        : 'bg-neutral-800 justify-start border border-neutral-700'
                    }`}
                    title={isAutoMode ? 'Disable Auto Light Show' : 'Enable Auto Light Show'}
                    aria-pressed={isAutoMode}
                  >
                    <span
                      className={`h-3.5 sm:h-4 px-1 rounded-full text-[8px] font-bold flex items-center justify-center shadow-md ${
                        isAutoMode ? 'bg-white text-orange-600' : 'bg-neutral-500 text-white'
                      }`}
                    >
                      {isAutoMode ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>

                {/* Collapse Button */}
                <button
                  type="button"
                  onClick={() => setIsPanelCollapsed(true)}
                  className="p-0.5 sm:p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  title="Collapse Panel"
                  aria-label="Collapse Panel"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Segmented Tab Selector: Lighting vs DJ Beats/SFX */}
            <div className="grid grid-cols-2 p-0.5 sm:p-1 rounded-xl bg-neutral-900/90 border border-white/10">
              <button
                type="button"
                onClick={() => setActivePanelTab('lighting')}
                className={`py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                  activePanelTab === 'lighting'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-neutral-950 font-bold shadow-md'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Light Show</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePanelTab('audio')}
                className={`py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                  activePanelTab === 'audio'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-neutral-950 font-bold shadow-md'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>DJ Beats & SFX</span>
                {isDjBeatsPlaying && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                )}
              </button>
            </div>

            {/* TAB 1: LIGHT SHOW PRESETS & LASER SETTINGS */}
            {activePanelTab === 'lighting' && (
              <div className="space-y-2.5 sm:space-y-3 animate-fadeIn">
                {/* 6 Visual Presets Grid (Compact on mobile) */}
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  {LIGHT_PRESETS.map((p) => {
                    const isActive = activePreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setActivePreset(p.id);
                        }}
                        className={`group relative flex flex-col p-1 sm:p-1.5 rounded-xl sm:rounded-2xl transition-all duration-200 text-left cursor-pointer overflow-hidden ${
                          isActive
                            ? 'border-2 border-orange-500 ring-2 ring-orange-500/30 bg-neutral-900/90 shadow-[0_0_12px_rgba(249,115,22,0.4)]'
                            : 'border border-white/10 hover:border-white/30 bg-neutral-900/50 hover:bg-neutral-900/80 opacity-80 hover:opacity-100'
                        }`}
                        title={p.description}
                      >
                        {/* Thumbnail */}
                        <div className="w-full h-10 sm:h-12 rounded-lg sm:rounded-xl overflow-hidden bg-neutral-950 relative">
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
                            <div className="absolute top-1 right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,1)]" />
                          )}
                        </div>

                        {/* Preset Name */}
                        <span
                          className={`text-[10px] sm:text-[11px] font-semibold tracking-wide mt-0.5 sm:mt-1 truncate text-center ${
                            isActive ? 'text-orange-400 font-bold' : 'text-neutral-200'
                          }`}
                        >
                          {p.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Change Light Show Quick Cycle Button */}
                <button
                  type="button"
                  onClick={handleCyclePreset}
                  className="w-full py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 hover:from-amber-400 hover:via-orange-400 hover:to-pink-400 text-white font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 shadow-[0_0_12px_rgba(249,115,22,0.35)] active:scale-95 transition-all cursor-pointer"
                >
                  <Shuffle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                  <span>Next Preset ({LIGHT_PRESETS.find(p => p.id === activePreset)?.name})</span>
                </button>

                {/* USER-CONTROLLED LASER & LIGHTING SETTINGS */}
                <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-neutral-900/80 border border-white/10 space-y-2 sm:space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-neutral-300">
                    <SlidersHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400" />
                    <span>Laser & Light Engine Controls</span>
                  </div>

                  {/* Laser Speed */}
                  <div>
                    <div className="flex justify-between items-center text-[9px] sm:text-[10px] text-neutral-400 mb-0.5 sm:mb-1">
                      <span>Laser Speed</span>
                      <span className="font-semibold text-orange-400 capitalize">{laserSpeed}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-neutral-950 border border-white/5">
                      {['slow', 'normal', 'fast', 'extreme'].map((sVal) => (
                        <button
                          key={sVal}
                          type="button"
                          onClick={() => setLaserSpeed(sVal)}
                          className={`py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-semibold rounded capitalize transition cursor-pointer ${
                            laserSpeed === sVal
                              ? 'bg-orange-500 text-neutral-950 font-bold shadow-sm'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          {sVal}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Laser Density */}
                  <div>
                    <div className="flex justify-between items-center text-[9px] sm:text-[10px] text-neutral-400 mb-0.5 sm:mb-1">
                      <span>Laser Density</span>
                      <span className="font-semibold text-orange-400 capitalize">{laserDensity === 'max' ? 'Maximum' : laserDensity}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-neutral-950 border border-white/5">
                      {[
                        { id: 'low', label: 'Low' },
                        { id: 'medium', label: 'Med' },
                        { id: 'high', label: 'High' },
                        { id: 'max', label: 'Max' }
                      ].map((dItem) => (
                        <button
                          key={dItem.id}
                          type="button"
                          onClick={() => setLaserDensity(dItem.id)}
                          className={`py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-semibold rounded transition cursor-pointer ${
                            laserDensity === dItem.id
                              ? 'bg-orange-500 text-neutral-950 font-bold shadow-sm'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          {dItem.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Flash Intensity Slider */}
                  <div>
                    <div className="flex justify-between items-center text-[9px] sm:text-[10px] text-neutral-400 mb-0.5 sm:mb-1">
                      <span>Flash Intensity</span>
                      <span className="font-semibold text-neutral-200">{flashIntensity}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={flashIntensity}
                      onChange={(e) => setFlashIntensity(Number(e.target.value))}
                      className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>

                  {/* Light Brightness Slider */}
                  <div>
                    <div className="flex justify-between items-center text-[9px] sm:text-[10px] text-neutral-400 mb-0.5 sm:mb-1">
                      <span>Light Brightness</span>
                      <span className="font-semibold text-neutral-200">{lightBrightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={lightBrightness}
                      onChange={(e) => setLightBrightness(Number(e.target.value))}
                      className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>

                  {/* Reduced Motion Toggle */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-[9px] sm:text-[10px] text-neutral-400">Reduced Motion</span>
                    <button
                      type="button"
                      onClick={() => setReducedMotion((prev) => !prev)}
                      className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold transition cursor-pointer ${
                        reducedMotion
                          ? 'bg-amber-400 text-neutral-950'
                          : 'bg-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {reducedMotion ? 'ENABLED' : 'OFF'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ORIGINAL DJ BEATS & SOUND EFFECTS */}
            {activePanelTab === 'audio' && (
              <div className="space-y-2 sm:space-y-2.5 animate-fadeIn">
                {/* DJ Beats Main Card */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-neutral-900/90 border border-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.15)] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/40">
                        <Flame className="w-3.5 h-3.5 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-[11px] sm:text-xs font-bold text-white">BOOM-BOOM Beats</h4>
                        <p className="text-[8.5px] sm:text-[9.5px] text-neutral-400">Club Rhythms</p>
                      </div>
                    </div>

                    {/* DJ Beats Play / Pause Button */}
                    <button
                      type="button"
                      onClick={handleToggleDjBeats}
                      className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold text-[10px] sm:text-[11px] flex items-center gap-1 sm:gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer ${
                        isDjBeatsPlaying
                          ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                          : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-neutral-950 shadow-[0_0_10px_rgba(249,115,22,0.4)]'
                      }`}
                    >
                      {isDjBeatsPlaying ? (
                        <>
                          <Pause className="w-3 h-3 fill-current" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>Play</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Beat Pattern Selector */}
                  <div>
                    <span className="text-[8.5px] sm:text-[9.5px] text-neutral-400 block mb-0.5">Style & Tempo</span>
                    <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-neutral-950 border border-white/5">
                      {[
                        { id: 'edm', label: 'Club EDM', bpm: '128' },
                        { id: 'tech-house', label: 'Tech House', bpm: '125' },
                        { id: 'hyper-rave', label: 'Hyper Rave', bpm: '134' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleDjPatternChange(item.id)}
                          className={`py-1 px-0.5 rounded-md text-center transition cursor-pointer ${
                            djPattern === item.id
                              ? 'bg-orange-500 text-neutral-950 font-bold shadow-sm'
                              : 'text-neutral-300 hover:text-white'
                          }`}
                        >
                          <span className="block text-[8.5px] sm:text-[9.5px] font-semibold leading-tight">{item.label}</span>
                          <span className="block text-[7px] opacity-75">{item.bpm} BPM</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* DUAL VERTICAL MIXER VOLUME FADERS (Requirement 3: Compact & Mobile-Friendly) */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-neutral-900/90 border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-neutral-300">
                      <Volume2 className="w-3 h-3 text-orange-400" />
                      <span>DJ Sound Faders</span>
                    </div>
                    {/* Master Mute for DJ Audio */}
                    <button
                      type="button"
                      onClick={handleToggleDjAudioMute}
                      className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        isDjAudioMuted ? 'bg-red-500/80 text-white' : 'bg-neutral-800 text-neutral-300 hover:text-white'
                      }`}
                      title={isDjAudioMuted ? 'Unmute DJ Audio' : 'Mute DJ Audio'}
                    >
                      {isDjAudioMuted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                      <span>{isDjAudioMuted ? 'MUTED' : 'UNMUTED'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    {/* Channel 1: Beats Volume Vertical Fader */}
                    <div className="flex flex-col items-center bg-neutral-950/80 p-2 rounded-lg border border-white/5">
                      <div className="flex items-center justify-between w-full text-[9px] font-semibold text-neutral-400 mb-1">
                        <span>Beats</span>
                        <span className="text-orange-400 font-mono font-bold">{djBeatsVolume}%</span>
                      </div>
                      <div className="h-20 sm:h-22 flex items-center justify-center my-1">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={djBeatsVolume}
                          onChange={handleDjBeatsVolumeChange}
                          className="h-20 sm:h-22 w-2 accent-orange-500 cursor-pointer"
                          style={{
                            writingMode: 'vertical-lr',
                            direction: 'rtl'
                          }}
                          title={`Beats Volume: ${djBeatsVolume}%`}
                          aria-label="DJ Beats Vertical Volume"
                        />
                      </div>
                      <span className="text-[7.5px] text-neutral-500 uppercase tracking-wider font-mono">Fader 1</span>
                    </div>

                    {/* Channel 2: SFX Volume Vertical Fader */}
                    <div className="flex flex-col items-center bg-neutral-950/80 p-2 rounded-lg border border-white/5">
                      <div className="flex items-center justify-between w-full text-[9px] font-semibold text-neutral-400 mb-1">
                        <span>Effects</span>
                        <span className="text-amber-400 font-mono font-bold">{djSfxVolume}%</span>
                      </div>
                      <div className="h-20 sm:h-22 flex items-center justify-center my-1">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={djSfxVolume}
                          onChange={handleDjSfxVolumeChange}
                          className="h-20 sm:h-22 w-2 accent-amber-500 cursor-pointer"
                          style={{
                            writingMode: 'vertical-lr',
                            direction: 'rtl'
                          }}
                          title={`Effects Volume: ${djSfxVolume}%`}
                          aria-label="DJ Effects Vertical Volume"
                        />
                      </div>
                      <span className="text-[7.5px] text-neutral-500 uppercase tracking-wider font-mono">Fader 2</span>
                    </div>
                  </div>
                </div>

                {/* DJ SOUND EFFECTS (SFX) TRIGGER PAD */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-neutral-900/90 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-neutral-300">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>DJ Sound Effects</span>
                    </div>
                  </div>

                  {/* 5 Instant SFX Trigger Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 sm:gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTriggerSfx('airhorn')}
                      className={`p-1.5 rounded-lg text-left border transition-all active:scale-95 cursor-pointer ${
                        lastSfxTriggered === 'airhorn'
                          ? 'bg-amber-400 text-neutral-950 border-amber-300 scale-98 shadow-[0_0_12px_rgba(251,191,36,0.8)]'
                          : 'bg-neutral-950/80 border-white/10 hover:border-amber-400/60 text-white hover:bg-neutral-900'
                      }`}
                    >
                      <span className="text-sm block">🚨</span>
                      <span className="text-[9.5px] sm:text-[10px] font-bold block mt-0.5">Air Horn</span>
                      <span className="text-[7.5px] text-neutral-400 block">Triple Blast</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTriggerSfx('laser')}
                      className={`p-1.5 rounded-lg text-left border transition-all active:scale-95 cursor-pointer ${
                        lastSfxTriggered === 'laser'
                          ? 'bg-cyan-400 text-neutral-950 border-cyan-300 scale-98 shadow-[0_0_12px_rgba(6,182,212,0.8)]'
                          : 'bg-neutral-950/80 border-white/10 hover:border-cyan-400/60 text-white hover:bg-neutral-900'
                      }`}
                    >
                      <span className="text-sm block">⚡</span>
                      <span className="text-[9.5px] sm:text-[10px] font-bold block mt-0.5">Laser Zap</span>
                      <span className="text-[7.5px] text-neutral-400 block">Dual Sweep</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTriggerSfx('drop')}
                      className={`p-1.5 rounded-lg text-left border transition-all active:scale-95 cursor-pointer ${
                        lastSfxTriggered === 'drop'
                          ? 'bg-purple-500 text-white border-purple-400 scale-98 shadow-[0_0_12px_rgba(168,85,247,0.8)]'
                          : 'bg-neutral-950/80 border-white/10 hover:border-purple-400/60 text-white hover:bg-neutral-900'
                      }`}
                    >
                      <span className="text-sm block">💥</span>
                      <span className="text-[9.5px] sm:text-[10px] font-bold block mt-0.5">Bass Drop</span>
                      <span className="text-[7.5px] text-neutral-400 block">Sub Boom</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTriggerSfx('scratch')}
                      className={`p-1.5 rounded-lg text-left border transition-all active:scale-95 cursor-pointer ${
                        lastSfxTriggered === 'scratch'
                          ? 'bg-pink-500 text-white border-pink-400 scale-98 shadow-[0_0_12px_rgba(236,72,153,0.8)]'
                          : 'bg-neutral-950/80 border-white/10 hover:border-pink-400/60 text-white hover:bg-neutral-900'
                      }`}
                    >
                      <span className="text-sm block">🌀</span>
                      <span className="text-[9.5px] sm:text-[10px] font-bold block mt-0.5">Scratch</span>
                      <span className="text-[7.5px] text-neutral-400 block">Vinyl Flick</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTriggerSfx('riser')}
                      className={`col-span-2 p-1.5 rounded-lg text-left border transition-all active:scale-95 cursor-pointer ${
                        lastSfxTriggered === 'riser'
                          ? 'bg-orange-500 text-neutral-950 border-orange-300 scale-98 shadow-[0_0_12px_rgba(249,115,22,0.8)]'
                          : 'bg-neutral-950/80 border-white/10 hover:border-orange-400/60 text-white hover:bg-neutral-900'
                      }`}
                    >
                      <span className="text-sm block">🚀</span>
                      <span className="text-[9.5px] sm:text-[10px] font-bold block mt-0.5">DJ Riser & Drop</span>
                      <span className="text-[7.5px] text-neutral-400 block">2-Bar Build</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
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
            {(isPlaying || isDjBeatsPlaying) && (
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
            isPlaying={isPlaying || isDjBeatsPlaying}
            height={26}
            className="w-28 sm:w-32 h-6"
          />
        </div>

        {/* Right: Vertical Volume Fader Control & Fullscreen */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Vertical Volume Popover Control (Compact & Mobile-Friendly) */}
          <div className="relative group/vol flex items-center">
            <button
              type="button"
              onClick={() => setShowVolumeFader((prev) => !prev)}
              className="p-1.5 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title={isMuted ? 'Unmute' : `Volume: ${volume}%`}
              aria-label="Toggle Volume Fader"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4.5 h-4.5 text-neutral-500" />
              ) : (
                <Volume2 className="w-4.5 h-4.5 text-orange-400" />
              )}
            </button>

            {/* Vertical Volume Popover Fader */}
            <div
              className={`absolute bottom-full mb-3 right-0 sm:left-1/2 sm:-translate-x-1/2 p-2.5 rounded-2xl bg-neutral-950/95 backdrop-blur-2xl border border-white/20 shadow-[0_15px_35px_rgba(0,0,0,0.9)] flex flex-col items-center gap-2 z-50 transition-all duration-200 ${
                showVolumeFader
                  ? 'opacity-100 scale-100 pointer-events-auto'
                  : 'opacity-0 scale-95 pointer-events-none group-hover/vol:opacity-100 group-hover/vol:scale-100 group-hover/vol:pointer-events-auto'
              }`}
            >
              <span className="text-[10px] font-mono font-bold text-orange-400">
                {isMuted ? 0 : volume}%
              </span>

              <div className="relative h-24 sm:h-28 flex items-center justify-center">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    if (isMuted) setIsMuted(false);
                    onVolumeChange?.(e);
                  }}
                  className="h-24 sm:h-28 w-2 accent-orange-500 cursor-pointer"
                  style={{
                    writingMode: 'vertical-lr',
                    direction: 'rtl'
                  }}
                  title={`Volume: ${isMuted ? 0 : volume}%`}
                  aria-label="Vertical Volume Control"
                />
              </div>

              <button
                type="button"
                onClick={handleToggleMute}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-neutral-300" />
                )}
              </button>
            </div>
          </div>

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
