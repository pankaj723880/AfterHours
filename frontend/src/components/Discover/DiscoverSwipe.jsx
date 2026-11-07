import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCleanThumbnail, isThumbnailUrlFormatValid } from '../../utils/storage';
import { filterSingleSongs, normalizeTrack } from '../../services/songFilter';
import { USE_V2_SWIPE_UI } from '../../constants/featureFlags';

export default function DiscoverSwipe({
  onPlaySong,
  onTogglePlay,
  currentSong,
  isPlaying,
  likedSongs = [],
  onToggleLike,
  showToast,
  fetchTracks,
  onNavigate
}) {
  const [deck, setDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [swipeAnimation, setSwipeAnimation] = useState(null); // 'left' | 'right' | null
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const isBufferingDeckRef = useRef(false);

  // Background queue buffer: appends fresh solo tracks seamlessly when user approaches end of deck
  const bufferNextTracks = useCallback(async () => {
    if (isBufferingDeckRef.current || typeof fetchTracks !== 'function') return;
    isBufferingDeckRef.current = true;
    try {
      const moreTracks = await fetchTracks();
      if (!isMountedRef.current || !Array.isArray(moreTracks)) return;

      const fresh = moreTracks.filter(t => {
        const id = t.id || t.videoId;
        return id && !seenIdsRef.current.has(id);
      });

      if (fresh.length > 0) {
        fresh.forEach(t => seenIdsRef.current.add(t.id || t.videoId));
        setDeck(prevDeck => [...prevDeck, ...fresh]);
      }
    } catch (_) {
      // Background buffer errors stay silent to avoid interrupting swipe UX
    } finally {
      isBufferingDeckRef.current = false;
    }
  }, [fetchTracks]);
  const lastActionTimeRef = useRef(0);
  const isMountedRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const playRequestIdRef = useRef(0);
  const bufferingTimerRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const seenIdsRef = useRef(new Set());

  // Keep latest mutable state in ref for safe keyboard and gesture handlers
  const stateRef = useRef({
    deck,
    currentIndex,
    currentCard: deck[currentIndex],
    isCurrentCardPlaying: false,
    likedSongs,
    onPlaySong,
    onTogglePlay,
    onToggleLike,
    currentSong,
    isPlaying
  });

  const currentCard = deck[currentIndex];
  const currentCardId = currentCard ? (currentCard.id || currentCard.videoId) : null;
  const isCurrentCardPlaying = Boolean(
    currentSong &&
    (currentSong.id === currentCardId || currentSong.videoId === currentCardId) &&
    isPlaying
  );

  useEffect(() => {
    stateRef.current = {
      deck,
      currentIndex,
      currentCard,
      isCurrentCardPlaying,
      likedSongs,
      onPlaySong,
      onTogglePlay,
      onToggleLike,
      currentSong,
      isPlaying
    };
  }, [deck, currentIndex, currentCard, isCurrentCardPlaying, likedSongs, onPlaySong, onTogglePlay, onToggleLike, currentSong, isPlaying]);

  // Component lifecycle: manage mount status and clean up timers
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (bufferingTimerRef.current) {
        clearTimeout(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Loads discovery tracks once on mount.
   * If a song is currently playing, ensures deck matches the active song.
   */
  const loadDiscoveryTracks = useCallback(async () => {
    if (!isMountedRef.current) return;
    setIsLoading(true);
    setPlaybackError(null);
    setAutoplayBlocked(false);

    try {
      if (typeof fetchTracks !== 'function') return;
      const candidates = await fetchTracks();
      if (!isMountedRef.current) return;

      if (Array.isArray(candidates) && candidates.length > 0) {
        const verifiedSingleSongs = filterSingleSongs(candidates);
        const sourceTracks = (verifiedSingleSongs.length > 0 ? verifiedSingleSongs : candidates)
          .filter(t => isThumbnailUrlFormatValid(getCleanThumbnail(t)));

        const fresh = sourceTracks.filter(t => {
          const id = t.id || t.videoId;
          return id && !seenIdsRef.current.has(id);
        });

        const tracksToUse = fresh.length > 0 ? fresh : sourceTracks;
        tracksToUse.forEach(t => seenIdsRef.current.add(t.id || t.videoId));

        // If a song is currently playing, align initial card to playing song
        let initialIndex = 0;
        const liveSong = stateRef.current?.currentSong;
        if (liveSong && (liveSong.id || liveSong.videoId)) {
          const liveId = liveSong.id || liveSong.videoId;
          const matchIdx = tracksToUse.findIndex(t => (t.id || t.videoId) === liveId);
          if (matchIdx > 0) {
            initialIndex = matchIdx;
          } else if (matchIdx === -1 && stateRef.current?.isPlaying) {
            tracksToUse.unshift(liveSong);
            initialIndex = 0;
          }
        }

        setDeck(tracksToUse);
        setCurrentIndex(initialIndex);
      }
    } catch (err) {
      if (isMountedRef.current && showToast) {
        showToast('Failed to load discovery deck', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchTracks, showToast]);

  // Load once on initial mount
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadDiscoveryTracks();
    }
  }, [loadDiscoveryTracks]);

  // Sync buffering and playback state with global player
  useEffect(() => {
    if (isCurrentCardPlaying) {
      setIsBuffering(false);
      setAutoplayBlocked(false);
      setPlaybackError(null);
      if (bufferingTimerRef.current) {
        clearTimeout(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
      }
    }
  }, [isCurrentCardPlaying]);

  // Preload upcoming 2-3 cards' cover images for instant, zero-latency transitions
  useEffect(() => {
    if (!deck || deck.length === 0) return;
    const preloadCount = 3;
    for (let i = 1; i <= preloadCount; i++) {
      const upcoming = deck[currentIndex + i];
      if (upcoming) {
        const thumbUrl = getCleanThumbnail(upcoming, upcoming.id || upcoming.videoId);
        if (thumbUrl && typeof Image !== 'undefined') {
          const img = new Image();
          img.src = thumbUrl;
        }
      }
    }
  }, [deck, currentIndex]);

  /**
   * Requests playback of the selected track directly through the existing global player.
   * Executed synchronously during the user's swipe interaction so autoplay restrictions do not block it.
   */
  const triggerAutoplay = useCallback((track) => {
    if (!track || !isMountedRef.current) return;
    const playFn = stateRef.current?.onPlaySong || onPlaySong;
    if (typeof playFn !== 'function') return;

    const normalizedTrack = normalizeTrack(track) || {
      ...track,
      id: track.id || track.videoId,
      videoId: track.videoId || track.id
    };

    const requestId = ++playRequestIdRef.current;
    setIsBuffering(true);
    setPlaybackError(null);
    setAutoplayBlocked(false);

    if (bufferingTimerRef.current) {
      clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = null;
    }

    try {
      playFn(normalizedTrack);
    } catch (err) {
      console.warn('[DiscoverSwipe] Playback invocation error:', err);
      if (isMountedRef.current) {
        setIsBuffering(false);
        setPlaybackError('Could not start playback. Tap to retry.');
      }
      return;
    }

    // Passive safety timeout: if browser autoplay is restricted, clear spinner after 6s
    // Crucially: DOES NOT auto-skip to any other song.
    bufferingTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && requestId === playRequestIdRef.current) {
        const liveCurrentSong = stateRef.current?.currentSong;
        const liveIsPlaying = stateRef.current?.isPlaying;
        const activeId = liveCurrentSong?.id || liveCurrentSong?.videoId;
        const targetId = normalizedTrack.id || normalizedTrack.videoId;
        if (activeId === targetId && liveIsPlaying) {
          setIsBuffering(false);
          setAutoplayBlocked(false);
        } else {
          setIsBuffering(false);
          setAutoplayBlocked(true);
        }
      }
    }, 6000);
  }, [onPlaySong]);

  /**
   * Explicit track advancement: selects exactly ONE new song.
   * Completely locks out concurrent input until the transition settles safely.
   * Starts playing the newly swiped song IMMEDIATELY within the user's gesture.
   */
  const handleSwipeAction = useCallback((direction) => {
    const now = Date.now();
    // Guard: ignore if already transitioning or called within 350ms of last action
    if (isTransitioningRef.current || now - lastActionTimeRef.current < 350) {
      return;
    }

    const { deck: currentDeck, currentIndex: activeIdx, currentCard: activeCard, onToggleLike: likeHandler } = stateRef.current;
    if (!activeCard || activeIdx >= currentDeck.length) {
      return;
    }

    isTransitioningRef.current = true;
    lastActionTimeRef.current = now;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });

    const activeCardId = activeCard.id || activeCard.videoId;

    if (direction === 'like') {
      const isAlreadyLiked = likedSongs.some(s => (s.id || s.videoId) === activeCardId);
      if (!isAlreadyLiked && typeof likeHandler === 'function') {
        likeHandler(activeCard);
        if (showToast) showToast(`Liked "${activeCard.title}"`, 'success');
      }
      setSwipeAnimation('right');
    } else {
      setSwipeAnimation('left');
    }

    const nextIndex = activeIdx + 1;
    const rawNextSong = currentDeck[nextIndex];

    if (!rawNextSong) {
      // Reached the end of the deck
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setCurrentIndex(nextIndex);
        setSwipeAnimation(null);
        setDragOffset({ x: 0, y: 0 });
        isTransitioningRef.current = false;
      }, 200);
      return;
    }

    const nextSong = normalizeTrack(rawNextSong) || {
      ...rawNextSong,
      id: rawNextSong.id || rawNextSong.videoId,
      videoId: rawNextSong.videoId || rawNextSong.id
    };

    // 1. Immediately initiate playback of the next song directly from the user's gesture
    triggerAutoplay(nextSong);

    // 2. Settle transition after visual fly-out animation (200ms)
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setCurrentIndex(nextIndex);
      setSwipeAnimation(null);
      setDragOffset({ x: 0, y: 0 });

      // Release transition lock after UI update has fully rendered
      setTimeout(() => {
        if (isMountedRef.current) {
          isTransitioningRef.current = false;
        }
      }, 100);

      // Check remaining cards in deck: if <= 4 remaining, silently buffer more solo tracks in background
      if (currentDeck.length - nextIndex <= 4) {
        bufferNextTracks();
      }
    }, 200);
  }, [likedSongs, showToast, triggerAutoplay, bufferNextTracks]);

  /**
   * Explicit previous track navigation
   */
  const handlePrevCard = useCallback(() => {
    const now = Date.now();
    if (isTransitioningRef.current || now - lastActionTimeRef.current < 350) return;

    const { deck: currentDeck, currentIndex: activeIdx } = stateRef.current;
    if (activeIdx <= 0) return;

    isTransitioningRef.current = true;
    lastActionTimeRef.current = now;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });

    const prevIndex = activeIdx - 1;
    const rawPrevSong = currentDeck[prevIndex];
    const prevSong = rawPrevSong ? (normalizeTrack(rawPrevSong) || {
      ...rawPrevSong,
      id: rawPrevSong.id || rawPrevSong.videoId,
      videoId: rawPrevSong.videoId || rawPrevSong.id
    }) : null;

    setCurrentIndex(prevIndex);
    if (prevSong) {
      triggerAutoplay(prevSong);
    }

    setTimeout(() => {
      if (isMountedRef.current) {
        isTransitioningRef.current = false;
      }
    }, 300);
  }, [triggerAutoplay]);

  /**
   * Explicit Play / Pause toggle for the currently displayed card
   */
  const handlePlayToggle = useCallback(() => {
    if (isTransitioningRef.current) return;
    const { currentCard: activeCard, isCurrentCardPlaying: isPlayingNow, onTogglePlay: toggleHandler } = stateRef.current;
    if (!activeCard) return;

    const targetSong = normalizeTrack(activeCard) || {
      ...activeCard,
      id: activeCard.id || activeCard.videoId,
      videoId: activeCard.videoId || activeCard.id
    };

    if (isPlayingNow) {
      if (typeof toggleHandler === 'function') {
        toggleHandler();
      }
    } else {
      triggerAutoplay(targetSong);
    }
  }, [triggerAutoplay]);

  // Touch gesture handlers
  const handleTouchStart = (e) => {
    if (isTransitioningRef.current || swipeAnimation) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || isTransitioningRef.current || swipeAnimation) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    setDragOffset({ x: dx, y: dy });
  };

  const handleTouchEnd = () => {
    if (!isDragging || isTransitioningRef.current) return;
    setIsDragging(false);

    const threshold = 85;
    const currentDx = dragOffset.x;
    setDragOffset({ x: 0, y: 0 });

    if (currentDx > threshold) {
      handleSwipeAction('like');
    } else if (currentDx < -threshold) {
      handleSwipeAction('skip');
    }
  };

  // Mouse drag handler on card with clean window-level listeners
  const handleMouseDown = (e) => {
    if (isTransitioningRef.current || swipeAnimation || e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    setIsDragging(true);

    const onMouseMove = (moveEvent) => {
      if (isTransitioningRef.current) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setDragOffset({ x: dx, y: dy });
    };

    const onMouseUp = (upEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);

      if (isTransitioningRef.current) return;
      const dx = upEvent.clientX - startX;
      setDragOffset({ x: 0, y: 0 });

      if (dx > 85) {
        handleSwipeAction('like');
      } else if (dx < -85) {
        handleSwipeAction('skip');
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Register keyboard accessibility listeners once on mount
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      if (e.key === 'ArrowRight') {
        handleSwipeAction('like');
      } else if (e.key === 'ArrowLeft') {
        handleSwipeAction('skip');
      } else if (e.key === ' ') {
        e.preventDefault();
        handlePlayToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipeAction, handlePlayToggle]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-neutral-300">Shuffling Discover Deck...</p>
      </div>
    );
  }

  if (!currentCard || currentIndex >= deck.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-sm mx-auto space-y-4 animate-fadeIn">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl">
          ✨
        </div>
        <h3 className="text-lg font-bold text-white">Deck Complete!</h3>
        <p className="text-xs text-neutral-400">
          You've explored all single songs in this session. Tap below to shuffle a fresh batch of nostalgic tracks.
        </p>
        <button
          onClick={() => {
            seenIdsRef.current.clear();
            loadDiscoveryTracks();
          }}
          className="px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg transition active:scale-95 cursor-pointer"
        >
          Shuffle More Tracks
        </button>
      </div>
    );
  }

  // Calculate dynamic transform based on drag or exit animation
  // Optimized for smooth 60fps hardware acceleration with will-change and translate3d
  let computedTransform = `translate3d(${dragOffset.x}px, ${dragOffset.y * 0.25}px, 0)`;
  let rotationDeg = Math.min(18, Math.max(-18, dragOffset.x * 0.1));

  if (swipeAnimation === 'right') {
    computedTransform = 'translate3d(480px, -20px, 0) rotate(18deg)';
  } else if (swipeAnimation === 'left') {
    computedTransform = 'translate3d(-480px, -20px, 0) rotate(-18deg)';
  } else {
    computedTransform = `${computedTransform} rotate(${rotationDeg}deg)`;
  }

  const likeOpacity = swipeAnimation === 'right' ? 1 : Math.min(1, Math.max(0, dragOffset.x / 70));
  const skipOpacity = swipeAnimation === 'left' ? 1 : Math.min(1, Math.max(0, -dragOffset.x / 70));

  // V2 Discover Swipe UI Rendering Branch
  if (USE_V2_SWIPE_UI) {
    return (
      <div className="w-full h-full max-w-md mx-auto flex flex-col justify-between px-3 py-1 sm:py-2 select-none overflow-hidden touch-pan-y box-border">
        {/* 1. Ultra-Compact Top Header Row */}
        <div className="w-full flex items-center justify-between py-1 px-1 shrink-0 z-30">
          <div className="flex items-center gap-2">
            {typeof onNavigate === 'function' && (
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-neutral-300 transition cursor-pointer"
                aria-label="Back to Home"
                title="Back to Home"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-white tracking-tight">Discover Swipe</span>
              {isBuffering && (
                <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  Playing...
                </span>
              )}
            </div>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-neutral-900/90 border border-neutral-800 text-[11px] font-mono font-medium text-amber-400/90 shadow-sm">
            {currentIndex + 1} <span className="text-neutral-500 font-normal">/</span> {deck.length}
          </div>
        </div>

        {/* 2. Full-Card Visual Depth: Full-Bleed Modern Music Card */}
        <div className="relative flex-1 w-full min-h-0 my-1 sm:my-2 flex items-center justify-center">
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            style={{
              transform: computedTransform,
              transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: swipeAnimation ? 0 : 1,
              willChange: 'transform'
            }}
            className="relative w-full h-full max-h-[580px] bg-[#0c0d12] rounded-3xl overflow-hidden border border-white/[0.08] shadow-[0_25px_60px_rgba(0,0,0,0.85)] flex flex-col justify-end cursor-grab active:cursor-grabbing select-none"
          >
            {/* Neon Swipe Direction Indicators (Reveal on drag) */}
            <div
              style={{ opacity: likeOpacity }}
              className="absolute top-5 left-5 z-30 px-3.5 py-1.5 rounded-2xl bg-emerald-500 text-neutral-950 font-black text-xs uppercase tracking-widest shadow-xl rotate-[-12deg] pointer-events-none transition-opacity"
            >
              LIKE ❤️
            </div>
            <div
              style={{ opacity: skipOpacity }}
              className="absolute top-5 right-5 z-30 px-3.5 py-1.5 rounded-2xl bg-rose-500 text-white font-black text-xs uppercase tracking-widest shadow-xl rotate-[12deg] pointer-events-none transition-opacity"
            >
              SKIP ✕
            </div>

            {/* High-Resolution Full-Bleed Background Artwork */}
            <img
              src={getCleanThumbnail(currentCard, currentCardId)}
              alt={currentCard.title}
              className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-transform duration-700 ease-out ${isBuffering ? 'scale-105 filter blur-[1px]' : 'scale-100'}`}
              onLoad={(e) => {
                const target = e.currentTarget;
                const w = target.naturalWidth;
                const h = target.naturalHeight;
                if (w <= 1 || h <= 1 || (w === 120 && h === 90)) {
                  setCurrentIndex(prev => prev + 1);
                }
              }}
              onError={() => {
                setCurrentIndex(prev => prev + 1);
              }}
            />

            {/* Cinematic Gradient Mask for Text Contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-black/40 to-transparent pointer-events-none z-10" />

            {/* Autoplay Buffering Spinner Overlay */}
            {isBuffering && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition animate-fadeIn">
                <div className="w-11 h-11 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <p className="mt-2.5 text-xs font-bold text-amber-200 tracking-wide">Starting track...</p>
              </div>
            )}

            {/* Autoplay Blocked / Fallback Overlay */}
            {(autoplayBlocked || playbackError) && (
              <div className="absolute inset-0 z-25 flex flex-col items-center justify-center p-6 bg-neutral-950/90 backdrop-blur-sm text-center animate-fadeIn">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 mb-3">
                  <svg className="w-6 h-6 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <h4 className="text-sm font-bold text-white mb-1">
                  {playbackError || 'Autoplay Blocked by Browser'}
                </h4>
                <p className="text-[11px] text-neutral-400 mb-3 max-w-[220px]">
                  Tap below to play "{currentCard.title}".
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayToggle();
                  }}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg transition active:scale-95 cursor-pointer"
                >
                  Tap to Play Track
                </button>
              </div>
            )}

            {/* Embedded Track Information Overlay on Card */}
            <div className="relative z-20 p-4 sm:p-5 flex flex-col justify-end pointer-events-none">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400/90 mb-0.5">
                {currentCard.channel || currentCard.artist || 'Desi Nostalgia'}
              </span>
              <h3 className="font-extrabold text-base sm:text-lg text-white line-clamp-1 leading-tight drop-shadow-md">
                {currentCard.title}
              </h3>
            </div>
          </div>
        </div>

        {/* 3. Streamlined Action Dock (Single Unified Control Row) */}
        <div className="w-full flex items-center justify-center gap-6 py-2 shrink-0 z-30">
          {/* Skip / Dislike Button */}
          <button
            type="button"
            onClick={() => handleSwipeAction('skip')}
            className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40 hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg transition-all cursor-pointer"
            title="Skip / Dislike (Swipe Left)"
            aria-label="Skip / Dislike Track"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Central Amber Neon Play/Pause Button */}
          <button
            type="button"
            onClick={handlePlayToggle}
            className="w-14 h-14 rounded-full bg-amber-500 text-neutral-950 hover:bg-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.35)] flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title={isCurrentCardPlaying ? 'Pause Track' : 'Play Track'}
            aria-label={isCurrentCardPlaying ? 'Pause Track' : 'Play Track'}
          >
            {isCurrentCardPlaying ? (
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg className="w-6 h-6 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          {/* Like Button */}
          <button
            type="button"
            onClick={() => handleSwipeAction('like')}
            className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg transition-all cursor-pointer"
            title="Like (Swipe Right)"
            aria-label="Like Track"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Legacy Discover Swipe Layout (Fallback when USE_V2_SWIPE_UI is false)

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center py-4 select-none">
      {/* Progress & Deck Status */}
      <div className="w-full flex items-center justify-between px-2 mb-3 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-400">Discover Swipe</span>
          {isBuffering && (
            <span className="flex items-center gap-1.5 text-[10px] text-amber-300 font-medium animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              Autoplaying...
            </span>
          )}
        </div>
        <span className="font-mono text-[11px]">{currentIndex + 1} / {deck.length}</span>
      </div>

      {/* Swipeable Card Container */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{
          transform: computedTransform,
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          opacity: swipeAnimation ? 0 : 1
        }}
        className="relative w-full aspect-[3/4] max-h-[460px] bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col cursor-grab active:cursor-grabbing"
      >
        {/* Swipe Feedback Badges */}
        <div
          style={{ opacity: likeOpacity }}
          className="absolute top-6 left-6 z-20 px-4 py-1.5 rounded-2xl bg-emerald-500/95 text-neutral-950 font-black text-sm uppercase tracking-widest shadow-xl rotate-[-12deg] pointer-events-none transition-opacity"
        >
          LIKE ❤️
        </div>
        <div
          style={{ opacity: skipOpacity }}
          className="absolute top-6 right-6 z-20 px-4 py-1.5 rounded-2xl bg-red-500/95 text-white font-black text-sm uppercase tracking-widest shadow-xl rotate-[12deg] pointer-events-none transition-opacity"
        >
          SKIP ✕
        </div>

        {/* Thumbnail Background Image */}
        <div className="relative flex-1 bg-neutral-950 overflow-hidden">
          <img
            src={getCleanThumbnail(currentCard, currentCardId)}
            alt={currentCard.title}
            className={`w-full h-full object-cover pointer-events-none transition duration-500 ${isBuffering ? 'scale-105 filter blur-[1px]' : ''}`}
            onLoad={(e) => {
              const target = e.currentTarget;
              const w = target.naturalWidth;
              const h = target.naturalHeight;
              if (w <= 1 || h <= 1 || (w === 120 && h === 90)) {
                setCurrentIndex(prev => prev + 1);
              }
            }}
            onError={() => {
              setCurrentIndex(prev => prev + 1);
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />

          {/* Autoplay Buffering Spinner Overlay */}
          {isBuffering && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition animate-fadeIn">
              <div className="w-12 h-12 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="mt-3 text-xs font-bold text-amber-200 tracking-wide">Starting track...</p>
            </div>
          )}

          {/* Autoplay Blocked / Error Fallback Overlay - Keeps track on screen, never skips */}
          {(autoplayBlocked || playbackError) && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-neutral-950/85 backdrop-blur-sm text-center animate-fadeIn">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 mb-3">
                <svg className="w-6 h-6 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">
                {playbackError || 'Autoplay Blocked by Browser'}
              </h4>
              <p className="text-[11px] text-neutral-400 mb-4 max-w-[220px]">
                Tap below to play "{currentCard.title}".
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayToggle();
                }}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg transition active:scale-95 cursor-pointer"
              >
                Tap to Play Track
              </button>
            </div>
          )}

          {/* Quick Play/Pause Badge Button on Card */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePlayToggle();
            }}
            className="absolute bottom-4 right-4 z-10 w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center justify-center shadow-2xl transition active:scale-95 cursor-pointer"
            aria-label={isCurrentCardPlaying ? 'Pause Track' : 'Play Track'}
          >
            {isCurrentCardPlaying ? (
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
        </div>

        {/* Track Metadata */}
        <div className="p-5 bg-neutral-900 border-t border-neutral-800/80 space-y-1">
          <h3 className="font-bold text-base text-white line-clamp-1">{currentCard.title}</h3>
          <p className="text-xs text-amber-400 font-medium truncate">{currentCard.channel || currentCard.artist || 'Desi Nostalgia'}</p>
        </div>
      </div>

      {/* Accessible Action Control Buttons */}
      <div className="flex items-center justify-center gap-4 mt-6">
        {/* Undo / Previous Card Button */}
        <button
          onClick={handlePrevCard}
          disabled={currentIndex <= 0}
          className={`w-11 h-11 rounded-full border flex items-center justify-center transition shadow-md active:scale-90 ${
            currentIndex > 0
              ? 'bg-neutral-800 text-neutral-300 hover:text-white border-neutral-700 cursor-pointer'
              : 'bg-neutral-900/50 text-neutral-600 border-neutral-800/50 cursor-not-allowed opacity-40'
          }`}
          title="Previous Song"
          aria-label="Previous Song"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Skip Button (Swipe Left) */}
        <button
          onClick={() => handleSwipeAction('skip')}
          className="w-14 h-14 rounded-full bg-neutral-800/90 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 border border-neutral-700/80 hover:border-red-500/50 flex items-center justify-center transition shadow-lg active:scale-90 cursor-pointer"
          title="Skip Song (Swipe Left)"
          aria-label="Skip Song"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={handlePlayToggle}
          className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold flex items-center justify-center transition shadow-amber-500/30 shadow-xl active:scale-95 cursor-pointer"
          title={isCurrentCardPlaying ? 'Pause Track' : 'Play Track'}
          aria-label={isCurrentCardPlaying ? 'Pause Track' : 'Play Track'}
        >
          {isCurrentCardPlaying ? (
            <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          ) : (
            <svg className="w-7 h-7 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>

        {/* Like Button (Swipe Right) */}
        <button
          onClick={() => handleSwipeAction('like')}
          className="w-14 h-14 rounded-full bg-neutral-800/90 hover:bg-emerald-500/20 text-neutral-400 hover:text-emerald-400 border border-neutral-700/80 hover:border-emerald-500/50 flex items-center justify-center transition shadow-lg active:scale-90 cursor-pointer"
          title="Like Song (Swipe Right)"
          aria-label="Like Song"
        >
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
