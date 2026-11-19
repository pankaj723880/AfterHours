import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCleanThumbnail } from '../../utils/storage';
import {
  ArrowLeft,
  Settings2,
  X,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Check
} from 'lucide-react';

const CANVAS_MODES = [
  { id: 'vinyl', label: '3D Vinyl Studio', icon: '💿' },
  { id: 'aurora', label: 'Ambient Aurora', icon: '🌌' },
  { id: 'harmonicBars', label: 'Harmonic Bars', icon: '📊' },
  { id: 'waveform', label: 'Waveform Flow', icon: '🌊' },
  { id: 'cinematic', label: 'Minimal Cinematic', icon: '✨' }
];

export default function LoopraCanvas({
  isOpen,
  onClose,
  currentSong,
  isPlaying,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onNext,
  onPrev,
  volume,
  onVolumeChange,
  playerRef,
  onSeek
}) {
  const [mode, setMode] = useState('aurora');
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  const canvasRef = useRef(null);
  const animFrameId = useRef(null);
  const containerRef = useRef(null);
  const settingsPanelRef = useRef(null);
  const isHiddenRef = useRef(false);
  const hideTimerRef = useRef(null);
  const isSettingsOpenRef = useRef(false);

  useEffect(() => {
    isSettingsOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen]);

  // Normalize previous / next handlers across both naming conventions
  const handleNext = onNext || onNextTrack;
  const handlePrev = onPrev || onPrevTrack;

  const isRadio = Boolean(currentSong?.isRadio);
  const songId = currentSong?.id || currentSong?.videoId;

  // Check reduced-motion preference
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        setEffectsEnabled(false);
      }
    }
  }, []);

  // Reset progress and query fresh duration when song changes
  useEffect(() => {
    if (!isOpen || !currentSong) return;
    setIsSeeking(false);
    setCurrentTime(0);
    setDuration(0);

    if (isRadio) return;

    // Give the player a short moment to initialize new track duration
    const timer = setTimeout(() => {
      if (playerRef?.current) {
        try {
          if (typeof playerRef.current.getDuration === 'function') {
            const d = playerRef.current.getDuration();
            if (typeof d === 'number' && !isNaN(d) && d > 0) {
              setDuration(d);
            }
          }
          if (typeof playerRef.current.getCurrentTime === 'function') {
            const t = playerRef.current.getCurrentTime();
            if (typeof t === 'number' && !isNaN(t) && t >= 0) {
              setCurrentTime(t);
            }
          }
        } catch (e) {}
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isOpen, songId, isRadio, playerRef]);

  // Synchronize playback time and duration continuously
  useEffect(() => {
    if (!isOpen || isRadio) return;

    const interval = setInterval(() => {
      if (playerRef?.current && !isSeeking) {
        try {
          if (typeof playerRef.current.getCurrentTime === 'function') {
            const t = playerRef.current.getCurrentTime();
            if (typeof t === 'number' && !isNaN(t) && t >= 0) {
              setCurrentTime(t);
            }
          }
          if (typeof playerRef.current.getDuration === 'function') {
            const d = playerRef.current.getDuration();
            if (typeof d === 'number' && !isNaN(d) && d > 0) {
              setDuration(d);
            }
          }
        } catch (e) {}
      }
    }, 300);

    return () => clearInterval(interval);
  }, [isOpen, isSeeking, isRadio, playerRef]);

  // Handle Seeking
  const handleSeekChange = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
  };

  const handleSeekCommit = (e) => {
    setIsSeeking(false);
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (onSeek) {
      onSeek(seekTime);
    }
    if (playerRef?.current && typeof playerRef.current.seekTo === 'function') {
      try {
        playerRef.current.seekTo(seekTime, true);
      } catch (err) {}
    }
  };

  // Page visibility listener: pause render when page is hidden
  useEffect(() => {
    const handleVisibility = () => {
      isHiddenRef.current = document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-hide Top Navbar after 5 seconds of inactivity
  const showControlsAndResetTimer = useCallback(() => {
    setIsHeaderVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      // Don't auto-hide if settings panel is currently open
      if (!isSettingsOpenRef.current) {
        setIsHeaderVisible(false);
      }
    }, 5000);
  }, []);

  // Listen for user interactions (mouse movement, clicks, touches, keys) to reveal navbar
  useEffect(() => {
    if (!isOpen) return;

    showControlsAndResetTimer();

    const handleUserActivity = () => {
      showControlsAndResetTimer();
    };

    const container = containerRef.current || window;
    container.addEventListener('mousemove', handleUserActivity, { passive: true });
    container.addEventListener('mousedown', handleUserActivity, { passive: true });
    container.addEventListener('touchstart', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      container.removeEventListener('mousemove', handleUserActivity);
      container.removeEventListener('mousedown', handleUserActivity);
      container.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
    };
  }, [isOpen, showControlsAndResetTimer]);

  // Sync fullscreen state changes with document events (browser escape or OS controls)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      setIsFullscreen(active);
      showControlsAndResetTimer();
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [showControlsAndResetTimer]);

  // Click outside visual settings panel to close
  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleClickOutside = (e) => {
      if (settingsPanelRef.current && !settingsPanelRef.current.contains(e.target)) {
        setIsSettingsOpen(false);
        showControlsAndResetTimer();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSettingsOpen, showControlsAndResetTimer]);

  // Fullscreen toggle with cross-browser support
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      if (!active) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if (containerRef.current.webkitRequestFullscreen) {
          await containerRef.current.webkitRequestFullscreen();
        } else if (containerRef.current.msRequestFullscreen) {
          await containerRef.current.msRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (e) {}
    showControlsAndResetTimer();
  }, [showControlsAndResetTimer]);

  // Format seconds to mm:ss
  const formatTime = (sec) => {
    if (typeof sec !== 'number' || isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Canvas render loop
  useEffect(() => {
    if (!isOpen || !canvasRef.current || !effectsEnabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    let frame = 0;
    const particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 3 + 1,
      speedX: (Math.random() - 0.5) * 0.8,
      speedY: -Math.random() * 0.8 - 0.2,
      opacity: Math.random() * 0.6 + 0.2
    }));

    const render = () => {
      if (isHiddenRef.current) {
        animFrameId.current = requestAnimationFrame(render);
        return;
      }

      frame++;
      ctx.clearRect(0, 0, width, height);

      // Simulation rhythm multiplier based on playback state
      const energyMultiplier = isPlaying ? 1 : 0.2;
      const beat = Math.sin(frame * 0.05) * 0.5 + 0.5;

      if (mode === 'aurora') {
        // Mode 1: Ambient Aurora Mesh
        const g1 = ctx.createRadialGradient(
          width * 0.3 + Math.sin(frame * 0.02) * 60,
          height * 0.4 + Math.cos(frame * 0.02) * 40,
          10,
          width * 0.3,
          height * 0.4,
          width * 0.55
        );
        g1.addColorStop(0, `rgba(245, 158, 11, ${0.25 * energyMultiplier})`);
        g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, width, height);

        const g2 = ctx.createRadialGradient(
          width * 0.7 - Math.cos(frame * 0.015) * 50,
          height * 0.6 + Math.sin(frame * 0.025) * 40,
          10,
          width * 0.7,
          height * 0.6,
          width * 0.5
        );
        g2.addColorStop(0, `rgba(234, 88, 12, ${0.2 * energyMultiplier})`);
        g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, width, height);

        // Floating particles
        ctx.fillStyle = '#f59e0b';
        particles.forEach(p => {
          p.x += p.speedX * energyMultiplier;
          p.y += p.speedY * energyMultiplier;
          if (p.y < 0) p.y = height;
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          ctx.globalAlpha = p.opacity * (isPlaying ? 0.8 : 0.3);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      } else if (mode === 'harmonicBars') {
        // Mode 2: Harmonic Bars Visualizer
        const barCount = Math.min(Math.floor(width / 24), 36);
        const barWidth = (width * 0.8) / barCount;
        const startX = width * 0.1;
        const baseY = height * 0.75;

        for (let i = 0; i < barCount; i++) {
          const freq = Math.sin(frame * 0.08 + i * 0.35) * Math.cos(i * 0.1);
          const barHeight = Math.max(12, Math.abs(freq) * (height * 0.35) * energyMultiplier + (beat * 15));
          const x = startX + i * barWidth;
          const y = baseY - barHeight;

          const grad = ctx.createLinearGradient(0, y, 0, baseY);
          grad.addColorStop(0, '#f59e0b');
          grad.addColorStop(1, '#ea580c');
          ctx.fillStyle = grad;
          ctx.fillRect(x + 2, y, barWidth - 4, barHeight);

          // Cap
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + 2, y - 3, barWidth - 4, 2);
        }
      } else if (mode === 'waveform') {
        // Mode 3: Flowing Waveform
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath();
        const midY = height * 0.55;

        for (let x = 0; x < width; x += 4) {
          const angle = (x / width) * Math.PI * 4 + frame * 0.04;
          const yOffset = Math.sin(angle) * 40 * energyMultiplier + Math.cos(angle * 0.5) * 20 * energyMultiplier;
          if (x === 0) ctx.moveTo(x, midY + yOffset);
          else ctx.lineTo(x, midY + yOffset);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(234, 88, 12, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x < width; x += 4) {
          const angle = (x / width) * Math.PI * 4 - frame * 0.03;
          const yOffset = Math.sin(angle) * 30 * energyMultiplier;
          if (x === 0) ctx.moveTo(x, midY + yOffset);
          else ctx.lineTo(x, midY + yOffset);
        }
        ctx.stroke();
      } else if (mode === 'vinyl') {
        // Mode 4: 3D Platter Glow Aura
        const centerX = width / 2;
        const centerY = height * 0.45;
        const radius = Math.min(width, height) * 0.32;

        const discGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius * 1.2);
        discGrad.addColorStop(0, `rgba(245, 158, 11, ${0.15 * energyMultiplier})`);
        discGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = discGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, mode, effectsEnabled, isPlaying]);

  if (!isOpen || !currentSong) return null;

  const artworkSrc = getCleanThumbnail(currentSong, songId);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[120] bg-neutral-950 flex flex-col justify-between overflow-hidden select-none animate-fadeIn"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
    >
      {/* Dynamic Background Canvas */}
      <div className="absolute inset-0 pointer-events-none">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      {/* Top Bar with Navigation & Modes (Auto-hides after 5s of inactivity) */}
      <header
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        className={`fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 sm:px-8 py-3 backdrop-blur-md bg-neutral-950/60 border-b border-neutral-800/40 transition-all duration-500 ease-out ${
          isHeaderVisible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        {/* Left Side: Compact Back Button */}
        <div className="flex items-center">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 transition active:scale-95 cursor-pointer text-xs font-semibold shadow-md"
            title="Exit Canvas (Esc)"
            aria-label="Back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        {/* Right Side: Visual Settings Toggle & Fullscreen Toggle */}
        <div className="flex items-center gap-2 relative">
          {/* Visual Settings Toggle Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSettingsOpen(!isSettingsOpen);
              showControlsAndResetTimer();
            }}
            className={`p-2 rounded-full border transition active:scale-95 cursor-pointer shadow-md ${
              isSettingsOpen
                ? 'bg-amber-500 text-neutral-950 border-amber-400 font-bold'
                : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-700/60'
            }`}
            title={isSettingsOpen ? "Close Visual Settings" : "Visual Modes & FX Settings"}
            aria-label="Visual Settings"
          >
            {isSettingsOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Settings2 className="w-4 h-4" />
            )}
          </button>

          {/* Fullscreen Maximize / Minimize Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="p-2 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 transition active:scale-95 cursor-pointer shadow-md"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          {/* Visual Settings Dropdown / Popover Panel */}
          {isSettingsOpen && (
            <div
              ref={settingsPanelRef}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] p-3 rounded-2xl bg-neutral-900/95 backdrop-blur-2xl border border-neutral-800 shadow-2xl space-y-3 z-50 animate-fadeIn"
            >
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Visual Settings
                </span>
                <button
                  onClick={() => {
                    setIsSettingsOpen(false);
                    showControlsAndResetTimer();
                  }}
                  className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
                  title="Close"
                  aria-label="Close Settings Panel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Five Visual Modes List */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-neutral-400 block px-1">
                  Canvas Mode
                </span>
                {CANVAS_MODES.map((m) => {
                  const isActive = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setMode(m.id);
                        setIsSettingsOpen(false);
                        showControlsAndResetTimer();
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                          : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                      </span>
                      {isActive && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                  );
                })}
              </div>

              {/* Effects ON / OFF Toggle */}
              <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between px-1">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-neutral-200">Visual Effects</span>
                  <span className="text-[10px] text-neutral-400">Particles & Aura glow</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEffectsEnabled(!effectsEnabled);
                    showControlsAndResetTimer();
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    effectsEnabled
                      ? 'bg-amber-500 text-neutral-950 border-amber-400'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
                  aria-label={effectsEnabled ? "Turn Effects Off" : "Turn Effects On"}
                >
                  {effectsEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Center Stage: Artwork & Visual Presentation */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-8 min-h-0">
        <div className="relative group max-w-sm sm:max-w-md w-full flex flex-col items-center justify-center">
          {/* Animated Vinyl Platter Effect in Vinyl Mode or Center Album Art */}
          <div className="relative flex items-center justify-center">
            {/* Spinning Record behind art */}
            <div
              className={`w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-neutral-950 border-4 border-neutral-800 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex items-center justify-center overflow-hidden transition-transform duration-700 ${
                isPlaying && effectsEnabled ? 'animate-spin-slow' : ''
              }`}
              style={{
                background: 'radial-gradient(circle, #262626 15%, #0a0a0a 45%, #1a1a1a 75%, #050505 100%)'
              }}
            >
              {/* Vinyl Grooves Texture */}
              <div className="absolute inset-4 rounded-full border border-white/5 pointer-events-none" />
              <div className="absolute inset-8 rounded-full border border-white/5 pointer-events-none" />
              <div className="absolute inset-14 rounded-full border border-white/5 pointer-events-none" />
              <div className="absolute inset-20 rounded-full border border-white/5 pointer-events-none" />

              {/* Center Artwork Label */}
              <img
                src={artworkSrc}
                alt={currentSong.title || 'Track Art'}
                className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover shadow-2xl border-2 border-amber-500/40"
              />
            </div>
          </div>

          {/* Song Metadata */}
          <div className="text-center mt-6 space-y-1.5 w-full px-4">
            <h2 className="text-lg sm:text-2xl font-display font-extrabold text-white tracking-tight line-clamp-1">
              {currentSong.title || 'Unknown Title'}
            </h2>
            <p className="text-xs sm:text-sm text-amber-400 font-semibold truncate">
              {currentSong.channel || currentSong.artist || 'Unknown Artist'}
            </p>
          </div>
        </div>
      </main>

      {/* Minimal Bottom Floating Playback Controls Bar (Always Visible) */}
      <footer
        className="fixed bottom-4 sm:bottom-6 inset-x-0 z-30 flex items-center justify-center pointer-events-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-2xl bg-neutral-900/80 border border-neutral-800/80 shadow-[0_8px_32px_rgba(0,0,0,0.6)] select-none"
        >
          {/* 1. Previous Track */}
          <button
            onClick={handlePrev}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/5 active:scale-95 transition cursor-pointer"
            title="Previous Track"
            aria-label="Previous Track"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          {/* 2. Play / Pause (Primary control, slightly prominent with subtle gold accent) */}
          <button
            onClick={onTogglePlay}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,0.4)] hover:scale-105 active:scale-95 transition cursor-pointer"
            title={isPlaying ? "Pause" : "Play"}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          {/* 3. Next Track */}
          <button
            onClick={handleNext}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/5 active:scale-95 transition cursor-pointer"
            title="Next Track"
            aria-label="Next Track"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
        </div>
      </footer>
    </div>
  );
}
