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
  Headphones
} from 'lucide-react';
import { 
  VERIFIED_INDIAN_RADIO_STATIONS, 
  INDIAN_RADIO_CATEGORIES, 
  fetchIndianRadioStations 
} from '../../constants/indianRadioStations';

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
  const [playableOnly, setPlayableOnly] = useState(false);

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

  // Filter stations based on search query, category, and playable toggle
  const filteredStations = useMemo(() => {
    return stations.filter(station => {
      // Category filter
      if (selectedCategory === 'Featured Indian Radio') {
        if (!station.featured) return false;
      } else if (selectedCategory !== 'All Stations') {
        if (station.category !== selectedCategory) return false;
      }

      // Playable only toggle
      if (playableOnly && !station.isPlayable) {
        return false;
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
  }, [stations, selectedCategory, playableOnly, searchQuery]);

  const isCurrentRadioPlaying = (stationId) => {
    return currentSong?.isRadio && currentSong?.id === stationId && isPlaying;
  };

  const isCurrentRadioSelected = (stationId) => {
    return currentSong?.isRadio && currentSong?.id === stationId;
  };

  const handleStationClick = (station) => {
    if (!station.isPlayable) {
      if (station.officialWebsite) {
        window.open(station.officialWebsite, '_blank', 'noopener,noreferrer');
      }
      return;
    }

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

  return (
    <div className="min-h-screen bg-[#070709] text-gray-100 p-4 sm:p-6 lg:p-8 space-y-8 pb-32">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/40 via-stone-900 to-black p-6 sm:p-8 border border-amber-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Real Indian Music Radio • No Radio API
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Radio className="w-8 h-8 text-amber-400" />
              Indian Live Radio
            </h1>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
              Listen directly to genuine Indian live broadcasts — iconic Hindi Bollywood film songs,
              vintage classics, Ghazals, youth pop, and Indian classical maestros. Curated from official
              Prasar Bharati & Akashvani livestreams.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex flex-row md:flex-col gap-3 shrink-0">
            <div className="px-4 py-3 rounded-xl bg-stone-900/80 border border-stone-800 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Verified Streams</p>
                <p className="text-sm font-bold text-white">100% Tested Active</p>
              </div>
            </div>
            <div className="px-4 py-3 rounded-xl bg-stone-900/80 border border-stone-800 flex items-center gap-3">
              <Flame className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Focus Music</p>
                <p className="text-sm font-bold text-amber-300">Hindi & Bollywood</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Currently Playing Live Radio Bar (If active) */}
      {currentSong?.isRadio && (
        <div className="rounded-xl bg-amber-950/30 border border-amber-500/40 p-4 flex items-center justify-between gap-4 shadow-lg backdrop-blur">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-amber-500/30">
              <img 
                src={currentSong.thumbnail} 
                alt={currentSong.title} 
                className="w-full h-full object-cover" 
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black uppercase tracking-wider">
                  Live Broadcast
                </span>
                <span className="text-xs text-amber-400 truncate">{currentSong.artist}</span>
              </div>
              <h3 className="text-base font-bold text-white truncate">{currentSong.title}</h3>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onTogglePlay && onTogglePlay()}
              className="p-3 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 transition shadow-md flex items-center gap-2 text-xs"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span className="hidden sm:inline">Pause Stream</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span className="hidden sm:inline">Resume Stream</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Controls Bar: Search & Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search station, frequency, Hindi, Ghazal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60 transition"
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

          {/* Playable Filter Toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm text-gray-300 select-none bg-stone-900 px-3.5 py-2.5 rounded-xl border border-stone-800 hover:border-stone-700 transition">
              <input
                type="checkbox"
                checked={playableOnly}
                onChange={(e) => setPlayableOnly(e.target.checked)}
                className="accent-amber-500 rounded w-4 h-4"
              />
              <span>In-App Playable Only</span>
            </label>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {INDIAN_RADIO_CATEGORIES.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition ${
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

      {/* Stations Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-amber-400">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium text-gray-300">Connecting to Indian radio broadcasts...</p>
        </div>
      ) : filteredStations.length === 0 ? (
        <div className="py-20 text-center space-y-3 rounded-2xl bg-stone-900/30 border border-stone-800/60 p-8">
          <Music className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="text-lg font-bold text-gray-200">No matching stations found</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Try adjusting your search terms or switch category filter to "All Stations".
          </p>
          <button
            onClick={() => { setSearchQuery(''); setSelectedCategory('All Stations'); setPlayableOnly(false); }}
            className="px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400 transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredStations.map(station => {
            const isPlayingThis = isCurrentRadioPlaying(station.id);
            const isSelectedThis = isCurrentRadioSelected(station.id);

            return (
              <div
                key={station.id}
                className={`group relative rounded-2xl overflow-hidden bg-stone-900/70 border transition-all duration-300 flex flex-col justify-between ${
                  isSelectedThis
                    ? 'border-amber-500 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/50'
                    : 'border-stone-800/90 hover:border-amber-500/40 hover:bg-stone-900'
                }`}
              >
                {/* Station Card Header / Artwork */}
                <div className="relative h-44 overflow-hidden bg-stone-950">
                  <img
                    src={station.artwork}
                    alt={station.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    {station.isPlayable ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur border border-amber-500/40 text-[11px] font-bold text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        LIVE STREAM
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-900/80 backdrop-blur border border-stone-700 text-[11px] font-medium text-gray-300">
                        OFFICIAL PORTAL
                      </span>
                    )}

                    {station.frequency && (
                      <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur text-[11px] font-semibold text-gray-200 border border-white/10">
                        {station.frequency}
                      </span>
                    )}
                  </div>

                  {/* Center Play Button Overlay on Hover for Playable Stations */}
                  {station.isPlayable && (
                    <button
                      onClick={() => handleStationClick(station)}
                      className={`absolute inset-0 m-auto w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl ${
                        isPlayingThis
                          ? 'bg-amber-500 text-black scale-100 opacity-100'
                          : 'bg-black/60 text-amber-400 border border-amber-500/40 hover:scale-110 hover:bg-amber-500 hover:text-black opacity-90 group-hover:opacity-100'
                      }`}
                      title={isPlayingThis ? 'Pause' : 'Play Station'}
                    >
                      {isPlayingThis ? (
                        <Pause className="w-6 h-6 fill-current" />
                      ) : (
                        <Play className="w-6 h-6 fill-current ml-0.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                        {station.name}
                      </h3>
                      {station.language && (
                        <span className="shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {station.language}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-medium text-amber-400/90 line-clamp-1">
                      {station.tagline}
                    </p>

                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                      {station.description}
                    </p>
                  </div>

                  {/* Official Source & Tags */}
                  <div className="pt-2 border-t border-stone-800/80 space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span className="flex items-center gap-1.5 truncate">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{station.officialSource}</span>
                      </span>
                      <span className="shrink-0 text-stone-500">{station.category}</span>
                    </div>

                    {/* Non-embeddable note */}
                    {!station.isPlayable && station.unplayableReason && (
                      <div className="p-2.5 rounded-lg bg-stone-950/60 border border-stone-800 text-[11px] text-gray-400 flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{station.unplayableReason}</span>
                      </div>
                    )}

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      {station.isPlayable ? (
                        <button
                          onClick={() => handleStationClick(station)}
                          className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 ${
                            isPlayingThis
                              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 hover:bg-amber-400'
                              : 'bg-stone-800 text-white hover:bg-amber-500 hover:text-black border border-stone-700 hover:border-amber-500'
                          }`}
                        >
                          {isPlayingThis ? (
                            <>
                              <Pause className="w-3.5 h-3.5 fill-current" />
                              <span>Playing Live Stream</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Play Station</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <a
                          href={station.officialWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 bg-stone-800 text-amber-300 hover:bg-stone-700 border border-stone-700 hover:border-amber-500/50"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Official Website</span>
                        </a>
                      )}

                      {station.officialWebsite && station.isPlayable && (
                        <a
                          href={station.officialWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-gray-400 hover:text-white border border-stone-700/80 transition"
                          title="Visit Official Station Website"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
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

