import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Play, MoreVertical, RefreshCw } from 'lucide-react';
import { getApiUrl } from '../../utils/apiUrl';
import { REGIONAL_SEED_POOLS } from '../../constants/regionalSeedPools';
import { locationAnalyticsService, mapGeoToLoopraRegionId } from '../../services/locationAnalyticsService';

const REGIONS = [
  { id: 'in-hindi', label: 'India (Hindi)', query: 'latest hindi trending songs official audio' },
  { id: 'in-bhojpuri', label: 'UP East / Bihar (Bhojpuri + Hindi)', query: 'latest bhojpuri hindi hit songs official audio' },
  { id: 'in-maithili', label: 'Mithilanchal (Maithili + Hindi)', query: 'maithili hindi hit songs official audio' },
  { id: 'in-magahi', label: 'Magadh (Magahi + Hindi)', query: 'magahi hindi hit songs official audio' },
  { id: 'in-angika', label: 'Anga / Bhagalpur (Angika + Hindi)', query: 'angika hindi hit songs official audio' },
  { id: 'in-garhwali', label: 'Garhwal (Garhwali + Hindi)', query: 'garhwali songs official audio' },
  { id: 'in-kumaoni', label: 'Kumaon (Kumaoni + Hindi)', query: 'kumaoni hindi hit songs official audio' },
  { id: 'in-himachali', label: 'Himachal (Pahadi + Hindi)', query: 'himachali pahadi hindi hit songs official audio' },
  { id: 'in-jharkhand', label: 'Jharkhand (Nagpuri/Khortha + Hindi)', query: 'nagpuri khortha hindi hit songs official audio' },
  { id: 'in-punjab', label: 'Punjab', query: 'latest punjabi hit songs official audio' },
  { id: 'in-maharashtra', label: 'Maharashtra', query: 'latest marathi hit songs official audio' },
  { id: 'in-tamil', label: 'Tamil Nadu', query: 'latest tamil hit songs official audio' },
  { id: 'in-telugu', label: 'Telugu', query: 'latest telugu hit songs official audio' },
  { id: 'in-karnataka', label: 'Karnataka', query: 'latest kannada hit songs official audio' },
  { id: 'in-kerala', label: 'Kerala', query: 'latest malayalam hit songs official audio' },
  { id: 'in-bengal', label: 'West Bengal / North Bengal', query: 'latest bengali hit songs official audio' },
  { id: 'in-gujarat', label: 'Gujarat', query: 'latest gujarati hit songs official audio' },
  { id: 'global', label: 'Global', query: 'global top hits english pop official audio' },
];

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const REGION_STORAGE_KEY = 'loopra_user_region';
const REGION_META_KEY = 'loopra_user_region_v2';

function loadSavedRegionMeta() {
  try {
    const raw = localStorage.getItem(REGION_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.regionId) return parsed;
    }
    const legacy = localStorage.getItem(REGION_STORAGE_KEY);
    if (legacy) return { regionId: legacy, source: 'manual', label: '' };
  } catch (_) {}
  return { regionId: 'in-hindi', source: 'default', label: '' };
}

function saveRegionMeta(meta) {
  try {
    localStorage.setItem(REGION_META_KEY, JSON.stringify(meta));
    localStorage.setItem(REGION_STORAGE_KEY, meta.regionId);
  } catch (_) {}
}
const LANGUAGE_STORAGE_KEY = 'loopra_user_language';

const LANGUAGE_TO_POOL_ID = {
  'Hindi': 'in-hindi',
  'Punjabi': 'in-punjab',
  'Marathi': 'in-maharashtra',
  'Tamil': 'in-tamil',
  'Telugu': 'in-telugu',
  'Kannada': 'in-karnataka',
  'Malayalam': 'in-kerala',
  'Bengali': 'in-bengal',
  'Gujarati': 'in-gujarat',
  'English': 'global'
};

const LANGUAGES = [
  'All / Regional',
  'Hindi',
  'Punjabi',
  'Marathi',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Bengali',
  'Gujarati',
  'English'
];

