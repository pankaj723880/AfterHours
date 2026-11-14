import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.js';
import { recommendationEngine } from '../services/recommendationEngine.js';
import { listeningEventService } from '../services/listeningEventService.js';
import UserMusicPreference from '../models/UserMusicPreference.js';
import { catalogService } from '../services/catalogService.js';
import { TrackDeduplicator, getCanonicalSongKey, cleanSongTitle } from '../services/recommendationHistoryService.js';
import { getCleanTrackThumbnail, isValidThumbnailUrlFormat, filterTracksWithValidThumbnailsSync } from '../services/thumbnailValidationService.js';

const router = express.Router();

// Helper rate limiter for recommendation refresh
const refreshCooldowns = new Map();

// Helper to parse exclusion parameters from request
function parseExclusions(req) {
  const rawIds = req.query.excludeIds || req.query.exclude || '';
  const rawKeys = req.query.excludeKeys || '';

  const excludedIds = new Set(
    rawIds ? String(rawIds).split(',').map(s => s.trim()).filter(Boolean) : []
  );
  const excludedKeys = new Set(
    rawKeys ? String(rawKeys).split(',').map(s => s.trim()).filter(Boolean) : []
  );

  return { excludedIds, excludedKeys };
}

/**
 * 1. GET /api/recommendations/personalized
 * Retrieves full personalized recommendations (Made For You, Daily Mix, Discover, etc.)
 */
router.get('/personalized', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const forceRefresh = req.query.refresh === 'true';

    const result = await recommendationEngine.getPersonalizedRecommendations(userId, { forceRefresh });
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('[Recommendations Personalized Error]:', err.message);
    res.status(500).json({ error: 'Failed to generate recommendations: ' + err.message });
  }
});

/**
 * 2. GET /api/recommendations/daily-mix
 * Retrieves user's Daily Mix tracks
 */
router.get('/daily-mix', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 10));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const { excludedIds, excludedKeys } = parseExclusions(req);

    const result = await recommendationEngine.getPersonalizedRecommendations(userId);
    let allItems = result.dailyMix || [];

    if (excludedIds.size > 0 || excludedKeys.size > 0) {
      allItems = allItems.filter(t => {
        const id = t.id || t.videoId;
        const key = getCanonicalSongKey(t);
        return (!id || !excludedIds.has(id)) && (!key || !excludedKeys.has(key));
      });
    }

    const items = allItems.slice(offset, offset + limit);

    res.json({
      success: true,
      items,
      total: allItems.length,
      offset,
      limit
    });
  } catch (err) {
    console.error('[Recommendations Daily Mix Error]:', err.message);
    res.status(500).json({ error: 'Failed to load Daily Mix' });
  }
});

/**
 * 3. GET /api/recommendations/discover
 * Retrieves fresh discovery recommendations.
 * If authenticated, returns user's distinct personalized discovery tracks (zero overlap with Daily Mix).
 * Supports pagination (limit & offset) and explicit exclusion parameters.
 */
