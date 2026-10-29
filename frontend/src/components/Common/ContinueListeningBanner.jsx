import React from 'react';
import { getCleanThumbnail, formatTime } from '../../utils/storage';

export default function ContinueListeningBanner({
  savedSong,
  savedTime = 0,
  onResume,
  onDismiss
}) {
  if (!savedSong || savedTime < 5) return null;

  const trackId = savedSong.id || savedSong.videoId;
  const formattedTime = formatTime ? formatTime(savedTime) : `${Math.floor(savedTime / 60)}:${Math.floor(savedTime % 60).toString().padStart(2, '0')}`;

  return (
    <div className="w-full mb-6 p-4 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-amber-950/20 border border-amber-500/30 shadow-xl flex items-center justify-between gap-4 animate-fadeIn">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-amber-500/20 bg-neutral-950">
          <img
            src={getCleanThumbnail(savedSong, trackId)}
            alt={savedSong.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-neutral-950/20" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Continue Listening</span>
            <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded-md">At {formattedTime}</span>
          </div>
          <h4 className="font-bold text-sm text-white truncate max-w-sm">{savedSong.title}</h4>
          <p className="text-xs text-neutral-400 truncate">{savedSong.channel || savedSong.artist}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onResume}
          className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 font-bold text-xs shadow-lg transition flex items-center gap-1.5 cursor-pointer"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          <span>Resume</span>
        </button>

        <button
          onClick={onDismiss}
          className="p-2 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white transition cursor-pointer"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
