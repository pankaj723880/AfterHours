import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Headphones,
  Compass,
  Trees,
  Feather,
  Droplet,
  Flame,
  CloudRain,
  Wind,
  Music2
} from 'lucide-react';
import { relaxAudioEngine } from '../../services/relaxAudioEngine';
import { RELAX_CATEGORIES, RELAX_SOUNDS } from '../../constants/relaxSounds';
import RelaxVisualizer from './RelaxVisualizer';
import SpatialStudioModal from './SpatialStudioModal';

export default function RelaxModeView({
  onBack,
  currentSong,
  isPlaying,
  onTogglePlay,
  onNextSong,
  onPrevSong,
  volume = 1,
  onVolumeChange,
  getCleanThumbnail,
  onOpenExpandedPlayer
}) {
  const [engineState, setEngineState] = useState(() => relaxAudioEngine.getState());
  const [isStudioOpen, setIsStudioOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = relaxAudioEngine.subscribe((state) => {
      setEngineState({ ...state });
    });

    // Preload top likely sounds in background for instantaneous startup (<100ms)
    relaxAudioEngine.preloadSounds(RELAX_SOUNDS);

    return () => unsubscribe();
  }, []);

  const getCategoryIcon = (catId, className = "w-4 h-4") => {
    switch (catId) {
      case 'forest': return <Trees className={className} />;
      case 'birds': return <Feather className={className} />;
      case 'water': return <Droplet className={className} />;
      case 'rain': return <CloudRain className={className} />;
      case 'wind': return <Wind className={className} />;
      case 'fire': return <Flame className={className} />;
      case 'nature': return <Sparkles className={className} />;
      default: return <Sparkles className={className} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen bg-neutral-950 text-white flex flex-col justify-between overflow-hidden select-none">
      {/* 1. Full-screen dynamic nature environment animations (Birds, Waterfalls, Flowing River, Rain, Forest, Wind) */}
      <RelaxVisualizer activeCategories={engineState.activeCategories} />

      {/* Atmospheric Soft Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-black/80 z-[1]" />

      {/* Minimal Top Bar: Return to Loopra & Master Relax Mute/Vol */}
      <header className="relative z-10 w-full px-4 sm:px-6 md:px-8 py-3 sm:py-4 flex items-center justify-between pointer-events-auto">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-white/10 text-xs sm:text-sm font-semibold transition cursor-pointer backdrop-blur-xl shadow-lg active:scale-95"
            aria-label="Back to Loopra"
            title="Back to previous page"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span className="hidden xs:inline">Back</span>
          </button>
        )}

        {/* Ambient Master Volume Indicator */}
        <div className="flex items-center gap-2 bg-neutral-900/80 border border-white/10 rounded-2xl px-3 py-1.5 backdrop-blur-xl shadow-lg">
          <button
            onClick={() => relaxAudioEngine.toggleMute()}
            className="p-1 rounded text-neutral-400 hover:text-white transition cursor-pointer"
            title={engineState.isMuted ? 'Unmute Ambient' : 'Mute Ambient'}
          >
            {engineState.isMuted || engineState.masterVolume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={engineState.isMuted ? 0 : engineState.masterVolume}
            onChange={(e) => relaxAudioEngine.setMasterVolume(parseFloat(e.target.value))}
            className="w-16 sm:w-20 accent-emerald-400 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
            title="Master Relax Ambient Volume"
          />
        </div>
      </header>

      {/* 2. Unobstructed Nature Visual Center: Strictly empty to showcase environment */}
      <main className="relative z-0 flex-1 flex flex-col items-center justify-center p-4 pointer-events-none" />

      {/* 3. Floating Single "Sound Studio" Button */}
      <div className="relative z-20 flex justify-center pb-3 pointer-events-auto">
        <button
          onClick={() => setIsStudioOpen(true)}
          className="group flex items-center gap-2.5 px-6 py-3 rounded-full bg-neutral-900/90 hover:bg-neutral-850 text-white font-extrabold text-sm border border-emerald-500/40 hover:border-emerald-400/80 shadow-[0_0_35px_rgba(16,185,129,0.35)] backdrop-blur-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          title="Open Complete Sound Studio"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-neutral-950 flex items-center justify-center shadow-md group-hover:rotate-12 transition-transform">
            <Sparkles className="w-4 h-4 fill-current" />
          </div>
          <span className="tracking-wide">Sound Studio</span>
          {engineState.activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
              {engineState.activeCount}
            </span>
          )}
        </button>
      </div>

      {/* 4. Bottom Music Player: Fixed at bottom for simultaneous Loopra music */}
      <footer className="relative z-20 w-full px-4 sm:px-6 md:px-8 py-3 bg-neutral-900/95 border-t border-white/10 backdrop-blur-2xl shrink-0 flex items-center justify-between gap-3 sm:gap-6 shadow-[0_-10px_35px_rgba(0,0,0,0.8)] pointer-events-auto">
        {/* Track Artwork & Info */}
        <div
          onClick={() => onOpenExpandedPlayer && onOpenExpandedPlayer('player')}
          className="flex items-center gap-3 min-w-0 max-w-[40%] sm:max-w-sm cursor-pointer group"
        >
          {currentSong ? (
            <>
              <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-neutral-800 shrink-0 border border-white/10 shadow-md">
                <img
                  src={getCleanThumbnail ? getCleanThumbnail(currentSong) : (currentSong.thumbnail || currentSong.image || '/logo.png')}
                  alt={currentSong.title || 'Track thumbnail'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <p className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-emerald-400 transition">
                  {currentSong.title || 'Untitled Track'}
                </p>
                <p className="text-[10px] sm:text-xs text-neutral-400 truncate">
                  {currentSong.artist || currentSong.channelTitle || 'Loopra Music'}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2.5 text-neutral-400">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Music2 className="w-5 h-5 text-neutral-500" />
              </div>
              <div className="hidden xs:block">
                <p className="text-xs font-semibold text-neutral-300">No Song Playing</p>
                <p className="text-[10px] text-neutral-500">Play from Loopra library anytime</p>
              </div>
            </div>
          )}
        </div>

        {/* Global Song Player Controls */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <button
            onClick={onPrevSong}
            disabled={!currentSong}
            className="p-1.5 sm:p-2 rounded-full text-neutral-400 hover:text-white disabled:opacity-40 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            title="Previous track"
            aria-label="Previous track"
          >
            <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
          </button>

          <button
            onClick={onTogglePlay}
            disabled={!currentSong}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white hover:bg-neutral-200 text-neutral-950 flex items-center justify-center transition shadow-lg active:scale-95 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            title={isPlaying ? 'Pause music' : 'Play music'}
            aria-label={isPlaying ? 'Pause music' : 'Play music'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={onNextSong}
            disabled={!currentSong}
            className="p-1.5 sm:p-2 rounded-full text-neutral-400 hover:text-white disabled:opacity-40 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            title="Next track"
            aria-label="Next track"
          >
            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
          </button>
        </div>

        {/* Music Volume Control */}
        <div className="hidden md:flex items-center gap-2 w-36 justify-end">
          <Volume2 className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => onVolumeChange && onVolumeChange(parseFloat(e.target.value))}
            className="w-24 accent-emerald-400 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
            title="Music Player Volume"
          />
        </div>
      </footer>

      {/* 5. Single Unified Sound Studio Full Overlay Modal */}
      <SpatialStudioModal
        isOpen={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
        dspState={engineState.dsp}
        audioEngine={relaxAudioEngine}
        activeTracks={engineState.details}
        playingIds={engineState.playingIds}
        volumes={engineState.volumes}
        loadingIds={engineState.loadingIds}
        getCategoryIcon={getCategoryIcon}
      />
    </div>
  );
}
