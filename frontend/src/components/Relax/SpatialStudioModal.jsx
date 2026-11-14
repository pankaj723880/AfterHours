import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Sliders,
  Volume2,
  Headphones,
  RotateCcw,
  Check,
  Power,
  Compass,
  Radio,
  Activity,
  Layers,
  Waves,
  Zap,
  X,
  Search,
  Plus,
  Square,
  Bookmark,
  VolumeX,
  Loader2
} from 'lucide-react';
import {
  SPATIAL_STUDIO_MODES,
  SPATIAL_POSITIONS,
  EQ_BANDS,
  EQ_PRESETS
} from '../../services/spatialStudioDsp.js';
import { RELAX_CATEGORIES, RELAX_SOUNDS } from '../../constants/relaxSounds.js';

export default function SpatialStudioModal({
  isOpen,
  onClose,
  dspState,
  audioEngine,
  activeTracks = [],
  playingIds = [],
  volumes = {},
  loadingIds = [],
  getCategoryIcon
}) {
  // Tabs: 'sounds' | 'spatial' | 'effects' | 'eq' | 'presets'
  const [activeTab, setActiveTab] = useState('sounds');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // A/B Loudness metering state
  const [loudness, setLoudness] = useState({ originalDb: -60, processedDb: -60, diffDb: 0 });

  // Saved Presets state
  const [savedPresets, setSavedPresets] = useState(() => {
    try {
      const stored = localStorage.getItem('loopra_relax_saved_presets');
      return stored ? JSON.parse(stored) : [];
    } catch (_) {
      return [];
    }
  });
  const [newPresetName, setNewPresetName] = useState('');

  // Live polling for loudness meter when tab === 'spatial' or Studio is open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      if (audioEngine?.getLoudnessMeasurement) {
        setLoudness(audioEngine.getLoudnessMeasurement());
      }
    }, 250);
    return () => clearInterval(interval);
  }, [isOpen, audioEngine]);

  if (!isOpen) return null;

  const isEnabled = dspState?.isEnabled ?? false;
  const isBypassed = dspState?.isBypassed ?? false;
  const currentMode = dspState?.mode ?? 'natural';
  const currentPos = dspState?.activePosition ?? 'center';
  const eqGains = dspState?.eqGains ?? {};

  const filteredSounds = RELAX_SOUNDS.filter((sound) => {
    const matchesCat = selectedCategory === 'all' || sound.category === selectedCategory;
    const matchesSearch = !searchQuery.trim() ||
      sound.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sound.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sound.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const handleSavePreset = (e) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    const preset = {
      id: 'preset_' + Date.now(),
      name: newPresetName.trim(),
      date: new Date().toLocaleDateString(),
      playingSoundIds: [...playingIds],
      dsp: { ...dspState }
    };
    const updated = [preset, ...savedPresets].slice(0, 15);
    setSavedPresets(updated);
    try {
      localStorage.setItem('loopra_relax_saved_presets', JSON.stringify(updated));
    } catch (_) {}
    setNewPresetName('');
  };

  const handleApplySavedPreset = (preset) => {
    if (!audioEngine) return;
    // 1. Stop non-included sounds, play included sounds
    const targetSoundIds = new Set(preset.playingSoundIds || []);
    playingIds.forEach(id => {
      if (!targetSoundIds.has(id)) {
        audioEngine.stopSound(id);
      }
    });
    targetSoundIds.forEach(id => {
      if (!audioEngine.isSoundPlaying(id)) {
        const sound = RELAX_SOUNDS.find(s => s.id === id);
        if (sound) audioEngine.playAmbientTrack(sound);
      }
    });

    // 2. Apply DSP settings
    if (preset.dsp?.mode) {
      audioEngine.setDspMode(preset.dsp.mode);
    }
  };

  const handleDeletePreset = (id) => {
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    try {
      localStorage.setItem('loopra_relax_saved_presets', JSON.stringify(updated));
    } catch (_) {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-2xl animate-fadeIn">
      <div className="relative w-full max-w-4xl h-[94vh] max-h-[820px] bg-neutral-900/98 border border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white select-none">
        
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0 bg-neutral-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-md shrink-0">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  Sound Studio & Spatial Audio
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider hidden xs:inline">
                  DSP Studio
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 hidden sm:block">
                Authentic field recordings, calibrated spatial acoustics, 7-band EQ & presets
              </p>
            </div>
          </div>

          {/* Quick Actions & Close */}
          <div className="flex items-center gap-2">
            {/* A/B Compare Button */}
            <button
              onClick={() => audioEngine?.toggleDspBypass()}
              disabled={!isEnabled}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                isBypassed
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title="A/B Compare Original vs Processed"
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="text-[11px]">{isBypassed ? 'A: Original' : 'B: Studio'}</span>
            </button>

            {/* Close Studio Button */}
            <button
              onClick={onClose}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="Close Sound Studio"
            >
              <X className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">Close Studio</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Strip (All 5 Required Tabs) */}
        <div className="px-4 sm:px-6 py-2 bg-neutral-950/70 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto shrink-0 hide-scrollbar">
          <button
            onClick={() => setActiveTab('sounds')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'sounds'
                ? 'bg-emerald-500 text-neutral-950 shadow-md font-extrabold'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Sounds ({playingIds.length > 0 ? `${playingIds.length} Active` : RELAX_SOUNDS.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('spatial')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'spatial'
                ? 'bg-indigo-500 text-white shadow-md font-extrabold'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Spatial Audio</span>
          </button>

          <button
            onClick={() => setActiveTab('effects')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'effects'
                ? 'bg-indigo-500 text-white shadow-md font-extrabold'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Waves className="w-3.5 h-3.5" />
            <span>Effects</span>
          </button>

          <button
            onClick={() => setActiveTab('eq')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'eq'
                ? 'bg-indigo-500 text-white shadow-md font-extrabold'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Equalizer</span>
          </button>

          <button
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'presets'
                ? 'bg-indigo-500 text-white shadow-md font-extrabold'
                : 'text-neutral-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Presets</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 overscroll-contain">
          
          {/* ============================================================== */}
          {/* TAB 1: SOUNDS (Natural Categories, Multi-Selection & Volumes) */}
          {/* ============================================================== */}
          {activeTab === 'sounds' && (
            <div className="space-y-4">
              {/* Category Pills & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-emerald-500 text-neutral-950 font-bold shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10'
                    }`}
                  >
                    All ({RELAX_SOUNDS.length})
                  </button>
                  {RELAX_CATEGORIES.map(cat => {
                    const isSelected = selectedCategory === cat.id;
                    const inCat = RELAX_SOUNDS.filter(s => s.category === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500 text-neutral-950 font-bold shadow-md'
                            : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10'
                        }`}
                      >
                        {getCategoryIcon && getCategoryIcon(cat.id, 'w-3 h-3')}
                        <span>{cat.name} ({inCat})</span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full sm:w-60 shrink-0">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search sounds or tags..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-800/80 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              {/* Sound Cards Grid (3 Columns) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {filteredSounds.map((sound) => {
                  const isActive = audioEngine?.isSoundPlaying(sound.id);
                  const isLoading = loadingIds?.includes(sound.id);
                  const currentVol = volumes[sound.id] ?? sound.defaultVolume ?? 0.75;

                  return (
                    <div
                      key={sound.id}
                      onClick={() => audioEngine?.toggleSound(sound)}
                      className={`group relative aspect-square rounded-2xl border p-3 sm:p-4 flex flex-col justify-between transition-all duration-200 cursor-pointer select-none overflow-hidden ${
                        isActive
                          ? 'bg-emerald-950/40 border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.22)] ring-1 ring-emerald-500/50'
                          : 'bg-neutral-800/40 hover:bg-neutral-800/70 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                            isActive
                              ? 'bg-emerald-500 text-neutral-950 shadow-md'
                              : 'bg-white/10 text-neutral-300 group-hover:text-white'
                          }`}
                        >
                          {getCategoryIcon && getCategoryIcon(sound.category, 'w-4 h-4')}
                        </div>

                        {isLoading ? (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          </span>
                        ) : isActive ? (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-extrabold uppercase">
                            <Check className="w-2.5 h-2.5" /> ON
                          </span>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-white/20 group-hover:bg-white/40 transition" />
                        )}
                      </div>

                      <div className="space-y-0.5 my-auto">
                        <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-emerald-300 transition">
                          {sound.title}
                        </h4>
                        <p className="text-[10px] text-neutral-400 capitalize">
                          {sound.category}
                        </p>
                      </div>

                      <div className="w-full pt-1" onClick={(e) => e.stopPropagation()}>
                        {isActive ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[9px] text-neutral-400">
                              <span>Layer Vol</span>
                              <span>{Math.round(currentVol * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={currentVol}
                              onChange={(e) => audioEngine?.setSoundVolume(sound.id, parseFloat(e.target.value))}
                              className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-neutral-900 rounded-lg"
                              title={`${sound.title} volume`}
                            />
                          </div>
                        ) : (
                          <div className="text-[10px] text-neutral-500 font-medium truncate">
                            Tap to play in mix
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: SPATIAL AUDIO (Original, Stereo, Wide, 3D, Surround, etc.) */}
          {/* ============================================================== */}
          {activeTab === 'spatial' && (
            <div className="space-y-6">
              {/* Loudness Management & A/B Difference Banner */}
              <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <h4 className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Automatic Loudness Compensation Active
                  </h4>
                  <p className="text-[11px] text-neutral-300 mt-0.5">
                    Perceived loudness is preserved within approximately ±1.5 LU of Original across all spatial modes.
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-neutral-900/90 px-3 py-1.5 rounded-xl border border-white/10 font-mono text-[11px] shrink-0">
                  <span>Orig: <strong className="text-neutral-200">{loudness.originalDb}dB</strong></span>
                  <span>Proc: <strong className="text-neutral-200">{loudness.processedDb}dB</strong></span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    Math.abs(loudness.diffDb) <= 2 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    Diff: {loudness.diffDb > 0 ? `+${loudness.diffDb}` : loudness.diffDb}dB
                  </span>
                </div>
              </div>

              {/* Spatial Profiles Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Acoustic Spatial Profiles
                  </h4>
                  <span className="text-xs text-indigo-300 font-semibold capitalize">
                    Current: {currentMode}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {SPATIAL_STUDIO_MODES.map((mode) => {
                    const isSelected = currentMode === mode.id;
                    return (
                      <div
                        key={mode.id}
                        onClick={() => audioEngine?.setDspMode(mode.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-950/50 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500'
                            : 'bg-neutral-800/40 border-white/10 hover:border-white/20 hover:bg-neutral-800/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-white">{mode.name}</span>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-neutral-950">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-1 mb-2">
                          {mode.desc}
                        </p>
                        <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-white/5">
                          <span className={mode.isHeadphoneOnly ? 'text-amber-400 font-semibold' : 'text-neutral-500'}>
                            {mode.isHeadphoneOnly ? '🎧 Headphone Binaural' : '🔊 Speakers & Headset'}
                          </span>
                          {isSelected && (
                            <span className="text-emerald-400 font-bold uppercase tracking-wider">ACTIVE</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3D Spatial Virtual Positioning (Listener Head Diagram) */}
              <div className="bg-neutral-950/60 border border-white/10 rounded-2xl p-4 sm:p-6 text-center space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Virtual 3D Soundstage Positioning
                </h4>

                <div className="flex flex-col items-center">
                  <div className="relative w-56 h-56 rounded-full border border-dashed border-white/20 flex items-center justify-center bg-radial-gradient from-indigo-500/10 to-transparent">
                    {/* Center Listener Head */}
                    <div className="w-14 h-14 rounded-full bg-neutral-800 border-2 border-indigo-500 flex flex-col items-center justify-center shadow-lg z-10">
                      <Headphones className="w-6 h-6 text-indigo-400" />
                      <span className="text-[8px] font-bold text-neutral-300">LISTENER</span>
                    </div>

                    {/* Orbit Positions */}
                    {SPATIAL_POSITIONS.map((p) => {
                      const isTarget = currentPos === p.id;
                      let style = {};
                      if (p.id === 'center') style = { display: 'none' };
                      if (p.id === 'front') style = { top: '8%', left: '50%', transform: 'translate(-50%, -50%)' };
                      if (p.id === 'front-left') style = { top: '20%', left: '20%', transform: 'translate(-50%, -50%)' };
                      if (p.id === 'front-right') style = { top: '20%', left: '80%', transform: 'translate(-50%, -50%)' };
                      if (p.id === 'left') style = { top: '50%', left: '8%', transform: 'translate(-50%, -50%)' };
                      if (p.id === 'right') style = { top: '50%', left: '92%', transform: 'translate(-50%, -50%)' };
                      if (p.id === 'rear-left') style = { top: '80%', left: '20%', transform: 'translate(-50%, -50%)' };
                      if (p.id === 'rear-right') style = { top: '80%', left: '80%', transform: 'translate(-50%, -50%)' };

                      return (
                        <button
                          key={p.id}
                          style={style}
                          onClick={() => audioEngine?.setDsp3DPosition(p.id)}
                          className={`absolute px-2.5 py-1 rounded-full text-[10px] font-bold transition shadow-md cursor-pointer ${
                            isTarget
                              ? 'bg-emerald-500 text-neutral-950 scale-110 ring-2 ring-emerald-400'
                              : 'bg-neutral-800/90 text-neutral-300 border border-white/20 hover:text-white'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {SPATIAL_POSITIONS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => audioEngine?.setDsp3DPosition(p.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        currentPos === p.id
                          ? 'bg-emerald-500 text-neutral-950 border-emerald-400 font-bold'
                          : 'bg-neutral-800/60 text-neutral-300 border-white/10 hover:bg-neutral-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spatial Width & Distance Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-neutral-800/40 border border-white/10 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-200">Stereo Spatial Width</span>
                    <span className="text-indigo-400 font-bold">{Math.round((dspState?.spatialWidth || 1.0) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.05"
                    value={dspState?.spatialWidth || 1.0}
                    onChange={(e) => audioEngine?.setDspParam('spatialWidth', parseFloat(e.target.value))}
                    className="w-full accent-indigo-400 cursor-pointer h-1.5 bg-neutral-900 rounded-lg"
                  />
                  <p className="text-[10px] text-neutral-400">Widens or narrows the binaural soundstage perimeter</p>
                </div>

                <div className="bg-neutral-800/40 border border-white/10 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-200">Perceived Acoustic Distance</span>
                    <span className="text-emerald-400 font-bold">{(dspState?.spatialDistance || 1.0).toFixed(1)}m</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.1"
                    value={dspState?.spatialDistance || 1.0}
                    onChange={(e) => audioEngine?.setDspParam('spatialDistance', parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-neutral-900 rounded-lg"
                  />
                  <p className="text-[10px] text-neutral-400">Modulates HRTF perceived depth with loudness compensation</p>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: EFFECTS (Echo, Reverb, Room, Hall, Cave)                */}
          {/* ============================================================== */}
          {activeTab === 'effects' && (
            <div className="space-y-5">
              {/* Master Wet / Dry Mix */}
              <div className="bg-neutral-800/40 border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-200">Global Wet / Dry Mix (Dry is preserved 100%)</span>
                  <span className="text-amber-400 font-bold">{Math.round((dspState?.wetDry ?? 0.5) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={dspState?.wetDry ?? 0.5}
                  onChange={(e) => audioEngine?.setDspParam('wetDry', parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-neutral-900 rounded-lg"
                />
              </div>

              {/* Quick Environmental Reverb Presets */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Acoustic Environments
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'room', label: 'Cozy Room' },
                    { id: 'hall', label: 'Concert Hall' },
                    { id: 'cave', label: 'Deep Cave' },
                    { id: 'reverb', label: 'Natural Reverb' }
                  ].map(env => (
                    <button
                      key={env.id}
                      onClick={() => audioEngine?.setDspMode(env.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-between ${
                        currentMode === env.id
                          ? 'bg-emerald-500 text-neutral-950 border-emerald-400 shadow-md'
                          : 'bg-neutral-800/50 hover:bg-neutral-800 text-neutral-300 border-white/10'
                      }`}
                    >
                      <span>{env.label}</span>
                      {currentMode === env.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Echo Subsystem */}
              <div className="bg-neutral-950/60 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" /> Atmospheric Echo & Delay
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300">Echo Amount</span>
                      <span className="text-sky-300 font-semibold">{Math.round((dspState?.echoAmount ?? 0) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.8"
                      step="0.02"
                      value={dspState?.echoAmount ?? 0}
                      onChange={(e) => audioEngine?.setDspParam('echoAmount', parseFloat(e.target.value))}
                      className="w-full accent-sky-400 cursor-pointer h-1.5 bg-neutral-900 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300">Delay Time</span>
                      <span className="text-sky-300 font-semibold">{Math.round((dspState?.delayTime ?? 0.28) * 1000)}ms</span>
                    </div>
                    <input
                      type="range"
                      min="0.02"
                      max="1.2"
                      step="0.01"
                      value={dspState?.delayTime ?? 0.28}
                      onChange={(e) => audioEngine?.setDspParam('delayTime', parseFloat(e.target.value))}
                      className="w-full accent-sky-400 cursor-pointer h-1.5 bg-neutral-900 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300">Feedback</span>
                      <span className="text-sky-300 font-semibold">{Math.round((dspState?.feedback ?? 0.35) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.75"
                      step="0.02"
                      value={dspState?.feedback ?? 0.35}
                      onChange={(e) => audioEngine?.setDspParam('feedback', parseFloat(e.target.value))}
                      className="w-full accent-sky-400 cursor-pointer h-1.5 bg-neutral-900 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Reverb Subsystem */}
              <div className="bg-neutral-950/60 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5" /> Room & Acoustic Reverb
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300">Reverb Level</span>
                      <span className="text-emerald-300 font-semibold">{Math.round((dspState?.reverbAmount ?? 0) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.9"
                      step="0.02"
                      value={dspState?.reverbAmount ?? 0}
                      onChange={(e) => audioEngine?.setDspParam('reverbAmount', parseFloat(e.target.value))}
                      className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-neutral-900 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300">Room Size</span>
                      <span className="text-emerald-300 font-semibold">{Math.round((dspState?.roomSize ?? 0.5) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={dspState?.roomSize ?? 0.5}
                      onChange={(e) => audioEngine?.setDspParam('roomSize', parseFloat(e.target.value))}
                      className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-neutral-900 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300">Decay Time</span>
                      <span className="text-emerald-300 font-semibold">{(dspState?.decayTime ?? 2.2).toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="5.0"
                      step="0.1"
                      value={dspState?.decayTime ?? 2.2}
                      onChange={(e) => audioEngine?.setDspParam('decayTime', parseFloat(e.target.value))}
                      className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-neutral-900 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: EQUALIZER (All 7 Bands, Presets, Custom EQ, Reset)      */}
          {/* ============================================================== */}
          {activeTab === 'eq' && (
            <div className="space-y-6">
              {/* Presets and Reset */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-800/40 p-3 rounded-2xl border border-white/10">
                <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider mr-1">Presets:</span>
                  {Object.keys(EQ_PRESETS).map((pName) => (
                    <button
                      key={pName}
                      onClick={() => audioEngine?.setDspEqPreset(pName)}
                      className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold capitalize text-neutral-200 hover:text-white transition cursor-pointer shrink-0"
                    >
                      {pName}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => audioEngine?.setDspEqPreset('natural')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-300 transition cursor-pointer self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset / Flat EQ</span>
                </button>
              </div>

              {/* Vertical 7-Band Slider Faders */}
              <div className="bg-neutral-950/60 border border-white/10 rounded-2xl p-4 sm:p-6 flex items-center justify-between gap-2 overflow-x-auto">
                {EQ_BANDS.map((band) => {
                  const gain = eqGains[band.freq] ?? 0;
                  return (
                    <div key={band.freq} className="flex flex-col items-center space-y-2 flex-1 min-w-[48px]">
                      <span className="text-[10px] font-bold text-indigo-300">
                        {gain > 0 ? `+${gain}` : gain}dB
                      </span>

                      <div className="h-40 flex items-center justify-center">
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="0.5"
                          value={gain}
                          onChange={(e) => audioEngine?.setDspBandGain(band.freq, parseFloat(e.target.value))}
                          className="h-32 -rotate-90 accent-indigo-400 cursor-pointer bg-neutral-800 rounded-lg"
                        />
                      </div>

                      <div className="flex flex-col items-center text-center">
                        <span className="text-[10px] font-bold text-neutral-200">
                          {band.label}
                        </span>
                        <span className="text-[9px] font-semibold text-neutral-400">
                          {band.freq >= 1000 ? `${band.freq / 1000}k` : `${band.freq}`}Hz
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 5: PRESETS (Saved Sound and Effect Configurations)          */}
          {/* ============================================================== */}
          {activeTab === 'presets' && (
            <div className="space-y-5">
              {/* Save Current Mix / Configuration */}
              <div className="p-4 rounded-2xl bg-neutral-800/40 border border-white/10 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Save Current Configuration
                </h4>
                <form onSubmit={handleSavePreset} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="E.g. Deep Forest Thunderstorm + 3D Spatial..."
                    className="flex-1 px-3 py-2 rounded-xl bg-neutral-900 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50"
                  />
                  <button
                    type="submit"
                    disabled={!newPresetName.trim()}
                    className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition shadow-md disabled:opacity-40 cursor-pointer"
                  >
                    Save Preset
                  </button>
                </form>
              </div>

              {/* Saved Presets List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Your Saved Relax Presets ({savedPresets.length})
                </h4>

                {savedPresets.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center text-xs text-neutral-400">
                    No custom presets saved yet. Adjust your active sounds, spatial mode, and EQ, then save your current mix above!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {savedPresets.map((preset) => (
                      <div
                        key={preset.id}
                        className="p-3.5 rounded-2xl bg-neutral-800/40 border border-white/10 flex items-center justify-between gap-3"
                      >
                        <div>
                          <h5 className="font-bold text-xs text-white">{preset.name}</h5>
                          <p className="text-[10px] text-neutral-400">
                            {preset.playingSoundIds?.length || 0} sounds • Mode: {preset.dsp?.mode || 'natural'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleApplySavedPreset(preset)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs transition cursor-pointer"
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => handleDeletePreset(preset.id)}
                            className="p-1.5 rounded-xl text-neutral-400 hover:text-red-400 transition cursor-pointer"
                            title="Delete preset"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-white/10 bg-neutral-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-neutral-300 font-semibold">
              {playingIds.length} active sound {playingIds.length === 1 ? 'layer' : 'layers'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition shadow-md active:scale-95 cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
