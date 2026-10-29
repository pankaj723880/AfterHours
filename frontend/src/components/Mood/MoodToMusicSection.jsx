import React, { useState, useCallback } from 'react';

const MOOD_SHORTCUTS = [
  { id: 'rainy', label: 'Rainy Day', icon: '🌧️', prompt: 'Raat mein baarish ho rahi hai, soothing rain Hindi songs' },
  { id: 'sad', label: 'Sad & Heartbreak', icon: '💔', prompt: 'Heartbreak sad emotional Hindi songs' },
  { id: 'romantic', label: 'Romantic Melodies', icon: '💖', prompt: '90s ke romantic Bollywood love songs' },
  { id: 'chill', label: 'Chill & Lofi', icon: '☕', prompt: 'Late night lofi chill Hindi songs slowed reverb' },
  { id: 'focus', label: 'Focus & Study', icon: '🎯', prompt: 'Coding ke liye calm instrumental ambient music' },
  { id: 'energetic', label: 'High-Energy Gym', icon: '⚡', prompt: 'Workout ke liye high-energy Punjabi dhol tracks' },
  { id: 'nostalgic', label: 'Retro Nostalgia', icon: '📻', prompt: 'Purane gaane jo nostalgia feel karayein Kishore Rafi' },
  { id: 'roadtrip', label: 'Road Trip Drive', icon: '🚗', prompt: 'Highway car drive travel songs Hindi indie' },
  { id: 'party', label: 'Party & Dance', icon: '🎉', prompt: 'Bollywood club party dance anthems' },
  { id: 'happy', label: 'Happy & Upbeat', icon: '😊', prompt: 'Feel good cheerful happy morning songs' }
];

const LANGUAGE_OPTIONS = [
  { id: 'all', label: 'All Languages' },
  { id: 'hindi', label: 'Hindi' },
  { id: 'punjabi', label: 'Punjabi' },
  { id: 'english', label: 'English' },
  { id: 'tamil', label: 'Tamil' },
  { id: 'telugu', label: 'Telugu' }
];

const ERA_OPTIONS = [
  { id: '', label: 'Any Era' },
  { id: '1970s', label: '1970s' },
  { id: '1980s', label: '1980s' },
  { id: '1990s', label: '1990s' },
  { id: '2000s', label: '2000s' },
  { id: '2010s', label: '2010s' },
  { id: 'latest', label: 'Latest / Trending' }
];

const ENERGY_OPTIONS = [
  { id: '', label: 'Auto Energy' },
  { id: 'low', label: 'Soft / Chill' },
  { id: 'medium', label: 'Moderate Groove' },
  { id: 'high', label: 'High Octane' }
];

