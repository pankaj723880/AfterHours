import mongoose from 'mongoose';
import UserAssistantRecommendation from '../models/UserAssistantRecommendation.js';

// Recognized version descriptors that indicate genuinely different audio recordings
export const VERSION_KEYWORDS = [
  'acoustic',
  'unplugged',
  'live',
  'remix',
  'club mix',
  'dj mix',
  'cover',
  'reprise',
  'slowed',
  'reverb',
  'instrumental',
  'orchestral',
  'lofi',
  'lo-fi',
  'mashup',
  'female version',
  'male version',
  'duet'
];

// Common record label / channel names that are NOT the singer/artist
export const KNOWN_RECORD_LABELS = new Set([
  'tseries',
  'tseriesapnapunjab',
  'tseriesregional',
  'zeemusiccompany',
  'zeemusic',
  'sonymusicindia',
  'sonymusic',
  'sonymusicindiavevo',
  'yrf',
  'venus',
  'tipsofficial',
  'tips',
  'speedrecords',
  'erosnow',
  'saregamamusic',
  'saregama',
  'universalmusicindia',
  'universalmusic',
  'dmdesirnr',
  'adityamusic',
  'geetmp3',
  'desimusicfactory',
  'whitehillmusic',
  'jjustmusic'
]);

/**
 * Extracts a version descriptor if the track is a distinct recording
 * (e.g., Acoustic, Live, Remix, Reprise, Unplugged).
 * Returns empty string for the original release.
 */
export function getVersionDescriptor(str = '') {
  const lower = (str || '').toLowerCase();
  for (const v of VERSION_KEYWORDS) {
    if (lower.includes(v)) {
      return v.replace(/[^a-z0-9]/g, '');
    }
  }
  return '';
}

/**
 * Normalizes song title for canonical identification:
 * 1. Preserves version indicator separately
 * 2. Strips bracketed/parenthetical video noise e.g. [Official Video], (Full Song)
 * 3. Handles Bollywood delimiters (| or -) separating song title from movie credits/star cast
 * 4. Cleans out generic noise words while preserving distinctive song title
 */
export function cleanSongTitle(str = '') {
  if (!str) return '';
  let title = String(str).toLowerCase();

  // Strip anything after pipe | or // or • which YouTube channels use for actor/video credits
  // e.g. "Kesariya - Brahmāstra | Ranbir | Alia | Pritam | Arijit Singh" -> "Kesariya - Brahmāstra"
  if (title.includes('|')) {
    title = title.split('|')[0].trim();
  } else if (title.includes('//')) {
    title = title.split('//')[0].trim();
  } else if (title.includes('•')) {
    title = title.split('•')[0].trim();
  }

  // Remove parenthetical noise like (From "Movie"), (Official Video), [4K], etc.
  // But preserve version descriptors if inside
  title = title.replace(/\((?!acoustic|live|remix|unplugged|cover|reprise|instrumental|lofi).*?\)/gi, '');
  title = title.replace(/\[(?!acoustic|live|remix|unplugged|cover|reprise|instrumental|lofi).*?\]/gi, '');

  // Strip common YouTube boilerplate words
  title = title.replace(/official video|official music video|music video|lyric video|lyrical video|full song|audio song|video song|hd|4k|4k uhd|1080p|original soundtrack|soundtrack|ost|lyrics|lyric|visualizer|full audio|jukebox|audio|video/gi, '');

  // If there's still a hyphen e.g. "Song - Movie" or "Movie - Song"
  // If the first part has length >= 3 and is not purely movie noise, evaluate
  if (title.includes(' - ')) {
    const parts = title.split(' - ').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      // Pick the part that does not look like a generic phrase
      title = parts[0];
    }
  }

  return title.replace(/[^a-z0-9]/g, '').trim();
}

/**
 * Extracts normalized tokens of artists from artist string, channel name, or title.
 */
export function extractArtistTokens(track = {}) {
  const raw = `${track.artist || ''} ${track.channel || ''}`.toLowerCase();
  const tokens = [];

  const parts = raw.split(/[,&/|+]|ft\.?|feat\.?|featuring|with/i);
  for (const part of parts) {
    const cleaned = part.replace(/vevo|official|channel|topic|records/gi, '').replace(/[^a-z0-9]/g, '').trim();
    if (cleaned.length >= 2 && !KNOWN_RECORD_LABELS.has(cleaned)) {
      tokens.push(cleaned);
    }
  }

  return tokens;
}

/**
 * Cleans primary artist name, avoiding mistaken record label names.
 */
