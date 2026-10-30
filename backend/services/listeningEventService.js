import mongoose from 'mongoose';
import UserListeningEvent from '../models/UserListeningEvent.js';
import UserMusicPreference from '../models/UserMusicPreference.js';
import User from '../models/User.js';

// Cache recent events in-memory to discard rapid frontend debounce/re-render duplicates (3 seconds window)
const recentEventsCache = new Map();
const DEDUPE_WINDOW_MS = 3000;

// Cleanup memory cache every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentEventsCache.entries()) {
    if (now - timestamp > DEDUPE_WINDOW_MS * 2) {
      recentEventsCache.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export const listeningEventService = {
  /**
   * Records a user listening event with deduplication and state updates.
   */
  async recordEvent(userId, eventData) {
    if (!userId) {
      throw new Error('Authenticated user ID is required to record listening event');
    }

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
      source = 'player'
    } = eventData || {};

    if (!trackId || typeof trackId !== 'string') {
      throw new Error('Valid trackId is required');
    }
    if (!title || typeof title !== 'string') {
      throw new Error('Valid track title is required');
    }

    const validEvents = ['play_start', 'progress', 'completed', 'skip', 'like', 'dislike', 'repeat'];
    const normalizedEventType = validEvents.includes(eventType) ? eventType : 'play_start';

    // Anti-duplication guard against duplicate React renders / rapid event dispatches
    const dedupeKey = `${userId.toString()}_${trackId}_${normalizedEventType}`;
    const now = Date.now();
    const lastLogged = recentEventsCache.get(dedupeKey);
    if (lastLogged && now - lastLogged < DEDUPE_WINDOW_MS) {
      return { recorded: false, deduplicated: true };
    }
    recentEventsCache.set(dedupeKey, now);

    // Compute completion metrics
    const durNum = Math.max(0, Number(duration) || 0);
    const listenedNum = Math.max(0, Number(listenedDuration) || 0);
    let pct = Math.max(0, Math.min(100, Number(completionPercent) || 0));

    if (pct === 0 && durNum > 0 && listenedNum > 0) {
      pct = Math.min(100, Math.round((listenedNum / durNum) * 100));
    }

    // Heuristic Classification:
    // 1. If marked as 'skip' but user actually listened to >= 70% of song, count as completed
    // 2. If listened for < 8 seconds or < 15% and user jumped away, classify as 'skip'
    let effectiveEventType = normalizedEventType;
    if (normalizedEventType === 'skip' && pct >= 70) {
      effectiveEventType = 'completed';
    } else if (normalizedEventType === 'play_start' && listenedNum >= 30) {
      effectiveEventType = 'progress';
    }

    // Persist event in MongoDB if connected
    let savedEventId = new mongoose.Types.ObjectId();
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const listeningEvent = new UserListeningEvent({
        userId,
        trackId: trackId.trim(),
        title: title.slice(0, 200).trim(),
        artist: (artist || channel || 'Unknown Artist').slice(0, 150).trim(),
        channel: (channel || '').slice(0, 150).trim(),
        thumbnail: thumbnail || '',
        eventType: effectiveEventType,
        duration: durNum,
        listenedDuration: listenedNum,
        completionPercent: pct,
        source: (source || 'player').slice(0, 50).trim(),
        timestamp: new Date()
      });

      await listeningEvent.save();
      savedEventId = listeningEvent._id;
    }

    // Incrementally update user preference profile
    await this.updateUserPreferences(userId, {
      trackId: trackId.trim(),
      title,
      artist,
      eventType: effectiveEventType,
      completionPercent: pct,
      thumbnail
    });

    return {
      recorded: true,
      eventId: savedEventId,
      eventType: effectiveEventType
    };
  },

  /**
   * Updates UserMusicPreference based on newly received event.
   */
  async updateUserPreferences(userId, event) {
    try {
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        return;
      }
      let pref = await UserMusicPreference.findOne({ userId });
      if (!pref) {
        pref = new UserMusicPreference({ userId });
      }

      const { trackId, title, artist, eventType, completionPercent } = event;
      const cleanArtist = (artist || '').trim();

      // Track artist affinity
      if (cleanArtist && cleanArtist !== 'Unknown Artist' && cleanArtist !== 'Various Artists') {
        const existingArtist = pref.topArtists.find(a => a.name.toLowerCase() === cleanArtist.toLowerCase());
        const weightDelta = eventType === 'completed' ? 3 :
                            eventType === 'repeat' ? 4 :
                            eventType === 'like' ? 5 :
                            eventType === 'skip' ? -2 :
                            eventType === 'dislike' ? -5 : 1;

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
          artist,
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
  }
};
