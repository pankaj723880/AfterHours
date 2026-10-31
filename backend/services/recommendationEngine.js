import mongoose from 'mongoose';
import UserRecommendationCache from '../models/UserRecommendationCache.js';
import UserListeningEvent from '../models/UserListeningEvent.js';
import { listeningEventService } from './listeningEventService.js';
import { catalogService } from './catalogService.js';
import { geminiRecommendationService, geminiDiagnostics } from './geminiRecommendationService.js';
import { getCanonicalSongKey, cleanSongTitle, cleanArtistName } from './recommendationHistoryService.js';

// Configuration
const CACHE_TTL_HOURS = 6;
const MIN_NEW_EVENTS_TO_INVALIDATE = 4; // Refresh if user has completed >= 4 new songs
const REFRESH_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes minimum between heavy regeneration calls

export const recommendationEngine = {
  /**
   * Main entrypoint for retrieving personalized recommendations.
   */
  async getPersonalizedRecommendations(userId, options = {}) {
    if (!userId) {
      throw new Error('User ID is required for personalized recommendations');
    }

    const { forceRefresh = false } = options;
    const now = new Date();

    // 1. Check existing cache if database is connected
    let cached = null;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      cached = await UserRecommendationCache.findOne({ userId }).lean().maxTimeMS(2000);
    }

    if (cached && !forceRefresh) {
      const isExpired = cached.expiresAt && new Date(cached.expiresAt) <= now;

      // Anti-corruption check: Ensure cached dailyMix and discover are genuinely distinct
      const cachedDaily = cached.recommendations?.dailyMix || [];
      const cachedDiscover = cached.recommendations?.discover || [];
      const cachedDailyIds = new Set(cachedDaily.map(t => t.id || t.videoId));
      const cachedDailyKeys = new Set(cachedDaily.map(t => getCanonicalSongKey(t)));

      const hasDuplicateRecommendations = cachedDiscover.some(t => {
        const id = t.id || t.videoId;
        const key = getCanonicalSongKey(t);
        return cachedDailyIds.has(id) || cachedDailyKeys.has(key);
      });

      if (hasDuplicateRecommendations) {
        // Stale or corrupted legacy cache where dailyMix and discover share songs.
        // Discard immediately to regenerate disjoint recommendation sets.
        cached = null;
      } else {
        // Count new events logged since cache was generated
        let newEventsCount = 0;
        if (mongoose.connection && mongoose.connection.readyState === 1) {
          newEventsCount = await UserListeningEvent.countDocuments({
            userId,
            createdAt: { $gt: cached.generatedAt }
          }).maxTimeMS(2000);
        }

        const hasCooldownElapsed = (now.getTime() - new Date(cached.generatedAt).getTime()) > REFRESH_COOLDOWN_MS;

        if (!isExpired && (newEventsCount < MIN_NEW_EVENTS_TO_INVALIDATE || !hasCooldownElapsed)) {
          geminiDiagnostics.cacheHits += 1;
          const sanitizedRecommendations = this.sanitizeRecommendations(cached.recommendations);
          return {
            ...sanitizedRecommendations,
            insights: cached.insights,
            source: cached.source,
            cached: true,
            generatedAt: cached.generatedAt,
            expiresAt: cached.expiresAt
          };
        }
      }
    }

    geminiDiagnostics.cacheMisses += 1;

    // 2. Load user listening profile
    const userProfile = await listeningEventService.getUserProfile(userId);

    // If user has explicitly disabled personalized recommendations in privacy settings
    if (userProfile.recommendationsEnabled === false) {
      const starterCandidates = await catalogService.getCuratedTracks();
      const dailyMix = starterCandidates.slice(0, 6);
      const dailyIds = new Set(dailyMix.map(t => t.id || t.videoId));
      const dailyKeys = new Set(dailyMix.map(t => getCanonicalSongKey(t)));
      const discover = starterCandidates
        .filter(t => !dailyIds.has(t.id || t.videoId) && !dailyKeys.has(getCanonicalSongKey(t)))
        .slice(0, 6);

      return {
        madeForYou: [],
        dailyMix,
        discover,
        becauseYouListenedTo: null,
        favouriteArtists: [],
        moreLikeRecent: [],
        insights: {
          dominantMood: 'Standard',
          topGenres: [],
          summary: 'Personalized recommendations are currently disabled in your privacy settings.'
        },
        recommendationsEnabled: false,
        source: 'disabled',
        cached: false
      };
    }

    // 3. Assemble candidate tracks
    const candidates = await catalogService.buildCandidatePool({
      userPreferences: userProfile,
      excludedIds: new Set(userProfile.dislikedTrackIds || [])
    });

    // 4. If new user with no history, return clean Discovery Starter Mix
    if (userProfile.isNewUser) {
      const starterResult = this.buildDiscoveryStarterMix(candidates);
      starterResult.recommendations = this.sanitizeRecommendations(starterResult.recommendations, candidates, userProfile);
      await this.saveCache(userId, starterResult, 'discovery_starter', 'none', 0);
      return {
        ...starterResult.recommendations,
        insights: starterResult.insights,
        source: 'discovery_starter',
        isNewUser: true,
        cached: false
      };
    }

    // 5. Attempt Gemini AI Personalized Recommendation
    let aiResult = null;
    if (geminiRecommendationService.isConfigured()) {
      aiResult = await geminiRecommendationService.generateRecommendations(userProfile, candidates);
    }

    // 6. If Gemini succeeded, sanitize, cache and return
    if (aiResult) {
      aiResult.recommendations = this.sanitizeRecommendations(aiResult.recommendations, candidates, userProfile);
      const totalEvents = await UserListeningEvent.countDocuments({ userId }).maxTimeMS(2000);
      await this.saveCache(userId, aiResult, 'gemini', aiResult.modelUsed || 'gemini-3.8-flash', totalEvents);
      return {
        ...aiResult.recommendations,
        insights: aiResult.insights,
        source: 'gemini',
        modelUsed: aiResult.modelUsed,
        cached: false,
        generatedAt: now
      };
    }

    // 7. Fallback: Intelligent Heuristic Hybrid Engine
    const fallbackResult = this.generateHeuristicRecommendations(userProfile, candidates);
    fallbackResult.recommendations = this.sanitizeRecommendations(fallbackResult.recommendations, candidates, userProfile);
    const totalEvents = await UserListeningEvent.countDocuments({ userId }).maxTimeMS(2000);
    await this.saveCache(userId, fallbackResult, 'catalog_fallback', 'heuristic_hybrid', totalEvents);

    return {
      ...fallbackResult.recommendations,
      insights: fallbackResult.insights,
      source: 'catalog_fallback',
      cached: false,
      generatedAt: now
    };
  },

  /**
   * Helper: Builds friendly discovery starter mix for brand new accounts.
   */
  /**
   * Helper: Builds friendly discovery starter mix for brand new accounts.
   * Partitions candidates into completely disjoint pools:
   * - Daily Mix: Evergreen, universally familiar hits (e.g. Kesariya, Tum Hi Ho).
   * - Discover: Novel indie, acoustic, and diverse sounds (e.g. Anuv Jain, Prateek Kuhad, Sufi Rock).
   * ZERO overlap between Daily Mix and Discover!
   */
  buildDiscoveryStarterMix(candidates = []) {
    const dailyMix = [];
    const dailyMixIds = new Set();
    const dailyMixKeys = new Set();

    // Select familiar mainstream hits for Daily Mix (Romantic, 90s, Pop)
    for (const track of candidates) {
      const id = track.id || track.videoId;
      const key = getCanonicalSongKey(track);
      if (!id || dailyMixIds.has(id) || dailyMixKeys.has(key)) continue;

      const genre = (track.genre || '').toLowerCase();
      const mood = (track.mood || '').toLowerCase();
      const isMainstream = genre.includes('romantic') || genre.includes('bollywood') || genre.includes('pop') || mood.includes('love') || mood.includes('feel-good');

      if (isMainstream || dailyMix.length < 5) {
        dailyMix.push({
          ...track,
          reason: 'Popular Daily Mix',
          source: 'starter'
        });
        dailyMixIds.add(id);
        dailyMixKeys.add(key);
      }
      if (dailyMix.length >= 6) break;
    }

    // Select novel discovery gems for Discover (Acoustic, Indie, Sufi, Rock, Underrated)
    // STRICTLY DISJOINT from dailyMix
    const discover = [];
    const discoverIds = new Set();
    const discoverKeys = new Set();

    for (const track of candidates) {
      const id = track.id || track.videoId;
      const key = getCanonicalSongKey(track);
      if (!id || dailyMixIds.has(id) || dailyMixKeys.has(key)) continue;
      if (discoverIds.has(id) || discoverKeys.has(key)) continue;

      const genre = (track.genre || '').toLowerCase();
      const mood = (track.mood || '').toLowerCase();
      const isNovel = mood.includes('underrated') || genre.includes('indie') || genre.includes('acoustic') || genre.includes('sufi') || genre.includes('rock');

      if (isNovel || discover.length < 5) {
        discover.push({
          ...track,
          reason: 'Explore new sounds',
          source: 'discovery'
        });
        discoverIds.add(id);
        discoverKeys.add(key);
      }
      if (discover.length >= 6) break;
    }

    // Made For You: Diverse starter showcase
    const madeForYou = [];
    const mIds = new Set();
    for (const track of candidates) {
      const id = track.id || track.videoId;
      if (!id || mIds.has(id)) continue;
      mIds.add(id);
      madeForYou.push({
        ...track,
        reason: 'Trending on Loopra',
        source: 'starter'
      });
      if (madeForYou.length >= 6) break;
    }

    return {
      source: 'discovery_starter',
      insights: {
        dominantMood: 'Trending Hits',
        topGenres: ['Bollywood', 'Desi Pop', 'Nostalgia'],
        summary: 'Welcome to Loopra! Play a few songs to train your AI-powered personalized mix.'
      },
      recommendations: {
        madeForYou,
        dailyMix,
        discover,
        becauseYouListenedTo: null,
        favouriteArtists: [],
        moreLikeRecent: []
      }
    };
  },

  /**
   * Intelligent Heuristic Hybrid Recommendation Engine.
   * Runs when Gemini API is unconfigured or temporarily unavailable.
   * 
   * Strategy 1 - Your Daily Mix:
   * Focuses on familiarity, cohesive flow, and continuity. Prioritizes user's
   * top artists, frequent favorites, and completed listens.
   * 
   * Strategy 2 - Discover Your Next Favourite:
   * Focuses on novelty, taste expansion, and exploring new artists / adjacent genres.
   * STRICTLY DISJOINT: Excludes all tracks in Daily Mix and user's top played songs.
   */
  generateHeuristicRecommendations(userProfile, candidates = []) {
    const skippedSet = new Set(userProfile.skippedTrackIds || []);
    const dislikedSet = new Set(userProfile.dislikedTrackIds || []);
    const favouriteSet = new Set(userProfile.favouriteTrackIds || []);
    const recentTrackIds = new Set((userProfile.recentTracks || []).map(t => t.trackId || t.id || t.videoId));
    const topArtistNames = (userProfile.topArtists || []).map(a => a.name.toLowerCase());
    const primaryArtist = topArtistNames[0] || 'Arijit Singh';
    const topGenres = (userProfile.topGenres || []).map(g => g.name.toLowerCase());

    // 1. Score candidates for familiarity and affinity
    const scoredCandidates = [];
    for (const track of candidates) {
      const trackId = track.id || track.videoId;
      if (!trackId || dislikedSet.has(trackId)) continue; // Respect explicit dislikes completely

      let familiarityScore = 10;
      const trackArtist = (track.artist || track.channel || '').toLowerCase();
      const trackGenre = (track.genre || '').toLowerCase();

      // Top artist match (+25)
      if (topArtistNames.some(art => trackArtist.includes(art))) {
        familiarityScore += 25;
      }
      // Top genre match (+15)
      if (topGenres.some(g => trackGenre.includes(g))) {
        familiarityScore += 15;
      }
      // Favourites / repeats (+20)
      if (favouriteSet.has(trackId)) {
        familiarityScore += 20;
      }
      // Heavily penalize skipped tracks (-30)
      if (skippedSet.has(trackId)) {
        familiarityScore -= 30;
      }

      scoredCandidates.push({
        track,
        score: familiarityScore,
        canonicalKey: getCanonicalSongKey(track)
      });
    }

    scoredCandidates.sort((a, b) => b.score - a.score);

    // 2. Build Made For You (diversified, max 2 tracks per artist)
    const madeForYou = [];
    const madeForYouIds = new Set();
    const madeForYouKeys = new Set();
    const mArtistCount = {};

    for (const item of scoredCandidates) {
      const id = item.track.id || item.track.videoId;
      const key = item.canonicalKey;
      const art = (item.track.artist || 'various').toLowerCase();

      if (madeForYouIds.has(id) || madeForYouKeys.has(key)) continue;
      if ((mArtistCount[art] || 0) >= 2) continue;

      mArtistCount[art] = (mArtistCount[art] || 0) + 1;
      madeForYouIds.add(id);
      madeForYouKeys.add(key);
      madeForYou.push({
        ...item.track,
        reason: favouriteSet.has(id)
          ? 'Based on your favourites'
          : topArtistNames.some(a => art.includes(a))
            ? `Because you love ${item.track.artist}`
            : 'Matches your listening vibe',
        source: 'hybrid'
      });
      if (madeForYou.length >= 6) break;
    }

    // 3. Strategy 1: "Your Daily Mix"
    // Cohesive, familiar flow based on user history, top genres, and top artists
    const dailyMix = [];
    const dailyMixIds = new Set();
    const dailyMixKeys = new Set();
    const dArtistCount = {};

    for (const item of scoredCandidates) {
      const id = item.track.id || item.track.videoId;
      const key = item.canonicalKey;
      const art = (item.track.artist || 'various').toLowerCase();

      // Disallow internal duplicates
      if (dailyMixIds.has(id) || dailyMixKeys.has(key)) continue;

      // Limit max 2 per artist in dailyMix for smooth variety
      if ((dArtistCount[art] || 0) >= 2) continue;

      dArtistCount[art] = (dArtistCount[art] || 0) + 1;
      dailyMixIds.add(id);
      dailyMixKeys.add(key);

      dailyMix.push({
        ...item.track,
        reason: favouriteSet.has(id)
          ? 'From your frequent favourites'
          : topArtistNames.some(a => art.includes(a))
            ? `Curated daily hit from ${item.track.artist}`
            : 'Curated for your daily listening',
        source: 'hybrid'
      });

      if (dailyMix.length >= 6) break;
    }

    // 4. Strategy 2: "Discover Your Next Favourite"
    // Prioritizes novel artists, unexplored music, and related genres
    // CRITICAL: MUST BE COMPLETELY DISJOINT FROM dailyMix
    const discover = [];
    const discoverIds = new Set();
    const discoverKeys = new Set();

    const discoveryCandidates = [];
    for (const track of candidates) {
      const id = track.id || track.videoId;
      const key = getCanonicalSongKey(track);

      // STRICT EXCLUSION: Exclude tracks in dailyMix
      if (dailyMixIds.has(id) || dailyMixKeys.has(key)) continue;
      // STRICT EXCLUSION: Exclude tracks in madeForYou
      if (madeForYouIds.has(id) || madeForYouKeys.has(key)) continue;
      // STRICT EXCLUSION: Exclude tracks user already plays frequently or favorited
      if (favouriteSet.has(id) || recentTrackIds.has(id) || skippedSet.has(id) || dislikedSet.has(id)) continue;

      const trackArtist = (track.artist || track.channel || '').toLowerCase();
      const isKnownArtist = topArtistNames.some(a => trackArtist.includes(a));

      let discoveryScore = 15;
      // Bonus if it's a NEW artist (+20)
      if (!isKnownArtist) {
        discoveryScore += 20;
      }
      // Bonus if it's an indie, acoustic, or underrated gem (+15)
      const mood = (track.mood || '').toLowerCase();
      const genre = (track.genre || '').toLowerCase();
      if (mood.includes('underrated') || genre.includes('indie') || genre.includes('acoustic') || mood.includes('soulful')) {
        discoveryScore += 15;
      }

      discoveryCandidates.push({
        track,
        score: discoveryScore,
        canonicalKey: key,
        id
      });
    }

    discoveryCandidates.sort((a, b) => b.score - a.score);

    for (const item of discoveryCandidates) {
      if (discoverIds.has(item.id) || discoverKeys.has(item.canonicalKey)) continue;

      discoverIds.add(item.id);
      discoverKeys.add(item.canonicalKey);

      discover.push({
        ...item.track,
        reason: 'Fresh sound picked to broaden your taste',
        source: 'discovery'
      });

      if (discover.length >= 6) break;
    }

    // If discover still needs candidates and candidate pool is limited:
    // Only add if it does NOT violate dailyMix exclusion!
    if (discover.length < 4) {
      for (const track of candidates) {
        const id = track.id || track.videoId;
        const key = getCanonicalSongKey(track);
        if (dailyMixIds.has(id) || dailyMixKeys.has(key)) continue;
        if (discoverIds.has(id) || discoverKeys.has(key)) continue;
        if (dislikedSet.has(id)) continue;

        discoverIds.add(id);
        discoverKeys.add(key);
        discover.push({
          ...track,
          reason: 'Curated discovery recommendation',
          source: 'discovery'
        });
        if (discover.length >= 5) break;
      }
    }

    // 5. Because You Listened To:
    const recentBase = userProfile.recentTracks?.[0] || null;
    const baseArt = recentBase ? (recentBase.artist || '').toLowerCase() : '';
    const usedInOtherSections = new Set([
      ...madeForYou.map(m => m.id || m.videoId),
      ...dailyMix.map(d => d.id || d.videoId)
    ]);

    let relatedToRecent = [];
    if (recentBase) {
      const baseId = recentBase.trackId;
      const artistMatches = candidates.filter(t => {
        const tId = t.id || t.videoId;
        if (tId === baseId || usedInOtherSections.has(tId)) return false;
        const tArt = (t.artist || t.channel || '').toLowerCase();
        return baseArt && (tArt.includes(baseArt) || baseArt.includes(tArt));
      });

      const otherMatches = candidates.filter(t => {
        const tId = t.id || t.videoId;
        return tId !== baseId && !usedInOtherSections.has(tId) && !artistMatches.some(a => (a.id || a.videoId) === tId);
      });

      relatedToRecent = [...artistMatches, ...otherMatches].slice(0, 4).map(t => ({
        ...t,
        reason: `Inspired by "${recentBase.title}"`,
        source: 'hybrid'
      }));
    }

    // 6. Favourite artists section
    const favouriteArtistsTracks = candidates.filter(t => {
      const art = (t.artist || t.channel || '').toLowerCase();
      return topArtistNames.some(a => art.includes(a));
    }).slice(0, 8).map(t => ({
      ...t,
      reason: `Because you love ${t.artist}`,
      source: 'hybrid'
    }));

    return {
      source: 'catalog_fallback',
      insights: {
        dominantMood: 'Melodic & Nostalgic',
        topGenres: ['Bollywood Melodies', 'Desi Lounge'],
        summary: `Crafted around your affinity for ${primaryArtist} and curated favorites.`
      },
      recommendations: {
        madeForYou,
        dailyMix,
        discover,
        becauseYouListenedTo: recentBase ? {
          baseTrack: {
            id: recentBase.trackId,
            videoId: recentBase.trackId,
            title: recentBase.title,
            artist: recentBase.artist,
            thumbnail: recentBase.thumbnail
          },
          recommendations: relatedToRecent
        } : null,
        favouriteArtists: favouriteArtistsTracks,
        moreLikeRecent: relatedToRecent
      }
    };
  },

  /**
   * Sanitizes recommendations across sections to guarantee:
   * 1. Zero duplicate tracks between Daily Mix and Discover Your Next Favourite.
   * 2. Zero internal duplicates within any section.
   * 3. Accurate metadata (no "Unknown Artist" labels when channel or title has information).
   * 4. Reliable videoId / id matching.
   */
  sanitizeRecommendations(recommendations = {}, candidates = [], userProfile = {}) {
    if (!recommendations || typeof recommendations !== 'object') {
      return recommendations;
    }

    const cleanTrack = (t, defaultReason = '') => {
      if (!t) return null;
      const trackId = t.id || t.videoId;
      if (!trackId) return null;

      let artist = t.artist;
      if (!artist || artist === 'Unknown' || artist === 'Unknown Artist' || artist === 'Various Artists') {
        artist = t.channel || 'Loopra Artist';
      }

      return {
        id: trackId,
        videoId: trackId,
        title: t.title || 'Untitled Track',
        artist,
        channel: t.channel || artist,
        thumbnail: t.thumbnail || `https://i.ytimg.com/vi/${trackId}/hqdefault.jpg`,
        duration: t.duration || '3:30',
        reason: t.reason || defaultReason,
        source: t.source || 'curated'
      };
    };

    // 1. Sanitize Made For You
    const rawMadeForYou = Array.isArray(recommendations.madeForYou) ? recommendations.madeForYou : [];
    const madeForYou = [];
    const mIds = new Set();
    const mKeys = new Set();

    for (const t of rawMadeForYou) {
      const clean = cleanTrack(t, 'Matches your listening vibe');
      if (!clean) continue;
      const key = getCanonicalSongKey(clean);
      if (mIds.has(clean.id) || mKeys.has(key)) continue;
      mIds.add(clean.id);
      mKeys.add(key);
      madeForYou.push(clean);
    }

    // 2. Sanitize Daily Mix (internal deduplication)
    const rawDailyMix = Array.isArray(recommendations.dailyMix) ? recommendations.dailyMix : [];
    const dailyMix = [];
    const dailyMixIds = new Set();
    const dailyMixKeys = new Set();

    for (const t of rawDailyMix) {
      const clean = cleanTrack(t, 'Curated for your daily listening');
      if (!clean) continue;
      const key = getCanonicalSongKey(clean);
      if (dailyMixIds.has(clean.id) || dailyMixKeys.has(key)) continue;
      dailyMixIds.add(clean.id);
      dailyMixKeys.add(key);
      dailyMix.push(clean);
    }

    // 3. Sanitize Discover Your Next Favourite:
    // STRICTLY DISJOINT: Exclude all tracks in dailyMix
    const rawDiscover = Array.isArray(recommendations.discover) ? recommendations.discover : [];
    const discover = [];
    const discoverIds = new Set();
    const discoverKeys = new Set();

    for (const t of rawDiscover) {
      const clean = cleanTrack(t, 'Fresh discovery picked for you');
      if (!clean) continue;
      const key = getCanonicalSongKey(clean);

      // Exclude if already in Daily Mix
      if (dailyMixIds.has(clean.id) || dailyMixKeys.has(key)) continue;
      // Exclude if already in Discover
      if (discoverIds.has(clean.id) || discoverKeys.has(key)) continue;

      discoverIds.add(clean.id);
      discoverKeys.add(key);
      discover.push(clean);
    }

    // Backfill Discover if needed from candidates without violating Daily Mix exclusion
    if (discover.length < 4 && Array.isArray(candidates) && candidates.length > 0) {
      for (const cand of candidates) {
        const clean = cleanTrack(cand, 'Broaden your taste with adjacent sounds');
        if (!clean) continue;
        const key = getCanonicalSongKey(clean);

        if (dailyMixIds.has(clean.id) || dailyMixKeys.has(key)) continue;
        if (discoverIds.has(clean.id) || discoverKeys.has(key)) continue;

        discoverIds.add(clean.id);
        discoverKeys.add(key);
        discover.push(clean);

        if (discover.length >= 5) break;
      }
    }

    // 4. Sanitize other sections
    const rawMoreLike = Array.isArray(recommendations.moreLikeRecent) ? recommendations.moreLikeRecent : [];
    const moreLikeRecent = rawMoreLike.map(t => cleanTrack(t)).filter(Boolean);

    const rawFavArtists = Array.isArray(recommendations.favouriteArtists) ? recommendations.favouriteArtists : [];
    const favouriteArtists = rawFavArtists.map(t => cleanTrack(t)).filter(Boolean);

    return {
      ...recommendations,
      madeForYou,
      dailyMix,
      discover,
      moreLikeRecent,
      favouriteArtists
    };
  },

  /**
   * Helper: Saves recommendations into UserRecommendationCache.
   */
  async saveCache(userId, result, source, modelUsed, eventsCount) {
    try {
      if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
      const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);
      await UserRecommendationCache.findOneAndUpdate(
        { userId },
        {
          $set: {
            recommendations: result.recommendations,
            insights: result.insights,
            source,
            modelUsed,
            eventsCountAtGeneration: eventsCount,
            generatedAt: new Date(),
            expiresAt
          }
        },
        { upsert: true, returnDocument: 'after' }
      ).maxTimeMS(3000);
    } catch (err) {
      console.warn('[RecommendationEngine] Notice saving cache:', err.message);
    }
  },

  /**
   * Diagnostics endpoint data for admin/monitoring.
   */
  getDiagnostics() {
    return {
      geminiConfigured: geminiRecommendationService.isConfigured(),
      ...geminiDiagnostics,
      timestamp: new Date().toISOString()
    };
  }
};
