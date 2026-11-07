import React from 'react';
import HomeSearchBar from '../Search/HomeSearchBar';

export default function CompactHeroV2({
  clockString,
  onSearch,
  onSelectSong,
  onPlaySong,
  onArtistClick,
  placeholder,
  suggestions
}) {
  return (
    <div className="relative z-30 w-full rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 bg-gradient-to-b from-[#18181c]/95 via-[#121216]/95 to-[#0c0c0e]/95 border border-amber-500/25 shadow-[0_12px_36px_rgba(0,0,0,0.7),0_0_20px_rgba(245,158,11,0.06)] backdrop-blur-xl overflow-visible">
      {/* Ambient background glows */}
      <div className="absolute inset-0 rounded-2xl sm:rounded-3xl overflow-hidden pointer-events-none">
        <div className="absolute -top-10 -left-10 w-64 h-64 rounded-full bg-amber-500/15 blur-[70px]" />
        <div className="absolute top-1/2 right-0 w-64 h-64 rounded-full bg-orange-500/15 blur-[70px]" />

        {/* Headphone guy image (man.png) with seamless masking on right side */}
        <div className="absolute top-0 right-0 h-full w-[45%] sm:w-[40%] max-w-[320px] pointer-events-none select-none overflow-hidden z-0">
          <div className="absolute inset-0 bg-gradient-to-l from-amber-500/20 via-orange-500/10 to-transparent blur-2xl pointer-events-none" />
          <img
            src="/man.png"
            alt="Person with headphones enjoying Loopra"
            className="w-full h-full object-cover object-[center_top] sm:object-top"
            style={{
              maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0.4) 75%, rgba(0,0,0,0) 100%), linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 98%)',
              WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0.4) 75%, rgba(0,0,0,0) 100%), linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 98%)'
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-[#18181c] via-[#121216]/80 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#0c0c0e] via-[#0c0c0e]/80 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Header Info: Clock Pill + Heading + Exact Tagline */}
      <div className="relative z-10 flex items-start justify-between gap-3 min-h-[90px] sm:min-h-[110px]">
        <div className="flex-1 min-w-0 pr-2">
          {/* Live Digital Clock Pill */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-900/90 border border-amber-500/30 text-[10.5px] sm:text-xs font-mono text-amber-300 shadow-sm select-none mb-1.5">
            <span className="text-amber-400">⏳</span>
            <span className="font-semibold">{clockString || "01:40 AM"}</span>
          </div>

          {/* Heading */}
          <h1 className="text-xl sm:text-3xl font-display font-black text-white tracking-tight leading-tight">
            More Than <span className="text-amber-400">Music</span>
          </h1>

          {/* Restored exact tagline text */}
          <p className="text-[11px] sm:text-xs text-neutral-300 font-medium tracking-wide mt-1 leading-snug">
            Stream. Discover. Relive. Repeat.
          </p>
        </div>

        {/* Right side spacer to avoid text collision with man.png */}
        <div className="shrink-0 w-24 sm:w-36 h-20 pointer-events-none select-none" />
      </div>

      {/* Modern Frosted Glass Search Bar & Snap-Rail */}
      <div className="relative z-30 w-full pt-2">
        <HomeSearchBar
          onSearch={onSearch}
          onSelectSong={onSelectSong}
          onPlaySong={onPlaySong}
          onArtistClick={onArtistClick}
          placeholder={placeholder || "Search songs, artists, or paste link..."}
          suggestions={suggestions}
          showQuickTags={true}
        />
      </div>
    </div>
  );
}
