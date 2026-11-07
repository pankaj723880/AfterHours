import React, { memo } from 'react';
import { ArrowLeft, Video, MoreVertical, Sparkles } from 'lucide-react';
import DownloadTrackButton from '../Offline/DownloadTrackButton';

/**
 * NostalgiaStationView
 * 
 * Implements strict locked-viewport layout with isolated scrolling:
 * 1. Root container locked to fixed screen viewport (h-full max-h-full overflow-hidden flex flex-col)
 * 2. Static Locked Hero Header docked at the top (flex-shrink-0 w-full)
 * 3. Dedicated scrollable track list container (flex-1 overflow-y-auto overscroll-contain px-4 pb-32)
 */
const NostalgiaStationView = memo(function NostalgiaStationView({
  station,
  songs = [],
  stationLoading = false,
  stationVisibleCount = 20,
  currentSong = null,
  openMenuId = null,
  setOpenMenuId,
  playSong,
  handleOpenVideo,
  queue = [],
  removeFromQueue,
  addToQueue,
  toggleLike,
  likedSongs = [],
  playNext,
  handleFindSimilar,
  handleAddToPlaylistClick,
  showToast,
  handleLoadMoreStationSongs,
  isLoadingMoreStation = false,
  onGoBack,
  getCleanThumbnail,
  handleImageError,
}) {
  if (!station) return null;

  return (
    <div className="h-full max-h-full overflow-hidden flex flex-col w-full max-w-4xl mx-auto relative z-10 box-border">
      {/* 1. Static Locked Hero Header (flex-shrink-0 w-full) */}
      <header className="flex-shrink-0 w-full pt-2 sm:pt-4 pb-3 px-3 sm:px-4 space-y-3 z-20">
        {/* Navigation row with back button */}
        {onGoBack && (
          <div className="flex items-center justify-between">
            <button
              onClick={onGoBack}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-neutral-900/80 hover:bg-neutral-800 active:scale-95 backdrop-blur-xl border border-neutral-700/60 rounded-xl text-neutral-300 hover:text-white transition shadow-md group cursor-pointer text-xs font-medium"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back</span>
            </button>
            <span className="text-[11px] font-mono text-neutral-400 bg-black/40 px-2.5 py-1 rounded-full border border-white/5 backdrop-blur-sm">
              Nostalgia Station
            </span>
          </div>
        )}

        {/* Hero Card Banner */}
        <div className="p-4 sm:p-6 rounded-2xl border border-neutral-700/50 relative overflow-hidden shadow-2xl backdrop-blur-md bg-neutral-900/60 w-full min-w-0">
          <div className="flex flex-col items-start justify-between gap-2 sm:gap-3 relative z-10">
            <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold px-3 py-1 rounded-full border border-amber-500/40 bg-neutral-950/80 backdrop-blur-xl text-amber-300 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              {station.badge}
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-lg">
              {station.title}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-200 max-w-xl font-medium drop-shadow line-clamp-2">
              {station.subtitle}
            </p>
          </div>
        </div>

        {/* Curated Track Count Pill Bar */}
        {!stationLoading && songs.length > 0 && (
          <div className="flex items-center justify-between px-1 text-xs text-neutral-400 font-medium">
            <span>Showing {Math.min(stationVisibleCount, songs.length)} of {songs.length} curated tracks</span>
          </div>
        )}
      </header>

      {/* 2. Independent Scrollable Track List Container */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-4 pb-32 scrollbar-thin scrollbar-thumb-zinc-700/50 scrollbar-track-transparent">
        {stationLoading ? (
          <div className="text-center py-12">
            <span className="text-xs text-amber-400 animate-pulse flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 animate-spin shrink-0" /> Fetching station music tracks...
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2">
              {songs.slice(0, stationVisibleCount).map((track, i) => {
                const isCurrent = currentSong?.id === track.id;
                const isMenuOpen = openMenuId === `${track.id}-${i}`;
                return (
                  <div
                    key={track.id + '-' + i}
                    onClick={() => playSong(track)}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition backdrop-blur-md relative ${
                      isMenuOpen ? 'z-30' : 'z-auto'
                    } ${
                      isCurrent
                        ? 'bg-neutral-900/90 border-amber-500/80 shadow-xl'
                        : 'bg-neutral-900/50 border-neutral-800/70 hover:bg-neutral-900 active:scale-[0.98]/80'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="text-xs font-mono text-neutral-400 w-6 text-center">{i + 1}</span>
                      <img
                        src={getCleanThumbnail ? getCleanThumbnail(track) : (track.thumbnail || track.coverUrl || '')}
                        alt={track.title || ""}
                        loading="lazy"
                        className="w-12 h-12 rounded-2xl object-cover shrink-0 shadow-md"
                        onError={(e) => handleImageError && handleImageError(e, track.title, track.id)}
                      />
                      <div className="min-w-0">
                        <h4 className={`font-bold text-xs truncate ${isCurrent ? 'text-amber-400' : 'text-white'}`}>
                          {track.title}
                        </h4>
                        <p className="text-[10px] text-neutral-400 truncate">{track.channel || track.artist}</p>
                      </div>
                    </div>

                    <div className={`flex items-center gap-2 shrink-0 relative ${isMenuOpen ? 'z-40' : ''}`}>
                      <button
                        onClick={(e) => handleOpenVideo(track, e)}
                        className="p-1.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition flex items-center shrink-0"
                        title="See Video"
                      >
                        <Video className="w-3.5 h-3.5 shrink-0" />
                      </button>
                      
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setOpenMenuId(isMenuOpen ? null : `${track.id}-${i}`); 
                        }} 
                        className="p-1 text-neutral-500 hover:text-white transition shrink-0"
                      >
                        <MoreVertical className="w-5 h-5 shrink-0" />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-44 bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-neutral-700/80 overflow-hidden z-50 animate-fadeIn">
                          {currentSong?.id !== track.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                queue.some(s => s.id === track.id) ? removeFromQueue(track.id) : addToQueue(track, e);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
                            >
                              {queue.some(s => s.id === track.id) ? 'Remove from Queue' : 'Add to Queue'}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLike(track);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-pink-400 hover:bg-neutral-800 transition"
                          >
                            {likedSongs.some(s => s.id === track.id) ? 'Remove from Favourite' : 'Add to Favourite'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playNext(track, e);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition flex items-center gap-2"
                          >
                            <span>⏭️</span>
                            <span>Play Next</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFindSimilar(track, e);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-amber-400 hover:bg-neutral-800 transition flex items-center gap-2"
                          >
                            <span>✨</span>
                            <span>Similar Songs</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToPlaylistClick(track, e);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
                          >
                            Add to Playlist
                          </button>
                          <DownloadTrackButton track={track} variant="menu-item" showToast={showToast} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {songs.length > 0 && (
              <div className="text-center pt-6 pb-6">
                <button
                  onClick={handleLoadMoreStationSongs}
                  disabled={isLoadingMoreStation}
                  className="px-6 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 active:scale-[0.98] text-xs font-bold text-amber-400 border border-neutral-700 transition shadow-xl cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  {isLoadingMoreStation ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading more songs...</span>
                    </>
                  ) : (
                    <span>Load More Songs</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default NostalgiaStationView;
