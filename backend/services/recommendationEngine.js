import mongoose from 'mongoose';
import UserRecommendationCache from '../models/UserRecommendationCache.js';
import UserListeningEvent from '../models/UserListeningEvent.js';
import { listeningEventService } from './listeningEventService.js';
import { catalogService } from './catalogService.js';
import { geminiRecommendationService, geminiDiagnostics } from './geminiRecommendationService.js';

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
        return {
          ...cached.recommendations,
          insights: cached.insights,
          source: cached.source,
          cached: true,
          generatedAt: cached.generatedAt,
          expiresAt: cached.expiresAt
        };
      }
    }

    geminiDiagnostics.cacheMisses += 1;

    // 2. Load user listening profile
    const userProfile = await listeningEventService.getUserProfile(userId);

    // If user has explicitly disabled personalized recommendations in privacy settings
    if (userProfile.recommendationsEnabled === false) {
      const starterCandidates = await catalogService.getCuratedTracks();
      return {
        madeForYou: [],
        dailyMix: starterCandidates.slice(0, 6),
        discover: starterCandidates.slice(6, 12),
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
    const candidates = await catalogService.buildCandidatePool(userProfile);

    // 4. If new user with no history, return clean Discovery Starter Mix
    if (userProfile.isNewUser) {
      const starterResult = this.buildDiscoveryStarterMix(candidates);
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

    // 6. If Gemini succeeded, cache and return
    if (aiResult) {
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
  buildDiscoveryStarterMix(candidates = []) {
    return {
      source: 'discovery_starter',
      insights: {
        dominantMood: 'Trending Hits',
        topGenres: ['Bollywood', 'Desi Pop', 'Nostalgia'],
        summary: 'Welcome to Loopra! Play a few songs to train your AI-powered personalized mix.'
      },
      recommendations: {
        madeForYou: candidates.slice(0, 8).map(t => ({ ...t, reason: 'Trending on Loopra' })),
        dailyMix: candidates.slice(2, 7).map(t => ({ ...t, reason: 'Popular Daily Mix' })),
        discover: candidates.slice(7, 13).map(t => ({ ...t, reason: 'Explore new sounds' })),
        becauseYouListenedTo: null,
        favouriteArtists: [],
        moreLikeRecent: []
      }
    };
  },

  /**
   * Intelligent Heuristic Hybrid Recommendation Engine.
   * Runs when Gemini API is unconfigured or temporarily unavailable.
   */
  generateHeuristicRecommendations(userProfile, candidates = []) {
    const skippedSet = new Set(userProfile.skippedTrackIds || []);
    const dislikedSet = new Set(userProfile.dislikedTrackIds || []);
    const favouriteSet = new Set(userProfile.favouriteTrackIds || []);
    const recentTrackIds = new Set((userProfile.recentTracks || []).map(t => t.trackId));

    const topArtistNames = (userProfile.topArtists || []).map(a => a.name.toLowerCase());
    const primaryArtist = topArtistNames[0] || 'Arijit Singh';

    // Filter and score candidates
    const scoredCandidates = [];

    for (const track of candidates) {
      const trackId = track.id || track.videoId;
      if (!trackId || dislikedSet.has(trackId)) continue; // Respect explicit dislikes completely

      let score = 10; // Baseline
      const trackArtist = (track.artist || track.channel || '').toLowerCase();

      // Top artist match (+20)
      if (topArtistNames.some(art => trackArtist.includes(art))) {
        score += 20;
      }

      // Favourites / repeats (+15)
      if (favouriteSet.has(trackId)) {
        score += 15;
      }

      // Penalize heavily skipped tracks (-20)
      if (skippedSet.has(trackId)) {
        score -= 20;
      }

      // Slightly discount tracks played very recently to promote freshness
      if (recentTrackIds.has(trackId)) {
        score -= 5;
      }

      scoredCandidates.push({
        track,
        score
      });
    }

    scoredCandidates.sort((a, b) => b.score - a.score);

    // Diversified selection for madeForYou (max 2 songs per artist)
    const madeForYou = [];
    const artistCounter = {};

    for (const item of scoredCandidates) {
      const art = (item.track.artist || 'various').toLowerCase();
      if ((artistCounter[art] || 0) < 2) {
        artistCounter[art] = (artistCounter[art] || 0) + 1;
        madeForYou.push({
          ...item.track,
          reason: favouriteSet.has(item.track.id)
            ? 'Based on your favourites'
            : topArtistNames.some(a => art.includes(a))
              ? `Because you love ${item.track.artist}`
              : 'Matches your listening vibe',
          source: 'hybrid'
        });
      }
      if (madeForYou.length >= 8) break;
    }

    // Daily Mix: smooth blend of familiar hits
    const dailyMix = scoredCandidates
      .filter(item => !madeForYou.some(m => m.id === item.track.id))
      .slice(0, 6)
      .map(item => ({
        ...item.track,
        reason: 'Curated for your daily listening',
        source: 'hybrid'
      }));

    // Discover: novel tracks from adjacent sounds not yet played
    const discover = candidates
      .filter(t => !recentTrackIds.has(t.id) && !favouriteSet.has(t.id) && !madeForYou.some(m => m.id === t.id))
      .slice(0, 6)
      .map(t => ({
        ...t,
        reason: 'Fresh discovery picked for you',
        source: 'discovery'
      }));

    // Because You Listened To:
    const recentBase = userProfile.recentTracks?.[0] || null;
    const relatedToRecent = recentBase
      ? candidates.filter(t => t.id !== recentBase.trackId).slice(0, 4).map(t => ({
          ...t,
          reason: `Inspired by "${recentBase.title}"`,
          source: 'hybrid'
        }))
      : [];

    return {
      source: 'catalog_fallback',
      insights: {
        dominantMood: 'Melodic & Nostalgic',
        topGenres: ['Bollywood Melodies', 'Desi Lounge'],
        summary: `Crafted around your affinity for ${primaryArtist} and curated favorites.`
      },
      recommendations: {
        madeForYou: madeForYou.length > 0 ? madeForYou : candidates.slice(0, 6),
        dailyMix: dailyMix.length > 0 ? dailyMix : candidates.slice(3, 8),
        discover: discover.length > 0 ? discover : candidates.slice(6, 12),
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
        favouriteArtists: madeForYou.filter(m => topArtistNames.some(a => (m.artist || '').toLowerCase().includes(a))),
        moreLikeRecent: relatedToRecent
      }
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
