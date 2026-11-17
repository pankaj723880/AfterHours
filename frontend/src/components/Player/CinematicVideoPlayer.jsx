import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getApiUrl } from '../../utils/apiUrl';
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
  CheckCircle2,
  Sliders,
  Check
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
  const [captionsEnabled, setCaptionsEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage?.getItem('loopra_captions_enabled') === 'true';
  });
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage?.getItem('loopra_subtitle_lang') || '';
  });
  const [subtitleLines, setSubtitleLines] = useState([]);
  const [activeSubtitleText, setActiveSubtitleText] = useState('');
  const [showCaptionsMenu, setShowCaptionsMenu] = useState(false);
  const [isLoadingCaptions, setIsLoadingCaptions] = useState(false);
  const captionsMenuRef = useRef(null);

  const [hoverSeekTime, setHoverSeekTime] = useState(null);
  const [hoverSeekPercent, setHoverSeekPercent] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [availableQualities, setAvailableQualities] = useState([]);
  const [actualQuality, setActualQuality] = useState(() => {
    return 'unknown';
  });
  const [requestedQuality, setRequestedQuality] = useState(() => {
    if (typeof window === 'undefined') return 'tiny';
    return window.sessionStorage?.getItem('loopra_user_selected_quality') || 'tiny';
  });
  const qualityMenuRef = useRef(null);

  // Check if device is mobile or running inside Android TWA / PWA
  const [isMobileOrApp, setIsMobileOrApp] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isMobileWidth = window.innerWidth < 768;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator?.userAgent || '');
    const isTwaOrStandalone = Boolean(
      window.LoopraAndroid ||
      window.navigator?.standalone ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    );
    return isMobileWidth || isMobileUA || isTwaOrStandalone;
  });

  useEffect(() => {
    const handleResize = () => {
      const isMobileWidth = window.innerWidth < 768;
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator?.userAgent || '');
      const isTwaOrStandalone = Boolean(
        window.LoopraAndroid ||
        window.navigator?.standalone ||
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      );
      setIsMobileOrApp(isMobileWidth || isMobileUA || isTwaOrStandalone);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const playerContainerRef = useRef(null);
  const progressBarRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const activeSong = currentSong || videoModalSong;

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setIsFullscreen(isFs);
      if (!isFs) {
        // Unlock orientation if returning from fullscreen
        try {
          if (screen?.orientation?.unlock) {
            screen.orientation.unlock().catch(() => { });
          }
        } catch (_) { }
      }
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
          const p = playerRef.current.playVideo();
          if (p && typeof p.catch === 'function') {
            p.catch(err => {
              console.warn('[CinematicVideoPlayer] playVideo catch:', err);
            });
          }
        }
      }
    } catch (_) { }
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
      } catch (e) { }
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
    } catch (_) { }
    onSeek?.(clamped);
    resetControlsTimer();
  }, [activeDuration, onSeek, playerRef, resetControlsTimer]);

  const executeDirectRelativeSeek = useCallback((deltaSeconds) => {
    const base = internalTime || currentTime || 0;
    const target = Math.max(0, Math.min(activeDuration || 3600, base + deltaSeconds));
    executeDirectSeek(target);
  }, [internalTime, currentTime, activeDuration, executeDirectSeek]);

  const toggleFullscreen = useCallback(async () => {
    if (!playerContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        if (playerContainerRef.current.requestFullscreen) {
          await playerContainerRef.current.requestFullscreen();
        } else if (playerContainerRef.current.webkitRequestFullscreen) {
          await playerContainerRef.current.webkitRequestFullscreen();
        } else if (playerContainerRef.current.msRequestFullscreen) {
          await playerContainerRef.current.msRequestFullscreen();
        }
        // Force / trigger YouTube-style landscape orientation on mobile/tablets
        try {
          if (screen?.orientation?.lock) {
            await screen.orientation.lock('landscape').catch(() => { });
          }
        } catch (_) { }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
        try {
          if (screen?.orientation?.unlock) {
            screen.orientation.unlock().catch(() => { });
          }
        } catch (_) { }
      }
    } catch (_) { }
  }, []);

  // Quality Label Mapper
  const getQualityLabel = (q) => {
    switch (q) {
      case 'tiny': return '144p';
      case 'small': return '240p (Data Saver)';
      case 'medium': return '360p';
      case 'large': return '480p';
      case 'hd720': return '720p HD';
      case 'hd1080': return '1080p Full HD';
      case 'highres': return 'Original / High';
      case 'auto':
      case 'default': return 'Auto';
      default: return q;
    }
  };

  // Keep track of active resolution broadcast from player events
  useEffect(() => {
    const handleQualityChange = (e) => {
      const newQ = e?.detail?.quality;
      if (newQ && newQ !== 'unknown') {
        setActualQuality(newQ);
      }
    };
    window.addEventListener('loopra:playback-quality-change', handleQualityChange);
    return () => window.removeEventListener('loopra:playback-quality-change', handleQualityChange);
  }, []);

  // Poll player actual quality on playback
  useEffect(() => {
    if (!videoModalSong) return;
    const interval = setInterval(() => {
      try {
        if (playerRef?.current && typeof playerRef.current.getPlaybackQuality === 'function') {
          const q = playerRef.current.getPlaybackQuality();
          if (q && q !== 'unknown') {
            setActualQuality(q);
          }
        }
      } catch (_) {}
    }, 1000);
    return () => clearInterval(interval);
  }, [videoModalSong, playerRef]);

  // Retrieve available qualities from YouTube player and toggle menu
  const toggleQualityMenu = useCallback(() => {
    setShowQualityMenu(prev => {
      const next = !prev;
      if (next && playerRef?.current) {
        try {
          if (typeof playerRef.current.getAvailableQualityLevels === 'function') {
            const levels = playerRef.current.getAvailableQualityLevels() || [];
            const validLevels = Array.isArray(levels) ? levels.filter(Boolean) : [];
            // Ensure 144p ('tiny') is in the list
            const combined = Array.from(new Set(['tiny', ...(validLevels.length > 0 ? validLevels : ['small', 'medium', 'large', 'hd720'])]));
            setAvailableQualities(combined);
          } else {
            setAvailableQualities(['tiny', 'small', 'medium', 'large', 'hd720']);
          }
          if (typeof playerRef.current.getPlaybackQuality === 'function') {
            const q = playerRef.current.getPlaybackQuality();
            if (q && q !== 'unknown') setActualQuality(q);
          }
        } catch (_) {
          setAvailableQualities(['tiny', 'small', 'medium', 'large', 'hd720']);
        }
      }
      return next;
    });
    resetControlsTimer();
  }, [playerRef, resetControlsTimer]);

  const handleSelectQuality = useCallback((quality) => {
    try {
      let targetQ = quality;
      if (playerRef?.current) {
        if (typeof playerRef.current.getAvailableQualityLevels === 'function') {
          const avail = playerRef.current.getAvailableQualityLevels() || [];
          if (avail.length > 0 && !avail.includes(quality)) {
            // Quality ladder: high to low
            const ladder = ['highres', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
            const targetIdx = ladder.indexOf(quality);
            // Nearest available lower quality
            const lowerOption = ladder.slice(targetIdx + 1).find(opt => avail.includes(opt));
            if (lowerOption) {
              targetQ = lowerOption;
              showToast?.(`${getQualityLabel(quality)} unavailable, switched to ${getQualityLabel(lowerOption)}`);
            }
          }
        }
        if (typeof playerRef.current.setPlaybackQuality === 'function') {
          playerRef.current.setPlaybackQuality(targetQ);
        }
      }

      // Persist user selection across session so subsequent songs respect it
      if (typeof window !== 'undefined') {
        window.sessionStorage?.setItem('loopra_user_selected_quality', targetQ);
      }
      setRequestedQuality(targetQ);
      showToast?.(`Requested resolution: ${getQualityLabel(targetQ)}`);
    } catch (_) {
      showToast?.(`Failed to change quality`);
    }
    setShowQualityMenu(false);
    resetControlsTimer();
  }, [playerRef, showToast, resetControlsTimer]);

  // Subtitle/Caption Tracks Loader & Synchronizer
  const currentVideoId = activeSong?.id || activeSong?.videoId;

  useEffect(() => {
    // When song changes, reset active subtitles immediately so old text does not linger
    setActiveSubtitleText('');
    setSubtitleLines([]);
    setSubtitleTracks([]);

    if (!currentVideoId) return;

    let isCancelled = false;
    setIsLoadingCaptions(true);

    const backendCaptionsUrl = `${getApiUrl('/api/youtube/captions')}/${encodeURIComponent(currentVideoId)}`;

    fetch(backendCaptionsUrl)
      .then(res => res.json())
      .then(data => {
        if (isCancelled) return;
        setIsLoadingCaptions(false);
        const tracks = Array.isArray(data?.tracks) ? data.tracks : [];
        setSubtitleTracks(tracks);

        // If user already had captions enabled, auto-load their preferred language or first available track
        const savedPref = typeof window !== 'undefined' ? window.sessionStorage?.getItem('loopra_subtitle_lang') : '';
        const savedEnabled = typeof window !== 'undefined' ? (window.sessionStorage?.getItem('loopra_captions_enabled') === 'true') : false;

        if (savedEnabled && tracks.length > 0) {
          const matched = tracks.find(t => t.languageCode === savedPref) || tracks[0];
          const langToLoad = matched.languageCode;
          setSelectedLanguage(langToLoad);
          loadSubtitleLines(currentVideoId, langToLoad);
        }
      })
      .catch(err => {
        if (isCancelled) return;
        setIsLoadingCaptions(false);
        setSubtitleTracks([]);
      });

    return () => {
      isCancelled = true;
      setActiveSubtitleText('');
      setSubtitleLines([]);
    };
  }, [currentVideoId]);

  const loadSubtitleLines = useCallback(async (vid, lang) => {
    if (!vid || !lang) return;
    try {
      const url = `${getApiUrl('/api/youtube/captions')}/${encodeURIComponent(vid)}?lang=${encodeURIComponent(lang)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data?.lines) && data.lines.length > 0) {
        setSubtitleLines(data.lines);
      } else {
        setSubtitleLines([]);
      }
    } catch (_) {
      setSubtitleLines([]);
    }
  }, []);

  // Sync subtitle text with current playback time (using activeCurrentTime which tracks playerRef every 250ms)
  useEffect(() => {
    if (!captionsEnabled || subtitleLines.length === 0) {
      if (activeSubtitleText) setActiveSubtitleText('');
      return;
    }

    const t = Number(activeCurrentTime) || 0;
    // Find matching caption line
    const match = subtitleLines.find(line => t >= line.start && t <= line.end);
    if (match) {
      if (activeSubtitleText !== match.text) {
        setActiveSubtitleText(match.text);
      }
    } else {
      if (activeSubtitleText) {
        setActiveSubtitleText('');
      }
    }
  }, [activeCurrentTime, captionsEnabled, subtitleLines, activeSubtitleText]);

  const toggleCaptions = useCallback(() => {
    if (subtitleTracks.length === 0 && !isLoadingCaptions) {
      showToast?.('Subtitles unavailable for this video');
      return;
    }

    const next = !captionsEnabled;
    setCaptionsEnabled(next);
    if (typeof window !== 'undefined') {
      window.sessionStorage?.setItem('loopra_captions_enabled', next ? 'true' : 'false');
    }

    if (next) {
      // If no language chosen yet, pick first available
      let lang = selectedLanguage;
      if (!lang && subtitleTracks.length > 0) {
        lang = subtitleTracks[0].languageCode;
        setSelectedLanguage(lang);
        if (typeof window !== 'undefined') {
          window.sessionStorage?.setItem('loopra_subtitle_lang', lang);
        }
      }
      if (lang && currentVideoId) {
        loadSubtitleLines(currentVideoId, lang);
      }
      showToast?.('Subtitles enabled');
    } else {
      setActiveSubtitleText('');
      showToast?.('Subtitles disabled');
    }
  }, [captionsEnabled, subtitleTracks, isLoadingCaptions, selectedLanguage, currentVideoId, loadSubtitleLines, showToast]);

  const handleSelectLanguage = useCallback((langCode) => {
    setSelectedLanguage(langCode);
    setCaptionsEnabled(true);
    if (typeof window !== 'undefined') {
      window.sessionStorage?.setItem('loopra_captions_enabled', 'true');
      window.sessionStorage?.setItem('loopra_subtitle_lang', langCode);
    }
    if (currentVideoId) {
      loadSubtitleLines(currentVideoId, langCode);
    }
    setShowCaptionsMenu(false);
    const track = subtitleTracks.find(t => t.languageCode === langCode);
    showToast?.(`Subtitles set to ${track?.languageName || langCode}`);
  }, [currentVideoId, subtitleTracks, loadSubtitleLines, showToast]);

  // Close quality and captions menus on outside click
  useEffect(() => {
    if (!showQualityMenu && !showCaptionsMenu) return;
    const handleOutsideClick = (e) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target)) {
        setShowQualityMenu(false);
      }
      if (captionsMenuRef.current && !captionsMenuRef.current.contains(e.target)) {
        setShowCaptionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showQualityMenu, showCaptionsMenu]);

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
            document.exitFullscreen().catch(() => { });
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
            : "fixed inset-0 z-[9999] bg-neutral-950/95 backdrop-blur-xl flex items-center justify-center p-0 sm:p-4 md:p-6 transition-all duration-300 pointer-events-auto overflow-hidden"
      }
    >
      <div
        ref={playerContainerRef}
        className={
          !videoModalSong
            ? "w-full h-full"
            : isPipActive
              ? "w-full h-full bg-black border-0 rounded-none overflow-hidden flex flex-col p-0 m-0"
              : isFullscreen
                ? "w-screen h-screen max-w-none max-h-none rounded-none border-0 bg-black flex flex-col justify-between overflow-hidden relative m-0 p-0 shadow-none"
                : isMobileOrApp
                  ? `w-full h-full max-h-[100dvh] bg-neutral-900/98 overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.95)] shadow-amber-500/5 flex flex-col transition-all duration-300 relative aspect-[9/16]`
                  : `w-full my-auto bg-neutral-900/95 backdrop-blur-2xl border border-neutral-800/90 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.95)] shadow-amber-500/5 flex flex-col transition-all duration-300 relative ${
                      isTheaterMode
                        ? 'max-w-[98vw] max-h-[96vh]'
                        : 'max-w-5xl max-h-[94vh]'
                    }`
        }
      >
        {videoModalSong && !isPipActive && (
          <header
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            className={`w-full border-b transition-colors select-none z-40 shrink-0 ${isFullscreen
                ? `absolute top-0 inset-x-0 bg-gradient-to-b from-black/90 via-black/60 to-transparent border-transparent px-4 sm:px-8 py-3.5 sm:py-5 transition-opacity duration-300 pointer-events-auto ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`
                : 'px-4 sm:px-7 py-3 sm:py-4 bg-neutral-900/95 border-neutral-800/80 shadow-sm'
              }`}
          >
            <div className="w-full flex items-center justify-between gap-3 sm:gap-6">
              {/* Branding */}
              <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-0.5 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.35)] shrink-0">
                  <div className="w-full h-full bg-neutral-950 rounded-[10px] flex items-center justify-center">
                    <Music className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400" />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-display font-black text-sm sm:text-base tracking-wider text-white">
                    LOOPRA
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold tracking-widest text-amber-300 uppercase shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    VIDEO MODE
                  </span>
                </div>
              </div>

              {/* Title & Artist - Clean Centered Readout */}
              <div className="flex flex-col items-center justify-center text-center flex-1 min-w-0 px-2 sm:px-4 overflow-hidden">
                <h3 className="font-bold text-xs sm:text-sm md:text-base text-white truncate w-full max-w-full drop-shadow-sm">
                  {activeSong?.title || 'Unknown Title'}
                </h3>
                <p className="text-[11px] sm:text-xs text-neutral-400 truncate w-full max-w-full flex items-center justify-center gap-1.5 mt-0.5">
                  <span className="truncate">{activeSong?.channel || activeSong?.artist || 'Loopra Artist'}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 inline" />
                </p>
              </div>

              {/* Actions Header Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleLike?.(activeSong)}
                  className={`p-2 sm:p-2.5 rounded-xl transition cursor-pointer active:scale-95 ${isLiked
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                      : isFullscreen
                        ? 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-amber-300 backdrop-blur-md'
                        : 'bg-neutral-800/90 hover:bg-neutral-700 text-neutral-300 hover:text-amber-300'
                    }`}
                  title={isLiked ? 'Remove from Favorites' : 'Add to Favorites'}
                >
                  <Heart className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isLiked ? 'fill-current text-rose-500' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => onShare?.(activeSong)}
                  className={`p-2 sm:p-2.5 rounded-xl transition cursor-pointer active:scale-95 ${isFullscreen
                      ? 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white backdrop-blur-md'
                      : 'bg-neutral-800/90 hover:bg-neutral-700 text-neutral-300 hover:text-white'
                    }`}
                  title="Share Track"
                >
                  <Share2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsPipActive?.(true)}
                  className={`p-2 sm:p-2.5 rounded-xl transition cursor-pointer active:scale-95 hidden sm:flex items-center justify-center ${isFullscreen
                      ? 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white backdrop-blur-md'
                      : 'bg-neutral-800/90 hover:bg-neutral-700 text-neutral-300 hover:text-white'
                    }`}
                  title="Minimize to Picture-in-Picture"
                >
                  <Minimize2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className={`p-2 sm:p-2.5 rounded-xl transition cursor-pointer active:scale-95 ${isFullscreen
                      ? 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-amber-300 backdrop-blur-md'
                      : 'bg-neutral-800/90 hover:bg-neutral-700 text-neutral-300 hover:text-amber-300'
                    }`}
                  title="Switch to Music Mode (Audio continues in background)"
                >
                  <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>
              </div>
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
                : isFullscreen
                  ? "relative w-full h-full flex-1 bg-black overflow-hidden select-none group flex items-center justify-center"
                  : isMobileOrApp
                    ? "relative w-full h-full flex-1 bg-black overflow-hidden select-none group flex items-center justify-center"
                    : "relative w-full aspect-video bg-black overflow-hidden select-none group flex items-center justify-center"
          }
        >
          <div ref={ytContainerRef} className={`w-full h-full relative z-0 pointer-events-none flex items-center justify-center ${isMobileOrApp ? 'overflow-hidden' : ''}`}>
            <div id="yt-player-instance" className={`w-full h-full ${isMobileOrApp ? 'object-cover' : ''}`}></div>
          </div>

          {videoModalSong && !isPipActive && (
            <>
              {/* Synchronized Closed Captions Overlay Display */}
              {captionsEnabled && activeSubtitleText && (
                <div
                  className={`absolute inset-x-4 sm:inset-x-12 z-35 pointer-events-none flex justify-center transition-all duration-200 ${showControls || !isPlaying ? 'bottom-28 sm:bottom-24' : 'bottom-10 sm:bottom-12'}`}
                >
                  <div className="max-w-2xl px-4 py-2 sm:py-2.5 rounded-xl bg-black/90 backdrop-blur-md border border-white/20 shadow-2xl text-center">
                    <p className="text-white text-xs sm:text-sm md:text-base font-semibold tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] leading-relaxed select-none">
                      {activeSubtitleText}
                    </p>
                  </div>
                </div>
              )}

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
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-neutral-950/80 backdrop-blur-md border border-amber-500/50 flex items-center justify-center text-amber-400 transition-all duration-200 hover:scale-110 active:scale-95 hover:bg-amber-500 hover:text-neutral-950 shadow-[0_0_30px_rgba(0,0,0,0.85)] cursor-pointer pointer-events-auto z-30 ${showControls || !isPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
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

              {/* Custom Playback Controls Overlay - Full-Width Span */}
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute inset-x-0 bottom-0 z-30 transition-opacity duration-300 flex flex-col justify-end ${showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                  }`}
              >
                <div className={`bg-gradient-to-t from-neutral-950/98 via-neutral-950/85 to-transparent flex flex-col gap-2.5 pointer-events-auto w-full ${isFullscreen
                    ? 'pt-16 pb-6 px-4 sm:px-8'
                    : 'pt-12 pb-3 px-3 sm:px-6'
                  }`}>
                  <div className="w-full max-w-full mx-auto flex flex-col gap-2">
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
                    <div className="flex items-center justify-between gap-2 pt-0.5 pb-1 w-full">
                      <div className="flex items-center gap-1 sm:gap-2.5">
                        <button
                          type="button"
                          onClick={handleDirectTogglePlayPause}
                          className="p-2 sm:p-2.5 rounded-xl text-white hover:text-amber-400 hover:bg-neutral-800/80 active:scale-95 transition cursor-pointer"
                          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                        >
                          {isPlaying ? (
                            <Pause className="w-5 h-5 sm:w-5.5 sm:h-5.5 fill-current" />
                          ) : (
                            <Play className="w-5 h-5 sm:w-5.5 sm:h-5.5 fill-current" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            executeDirectRelativeSeek(-10);
                          }}
                          className="p-2 sm:p-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800/80 active:scale-95 transition cursor-pointer relative group/btn"
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
                          className="p-2 sm:p-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800/80 active:scale-95 transition cursor-pointer relative group/btn"
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
                            className="p-2 sm:p-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition cursor-pointer"
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
                        {/* Quality Resolution Switcher */}
                        <div className="relative" ref={qualityMenuRef}>
                          <button
                            type="button"
                            onClick={toggleQualityMenu}
                            className={`p-2 sm:p-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${showQualityMenu
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                                : 'text-neutral-300 hover:text-white hover:bg-neutral-800/80'
                              }`}
                            title="Video Resolution Settings"
                            aria-label="Video Resolution Settings"
                          >
                            <Sliders className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                            <span className="text-[11px] font-mono text-amber-300">
                              {actualQuality && actualQuality !== 'unknown'
                                ? (actualQuality === 'tiny' ? '144p' : actualQuality === 'small' ? '240p' : actualQuality === 'medium' ? '360p' : actualQuality === 'large' ? '480p' : actualQuality === 'hd720' ? '720p' : actualQuality === 'hd1080' ? '1080p' : actualQuality)
                                : (requestedQuality === 'tiny' ? '144p' : requestedQuality === 'small' ? '240p' : requestedQuality === 'medium' ? '360p' : requestedQuality === 'large' ? '480p' : requestedQuality === 'hd720' ? '720p' : 'Auto')}
                            </span>
                          </button>

                          {/* Clean Resolution Quality Popup */}
                          {showQualityMenu && (
                            <div className="absolute right-0 bottom-full mb-3 w-64 sm:w-72 bg-neutral-900/98 backdrop-blur-xl border border-neutral-700/80 rounded-2xl shadow-2xl p-2.5 z-50 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                              <div className="px-3 py-1.5 text-[11px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 flex items-center justify-between">
                                <span>Resolution</span>
                                <span className="text-amber-400 font-mono lowercase">
                                  {actualQuality && actualQuality !== 'unknown' ? `Playing: ${actualQuality === 'tiny' ? '144p' : actualQuality === 'medium' ? '360p' : actualQuality === 'small' ? '240p' : actualQuality}` : `Req: ${requestedQuality === 'tiny' ? '144p' : requestedQuality}`}
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto pt-1">
                                {availableQualities.map((q) => {
                                  const isSelected = requestedQuality === q;
                                  const isActual = actualQuality === q;
                                  return (
                                    <button
                                      key={q}
                                      type="button"
                                      onClick={() => handleSelectQuality(q)}
                                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between transition cursor-pointer ${isSelected
                                          ? 'bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30'
                                          : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                                        }`}
                                    >
                                      <span className="flex items-center gap-2">
                                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                        <span className={!isSelected ? 'ml-5.5' : ''}>{getQualityLabel(q)}</span>
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {isActual && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                                            Active
                                          </span>
                                        )}
                                        {q === 'tiny' && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                                            Default
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                              <p className="px-2 pt-1 text-[10px] text-neutral-400 border-t border-neutral-800/80 leading-tight">
                                Note: YouTube dynamic streaming adjusts bitrate based on device & network.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Interactive Subtitles / Closed Captions Toggle & Language Switcher */}
                        <div className="relative" ref={captionsMenuRef}>
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={toggleCaptions}
                              className={`p-2 sm:p-2.5 rounded-l-xl transition cursor-pointer flex items-center gap-1 ${captionsEnabled
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800/80'
                                }`}
                              title={subtitleTracks.length > 0 ? (captionsEnabled ? 'Turn Off Subtitles (C)' : 'Turn On Subtitles (C)') : 'Subtitles unavailable for this video'}
                              aria-label="Toggle Subtitles"
                            >
                              <Subtitles className="w-4 h-4 sm:w-5 sm:h-5" />
                              {captionsEnabled && selectedLanguage && (
                                <span className="hidden sm:inline-block text-[10px] font-mono text-amber-400 uppercase">
                                  {selectedLanguage.slice(0, 2)}
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowCaptionsMenu(prev => !prev);
                                resetControlsTimer();
                              }}
                              className={`p-1.5 sm:p-2 rounded-r-xl border-l border-white/10 transition cursor-pointer text-neutral-400 hover:text-white ${captionsEnabled ? 'bg-amber-500/20' : 'hover:bg-neutral-800/80'}`}
                              title="Subtitle Languages & Settings"
                              aria-label="Subtitle Languages"
                            >
                              <span className="text-[10px] leading-none select-none">▼</span>
                            </button>
                          </div>

                          {/* Subtitle Languages Popup */}
                          {showCaptionsMenu && (
                            <div className="absolute right-0 bottom-full mb-3 w-56 sm:w-64 bg-neutral-900/98 backdrop-blur-xl border border-neutral-700/80 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150">
                              <div className="px-3 py-1.5 text-[11px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 flex items-center justify-between">
                                <span>Subtitles / CC</span>
                                <span className="text-amber-400 font-mono text-[10px]">
                                  {subtitleTracks.length} available
                                </span>
                              </div>

                              <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCaptionsEnabled(false);
                                    setActiveSubtitleText('');
                                    if (typeof window !== 'undefined') {
                                      window.sessionStorage?.setItem('loopra_captions_enabled', 'false');
                                    }
                                    setShowCaptionsMenu(false);
                                    showToast?.('Subtitles turned off');
                                  }}
                                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between transition cursor-pointer ${!captionsEnabled
                                      ? 'bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30'
                                      : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                                    }`}
                                >
                                  <span className="flex items-center gap-2">
                                    {!captionsEnabled && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                    <span className={captionsEnabled ? 'ml-5.5' : ''}>Off</span>
                                  </span>
                                </button>

                                {isLoadingCaptions ? (
                                  <div className="px-3 py-3 text-center text-xs text-neutral-400">Loading subtitles...</div>
                                ) : subtitleTracks.length === 0 ? (
                                  <div className="px-3 py-3 text-center text-xs text-neutral-400">Subtitles unavailable</div>
                                ) : (
                                  subtitleTracks.map((tr) => {
                                    const isSelected = captionsEnabled && selectedLanguage === tr.languageCode;
                                    return (
                                      <button
                                        key={tr.languageCode + (tr.isAutoGenerated ? '_asr' : '')}
                                        type="button"
                                        onClick={() => handleSelectLanguage(tr.languageCode)}
                                        className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between transition cursor-pointer ${isSelected
                                            ? 'bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30'
                                            : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                                          }`}
                                      >
                                        <span className="flex items-center gap-2 truncate pr-2">
                                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                          <span className={`truncate ${!isSelected ? 'ml-5.5' : ''}`}>{tr.languageName || tr.languageCode}</span>
                                        </span>
                                        {tr.isAutoGenerated && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono shrink-0">
                                            auto
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsTheaterMode(!isTheaterMode)}
                          className="p-2 sm:p-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition cursor-pointer hidden md:flex items-center justify-center"
                          title={isTheaterMode ? 'Exit Theater Mode (T)' : 'Theater Mode (T)'}
                        >
                          <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>

                        <button
                          type="button"
                          onClick={toggleFullscreen}
                          className="p-2 sm:p-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition cursor-pointer active:scale-95"
                          title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                        >
                          {isFullscreen ? (
                            <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                          ) : (
                            <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {videoModalSong && !isPipActive && !isFullscreen && (
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
