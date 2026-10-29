import React, { useState, useEffect } from 'react';
import { generateRecommendations } from '../../services/recommendationService';
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
  const [recommendations, setRecommendations] = useState([]);

  const refresh = () => {
    // Shuffle available tracks slightly to provide fresh variety upon refresh
    const shuffledPool = [...availableTracks].sort(() => 0.5 - Math.random());
    const recs = generateRecommendations({
      likedSongs,
      history,
      allAvailableTracks: shuffledPool,
      limit: 6
    });
    setRecommendations(recs);
  };

  useEffect(() => {
    refresh();
  }, [likedSongs.length, history.length, availableTracks.length]);

  if (recommendations.length === 0) return null;

  return (
    <div className="w-full mb-8 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400">✨</span>
            <h3 className="font-display font-bold text-lg sm:text-xl text-white">Recommended For You</h3>
          </div>
          <p className="text-xs text-neutral-400">Personalized selections tailored to your listening taste</p>
        </div>

        <button
          onClick={refresh}
          className="px-3 py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-700 transition flex items-center gap-1.5 cursor-pointer"
        >
          <span>🔄</span>
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
        {recommendations.map((track) => {
          const trackId = track.id || track.videoId;
          const isCurrent = currentSong?.id === trackId;

          return (
            <div
              key={trackId}
              onClick={() => onPlaySong(track)}
              className={`group p-3 rounded-2xl bg-neutral-900/60 hover:bg-neutral-800/80 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isCurrent ? 'border-amber-500/60 shadow-lg shadow-amber-500/10' : 'border-neutral-800/80 hover:border-neutral-700'
              }`}
            >
              <div className="relative aspect-square rounded-xl overflow-hidden mb-2.5 bg-neutral-950">
                <img
                  src={getCleanThumbnail(track, trackId)}
                  alt={track.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <button
                  className={`absolute inset-0 m-auto w-10 h-10 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-xl transition-all duration-200 ${
                    isCurrent && isPlaying ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                  }`}
                >
                  {isCurrent && isPlaying ? (
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  ) : (
                    <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  )}
                </button>
              </div>

              <div>
                <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md truncate max-w-full block mb-1">
                  {track.recommendationReason || 'Desi Classic'}
                </span>
                <h4 className="font-bold text-xs text-white truncate group-hover:text-amber-300 transition-colors">
                  {track.title}
                </h4>
                <p className="text-[10px] text-neutral-400 truncate">
                  {track.channel || track.artist || 'Desi Nostalgia'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
