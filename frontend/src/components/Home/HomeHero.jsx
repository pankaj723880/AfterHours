import React from 'react';
import HomeSearchBar from '../Search/HomeSearchBar';

export default function HomeHero({
  clockString,
  onSearch,
  onSelectSong,
  onPlaySong,
  placeholder,
  suggestions,
  user,
  token,
  backendUrl,
  onNavigate,
  onOpenInsights
}) {
  return (
    <div className="relative w-full rounded-3xl p-4 sm:p-6 md:p-8 bg-gradient-to-b from-[#181818] via-[#121212] to-[#0c0c0c] border border-amber-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(245,158,11,0.08)] overflow-hidden">
      {/* Ambient Warm Golden Orbs */}
      <div className="absolute -top-16 -left-16 w-80 h-80 rounded-full bg-amber-500/15 blur-[100px] pointer-events-none" />
      <div className="absolute top-1/4 right-0 w-80 h-80 rounded-full bg-orange-500/15 blur-[90px] pointer-events-none" />

      {/* Cinematic Man with Headphones (man.png) - Full Height & Seamless Background Merge */}
      <div className="absolute top-0 right-0 h-full w-[56%] sm:w-[50%] md:w-[44%] max-w-[440px] pointer-events-none select-none overflow-hidden z-0">
        {/* Ambient warm golden glow behind the character */}
        <div className="absolute inset-0 bg-gradient-to-l from-amber-500/25 via-orange-500/10 to-transparent blur-3xl pointer-events-none" />

        {/* Full-Height Character Artwork */}
        <img
          src="/man.png"
          alt="Person with headphones enjoying Loopra"
          className="w-full h-full object-cover object-[center_top] sm:object-top"
          style={{
            maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0) 100%), linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 98%)',
            WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0) 100%), linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0) 98%)'
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />

        {/* Seamless color merge overlays matching hero background (#181818 -> #121212 -> #0c0c0c) */}
        {/* Left smooth fade */}
        <div className="absolute inset-y-0 left-0 w-24 sm:w-36 bg-gradient-to-r from-[#181818] via-[#141414]/90 to-transparent pointer-events-none" />
        {/* Bottom smooth fade behind search bar */}
        <div className="absolute inset-x-0 bottom-0 h-20 sm:h-28 bg-gradient-to-t from-[#0c0c0c] via-[#0c0c0c]/85 to-transparent pointer-events-none" />
        {/* Top subtle blend */}
        <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#181818]/70 to-transparent pointer-events-none" />
        {/* Right subtle softness */}
        <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-[#121212]/40 to-transparent pointer-events-none" />
      </div>

      {/* Top Split Layout: Content on Left, Spacer on Right */}
      <div className="relative z-10 flex items-start justify-between gap-3 sm:gap-6 min-h-[140px] sm:min-h-[160px]">
        {/* Left Column: Clock Pill + Brand Tagline + Headline + Subtitle */}
        <div className="flex-1 min-w-0 pr-2 sm:pr-4 flex flex-col justify-start">
          {/* Live Digital Clock Pill */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900/85 backdrop-blur-xl border border-amber-500/30 text-[11px] sm:text-xs font-mono text-amber-300 shadow-md select-none w-fit mb-2.5">
            <span aria-hidden="true" className="text-amber-400">⏳</span>
            <span className="font-semibold">{clockString || "01:40:02 AM"}</span>
          </div>

          {/* Welcome Label & Accent Dash */}
          <div className="mb-1">
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest text-amber-400/90 font-mono">
              WELCOME TO LOOPRA
            </span>
            <div className="w-7 h-[2px] bg-amber-400 rounded-full mt-0.5 mb-1" />
          </div>

          {/* Headline: More Than Music */}
          <h1 className="text-2xl min-[380px]:text-3xl sm:text-4xl md:text-5xl font-display font-black text-white tracking-tight leading-[1.08] drop-shadow-md">
            More Than <br className="sm:hidden" />
            <span className="text-amber-400">Music</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-neutral-400 font-medium tracking-wide mt-1.5 leading-snug">
            Stream. Discover.<br className="sm:hidden" /> Relive. Repeat.
          </p>
        </div>

        {/* Right Column Spacer: Preserves layout balance so text never clashes with artwork */}
        <div className="shrink-0 w-28 min-[380px]:w-36 sm:w-48 md:w-56 h-32 sm:h-40 pointer-events-none select-none" />
      </div>

      {/* Bottom Full-Width Search Experience */}
      <div className="relative z-10 w-full pt-3 sm:pt-4">
        <HomeSearchBar
          onSearch={onSearch}
          onSelectSong={onSelectSong}
          onPlaySong={onPlaySong}
          placeholder={placeholder || "Search songs, artists, or paste link..."}
          suggestions={suggestions}
          showQuickTags={true}
          user={user}
          token={token}
          backendUrl={backendUrl}
        />
      </div>
    </div>
  );
}


