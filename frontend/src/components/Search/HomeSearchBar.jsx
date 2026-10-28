import React, { useState, useEffect } from 'react';

const SUGGESTIONS = [
  'Arijit Singh',
  'Bollywood Retro',
  'Punjabi Hits',
  'Lofi Late Night',
  'KK Hits',
  'Coke Studio',
  'Anuv Jain'
];

export default function HomeSearchBar({ onSearch, initialQuery = '', placeholder = "Search songs, artists, albums...", suggestions }) {
  const activeSuggestions = (Array.isArray(suggestions) && suggestions.length > 0) ? suggestions : SUGGESTIONS;
  const [query, setQuery] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (initialQuery !== undefined) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    if (onSearch) {
      onSearch(trimmed);
    }
  };

  const handleClear = () => {
    setQuery('');
  };

  const handleSuggestionClick = (s) => {
    setQuery(s);
    if (onSearch) {
      onSearch(s);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-5 sm:mb-8 px-0 min-w-0">
      <div 
        className={`relative rounded-2xl sm:rounded-3xl p-1 sm:p-1.5 transition-all duration-300 ${
          isFocused 
            ? 'bg-gradient-to-r from-amber-500/40 via-orange-500/50 to-amber-600/40 shadow-[0_0_35px_rgba(var(--accent-rgb,245,158,11),0.35)] ring-1 ring-amber-500/50' 
            : 'bg-gradient-to-r from-white/10 via-amber-500/15 to-white/5 shadow-2xl hover:shadow-[0_0_25px_rgba(var(--accent-rgb,245,158,11),0.2)]'
        }`}
      >
        <form 
          onSubmit={handleSubmit} 
          className="relative flex items-center bg-neutral-900/90 backdrop-blur-2xl rounded-[18px] sm:rounded-[22px] border border-amber-500/20 px-2.5 py-1.5 sm:px-3 sm:py-2.5 transition-all duration-300"
        >
          {/* Search Icon */}
          <div className="pl-1.5 pr-2 sm:pl-2 sm:pr-3 text-amber-400/80 flex items-center shrink-0">
            <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-4.35-4.35m1.85-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Input field */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className="w-full bg-transparent text-white placeholder-neutral-400 text-xs sm:text-base font-medium focus:outline-none min-w-0 pr-1.5 sm:pr-2 selection:bg-amber-500 selection:text-neutral-950"
            aria-label="Search songs, artists, albums"
          />

          {/* Clear button if has text */}
          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 sm:p-1.5 mr-1 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800/80 transition-all shrink-0"
              title="Clear search input"
              aria-label="Clear input"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Search Action Button */}
          <button
            type="submit"
            className="group relative flex items-center gap-1.5 px-3 py-1.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-neutral-950 font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-orange-950/60 active:scale-95 transition-all duration-200 shrink-0 cursor-pointer overflow-hidden border border-amber-300/40"
          >
            <span className="relative z-10 flex items-center gap-1 font-display uppercase tracking-wider font-extrabold text-[11px] sm:text-sm">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35m1.85-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Search</span>
            </span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          </button>
        </form>
      </div>

      {/* Quick Search Tag Pills */}
      <div className="flex items-center gap-2 mt-2.5 sm:mt-3 px-0 overflow-x-auto hide-scrollbar text-xs">
        <span className="text-neutral-500 text-[11px] font-semibold uppercase tracking-wider shrink-0 flex items-center gap-1">
          <span className="text-amber-500">⚡</span> Quick:
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {activeSuggestions.map((tag) => (
            <button
              key={tag}
              onClick={() => handleSuggestionClick(tag)}
              className="px-3 py-1 rounded-full bg-neutral-900/70 hover:bg-neutral-800 text-neutral-300 hover:text-amber-300 border border-neutral-800 hover:border-amber-500/40 text-[11px] font-medium transition-all duration-200 shrink-0 hover:scale-105 active:scale-95 shadow-sm"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
