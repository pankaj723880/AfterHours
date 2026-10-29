import React, { useState, useEffect, useRef } from 'react';
import { fetchLyrics } from '../../services/lyricsService';

export default function LyricsModal({
  isOpen,
  onClose,
  currentSong,
  playerRef
}) {
  const [lyricsData, setLyricsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const activeLineRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Poll current playback time when lyrics modal is open
  useEffect(() => {
    if (!isOpen || !playerRef?.current) return;
    const interval = setInterval(() => {
      try {
        if (playerRef.current.getCurrentTime) {
          const t = playerRef.current.getCurrentTime();
          if (typeof t === 'number' && !isNaN(t)) {
            setCurrentTime(t);
          }
        }
      } catch (e) {}
    }, 250);
    return () => clearInterval(interval);
  }, [isOpen, playerRef]);

  // Load lyrics when song changes
  useEffect(() => {
    if (!isOpen || !currentSong) return;

    let isMounted = true;
    setIsLoading(true);
    setLyricsData(null);

    fetchLyrics(currentSong)
      .then((data) => {
        if (isMounted) {
          setLyricsData(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [isOpen, currentSong]);

  // Auto-scroll active line into view
  useEffect(() => {
    if (activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentTime]);

  if (!isOpen) return null;

  // Determine active line index
  let activeIndex = -1;
  if (lyricsData?.isSynced && lyricsData.syncedLines.length > 0) {
    for (let i = 0; i < lyricsData.syncedLines.length; i++) {
      if (currentTime >= lyricsData.syncedLines[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[10000] bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 transition-all duration-300 animate-fadeIn ${
        isFullscreen ? 'p-0' : ''
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`w-full bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col transition-all duration-300 ${
          isFullscreen ? 'w-full h-full rounded-none border-none' : 'max-w-2xl h-[85vh] max-h-[750px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white truncate">
                {currentSong?.title || 'Lyrics'}
              </h3>
              <p className="text-xs text-amber-400 truncate">
                {currentSong?.channel || currentSong?.artist || 'Unknown Artist'}
                {lyricsData && (
                  <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">
                    {lyricsData.isSynced ? '✨ Synchronized' : '📄 Plain Text'}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                {isFullscreen ? (
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                ) : (
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                )}
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
              aria-label="Close Lyrics"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Lyrics Scroll Body */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-4 text-center select-none"
        >
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center py-20 text-neutral-400 space-y-3">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Finding lyrics for this song...</p>
            </div>
          ) : !lyricsData ? (
            <div className="h-full flex flex-col items-center justify-center py-20 text-neutral-400 space-y-3">
              <span className="text-4xl">🎵</span>
              <p className="text-sm font-semibold text-neutral-300">No lyrics found for this track</p>
              <p className="text-xs text-neutral-500 max-w-sm">
                Lyrics are sourced via legitimate open song registries. Unofficial remixes or live bootlegs may not have verified text.
              </p>
            </div>
          ) : lyricsData.isSynced && lyricsData.syncedLines.length > 0 ? (
            <div className="space-y-4 py-8">
              {lyricsData.syncedLines.map((line, idx) => {
                const isActive = idx === activeIndex;
                const isPast = idx < activeIndex;

                return (
                  <p
                    key={idx}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => {
                      if (playerRef?.current?.seekTo) {
                        playerRef.current.seekTo(line.time, true);
                      }
                    }}
                    className={`transition-all duration-300 cursor-pointer font-display leading-relaxed ${
                      isActive
                        ? 'text-xl sm:text-2xl font-bold text-amber-400 scale-105 shadow-amber-500/20 py-2'
                        : isPast
                        ? 'text-base sm:text-lg text-neutral-500 font-medium hover:text-neutral-300'
                        : 'text-base sm:text-lg text-neutral-400 font-normal hover:text-neutral-200'
                    }`}
                  >
                    {line.text}
                  </p>
                );
              })}
            </div>
          ) : (
            <div className="py-6 whitespace-pre-line text-sm sm:text-base text-neutral-300 leading-relaxed font-sans max-w-lg mx-auto">
              {lyricsData.plainLyrics}
            </div>
          )}
        </div>

        {/* Footer info & attribution */}
        <div className="p-3 bg-neutral-900/90 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 shrink-0 px-4">
          <span>Tap any line to jump playback</span>
          <span>Source: LRCLIB Open Lyrics Registry</span>
        </div>
      </div>
    </div>
  );
}
