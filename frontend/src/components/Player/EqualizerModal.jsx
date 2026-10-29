import React, { useState, useEffect } from 'react';
import { 
  audioEqualizerService, 
  EQ_BANDS, 
  EQ_PRESETS 
} from '../../services/audioEqualizerService';

export { EQ_BANDS, EQ_PRESETS };

export default function EqualizerModal({ 
  isOpen, 
  onClose, 
  isOfflineSource = false,
  audioElement = null 
}) {
  // Sync state with audioEqualizerService
  const [eqState, setEqState] = useState(() => audioEqualizerService.getSettings());

  useEffect(() => {
    // Subscribe to service updates
    const unsubscribe = audioEqualizerService.subscribe((newState) => {
      setEqState(newState);
    });

    // Attach to audioElement if provided
    if (audioElement) {
      audioEqualizerService.attachToAudioElement(audioElement);
    }

    return () => {
      unsubscribe();
    };
  }, [audioElement]);

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { enabled, preset, gains } = eqState;

  const handleToggleEnabled = () => {
    audioEqualizerService.setEnabled(!enabled);
  };

  const handlePresetSelect = (presetKey) => {
    audioEqualizerService.setPreset(presetKey);
  };

  const handleBandChange = (index, value) => {
    audioEqualizerService.setBandGain(index, Number(value));
  };

  const handleReset = () => {
    audioEqualizerService.reset();
  };

  const currentPresetName = EQ_PRESETS[preset]?.name || 'Custom';

  return (
    <div 
      className="fixed inset-0 z-[10000] bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="equalizer-modal-title"
    >
      <div 
        className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="equalizer-modal-title" className="font-bold text-sm sm:text-base text-white tracking-wide">
                  10-Band Graphic Equalizer
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  enabled 
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' 
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}>
                  {enabled ? 'Active' : 'Bypassed'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Preset: <span className="text-amber-300 font-semibold">{currentPresetName}</span> • ISO Standard Filter Bands (-12 dB to +12 dB)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Enable Button */}
            <button
              type="button"
              onClick={handleToggleEnabled}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer select-none active:scale-95 ${
                enabled
                  ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md shadow-amber-500/20 font-bold'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
              }`}
              aria-label={enabled ? "Bypass Equalizer" : "Enable Equalizer"}
            >
              {enabled ? 'Equalizer On' : 'Equalizer Off'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
              aria-label="Close Equalizer"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Playback Source Capability Banner */}
        <div className={`px-4 py-3 border-b text-xs flex items-start gap-2.5 transition-colors ${
          isOfflineSource
            ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
            : 'bg-amber-950/30 border-amber-800/40 text-amber-200/90'
        }`}>
          <span className="text-base shrink-0 leading-none mt-0.5">
            {isOfflineSource ? '🎛️' : '⚠️'}
          </span>
          <div className="space-y-0.5">
            <div className="font-semibold flex items-center gap-2">
              <span>
                {isOfflineSource 
                  ? 'Equalizer Active — Processing Direct Audio' 
                  : 'Equalizer is unavailable for this playback source.'}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                isOfflineSource 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {isOfflineSource ? 'Web Audio Active' : 'YouTube Sandbox'}
              </span>
            </div>
            <p className="text-[11px] opacity-80 leading-relaxed">
              {isOfflineSource ? (
                'Real-time 10-band Web Audio API filter chain is actively modulating playback with anti-clipping dynamics limiting.'
              ) : (
                'YouTube streams play inside a sandboxed cross-origin player where browser CORS security restricts raw audio signal processing. The equalizer settings configured here remain active and will automatically apply to all authorized direct audio files and offline downloaded tracks.'
              )}
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          {/* Presets Row */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Sound Presets
              </label>
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-neutral-700/60 bg-neutral-800/60 text-neutral-300 hover:text-amber-300 hover:border-amber-500/40 transition cursor-pointer flex items-center gap-1 active:scale-95"
                title="Reset all bands to Flat (0 dB)"
              >
                <span>↺</span>
                <span>Reset to Flat</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {Object.entries(EQ_PRESETS).map(([key, p]) => {
                const isSelected = preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePresetSelect(key)}
                    className={`px-3 py-1.5 rounded-xl text-xs transition cursor-pointer select-none active:scale-95 ${
                      isSelected
                        ? 'bg-amber-500 text-neutral-950 font-bold border border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-neutral-800/80 border border-neutral-700/60 text-neutral-300 hover:bg-neutral-700/80 hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 10 Graphic Sliders */}
          <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-inner">
            <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-2 px-1 font-mono">
              <span>+12 dB (Boost)</span>
              <span className="text-neutral-500">0 dB (Flat Reference)</span>
              <span>-12 dB (Cut)</span>
            </div>

            <div className="grid grid-cols-10 gap-1 sm:gap-2 h-48 sm:h-52 items-end justify-items-center relative">
              {/* Zero-dB reference line across the sliders */}
              <div 
                className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-b border-dashed border-neutral-700/40 pointer-events-none z-0" 
                aria-hidden="true" 
              />

              {EQ_BANDS.map((band, idx) => {
                const gain = Number(gains[idx] || 0);
                const displayGain = gain > 0 ? `+${gain}` : `${gain}`;
                
                return (
                  <div key={band.freq} className="flex flex-col items-center h-full justify-between w-full relative z-10">
                    {/* Gain Numeric Value */}
                    <span className={`text-[10px] font-mono leading-none ${
                      !enabled 
                        ? 'text-neutral-600' 
                        : gain > 0 
                          ? 'text-amber-400 font-bold' 
                          : gain < 0 
                            ? 'text-neutral-300' 
                            : 'text-neutral-400'
                    }`}>
                      {displayGain}
                    </span>

                    {/* Vertical Range Slider */}
                    <div className="relative h-32 sm:h-36 flex items-center justify-center w-full">
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={gain}
                        disabled={!enabled}
                        onChange={(e) => handleBandChange(idx, e.target.value)}
                        aria-label={`Frequency ${band.label} gain: ${displayGain} dB`}
                        aria-valuemin="-12"
                        aria-valuemax="12"
                        aria-valuenow={gain}
                        className="w-32 sm:w-36 -rotate-90 appearance-none bg-neutral-800 rounded-lg cursor-pointer accent-amber-500 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                        style={{ transformOrigin: 'center' }}
                      />
                    </div>

                    {/* Frequency Band Label */}
                    <span className="text-[10px] font-bold text-neutral-400 truncate max-w-full text-center tracking-tight">
                      {band.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between gap-3">
          <p className="text-[11px] text-neutral-400 hidden sm:block">
            Settings automatically persist and synchronize with direct audio sources.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 font-bold text-xs tracking-wide transition shadow-lg shadow-amber-500/20 cursor-pointer ml-auto"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
