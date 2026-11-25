import mongoose from 'mongoose';
import UserListeningEvent from '../models/UserListeningEvent.js';
import UserMusicPreference from '../models/UserMusicPreference.js';
import User from '../models/User.js';
import { analyticsService } from './analyticsService.js';
import { personalizedFeedService, detectTrackLanguage, parseDurationSec } from './personalizedFeedService.js';

// Cache recent events in-memory to discard rapid frontend debounce/re-render duplicates (3 seconds window)
const recentEventsCache = new Map();
const DEDUPE_WINDOW_MS = 3000;

// In-memory cache for computed listening statistics (30 seconds TTL)
const statsCache = new Map();

// Cleanup memory caches periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentEventsCache.entries()) {
    if (now - timestamp > DEDUPE_WINDOW_MS * 2) {
      recentEventsCache.delete(key);
    }
  }
  for (const [key, entry] of statsCache.entries()) {
    if (now - entry.timestamp > 60000) {
      statsCache.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Calculates start of the current week (Monday 00:00:00 local time) in the user's timezone.
 */
export function getWeekStartInTimezone(timezone = 'UTC') {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const p = {};
    for (const part of parts) {
      p[part.type] = part.value;
    }
    
    const localNow = new Date(Date.UTC(
      parseInt(p.year, 10),
      parseInt(p.month, 10) - 1,
      parseInt(p.day, 10),
      parseInt(p.hour, 10) % 24,
      parseInt(p.minute, 10),
      parseInt(p.second, 10)
    ));
    
    const offsetMs = localNow.getTime() - now.getTime();
    const localDay = (localNow.getUTCDay() + 6) % 7; // Monday = 0, Sunday = 6
    const startOfWeekLocalMs = Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate() - localDay,
      0, 0, 0, 0
    );
    
    return new Date(startOfWeekLocalMs - offsetMs);
  } catch (e) {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

export const listeningEventService = {
  /**
   * Records a user or guest listening event with deduplication and state updates.
   * Delegates to analyticsService for authenticated users and updates listening profiles for all.
   */
  async recordEvent(userIdentifier, eventData) {
    const {
      trackId,
      title,
      artist,
      channel,
      thumbnail,
      eventType = 'play_start',
      duration = 0,
      listenedDuration = 0,
      completionPercent = 0,
      source = 'player',
      playSessionId,
      guestId = null,
      language = null
    } = eventData || {};

    let userId = null;
    let effectiveGuestId = guestId;

    if (userIdentifier && typeof userIdentifier === 'object') {
      userId = userIdentifier.userId || userIdentifier._id || null;
      effectiveGuestId = userIdentifier.guestId || effectiveGuestId;
    } else if (typeof userIdentifier === 'string') {
      if (mongoose.Types.ObjectId.isValid(userIdentifier) && userIdentifier.length === 24) {
        userId = userIdentifier;
      } else {
        effectiveGuestId = userIdentifier;
      }
    }

    if (!userId && !effectiveGuestId) {
      return { recorded: false, skipped: true, reason: 'No user or guest identifier' };
    }

    const dedupeIdentifier = userId ? userId.toString() : effectiveGuestId;
    const dedupeKey = `${dedupeIdentifier}_${trackId}_${eventType}_${listenedDuration}`;
    const now = Date.now();
    const lastTime = recentEventsCache.get(dedupeKey);
    if (lastTime && (now - lastTime < DEDUPE_WINDOW_MS)) {
      return { recorded: false, deduplicated: true };
    }
    recentEventsCache.set(dedupeKey, now);

    // Upsert into shared CachedSong collection asynchronously (quota preservation)
    setImmediate(async () => {
      try {
        await personalizedFeedService.upsertSong({
          videoId: trackId,
          title,
          artist: artist || channel,
          channel: channel || artist,
          thumbnail,
          durationSec: duration,
          language: language || detectTrackLanguage(title, artist)
        });
      } catch (_) {}
    });

    // Update UserMusicPreference for authenticated or guest user
    setImmediate(async () => {
      try {
        await this.updateUserPreferences({ userId, guestId: effectiveGuestId }, {
          trackId,
          title,
          artist: artist || channel,
          thumbnail,
          eventType,
          completionPercent,
          language
        });
      } catch (_) {}
    });

    // If authenticated user, record in analytics service
    if (userId) {
      return analyticsService.recordPlaybackEvent(userId, {
        sessionId: playSessionId,
        trackId,
        songTitle: title,
        artistName: artist || channel,
        artworkUrl: thumbnail,
        eventType,
        durationSeconds: duration,
        listenedDurationSeconds: listenedDuration,
        completionPercent,
        source
      });
    }

    return {
      recorded: true,
      guest: true,
      trackId,
      eventType
    };
  },

  /**
   * Updates UserMusicPreference based on newly received event (supporting both userId and guestId).
   */
  async updateUserPreferences(identifier, event) {
    try {
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        return;
      }

      const query = {};
      if (identifier?.userId) {
        query.userId = identifier.userId;
      } else if (identifier?.guestId) {
        query.guestId = identifier.guestId;
      } else {
        return;
      }

      let pref = await UserMusicPreference.findOne(query);
      if (!pref) {
        pref = new UserMusicPreference(query);
      }

      const { trackId, title, artist, eventType, completionPercent, language, genre, mood, isQuickSkip } = event;
      const cleanArtist = (artist || '').trim();

      // Track artist affinity
      if (cleanArtist && cleanArtist !== 'Unknown Artist' && cleanArtist !== 'Various Artists') {
        const existingArtist = pref.topArtists.find(a => a.name.toLowerCase() === cleanArtist.toLowerCase());
        // Quick skip penalty is harsher (-4) than standard skip (-2); likes (+5), playlist adds (+5), completed (+3)
        const weightDelta = eventType === 'like' ? 5 :
                            eventType === 'playlist_add' ? 5 :
                            eventType === 'repeat' ? 4 :
                            eventType === 'completed' ? 3 :
                            eventType === 'search_pick' ? 3 :
                            eventType === 'chip_pick' ? 3 :
                            eventType === 'dislike' ? -5 :
                            eventType === 'skip' ? (isQuickSkip ? -4 : -2) : 1;

        if (existingArtist) {
          if (eventType === 'play_start') existingArtist.playCount += 1;
          if (eventType === 'completed') existingArtist.completedCount += 1;
          if (eventType === 'skip') existingArtist.skipCount += 1;
          existingArtist.score = Math.max(0, existingArtist.score + weightDelta);
        } else {
          pref.topArtists.push({
            name: cleanArtist,
            playCount: eventType === 'play_start' ? 1 : 0,
            completedCount: eventType === 'completed' ? 1 : 0,
            skipCount: eventType === 'skip' ? 1 : 0,
            score: Math.max(1, weightDelta)
          });
        }

        // Sort top artists descending by affinity score and keep top 25
        pref.topArtists.sort((a, b) => b.score - a.score);
        pref.topArtists = pref.topArtists.slice(0, 25);
      }

      // Track genre affinity (chip picks, search picks, or track metadata)
      const targetGenre = genre || (title && /lo-?fi/i.test(title) ? 'Lo-Fi' : null);
      if (targetGenre) {
        if (!pref.topGenres) pref.topGenres = [];
        const existingGenre = pref.topGenres.find(g => g.name.toLowerCase() === targetGenre.toLowerCase());
        const genreDelta = (eventType === 'like' || eventType === 'chip_pick') ? 4 : (eventType === 'completed' ? 2 : 1);
        if (existingGenre) {
          existingGenre.score += genreDelta;
        } else {
          pref.topGenres.push({ name: targetGenre, score: genreDelta });
        }
        pref.topGenres.sort((a, b) => b.score - a.score);
        pref.topGenres = pref.topGenres.slice(0, 10);
      }

      // Track mood affinity
      if (mood) {
        if (!pref.topMoods) pref.topMoods = [];
        const existingMood = pref.topMoods.find(m => m.name.toLowerCase() === mood.toLowerCase());
        const moodDelta = eventType === 'chip_pick' ? 5 : 2;
        if (existingMood) {
          existingMood.score += moodDelta;
        } else {
          pref.topMoods.push({ name: mood, score: moodDelta });
        }
        pref.topMoods.sort((a, b) => b.score - a.score);
        pref.topMoods = pref.topMoods.slice(0, 10);
      }

      // Track language affinity
      const trackLang = language || detectTrackLanguage(title, cleanArtist);
      if (trackLang) {
        if (!pref.preferredLanguages) pref.preferredLanguages = [];
        const existingLang = pref.preferredLanguages.find(l => l.name.toLowerCase() === trackLang.toLowerCase());
        const langDelta = eventType === 'like' ? 3 : (eventType === 'completed' ? 2 : 1);
        if (existingLang) {
          existingLang.score += langDelta;
        } else {
          pref.preferredLanguages.push({ name: trackLang, score: langDelta });
        }
        pref.preferredLanguages.sort((a, b) => b.score - a.score);
        pref.preferredLanguages = pref.preferredLanguages.slice(0, 5);
      }

      // Track counts
      if (eventType === 'play_start') pref.totalPlays += 1;
      if (eventType === 'completed') pref.totalCompletedListens += 1;
      if (eventType === 'skip') pref.totalSkips += 1;

      // Track favorites and dislikes
      if (eventType === 'like') {
        if (!pref.favouriteTrackIds.includes(trackId)) {
          pref.favouriteTrackIds.push(trackId);
        }
        pref.dislikedTrackIds = pref.dislikedTrackIds.filter(id => id !== trackId);
      } else if (eventType === 'dislike') {
        if (!pref.dislikedTrackIds.includes(trackId)) {
          pref.dislikedTrackIds.push(trackId);
        }
        pref.favouriteTrackIds = pref.favouriteTrackIds.filter(id => id !== trackId);
      }

      if (eventType === 'skip' && !pref.skippedTrackIds.includes(trackId)) {
        pref.skippedTrackIds.push(trackId);
        if (pref.skippedTrackIds.length > 100) {
          pref.skippedTrackIds = pref.skippedTrackIds.slice(-100);
        }
      }

      // Update recent tracks list (keep latest 30)
      if (eventType === 'play_start' || eventType === 'completed') {
        const filteredRecent = pref.recentTracks.filter(t => t.trackId !== trackId);
        filteredRecent.unshift({
          trackId,
          title,
          artist: cleanArtist,
          thumbnail: event.thumbnail,
          listenedAt: new Date(),
          completed: completionPercent >= 50 || eventType === 'completed'
        });
        pref.recentTracks = filteredRecent.slice(0, 30);
      }

      pref.lastCalculatedAt = new Date();
      await pref.save();
    } catch (err) {
      console.warn('[ListeningEventService] Preference update notice:', err.message);
    }
  },

  /**
   * Aggregates and returns a comprehensive, privacy-safe listening profile for recommendations.
   */
  async getUserProfile(userId) {
    let pref = null;
    let user = null;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      pref = await UserMusicPreference.findOne({ userId }).lean().maxTimeMS(2000);
      user = await User.findById(userId).select('likedSongs history').lean().maxTimeMS(2000);
    }

    const likedTrackIds = (user?.likedSongs || []).map(s => s.id || s.videoId).filter(Boolean);
    const historyTracks = (user?.history || []).map(s => ({
      trackId: s.id || s.videoId,
      title: s.title,
      artist: s.artist || s.channel,
      thumbnail: s.thumbnail || s.image
    })).filter(t => t.trackId);

    if (!pref) {
      // Build initial baseline profile from existing User likedSongs & history
      const artistCounts = {};
      for (const song of [...(user?.likedSongs || []), ...(user?.history || [])]) {
        const art = (song.artist || song.channel || '').trim();
        if (art && art !== 'Unknown Artist') {
          artistCounts[art] = (artistCounts[art] || 0) + 1;
        }
      }

      const topArtists = Object.entries(artistCounts)
        .map(([name, count]) => ({ name, playCount: count, score: count * 2 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 15);

      return {
        userId,
        topArtists,
        topGenres: [{ name: 'Bollywood Hits', score: 10 }, { name: 'Desi Melodies', score: 8 }],
        topMoods: [{ name: 'Romantic & Chill', score: 10 }],
        favouriteTrackIds: likedTrackIds,
        skippedTrackIds: [],
        dislikedTrackIds: [],
        recentTracks: historyTracks.slice(0, 15),
        totalPlays: historyTracks.length,
        totalCompletedListens: Math.round(historyTracks.length * 0.7),
        recommendationsEnabled: true,
        isNewUser: likedTrackIds.length === 0 && historyTracks.length === 0
      };
    }

    // Merge in any newly liked tracks from user model
    const mergedFavourites = Array.from(new Set([...(pref.favouriteTrackIds || []), ...likedTrackIds]));

    return {
      userId,
      topArtists: pref.topArtists || [],
      topGenres: pref.topGenres && pref.topGenres.length > 0
        ? pref.topGenres
        : [{ name: 'Romantic Melodies', score: 10 }, { name: 'Retro & Modern Bollywood', score: 8 }],
      topMoods: pref.topMoods && pref.topMoods.length > 0
        ? pref.topMoods
        : [{ name: 'Melodic Vibe', score: 10 }],
      favouriteTrackIds: mergedFavourites,
      skippedTrackIds: pref.skippedTrackIds || [],
      dislikedTrackIds: pref.dislikedTrackIds || [],
      repeatTrackIds: pref.repeatTrackIds || [],
      recentTracks: pref.recentTracks && pref.recentTracks.length > 0 ? pref.recentTracks : historyTracks.slice(0, 15),
      totalPlays: pref.totalPlays || historyTracks.length,
      totalCompletedListens: pref.totalCompletedListens || Math.round(historyTracks.length * 0.7),
      recommendationsEnabled: pref.recommendationsEnabled !== false,
      isNewUser: (pref.totalPlays === 0 && historyTracks.length === 0 && likedTrackIds.length === 0)
    };
  },

  /**
   * Returns empty baseline statistics structure for cold-start or disconnected database.
   */
  getEmptyStatsStructure(userId = null) {
    return {
      success: true,
      userId: userId ? userId.toString() : null,
      updatedAt: new Date().toISOString(),
      weeklyRecap: null,
      allTimeStats: {
        totalListeningSeconds: 0,
        totalMinutes: 0,
        totalHours: '0.0',
        totalPlays: 0,
        distinctTracksCount: 0,
        distinctArtistsCount: 0,
        topTracks: [],
        topArtists: [],
        longestSessionSeconds: 0,
        longestSessionFormatted: '0m',
        activityOverTime: []
      }
    };
  },

  /**
   * Computes genuine Weekly Recap and All-Time Listening Statistics for an authenticated user.
   * Delegates to centralized analyticsService.
   */
  async getListeningStats(userId, options = {}) {
    if (!userId) {
      throw new Error('Authenticated user ID is required to fetch listening statistics');
    }
    return analyticsService.getUnifiedOverview(userId, options);
  },
};
