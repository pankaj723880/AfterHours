import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize2,
  Minimize2,
  Tv,
  Subtitles,
  Share2,
  Heart,
  X,
  Music,
  CheckCircle2
} from 'lucide-react';

export default function CinematicVideoPlayer({
  videoModalSong,
  currentSong,
  isPlaying,
  currentTime = 0,
  duration = 0,
  volume = 80,
  isMuted = false,
  isPipActive = false,
  setIsPipActive,
  onClose,
  onTogglePlayPause,
  onSeek,
  onSeekRelative,
  onVolumeChange,
  onToggleMute,
  onToggleLike,
  isLiked = false,
  onAddToPlaylist,
  onShare,
  playbackSpeed = 1,
  onPlaybackSpeedChange,
  playerRef,
  ytContainerRef,
  showToast,
  cmsConfig
}) {
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [hoverSeekTime, setHoverSeekTime] = useState(null);
  const [hoverSeekPercent, setHoverSeekPercent] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);

  const playerContainerRef = useRef(null);
  const progressBarRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const activeSong = currentSong || videoModalSong;

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      resetControlsTimer();
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, resetControlsTimer]);

  // Direct Play/Pause handler that syncs both App state and YouTube IFrame Player
  const handleDirectTogglePlayPause = useCallback((e) => {
    if (e) e.stopPropagation();
    try {
      if (playerRef?.current) {
        if (isPlaying && typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
        } else if (!isPlaying && typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
        }
      }
    } catch (_) {}
    onTogglePlayPause?.();
    resetControlsTimer();
  }, [isPlaying, onTogglePlayPause, playerRef, resetControlsTimer]);

  const [internalTime, setInternalTime] = useState(currentTime || 0);
  const [internalDuration, setInternalDuration] = useState(duration || 0);

  useEffect(() => {
    if (!isScrubbing && currentTime > 0) setInternalTime(currentTime);
  }, [currentTime, isScrubbing]);

  useEffect(() => {
    if (duration > 0) setInternalDuration(duration);
  }, [duration]);

  useEffect(() => {
    if (!videoModalSong) return;
    const interval = setInterval(() => {
      if (isScrubbing) return;
      try {
        if (playerRef?.current?.getCurrentTime) {
          const t = playerRef.current.getCurrentTime();
          if (typeof t === 'number' && !isNaN(t)) setInternalTime(t);
        }
        if (playerRef?.current?.getDuration) {
          const d = playerRef.current.getDuration();
          if (typeof d === 'number' && !isNaN(d) && d > 0) setInternalDuration(d);
        }
      } catch (e) {}
    }, 250);
    return () => clearInterval(interval);
  }, [videoModalSong, isPlaying, playerRef, isScrubbing]);

  const activeCurrentTime = isScrubbing ? scrubTime : (internalTime || currentTime || 0);
  const activeDuration = internalDuration || duration || 0;

  // Direct Seek handler that immediately seeks both YouTube IFrame and App audio state
  const executeDirectSeek = useCallback((targetSeconds) => {
    const clamped = Math.max(0, Math.min(activeDuration || 0, Number(targetSeconds) || 0));
    setInternalTime(clamped);
    try {
      if (playerRef?.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(clamped, true);
      }
    } catch (_) {}
    onSeek?.(clamped);
    resetControlsTimer();
  }, [activeDuration, onSeek, playerRef, resetControlsTimer]);

  const executeDirectRelativeSeek = useCallback((deltaSeconds) => {
    const base = internalTime || currentTime || 0;
    const target = Math.max(0, Math.min(activeDuration || 3600, base + deltaSeconds));
    executeDirectSeek(target);
  }, [internalTime, currentTime, activeDuration, executeDirectSeek]);

  const toggleFullscreen = useCallback(() => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const toggleCaptions = useCallback(() => {
    if (!playerRef?.current || !playerRef.current.isReady) {
      showToast?.('Player is still loading captions...');
      return;
    }
    try {
      if (typeof playerRef.current.loadModule === 'function') {
        playerRef.current.loadModule('captions');
      }
      const next = !captionsEnabled;
      if (typeof playerRef.current.setOption === 'function') {
        if (next) {
          playerRef.current.setOption('captions', 'track', { languageCode: 'en' });
          playerRef.current.setOption('captions', 'reload', true);
        } else {
          playerRef.current.setOption('captions', 'track', {});
        }
      }
      setCaptionsEnabled(next);
      showToast?.(next ? 'Subtitles enabled' : 'Subtitles disabled');
    } catch (err) {
      showToast?.('Subtitles not available for this video');
    }
  }, [captionsEnabled, playerRef, showToast]);

  useEffect(() => {
    if (!videoModalSong || isPipActive) return;

    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          handleDirectTogglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          executeDirectRelativeSeek(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          executeDirectRelativeSeek(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          onVolumeChange?.(Math.min(100, volume + 5));
          resetControlsTimer();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onVolumeChange?.(Math.max(0, volume - 5));
          resetControlsTimer();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          onToggleMute?.();
          resetControlsTimer();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 't':
        case 'T':
          e.preventDefault();
          setIsTheaterMode(prev => !prev);
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          toggleCaptions();
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else if (isTheaterMode) {
            setIsTheaterMode(false);
          } else {
            onClose?.();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    videoModalSong,
    isPipActive,
    volume,
    isTheaterMode,
    handleDirectTogglePlayPause,
    executeDirectRelativeSeek,
    onVolumeChange,
    onToggleMute,
    onClose,
    resetControlsTimer,
    toggleFullscreen,
    toggleCaptions
  ]);

  const progressPercent = activeDuration > 0 ? Math.min(100, Math.max(0, (activeCurrentTime / activeDuration) * 100)) : 0;

  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const s = Math.floor(secs);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`;
    }
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const getClientX = (e) => {
    if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
    return e.clientX;
  };

  const handleProgressBarMouseMove = (e) => {
    if (!progressBarRef.current || activeDuration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clientX = getClientX(e);
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setHoverSeekPercent(pos * 100);
    setHoverSeekTime(pos * activeDuration);
  };

  const handleProgressBarMouseLeave = () => {
    setHoverSeekTime(null);
  };

  return (
    <div
      onClick={(e) => {
        if (videoModalSong && !isPipActive && e.target === e.currentTarget) {
          onClose?.();
        }
      }}
      className={
        !videoModalSong
          ? "fixed top-0 left-0 w-[1px] h-[1px] opacity-[0.01] pointer-events-none -z-[999] overflow-hidden"
          : isPipActive
            ? "fixed inset-0 w-screen h-screen z-[999999] bg-black m-0 p-0 overflow-hidden pointer-events-auto"
            : "fixed inset-0 z-[9999] bg-neutral-950/90 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 md:p-6 transition-all duration-300 pointer-events-auto overflow-y-auto"
      }
    >
      <div
        ref={playerContainerRef}
        className={
          !videoModalSong
            ? "w-full h-full"
            : isPipActive
              ? "w-full h-full bg-black border-0 rounded-none overflow-hidden flex flex-col p-0 m-0"
              : `w-full bg-neutral-900/95 backdrop-blur-2xl border border-neutral-800 rounded-3xl overflow-hidden shadow-[0_20px_70px_rgba(0,0,0,0.95)] shadow-amber-500/5 flex flex-col transition-all duration-300 relative ${
                  isTheaterMode
                    ? 'max-w-[98vw] max-h-[96vh]'
                    : 'max-w-5xl max-h-[94vh]'
                }`
        }
      >
        {videoModalSong && !isPipActive && (
          <header
            style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}
            className="px-3 sm:px-6 py-2.5 sm:py-3.5 bg-neutral-900/95 border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0 select-none w-full"
          >
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-0.5 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.3)] shrink-0">
                <div className="w-full h-full bg-neutral-950 rounded-[10px] flex items-center justify-center">
                  <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span className="font-display font-extrabold text-xs sm:text-base tracking-wider text-white">
                  LOOPRA
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[9px] sm:text-[10px] font-bold tracking-widest text-amber-300 uppercase shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  VIDEO MODE
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center text-center flex-1 min-w-0 px-2 overflow-hidden">
              <h3 className="font-bold text-xs sm:text-sm text-white truncate w-full max-w-full">
                {activeSong?.title || 'Unknown Title'}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-neutral-400 truncate w-full max-w-full flex items-center justify-center gap-1">
                <span className="truncate">{activeSong?.channel || activeSong?.artist || 'Loopra Artist'}</span>
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 inline" />
              </p>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                onClick={() => onToggleLike?.(activeSong)}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  isLiked
                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-amber-300'
                }`}
                title={isLiked ? 'Remove from Favorites' : 'Add to Favorites'}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current text-rose-500' : ''}`} />
              </button>

              <button
                onClick={() => onShare?.(activeSong)}
                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
                title="Share Track"
              >
                <Share2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsPipActive?.(true)}
                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer hidden sm:flex items-center justify-center"
                title="Minimize to Picture-in-Picture"
              >
                <Minimize2 className="w-4 h-4" />
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-amber-300 transition cursor-pointer"
                title="Switch to Music Mode (Audio continues in background)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>
        )}

        <div
          onMouseMove={resetControlsTimer}
          className={
            !videoModalSong
              ? "w-full h-full"
              : isPipActive
                ? "w-full h-full bg-black overflow-hidden flex items-center justify-center p-0 m-0"
                : "relative w-full aspect-video bg-black overflow-hidden select-none group flex items-center justify-center"
          }
        >
          <div ref={ytContainerRef} className="w-full h-full relative z-0 pointer-events-none">
            <div id="yt-player-instance"></div>
          </div>

          {videoModalSong && !isPipActive && (
            <>
              {/* Central Play/Pause Tap Overlay */}
              <div
                onClick={() => {
                  if (!showControls) {
                    resetControlsTimer();
                  } else {
                    handleDirectTogglePlayPause();
                  }
                }}
                onDoubleClick={toggleFullscreen}
                className="absolute inset-0 z-20 flex items-center justify-center cursor-pointer pointer-events-auto"
              >
                <button
                  type="button"
                  onClick={handleDirectTogglePlayPause}
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-neutral-950/80 backdrop-blur-md border border-amber-500/50 flex items-center justify-center text-amber-400 transition-all duration-200 hover:scale-110 active:scale-95 hover:bg-amber-500 hover:text-neutral-950 shadow-[0_0_30px_rgba(0,0,0,0.85)] cursor-pointer pointer-events-auto z-30 ${
                    showControls || !isPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                  }`}
                  aria-label={isPlaying ? 'Pause Video' : 'Play Video'}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current translate-x-0.5" />
                  )}
                </button>
              </div>

              {/* Custom Playback Controls Overlay */}
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute inset-x-0 bottom-0 z-30 transition-opacity duration-300 flex flex-col justify-end ${
                  showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
              >
                <div className="bg-gradient-to-t from-neutral-950/98 via-neutral-950/85 to-transparent pt-12 pb-2 px-3 sm:px-5 flex flex-col gap-2 pointer-events-auto">
                  {/* Touch & Mouse Interactive Scrub Progress Bar */}
                  <div
                    ref={progressBarRef}
                    onMouseMove={handleProgressBarMouseMove}
                    onMouseLeave={handleProgressBarMouseLeave}
                    className="relative w-full h-5 flex items-center cursor-pointer group/scrub touch-none select-none"
                  >
                    <div className="w-full h-2 group-hover/scrub:h-2.5 bg-neutral-700/70 rounded-full overflow-visible relative flex items-center">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 rounded-full relative"
                        style={{ width: `${progressPercent}%` }}
                      >
                        <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-amber-400 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.95)] ring-2 ring-amber-500" />
                      </div>
                    </div>

                    {/* Transparent Full-Width Native Range Input for Smooth Mobile Touch Sliding & Desktop Dragging */}
                    <input
                      type="range"
                      min={0}
                      max={activeDuration > 0 ? activeDuration : 100}
                      step={0.1}
                      value={activeCurrentTime}
                      onMouseDown={() => {
                        setIsScrubbing(true);
                        setScrubTime(activeCurrentTime);
                      }}
                      onTouchStart={() => {
                        setIsScrubbing(true);
                        setScrubTime(activeCurrentTime);
                      }}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setScrubTime(val);
                        executeDirectSeek(val);
                      }}
                      onMouseUp={(e) => {
                        setIsScrubbing(false);
                        executeDirectSeek(Number(e.currentTarget.value));
                      }}
                      onTouchEnd={(e) => {
                        setIsScrubbing(false);
                        executeDirectSeek(Number(e.currentTarget.value));
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 m-0"
                      aria-label="Seek Video"
                    />

                    {hoverSeekTime !== null && (
                      <div
                        className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-[10px] font-mono text-white shadow-lg pointer-events-none"
                        style={{ left: `${hoverSeekPercent}%` }}
                      >
                        {formatTime(hoverSeekTime)}
                      </div>
                    )}
                  </div>

                  {/* Controls Row */}
                  <div className="flex items-center justify-between gap-2 pt-0.5 pb-1">
                    <div className="flex items-center gap-1.5 sm:gap-2.5">
                      <button
                        type="button"
                        onClick={handleDirectTogglePlayPause}
                        className="p-2 rounded-xl text-white hover:text-amber-400 hover:bg-neutral-800 active:scale-95 transition cursor-pointer"
                        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          executeDirectRelativeSeek(-10);
                        }}
                        className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 active:scale-95 transition cursor-pointer relative group/btn"
                        title="Rewind 10s (Left Arrow)"
                      >
                        <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="absolute text-[8px] font-bold font-mono top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                          10
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          executeDirectRelativeSeek(10);
                        }}
                        className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 active:scale-95 transition cursor-pointer relative group/btn"
                        title="Forward 10s (Right Arrow)"
                      >
                        <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="absolute text-[8px] font-bold font-mono top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                          10
                        </span>
                      </button>

                      <div className="flex items-center gap-1 group/vol">
                        <button
                          type="button"
                          onClick={onToggleMute}
                          className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                          title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                          ) : volume < 50 ? (
                            <Volume1 className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </button>
                        <div className="w-0 group-hover/vol:w-16 sm:group-hover/vol:w-20 transition-all duration-300 overflow-hidden flex items-center">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={isMuted ? 0 : volume}
                            onChange={(e) => onVolumeChange?.(Number(e.target.value))}
                            className="w-16 sm:w-20 h-1 accent-amber-500 bg-neutral-700 rounded-full cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="text-[11px] sm:text-xs font-mono font-medium text-neutral-300 ml-1">
                        <span className="text-white font-semibold">{formatTime(activeCurrentTime)}</span>
                        <span className="text-neutral-500 mx-1">/</span>
                        <span className="text-neutral-400">{formatTime(activeDuration)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 relative">
                      <button
                        type="button"
                        onClick={toggleCaptions}
                        className={`p-2 rounded-xl transition cursor-pointer ${
                          captionsEnabled
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                            : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
                        }`}
                        title="Subtitles / Captions (C)"
                      >
                        <Subtitles className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsTheaterMode(!isTheaterMode)}
                        className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition cursor-pointer hidden md:flex items-center justify-center"
                        title={isTheaterMode ? 'Exit Theater Mode (T)' : 'Theater Mode (T)'}
                      >
                        <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                        title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : (
                          <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {videoModalSong && !isPipActive && (
          <footer className="px-4 py-3 sm:px-6 sm:py-3.5 bg-neutral-900/95 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden bg-neutral-800 ring-2 ring-amber-500/30 shrink-0 shadow-md">
                {activeSong?.thumbnail ? (
                  <img
                    src={activeSong.thumbnail}
                    alt={activeSong?.channel || activeSong?.artist || 'Artist'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-amber-500/20 text-amber-300 font-bold text-xs">
                    {activeSong?.channel?.[0] || 'L'}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs sm:text-sm text-white truncate">
                    {activeSong?.channel || activeSong?.artist || 'Loopra Official Channel'}
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                  <span>Stereo Hi-Fi</span>
                  <span>•</span>
                  <span className="text-amber-400 font-medium">Loopra Engine</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 font-bold text-xs tracking-wide flex items-center gap-2 shadow-lg shadow-amber-500/20 border border-amber-400/50 transition-all cursor-pointer shrink-0"
              title="Switch to background audio mode (Music continues playing uninterrupted)"
            >
              <Music className="w-4 h-4 text-neutral-950 shrink-0" />
              <span>Switch to Music Mode</span>
              <span className="text-[10px] opacity-80 hidden sm:inline">(Audio continues)</span>
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