router.get('/discover', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 12));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const { excludedIds, excludedKeys } = parseExclusions(req);

    // Optional user token check
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'loopra-super-secret-jwt-key');
        userId = decoded.userId || decoded.id || decoded._id;
      } catch (e) {}
    }

    if (userId) {
      const result = await recommendationEngine.getPersonalizedRecommendations(userId);
      let allItems = result.discover || [];

      if (excludedIds.size > 0 || excludedKeys.size > 0) {
        allItems = allItems.filter(t => {
          const id = t.id || t.videoId;
          const key = getCanonicalSongKey(t);
          return (!id || !excludedIds.has(id)) && (!key || !excludedKeys.has(key));
        });
      }

      const items = allItems.slice(offset, offset + limit);
      return res.json({
        success: true,
        items,
        total: allItems.length,
        offset,
        limit
      });
    }

    // Unauthenticated / Guest: Return curated tracks with distinct discovery mood (indie, acoustic, sufi)
    const candidates = await catalogService.getCuratedTracks();
    const discoveryTracks = candidates.filter(t => {
      const g = (t.genre || '').toLowerCase();
      const m = (t.mood || '').toLowerCase();
      return m.includes('underrated') || g.includes('indie') || g.includes('acoustic') || g.includes('sufi');
    });
    const fallbackTracks = candidates.filter(t => !discoveryTracks.some(d => (d.id || d.videoId) === (t.id || t.videoId)));
    let merged = [...discoveryTracks, ...fallbackTracks];

    if (excludedIds.size > 0 || excludedKeys.size > 0) {
      merged = merged.filter(t => {
        const id = t.id || t.videoId;
        const key = getCanonicalSongKey(t);
        return (!id || !excludedIds.has(id)) && (!key || !excludedKeys.has(key));
      });
    }

    const items = merged.slice(offset, offset + limit).map(t => ({ ...t, reason: 'Curated Discovery' }));

    res.json({
      success: true,
      items,
      total: merged.length,
      offset,
      limit
    });
  } catch (err) {
    console.error('[Recommendations Discover Error]:', err.message);
    res.status(500).json({ error: 'Failed to load discovery recommendations' });
  }
});

/**
 * 4. POST /api/recommendations/listening-events (and POST /api/listening-events)
 * Logs playback events (play_start, progress, completed, skip, like, dislike, repeat)
 */
const handleListeningEvent = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const { trackId, title, artist, channel, thumbnail, eventType, duration, listenedDuration, completionPercent, source, playSessionId } = req.body || {};

    if (!trackId || !title) {
      return res.status(400).json({ error: 'trackId and title are required' });
    }

    const result = await listeningEventService.recordEvent(userId, {
      trackId,
      title,
      artist,
      channel,
      thumbnail,
      eventType,
      duration,
      listenedDuration,
      completionPercent,
      source,
      playSessionId
    });

    const io = req.app_io || req.app?.get('io');
    if (io && result.recorded) {
      try {
        io.to(`user_${userId.toString()}`).emit('listening_stats_updated', {
          userId: userId.toString(),
          trackId,
          eventType,
          isValidPlay: Boolean(result.isValidPlay)
        });
      } catch (e) {}
    }

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('[Listening Event Log Error]:', err.message);
    res.status(500).json({ error: 'Failed to record listening event: ' + err.message });
  }
};

router.post('/listening-events', authenticateToken, handleListeningEvent);

/**
 * 5. POST /api/recommendations/refresh
 * Manually requests a fresh recommendation calculation (rate-limited)
 */
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const now = Date.now();
    const lastRefresh = refreshCooldowns.get(userId.toString());

    if (lastRefresh && (now - lastRefresh) < 60 * 1000) {
      // 1 minute user cooldown
      return res.status(429).json({
        error: 'Please wait at least 1 minute before refreshing recommendations again.',
        cooldownRemainingSeconds: Math.ceil((60 * 1000 - (now - lastRefresh)) / 1000)
      });
    }

    refreshCooldowns.set(userId.toString(), now);

    const result = await recommendationEngine.getPersonalizedRecommendations(userId, { forceRefresh: true });
    res.json({
      success: true,
      refreshed: true,
      data: result
    });
  } catch (err) {
    console.error('[Recommendations Refresh Error]:', err.message);
    res.status(500).json({ error: 'Failed to refresh recommendations' });
  }
});

/**
 * 6. PATCH /api/recommendations/preferences
 * Allows users to toggle personalized recommendations on or off
 */
