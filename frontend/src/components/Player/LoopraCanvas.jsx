import React, { useState, useEffect, useRef, useCallback } from 'react';

const CANVAS_MODES = [
  { id: 'vinyl', label: '3D Vinyl Studio', icon: '💿' },
  { id: 'aurora', label: 'Ambient Aurora', icon: '🌌' },
  { id: 'equalizer', label: 'Retro Equalizer', icon: '📊' },
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
  volume,
  onVolumeChange,
  playerRef
}) {
  const [mode, setMode] = useState('aurora');
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180);

  const canvasRef = useRef(null);
  const animFrameId = useRef(null);
  const containerRef = useRef(null);
  const isHiddenRef = useRef(false);

  // Check reduced-motion preference
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        setEffectsEnabled(false);
      }
    }
  }, []);

  // Sync playback time and duration
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      if (playerRef?.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const t = playerRef.current.getCurrentTime() || 0;
          const d = playerRef.current.getDuration() || 180;
          setCurrentTime(t);
          if (d > 0) setDuration(d);
        } catch (e) {}
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isOpen, playerRef]);

  // Page visibility listener: pause render when page is hidden
  useEffect(() => {
    const handleVisibility = () => {
      isHiddenRef.current = document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Format seconds to mm:ss
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Canvas render loop
  useEffect(() => {
    if (!isOpen || !canvasRef.current || !effectsEnabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = canvas.parentElement.clientWidth);
    let height = (canvas.height = canvas.parentElement.clientHeight);

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
      } else if (mode === 'equalizer') {
        // Mode 2: Equalizer Bars
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

      {/* Top Bar with Navigation & Modes */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-8 py-4 backdrop-blur-md bg-neutral-950/60 border-b border-neutral-800/60">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 transition active:scale-95 cursor-pointer"
            title="Exit Canvas"
          >
            ← Back
          </button>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              LOOPRA CANVAS
            </span>
            <p className="text-[11px] text-neutral-400 font-medium">Harmonic Visual Experience</p>
          </div>
        </div>

        {/* Visual Mode Selector Tabs */}
        <div className="hidden md:flex items-center gap-1 bg-neutral-900/90 p-1 rounded-2xl border border-neutral-800">
          {CANVAS_MODES.map((m) => {
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-neutral-950 shadow-md font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls: Effects Toggle & Fullscreen */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEffectsEnabled(!effectsEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              effectsEnabled
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-neutral-800/80 border-neutral-700 text-neutral-500'
            }`}
            title={effectsEnabled ? "Disable Visual Effects (Battery Saver)" : "Enable Visual Effects"}
          >
            FX {effectsEnabled ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 transition active:scale-95 cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? '🗗' : '⛶'}
          </button>
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
                src={currentSong.thumbnail}
                alt={currentSong.title}
                className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover shadow-2xl border-2 border-amber-500/40"
              />
            </div>
          </div>

          {/* Song Metadata */}
          <div className="text-center mt-6 space-y-1.5 w-full px-4">
            <h2 className="text-lg sm:text-2xl font-display font-extrabold text-white tracking-tight line-clamp-1">
              {currentSong.title}
            </h2>
            <p className="text-xs sm:text-sm text-amber-400 font-semibold truncate">
              {currentSong.channel || currentSong.artist}
            </p>
          </div>
        </div>
      </main>

      {/* Bottom Floating Playback Controls Bar */}
      <footer className="relative z-20 w-full max-w-2xl mx-auto p-4 sm:p-6 backdrop-blur-2xl bg-neutral-900/85 rounded-3xl border border-neutral-800/80 shadow-2xl space-y-3 mb-2 sm:mb-6">
        {/* Scrubber Progress */}
        <div className="flex items-center gap-3 text-xs font-mono text-neutral-400">
          <span className="w-10 text-right">{formatTime(currentTime)}</span>
          <div className="flex-1 relative h-1.5 bg-neutral-800 rounded-full overflow-hidden cursor-pointer">
            <div
              className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
              style={{ width: `${Math.min(100, (currentTime / (duration || 180)) * 100)}%` }}
            />
          </div>
          <span className="w-10 text-left">{formatTime(duration)}</span>
        </div>

        {/* Tactile Control Buttons */}
        <div className="flex items-center justify-between gap-4">
          {/* Mobile Mode Switcher Dropdown */}
          <div className="md:hidden">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 text-white rounded-xl px-2 py-1 text-xs"
            >
              {CANVAS_MODES.map(m => (
                <option key={m.id} value={m.id}>{m.icon} {m.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center gap-4 flex-1">
            <button
              onClick={onPrevTrack}
              className="p-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition active:scale-95 cursor-pointer"
              title="Previous Track"
            >
              ⏮
            </button>

            <button
              onClick={onTogglePlay}
              className="w-14 h-14 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 font-bold text-lg flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.5)] hover:scale-105 active:scale-95 transition cursor-pointer"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>

            <button
              onClick={onNextTrack}
              className="p-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition active:scale-95 cursor-pointer"
              title="Next Track"
            >
              ⏭
            </button>
          </div>

          {/* Volume Control */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-neutral-400">🔊</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume || 80}
              onChange={onVolumeChange}
              className="w-20 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </div>

        {/* Audio Transparency Disclaimer */}
        <p className="text-[10px] text-center text-neutral-500 font-mono">
          Visual Mode: Harmonic Canvas (Simulated Rhythm — YouTube iframe audio is sandboxed)
        </p>
      </footer>
    </div>
  );
}
