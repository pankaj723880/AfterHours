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

      {/* Top Split Layout: Content on Left, Cinematic Headphone Person & Waveform on Right */}
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

        {/* Right Column: Person with Headphones + Golden Waveform Graphic */}
        <div className="relative shrink-0 w-32 sm:w-48 md:w-56 h-36 sm:h-44 flex items-center justify-end select-none pointer-events-none">
          {/* Subtle golden ambient glow behind the character */}
          <div className="absolute inset-0 bg-gradient-to-l from-amber-500/25 via-orange-500/15 to-transparent rounded-full blur-2xl" />

          {/* Cinematic Headphone Profile Image */}
          <div className="relative w-full h-full flex items-center justify-end overflow-hidden rounded-2xl">
            <img
              src="/hero-cinematic.png"
              alt="Person with headphones listening to Loopra"
              className="w-full h-full object-cover object-right mask-radial-fade"
              style={{
                maskImage: 'linear-gradient(to left, black 65%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to left, black 65%, transparent 100%)'
              }}
              onError={(e) => {
                // If hero image fails, fallback gracefully
                e.currentTarget.style.display = 'none';
              }}
            />

            {/* Golden Vertical Equalizer Waveform Graphic */}
            <div className="absolute bottom-3 left-2 sm:left-4 flex items-end gap-[2px] sm:gap-1 h-8 sm:h-12 z-20">
              {[14, 22, 32, 18, 28, 36, 24, 16, 30, 20, 26, 12].map((height, i) => (
                <span
                  key={i}
                  className="w-[2.5px] sm:w-[3px] bg-gradient-to-t from-amber-500 via-amber-400 to-amber-300 rounded-full animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.6)]"
                  style={{
                    height: `${height}px`,
                    animationDelay: `${(i % 5) * 150}ms`,
                    animationDuration: '1.2s'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
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


