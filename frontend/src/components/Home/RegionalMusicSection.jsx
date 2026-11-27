import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Play, MoreVertical, RefreshCw } from 'lucide-react';
import { getApiUrl } from '../../utils/apiUrl';

const REGIONS = [
  { id: 'in-hindi', label: 'India (Hindi)', query: 'latest hindi trending songs official audio' },
  { id: 'in-punjab', label: 'Punjab', query: 'latest punjabi hit songs official audio' },
  { id: 'in-maharashtra', label: 'Maharashtra', query: 'latest marathi hit songs official audio' },
  { id: 'in-tamil', label: 'Tamil Nadu', query: 'latest tamil hit songs official audio' },
  { id: 'in-telugu', label: 'Telugu', query: 'latest telugu hit songs official audio' },
  { id: 'in-karnataka', label: 'Karnataka', query: 'latest kannada hit songs official audio' },
  { id: 'in-kerala', label: 'Kerala', query: 'latest malayalam hit songs official audio' },
  { id: 'in-bengal', label: 'West Bengal', query: 'latest bengali hit songs official audio' },
  { id: 'in-gujarat', label: 'Gujarat', query: 'latest gujarati hit songs official audio' },
  { id: 'global', label: 'Global', query: 'global top hits english pop official audio' },
];

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const REGION_STORAGE_KEY = 'loopra_user_region';

function mapLocationToRegionId(state = '', country = '') {
  const s = `${state} ${country}`.toLowerCase();
  if (s.includes('punjab') || s.includes('chandigarh') || s.includes('haryana')) return 'in-punjab';
  if (s.includes('maharashtra') || s.includes('mumbai') || s.includes('pune')) return 'in-maharashtra';
  if (s.includes('tamil') || s.includes('chennai')) return 'in-tamil';
  if (s.includes('telangana') || s.includes('andhra') || s.includes('hyderabad')) return 'in-telugu';
  if (s.includes('karnataka') || s.includes('bengaluru') || s.includes('bangalore')) return 'in-karnataka';
  if (s.includes('kerala') || s.includes('kochi')) return 'in-kerala';
  if (s.includes('bengal') || s.includes('kolkata')) return 'in-bengal';
  if (s.includes('gujarat') || s.includes('ahmedabad') || s.includes('surat')) return 'in-gujarat';
  if (s.includes('india')) return 'in-hindi';
  return 'global';
}

export default function RegionalMusicSection({
  onPlayTrack,
  onContextMenu,
  getCleanThumbnail,
  handleImageError,
  fallbackTracks = []
}) {
  const [selectedRegionId, setSelectedRegionId] = useState(() => {
    try {
      return localStorage.getItem(REGION_STORAGE_KEY) || 'in-hindi';
    } catch (_) {
      return 'in-hindi';
    }
  });
  const [detectedLabel, setDetectedLabel] = useState('');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);

  const activeRegion = REGIONS.find(r => r.id === selectedRegionId) || REGIONS[0];

  const fetchRegionalTracks = useCallback(async (region) => {
    const cacheKey = `loopra_regional_cache_${region.id}`;
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (parsed && Array.isArray(parsed.tracks) && parsed.tracks.length > 0 && (Date.now() - parsed.ts < CACHE_TTL_MS)) {
          setTracks(parsed.tracks);
          return;
        }
      }
    } catch (_) {}

    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/search?q=${encodeURIComponent(region.query)}&limit=12`));
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
        const cleaned = items.slice(0, 12).map(item => ({
          ...item,
          id: item.id || item.videoId,
          videoId: item.videoId || item.id,
        })).filter(item => item.id);

        if (cleaned.length > 0) {
          setTracks(cleaned);
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), tracks: cleaned }));
          } catch (_) {}
          return;
        }
      }
    } catch (_) {}
    finally {
      setLoading(false);
    }

    if (fallbackTracks.length > 0) {
      setTracks(fallbackTracks.slice(0, 12));
    }
  }, [fallbackTracks]);

  useEffect(() => {
    fetchRegionalTracks(activeRegion);
  }, [activeRegion, fetchRegionalTracks]);

  // Passive location check if permission is already granted
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.geolocation) return;
    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      if (status.state === 'granted') {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 4000);
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
                { signal: controller.signal }
              );
              clearTimeout(timer);
              if (res.ok) {
                const geo = await res.json();
                const addr = geo?.address || {};
                const city = addr.city || addr.town || addr.state_district || '';
                const state = addr.state || '';
                const country = addr.country || '';
                if (city || state) {
                  setDetectedLabel(city ? `${city}, ${state || country}` : state);
                }
                if (!localStorage.getItem(REGION_STORAGE_KEY)) {
                  const mapped = mapLocationToRegionId(state, country);
                  setSelectedRegionId(mapped);
                }
              }
            } catch (_) {}
          },
          () => {},
          { timeout: 4000 }
        );
      }
    }).catch(() => {});
  }, []);

  const handleRegionChange = (e) => {
    const nextId = e.target.value;
    setSelectedRegionId(nextId);
    try {
      localStorage.setItem(REGION_STORAGE_KEY, nextId);
    } catch (_) {}
  };

  const displayTracks = tracks.length > 0 ? tracks : fallbackTracks.slice(0, 12);
  if (displayTracks.length === 0 && !loading) return null;

  return (
    <section className="space-y-3 sm:space-y-4 w-full min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg md:text-2xl font-display font-extrabold text-white tracking-tight truncate">
              Regional Music
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <MapPin className="w-3 h-3" />
              {detectedLabel || activeRegion.label}
            </span>
          </div>
          <p className="text-neutral-400 mt-0.5 text-xs md:text-sm font-medium">
            Sounds curated for {activeRegion.label}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedRegionId}
            onChange={handleRegionChange}
            aria-label="Select region"
            className="bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 text-xs text-neutral-200 rounded-xl px-3 py-1.5 outline-none cursor-pointer transition"
          >
            {REGIONS.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fetchRegionalTracks(activeRegion)}
            className="p-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 text-neutral-400 hover:text-white transition cursor-pointer"
            title="Refresh regional tracks"
            aria-label="Refresh regional tracks"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {displayTracks.map((song, idx) => (
          <div
            key={`${song.id}-${idx}`}
            onClick={() => onPlayTrack?.(song, displayTracks)}
            className="group relative flex-none w-36 sm:w-44 flex flex-col p-2.5 sm:p-3 rounded-2xl bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-800/80 hover:border-amber-500/40 transition-all duration-300 cursor-pointer shadow-md active:scale-[0.98]"
          >
            <div className="relative mb-2.5 overflow-hidden rounded-xl aspect-square shadow-lg">
              <img
                src={getCleanThumbnail ? getCleanThumbnail(song) : (song.thumbnail || '/loopra-logo.png')}
                alt={song.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={(e) => handleImageError?.(e, song.title, song.id)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="w-9 h-9 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-xl">
                  <Play className="w-4 h-4 text-neutral-950 fill-current translate-x-[1px]" />
                </div>
              </div>
            </div>
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-400 transition-colors leading-tight">
                  {song.title}
                </h3>
                <p className="text-[11px] text-neutral-400 truncate mt-1 font-medium">
                  {song.artist || song.channel || activeRegion.label}
                </p>
              </div>
              {onContextMenu && (
                <button
                  type="button"
                  onClick={(e) => onContextMenu(e, song)}
                  className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition shrink-0 cursor-pointer"
                  title="More Options"
                  aria-label="More Options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
