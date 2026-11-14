import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Square,
  Sliders,
  Search,
  Headphones,
  Sparkles,
  RefreshCw,
  Compass,
  Feather,
  Droplet,
  Activity,
  Trees,
  Check
} from 'lucide-react';
import { relaxAudioEngine } from '../../services/relaxAudioEngine';
import { RELAX_CATEGORIES, RELAX_SOUNDS } from '../../constants/relaxSounds';
import RelaxVisualizer from './RelaxVisualizer';

export default function RelaxModeView() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [engineState, setEngineState] = useState(() => relaxAudioEngine.getState());
  const [isMixerDrawerOpen, setIsMixerDrawerOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = relaxAudioEngine.subscribe((state) => {
      setEngineState({ ...state });
    });
    return () => unsubscribe();
  }, []);

  const filteredSounds = RELAX_SOUNDS.filter((sound) => {
    const matchesCat = selectedCategory === 'all' || sound.category === selectedCategory;
    const matchesSearch = !searchQuery.trim() ||
      sound.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sound.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sound.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const getCategoryIcon = (catId) => {
    switch (catId) {
      case 'forest': return <Trees className="w-4 h-4" />;
      case 'birds': return <Feather className="w-4 h-4" />;
      case 'water': return <Droplet className="w-4 h-4" />;
      case 'binaural': return <Activity className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  return (
    <div className="relative min-h-[85vh] w-full rounded-3xl overflow-hidden border border-white/10 bg-neutral-950/80 backdrop-blur-2xl text-white flex flex-col select-none shadow-2xl">
      {/* Dynamic Layered Visual Background */}
      <RelaxVisualizer activeCategories={engineState.activeCategories} />

      {/* Foreground Content */}
      <div className="relative z-10 flex flex-col flex-1 p-4 sm:p-6 md:p-8 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Nature & Sound Lounge
              </span>
              {engineState.activeCount > 0 && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {engineState.activeCount} Active {engineState.activeCount === 1 ? 'Layer' : 'Layers'} Playing
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1.5 text-white flex items-center gap-2">
              Loopra Relax Mode
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-0.5 max-w-xl">
              Multi-sound ambient mixer. Select Forest, Water, Birds, and true stereo Binaural Beats to play simultaneously in harmony.
            </p>
          </div>

          {/* Master Controls Toolbar */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-start md:self-auto bg-neutral-900/80 border border-white/10 rounded-2xl p-2 sm:px-3 sm:py-2 backdrop-blur-md">
            {/* Master Volume Slider */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => relaxAudioEngine.toggleMute()}
                className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer"
                title={engineState.isMuted ? 'Unmute' : 'Mute'}
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
                className="w-20 sm:w-28 accent-emerald-400 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                title="Master Relax Volume"
              />
            </div>

            {/* Stop All Button */}
            {engineState.activeCount > 0 && (
              <button
                onClick={() => relaxAudioEngine.stopAll()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-semibold transition active:scale-95 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop All</span>
              </button>
            )}

            {/* Mixer Drawer Toggle */}
            <button
              onClick={() => setIsMixerDrawerOpen(prev => !prev)}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${isMixerDrawerOpen || engineState.activeCount > 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-400 border-white/10'
                }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mixer</span>
            </button>
          </div>
        </div>

        {/* Headphones Advisory Banner for Binaural Beats */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-200 text-xs">
          <Headphones className="w-4 h-4 shrink-0 text-sky-400" />
          <span>
            <strong>Audio Tip:</strong> Headphones are recommended for Binaural Beats to perceive the stereo left & right channel frequency differential. Designed purely for relaxation.
          </span>
        </div>

        {/* Categories Bar & Search Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${selectedCategory === 'all'
                  ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10'
                }`}
            >
              All 40 Sounds
            </button>
            {RELAX_CATEGORIES.map(cat => {
              const isSelected = selectedCategory === cat.id;
              const activeInCat = engineState.details.filter(d => d.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${isSelected
                      ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10'
                    }`}
                >
                  {getCategoryIcon(cat.id)}
                  <span>{cat.name}</span>
                  {activeInCat > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search sounds or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900/80 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Multi-Sound Playing Mixer Drawer (Collapsible) */}
        {isMixerDrawerOpen && engineState.activeCount > 0 && (
          <div className="p-4 rounded-2xl bg-neutral-900/90 border border-amber-500/30 backdrop-blur-xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5" />
                Active Multi-Sound Mixer ({engineState.activeCount})
              </h3>
              <span className="text-[11px] text-neutral-400">Adjust individual balance</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {engineState.details.map(item => (
                <div key={item.id} className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold truncate text-white">{item.title}</span>
                    <button
                      onClick={() => relaxAudioEngine.stopSound(item.id)}
                      className="text-neutral-400 hover:text-red-400 transition"
                      title="Stop this layer"
                    >
                      <Square className="w-3 h-3 fill-current" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={item.volume}
                      onChange={(e) => relaxAudioEngine.setSoundVolume(item.id, parseFloat(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                    />
                    <span className="text-[10px] font-mono text-neutral-400 w-8 text-right">
                      {Math.round(item.volume * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 40 Sounds Interactive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 overflow-y-auto max-h-[60vh] pr-1">
          {filteredSounds.map((sound) => {
            const isPlaying = engineState.playingIds.includes(sound.id);
            const volume = engineState.volumes[sound.id] ?? sound.defaultVolume ?? 0.75;

            return (
              <div
                key={sound.id}
                className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${isPlaying
                    ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                    : 'bg-neutral-900/60 border-white/10 hover:border-white/20'
                  }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
                      {getCategoryIcon(sound.category)}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                      {sound.category}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white truncate">{sound.title}</h4>
                  <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1 leading-relaxed">
                    {sound.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2.5">
                  {/* Volume Slider if Playing */}
                  {isPlaying && (
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={(e) => relaxAudioEngine.setSoundVolume(sound.id, parseFloat(e.target.value))}
                        className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                      />
                      <span className="text-[10px] font-mono text-neutral-400 w-7 text-right">
                        {Math.round(volume * 100)}%
                      </span>
                    </div>
                  )}

                  {/* Play / Toggle Button */}
                  <button
                    onClick={() => relaxAudioEngine.toggleSound(sound)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${isPlaying
                        ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/25'
                        : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                      }`}
                  >
                    {isPlaying ? (
                      <>
                        <Square className="w-3 h-3 fill-current" />
                        <span>Playing in Mix (Stop)</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Add to Mix</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

