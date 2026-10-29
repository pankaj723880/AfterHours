import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCleanThumbnail } from '../../utils/storage';
import { filterSingleSongs } from '../../services/songFilter';

export default function DiscoverSwipe({
  onPlaySong,
  onTogglePlay,
  currentSong,
  isPlaying,
  likedSongs = [],
  onToggleLike,
  showToast,
  fetchTracks
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

  // Safety & transition control refs
  const isTransitioningRef = useRef(false);
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
    onToggleLike
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
      onToggleLike
    };
  }, [deck, currentIndex, currentCard, isCurrentCardPlaying, likedSongs, onPlaySong, onTogglePlay, onToggleLike]);

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
   * Never resets currentIndex or deck on prop updates.
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
        const sourceTracks = verifiedSingleSongs.length > 0 ? verifiedSingleSongs : candidates;

        const fresh = sourceTracks.filter(t => {
          const id = t.id || t.videoId;
          return id && !seenIdsRef.current.has(id);
        });

        const tracksToUse = fresh.length > 0 ? fresh : sourceTracks;
        tracksToUse.forEach(t => seenIdsRef.current.add(t.id || t.videoId));

        setDeck(tracksToUse);
        setCurrentIndex(0);
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

  /**
   * Requests playback of the selected track exactly once.
   * Never triggers automatic retries or recursive track skipping.
   */
  const triggerAutoplay = useCallback((track) => {
    if (!track || !isMountedRef.current || typeof onPlaySong !== 'function') return;

    const requestId = ++playRequestIdRef.current;
    setIsBuffering(true);
    setPlaybackError(null);
    setAutoplayBlocked(false);

    if (bufferingTimerRef.current) {
      clearTimeout(bufferingTimerRef.current);
    }

    try {
      onPlaySong(track);
    } catch (err) {
      console.warn('[DiscoverSwipe] Playback invocation error:', err);
      if (isMountedRef.current) {
        setIsBuffering(false);
        setPlaybackError('Could not start playback. Tap to retry.');
      }
      return;
    }

    // Passive safety timeout: if browser autoplay is restricted, clear spinner after 5s
    // Crucially: DOES NOT auto-skip to any other song.
    bufferingTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && requestId === playRequestIdRef.current) {
        const activeId = currentSong?.id || currentSong?.videoId;
        const targetId = track.id || track.videoId;
        if (activeId !== targetId || !isPlaying) {
          setIsBuffering(false);
          setAutoplayBlocked(true);
        }
      }
    }, 5000);
  }, [onPlaySong, currentSong, isPlaying]);

  /**
   * Explicit track advancement: selects exactly ONE new song.
   * Completely locks out concurrent input until the transition settles safely.
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
    const nextSong = currentDeck[nextIndex];

    // Settle transition after visual fly-out animation (200ms)
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setCurrentIndex(nextIndex);
      setSwipeAnimation(null);
      setDragOffset({ x: 0, y: 0 });

      // Request playback of the newly visible song exactly once
      if (nextSong) {
        triggerAutoplay(nextSong);
      }

      // Release transition lock after UI update has fully rendered
      setTimeout(() => {
        if (isMountedRef.current) {
          isTransitioningRef.current = false;
        }
      }, 100);
    }, 200);
  }, [likedSongs, showToast, triggerAutoplay]);

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
    const prevSong = currentDeck[prevIndex];

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

    if (isPlayingNow) {
      if (typeof toggleHandler === 'function') {
        toggleHandler();
      }
    } else {
      triggerAutoplay(activeCard);
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
  let computedTransform = `translate(${dragOffset.x}px, ${dragOffset.y * 0.3}px)`;
  let rotationDeg = Math.min(22, Math.max(-22, dragOffset.x * 0.12));

  if (swipeAnimation === 'right') {
    computedTransform = 'translate(450px, -20px) rotate(22deg)';
  } else if (swipeAnimation === 'left') {
    computedTransform = 'translate(-450px, -20px) rotate(-22deg)';
  } else {
    computedTransform = `${computedTransform} rotate(${rotationDeg}deg)`;
  }

  const likeOpacity = swipeAnimation === 'right' ? 1 : Math.min(1, Math.max(0, dragOffset.x / 75));
  const skipOpacity = swipeAnimation === 'left' ? 1 : Math.min(1, Math.max(0, -dragOffset.x / 75));

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
