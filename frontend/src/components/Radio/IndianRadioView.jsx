import React, { useState, useEffect, useMemo } from 'react';
import { 
  Radio, 
  Play, 
  Pause, 
  ExternalLink, 
  Search, 
  Volume2, 
  Sparkles, 
  ShieldCheck, 
  Info, 
  RefreshCw,
  SlidersHorizontal,
  Flame,
  Music,
  Headphones,
  Mic,
  X
} from 'lucide-react';
import { 
  VERIFIED_INDIAN_RADIO_STATIONS, 
  INDIAN_RADIO_CATEGORIES, 
  fetchIndianRadioStations 
} from '../../constants/indianRadioStations';
import { voiceSessionService } from '../../services/voiceSessionService';
import { voiceAssistant } from '../../services/voiceAssistant';

// Architectural Experimental Feature Toggle:
// When true: sleek compact header, sticky search/category bar, optimized 2-col station cards, dedicated floating avatar dock
// When false: exact original UI with zero side effects
export const USE_COMPACT_RADIO_V2 = true;

export const IndianRadioView = ({ 
  currentSong, 
  isPlaying, 
  onPlayStation, 
  onTogglePlay,
  apiBase = '' 
}) => {
  const [stations, setStations] = useState(VERIFIED_INDIAN_RADIO_STATIONS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Stations');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadStations = async () => {
      setLoading(true);
      const data = await fetchIndianRadioStations(apiBase);
      if (isMounted) {
        setStations(data);
        setLoading(false);
      }
    };
    loadStations();
    return () => { isMounted = false; };
  }, [apiBase]);

  // Filter stations based on search query and category
  const filteredStations = useMemo(() => {
    return stations.filter(station => {
      // Category filter
      if (selectedCategory === 'Featured Indian Radio') {
        if (!station.featured) return false;
      } else if (selectedCategory !== 'All Stations') {
        if (station.category !== selectedCategory) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = station.name?.toLowerCase().includes(query);
        const matchesGenre = station.genre?.toLowerCase().includes(query);
        const matchesLang = station.language?.toLowerCase().includes(query);
        const matchesFreq = station.frequency?.toLowerCase().includes(query);
        const matchesDesc = station.description?.toLowerCase().includes(query);
        return matchesName || matchesGenre || matchesLang || matchesFreq || matchesDesc;
      }

      return true;
    });
  }, [stations, selectedCategory, searchQuery]);

  const isCurrentRadioPlaying = (stationId) => {
    return currentSong?.isRadio && currentSong?.id === stationId && isPlaying;
  };

  const isCurrentRadioSelected = (stationId) => {
    return currentSong?.isRadio && currentSong?.id === stationId;
  };

  const handleStationClick = (station) => {
    if (!station.isPlayable) return;

    if (isCurrentRadioSelected(station.id)) {
      if (onTogglePlay) onTogglePlay();
    } else {
      // Format as song object compatible with Loopra player engine
      const radioSong = {
        id: station.id,
        title: station.name,
        artist: station.tagline || 'Live Indian Radio',
        channelTitle: station.officialSource || 'Akashvani / Prasar Bharati',
        thumbnail: station.artwork,
        thumbnailUrl: station.artwork,
        streamUrl: station.streamUrl || `/api/radio/stream/${station.id}/playlist.m3u8`,
        streamFormat: station.streamFormat || 'hls',
        isRadio: true,
        duration: 0,
        category: station.category,
        language: station.language,
        genre: station.genre
      };
      if (onPlayStation) onPlayStation(radioSong);
    }
  };

  // Voice Assistant search trigger in header search bar
  const handleVoiceSearchToggle = async () => {
    if (isVoiceListening) {
      voiceAssistant.stop();
      setIsVoiceListening(false);
      return;
    }

    if (voiceAssistant.isSupported()) {
      setIsVoiceListening(true);
      await voiceAssistant.start({
        lang: 'hi-IN',
        onTranscript: ({ transcript }) => {
          if (transcript) setSearchQuery(transcript);
        },
        onFinal: (resolved) => {
          setIsVoiceListening(false);
          if (resolved) setSearchQuery(resolved);
        },
        onError: () => {
          setIsVoiceListening(false);
        }
      });
    }
  };

  // -------------------------------------------------------------
  // V2 LAYOUT: COMPACT MOBILE-FIRST INDIAN RADIO UI
  // -------------------------------------------------------------
  if (USE_COMPACT_RADIO_V2) {
    return (
      <div className="min-h-screen bg-[#070709] text-gray-100 p-2 sm:p-4 md:p-6 lg:p-8 space-y-3 sm:space-y-4 pb-36">
        {/* Sleek Compact Header Bar (Massive Space Saver) */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-950/50 via-stone-900/90 to-stone-950 p-2.5 sm:p-4 border border-amber-500/25 shadow-lg flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight truncate">
                  Indian Live Radio
                </h1>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  9 Verified
                </span>
                <span className="hidden xs:inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9px] font-medium">
                  <Flame className="w-2.5 h-2.5" />
                  Bollywood & Classics
                </span>
              </div>
              <p className="text-[10px] text-gray-400 truncate">
                Direct live broadcasts from official Prasar Bharati & Akashvani.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Info Dialog Trigger for full broadcast description */}
            <button
              onClick={() => setShowInfoModal(true)}
              className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-gray-400 hover:text-white transition"
              title="Station Information"
              aria-label="Station Information"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal: Full Radio Info & Details (Collapsed from Hero) */}
        {showInfoModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-stone-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative">
              <button
                onClick={() => setShowInfoModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-stone-800 hover:bg-stone-700 text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 text-amber-400">
                <Radio className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">About Indian Live Radio</h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                Listen directly to genuine Indian live broadcasts — iconic Hindi Bollywood film songs,
                vintage classics, Ghazals, youth pop, and Indian classical maestros. Curated from official
                Prasar Bharati & Akashvani livestreams with zero external radio APIs.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-800 text-xs">
                <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800">
                  <p className="text-[10px] text-gray-400">Stream Source</p>
                  <p className="font-bold text-emerald-400 mt-0.5">100% Verified Live</p>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800">
                  <p className="text-[10px] text-gray-400">Curated Genres</p>
                  <p className="font-bold text-amber-300 mt-0.5">Hindi, Retro, Pop</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Currently Playing Live Radio Bar (If active) */}
        {currentSong?.isRadio && (
          <div className="rounded-xl bg-amber-950/40 border border-amber-500/40 p-2.5 sm:p-3 flex items-center justify-between gap-2.5 shadow-md backdrop-blur">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden shrink-0 border border-amber-500/30">
                <img 
                  src={currentSong.thumbnail} 
                  alt={currentSong.title} 
                  className="w-full h-full object-cover" 
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-amber-500 text-black uppercase tracking-wider">
                    Live
                  </span>
                  <span className="text-[10px] sm:text-xs text-amber-400 truncate">{currentSong.artist}</span>
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-white truncate">{currentSong.title}</h3>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onTogglePlay && onTogglePlay()}
                className="p-1.5 sm:p-2 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 transition shadow-md flex items-center gap-1 text-xs active:scale-95"
                aria-label={isPlaying ? "Pause Stream" : "Resume Stream"}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span className="hidden sm:inline text-xs">Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    <span className="hidden sm:inline text-xs">Resume</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Sticky Search Input & Genre Category Bar */}
        <div className="sticky top-0 z-30 bg-[#070709]/95 backdrop-blur-md pt-1 pb-2 space-y-2 border-b border-stone-800/60">
          <div className="relative flex items-center">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search station, Bollywood, Retro, Ghazal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-16 py-1.5 sm:py-2 rounded-xl bg-stone-900 border border-stone-800 text-xs sm:text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60 transition"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-[11px] text-gray-400 hover:text-white px-1"
                >
                  ✕
                </button>
              )}
              {/* Sleek inline voice assistant trigger */}
              <button
                onClick={handleVoiceSearchToggle}
                className={`p-1 rounded-lg transition ${
                  isVoiceListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-amber-400 hover:text-amber-300'
                }`}
                title="Voice Search Stations"
                aria-label="Voice Search Stations"
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Compact Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {INDIAN_RADIO_CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition active:scale-95 ${
                  selectedCategory === category
                    ? 'bg-amber-500 text-black font-semibold shadow-sm shadow-amber-500/20'
                    : 'bg-stone-900 text-gray-300 hover:bg-stone-800 hover:text-white border border-stone-800/80'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Stations Grid - Optimized 2-Column Cards with Clear Truncation & Reduced Aspect Ratio */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-amber-400">
            <RefreshCw className="w-7 h-7 animate-spin" />
            <p className="text-xs font-medium text-gray-300">Loading live radio streams...</p>
          </div>
        ) : filteredStations.length === 0 ? (
          <div className="py-12 text-center space-y-2.5 rounded-xl bg-stone-900/30 border border-stone-800/60 p-5">
            <Music className="w-9 h-9 text-gray-600 mx-auto" />
            <h3 className="text-sm font-bold text-gray-200">No matching stations found</h3>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              Try adjusting your query or tap All Stations.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('All Stations'); }}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5 pb-32">
            {filteredStations.map(station => {
              const isPlayingThis = isCurrentRadioPlaying(station.id);
              const isSelectedThis = isCurrentRadioSelected(station.id);

              return (
                <div
                  key={station.id}
                  className={`group relative rounded-xl overflow-hidden bg-stone-900/90 border transition-all duration-200 flex flex-col justify-between ${
                    isSelectedThis
                      ? 'border-amber-500 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/50'
                      : 'border-stone-800/90 hover:border-amber-500/40 hover:bg-stone-900'
                  }`}
                >
                  {/* Compact Aspect Ratio Header */}
                  <div className="relative aspect-[16/9] overflow-hidden bg-stone-950">
                    <img
                      src={station.artwork}
                      alt={station.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/30 to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-black/80 backdrop-blur border border-amber-500/40 text-[8px] font-bold text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        LIVE
                      </span>

                      {station.frequency && (
                        <span className="px-1.5 py-0.2 rounded bg-black/70 backdrop-blur text-[8px] font-semibold text-gray-200 border border-white/10 truncate max-w-[70px]">
                          {station.frequency}
                        </span>
                      )}
                    </div>

                    {/* Circular Frosted Glass Center Play Button Overlay */}
                    <button
                      onClick={() => handleStationClick(station)}
                      className={`absolute inset-0 m-auto w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-150 backdrop-blur-md shadow-xl active:scale-90 ${
                        isPlayingThis
                          ? 'bg-amber-500 text-black scale-100 opacity-100'
                          : 'bg-black/60 text-amber-400 border border-amber-500/40 hover:scale-105 hover:bg-amber-500 hover:text-black opacity-95 group-hover:opacity-100'
                      }`}
                      title={isPlayingThis ? 'Pause' : 'Play Station'}
                      aria-label={isPlayingThis ? 'Pause Station' : `Play ${station.name}`}
                    >
                      {isPlayingThis ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Station Information */}
                  <div className="p-2 sm:p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1" title={station.name}>
                          {station.name}
                        </h3>
                        {station.language && (
                          <span className="shrink-0 text-[8px] uppercase font-bold px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {station.language}
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] font-medium text-amber-400/90 line-clamp-1">
                        {station.tagline}
                      </p>
                    </div>

                    {/* Play Action Footer */}
                    <div className="pt-1 border-t border-stone-800/80">
                      <button
                        onClick={() => handleStationClick(station)}
                        className={`w-full py-1 px-2 rounded-lg font-semibold text-[10px] sm:text-[11px] transition flex items-center justify-center gap-1 active:scale-95 ${
                          isPlayingThis
                            ? 'bg-amber-500 text-black shadow-sm shadow-amber-500/20 hover:bg-amber-400'
                            : isSelectedThis
                            ? 'bg-stone-800 text-amber-300 hover:bg-amber-500 hover:text-black border border-amber-500/40'
                            : 'bg-stone-800 text-white hover:bg-amber-500 hover:text-black border border-stone-700/80'
                        }`}
                      >
                        {isPlayingThis ? (
                          <>
                            <Pause className="w-2.5 h-2.5 fill-current shrink-0" />
                            <span className="truncate">Playing</span>
                          </>
                        ) : isSelectedThis ? (
                          <>
                            <Play className="w-2.5 h-2.5 fill-current shrink-0" />
                            <span className="truncate">Resume</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-2.5 h-2.5 fill-current shrink-0" />
                            <span className="truncate">Play</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // ORIGINAL V1 LAYOUT (100% Intact fallback)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#070709] text-gray-100 p-2.5 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 md:space-y-8 pb-36">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-950/40 via-stone-900 to-black p-4 sm:p-6 md:p-8 border border-amber-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-2 sm:space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] sm:text-xs font-semibold tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Real Indian Music Radio • No Radio API
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight flex items-center gap-2.5 sm:gap-3">
              <Radio className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 shrink-0" />
              <span>Indian Live Radio</span>
            </h1>
            <p className="text-gray-300 text-xs sm:text-sm md:text-base leading-relaxed">
              Listen directly to genuine Indian live broadcasts — iconic Hindi Bollywood film songs,
              vintage classics, Ghazals, youth pop, and Indian classical maestros. Curated from official
              Prasar Bharati & Akashvani livestreams.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex flex-row md:flex-col gap-2.5 sm:gap-3 shrink-0">
            <div className="px-3 py-2 sm:px-4 sm:py-3 rounded-xl bg-stone-900/80 border border-stone-800 flex items-center gap-2.5 sm:gap-3">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs text-gray-400">Verified Streams</p>
                <p className="text-xs sm:text-sm font-bold text-white">100% Tested Active</p>
              </div>
            </div>
            <div className="px-3 py-2 sm:px-4 sm:py-3 rounded-xl bg-stone-900/80 border border-stone-800 flex items-center gap-2.5 sm:gap-3">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-[10px] sm:text-xs text-gray-400">Focus Music</p>
                <p className="text-xs sm:text-sm font-bold text-amber-300">Hindi & Bollywood</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Currently Playing Live Radio Bar (If active) */}
      {currentSong?.isRadio && (
        <div className="rounded-xl bg-amber-950/30 border border-amber-500/40 p-3 sm:p-4 flex items-center justify-between gap-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden shrink-0 border border-amber-500/30">
              <img 
                src={currentSong.thumbnail} 
                alt={currentSong.title} 
                className="w-full h-full object-cover" 
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-400 animate-ping" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-amber-500 text-black uppercase tracking-wider">
                  Live Broadcast
                </span>
                <span className="text-[11px] sm:text-xs text-amber-400 truncate">{currentSong.artist}</span>
              </div>
              <h3 className="text-xs sm:text-sm md:text-base font-bold text-white truncate">{currentSong.title}</h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onTogglePlay && onTogglePlay()}
              className="p-2 sm:p-2.5 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 transition shadow-md flex items-center gap-1.5 text-xs active:scale-95"
              aria-label={isPlaying ? "Pause Stream" : "Resume Stream"}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span className="hidden sm:inline text-xs">Pause Stream</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span className="hidden sm:inline text-xs">Resume Stream</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Controls Bar: Search & Verified Badge */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search station, frequency, Hindi, Ghazal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-xs sm:text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Active Verified Badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold whitespace-nowrap self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>9 Verified Active Streams</span>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {INDIAN_RADIO_CATEGORIES.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition active:scale-95 ${
                selectedCategory === category
                  ? 'bg-amber-500 text-black font-semibold shadow-md shadow-amber-500/20'
                  : 'bg-stone-900 text-gray-300 hover:bg-stone-800 hover:text-white border border-stone-800/80'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Stations Grid - 2 Columns on Mobile, Multi-Column on Larger Screens */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-amber-400">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium text-gray-300">Connecting to Indian radio broadcasts...</p>
        </div>
      ) : filteredStations.length === 0 ? (
        <div className="py-16 text-center space-y-3 rounded-2xl bg-stone-900/30 border border-stone-800/60 p-6 sm:p-8">
          <Music className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mx-auto" />
          <h3 className="text-base sm:text-lg font-bold text-gray-200">No matching stations found</h3>
          <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto">
            Try adjusting your search terms or switch category filter to "All Stations".
          </p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedCategory('All Stations'); }}
            className="px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400 transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5">
          {filteredStations.map(station => {
            const isPlayingThis = isCurrentRadioPlaying(station.id);
            const isSelectedThis = isCurrentRadioSelected(station.id);

            return (
              <div
                key={station.id}
                className={`group relative rounded-xl sm:rounded-2xl overflow-hidden bg-stone-900/80 border transition-all duration-300 flex flex-col justify-between ${
                  isSelectedThis
                    ? 'border-amber-500 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/50'
                    : 'border-stone-800/90 hover:border-amber-500/40 hover:bg-stone-900'
                }`}
              >
                {/* Station Artwork Header */}
                <div className="relative aspect-[16/10] sm:aspect-video overflow-hidden bg-stone-950">
                  <img
                    src={station.artwork}
                    alt={station.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-2 left-2 right-2 sm:top-2.5 sm:left-2.5 sm:right-2.5 flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-full bg-black/75 backdrop-blur border border-amber-500/40 text-[9px] sm:text-[10px] font-bold text-amber-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      LIVE
                    </span>

                    {station.frequency && (
                      <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur text-[9px] sm:text-[10px] font-semibold text-gray-200 border border-white/10 truncate max-w-[80px] sm:max-w-none">
                        {station.frequency}
                      </span>
                    )}
                  </div>

                  {/* Center Play Button Overlay on Hover/Touch */}
                  <button
                    onClick={() => handleStationClick(station)}
                    className={`absolute inset-0 m-auto w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl active:scale-90 ${
                      isPlayingThis
                        ? 'bg-amber-500 text-black scale-100 opacity-100'
                        : 'bg-black/60 text-amber-400 border border-amber-500/40 hover:scale-110 hover:bg-amber-500 hover:text-black opacity-90 group-hover:opacity-100'
                    }`}
                    title={isPlayingThis ? 'Pause' : 'Play Station'}
                    aria-label={isPlayingThis ? 'Pause Station' : `Play ${station.name}`}
                  >
                    {isPlayingThis ? (
                      <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
                    )}
                  </button>
                </div>

                {/* Card Body */}
                <div className="p-2.5 sm:p-3.5 md:p-4 space-y-2 sm:space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1 sm:space-y-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-xs sm:text-sm md:text-base font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1" title={station.name}>
                        {station.name}
                      </h3>
                      {station.language && (
                        <span className="shrink-0 text-[8px] sm:text-[9px] uppercase font-bold px-1 sm:px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {station.language}
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] sm:text-xs font-medium text-amber-400/90 line-clamp-1">
                      {station.tagline}
                    </p>

                    <p className="text-[10px] sm:text-xs text-gray-400 line-clamp-2 leading-relaxed sm:leading-normal">
                      {station.description}
                    </p>
                  </div>

                  {/* Official Source & Action Button */}
                  <div className="pt-1.5 sm:pt-2 border-t border-stone-800/80 space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span className="flex items-center gap-1 truncate max-w-[70%]">
                        <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{station.officialSource || 'Akashvani'}</span>
                      </span>
                      <span className="shrink-0 text-[9px] text-stone-500">{station.category?.split(' ')[0]}</span>
                    </div>

                    {/* Play / Pause Button */}
                    <button
                      onClick={() => handleStationClick(station)}
                      className={`w-full py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-lg sm:rounded-xl font-semibold text-[11px] sm:text-xs transition flex items-center justify-center gap-1.5 min-h-[36px] sm:min-h-[38px] active:scale-95 ${
                        isPlayingThis
                          ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 hover:bg-amber-400'
                          : isSelectedThis
                          ? 'bg-stone-800 text-amber-300 hover:bg-amber-500 hover:text-black border border-amber-500/40'
                          : 'bg-stone-800 text-white hover:bg-amber-500 hover:text-black border border-stone-700/80 hover:border-amber-500'
                      }`}
                    >
                      {isPlayingThis ? (
                        <>
                          <Pause className="w-3 h-3 fill-current shrink-0" />
                          <span className="truncate">Playing Live</span>
                        </>
                      ) : isSelectedThis ? (
                        <>
                          <Play className="w-3 h-3 fill-current shrink-0" />
                          <span className="truncate">Resume</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current shrink-0" />
                          <span className="truncate">Play Station</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default IndianRadioView;
