import React, { useState } from 'react';

const TIMER_PRESETS = [15, 30, 45, 60];

export default function SleepTimerModal({
  isOpen,
  onClose,
  activeTimerRemaining, // seconds or null
  onSetTimer, // (minutes) => void
  onCancelTimer // () => void
}) {
  const [customMinutes, setCustomMinutes] = useState('');

  if (!isOpen) return null;

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    const val = parseInt(customMinutes, 10);
    if (!isNaN(val) && val > 0 && val <= 480) {
      onSetTimer(val);
      onClose();
    }
  };

  const formatRemaining = (totalSecs) => {
    if (!totalSecs || totalSecs <= 0) return '0:00';
    const m = Math.floor(totalSecs / 60);
    const s = Math.floor(totalSecs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className="fixed inset-0 z-[10000] bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">Sleep Timer</h3>
              <p className="text-[11px] text-neutral-400">Pause playback automatically</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Active Timer Status Banner */}
        {activeTimerRemaining && activeTimerRemaining > 0 && (
          <div className="mx-4 mt-4 p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-300">Timer Active</p>
              <p className="text-sm font-mono font-bold text-white">{formatRemaining(activeTimerRemaining)} remaining</p>
            </div>
            <button
              onClick={() => {
                onCancelTimer();
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition"
            >
              Cancel Timer
            </button>
          </div>
        )}

        {/* Presets */}
        <div className="p-4 sm:p-5 space-y-4">
          <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Set Timer</label>
          <div className="grid grid-cols-2 gap-2">
            {TIMER_PRESETS.map((mins) => (
              <button
                key={mins}
                onClick={() => {
                  onSetTimer(mins);
                  onClose();
                }}
                className="py-3 px-4 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-700/60 hover:border-amber-500/40 text-neutral-200 hover:text-amber-300 font-semibold text-xs sm:text-sm transition cursor-pointer text-center"
              >
                {mins} Minutes
              </button>
            ))}
          </div>

          {/* Custom Duration Form */}
          <form onSubmit={handleCustomSubmit} className="pt-2">
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="480"
                placeholder="Custom (minutes)"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={!customMinutes || parseInt(customMinutes, 10) <= 0}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Start
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
