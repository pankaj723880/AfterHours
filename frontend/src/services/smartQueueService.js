// Centralized Smart Queue & Continuous Listening Engine for Loopra
// Spotify-style 3-tier queue management:
// Tier 1: Explicit "Play Next"
// Tier 2: Manually added queue tracks
// Tier 3: Context-aware Smart Queue (5 similar + 5 discovery)
import { getApiUrl } from '../utils/apiUrl';
import { getCleanThumbnail, isThumbnailUrlFormatValid } from '../utils/thumbnailValidator';
import { isValidMusicTrack } from './songFilter';

const smartQueueCache = new Map();
const SMART_Q_LS_KEY = 'loopra_smart_q_cache_v1';
const SMART_Q_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SMART_Q_MAX_ENTRIES = 80;
const inFlightPrefetches = new Set();

const readLsCacheMap = () => {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(SMART_Q_LS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (_) {
    return {};
  }
};

const writeLsCacheMap = (mapObj) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const entries = Object.entries(mapObj);
    if (entries.length > SMART_Q_MAX_ENTRIES) {
      entries.sort((a, b) => (b[1]?.timestamp || 0) - (a[1]?.timestamp || 0));
      mapObj = Object.fromEntries(entries.slice(0, SMART_Q_MAX_ENTRIES));
    }
    localStorage.setItem(SMART_Q_LS_KEY, JSON.stringify(mapObj));
  } catch (_) {}
};

