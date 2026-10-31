import React, { useState, useRef } from 'react';
import HomeSearchBar from '../Search/HomeSearchBar';
import DownloadTrackButton from '../Offline/DownloadTrackButton';
import {
  Search,
  Radio,
  Sparkles,
  History,
  Disc,
  Flame,
  Music,
  Headphones,
  Play,
  Video,
  MoreVertical,
  Compass,
  ArrowRight,
  TrendingUp,
  Volume2
} from 'lucide-react';
import { getCleanThumbnail, isThumbnailUrlFormatValid } from '../../utils/thumbnailValidator';

// Popular search shortcuts configured for fast 1-tap discovery
const POPULAR_SEARCH_CHIPS = [
  { label: 'Arijit Singh', query: 'Arijit Singh hits' },
  { label: 'Bollywood Retro', query: '90s bollywood romantic songs' },
  { label: 'Punjabi Hits', query: 'Diljit Dosanjh Punjabi hits' },
  { label: 'Lofi Late Night', query: 'Hindi lofi chill beats' },
  { label: '90s Hits', query: 'Best of Kumar Sanu Udit Narayan 90s' },
  { label: 'KK Hits', query: 'KK timeless songs' },
  { label: 'Coke Studio', query: 'Coke Studio best songs' },
  { label: 'Anuv Jain', query: 'Anuv Jain acoustic songs' },
  { label: 'Sufi Classics', query: 'Sufi Bollywood songs' }
];

