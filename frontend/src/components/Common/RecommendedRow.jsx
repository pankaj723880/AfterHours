import React, { useState, useEffect, useRef } from 'react';
import { generateCategorizedRecommendations } from '../../services/recommendationService.js';
import { getCleanThumbnail } from '../../utils/storage';

export default function RecommendedRow({
  likedSongs = [],
  history = [],
  availableTracks = [],
  onPlaySong,
  currentSong,
  isPlaying,
  onOpenVideo
}) {
  const [sections, setSections] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = (force = true) => {
    setIsRefreshing(true);
    const recs = generateCategorizedRecommendations({
      likedSongs,
      history,
      allAvailableTracks: availableTracks,
      limitPerSection: 6,
      forceRefresh: force
    });
    setSections(recs);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  useEffect(() => {
    refresh(false);
  }, [likedSongs.length, history.length, availableTracks.length]);

  if (!sections) return null;

  const sectionKeys = ['madeForYou', 'becauseYouLiked', 'similarSongs', 'recentlyPlayed', 'yourFavorites', 'discoverNew'];
  const activeSections = activeTab === 'all'
    ? sectionKeys.map(k => sections[k]).filter(Boolean)
    : [sections[activeTab]].filter(Boolean);

  return (
    <div className="w-full mb-10 space-y-8 animate-fadeIn">
      {/* Top Header with Title, Category Switcher, and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl text-amber-400 animate-pulse">✨</span>
            <h2 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">
              Personalized Music Hub
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
            Tailored suggestions driven by your listening habits, liked songs, and genre affinities
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => refresh(true)}
            disabled={isRefreshing}
            className="px-3.5 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-700/80 transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            title="Refresh recommendations with fresh track seeds"
          >
            <span className={`transition-transform duration-500 ${isRefreshing ? 'rotate-180' : ''}`}>🔄</span>
            <span>{isRefreshing ? 'Recalculating...' : 'Refresh Hub'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs for quick jumping */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
              : 'bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
          }`}
        >
          All Sections
        </button>
        {sectionKeys.map((key) => {
          const sec = sections[key];
          if (!sec) return null;
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
              }`}
            >
              <span>{sec.icon}</span>
              <span>{sec.title}</span>
              {sec.tracks?.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-neutral-950/20 text-neutral-900' : 'bg-neutral-800 text-neutral-400'}`}>
                  {sec.tracks.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Render Sections */}
      <div className="space-y-8">
        {activeSections.map((sec) => (
          <SectionRow
            key={sec.id}
            section={sec}
            onPlaySong={onPlaySong}
            currentSong={currentSong}
            isPlaying={isPlaying}
          />
        ))}
      </div>
    </div>
  );
}

function SectionRow({ section, onPlaySong, currentSong, isPlaying }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const tracks = section.tracks || [];

  return (
    <div className="space-y-3">
      {/* Section Sub-header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className="text-base">{section.icon}</span>
            <h3 className="font-display font-bold text-base sm:text-lg text-white truncate">
              {section.title}
            </h3>
          </div>
          <p className="text-xs text-neutral-400 truncate">{section.subtitle}</p>
        </div>

        {tracks.length > 3 && (
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => scroll('left')}
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition cursor-pointer"
              aria-label="Scroll left"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition cursor-pointer"
              aria-label="Scroll right"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
          </div>
        )}
      </div>

      {/* Tracks Container */}
      {tracks.length === 0 ? (
        <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 text-center">
          <p className="text-sm font-medium text-neutral-400">
            {section.emptyMessage || 'No tracks available for this section yet.'}
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none scroll-smooth"
        >
          {tracks.map((track) => {
            const trackId = track.id || track.videoId;
            const isCurrent = currentSong?.id === trackId || currentSong?.videoId === trackId;

            return (
              <div
                key={trackId}
                onClick={() => onPlaySong(track)}
                className={`group shrink-0 w-36 sm:w-44 p-2.5 sm:p-3 rounded-2xl bg-neutral-900/70 hover:bg-neutral-800/80 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isCurrent
                    ? 'border-amber-500/80 shadow-lg shadow-amber-500/10'
                    : 'border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2.5 bg-neutral-950">
                  <img
                    src={getCleanThumbnail(track, trackId)}
                    alt={track.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div
                    className={`absolute inset-0 m-auto w-10 h-10 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-xl transition-all duration-200 ${
                      isCurrent && isPlaying
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                    }`}
                  >
                    {isCurrent && isPlaying ? (
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    ) : (
                      <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  {track.recommendationReason && (
                    <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md truncate max-w-full block">
                      {track.recommendationReason}
                    </span>
                  )}
                  <h4 className="font-bold text-xs text-white truncate group-hover:text-amber-300 transition-colors">
                    {track.title}
                  </h4>
                  <p className="text-[10px] text-neutral-400 truncate">
                    {track.channel || track.artist || 'Desi Classic'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
