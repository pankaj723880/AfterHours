import React, { useState, useEffect, useCallback } from 'react';

// Built-in default eras if CMS config is empty
const DEFAULT_ERAS = [
  {
    id: 'era-1970s',
    title: 'The Golden 70s',
    decade: '1970s',
    description: 'Acoustic warmth, evergreen melody legends, Kishore Kumar, Lata Mangeshkar, R.D. Burman & vintage disco groove.',
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    enabled: true,
    order: 1,
    queries: ['Kishore Kumar evergreen 1970s', 'RD Burman 70s hits', 'Lata Mangeshkar 70s superhits', 'Classic 70s retro songs'],
    genres: ['Retro Bollywood', 'Classic Ghazal', 'Vintage Rock', 'Disco Beats']
  },
  {
    id: 'era-1980s',
    title: 'Electrifying 80s',
    decade: '1980s',
    description: 'Pumping analog synthesizers, disco royalty, Bappi Lahiri, Nazia Hassan, disco deewane and pop revolutions.',
    artwork: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    enabled: true,
    order: 2,
    queries: ['Bappi Lahiri 80s disco', 'Nazia Hassan hits', '80s synth Bollywood', 'Amitabh Bachchan 80s songs'],
    genres: ['Bollywood Disco', 'Synthwave', 'New Wave Pop', '80s Ballads']
  },
  {
    id: 'era-1990s',
    title: 'Nostalgic 90s',
    decade: '1990s',
    description: 'The golden age of pure romance, cassette tapes, Kumar Sanu, Alka Yagnik, Udit Narayan, and early Indipop waves.',
    artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    enabled: true,
    order: 3,
    queries: ['Kumar Sanu 90s romantic hits', 'Alka Yagnik 90s melodies', 'Udit Narayan 90s classics', '90s Indipop Alisha Chinai Lucky Ali'],
    genres: ['90s Romance', 'Indipop Cassettes', 'Melody Duets', '90s Ghazals']
  },
  {
    id: 'era-2000s',
    title: 'Millennial 2000s',
    decade: '2000s',
    description: 'Acoustic indie guitars, A.R. Rahman masterpieces, KK anthems, Mohit Chauhan soulful travel songs, and college nostalgia.',
    artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    enabled: true,
    order: 4,
    queries: ['AR Rahman 2000s hits', 'KK best songs 2000s', 'Lucky Ali Mohit Chauhan 2000s indie', 'Early 2000s Bollywood rock'],
    genres: ['AR Rahman Soundtracks', 'Indie Rock', 'Soulful Pop', 'Sufi Fusion']
  },
  {
    id: 'era-2010s',
    title: 'Modern 2010s',
    decade: '2010s',
    description: 'Streaming revolution, Arijit Singh soul anthems, Shreya Ghoshal melodies, electronic fusion, and Punjabi chartbusters.',
    artwork: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop&q=80',
    enabled: true,
    order: 5,
    queries: ['Arijit Singh 2010s hits', 'Shreya Ghoshal 2010s songs', 'Punjabi 2010s hits Diljit', 'Bollywood modern anthems 2010s'],
    genres: ['Modern Melancholy', 'Punjabi Pop', 'EDM Bollywood', 'Acoustic Chill']
  }
];

const decodeHtml = (str = '') => {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
};