export const smartQueueService = {
  /**
   * Stable normalized cache key for a track (ID or normalized title+artist)
   */
  getTrackCacheKey(track) {
    if (!track) return '';
    const id = this.getTrackId(track).toLowerCase();
    if (id) return `id:${id}`;
    const title = String(track.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const artist = String(track.artist || track.channel || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return title ? `ta:${title}_${artist}` : '';
  },

  /**
   * Read valid (<24h TTL) related tracks from localStorage cache map
   */
  getCachedRelated(track) {
    const key = this.getTrackCacheKey(track);
    if (!key) return null;
    const map = readLsCacheMap();
    const entry = map[key];
    if (!entry || !Array.isArray(entry.items) || entry.items.length === 0) return null;
    if (Date.now() - (entry.timestamp || 0) > SMART_Q_TTL_MS) {
      delete map[key];
      writeLsCacheMap(map);
      return null;
    }
    return entry.items;
  },

  /**
   * Persist ~10 related tracks for a track into localStorage cache map
   */
  setCachedRelated(track, items) {
    const key = this.getTrackCacheKey(track);
    if (!key || !Array.isArray(items) || items.length === 0) return;
    const map = readLsCacheMap();
    map[key] = {
      timestamp: Date.now(),
      items: items.slice(0, 10)
    };
    writeLsCacheMap(map);
  },

  /**
   * Shuffle & re-arrange list cleanly so top tracks vary and never repeat back-to-back
   */
  shuffleAndArrange(items, currentSong = null) {
    const list = [...(items || [])];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    if (currentSong) {
      return list.filter(t => !this.isSameTrack(t, currentSong));
    }
    return list;
  },

  /**
   * Background pre-fetch ~10 related tracks for each track in the Smart Q list
   */
  async prefetchRelatedForList(tracks = []) {
    const targets = (tracks || []).filter(t => t && !this.getCachedRelated(t)).slice(0, 10);
    if (targets.length === 0) return;

    const concurrency = 2;
    let idx = 0;
    const worker = async () => {
      while (idx < targets.length) {
        const t = targets[idx++];
        const key = this.getTrackCacheKey(t);
        if (!key || inFlightPrefetches.has(key) || this.getCachedRelated(t)) continue;
        inFlightPrefetches.add(key);
        try {
          await this.fetchRecommendations(t, { forceRefresh: false });
        } catch (_) {
          // Non-blocking background prefetch
        } finally {
          inFlightPrefetches.delete(key);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  },
  /**
   * Retrieves or derives a stable track ID
   */
  getTrackId(track) {
    if (!track) return '';
    return String(track.id || track.videoId || '').trim();
  },

  /**
   * Checks if two track representations refer to the exact same song
   */
  isSameTrack(trackA, trackB) {
    if (!trackA || !trackB) return false;
    const idA = this.getTrackId(trackA).toLowerCase();
    const idB = this.getTrackId(trackB).toLowerCase();
    if (idA && idB && idA === idB) return true;

    const titleA = String(trackA.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const titleB = String(trackB.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (titleA && titleB && titleA.length >= 6 && titleA === titleB) {
      return true;
    }
    return false;
  },

  /**
   * Fetches exactly 10 recommendation tracks (5 related + 5 discovery)
   * for continuous listening from /api/recommendations/similar
   */
  async fetchRecommendations(track, { forceRefresh = false, signal = null } = {}) {
    const trackId = this.getTrackId(track);
    const title = track?.title || '';
    const artist = track?.artist || track?.channel || '';
    const genre = track?.genre || '';
    const mood = track?.mood || '';
    const category = track?.category || '';
    const songType = track?.songType || track?.type || '';
    const movie = track?.movie || track?.album || '';

    if (!trackId && !title) {
      return { related: [], discover: [], items: [] };
    }

    // 1. Zero-extra-call instant lookup from localStorage cache map
    if (!forceRefresh) {
      const lsCached = this.getCachedRelated(track);
      if (lsCached && lsCached.length > 0) {
        const arranged = this.shuffleAndArrange(lsCached, track);
        return {
          related: arranged.slice(0, 5),
          discover: arranged.slice(5, 10),
          items: arranged,
          fromCache: true
        };
      }
    }

    const cacheKey = `${trackId}_${title}_${artist}_${genre}_${mood}_${movie}`;
    if (!forceRefresh && smartQueueCache.has(cacheKey)) {
      const memCached = smartQueueCache.get(cacheKey);
      const arranged = this.shuffleAndArrange(memCached.items || [], track);
      return {
        related: arranged.slice(0, 5),
        discover: arranged.slice(5, 10),
        items: arranged,
        fromCache: true
      };
    }

    const params = new URLSearchParams({
      trackId,
      title,
      artist,
      genre
    });
    if (mood) params.set('mood', mood);
    if (category) params.set('category', category);
    if (songType) params.set('songType', songType);
    if (movie) params.set('movie', movie);
    if (forceRefresh) params.set('refresh', 'true');

    const endpointUrl = getApiUrl(`/api/recommendations/similar?${params.toString()}`);
    const res = await fetch(endpointUrl, { signal });
    if (!res.ok) {
      throw new Error(`SmartQueue recommendation fetch failed with status ${res.status}`);
    }

    const data = await res.json();
    if (!data || (!Array.isArray(data.related) && !Array.isArray(data.items))) {
      return { related: [], discover: [], items: [] };
    }

    const currentId = trackId.toLowerCase();
    const currentTitleClean = String(title).toLowerCase().replace(/[^a-z0-9]/g, '');
    const seenIds = new Set();
    if (currentId) seenIds.add(currentId);

    const sanitize = (rawList, groupType) => {
      const result = [];
      for (const item of (rawList || [])) {
        const id = this.getTrackId(item);
        if (!id || seenIds.has(id.toLowerCase())) continue;
        if (!isValidMusicTrack(item)) continue;

        const itemTitleClean = String(item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (currentTitleClean.length >= 4 && itemTitleClean === currentTitleClean) continue;

        const thumb = getCleanThumbnail(item, id);
        if (!isThumbnailUrlFormatValid(thumb)) continue;

        seenIds.add(id.toLowerCase());
        result.push({
          ...item,
          id,
          videoId: id,
          thumbnail: thumb,
          image: thumb,
          _recommendationType: groupType // 'similar' or 'discover'
        });
      }
      return result;
    };

    const rawRelated = data.related || (data.items || []).slice(0, 5);
    let validRelated = sanitize(rawRelated, 'similar').slice(0, 5);

    const rawDiscover = data.discover || (data.items || []).slice(5);
    let validDiscover = sanitize(rawDiscover, 'discover').slice(0, 5);

    // If either group has fewer than 5 items, backfill from unused data.items
    if (validRelated.length + validDiscover.length < 10 && Array.isArray(data.items)) {
      const extraCandidates = sanitize(data.items, 'similar');
      for (const candidate of extraCandidates) {
        if (validRelated.length < 5) {
          validRelated.push({ ...candidate, _recommendationType: 'similar' });
        } else if (validDiscover.length < 5) {
          validDiscover.push({ ...candidate, _recommendationType: 'discover' });
        }
        if (validRelated.length + validDiscover.length >= 10) break;
      }
    }

    const rawItems = [...validRelated, ...validDiscover];
    this.setCachedRelated(track, rawItems);

    const arranged = this.shuffleAndArrange(rawItems, track);
    const combined = {
      related: arranged.slice(0, 5),
      discover: arranged.slice(5, 10),
      items: arranged
    };

    smartQueueCache.set(cacheKey, combined);
    return combined;
  },

  /**
   * Filter and deduplicate candidates against existing queue and recent playback history
   */
  deduplicateAgainstContext(candidates, { currentSong, manualQueue = [], history = [] }) {
    const existingIds = new Set();
    const curId = this.getTrackId(currentSong).toLowerCase();
    if (curId) existingIds.add(curId);

    (manualQueue || []).forEach(t => {
      const id = this.getTrackId(t).toLowerCase();
      if (id) existingIds.add(id);
    });

    // Recent 10 history items to prevent immediate repetition
    (history || []).slice(0, 10).forEach(t => {
      const id = this.getTrackId(t).toLowerCase();
      if (id) existingIds.add(id);
    });

    return (candidates || []).filter(item => {
      const id = this.getTrackId(item).toLowerCase();
      if (!id || existingIds.has(id)) return false;
      return true;
    });
  }
};

export default smartQueueService;
