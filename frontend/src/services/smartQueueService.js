// Centralized Smart Queue & Continuous Listening Engine for Loopra
// Spotify-style 3-tier queue management:
// Tier 1: Explicit "Play Next"
// Tier 2: Manually added queue tracks
// Tier 3: Context-aware Smart Queue (5 similar + 5 discovery)
import { getApiUrl } from '../utils/apiUrl';
import { getCleanThumbnail, isThumbnailUrlFormatValid } from '../utils/thumbnailValidator';
import { isValidMusicTrack } from './songFilter';

const smartQueueCache = new Map();

export const smartQueueService = {
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

    if (!trackId && !title) {
      return { related: [], discover: [], items: [] };
    }

    const cacheKey = `${trackId}_${title}_${artist}`;
    if (!forceRefresh && smartQueueCache.has(cacheKey)) {
      return smartQueueCache.get(cacheKey);
    }

    const params = new URLSearchParams({
      trackId,
      title,
      artist,
      genre
    });
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

    const combined = {
      related: validRelated,
      discover: validDiscover,
      items: [...validRelated, ...validDiscover]
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
