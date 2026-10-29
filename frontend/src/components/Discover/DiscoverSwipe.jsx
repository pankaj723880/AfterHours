import React, { useState, useEffect, useRef } from 'react';
import { getCleanThumbnail } from '../../utils/storage';

export default function DiscoverSwipe({
  onPlaySong,
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
  const touchStartRef = useRef({ x: 0, y: 0 });
  const seenIdsRef = useRef(new Set());

  // Load genuine discovery tracks
  const loadDiscoveryTracks = async () => {
    setIsLoading(true);
    try {
      const candidates = await fetchTracks();
      if (Array.isArray(candidates) && candidates.length > 0) {
        // Filter out tracks already seen in this session
        const fresh = candidates.filter(t => {
          const id = t.id || t.videoId;
          return id && !seenIdsRef.current.has(id);
        });

        if (fresh.length > 0) {
          fresh.forEach(t => seenIdsRef.current.add(t.id || t.videoId));
          setDeck(fresh);
          setCurrentIndex(0);
        } else {
          // If all seen, clear seen and load again
          seenIdsRef.current.clear();
          candidates.forEach(t => seenIdsRef.current.add(t.id || t.videoId));
          setDeck(candidates);
          setCurrentIndex(0);
        }
      }
    } catch (err) {
      if (showToast) showToast('Failed to load discovery deck');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDiscoveryTracks();
  }, []);

  const currentCard = deck[currentIndex];

  const handleSwipeAction = (direction) => {
    if (!currentCard) return;

    if (direction === 'like') {
      const isAlreadyLiked = likedSongs.some(s => s.id === (currentCard.id || currentCard.videoId));
      if (!isAlreadyLiked) {
        onToggleLike(currentCard);
        if (showToast) showToast(`Liked "${currentCard.title}"`);
      }
    }

    setDragOffset({ x: 0, y: 0 });
    setCurrentIndex(prev => prev + 1);
  };

  // Touch gesture handlers
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    setDragOffset({ x: dx, y: dy });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragOffset.x > 90) {
      handleSwipeAction('like');
    } else if (dragOffset.x < -90) {
      handleSwipeAction('skip');
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

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
          You've explored all songs in this session. Tap below to shuffle a fresh batch of nostalgic tracks.
        </p>
        <button
          onClick={loadDiscoveryTracks}
          className="px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg transition active:scale-95 cursor-pointer"
        >
          Shuffle More Tracks
        </button>
      </div>
    );
  }

  const isCurrentCardPlaying = currentSong?.id === (currentCard.id || currentCard.videoId) && isPlaying;
  const rotationDeg = Math.min(20, Math.max(-20, dragOffset.x * 0.1));
  const likeOpacity = Math.min(1, Math.max(0, dragOffset.x / 80));
  const skipOpacity = Math.min(1, Math.max(0, -dragOffset.x / 80));

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center py-4 select-none">
      {/* Progress Indicator */}
      <div className="w-full flex items-center justify-between px-2 mb-3 text-xs text-neutral-400">
        <span className="font-semibold text-amber-400">Discover Swipe</span>
        <span className="font-mono text-[11px]">{currentIndex + 1} / {deck.length}</span>
      </div>

      {/* Swipeable Card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translate(${dragOffset.x}px, ${dragOffset.y * 0.3}px) rotate(${rotationDeg}deg)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        className="relative w-full aspect-[3/4] max-h-[460px] bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col cursor-grab active:cursor-grabbing"
      >
        {/* Swipe Visual Feedback Badges */}
        <div
          style={{ opacity: likeOpacity }}
          className="absolute top-6 left-6 z-20 px-4 py-1.5 rounded-2xl bg-emerald-500/90 text-neutral-950 font-black text-sm uppercase tracking-widest shadow-xl rotate-[-12deg] pointer-events-none"
        >
          LIKE ❤️
        </div>
        <div
          style={{ opacity: skipOpacity }}
          className="absolute top-6 right-6 z-20 px-4 py-1.5 rounded-2xl bg-red-500/90 text-white font-black text-sm uppercase tracking-widest shadow-xl rotate-[12deg] pointer-events-none"
        >
          SKIP ✕
        </div>

        {/* Thumbnail Background Image */}
        <div className="relative flex-1 bg-neutral-950 overflow-hidden">
          <img
            src={getCleanThumbnail(currentCard, currentCard.id || currentCard.videoId)}
            alt={currentCard.title}
            className="w-full h-full object-cover pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/30 to-transparent" />

          {/* Quick Play/Pause Action on Card */}
          <button
            onClick={() => onPlaySong(currentCard)}
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

      {/* Accessible Control Buttons for Keyboard & Touch */}
      <div className="flex items-center justify-center gap-6 mt-6">
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

        <button
          onClick={() => onPlaySong(currentCard)}
          className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold flex items-center justify-center transition shadow-amber-500/30 shadow-xl active:scale-95 cursor-pointer"
          title="Play Track"
          aria-label="Play Track"
        >
          {isCurrentCardPlaying ? (
            <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          ) : (
            <svg className="w-7 h-7 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>

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