export default function DiscoverView({
  // Search state & handlers
  searchQuery,
  setSearchQuery,
  searchResults = [],
  fetchYouTubeMusic,
  isLoading = false,
  searchError = null,
  hasSearched = false,
  isLoadingMoreSearch = false,
  hasMoreSearchResults = false,
  searchLoadMoreError = null,
  handleLoadMoreSearchResults,

  // Player & song actions
  currentSong,
  playSong,
  openMenuId,
  setOpenMenuId,
  handleOpenVideo,
  queue = [],
  addToQueue,
  removeFromQueue,
  likedSongs = [],
  toggleLike,
  playNext,
  handleFindSimilar,
  handleAddToPlaylistClick,
  showToast,
  handleImageError,

  // Discovery carousels
  trendingSongs = [],
  popularAlbums = [],

  // System & navigation
  user,
  authToken,
  backendUrl,
  cmsConfig,
  onNavigate
}) {
  const [selectedChip, setSelectedChip] = useState(null);
  const searchInputRef = useRef(null);

  // Trigger search from popular chip or promo card
  const handleChipClick = (item) => {
    const q = typeof item === 'string' ? item : item.query;
    const label = typeof item === 'string' ? item : item.label;
    setSelectedChip(label);
    if (setSearchQuery) setSearchQuery(q);
    if (fetchYouTubeMusic) fetchYouTubeMusic(q);
  };

  const handlePromoSearchClick = () => {
    // Focus search bar or search default query
    const searchInput = document.querySelector('input[role="combobox"]');
    if (searchInput) {
      searchInput.focus();
      searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      handleChipClick('Bollywood Hits');
    }
  };

  // Category navigation cards
  const categoryCards = [
    {
      id: 'radio',
      title: 'Indian Live Radio',
      subtitle: '24/7 non-stop regional streams & live broadcasts',
      tag: 'LIVE',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      tagDot: 'bg-rose-500 animate-pulse',
      icon: Radio,
      gradient: 'from-rose-950/30 via-neutral-900/90 to-neutral-950',
      borderColor: 'hover:border-rose-500/50',
      action: () => onNavigate && onNavigate('radio')
    },
    {
      id: 'mood',
      title: 'Mood-to-Music AI',
      subtitle: 'AI companion matching your exact emotions',
      tag: 'GEMINI AI',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      tagDot: 'bg-amber-400',
      icon: Sparkles,
      gradient: 'from-amber-950/30 via-neutral-900/90 to-neutral-950',
      borderColor: 'hover:border-amber-500/50',
      action: () => onNavigate && onNavigate('mood')
    },
    {
      id: 'timemachine',
      title: 'Time Machine Radio',
      subtitle: 'Travel through the golden decades 1950s–2020s',
      tag: 'DECADES',
      badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      tagDot: 'bg-yellow-400',
      icon: Disc,
      gradient: 'from-yellow-950/25 via-neutral-900/90 to-neutral-950',
      borderColor: 'hover:border-yellow-500/50',
      action: () => onNavigate && onNavigate('timemachine')
    },
    {
      id: 'barber',
      title: 'Nostalgia Stations',
      subtitle: 'Authentic vintage Saloon, Truck & Theka vibes',
      tag: 'RETRO',
      badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      tagDot: 'bg-orange-400',
      icon: History,
      gradient: 'from-orange-950/25 via-neutral-900/90 to-neutral-950',
      borderColor: 'hover:border-orange-500/50',
      action: () => onNavigate && onNavigate('barber')
    }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 md:px-6 space-y-6 sm:space-y-8 pb-32 md:pb-20 relative z-10 overflow-x-hidden">
      
      {/* =========================================================================
          SECTION 1: DISCOVER PAGE HERO (Mobile-First, Compact & Cinematic)
          ========================================================================= */}
      <section
        aria-label="Discover & Search Hero"
        className="relative w-full rounded-2xl sm:rounded-3xl p-4 sm:p-7 md:p-9 bg-gradient-to-br from-neutral-900/95 via-neutral-950/95 to-neutral-950 border border-amber-500/25 shadow-[0_15px_40px_rgba(0,0,0,0.85),0_0_30px_rgba(245,158,11,0.08)] overflow-hidden"
      >
        {/* Background Cinematic Visual with Smooth Ambient Glow */}
        <div
          className="absolute inset-0 bg-cover bg-right sm:bg-center opacity-25 mix-blend-screen pointer-events-none scale-105"
          style={{ backgroundImage: `url('/hero-cinematic.png')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/85 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent pointer-events-none" />

        {/* Ambient Golden Light Orbs */}
        <div className="absolute -top-12 -left-12 w-64 h-64 rounded-full bg-amber-500/15 blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-16 right-0 w-72 h-72 rounded-full bg-orange-500/10 blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-start sm:items-center text-left sm:text-center space-y-3 sm:space-y-4 max-w-2xl sm:mx-auto">
          {/* Welcome Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] sm:text-xs font-semibold tracking-wider backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="uppercase font-mono font-bold">Welcome to Loopra</span>
          </div>

          {/* Main Heading & Subtitle */}
          <div className="space-y-1 sm:space-y-1.5">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-display font-black text-white tracking-tight leading-tight">
              DISCOVER & <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400">SEARCH</span>
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-neutral-300 font-medium">
              Find your next favourite song, artist, album or genre.
            </p>
          </div>

          {/* Search Experience Component */}
          <div className="w-full pt-1 sm:pt-2">
            <HomeSearchBar
              onSearch={(queryText) => {
                const trimmed = (queryText || '').trim();
                if (!trimmed) return;
                if (setSearchQuery) setSearchQuery(trimmed);
                if (fetchYouTubeMusic) fetchYouTubeMusic(trimmed);
              }}
              onSelectSong={playSong}
              onPlaySong={playSong}
              placeholder={cmsConfig?.searchPage?.placeholder || "Search song, artist, album..."}
              showQuickTags={false}
              user={user}
              token={authToken}
              backendUrl={backendUrl}
            />
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: POPULAR SEARCHES (Horizontal Scrollable Chips)
          ========================================================================= */}
      <section aria-label="Popular Searches" className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 uppercase tracking-wider">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Popular Searches</span>
          </div>
          <span className="text-[11px] text-neutral-500">Quick Picks</span>
        </div>

        {/* Scrollable chip container with touch inertia */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
          {POPULAR_SEARCH_CHIPS.map((chip, idx) => {
            const isSelected = selectedChip === chip.label;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleChipClick(chip)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 shrink-0 min-h-[44px] select-none ${
                  isSelected
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                    : 'bg-neutral-900/90 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 hover:border-amber-500/40 shadow-sm'
                }`}
              >
                <Search className={`w-3.5 h-3.5 ${isSelected ? 'text-neutral-950' : 'text-amber-400'}`} />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: GLOBAL AUDIO SEARCH PROMOTIONAL CARD
          ========================================================================= */}
      <section aria-label="Global Audio Search Promotion">
        <div
          onClick={handlePromoSearchClick}
          className="relative rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 bg-gradient-to-r from-neutral-900/90 via-amber-950/20 to-neutral-950 border border-amber-500/30 hover:border-amber-500/60 shadow-[0_10px_30px_rgba(0,0,0,0.6)] transition-all duration-300 cursor-pointer group active:scale-[0.99] overflow-hidden"
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute -top-10 right-10 w-44 h-44 rounded-full bg-amber-500/10 blur-[60px] pointer-events-none" />

          <div className="flex items-center justify-between gap-3 sm:gap-6 relative z-10">
            {/* Left Column: Headings & Action */}
            <div className="space-y-1.5 flex-1 min-w-0">
              <span className="inline-block text-[9px] sm:text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                Smart Audio Discovery
              </span>
              <h2 className="text-base sm:text-xl font-display font-extrabold text-white tracking-tight leading-snug group-hover:text-amber-300 transition">
                YOUR MUSIC, SMARTER.
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300/90 max-w-md line-clamp-2">
                Discover songs, artists and genres with global audio search.
              </p>

              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 group-hover:text-amber-300 group-hover:translate-x-0.5 transition">
                  <span>Explore Search</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* Right Column: Stylized Vinyl Artwork */}
            <div className="relative shrink-0 flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20">
              {/* Outer Vinyl Record Disc */}
              <div className="w-full h-full rounded-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 border-2 border-amber-500/30 flex items-center justify-center shadow-xl group-hover:rotate-45 transition-transform duration-700">
                {/* Grooves */}
                <div className="w-4/5 h-4/5 rounded-full border border-neutral-800 flex items-center justify-center">
                  <div className="w-3/5 h-3/5 rounded-full border border-neutral-800/60 flex items-center justify-center">
                    {/* Golden Center Label */}
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
                      <Music className="w-3 h-3 text-neutral-950" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: EXPLORE BY CATEGORY (Mobile 2-Col Grid, Minimum 44px Targets)
          ========================================================================= */}
      <section aria-label="Explore by Category" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs sm:text-sm font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            <span>Explore by Category</span>
          </h2>
          <span className="text-[11px] text-neutral-500">Specialized Radios</span>
        </div>

        {/* 2-column mobile grid, 4-column on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
          {categoryCards.map((cat) => {
            const IconComponent = cat.icon;
            return (
              <div
                key={cat.id}
                onClick={cat.action}
                className={`relative rounded-2xl p-3.5 sm:p-4 bg-gradient-to-br ${cat.gradient} border border-neutral-800/90 ${cat.borderColor} hover:shadow-lg transition-all duration-200 cursor-pointer active:scale-[0.98] flex flex-col justify-between min-h-[115px] sm:min-h-[130px] group`}
              >
                {/* Top Row: Icon & Tag */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${cat.badgeColor}`}>
                    {cat.tagDot && <span className={`w-1.5 h-1.5 rounded-full ${cat.tagDot}`} />}
                    <span>{cat.tag}</span>
                  </span>
                </div>

                {/* Bottom Row: Title & Subtitle */}
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition line-clamp-1">
                    {cat.title}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-neutral-400 mt-0.5 line-clamp-2">
                    {cat.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: DISCOVERY CONTENT / SEARCH RESULTS
          ========================================================================= */}
      
      {/* 5A. ACTIVE SEARCH RESULTS */}
      {searchResults.length > 0 && (
        <section aria-label="Search Results" className="space-y-3 pt-2">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm sm:text-base md:text-lg font-display font-extrabold tracking-tight text-white flex items-center gap-2">
              <span className="text-amber-500">⚡</span>
              <span>Search Results</span>
            </h3>
            <span className="text-xs text-neutral-400 font-mono">
              {searchResults.length} {searchResults.length === 1 ? 'song' : 'songs'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:gap-2.5">
            {searchResults.map((track, i) => {
              const trackId = track.id || track.videoId;
              const isCurrent = currentSong && (currentSong.id === trackId || currentSong.videoId === trackId);
              const isMenuOpen = openMenuId === `${trackId}-${i}`;
              const cleanThumb = getCleanThumbnail(track, trackId);

              return (
                <div
                  key={`${trackId}-${i}`}
                  onClick={() => playSong(track)}
                  className={`p-3 sm:p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all duration-200 backdrop-blur-xl relative select-none min-h-[58px] ${
                    isMenuOpen ? 'z-30' : 'z-auto'
                  } ${
                    isCurrent
                      ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-neutral-900/80 border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                      : 'bg-neutral-900/60 border-neutral-800/80 hover:bg-neutral-850 hover:border-amber-500/40 active:scale-[0.99]'
                  }`}
                >
                  {/* Left: Index, Thumbnail, Title & Artist */}
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1 pr-2">
                    <span className="text-xs font-mono text-neutral-500 w-5 text-center shrink-0">
                      {i + 1}
                    </span>
                    <img
                      src={cleanThumb}
                      alt={track.title || ""}
                      loading="lazy"
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover shrink-0 shadow-md bg-neutral-950"
                      onLoad={(e) => {
                        const target = e.currentTarget;
                        if (target.naturalWidth <= 1 || (target.naturalWidth === 120 && target.naturalHeight === 90)) {
                          const card = target.closest('.rounded-2xl');
                          if (card) card.style.display = 'none';
                        }
                      }}
                      onError={(e) => {
                        if (handleImageError) handleImageError(e, track.title, trackId);
                        else {
                          const card = e.currentTarget.closest('.rounded-2xl');
                          if (card) card.style.display = 'none';
                        }
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className={`font-bold text-xs sm:text-sm truncate ${isCurrent ? 'text-amber-400 font-extrabold' : 'text-white'}`}>
                        {track.title}
                      </h4>
                      <p className="text-[11px] sm:text-xs text-neutral-400 truncate mt-0.5">
                        {track.channel || track.artist || 'Loopra Music'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Video Button & More Menu */}
                  <div className={`flex items-center gap-1.5 sm:gap-2 shrink-0 relative ${isMenuOpen ? 'z-40' : ''}`}>
                    {handleOpenVideo && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenVideo(track, e)}
                        className="p-2 sm:p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 transition flex items-center justify-center shrink-0 min-h-[40px] min-w-[40px] cursor-pointer"
                        title="Watch video"
                        aria-label={`Watch video for ${track.title}`}
                      >
                        <Video className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(isMenuOpen ? null : `${trackId}-${i}`);
                      }}
                      className="p-2 sm:p-2.5 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                      aria-label="More options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-48 bg-neutral-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-neutral-700/80 overflow-hidden z-50 animate-fadeIn divide-y divide-neutral-800">
                        <div className="py-1">
                          {currentSong?.id !== trackId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                queue.some(s => (s.id || s.videoId) === trackId)
                                  ? removeFromQueue(trackId)
                                  : addToQueue(track, e);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-200 hover:text-white hover:bg-neutral-800 transition"
                            >
                              {queue.some(s => (s.id || s.videoId) === trackId) ? 'Remove from Queue' : 'Add to Queue'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (toggleLike) toggleLike(track);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-200 hover:text-pink-400 hover:bg-neutral-800 transition"
                          >
                            {likedSongs.some(s => (s.id || s.videoId) === trackId) ? 'Remove from Favourite' : 'Add to Favourite'}
                          </button>
                          {playNext && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playNext(track, e);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-200 hover:text-white hover:bg-neutral-800 transition flex items-center gap-2"
                            >
                              <span>⏭️</span>
                              <span>Play Next</span>
                            </button>
                          )}
                        </div>

                        <div className="py-1">
                          {handleFindSimilar && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFindSimilar(track, e);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-200 hover:text-amber-400 hover:bg-neutral-800 transition flex items-center gap-2"
                            >
                              <span>✨</span>
                              <span>Similar Songs</span>
                            </button>
                          )}
                          {handleAddToPlaylistClick && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToPlaylistClick(track, e);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-200 hover:text-white hover:bg-neutral-800 transition"
                            >
                              Add to Playlist
                            </button>
                          )}
                          <DownloadTrackButton track={track} variant="menu-item" showToast={showToast} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <div className="text-center pt-4 pb-2 space-y-2">
            {searchLoadMoreError && (
              <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-xl px-4 py-2 inline-block max-w-md">
                <span>{searchLoadMoreError}</span>
              </div>
            )}

            {isLoadingMoreSearch ? (
              <button
                type="button"
                disabled
                className="px-6 py-3 rounded-2xl bg-neutral-850 text-xs font-bold text-amber-400/70 border border-neutral-700/60 shadow-xl inline-flex items-center justify-center gap-2 min-h-[44px] cursor-not-allowed opacity-80"
              >
                <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                <span>Loading more tracks...</span>
              </button>
            ) : searchLoadMoreError ? (
              <button
                type="button"
                onClick={handleLoadMoreSearchResults}
                className="px-6 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 active:scale-[0.98] text-xs font-bold text-amber-400 border border-rose-500/50 hover:border-amber-500/60 transition shadow-xl cursor-pointer inline-flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Retry Loading</span>
              </button>
            ) : hasMoreSearchResults ? (
              <button
                type="button"
                onClick={handleLoadMoreSearchResults}
                className="px-6 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 active:scale-[0.98] text-xs font-bold text-amber-400 border border-neutral-700 hover:border-amber-500/50 transition shadow-xl cursor-pointer inline-flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Load More Tracks</span>
              </button>
            ) : (
              <div className="py-2 text-xs font-medium text-neutral-500 flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                <span>End of search results</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5B. LOADING SKELETONS */}
      {isLoading && (
        <section aria-label="Loading search" className="space-y-3 pt-2 animate-pulse">
          <div className="h-4 bg-neutral-800 rounded w-1/3"></div>
          <div className="grid grid-cols-1 gap-2.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="p-3.5 rounded-2xl border border-neutral-800/60 bg-neutral-900/40 flex items-center justify-between">
                <div className="flex items-center gap-3.5 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-neutral-800 shrink-0"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-3.5 bg-neutral-800 rounded w-3/5"></div>
                    <div className="h-2.5 bg-neutral-800/60 rounded w-2/5"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5C. ERROR STATE */}
      {!isLoading && searchError && (
        <section aria-label="Search error" className="p-6 sm:p-8 rounded-3xl border border-rose-500/30 bg-rose-950/20 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white">Search Encountered an Issue</h3>
          <p className="text-xs text-rose-300/80 max-w-md mx-auto">{searchError}</p>
          <button
            type="button"
            onClick={() => fetchYouTubeMusic && fetchYouTubeMusic(searchQuery)}
            className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition inline-flex items-center gap-2 border border-neutral-700 min-h-[44px] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Retry Search</span>
          </button>
        </section>
      )}

      {/* 5D. EMPTY SEARCH RESULTS */}
      {!isLoading && !searchError && hasSearched && searchResults.length === 0 && (
        <section aria-label="No results" className="p-8 sm:p-10 rounded-3xl border border-neutral-800/80 bg-neutral-900/40 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white">No Tracks Found</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            We couldn't find any tracks matching "{searchQuery}". Try different keywords, artist names, or movie titles.
          </p>
        </section>
      )}

      {/* 5E. DEFAULT DISCOVERY VIEW: TRENDING & POPULAR (When Not Actively Searching) */}
      {!hasSearched && searchResults.length === 0 && !isLoading && (
        <div className="space-y-6 sm:space-y-8 pt-2">
          {/* Trending Hits Carousel */}
          {trendingSongs && trendingSongs.length > 0 && (
            <section aria-label="Trending Hits" className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                      Trending on Loopra
                    </h3>
                    <p className="text-[11px] text-neutral-400">Most played right now</p>
                  </div>
                </div>
              </div>

              <div className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
                {trendingSongs.map((track, idx) => {
                  const trackId = track.id || track.videoId;
                  const thumb = getCleanThumbnail(track, trackId);
                  if (!thumb || !isThumbnailUrlFormatValid(thumb)) return null;

                  return (
                    <div
                      key={`trending-${trackId || idx}`}
                      onClick={() => playSong(track)}
                      className="group relative flex flex-col shrink-0 w-36 sm:w-44 bg-neutral-900/60 hover:bg-neutral-850 border border-neutral-800/80 hover:border-amber-500/40 rounded-2xl p-2.5 sm:p-3 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10 cursor-pointer select-none"
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2 bg-neutral-950">
                        <img
                          src={thumb}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onLoad={(e) => {
                            const target = e.currentTarget;
                            if (target.naturalWidth <= 1 || (target.naturalWidth === 120 && target.naturalHeight === 90)) {
                              const card = target.closest('.group');
                              if (card) card.style.display = 'none';
                            }
                          }}
                          onError={(e) => {
                            if (handleImageError) handleImageError(e, track.title, trackId);
                            else {
                              const card = e.currentTarget.closest('.group');
                              if (card) card.style.display = 'none';
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-neutral-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-9 h-9 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-lg shadow-amber-500/40 transform scale-90 group-hover:scale-100 transition">
                            <Play className="w-4 h-4 fill-current translate-x-0.5" />
                          </div>
                        </div>
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-400 transition">
                        {track.title}
                      </h4>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {track.artist || track.channel}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Popular Albums Carousel */}
          {popularAlbums && popularAlbums.length > 0 && (
            <section aria-label="Popular Albums" className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    <Disc className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                      Popular Albums & Soundtracks
                    </h3>
                    <p className="text-[11px] text-neutral-400">Full album jukeboxes</p>
                  </div>
                </div>
              </div>

              <div className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
                {popularAlbums.map((album, idx) => {
                  const albumId = album.id || album.videoId;
                  const thumb = getCleanThumbnail(album, albumId);
                  if (!thumb || !isThumbnailUrlFormatValid(thumb)) return null;

                  return (
                    <div
                      key={`album-${albumId || idx}`}
                      onClick={() => handleChipClick(album.query || album.title)}
                      className="group relative flex flex-col shrink-0 w-36 sm:w-44 bg-neutral-900/60 hover:bg-neutral-850 border border-neutral-800/80 hover:border-amber-500/40 rounded-2xl p-2.5 sm:p-3 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10 cursor-pointer select-none"
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2 bg-neutral-950">
                        <img
                          src={thumb}
                          alt={album.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onLoad={(e) => {
                            const target = e.currentTarget;
                            if (target.naturalWidth <= 1 || (target.naturalWidth === 120 && target.naturalHeight === 90)) {
                              const card = target.closest('.group');
                              if (card) card.style.display = 'none';
                            }
                          }}
                          onError={(e) => {
                            if (handleImageError) handleImageError(e, album.title, albumId);
                            else {
                              const card = e.currentTarget.closest('.group');
                              if (card) card.style.display = 'none';
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-neutral-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-9 h-9 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-lg shadow-amber-500/40 transform scale-90 group-hover:scale-100 transition">
                            <Play className="w-4 h-4 fill-current translate-x-0.5" />
                          </div>
                        </div>
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-400 transition">
                        {album.title}
                      </h4>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {album.artist || 'Bollywood Classic'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

    </div>
  );
}