export function cleanArtistName(str = '', title = '') {
  let raw = (str || '').toLowerCase();

  // If artist is missing or is a known label, attempt to extract singer from title
  const rawCleaned = raw.replace(/[^a-z0-9]/g, '');
  if (!raw || KNOWN_RECORD_LABELS.has(rawCleaned) || raw.includes('unknown') || raw.includes('various')) {
    const titleLower = (title || '').toLowerCase();
    // Check for common singers in Bollywood title if artist is a label
    const commonSingers = [
      'arijit singh', 'shreya ghoshal', 'pritam', 'ar rahman', 'a r rahman',
      'diljit dosanjh', 'kumar sanu', 'alka yagnik', 'udit narayan',
      'sonu nigam', 'kishore kumar', 'lata mangeshkar', 'badshah',
      'neha kakkar', 'jubin nautiyal', 'sachet tandon', 'jasleen royal',
      'ankit tiwari', 'mohit chauhan', 'anuv jain', 'prateek kuhad', 'kk'
    ];
    for (const singer of commonSingers) {
      if (titleLower.includes(singer)) {
        return singer.replace(/[^a-z0-9]/g, '');
      }
    }
  }

  return raw
    .split(/[,&|/+]|ft\.?|feat\.?|featuring/i)[0]
    .replace(/vevo|official|channel|topic|records/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Returns a stable, deterministic canonical song key.
 * Format: `${cleanTitle}__${cleanPrimaryArtist}__${versionDescriptor}`
 */
export function getCanonicalSongKey(track) {
  if (!track) return '';
  const titleStr = track.title || '';
  const artistStr = track.artist || track.channel || '';

  const version = getVersionDescriptor(`${titleStr} ${artistStr}`);
  const title = cleanSongTitle(titleStr);
  const artist = cleanArtistName(artistStr, titleStr);

  return `${title}__${artist}__${version}`;
}

/**
 * Rigorous identity check between two tracks.
 * Returns true if both represent the exact same recording.
 * Preserves genuine remixes, acoustic versions, and live performances.
 */
export function areTracksSame(trackA, trackB) {
  if (!trackA || !trackB) return false;

  // 1. Exact ID match (O(1))
  const idA = trackA.id || trackA.videoId;
  const idB = trackB.id || trackB.videoId;
  if (idA && idB && idA === idB) return true;

  // 2. Version check: Genuinely different recordings MUST NOT be merged
  const titleA = trackA.title || '';
  const titleB = trackB.title || '';
  const verA = getVersionDescriptor(`${titleA} ${trackA.artist || ''}`);
  const verB = getVersionDescriptor(`${titleB} ${trackB.artist || ''}`);
  if (verA !== verB) {
    return false; // One is acoustic/remix/live and one is original/other
  }

  // 3. Canonical key match
  const keyA = getCanonicalSongKey(trackA);
  const keyB = getCanonicalSongKey(trackB);
  if (keyA && keyB && keyA === keyB) return true;

  // 4. Fuzzy title & artist match
  const cleanA = cleanSongTitle(titleA);
  const cleanB = cleanSongTitle(titleB);

  if (cleanA && cleanB && cleanA === cleanB) {
    // Check artist overlap
    const tokensA = extractArtistTokens(trackA);
    const tokensB = extractArtistTokens(trackB);

    if (tokensA.length === 0 || tokensB.length === 0) {
      // One has no artist tokens (e.g. label only). If title is distinctive (>= 5 chars), treat as same
      return cleanA.length >= 5;
    }

    const hasOverlap = tokensA.some(t => tokensB.includes(t)) ||
      tokensA.some(t => titleB.toLowerCase().includes(t)) ||
      tokensB.some(t => titleA.toLowerCase().includes(t));

    if (hasOverlap) return true;

    // If titles are distinctive and long (>= 7 chars, e.g. "kesariya", "channamereya", "badtameezdil"), match
    if (cleanA.length >= 7) return true;
  }

  return false;
}

/**
 * Universal TrackDeduplicator class for cross-section deduplication.
 * Guarantees zero duplicate songs across any number of sections or candidate lists.
 */
export class TrackDeduplicator {
  constructor(initialTracks = []) {
    this.seenIds = new Set();
    this.seenKeys = new Set();
    this.seenTracks = [];

    if (Array.isArray(initialTracks)) {
      this.addAll(initialTracks);
    }
  }

  isDuplicate(track) {
    if (!track) return true;

    const id = track.id || track.videoId;
    if (id && this.seenIds.has(id)) return true;

    const key = getCanonicalSongKey(track);
    if (key && this.seenKeys.has(key)) return true;

    // Check fuzzy match against previously admitted tracks
    for (const seen of this.seenTracks) {
      if (areTracksSame(track, seen)) {
        return true;
      }
    }

    return false;
  }

  add(track) {
    if (!track) return false;

    const id = track.id || track.videoId;
    if (id) this.seenIds.add(id);

    const key = getCanonicalSongKey(track);
    if (key) this.seenKeys.add(key);

    this.seenTracks.push(track);
    return true;
  }

  addAll(tracks = []) {
    if (!Array.isArray(tracks)) return;
    for (const t of tracks) {
      this.add(t);
    }
  }

  filterUnique(tracks = []) {
    if (!Array.isArray(tracks)) return [];
    const unique = [];
    for (const track of tracks) {
      if (!this.isDuplicate(track)) {
        this.add(track);
        unique.push(track);
      }
    }
    return unique;
  }

  size() {
    return this.seenTracks.length;
  }

  getAllKeys() {
    return Array.from(this.seenKeys);
  }

  getAllIds() {
    return Array.from(this.seenIds);
  }
}

// In-memory per-user / per-session history
const inMemoryHistory = new Map();
const MAX_IN_MEMORY_PER_USER = 150;

export const recommendationHistoryService = {
  cleanSongTitle,
  cleanArtistName,
  getCanonicalSongKey,
  getVersionDescriptor,
  areTracksSame,
  TrackDeduplicator,

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
