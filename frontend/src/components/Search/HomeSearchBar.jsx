import React, { useState, useEffect, useRef, useCallback } from 'react';
import VoiceSearchButton from './VoiceSearchButton';
import {
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearAllRecentSearches
} from '../../services/searchHistoryService';

const SUGGESTIONS = [
  'Arijit Singh',
  'Bollywood Retro',
  'Punjabi Hits',
  'Lofi Late Night',
  'KK Hits',
  'Coke Studio',
  'Anuv Jain'
];

const decodeHtml = (str = '') => {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
};

export default function HomeSearchBar({
  onSearch,
  onSelectSong,
  onPlaySong,
  initialQuery = '',
  placeholder = "Search songs, artists, or paste link...",
  suggestions,
  showQuickTags = true,
  user = null,
  token = null,
  backendUrl = ''
}) {
  const activeSuggestions = (Array.isArray(suggestions) && suggestions.length > 0) ? suggestions : SUGGESTIONS;
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestionsList, setSuggestionsList] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const requestIdRef = useRef(0);

  const currentUserId = user?.userId || user?._id || user?.id || null;

  // Load recent searches on mount and when user identity changes
  useEffect(() => {
    const list = getRecentSearches(currentUserId);
    setRecentSearches(list);
  }, [currentUserId]);

  // Live autocomplete search with debouncing & request cancellation
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestionsList([]);
      setIsSearching(false);
      setSelectedIndex(-1);
      return;
    }

    setIsSearching(true);
    const controller = new AbortController();
    const currentReqId = ++requestIdRef.current;

    const timer = setTimeout(async () => {
      try {
        const cleanBase = (backendUrl || '').trim().replace(/\/+$/, '');
        const targetUrl = cleanBase
          ? `${cleanBase}/api/youtube/search?q=${encodeURIComponent(trimmed)}&limit=10`
          : `/api/youtube/search?q=${encodeURIComponent(trimmed)}&limit=10`;

        const res = await fetch(targetUrl, { signal: controller.signal });

        // If another search started in the meantime, ignore this response
        if (currentReqId !== requestIdRef.current) return;

        if (!res.ok) {
          throw new Error(`Search error (${res.status})`);
        }

        const data = await res.json();
        if (currentReqId !== requestIdRef.current) return;

        const rawItems = Array.isArray(data?.items) ? data.items : [];
        const formatted = rawItems.slice(0, 10).map((item) => {
          const videoId = item.id?.videoId || item.id;
          return {
            id: videoId,
            title: decodeHtml(item.snippet?.title || 'Untitled Track'),
            channel: decodeHtml(item.snippet?.channelTitle || 'Unknown Artist'),
            thumbnail:
              item.snippet?.thumbnails?.high?.url ||
              item.snippet?.thumbnails?.medium?.url ||
              item.snippet?.thumbnails?.default?.url ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            rawItem: item
          };
        });

        setSuggestionsList(formatted);
        setSelectedIndex(-1);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[Autocomplete Request Warning]:', err.message);
        }
      } finally {
        if (currentReqId === requestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, backendUrl]);

  // Click outside listener to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const totalVisibleItems = query.trim().length > 0 ? suggestionsList.length : recentSearches.length;

  const handleSelectRecentQuery = useCallback((queryText) => {
    const trimmed = (queryText || '').trim();
    if (!trimmed) return;
    const updated = saveRecentSearch(trimmed, currentUserId, { token, backendUrl });
    setRecentSearches(updated);
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
    if (onSearch) {
      onSearch(trimmed);
    }
  }, [currentUserId, token, backendUrl, onSearch]);

  const handleSelectSong = useCallback((song) => {
    if (!song) return;
    // Persist song title into search history
    const updated = saveRecentSearch(song.title, currentUserId, { token, backendUrl });
    setRecentSearches(updated);
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);

    if (onSelectSong) {
      onSelectSong(song);
    } else if (onSearch) {
      onSearch(song.title);
    }
  }, [currentUserId, token, backendUrl, onSelectSong, onSearch]);

  const handleRemoveRecent = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = removeRecentSearch(item, currentUserId, { token, backendUrl });
    setRecentSearches(updated);
  };

  const handleClearAll = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Clear all recent searches?')) {
      const updated = clearAllRecentSearches(currentUserId, { token, backendUrl });
      setRecentSearches(updated);
    }
  };

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    const updated = saveRecentSearch(trimmed, currentUserId, { token, backendUrl });
    setRecentSearches(updated);
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);

    if (onSearch) {
      onSearch(trimmed);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestionsList([]);
    setSelectedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSuggestionClick = (s) => {
    setQuery(s);
    handleSelectRecentQuery(s);
  };

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalVisibleItems > 0) {
        setSelectedIndex((prev) => (prev + 1 >= totalVisibleItems ? 0 : prev + 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalVisibleItems > 0) {
        setSelectedIndex((prev) => (prev <= 0 ? totalVisibleItems - 1 : prev - 1));
      }
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < totalVisibleItems) {
        e.preventDefault();
        if (query.trim().length > 0) {
          handleSelectSong(suggestionsList[selectedIndex]);
        } else {
          handleSelectRecentQuery(recentSearches[selectedIndex]);
        }
      } else {
        handleSubmit(e);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  const hasSuggestions = query.trim().length > 0 && suggestionsList.length > 0;
  const hasRecentSearches = query.trim().length === 0 && recentSearches.length > 0;
  const showDropdown = isOpen && (hasSuggestions || hasRecentSearches || (query.trim().length > 0 && isSearching));

  return (
    <div ref={containerRef} className="w-full max-w-4xl mx-auto mb-5 sm:mb-8 px-0 min-w-0 relative">
      <div
        className={`relative rounded-2xl sm:rounded-3xl p-1 sm:p-1.5 transition-all duration-300 ${
          isFocused || isOpen
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
            {isSearching ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-4.35-4.35m1.85-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>

          {/* Input field */}
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            aria-expanded={showDropdown}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-controls="loopra-search-autocomplete-list"
            aria-activedescendant={selectedIndex >= 0 ? `suggestion-item-${selectedIndex}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              setIsFocused(true);
              setIsOpen(true);
            }}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
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

          {/* Voice Search Mic Button */}
          <VoiceSearchButton
            className="mr-1 sm:mr-2"
            onTranscriptChange={(text) => {
              setQuery(text);
              setIsOpen(true);
            }}
            onSearch={(speechQuery) => {
              setQuery(speechQuery);
              handleSelectRecentQuery(speechQuery);
            }}
            onPlaySong={(speechQuery) => {
              setQuery(speechQuery);
              if (onPlaySong) {
                onPlaySong(speechQuery);
              } else {
                handleSelectRecentQuery(speechQuery);
              }
            }}
          />

          {/* Search Action Button */}
          <button
            type="submit"
            className="flex items-center justify-center px-4 py-2 sm:px-6 sm:py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-md active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <span>Search</span>
          </button>
        </form>

        {/* Live Autocomplete & Recent Search Dropdown */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            id="loopra-search-autocomplete-list"
            role="listbox"
            aria-label={query.trim() ? "Autocomplete suggestions" : "Recent searches"}
            className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-neutral-900/95 backdrop-blur-2xl border border-amber-500/25 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_25px_rgba(var(--accent-rgb,245,158,11),0.12)] overflow-hidden animate-fadeIn max-h-[380px] overflow-y-auto box-border"
          >
            {/* Mode A: Matching Song Autocomplete Suggestions */}
            {query.trim().length > 0 && (
              <div>
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-neutral-800/80 bg-neutral-950/60 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_var(--accent-color,#f59e0b)]" />
                    <span className="text-white">Matching Songs</span>
                  </div>
                  <span className="text-[10px] text-amber-400/90 font-mono">
                    {isSearching ? 'Searching...' : `${suggestionsList.length} results`}
                  </span>
                </div>

                {suggestionsList.length > 0 ? (
                  <div className="divide-y divide-neutral-800/40">
                    {suggestionsList.map((song, idx) => (
                      <div
                        key={song.id || idx}
                        id={`suggestion-item-${idx}`}
                        role="option"
                        aria-selected={selectedIndex === idx}
                        onClick={() => handleSelectSong(song)}
                        className={`flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer transition-colors group select-none ${
                          selectedIndex === idx
                            ? 'bg-amber-500/20 text-amber-300 border-l-2 border-amber-500'
                            : 'hover:bg-neutral-800/80 text-neutral-200 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-neutral-950 shrink-0 border border-neutral-800 shadow-sm">
                            <img
                              src={song.thumbnail}
                              alt={song.title}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                e.currentTarget.src = `https://i.ytimg.com/vi/${song.id}/hqdefault.jpg`;
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <svg className="w-4 h-4 text-amber-400 fill-current ml-0.5" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-sm font-semibold truncate leading-tight group-hover:text-amber-400 transition-colors">
                              {song.title}
                            </h4>
                            <p className="text-[10px] sm:text-[11px] text-neutral-400 truncate mt-0.5 flex items-center gap-1.5">
                              <svg className="w-3 h-3 text-amber-500/80 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                              </svg>
                              <span>{song.channel}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 hidden sm:inline opacity-0 group-hover:opacity-100 transition-opacity">
                            Play
                          </span>
                          <div className="w-7 h-7 rounded-full bg-amber-500/10 group-hover:bg-amber-500 flex items-center justify-center text-amber-400 group-hover:text-neutral-950 transition-colors shadow-sm">
                            <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  !isSearching && (
                    <div className="p-4 text-center text-xs text-neutral-400">
                      No matching songs found. Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-amber-300 font-mono text-[10px] border border-neutral-700">Enter</kbd> to search YouTube.
                    </div>
                  )
                )}
              </div>
            )}

            {/* Mode B: Recent Search History (When Input is Empty) */}
            {query.trim().length === 0 && hasRecentSearches && (
              <div>
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-neutral-800/80 bg-neutral-950/60 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-white">Recent Searches</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[10px] text-neutral-400 hover:text-rose-400 uppercase tracking-wider font-bold transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                <div className="divide-y divide-neutral-800/30">
                  {recentSearches.map((item, idx) => (
                    <div
                      key={item + idx}
                      id={`suggestion-item-${idx}`}
                      role="option"
                      aria-selected={selectedIndex === idx}
                      onClick={() => handleSelectRecentQuery(item)}
                      className={`flex items-center justify-between px-3.5 py-2.5 cursor-pointer transition-colors group select-none ${
                        selectedIndex === idx
                          ? 'bg-amber-500/20 text-amber-300 border-l-2 border-amber-500'
                          : 'hover:bg-neutral-800/80 text-neutral-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-lg bg-neutral-800/80 flex items-center justify-center shrink-0 text-neutral-400 group-hover:text-amber-400 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="text-xs sm:text-sm font-medium truncate">{item}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleRemoveRecent(e, item)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-neutral-800/90 transition-colors shrink-0 ml-2 cursor-pointer"
                        title="Remove from history"
                        aria-label={`Remove ${item} from search history`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Search Tag Pills */}
      {showQuickTags && (
        <div className="flex items-center gap-2 mt-2.5 sm:mt-3 px-0 overflow-x-auto hide-scrollbar text-xs">
          <span className="text-amber-400 text-[11px] font-extrabold uppercase tracking-wider shrink-0 flex items-center gap-1">
            <span>⚡</span> QUICK:
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {activeSuggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleSuggestionClick(tag)}
                className="px-3 py-1 rounded-full bg-neutral-900/70 hover:bg-neutral-800 text-neutral-300 hover:text-amber-300 border border-neutral-800 hover:border-amber-500/40 text-[11px] font-medium transition-all duration-200 shrink-0 hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
