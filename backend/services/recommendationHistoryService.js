import mongoose from 'mongoose';
import UserAssistantRecommendation from '../models/UserAssistantRecommendation.js';

export function cleanSongTitle(str = '') {
  return (str || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/official video|official music video|music video|lyric video|full song|audio song|video song|hd|4k|remastered|version|original soundtrack|soundtrack|ost|lyrics|lyric/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function cleanArtistName(str = '') {
  return (str || '')
    .toLowerCase()
    .split(/[,&|/]|ft\.?|feat\.?/i)[0]
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function getCanonicalSongKey(track) {
  if (!track) return '';
  const title = cleanSongTitle(track.title);
  const artist = cleanArtistName(track.artist || track.channel);
  return `${title}__${artist}`;
}

// In-memory per-user / per-session history
const inMemoryHistory = new Map();
const MAX_IN_MEMORY_PER_USER = 150;

export const recommendationHistoryService = {
  cleanSongTitle,
  cleanArtistName,
  getCanonicalSongKey,

  /**
   * Records recommended tracks for a given user/session.
   */
  async recordRecommendations(userKey, tracks = [], queryContext = '') {
    if (!userKey || !Array.isArray(tracks) || tracks.length === 0) return;
    const key = String(userKey);

    const now = new Date();
    const existing = inMemoryHistory.get(key) || [];

    const newEntries = [];
    for (const track of tracks) {
      const trackId = track.id || track.videoId;
      if (!trackId) continue;

      const canonicalKey = getCanonicalSongKey(track);
      const cleanTitle = cleanSongTitle(track.title);

      const entry = {
        userId: key,
        trackId,
        videoId: track.videoId || trackId,
        title: track.title || 'Unknown Title',
        artist: track.artist || track.channel || 'Unknown Artist',
        canonicalKey,
        cleanTitle,
        queryContext: queryContext || '',
        recommendedAt: now
      };

      newEntries.push(entry);
    }

    // Update in-memory cache
    const updated = [...newEntries, ...existing].slice(0, MAX_IN_MEMORY_PER_USER);
    inMemoryHistory.set(key, updated);

    // Persist to MongoDB if connected
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1 && newEntries.length > 0) {
        await UserAssistantRecommendation.insertMany(newEntries, { ordered: false });
      }
    } catch (err) {
      // In-memory cache ensures continuity
    }
  },

  /**
   * Retrieves all recent recommendations for a user/session and builds exclusion sets.
   * Also ingests any tracks from the conversational `history` parameter.
   */
  async getExclusionSets(userKey, conversationHistory = []) {
    const excludedIds = new Set();
    const excludedKeys = new Set();
    const excludedTitles = new Set();
    const excludedList = [];

    const key = userKey ? String(userKey) : null;

    // 1. From in-memory store
    if (key && inMemoryHistory.has(key)) {
      const items = inMemoryHistory.get(key) || [];
      for (const item of items) {
        if (item.trackId) excludedIds.add(item.trackId);
        if (item.videoId) excludedIds.add(item.videoId);
        if (item.canonicalKey) excludedKeys.add(item.canonicalKey);
        if (item.cleanTitle && item.cleanTitle.length >= 4) excludedTitles.add(item.cleanTitle);
        excludedList.push(item);
      }
    }

    // 2. From MongoDB if connected
    if (key) {
      try {
        if (mongoose.connection && mongoose.connection.readyState === 1) {
          const dbItems = await UserAssistantRecommendation.find({ userId: key })
            .sort({ recommendedAt: -1 })
            .limit(100)
            .lean()
            .maxTimeMS(1500);

          for (const item of dbItems) {
            if (item.trackId) excludedIds.add(item.trackId);
            if (item.videoId) excludedIds.add(item.videoId);
            if (item.canonicalKey) excludedKeys.add(item.canonicalKey);
            const clTitle = cleanSongTitle(item.title);
            if (clTitle && clTitle.length >= 4) excludedTitles.add(clTitle);
            excludedList.push(item);
          }
        }
      } catch (err) {
        // Fallback to in-memory history
      }
    }

    // 3. Extract tracks from the current conversation's `history` parameter
    if (Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        if (Array.isArray(msg.tracks)) {
          for (const t of msg.tracks) {
            const id = t.id || t.videoId;
            if (id) excludedIds.add(id);
            const canKey = getCanonicalSongKey(t);
            if (canKey) excludedKeys.add(canKey);
            const clTitle = cleanSongTitle(t.title);
            if (clTitle && clTitle.length >= 4) excludedTitles.add(clTitle);
            excludedList.push({
              trackId: id,
              videoId: t.videoId || id,
              title: t.title,
              artist: t.artist,
              canonicalKey: canKey,
              cleanTitle: clTitle
            });
          }
        }
      }
    }

    return {
      excludedIds,
      excludedKeys,
      excludedTitles,
      excludedList
    };
  },

  /**
   * Checks if user message explicitly requested a specific song that may be in the exclusion list.
   * e.g., "play Kesariya", "recommend Tum Hi Ho again", "repeat Kesariya"
   */
  checkExplicitRequest(message = '', excludedList = []) {
    if (!message || typeof message !== 'string') return null;
    const lower = message.toLowerCase().trim();

    const hasExplicitRepeatIntent = /\b(again|repeat|once more|replay|one more time)\b/i.test(lower);
    const hasPlayKeyword = /\b(play|start|listen to|put on|stream)\b/i.test(lower);

    if (hasExplicitRepeatIntent || hasPlayKeyword) {
      for (const item of excludedList) {
        if (!item.title) continue;
        const clTitle = cleanSongTitle(item.title);
        if (clTitle.length >= 3 && lower.includes(clTitle)) {
          return {
            isExplicit: true,
            track: item,
            ...item
          };
        }
      }
    }
    return null;
  },

  /**
   * Clears in-memory history for testing or resetting
   */
  clearMemoryHistory(userKey = null) {
    if (userKey) inMemoryHistory.delete(String(userKey));
    else inMemoryHistory.clear();
  }
};
