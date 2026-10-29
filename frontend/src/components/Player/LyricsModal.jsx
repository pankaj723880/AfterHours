import React, { useState, useEffect, useRef } from 'react';
import { fetchLyrics, cleanTitleForLyrics } from '../../services/lyricsService';

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
  const [customSearch, setCustomSearch] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
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

  const loadLyrics = (customQuery = null, force = false) => {
    if (!currentSong) return;
    setIsLoading(true);
    setLyricsData(null);

    fetchLyrics(currentSong, customQuery, force)
      .then((data) => {
        setLyricsData(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  };

  // Load lyrics on initial open or song change
  useEffect(() => {
    if (!isOpen || !currentSong) return;
    setShowSearchInput(false);
    setCustomSearch('');
    loadLyrics(null, false);
  }, [isOpen, currentSong?.id, currentSong?.videoId]);

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

  // Auto-scroll active line into view smoothly
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

  const handleCustomSearchSubmit = (e) => {
    e.preventDefault();
    if (customSearch.trim()) {
      loadLyrics(customSearch.trim(), true);
    }
  };

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
              <p className="text-xs text-amber-400 truncate flex items-center gap-2">
                <span>{currentSong?.channel || currentSong?.artist || 'Unknown Artist'}</span>
                {lyricsData && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono border border-neutral-700/60">
                    {lyricsData.isSynced ? '✨ Synchronized' : '📄 Plain Text'}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowSearchInput(!showSearchInput)}
              className={`p-2 rounded-xl transition cursor-pointer text-xs flex items-center gap-1 ${
                showSearchInput
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white'
              }`}
              title="Search manually"
              aria-label="Search manually"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              aria-label="Toggle Fullscreen"
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

        {/* Search Refinement Bar */}
        {showSearchInput && (
          <form onSubmit={handleCustomSearchSubmit} className="p-3 bg-neutral-950/60 border-b border-neutral-800 flex gap-2">
            <input
              type="text"
              value={customSearch}
              onChange={(e) => setCustomSearch(e.target.value)}
              placeholder={`Search lyrics (e.g. "${cleanTitleForLyrics(currentSong?.title)}")`}
              className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Search
            </button>
          </form>
        )}

        {/* Lyrics Scroll Body */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-4 text-center select-none"
        >
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center py-20 text-neutral-400 space-y-3">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Fetching verified lyrics from registry...</p>
            </div>
          ) : !lyricsData ? (
            <div className="h-full flex flex-col items-center justify-center py-16 text-neutral-400 space-y-4">
              <span className="text-4xl">🎵</span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-neutral-200">No lyrics found for this track</p>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Lyrics are queried via the free open LRCLIB catalogue. Live sets or unofficial remixes might need refined search terms.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => loadLyrics(null, true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <span>🔄</span>
                  <span>Retry Fetch</span>
                </button>
                <button
                  onClick={() => {
                    setShowSearchInput(true);
                    setCustomSearch(cleanTitleForLyrics(currentSong?.title));
                  }}
                  className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs border border-neutral-700 transition cursor-pointer"
                >
                  Search Manually
                </button>
              </div>
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
          <span className="flex items-center gap-1">
            <span>Source:</span>
            <span className="text-neutral-400 font-medium">{lyricsData?.source || 'LRCLIB Registry'}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