function mapLocationToRegionId(state = '', country = '', city = '', district = '') {
  return mapGeoToLoopraRegionId({ state, country, city, district });
}

export default function RegionalMusicSection({
  onPlayTrack,
  onContextMenu,
  getCleanThumbnail,
  handleImageError,
  fallbackTracks = []
}) {
  const initialMeta = loadSavedRegionMeta();
  const [selectedRegionId, setSelectedRegionId] = useState(initialMeta.regionId);
  const [regionSource, setRegionSource] = useState(initialMeta.source || 'default');
  const [detectedLabel, setDetectedLabel] = useState(initialMeta.label || '');
  const [locationNotice, setLocationNotice] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    try {
      return localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'All / Regional';
    } catch (_) {
      return 'All / Regional';
    }
  });
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [draftLanguage, setDraftLanguage] = useState(selectedLanguage);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);

  const activeRegion = REGIONS.find(r => r.id === selectedRegionId) || REGIONS[0];

  const fetchRegionalTracks = useCallback(async (region, forceReshuffle = false, langOverride = null) => {
    const effectiveLang = langOverride || selectedLanguage;
    const targetPoolId = (effectiveLang && effectiveLang !== 'All / Regional' && LANGUAGE_TO_POOL_ID[effectiveLang])
      ? LANGUAGE_TO_POOL_ID[effectiveLang]
      : region.id;

    const nativePool = REGIONAL_SEED_POOLS[targetPoolId] || [];
    const hindiPool = REGIONAL_SEED_POOLS['in-hindi'] || [];
    const seededPool = nativePool.length > 0
      ? (effectiveLang && effectiveLang !== 'All / Regional'
          ? nativePool
          : (targetPoolId === 'in-hindi' || targetPoolId === 'global' ? nativePool : [...nativePool.slice(0, 60), ...hindiPool.slice(0, 20)]))
      : [];
    const rotationKey = `loopra_regional_rotation_${targetPoolId}_${effectiveLang || 'all'}`;

    // 1. Use seeded 100-song pool locally (ZERO external API calls)
    if (Array.isArray(seededPool) && seededPool.length > 0) {
      let picked = null;
      if (!forceReshuffle) {
        try {
          const saved = JSON.parse(localStorage.getItem(rotationKey) || 'null');
          if (saved && Array.isArray(saved.tracks) && saved.tracks.length === 15) {
            picked = saved.tracks;
          }
        } catch (_) {}
      }

      if (!picked) {
        // Fisher-Yates shuffle over the 100-song pool and pick 15 unique tracks
        const copy = [...seededPool];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        const seen = new Set();
        picked = [];
        for (const t of copy) {
          if (!seen.has(t.id)) {
            seen.add(t.id);
            picked.push(t);
            if (picked.length >= 15) break;
          }
        }
        try {
          localStorage.setItem(rotationKey, JSON.stringify({ ts: Date.now(), tracks: picked }));
        } catch (_) {}
      }

      setTracks(picked);
      return;
    }

    // 2. Fallback to live fetch only if region has no seeded pool
    const cacheKey = `loopra_regional_cache_${targetPoolId}_${effectiveLang || 'all'}`;
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (parsed && Array.isArray(parsed.tracks) && parsed.tracks.length > 0 && (Date.now() - parsed.ts < CACHE_TTL_MS)) {
          setTracks(parsed.tracks.slice(0, 15));
          return;
        }
      }
    } catch (_) {}

    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/search?q=${encodeURIComponent(region.query)}&limit=15`));
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
        const cleaned = items.slice(0, 15).map(item => ({
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
      setTracks(fallbackTracks.slice(0, 15));
    }
  }, [fallbackTracks]);

  useEffect(() => {
    fetchRegionalTracks(activeRegion);
  }, [activeRegion, fetchRegionalTracks]);

  // Sync immediately when silent location detection detects a fresh region on app open or resume
  useEffect(() => {
    const handleRegionDetected = (e) => {
      const { regionId, label, source } = e.detail || {};
      if (regionId && REGIONS.some(r => r.id === regionId)) {
        setSelectedRegionId(regionId);
        if (source) setRegionSource(source);
        if (label) setDetectedLabel(label);
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === 'loopra_user_region_v2' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.regionId && REGIONS.some(r => r.id === parsed.regionId)) {
            setSelectedRegionId(parsed.regionId);
            if (parsed.source) setRegionSource(parsed.source);
            if (parsed.label) setDetectedLabel(parsed.label);
          }
        } catch (_) {}
      }
    };

    window.addEventListener('loopra:region:detected', handleRegionDetected);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('loopra:region:detected', handleRegionDetected);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const fallbackToIpLocation = useCallback(async (showDeniedHint = false) => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const ipData = await res.json();
        const city = ipData.city || '';
        const state = ipData.region || '';
        const country = ipData.country_name || '';
        const mapped = mapLocationToRegionId(state, country);
        const label = city ? `${city}, ${state || country}` : state || country;
        setSelectedRegionId(mapped);
        setRegionSource('ip');
        setDetectedLabel(label);
        saveRegionMeta({ regionId: mapped, source: 'ip', label });
      }
    } catch (_) {}
    if (showDeniedHint) {
      setLocationNotice('Location permission is blocked. Click the Tune / Lock icon in your browser address bar to allow Location, or pick a region manually.');
    }
  }, []);

  const handleDetectLocation = useCallback(async () => {
    setLocationNotice('');
    setIsDetecting(true);
    try {
      const sessionId = localStorage.getItem('afterhours_session_id') || null;
      const res = await locationAnalyticsService.requestAndSaveLocation({ sessionId });
      if (res?.success && res?.regionId) {
        setSelectedRegionId(res.regionId);
        setRegionSource('gps');
        if (res.location?.city || res.location?.state) {
          const l = res.location.city ? `${res.location.city}, ${res.location.state || res.location.country}` : (res.location.state || res.location.country);
          setDetectedLabel(l);
        }
      } else if (res?.reason === 'denied') {
        await fallbackToIpLocation(true);
      } else {
        await fallbackToIpLocation(false);
      }
    } catch (_) {
      await fallbackToIpLocation(false);
    } finally {
      setIsDetecting(false);
    }
  }, [fallbackToIpLocation]);

  const handleRegionChange = (e) => {
    const nextId = e.target.value;
    setSelectedRegionId(nextId);
    setRegionSource('manual');
    setDetectedLabel('');
    setLocationNotice('');
    saveRegionMeta({ regionId: nextId, source: 'manual', label: '' });
    setDraftLanguage(selectedLanguage);
    setIsLanguageModalOpen(true);
  };

  const handleLanguageDone = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    const chosenLang = draftLanguage;
    setSelectedLanguage(chosenLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, chosenLang);
    } catch (_) {}
    setIsLanguageModalOpen(false);
    fetchRegionalTracks(activeRegion, true, chosenLang);
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
              <span className="text-[9px] uppercase opacity-75">({regionSource})</span>
            </span>
          </div>
          <p className="text-neutral-400 mt-0.5 text-xs md:text-sm font-medium">
            Sounds curated for {activeRegion.label}
          </p>
          {locationNotice && (
            <p className="text-[11px] text-amber-300/90 mt-1">{locationNotice}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={isDetecting}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 text-xs text-neutral-200 cursor-pointer transition disabled:opacity-50"
            title="Detect my region"
          >
            <MapPin className={`w-3.5 h-3.5 text-amber-400 ${isDetecting ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{isDetecting ? 'Detecting...' : 'Detect'}</span>
          </button>
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
            onClick={() => fetchRegionalTracks(activeRegion, true)}
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

      {isLanguageModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={() => setIsLanguageModalOpen(false)}
        >
          <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-2xl animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white mb-1">Select Language</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Choose a language for {activeRegion.label}
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto mb-4">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setDraftLanguage(lang)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left transition cursor-pointer ${
                    draftLanguage === lang
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsLanguageModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLanguageDone}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-950 bg-amber-400 hover:bg-amber-300 transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
