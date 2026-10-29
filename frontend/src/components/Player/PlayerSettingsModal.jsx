import React, { useState, useEffect } from 'react';

const TIMER_PRESETS = [15, 30, 45, 60];
const CROSSFADE_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '3s', value: 3 },
  { label: '5s', value: 5 },
  { label: '10s', value: 10 },
];
const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

export default function PlayerSettingsModal({
  isOpen,
  onClose,
  currentSong,
  sleepTimerRemaining,
  onSetSleepTimer,
  onCancelSleepTimer,
  crossfadeDuration,
  onSetCrossfadeDuration,
  isGaplessEnabled,
  onToggleGapless,
  playbackSpeed,
  onSetPlaybackSpeed
}) {
  const [customTimerMinutes, setCustomTimerMinutes] = useState('');

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isOfflineSource = Boolean(currentSong?.isOffline);
  const isRadioSource = Boolean(currentSong?.isRadio);
  const isYouTubeSource = !isOfflineSource && !isRadioSource;

  const formatRemaining = (totalSecs) => {
    if (!totalSecs || totalSecs <= 0) return '0:00';
    const m = Math.floor(totalSecs / 60);
    const s = Math.floor(totalSecs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCustomTimerSubmit = (e) => {
    e.preventDefault();
    const val = parseInt(customTimerMinutes, 10);
    if (!isNaN(val) && val > 0 && val <= 480) {
      onSetSleepTimer(val);
      setCustomTimerMinutes('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-settings-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
              </svg>
            </div>
            <div>
              <h3 id="player-settings-title" className="font-bold text-sm sm:text-base text-white">Player Settings</h3>
              <p className="text-[11px] text-neutral-400">Audio playback preferences & timing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-6">
          {/* Active Audio Source Info */}
          <div className="p-3 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 flex items-center justify-between text-xs">
            <span className="text-neutral-400">Current Playback Source:</span>
            <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold ${
              isOfflineSource
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : isRadioSource
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            }`}>
              {isOfflineSource ? '💾 Local / Offline Audio' : isRadioSource ? '📻 Live Radio Stream' : '▶️ YouTube Stream'}
            </span>
          </div>

          {/* Section: Sleep Timer */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Sleep Timer</h4>
                <p className="text-[11px] text-neutral-500">Automatically stop playback when time runs out</p>
              </div>
              {sleepTimerRemaining && sleepTimerRemaining > 0 && (
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                  {formatRemaining(sleepTimerRemaining)}
                </span>
              )}
            </div>

            {/* Presets */}
            <div className="grid grid-cols-4 gap-2">
              {TIMER_PRESETS.map((mins) => (
                <button
                  key={mins}
                  onClick={() => onSetSleepTimer(mins)}
                  className="py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/80 hover:border-amber-500/50 text-neutral-200 hover:text-amber-300 text-xs font-semibold transition cursor-pointer text-center"
                >
                  {mins}m
                </button>
              ))}
            </div>

            {/* Custom Timer Input & Cancel */}
            <div className="flex gap-2">
              <form onSubmit={handleCustomTimerSubmit} className="flex-1 flex gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="480"
                  placeholder="Custom mins"
                  value={customTimerMinutes}
                  onChange={(e) => setCustomTimerMinutes(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={!customTimerMinutes || parseInt(customTimerMinutes, 10) <= 0}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-neutral-950 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Set
                </button>
              </form>

              {sleepTimerRemaining && sleepTimerRemaining > 0 && (
                <button
                  onClick={onCancelSleepTimer}
                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <hr className="border-neutral-800/80" />

          {/* Section: Crossfade */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Crossfade</h4>
                <p className="text-[11px] text-neutral-500">Gradually blend track transitions</p>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                {crossfadeDuration > 0 ? `${crossfadeDuration}s` : 'Off'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {CROSSFADE_OPTIONS.map((opt) => {
                const isSelected = crossfadeDuration === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => onSetCrossfadeDuration(opt.value)}
                    className={`py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Technical Source Status Badge */}
            <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 text-[11px] leading-relaxed">
              {isOfflineSource ? (
                <p className="text-emerald-400 flex items-center gap-1.5">
                  <span>✓</span>
                  <span>Crossfade active: Smooth volume fading enabled for offline audio files.</span>
                </p>
              ) : (
                <p className="text-neutral-400 flex items-start gap-1.5">
                  <span className="text-amber-400">ℹ️</span>
                  <span>
                    Crossfade operates on local offline audio. YouTube iframe streaming is constrained by browser cross-origin audio sandbox boundaries.
                  </span>
                </p>
              )}
            </div>
          </div>

          <hr className="border-neutral-800/80" />

          {/* Section: Gapless Playback */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Gapless Playback</h4>
                <p className="text-[11px] text-neutral-500">Eliminate silence between consecutive songs</p>
              </div>
              <button
                onClick={onToggleGapless}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isGaplessEnabled ? 'bg-amber-500' : 'bg-neutral-800'
                }`}
                role="switch"
                aria-checked={isGaplessEnabled}
                aria-label="Toggle Gapless Playback"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isGaplessEnabled ? 'translate-x-5 bg-neutral-950' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 text-[11px] leading-relaxed">
              {isOfflineSource ? (
                <p className="text-emerald-400 flex items-center gap-1.5">
                  <span>✓</span>
                  <span>Pre-buffering next track in IndexedDB memory cache for zero-gap playback.</span>
                </p>
              ) : (
                <p className="text-neutral-400 flex items-start gap-1.5">
                  <span className="text-amber-400">ℹ️</span>
                  <span>
                    Continuous live stream. YouTube and Radio streams fetch media chunks dynamically over the network.
                  </span>
                </p>
              )}
            </div>
          </div>

          <hr className="border-neutral-800/80" />

          {/* Section: Playback Speed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Playback Speed</h4>
                <p className="text-[11px] text-neutral-500">Adjust the tempo of your music</p>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400">
                {playbackSpeed}x
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {SPEED_OPTIONS.map((speed) => {
                const isSelected = playbackSpeed === speed;
                return (
                  <button
                    key={speed}
                    onClick={() => onSetPlaybackSpeed(speed)}
                    className={`py-2 rounded-xl text-xs font-mono font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700/80'
                    }`}
                  >
                    {speed}x
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-900/90 border-t border-neutral-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs border border-neutral-700 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