export default function TimeMachineRadio({
  cmsConfig = null,
  onPlaySong,
  onAddToQueue,
  onToggleFavorite,
  favorites = [],
  currentSong = null,
  isPlaying = false,
  backendUrl = ''
}) {
  const eras = (Array.isArray(cmsConfig?.timeMachineEras) && cmsConfig.timeMachineEras.length > 0)
    ? cmsConfig.timeMachineEras.filter((e) => e.enabled !== false).sort((a, b) => (a.order || 0) - (b.order || 0))
    : DEFAULT_ERAS;

  const [selectedEraId, setSelectedEraId] = useState(eras[2]?.id || eras[0]?.id || 'era-1990s');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [radioTuning, setRadioTuning] = useState(false);

  const activeEra = eras.find((e) => e.id === selectedEraId) || eras[0];

  // Fetch songs when selected era or genre changes
  const fetchEraTracks = useCallback(async (era, genre) => {
    if (!era) return;
    setIsLoading(true);
    setRadioTuning(true);
    setError(null);

    try {
      const cleanBase = (backendUrl || '').trim().replace(/\/+$/, '');
      let query = '';
      if (genre && genre !== 'All') {
        query = `${era.decade} ${genre} songs`;
      } else if (Array.isArray(era.queries) && era.queries.length > 0) {
        // pick first query or combine
        query = era.queries[0];
      } else {
        query = `${era.decade} Bollywood hits`;
      }

      const res = await fetch(`${cleanBase}/api/youtube/search?q=${encodeURIComponent(query)}&limit=15`);
      if (!res.ok) {
        throw new Error(`Failed to load ${era.title} tracks`);
      }

      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];

      const parsedTracks = items.map((item) => {
        const videoId = item.id?.videoId || item.id;
        return {
          id: videoId,
          videoId,
          title: decodeHtml(item.snippet?.title || 'Unknown Title'),
          artist: decodeHtml(item.snippet?.channelTitle || item.snippet?.artist || era.title),
          albumArt: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || era.artwork,
          decade: era.decade,
          eraTitle: era.title
        };
      });

      setTracks(parsedTracks);
    } catch (err) {
      console.error('Time Machine Radio error:', err);
      setError(err.message || 'Could not tune into this era.');
    } finally {
      setIsLoading(false);
      // Give radio tuning aesthetic animation a brief moment
      setTimeout(() => setRadioTuning(false), 400);
    }
  }, [backendUrl]);

  useEffect(() => {
    if (activeEra) {
      fetchEraTracks(activeEra, selectedGenre);
    }
  }, [activeEra?.id, selectedGenre, fetchEraTracks]);

  // Play Era as a continuous station
  const handlePlayEraStation = () => {
    if (!tracks || tracks.length === 0) return;
    // Play first track and queue remainder
    const [first, ...rest] = tracks;
    if (onPlaySong && first) {
      onPlaySong(first);
    }
    if (onAddToQueue && rest.length > 0) {
      rest.forEach((track) => onAddToQueue(track));
    }
  };

  const isFav = (trackId) => {
    return favorites.some((f) => (f.id || f.videoId) === trackId);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 text-white">
      {/* Header Banner with Vintage Cassette/Radio Dial Aesthetics */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 border border-amber-500/30 p-6 sm:p-10 shadow-[0_15px_50px_rgba(0,0,0,0.8)] mb-8">
        {/* Retro scanline & grain overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Analog Time Machine • Vintage Radio Station
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-display bg-gradient-to-r from-white via-amber-200 to-amber-500 bg-clip-text text-transparent">
              Time Machine Radio
            </h1>
            <p className="mt-2 text-sm sm:text-base text-neutral-400 leading-relaxed">
              Step into musical nostalgia. Select an era from the 1970s acoustic golden age to the 2010s streaming explosion.
              Tune into continuous broadcast stations with authentic vintage vibes.
            </p>
          </div>

          {/* Master Station Action Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handlePlayEraStation}
              disabled={isLoading || tracks.length === 0}
              className="group relative flex items-center gap-3 px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-neutral-950 font-black text-sm sm:text-base tracking-wide shadow-[0_0_30px_rgba(245,158,11,0.4)] active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              <span className="w-8 h-8 rounded-full bg-neutral-950/20 flex items-center justify-center text-neutral-950 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span>Play {activeEra?.decade || 'Era'} Station</span>
            </button>
          </div>
        </div>

        {/* Radio Tuning Frequency Bar */}
        <div className="mt-8 pt-6 border-t border-neutral-800/80">
          <div className="flex items-center justify-between text-[11px] font-mono text-amber-400/80 mb-2">
            <span>DIAL: FM 70.0 MHz - 20.1 MHz</span>
            <span>{radioTuning ? 'TUNING FREQUENCY...' : `LOCKED ON [${activeEra?.decade}]`}</span>
          </div>

          <div className="relative h-3 bg-neutral-950 rounded-full border border-amber-500/20 overflow-hidden flex items-center">
            {/* Tuning marks */}
            <div className="absolute inset-0 flex justify-between px-2 text-[8px] text-neutral-600 font-mono select-none">
              <span>| 1970</span>
              <span>| 1980</span>
              <span>| 1990</span>
              <span>| 2000</span>
              <span>| 2010</span>
            </div>
            {/* Active needle indicator */}
            <div
              className={`h-full w-24 bg-gradient-to-r from-transparent via-amber-500 to-transparent transition-all duration-500 ${
                radioTuning ? 'animate-pulse' : ''
              }`}
              style={{
                marginLeft: `${Math.max(0, Math.min(85, (eras.findIndex((e) => e.id === activeEra?.id) / Math.max(1, eras.length - 1)) * 85))}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Era Navigation Cards / Radio Dials */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
        {eras.map((era) => {
          const isSelected = era.id === activeEra?.id;
          return (
            <button
              key={era.id}
              type="button"
              onClick={() => {
                setSelectedEraId(era.id);
                setSelectedGenre('All');
              }}
              className={`relative text-left p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 group overflow-hidden cursor-pointer ${
                isSelected
                  ? 'bg-neutral-900 border-amber-500 ring-2 ring-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.25)]'
                  : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
              }`}
            >
              {/* Era background image preview with dark gradient */}
              <div
                className="absolute inset-0 bg-cover bg-center opacity-20 group-hover:opacity-30 transition-opacity"
                style={{ backgroundImage: `url(${era.artwork})` }}
              />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                    isSelected ? 'bg-amber-500 text-neutral-950' : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {era.decade}
                  </span>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  )}
                </div>
                <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                  {era.title}
                </h3>
                <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">
                  {era.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Era Details & Genre Sub-filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <span>{activeEra?.title}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
              {activeEra?.decade}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">{activeEra?.description}</p>
        </div>

        {/* Sub-genres Pills */}
        {Array.isArray(activeEra?.genres) && activeEra.genres.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedGenre('All')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedGenre === 'All'
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              All Tracks
            </button>
            {activeEra.genres.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => setSelectedGenre(genre)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedGenre === genre
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tracks Grid / List */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping" />
            <div className="w-16 h-16 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm font-mono text-amber-400 animate-pulse">
            Tuning into {activeEra?.decade} radio frequency...
          </p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-950/30 border border-red-500/40 text-center my-6">
          <p className="text-red-300 text-sm mb-3">{error}</p>
          <button
            type="button"
            onClick={() => fetchEraTracks(activeEra, selectedGenre)}
            className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-bold transition-colors"
          >
            Retry Tuning
          </button>
        </div>
      ) : tracks.length === 0 ? (
        <div className="py-16 text-center text-neutral-500 text-sm">
          No songs found for this frequency. Try selecting another era or genre.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {tracks.map((track, idx) => {
            const isCurrent = (currentSong?.id || currentSong?.videoId) === (track.id || track.videoId);
            return (
              <div
                key={track.id || idx}
                className={`flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 border ${
                  isCurrent
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                    : 'bg-neutral-900/50 hover:bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {/* Artwork with play overlay */}
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-neutral-800 shrink-0 group">
                  <img
                    src={track.albumArt}
                    alt={track.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => onPlaySong && onPlaySong(track)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer text-amber-400 hover:text-amber-300"
                    title="Play track"
                  >
                    {isCurrent && isPlaying ? (
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 fill-current translate-x-0.5" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  {isCurrent && (
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-amber-500 text-neutral-950 font-black text-[9px]">
                      PLAYING
                    </div>
                  )}
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-0 pr-1">
                  <h4
                    className={`font-semibold text-xs sm:text-sm truncate cursor-pointer hover:underline ${
                      isCurrent ? 'text-amber-300' : 'text-white'
                    }`}
                    onClick={() => onPlaySong && onPlaySong(track)}
                    title={track.title}
                  >
                    {track.title}
                  </h4>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    {track.artist}
                  </p>
                  <span className="inline-block mt-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-amber-400/90 border border-neutral-700/60">
                    {track.decade}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {onAddToQueue && (
                    <button
                      type="button"
                      onClick={() => onAddToQueue(track)}
                      className="p-2 text-neutral-400 hover:text-amber-400 rounded-lg hover:bg-neutral-800 transition-colors"
                      title="Add to queue"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  )}

                  {onToggleFavorite && (
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(track)}
                      className={`p-2 rounded-lg transition-colors ${
                        isFav(track.id || track.videoId)
                          ? 'text-red-500 hover:text-red-400'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                      }`}
                      title={isFav(track.id || track.videoId) ? 'Remove favorite' : 'Add favorite'}
                    >
                      <svg
                        className="w-4 h-4 fill-current"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={isFav(track.id || track.videoId) ? 0 : 2}
                      >
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