router.patch('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const { recommendationsEnabled } = req.body;

    if (typeof recommendationsEnabled !== 'boolean') {
      return res.status(400).json({ error: 'recommendationsEnabled must be a boolean' });
    }

    const pref = await UserMusicPreference.findOneAndUpdate(
      { userId },
      { $set: { recommendationsEnabled } },
      { upsert: true, returnDocument: 'after' }
    );

    res.json({
      success: true,
      recommendationsEnabled: pref.recommendationsEnabled
    });
  } catch (err) {
    console.error('[Recommendations Preferences Error]:', err.message);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * 7. GET /api/recommendations/diagnostics
 * Returns recommendation system diagnostics (API latency, cache status, Gemini availability)
 */
router.get('/diagnostics', async (req, res) => {
  try {
    const diagnostics = recommendationEngine.getDiagnostics();
    res.json({
      success: true,
      diagnostics
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get diagnostics' });
  }
});

/**
 * Related Artists Map for high-affinity cross-recommendations
 */
const RELATED_ARTISTS_MAP = {
  'arijit singh': ['Pritam', 'Atif Aslam', 'Mohit Chauhan', 'Jubin Nautiyal', 'Vishal Mishra', 'Shreya Ghoshal'],
  'pritam': ['Arijit Singh', 'KK', 'Mohit Chauhan', 'Shaan', 'Atif Aslam'],
  'atif aslam': ['Arijit Singh', 'Mustafa Zahid', 'Ali Zafar', 'Rahat Fateh Ali Khan', 'Mohit Chauhan'],
  'kk': ['Shaan', 'Pritam', 'Lucky Ali', 'Mohit Chauhan', 'Sonu Nigam'],
  'sonu nigam': ['Shaan', 'Udit Narayan', 'Kumar Sanu', 'Alka Yagnik'],
  'diljit dosanjh': ['Karan Aujla', 'AP Dhillon', 'Shubh', 'Ammy Virk', 'Sidhu Moose Wala', 'Gurdas Maan'],
  'karan aujla': ['Diljit Dosanjh', 'AP Dhillon', 'Shubh', 'Sidhu Moose Wala', 'Amrit Maan'],
  'sidhu moose wala': ['Karan Aujla', 'Amrit Maan', 'Diljit Dosanjh', 'Shubh'],
  'ap dhillon': ['Gurinder Gill', 'Shubh', 'Diljit Dosanjh', 'Karan Aujla'],
  'shubh': ['AP Dhillon', 'Karan Aujla', 'Diljit Dosanjh'],
  'taylor swift': ['Ed Sheeran', 'Olivia Rodrigo', 'Sabrina Carpenter', 'Billie Eilish', 'Dua Lipa'],
  'ed sheeran': ['Taylor Swift', 'Shawn Mendes', 'Charlie Puth', 'James Arthur'],
  'ariana grande': ['Dua Lipa', 'Selena Gomez', 'Camila Cabello', 'Billie Eilish'],
  'the weeknd': ['Post Malone', 'Bruno Mars', 'Drake', 'Dua Lipa'],
  'gulshan kumar': ['Anuradha Paudwal', 'Hariharan', 'Lakhbir Singh Lakkha', 'Suresh Wadkar', 'Anup Jalota'],
  'anuradha paudwal': ['Hariharan', 'Suresh Wadkar', 'Gulshan Kumar', 'Lata Mangeshkar'],
  'hariharan': ['Anuradha Paudwal', 'Suresh Wadkar', 'Shankar Mahadevan', 'Anup Jalota'],
  'anup jalota': ['Hariharan', 'Anuradha Paudwal', 'Gulshan Kumar', 'Ravindra Jain']
};

/**
 * 8. GET /api/recommendations/similar
 * Returns genuine, verified playable tracks similar to a given song
 * Uses multi-signal context: artist, title, genre, language, era, and mood
 * Guarantees a minimum of 5-15 diverse, relevant, non-duplicate recommendations
 */
router.get('/similar', async (req, res) => {
  try {
    const trackId = (req.query.trackId || req.query.id || '').trim();
    const title = (req.query.title || '').trim();
    const artist = (req.query.artist || '').trim();
    const genre = (req.query.genre || '').trim();
    const language = (req.query.language || '').trim();

    if (!title && !artist && !trackId) {
      return res.status(400).json({ error: 'At least trackId, title, or artist is required' });
    }

    const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const cleanArtist = artist.replace(/vevo|official|channel|topic|records/gi, '').trim();

    // 1. Language & Context Detection from signals
    const combinedText = `${cleanTitle} ${cleanArtist} ${genre} ${language}`.toLowerCase();
    
    let detectedLang = language.toLowerCase();
    if (!detectedLang) {
      if (/punjabi|sidhu|diljit|ap dhillon|karan aujla|shubh|amrit|bhangra|dhol|jatt/i.test(combinedText)) {
        detectedLang = 'punjabi';
      } else if (/bhajan|aarti|chalisa|krishna|shiva|ram|hanuman|devotional|mantra/i.test(combinedText)) {
        detectedLang = 'devotional';
      } else if (/tamil|anirudh|ar rahman tamil|kollywood|sid sriram/i.test(combinedText)) {
        detectedLang = 'tamil';
      } else if (/telugu|dsp|thaman|tollywood/i.test(combinedText)) {
        detectedLang = 'telugu';
      } else if (/english|pop|taylor|ed sheeran|billie|dualipa|weekend|drake|coldplay/i.test(combinedText)) {
        detectedLang = 'english';
      } else {
        detectedLang = 'hindi';
      }
    }

    // 2. Identify related artists for rich, varied suggestions
    const artistKey = cleanArtist.toLowerCase();
    const relatedArtists = RELATED_ARTISTS_MAP[artistKey] || [];

    // 3. Build diverse query pools: Queries that intentionally DO NOT include the current track title
    // to discover DIFFERENT songs by the same artist and related artists
    const primaryQueries = [];
    const secondaryQueries = [];

    if (detectedLang === 'devotional') {
      if (cleanArtist) primaryQueries.push(`${cleanArtist} popular bhajan devotional songs`);
      relatedArtists.slice(0, 2).forEach(rel => primaryQueries.push(`${rel} hit bhajan aarti songs`));
      primaryQueries.push(`peaceful devotional krishna ram hanuman bhajan`);
      secondaryQueries.push(`morning devotional aarti bhajan audio`);
      secondaryQueries.push(`best hindu spiritual devotional songs`);
    } else if (detectedLang === 'punjabi') {
      if (cleanArtist && cleanArtist.toLowerCase() !== 'unknown') {
        primaryQueries.push(`${cleanArtist} top punjabi hit songs`);
      }
      relatedArtists.slice(0, 2).forEach(rel => primaryQueries.push(`${rel} punjabi hit songs`));
      primaryQueries.push(`latest punjabi hit songs official`);
      secondaryQueries.push(`top punjabi pop songs`);
      secondaryQueries.push(`punjabi romantic hits official`);
    } else if (detectedLang === 'english') {
      if (cleanArtist && cleanArtist.toLowerCase() !== 'unknown') {
        primaryQueries.push(`${cleanArtist} greatest hit songs`);
      }
      relatedArtists.slice(0, 2).forEach(rel => primaryQueries.push(`${rel} top pop songs`));
      primaryQueries.push(`english pop billboard hit songs`);
      secondaryQueries.push(`trending acoustic pop songs`);
      secondaryQueries.push(`best international pop songs`);
    } else {
      // Hindi / Bollywood Romantic / Melodic
      if (cleanArtist && cleanArtist.toLowerCase() !== 'unknown') {
        primaryQueries.push(`${cleanArtist} top hindi songs`);
      }
      relatedArtists.slice(0, 2).forEach(rel => primaryQueries.push(`${rel} hindi romantic hit songs`));
      if (/romantic|love|ishq|dil|sanam/i.test(combinedText)) {
        primaryQueries.push(`bollywood romantic love hit songs`);
      } else {
        primaryQueries.push(`superhit bollywood songs official`);
      }
      secondaryQueries.push(`hindi soulful romantic songs official`);
      secondaryQueries.push(`top bollywood acoustic songs`);
    }

    if (genre) {
      primaryQueries.push(`${genre} hit music`);
    }

    // 4. Candidate collection and multi-tier fetching ensuring >= 5 unique valid suggestions
    const seenIds = new Set();
    const seenKeys = new Set();
    const canonicalCurrentKey = getCanonicalSongKey({ title: cleanTitle || title, artist: cleanArtist || artist });
    const canonicalCurrentTitle = cleanSongTitle(cleanTitle || title);

    if (trackId) seenIds.add(trackId);
    if (canonicalCurrentKey) seenKeys.add(canonicalCurrentKey);

    // Track filtering function: strictly rejects currently playing track & duplicates
    const isValidAndDistinct = (track) => {
      const id = track.id || track.videoId;
      if (!id || seenIds.has(id)) return false;

      const trackKey = getCanonicalSongKey(track);
      if (trackKey && seenKeys.has(trackKey)) return false;

      const candidateTitle = (track.title || '').toLowerCase();
      const currentTitleLower = (cleanTitle || title).toLowerCase();

      // Title exact or normalized match
      if (candidateTitle === currentTitleLower) return false;

      const candidateCleanTitle = cleanSongTitle(track.title);
      if (canonicalCurrentTitle && candidateCleanTitle && candidateCleanTitle === canonicalCurrentTitle) {
        return false;
      }

      // If current song title is a distinctive word/phrase (>= 4 chars), reject videos whose title prominently features it
      if (currentTitleLower.length >= 4 && candidateTitle.includes(currentTitleLower)) {
        return false;
      }

      const cleanThumb = getCleanTrackThumbnail(track.thumbnail, id);
      if (!isValidThumbnailUrlFormat(cleanThumb)) return false;

      return true;
    };

    const results = [];

    const addTrack = (track, reasonText) => {
      if (!isValidAndDistinct(track)) return false;
      const id = track.id || track.videoId;
      const key = getCanonicalSongKey(track);
      seenIds.add(id);
      if (key) seenKeys.add(key);

      const cleanThumb = getCleanTrackThumbnail(track.thumbnail, id);
      results.push({
        ...track,
        id,
        videoId: id,
        thumbnail: cleanThumb,
        reason: reasonText || (cleanArtist ? `Similar acoustic vibe to ${cleanArtist}` : `Recommended for your ${detectedLang} mix`)
      });
      return true;
    };

    // Tier A: Query primary queries
    const primaryCandidates = await catalogService.fetchDynamicCandidates(primaryQueries, 10);
    for (const track of primaryCandidates) {
      addTrack(track);
      if (results.length >= 15) break;
    }

    // Tier B: Curated catalog fallback
    if (results.length < 5) {
      const curated = await catalogService.getCuratedTracks();
      const matchingCurated = curated.filter(t => {
        const matchArtist = cleanArtist && (t.artist || '').toLowerCase().includes(cleanArtist.toLowerCase());
        const matchGenre = genre && (t.genre || '').toLowerCase().includes(genre.toLowerCase());
        const matchLang = detectedLang && (t.language || '').toLowerCase().includes(detectedLang);
        return matchArtist || matchGenre || matchLang;
      });
      for (const track of matchingCurated) {
        addTrack(track, 'Curated acoustic match');
        if (results.length >= 15) break;
      }
    }

    // Tier C: Secondary queries if still under 5 valid suggestions
    if (results.length < 5 && secondaryQueries.length > 0) {
      const secondaryCandidates = await catalogService.fetchDynamicCandidates(secondaryQueries, 8);
      for (const track of secondaryCandidates) {
        addTrack(track);
        if (results.length >= 15) break;
      }
    }

    // Limit related results to exactly up to 5 top items (or up to 10 for pagination if requested)
    const relatedResults = results.slice(0, 5);

    // 5. Generate Discover Mix: Exactly 5 diverse songs from ANY genre/language/artist,
    // strictly deduplicated against the current track and the related group.
    const discoverResults = [];
    const discoverCandidatePool = [];

    // Discovery query buckets spanning multiple genres and cultures
    const DISCOVERY_QUERY_POOLS = [
      ['global pop billboard hits 2025 official music video', 'trending indie pop acoustic songs'],
      ['latest punjabi banger hits official music video', 'latin pop reggaeton hits official'],
      ['popular bollywood unplugged acoustic melodious songs', 'top lo-fi chill hop study beats'],
      ['soothing sufiyana qawwali coke studio official', 'classic 90s rock ballads official music video']
    ];

    // Pick 2 random buckets to query for fresh variety on every request/refresh
    const shuffledPoolIndices = [0, 1, 2, 3].sort(() => 0.5 - Math.random());
    const selectedDiscoveryQueries = [
      ...DISCOVERY_QUERY_POOLS[shuffledPoolIndices[0]],
      ...DISCOVERY_QUERY_POOLS[shuffledPoolIndices[1]]
    ];

    const dynamicDiscovery = await catalogService.fetchDynamicCandidates(selectedDiscoveryQueries, 6);
    for (const t of dynamicDiscovery) {
      discoverCandidatePool.push(t);
    }

    // Also pull from curated catalog to guarantee varied genres and languages
    const curatedDiscovery = await catalogService.getCuratedTracks();
    // Shuffle curated tracks to avoid repeatedly serving the same order
    const shuffledCurated = [...curatedDiscovery].sort(() => 0.5 - Math.random());
    for (const t of shuffledCurated) {
      discoverCandidatePool.push(t);
    }

    // Filter and add exactly 5 discover songs ensuring diversity (max 2 per genre/artist if possible)
    const discoverSeenGenres = new Map();
    for (const track of discoverCandidatePool) {
      if (discoverResults.length >= 5) break;
      if (!isValidAndDistinct(track)) continue;

      const trackGenre = (track.genre || 'Various').toLowerCase();
      const currentGenreCount = discoverSeenGenres.get(trackGenre) || 0;
      // Avoid clustering more than 2 tracks of the exact same genre in Discover Mix
      if (currentGenreCount >= 2 && discoverCandidatePool.length > 10) {
        continue;
      }

      const id = track.id || track.videoId;
      const key = getCanonicalSongKey(track);
      seenIds.add(id);
      if (key) seenKeys.add(key);
      discoverSeenGenres.set(trackGenre, currentGenreCount + 1);

      const cleanThumb = getCleanTrackThumbnail(track.thumbnail, id);
      discoverResults.push({
        ...track,
        id,
        videoId: id,
        thumbnail: cleanThumb,
        reason: track.genre ? `Discover: ${track.genre}` : 'Discover fresh music'
      });
    }

    // If still under 5, fill any remaining slots from valid candidates without the genre restriction
    if (discoverResults.length < 5) {
      for (const track of discoverCandidatePool) {
        if (discoverResults.length >= 5) break;
        if (!isValidAndDistinct(track)) continue;

        const id = track.id || track.videoId;
        const key = getCanonicalSongKey(track);
        seenIds.add(id);
        if (key) seenKeys.add(key);

        const cleanThumb = getCleanTrackThumbnail(track.thumbnail, id);
        discoverResults.push({
          ...track,
          id,
          videoId: id,
          thumbnail: cleanThumb,
          reason: track.genre ? `Discover: ${track.genre}` : 'Discover fresh music'
        });
      }
    }

    res.json({
      success: true,
      originalTrack: { id: trackId, title: cleanTitle || title, artist: cleanArtist || artist, detectedLanguage: detectedLang },
      related: relatedResults,
      discover: discoverResults,
      items: [...relatedResults, ...discoverResults]
    });
  } catch (err) {
    console.error('[Recommendations Similar Error]:', err.message);
    res.status(500).json({ error: 'Failed to find similar songs: ' + err.message });
  }
});

export default router;
export { handleListeningEvent };

