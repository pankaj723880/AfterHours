import mongoose from 'mongoose';
import UserRecommendationCache from '../models/UserRecommendationCache.js';
import UserListeningEvent from '../models/UserListeningEvent.js';
import { listeningEventService } from './listeningEventService.js';
import { catalogService } from './catalogService.js';
import { geminiRecommendationService, geminiDiagnostics } from './geminiRecommendationService.js';
import { getCanonicalSongKey, cleanSongTitle, cleanArtistName, areTracksSame, TrackDeduplicator } from './recommendationHistoryService.js';
import { getCleanTrackThumbnail, isValidThumbnailUrlFormat, filterTracksWithValidThumbnailsSync, isKnownInvalidId } from './thumbnailValidationService.js';

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

      // Complete Anti-corruption check: Ensure zero duplicates across ALL recommendation sections
      const recs = cached.recommendations || {};
      const allSections = [
        recs.madeForYou || [],
        recs.becauseYouListenedTo?.recommendations || [],
        recs.dailyMix || [],
        recs.favouriteArtists || [],
        recs.discover || [],
        recs.moreLikeRecent || []
      ];

      const testDeduplicator = new TrackDeduplicator();
      let hasCorruptedCache = false;
      for (const section of allSections) {
        if (!Array.isArray(section)) continue;
        for (const track of section) {
          if (testDeduplicator.isDuplicate(track)) {
            hasCorruptedCache = true;
            break;
          }
          const tid = track?.id || track?.videoId;
          const thumb = track?.thumbnail || track?.image;
          if (!tid || isKnownInvalidId(tid) || !isValidThumbnailUrlFormat(thumb)) {
            hasCorruptedCache = true;
            break;
          }
          testDeduplicator.add(track);
        }
        if (hasCorruptedCache) break;
      }

      if (hasCorruptedCache) {
        // Stale or corrupted legacy cache where any recommendation sections share songs or have broken thumbnails.
        // Discard immediately to regenerate clean, verified recommendation sets.
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
      const starterDedup = new TrackDeduplicator();
      const dailyMix = starterDedup.filterUnique(starterCandidates).slice(0, 6);
      const discover = starterDedup.filterUnique(starterCandidates).slice(0, 6);

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
   * Partitions candidates into completely disjoint pools across ALL sections:
   * - Made For You: Diverse trending starter showcase
   * - Daily Mix: Evergreen, universally familiar hits (e.g. Kesariya, Tum Hi Ho).
   * - Discover: Novel indie, acoustic, and diverse sounds (e.g. Anuv Jain, Prateek Kuhad, Sufi Rock).
   * ZERO overlap across the entire starter ecosystem!
   */
  buildDiscoveryStarterMix(candidates = []) {
    const validCandidates = filterTracksWithValidThumbnailsSync(candidates);
    const deduplicator = new TrackDeduplicator();

    // 1. Made For You: Diverse starter showcase (Romantic, Bollywood, Pop hits)
    const madeForYou = [];
    for (const track of validCandidates) {
      if (deduplicator.isDuplicate(track)) continue;

      const genre = (track.genre || '').toLowerCase();
      const mood = (track.mood || '').toLowerCase();
      const isMainstream = genre.includes('romantic') || genre.includes('bollywood') || genre.includes('pop') || mood.includes('love') || mood.includes('feel-good');

      if (isMainstream || madeForYou.length < 5) {
        deduplicator.add(track);
        madeForYou.push({
          ...track,
          reason: 'Trending on Loopra',
          source: 'starter'
        });
      }
      if (madeForYou.length >= 6) break;
    }

    // 2. Select familiar mainstream hits for Daily Mix (STRICTLY DISJOINT from Made For You)
    const dailyMix = [];
    for (const track of validCandidates) {
      if (deduplicator.isDuplicate(track)) continue;

      const genre = (track.genre || '').toLowerCase();
      const mood = (track.mood || '').toLowerCase();
      const isMainstream = genre.includes('romantic') || genre.includes('bollywood') || genre.includes('pop') || mood.includes('love') || mood.includes('feel-good') || mood.includes('nostalgic');

      if (isMainstream || dailyMix.length < 5) {
        deduplicator.add(track);
        dailyMix.push({
          ...track,
          reason: 'Popular Daily Mix',
          source: 'starter'
        });
      }
      if (dailyMix.length >= 6) break;
    }

    // 3. Select novel discovery gems for Discover (Acoustic, Indie, Sufi, Rock, Underrated)
    // STRICTLY DISJOINT from Made For You and Daily Mix
    const discover = [];
    for (const track of validCandidates) {
      if (deduplicator.isDuplicate(track)) continue;

      const genre = (track.genre || '').toLowerCase();
      const mood = (track.mood || '').toLowerCase();
      const isNovel = mood.includes('underrated') || genre.includes('indie') || genre.includes('acoustic') || genre.includes('sufi') || genre.includes('rock');

      if (isNovel || discover.length < 5) {
        deduplicator.add(track);
        discover.push({
          ...track,
          reason: 'Explore new sounds',
          source: 'discovery'
        });
      }
      if (discover.length >= 6) break;
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
   * Enforces 100% mutual disjointness across ALL sections using TrackDeduplicator.
   */
  generateHeuristicRecommendations(userProfile, candidates = []) {
    candidates = filterTracksWithValidThumbnailsSync(candidates);
    const skippedSet = new Set(userProfile.skippedTrackIds || []);
    const dislikedSet = new Set(userProfile.dislikedTrackIds || []);
    const favouriteSet = new Set(userProfile.favouriteTrackIds || []);
    const recentTrackIds = new Set((userProfile.recentTracks || []).map(t => t.trackId || t.id || t.videoId));
    const topArtistNames = (userProfile.topArtists || []).map(a => a.name.toLowerCase());
    const primaryArtist = topArtistNames[0] || 'Arijit Singh';
    const topGenres = (userProfile.topGenres || []).map(g => g.name.toLowerCase());

    const deduplicator = new TrackDeduplicator();
    const recentBase = userProfile?.recentTracks?.[0] || null;
    if (recentBase) {
      deduplicator.add(recentBase);
    }

    // 1. Score candidates for familiarity and affinity
    const scoredCandidates = [];
    for (const track of candidates) {
      const trackId = track.id || track.videoId;
      if (!trackId || dislikedSet.has(trackId)) continue;

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
    const mArtistCount = {};

    for (const item of scoredCandidates) {
      if (deduplicator.isDuplicate(item.track)) continue;
      const art = (item.track.artist || 'various').toLowerCase();
      if ((mArtistCount[art] || 0) >= 2) continue;

      mArtistCount[art] = (mArtistCount[art] || 0) + 1;
      deduplicator.add(item.track);
      madeForYou.push({
        ...item.track,
        reason: favouriteSet.has(item.track.id || item.track.videoId)
          ? 'Based on your favourites'
          : topArtistNames.some(a => art.includes(a))
            ? `Because you love ${item.track.artist}`
            : 'Matches your listening vibe',
        source: 'hybrid'
      });
      if (madeForYou.length >= 6) break;
    }

    // 3. Because You Listened To (strictly disjoint from Made For You)
    const baseArt = recentBase ? (recentBase.artist || '').toLowerCase() : '';
    let relatedToRecent = [];

    if (recentBase) {
      const baseId = recentBase.trackId;
      for (const cand of candidates) {
        const cId = cand.id || cand.videoId;
        if (cId === baseId || deduplicator.isDuplicate(cand)) continue;
        const cArt = (cand.artist || cand.channel || '').toLowerCase();
        if (baseArt && (cArt.includes(baseArt) || baseArt.includes(cArt))) {
          deduplicator.add(cand);
          relatedToRecent.push({
            ...cand,
            reason: `Inspired by "${recentBase.title}"`,
            source: 'hybrid'
          });
          if (relatedToRecent.length >= 4) break;
        }
      }
      if (relatedToRecent.length < 3) {
        for (const cand of candidates) {
          const cId = cand.id || cand.videoId;
          if (cId === baseId || deduplicator.isDuplicate(cand)) continue;
          deduplicator.add(cand);
          relatedToRecent.push({
            ...cand,
            reason: `Inspired by "${recentBase.title}"`,
            source: 'hybrid'
          });
          if (relatedToRecent.length >= 4) break;
        }
      }
    }

    // 4. Strategy 1: "Your Daily Mix"
    // Cohesive, familiar flow based on user history, top genres, and top artists
    // STRICTLY DISJOINT: Exclude all tracks already in madeForYou and becauseYouListenedTo
    const dailyMix = [];
    const dArtistCount = {};

    for (const item of scoredCandidates) {
      if (deduplicator.isDuplicate(item.track)) continue;
      const art = (item.track.artist || 'various').toLowerCase();

      // Limit max 2 per artist in dailyMix for smooth variety
      if ((dArtistCount[art] || 0) >= 2) continue;

      dArtistCount[art] = (dArtistCount[art] || 0) + 1;
      deduplicator.add(item.track);

      dailyMix.push({
        ...item.track,
        reason: favouriteSet.has(item.track.id || item.track.videoId)
          ? 'From your frequent favourites'
          : topArtistNames.some(a => art.includes(a))
            ? `Curated daily hit from ${item.track.artist}`
            : 'Curated for your daily listening',
        source: 'hybrid'
      });

      if (dailyMix.length >= 6) break;
    }

    // 5. Favourite artists section (strictly disjoint from all above)
    const favouriteArtistsTracks = [];
    for (const cand of candidates) {
      if (deduplicator.isDuplicate(cand)) continue;
      const art = (cand.artist || cand.channel || '').toLowerCase();
      if (topArtistNames.some(a => art.includes(a))) {
        deduplicator.add(cand);
        favouriteArtistsTracks.push({
          ...cand,
          reason: `Because you love ${cand.artist}`,
          source: 'hybrid'
        });
        if (favouriteArtistsTracks.length >= 6) break;
      }
    }

    // 6. Strategy 2: "Discover Your Next Favourite"
    // Prioritizes novel artists, unexplored music, and related genres
    // CRITICAL: MUST BE COMPLETELY DISJOINT FROM ALL PREVIOUS SECTIONS
    const discover = [];
    const discoveryCandidates = [];

    for (const track of candidates) {
      if (deduplicator.isDuplicate(track)) continue;
      const id = track.id || track.videoId;

      // STRICT EXCLUSION: Exclude tracks user already plays frequently or favorited
      if (favouriteSet.has(id) || recentTrackIds.has(id) || skippedSet.has(id) || dislikedSet.has(id)) continue;

      const trackArtist = (track.artist || track.channel || '').toLowerCase();
      const isKnownArtist = topArtistNames.some(a => trackArtist.includes(a));

      let discoveryScore = 15;
      if (!isKnownArtist) discoveryScore += 20;
      const mood = (track.mood || '').toLowerCase();
      const genre = (track.genre || '').toLowerCase();
      if (mood.includes('underrated') || genre.includes('indie') || genre.includes('acoustic') || mood.includes('soulful')) {
        discoveryScore += 15;
      }

      discoveryCandidates.push({
        track,
        score: discoveryScore
      });
    }

    discoveryCandidates.sort((a, b) => b.score - a.score);

    for (const item of discoveryCandidates) {
      if (deduplicator.isDuplicate(item.track)) continue;

      deduplicator.add(item.track);
      discover.push({
        ...item.track,
        reason: 'Fresh sound picked to broaden your taste',
        source: 'discovery'
      });

      if (discover.length >= 6) break;
    }

    // If discover still needs candidates and candidate pool is limited:
    // Only add if it does NOT violate any section exclusion!
    if (discover.length < 4) {
      for (const track of candidates) {
        if (deduplicator.isDuplicate(track) || dislikedSet.has(track.id || track.videoId)) continue;

        deduplicator.add(track);
        discover.push({
          ...track,
          reason: 'Curated discovery recommendation',
          source: 'discovery'
        });
        if (discover.length >= 5) break;
      }
    }

    // 7. More Like Recent (fresh vibe, strictly disjoint from all above)
    const moreLikeRecent = [];
    if (recentBase) {
      for (const cand of candidates) {
        if (deduplicator.isDuplicate(cand)) continue;
        deduplicator.add(cand);
        moreLikeRecent.push({
          ...cand,
          reason: 'Matches vibe of recent sessions',
          source: 'hybrid'
        });
        if (moreLikeRecent.length >= 4) break;
      }
    }

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
        becauseYouListenedTo: recentBase && relatedToRecent.length > 0 ? {
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
        moreLikeRecent
      }
    };
  },

  /**
   * Sanitizes recommendations across sections using TrackDeduplicator to guarantee:
   * 1. EXACTLY ZERO duplicate tracks across all sections.
   * 2. Zero internal duplicates within any section.
   * 3. Accurate metadata (no "Unknown Artist" labels when channel or title has information).
   * 4. Reliable videoId / id matching.
   */
  sanitizeRecommendations(recommendations = {}, candidates = [], userProfile = {}) {
    if (!recommendations || typeof recommendations !== 'object') {
      return recommendations;
    }

    const deduplicator = new TrackDeduplicator();
    const baseTrackFromRecs = recommendations?.becauseYouListenedTo?.baseTrack;
    const recentBase = baseTrackFromRecs || userProfile?.recentTracks?.[0] || null;
    if (recentBase) {
      deduplicator.add(recentBase);
    }

    const cleanTrack = (t, defaultReason = '') => {
      if (!t) return null;
      const trackId = t.id || t.videoId;
      if (!trackId || isKnownInvalidId(trackId)) return null;

      const cleanThumb = getCleanTrackThumbnail(t.thumbnail, trackId);
      if (!isValidThumbnailUrlFormat(cleanThumb)) return null;

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
        thumbnail: cleanThumb,
        duration: t.duration || '3:30',
        reason: t.reason || defaultReason,
        source: t.source || 'curated'
      };
    };

    // STAGE 1: Process and deduplicate all caller/algorithm assigned tracks across all sections
    let madeForYou = undefined;
    if (Array.isArray(recommendations.madeForYou)) {
      madeForYou = [];
      for (const t of recommendations.madeForYou) {
        const clean = cleanTrack(t, 'Matches your listening vibe');
        if (!clean || deduplicator.isDuplicate(clean)) continue;
        deduplicator.add(clean);
        madeForYou.push(clean);
      }
    }

    let becauseYouListenedTo = undefined;
    if (recommendations.becauseYouListenedTo && typeof recommendations.becauseYouListenedTo === 'object') {
      const baseClean = cleanTrack(recommendations.becauseYouListenedTo.baseTrack);
      const rawRecs = Array.isArray(recommendations.becauseYouListenedTo.recommendations)
        ? recommendations.becauseYouListenedTo.recommendations
        : [];
      const becauseRecs = [];
      for (const t of rawRecs) {
        const clean = cleanTrack(t, 'Inspired by your listening history');
        if (!clean || deduplicator.isDuplicate(clean)) continue;
        deduplicator.add(clean);
        becauseRecs.push(clean);
      }
      if (becauseRecs.length > 0 && baseClean) {
        becauseYouListenedTo = {
          baseTrack: baseClean,
          recommendations: becauseRecs
        };
      } else {
        becauseYouListenedTo = null;
      }
    }

    let dailyMix = undefined;
    if (Array.isArray(recommendations.dailyMix)) {
      dailyMix = [];
      for (const t of recommendations.dailyMix) {
        const clean = cleanTrack(t, 'Curated for your daily listening');
        if (!clean || deduplicator.isDuplicate(clean)) continue;
        deduplicator.add(clean);
        dailyMix.push(clean);
      }
    }

    let favouriteArtists = undefined;
    if (Array.isArray(recommendations.favouriteArtists)) {
      favouriteArtists = [];
      for (const t of recommendations.favouriteArtists) {
        const clean = cleanTrack(t, 'From your top artists');
        if (!clean || deduplicator.isDuplicate(clean)) continue;
        deduplicator.add(clean);
        favouriteArtists.push(clean);
      }
    }

    let discover = undefined;
    if (Array.isArray(recommendations.discover)) {
      discover = [];
      for (const t of recommendations.discover) {
        const clean = cleanTrack(t, 'Fresh discovery picked for you');
        if (!clean || deduplicator.isDuplicate(clean)) continue;
        deduplicator.add(clean);
        discover.push(clean);
      }
    }

    let moreLikeRecent = undefined;
    if (Array.isArray(recommendations.moreLikeRecent)) {
      moreLikeRecent = [];
      for (const t of recommendations.moreLikeRecent) {
        const clean = cleanTrack(t, 'Vibes matching your recent session');
        if (!clean || deduplicator.isDuplicate(clean)) continue;
        deduplicator.add(clean);
        moreLikeRecent.push(clean);
      }
    }

    // STAGE 2: Backfill any section that has remaining capacity from extra unassigned candidates only
    if (Array.isArray(candidates) && candidates.length > 0) {
      if (Array.isArray(madeForYou) && madeForYou.length < 5) {
        for (const cand of candidates) {
          const clean = cleanTrack(cand, 'Trending on Loopra');
          if (!clean || deduplicator.isDuplicate(clean)) continue;
          deduplicator.add(clean);
          madeForYou.push(clean);
          if (madeForYou.length >= 6) break;
        }
      }

      if (Array.isArray(dailyMix) && dailyMix.length < 5) {
        for (const cand of candidates) {
          const clean = cleanTrack(cand, 'Curated for your daily listening');
          if (!clean || deduplicator.isDuplicate(clean)) continue;
          deduplicator.add(clean);
          dailyMix.push(clean);
          if (dailyMix.length >= 6) break;
        }
      }

      if (Array.isArray(discover) && discover.length < 4) {
        for (const cand of candidates) {
          const clean = cleanTrack(cand, 'Broaden your taste with adjacent sounds');
          if (!clean || deduplicator.isDuplicate(clean)) continue;
          deduplicator.add(clean);
          discover.push(clean);
          if (discover.length >= 5) break;
        }
      }
    }

    const sanitized = { ...recommendations };
    if (madeForYou !== undefined) sanitized.madeForYou = madeForYou;
    if (becauseYouListenedTo !== undefined) sanitized.becauseYouListenedTo = becauseYouListenedTo;
    if (dailyMix !== undefined) sanitized.dailyMix = dailyMix;
    if (favouriteArtists !== undefined) sanitized.favouriteArtists = favouriteArtists;
    if (discover !== undefined) sanitized.discover = discover;
    if (moreLikeRecent !== undefined) sanitized.moreLikeRecent = moreLikeRecent;

    return sanitized;
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