export default function MoodToMusicSection({
  onPlaySong,
  onAddToQueue,
  onToggleLike,
  onAddToPlaylist,
  likedSongs = [],
  currentSong = null,
  isPlaying = false,
  backendUrl = '',
  showToast = () => {}
}) {
  const [prompt, setPrompt] = useState('');
  const [selectedMood, setSelectedMood] = useState('chill');
  const [language, setLanguage] = useState('all');
  const [era, setEra] = useState('');
  const [energy, setEnergy] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [analysisInfo, setAnalysisInfo] = useState(null);
  const [seed, setSeed] = useState(0);
  const [error, setError] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);

  const fetchRecommendations = useCallback(async (currentSeed = 0, customPrompt = prompt) => {
    setLoading(true);
    setError('');
    try {
      const apiUrl = backendUrl ? `${backendUrl}/api/mood/recommend` : '/api/mood/recommend';
      const reqBody = JSON.stringify({
        prompt: customPrompt,
        mood: selectedMood,
        language: language === 'all' ? undefined : language,
        era: era || undefined,
        energy: energy || undefined,
        seed: currentSeed
      });

      let res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: reqBody
      });

      if (!res.ok && backendUrl && (res.status === 404 || res.status >= 500)) {
        try {
          const fallbackRes = await fetch('/api/mood/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: reqBody
          });
          if (fallbackRes.ok) res = fallbackRes;
        } catch (_) {}
      }

      if (!res.ok) {
        throw new Error(`API responded with status ${res.status}`);
      }

      const data = await res.json();
      setRecommendations(Array.isArray(data.tracks) ? data.tracks : []);
      setAnalysisInfo(data.analysis || null);
      setHasGenerated(true);
    } catch (err) {
      console.error('[Mood AI Error]:', err.message);
      setError('Could not generate recommendations at this moment. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [backendUrl, prompt, selectedMood, language, era, energy]);

  const handleShortcutClick = (shortcut) => {
    setSelectedMood(shortcut.id);
    setPrompt(shortcut.prompt);
    setSeed(0);
    fetchRecommendations(0, shortcut.prompt);
  };

  const handleGenerate = (e) => {
    if (e) e.preventDefault();
    setSeed(0);
    fetchRecommendations(0);
  };

  const handleRefresh = () => {
    const nextSeed = seed + 1;
    setSeed(nextSeed);
    fetchRecommendations(nextSeed);
  };

  const handleSaveAsPlaylist = () => {
    if (!recommendations || recommendations.length === 0) {
      showToast('No recommendations available to save as playlist');
      return;
    }
    const playlistName = `Mood: ${selectedMood ? selectedMood.toUpperCase() : 'AI Mix'} (${new Date().toLocaleDateString()})`;
    if (typeof onAddToPlaylist === 'function') {
      onAddToPlaylist({
        name: playlistName,
        songs: recommendations
      });
    } else {
      showToast(`Generated playlist "${playlistName}" ready`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full min-w-0">
      {/* Hero Header */}
      <div className="relative rounded-3xl p-5 sm:p-8 bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border border-amber-500/30 shadow-2xl backdrop-blur-2xl overflow-hidden">
        <div className="absolute top-0 right-1/4 w-72 h-72 rounded-full bg-amber-500/10 blur-[80px] pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 text-lg sm:text-xl">
                ✨
              </span>
              <div>
                <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight">
                  Mood-to-Music AI
                </h2>
                <p className="text-xs text-amber-400/90 font-medium">
                  Natural language & multilingual mood engine for Hindi, Punjabi, Retro & Global melodies
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800/80 border border-neutral-700/60 text-[11px] font-mono text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Catalog Linked</span>
            </div>
          </div>

          {/* Natural Language Input */}
          <form onSubmit={handleGenerate} className="space-y-3 pt-2">
            <div className="relative">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder='E.g., "Raat mein baarish ho rahi hai, sad Hindi songs chahiye" or "Workout Punjabi dhol beats"'
                className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-amber-500/60 rounded-2xl px-4 py-3.5 pr-28 text-sm text-white placeholder-neutral-500 focus:outline-none transition-all shadow-inner"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-md"
              >
                {loading ? (
                  <span className="animate-spin text-sm">⚡</span>
                ) : (
                  <span>Curate</span>
                )}
              </button>
            </div>

            {/* Quick Mood Shortcuts */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                Popular Mood Shortcuts:
              </p>
              <div className="flex flex-wrap gap-2">
                {MOOD_SHORTCUTS.map((s) => {
                  const isActive = selectedMood === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleShortcutClick(s)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(var(--accent-rgb,245,158,11),0.2)]'
                          : 'bg-neutral-800/80 text-neutral-300 border-neutral-700/60 hover:bg-neutral-700/80 hover:text-white'
                      }`}
                    >
                      <span>{s.icon}</span>
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Granular Preference Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              {/* Language */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  {LANGUAGE_OPTIONS.map(l => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </div>

              {/* Era */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Era / Decade</label>
                <select
                  value={era}
                  onChange={(e) => setEra(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  {ERA_OPTIONS.map(e => (
                    <option key={e.id} value={e.id}>{e.label}</option>
                  ))}
                </select>
              </div>

              {/* Energy */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">Energy Level</label>
                <select
                  value={energy}
                  onChange={(e) => setEnergy(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  {ENERGY_OPTIONS.map(en => (
                    <option key={en.id} value={en.id}>{en.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Analysis Intent Breakdown */}
      {analysisInfo && (
        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-neutral-400">AI Intent:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold uppercase text-[10px]">
              Mood: {analysisInfo.detectedMood}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px]">
              Lang: {analysisInfo.detectedLanguage}
            </span>
            {analysisInfo.detectedEra && (
              <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px]">
                Era: {analysisInfo.detectedEra}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px]">
              Energy: {analysisInfo.detectedEnergy}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-3 py-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/80 transition flex items-center gap-1 active:scale-95 text-xs font-semibold cursor-pointer"
              title="Obtain a fresh set of recommendations"
            >
              <span>🔄</span>
              <span>Refresh Mix</span>
            </button>

            {recommendations.length > 0 && (
              <button
                onClick={handleSaveAsPlaylist}
                className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 transition flex items-center gap-1 active:scale-95 text-xs font-semibold cursor-pointer"
                title="Save current mix as a playlist"
              >
                <span>➕</span>
                <span>Save as Playlist</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetchRecommendations(seed)}
            className="px-3 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 text-white font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/60 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-neutral-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-neutral-800 rounded w-3/4" />
                <div className="h-2.5 bg-neutral-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations Result Grid */}
      {!loading && recommendations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-display font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
              <span className="text-amber-400">⚡</span>
              <span>Curated Soundtrack ({recommendations.length} Tracks)</span>
            </h3>
            <span className="text-xs text-neutral-400 font-mono">Catalog verified</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {recommendations.map((track) => {
              const isCurrent = currentSong && (currentSong.id === track.id || currentSong.videoId === track.id);
              const isFav = likedSongs.some(s => s.id === track.id || s.videoId === track.id);

              return (
                <div
                  key={track.id}
                  className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 group backdrop-blur-xl ${
                    isCurrent
                      ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_20px_rgba(var(--accent-rgb,245,158,11),0.15)]'
                      : 'bg-neutral-900/60 border-neutral-800/80 hover:bg-neutral-850 hover:border-amber-500/30'
                  }`}
                >
                  <div
                    onClick={() => onPlaySong && onPlaySong(track)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-12 h-12 rounded-xl object-cover shadow border border-neutral-800"
                        loading="lazy"
                      />
                      {isCurrent && isPlaying && (
                        <div className="absolute inset-0 bg-neutral-950/60 rounded-xl flex items-center justify-center">
                          <span className="text-xs animate-bounce">💿</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className={`text-xs font-bold truncate ${isCurrent ? 'text-amber-400' : 'text-white group-hover:text-amber-300'}`}>
                        {track.title}
                      </h4>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {track.channel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onPlaySong && onPlaySong(track)}
                      className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-neutral-950 transition active:scale-95"
                      title={isCurrent && isPlaying ? 'Playing' : 'Play Track'}
                    >
                      <span className="text-xs">▶</span>
                    </button>
                    {onAddToQueue && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }}
                        className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition active:scale-95 text-xs"
                        title="Add to Queue"
                      >
                        +Q
                      </button>
                    )}
                    {onToggleLike && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleLike(track); }}
                        className={`p-2 rounded-xl border transition active:scale-95 text-xs ${
                          isFav
                            ? 'bg-pink-500/20 border-pink-500/40 text-pink-400'
                            : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-pink-400'
                        }`}
                        title={isFav ? 'Favorited' : 'Favorite'}
                      >
                        {isFav ? '❤️' : '🤍'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state after search */}
      {!loading && hasGenerated && recommendations.length === 0 && !error && (
        <div className="p-12 text-center rounded-3xl bg-neutral-900/40 border border-neutral-800/80 space-y-3">
          <div className="text-3xl">🔍</div>
          <h4 className="text-white font-bold text-sm">No tracks matched your specific criteria</h4>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Try choosing a broader mood shortcut or relaxing the language and era filters.
          </p>
          <button
            onClick={() => handleShortcutClick(MOOD_SHORTCUTS[0])}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs"
          >
            Try Rainy Day Hits
          </button>
        </div>
      )}
    </div>
  );
}
