import mongoose from 'mongoose';
import CuratedCollection from '../models/CuratedCollection.js';
import ytSearch from 'yt-search';
import { filterSingleSongs, isSingleSong } from './songFilter.js';

// Clean decode for HTML entities commonly present in YouTube responses
const decodeHtml = (str = '') => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
};

// Foundational verified catalog tracks for immediate instant retrieval
const CORE_CATALOG_TRACKS = [
  { id: "RLzC55ai0eo", videoId: "RLzC55ai0eo", title: "Heeriye (Official Video)", artist: "Jasleen Royal ft Arijit Singh", channel: "Jasleen Royal", thumbnail: "https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg", genre: "Romantic", mood: "Love" },
  { id: "WWIfHemqSEA", videoId: "WWIfHemqSEA", title: "Tujhko - Love Song 2026", artist: "Arijit Singh", channel: "Arijit Singh", thumbnail: "https://i.ytimg.com/vi/WWIfHemqSEA/hqdefault.jpg", genre: "Romantic", mood: "Emotional" },
  { id: "BddP6PYo2gs", videoId: "BddP6PYo2gs", title: "Kesariya (Official Video)", artist: "Arijit Singh, Pritam", channel: "Sony Music India", thumbnail: "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg", genre: "Romantic", mood: "Romantic" },
  { id: "cIGd8gm_pYE", videoId: "cIGd8gm_pYE", title: "Lover (Official Music Video)", artist: "Diljit Dosanjh", channel: "Diljit Dosanjh", thumbnail: "https://i.ytimg.com/vi/cIGd8gm_pYE/hqdefault.jpg", genre: "Punjabi Pop", mood: "Party" },
  { id: "2mDCVzruYzQ", videoId: "2mDCVzruYzQ", title: "Tum Hi Ho (Official Video)", artist: "Arijit Singh | Mithoon", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/2mDCVzruYzQ/hqdefault.jpg", genre: "Romantic", mood: "Melancholic" },
  { id: "Yqj1_V90KJo", videoId: "Yqj1_V90KJo", title: "Chura Ke Dil Mera", artist: "Kumar Sanu, Alka Yagnik", channel: "Venus", thumbnail: "https://i.ytimg.com/vi/Yqj1_V90KJo/hqdefault.jpg", genre: "90s Bollywood", mood: "Nostalgic" },
  { id: "KeyfUuXPOcY", videoId: "KeyfUuXPOcY", title: "Dheere Dheere Se Meri Zindagi", artist: "Kumar Sanu, Anuradha Paudwal", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/KeyfUuXPOcY/hqdefault.jpg", genre: "90s Bollywood", mood: "Romantic" },
  { id: "cNV5hLSa9H8", videoId: "cNV5hLSa9H8", title: "Tujhe Dekha Toh Yeh Jaana Sanam", artist: "Kumar Sanu, Lata Mangeshkar", channel: "YRF", thumbnail: "https://i.ytimg.com/vi/cNV5hLSa9H8/hqdefault.jpg", genre: "90s Bollywood", mood: "Romantic" },
  { id: "r0c1f6XxRQg", videoId: "r0c1f6XxRQg", title: "Evergreen Hits of KK Jukebox", artist: "KK, Pritam", channel: "Sony Music", thumbnail: "https://i.ytimg.com/vi/r0c1f6XxRQg/hqdefault.jpg", genre: "Pop Rock", mood: "Soulful" },
  { id: "ARtRGkaG_OA", videoId: "ARtRGkaG_OA", title: "Rockstar Audio Jukebox", artist: "A.R. Rahman, Mohit Chauhan", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/ARtRGkaG_OA/hqdefault.jpg", genre: "Sufi Rock", mood: "Intense" },
  { id: "ZdyaixHYviA", videoId: "ZdyaixHYviA", title: "Yeh Jawaani Hai Deewani - Subhanallah", artist: "Sreerama Chandra, Shilpa Rao", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/ZdyaixHYviA/hqdefault.jpg", genre: "Romantic", mood: "Feel-Good" },
  { id: "SQWDGLnvxF4", videoId: "SQWDGLnvxF4", title: "Sanam Teri Kasam Title Track", artist: "Ankit Tiwari, Palak Muchhal", channel: "Eros Now", thumbnail: "https://i.ytimg.com/vi/SQWDGLnvxF4/hqdefault.jpg", genre: "Heartbreak", mood: "Sad" },
  { id: "BDlNjOc3wiQ", videoId: "BDlNjOc3wiQ", title: "Bekhayali - Kabir Singh", artist: "Sachet Tandon", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/BDlNjOc3wiQ/hqdefault.jpg", genre: "Rock", mood: "Heartbreak" },
  { id: "O5gwxm3NxFU", videoId: "O5gwxm3NxFU", title: "Channa Mereya", artist: "Arijit Singh, Pritam", channel: "Sony Music", thumbnail: "https://i.ytimg.com/vi/O5gwxm3NxFU/hqdefault.jpg", genre: "Romantic", mood: "Emotional" },
  { id: "dvgZkm1xWPE", videoId: "dvgZkm1xWPE", title: "Teri Ore - Singh Is Kinng", artist: "Shreya Ghoshal, Rahat Fateh Ali Khan", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/dvgZkm1xWPE/hqdefault.jpg", genre: "Romantic", mood: "Love" },
  { id: "S6IW8Rj1WqQ", videoId: "S6IW8Rj1WqQ", title: "Aankh Hai Bhari Bhari", artist: "Kumar Sanu", channel: "Tips Official", thumbnail: "https://i.ytimg.com/vi/S6IW8Rj1WqQ/hqdefault.jpg", genre: "Sad Ghazal", mood: "Nostalgic" }
];

export const catalogService = {
  /**
   * Retrieves verified songs from MongoDB CuratedCollections and core catalog.
   */
  async getCuratedTracks() {
    const candidateMap = new Map();

    // 1. Seed with core verified tracks
    for (const track of CORE_CATALOG_TRACKS) {
      candidateMap.set(track.id, {
        id: track.id,
        videoId: track.videoId || track.id,
        title: track.title,
        artist: track.artist,
        channel: track.channel || track.artist,
        thumbnail: track.thumbnail,
        duration: '3:45',
        genre: track.genre || 'Desi Hits',
        mood: track.mood || 'Vibes'
      });
    }

    // 2. Fetch from published MongoDB CuratedCollections if database is connected
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const collections = await CuratedCollection.find({ isPublished: true })
          .select('tracks name category')
          .lean()
          .maxTimeMS(3000);

        for (const col of collections) {
          if (Array.isArray(col.tracks)) {
            for (const t of col.tracks) {
              const trackId = t.videoId || t.id;
              if (trackId && !t.isHidden && !candidateMap.has(trackId)) {
                candidateMap.set(trackId, {
                  id: trackId,
                  videoId: trackId,
                  title: decodeHtml(t.title),
                  artist: decodeHtml(t.artist || 'Unknown Artist'),
                  channel: decodeHtml(t.artist || 'Loopra Collection'),
                  thumbnail: t.thumbnail || `https://i.ytimg.com/vi/${trackId}/hqdefault.jpg`,
                  duration: t.duration || '3:30',
                  genre: col.name || col.category || 'Desi Lounge',
                  mood: 'Curated'
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[CatalogService] Notice fetching CuratedCollections:', err.message);
    }

    return Array.from(candidateMap.values());
  },

  /**
   * Dynamically supplements candidates using search queries tailored to user top preferences.
   * Filters results to ensure single-song playback safety.
   */
  async fetchDynamicCandidates(queries = [], maxPerQuery = 6) {
    if (!Array.isArray(queries) || queries.length === 0) return [];
    const dynamicTracks = [];
    const seenIds = new Set();

    for (const query of queries.slice(0, 3)) {
      if (!query || typeof query !== 'string') continue;
      try {
        const searchResult = await ytSearch({ query: query.trim(), page: 1 });
        const videos = (searchResult?.videos || []).slice(0, 10);
        const filtered = filterSingleSongs(videos);

        for (const v of filtered.slice(0, maxPerQuery)) {
          if (!v.videoId || seenIds.has(v.videoId)) continue;
          seenIds.add(v.videoId);
          dynamicTracks.push({
            id: v.videoId,
            videoId: v.videoId,
            title: decodeHtml(v.title),
            artist: decodeHtml(v.author?.name || 'Various Artists'),
            channel: decodeHtml(v.author?.name || ''),
            thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
            duration: v.timestamp || '3:30',
            genre: query,
            mood: 'Personalized'
          });
        }
      } catch (err) {
        console.warn(`[CatalogService] Query notice for "${query}":`, err.message);
      }
    }

    return dynamicTracks;
  },

  /**
   * Builds an expansive pool of valid candidate songs for AI evaluation.
   */
  async buildCandidatePool(userPreferences = null) {
    const curated = await this.getCuratedTracks();
    const candidateMap = new Map();

    for (const track of curated) {
      candidateMap.set(track.id, track);
    }

    // If user has specific top artists or genres, fetch targeted single-track candidates
    if (userPreferences) {
      const topArtists = (userPreferences.topArtists || []).slice(0, 2).map(a => `${a.name} best single songs`);
      const topGenres = (userPreferences.topGenres || []).slice(0, 1).map(g => `${g.name} hit songs`);
      const queries = [...topArtists, ...topGenres];

      if (queries.length > 0) {
        const dynamic = await this.fetchDynamicCandidates(queries, 5);
        for (const track of dynamic) {
          if (!candidateMap.has(track.id)) {
            candidateMap.set(track.id, track);
          }
        }
      }
    }

    return Array.from(candidateMap.values());
  }
};
