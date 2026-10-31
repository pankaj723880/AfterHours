import React from 'react';
import HomeSearchBar from '../Search/HomeSearchBar';
import { Radio, Sparkles, History, BarChart3 } from 'lucide-react';

export default function HomeHero({
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
  const highlights = [
    { label: 'Radio', icon: Radio, tab: 'radio' },
    { label: 'AI Assistant', icon: Sparkles, tab: 'mood' },
    { label: 'Nostalgia Stations', icon: History, tab: 'barber' },
    { label: 'Listening Insights', icon: BarChart3, action: onOpenInsights }
  ];

  return (
    <div className="relative w-full rounded-3xl p-5 sm:p-8 md:p-10 bg-gradient-to-br from-neutral-900/95 via-neutral-950/90 to-neutral-950/95 border border-amber-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_35px_rgba(245,158,11,0.1)] overflow-hidden">
      {/* Background Cinematic Visual with Smooth Vignette Blend */}
      <div
        className="absolute inset-0 bg-cover bg-right md:bg-center opacity-30 mix-blend-screen pointer-events-none scale-105 transition-transform duration-1000"
        style={{ backgroundImage: `url('/hero-cinematic.png')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-neutral-950/40 pointer-events-none" />

      {/* Ambient Warm Golden Orbs */}
      <div className="absolute -top-16 -left-16 w-80 h-80 rounded-full bg-amber-500/15 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-20 right-10 w-96 h-96 rounded-full bg-orange-500/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center space-y-4 sm:space-y-6">
        {/* Welcome Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold tracking-wide shadow-sm backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span className="uppercase tracking-widest text-[10px] font-mono font-bold">Welcome to Loopra</span>
          <span className="text-amber-500/60">•</span>
          <span className="text-neutral-300 font-medium hidden sm:inline text-[11px]">Immersive Desi & Global Lounge</span>
        </div>

        {/* Cinematic Headline & Subtitle */}
        <div className="space-y-1.5 sm:space-y-2">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-black text-white tracking-tight leading-tight drop-shadow-md">
            More Than <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400">Music</span>
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-amber-200/90 font-medium tracking-wide">
            Stream. Discover. Relive. Repeat.
          </p>
        </div>

        {/* Feature Highlights Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 pb-2">
          {highlights.map((h, i) => {
            const IconComp = h.icon;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (h.action) h.action();
                  else if (h.tab && onNavigate) onNavigate(h.tab);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 hover:border-amber-500/40 text-[11px] sm:text-xs font-medium transition cursor-pointer active:scale-95 shadow-sm"
              >
                <IconComp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{h.label}</span>
              </button>
            );
          })}
        </div>

        {/* Integrated Search Bar */}
        <div className="w-full pt-1">
          <HomeSearchBar
            onSearch={onSearch}
            onSelectSong={onSelectSong}
            onPlaySong={onPlaySong}
            placeholder={placeholder || "Search songs, artists, albums..."}
            suggestions={suggestions}
            showQuickTags={true}
            user={user}
            token={token}
            backendUrl={backendUrl}
          />
        </div>
      </div>
    </div>
  );
}

