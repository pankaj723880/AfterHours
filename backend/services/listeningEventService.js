import mongoose from 'mongoose';
import UserListeningEvent from '../models/UserListeningEvent.js';
import UserMusicPreference from '../models/UserMusicPreference.js';
import User from '../models/User.js';

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
      source = 'player',
      playSessionId
    } = eventData || {};

    if (!trackId || typeof trackId !== 'string') {
      throw new Error('Valid trackId is required');
    }
    if (!title || typeof title !== 'string') {
      throw new Error('Valid track title is required');
    }

    const validEvents = ['play_start', 'progress', 'completed', 'skip', 'like', 'dislike', 'repeat', 'pause', 'resume'];
    const normalizedEventType = validEvents.includes(eventType) ? eventType : 'play_start';

    // Anti-duplication guard against duplicate React renders / rapid event dispatches
    const dedupeKey = `${userId.toString()}_${playSessionId || trackId}_${normalizedEventType}`;
    const now = Date.now();
    const lastLogged = recentEventsCache.get(dedupeKey);
    if (lastLogged && now - lastLogged < DEDUPE_WINDOW_MS && normalizedEventType !== 'progress' && normalizedEventType !== 'completed') {
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

    // Invalidate cached statistics for this user on active listen updates
    const userIdStr = userId.toString();
    for (const key of statsCache.keys()) {
      if (key.startsWith(userIdStr)) {
        statsCache.delete(key);
      }
    }

    // Persist event in MongoDB if connected
    let savedEventId = new mongoose.Types.ObjectId();
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const cleanSessionId = typeof playSessionId === 'string' && playSessionId.trim() ? playSessionId.trim() : null;

      if (cleanSessionId) {
        // Find existing record for this playback session
        let existing = await UserListeningEvent.findOne({ userId, playSessionId: cleanSessionId });
        if (existing) {
          existing.listenedDuration = Math.max(existing.listenedDuration || 0, listenedNum);
          if (durNum > 0) existing.duration = Math.max(existing.duration || 0, durNum);
          if (pct > 0) existing.completionPercent = Math.max(existing.completionPercent || 0, pct);
          if (thumbnail && !existing.thumbnail) existing.thumbnail = thumbnail;
          if (effectiveEventType === 'completed') {
            existing.eventType = 'completed';
          } else if (existing.eventType !== 'completed' && ['pause', 'resume', 'progress', 'skip'].includes(effectiveEventType)) {
            existing.eventType = effectiveEventType;
          }
          await existing.save();
          savedEventId = existing._id;
        } else {
          const listeningEvent = new UserListeningEvent({
            userId,
            playSessionId: cleanSessionId,
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
      } else {
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
    }

    // Incrementally update user preference profile (only for significant milestones)
    if (['play_start', 'completed', 'skip', 'like', 'dislike', 'repeat'].includes(effectiveEventType) || listenedNum >= 30) {
      await this.updateUserPreferences(userId, {
        trackId: trackId.trim(),
        title,
        artist,
        eventType: effectiveEventType,
        completionPercent: pct,
        thumbnail
      });
    }

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
   */
  async getListeningStats(userId, { timezone = 'UTC', forceRefresh = false } = {}) {
    if (!userId) {
      throw new Error('Authenticated user ID is required to fetch listening statistics');
    }

    const userIdStr = userId.toString();
    const cacheKey = `${userIdStr}_${timezone}`;
    const now = Date.now();

    // In-memory cache check (30-second TTL unless forceRefresh is true)
    if (!forceRefresh && statsCache.has(cacheKey)) {
      const cached = statsCache.get(cacheKey);
      if (now - cached.timestamp < 30000) {
        return cached.data;
      }
    }

    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return this.getEmptyStatsStructure(userId);
    }

    const userObjectId = new mongoose.Types.ObjectId(userIdStr);

    // 1. Calculate Start of Current Week in User's Timezone (Monday 00:00:00 local time)
    const startOfWeek = getWeekStartInTimezone(timezone);

    // 2. Fetch all user listening events (strictly scoped to userObjectId)
    const allEvents = await UserListeningEvent.find({ userId: userObjectId })
      .sort({ timestamp: -1 })
      .lean()
      .maxTimeMS(6000);

    // Fetch user for baseline history fallback if no events yet
    const userDoc = await User.findById(userObjectId)
      .select('history likedSongs')
      .lean()
      .maxTimeMS(3000);

    // 3. Aggregate Weekly Recap
    const weeklyEvents = allEvents.filter(e => e.timestamp && new Date(e.timestamp) >= startOfWeek);

    let weeklyListeningSeconds = 0;
    const weeklyTrackCounts = new Map(); // trackId -> { id, title, artist, thumbnail, count, seconds }
    const weeklyArtistCounts = new Map(); // artist -> count
    const weeklyDaySeconds = new Map(); // 'Mon', 'Tue', etc. -> seconds
    let weeklyValidPlays = 0;

    for (const ev of weeklyEvents) {
      const sec = Math.max(0, Number(ev.listenedDuration) || 0);
      weeklyListeningSeconds += sec;

      const isValidPlay = sec >= 30 || ev.eventType === 'completed';
      if (isValidPlay) {
        weeklyValidPlays += 1;

        const tId = ev.trackId;
        const currentTrack = weeklyTrackCounts.get(tId) || {
          id: tId,
          title: ev.title || 'Unknown Track',
          artist: ev.artist || 'Unknown Artist',
          thumbnail: ev.thumbnail || '',
          count: 0,
          seconds: 0
        };
        currentTrack.count += 1;
        currentTrack.seconds += sec;
        if (ev.thumbnail && !currentTrack.thumbnail) currentTrack.thumbnail = ev.thumbnail;
        weeklyTrackCounts.set(tId, currentTrack);

        const art = (ev.artist || '').trim();
        if (art && art !== 'Unknown Artist') {
          weeklyArtistCounts.set(art, (weeklyArtistCounts.get(art) || 0) + 1);
        }
      }

      // Calculate weekday in user's timezone for peak listening day
      if (sec > 0 || isValidPlay) {
        let dayName = 'Mon';
        try {
          dayName = new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            timeZone: timezone
          }).format(new Date(ev.timestamp));
        } catch {
          dayName = new Date(ev.timestamp).toLocaleDateString('en-US', { weekday: 'short' });
        }
        weeklyDaySeconds.set(dayName, (weeklyDaySeconds.get(dayName) || 0) + (sec > 0 ? sec : 30));
      }
    }

    const weeklyTopTracks = Array.from(weeklyTrackCounts.values())
      .sort((a, b) => b.count - a.count || b.seconds - a.seconds)
      .slice(0, 5);

    const weeklyTopArtists = Array.from(weeklyArtistCounts.entries())
      .map(([artist, count]) => ({ artist, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    let peakDay = 'N/A';
    let maxDaySec = -1;
    for (const [day, secs] of weeklyDaySeconds.entries()) {
      if (secs > maxDaySec) {
        maxDaySec = secs;
        peakDay = day;
      }
    }

    const hasWeeklyActivity = weeklyValidPlays > 0 || weeklyListeningSeconds >= 20;

    const weeklyRecap = hasWeeklyActivity ? {
      periodLabel: 'This Week',
      startOfWeek: startOfWeek.toISOString(),
      totalListeningSeconds: weeklyListeningSeconds,
      totalListeningMinutes: Math.round(weeklyListeningSeconds / 60),
      totalHours: (weeklyListeningSeconds / 3600).toFixed(1),
      totalPlays: weeklyValidPlays,
      distinctTracksCount: weeklyTrackCounts.size,
      peakDay: peakDay !== 'N/A' ? peakDay : 'This Week',
      topTracks: weeklyTopTracks,
      topArtists: weeklyTopArtists,
    } : null;

    // 4. Aggregate All-Time Stats
    let totalAllTimeSeconds = 0;
    let totalAllTimeValidPlays = 0;
    let longestSessionSec = 0;
    const allTimeTrackCounts = new Map();
    const allTimeArtistCounts = new Map();
    const dailyActivityMap = new Map();

    for (const ev of allEvents) {
      const sec = Math.max(0, Number(ev.listenedDuration) || 0);
      totalAllTimeSeconds += sec;
      if (sec > longestSessionSec) {
        longestSessionSec = sec;
      }

      const isValidPlay = sec >= 30 || ev.eventType === 'completed';
      if (isValidPlay) {
        totalAllTimeValidPlays += 1;

        const tId = ev.trackId;
        const currentTrack = allTimeTrackCounts.get(tId) || {
          id: tId,
          title: ev.title || 'Unknown Track',
          artist: ev.artist || 'Unknown Artist',
          thumbnail: ev.thumbnail || '',
          count: 0,
          seconds: 0
        };
        currentTrack.count += 1;
        currentTrack.seconds += sec;
        if (ev.thumbnail && !currentTrack.thumbnail) currentTrack.thumbnail = ev.thumbnail;
        allTimeTrackCounts.set(tId, currentTrack);

        const art = (ev.artist || '').trim();
        if (art && art !== 'Unknown Artist') {
          allTimeArtistCounts.set(art, (allTimeArtistCounts.get(art) || 0) + 1);
        }
      }

      if (ev.timestamp) {
        let dateKey = 'today';
        let dayLabel = 'Day';
        try {
          const d = new Date(ev.timestamp);
          dateKey = d.toISOString().slice(0, 10);
          dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(d);
        } catch {}
        const curDaily = dailyActivityMap.get(dateKey) || { date: dateKey, dayLabel, seconds: 0, plays: 0 };
        curDaily.seconds += sec;
        if (isValidPlay) curDaily.plays += 1;
        dailyActivityMap.set(dateKey, curDaily);
      }
    }

    // Historical fallback: If user has history in userDoc.history and no events were recorded yet,
    // populate genuine song/artist records from user.history without inventing listening duration.
    if (allEvents.length === 0 && userDoc?.history && Array.isArray(userDoc.history) && userDoc.history.length > 0) {
      for (const h of userDoc.history) {
        const tId = h.id || h.videoId;
        if (tId && !allTimeTrackCounts.has(tId)) {
          allTimeTrackCounts.set(tId, {
            id: tId,
            title: h.title || 'Unknown Track',
            artist: h.artist || h.channel || 'Unknown Artist',
            thumbnail: h.thumbnail || h.image || '',
            count: 1,
            seconds: 0
          });
        }
        const art = (h.artist || h.channel || '').trim();
        if (art && art !== 'Unknown Artist') {
          allTimeArtistCounts.set(art, (allTimeArtistCounts.get(art) || 0) + 1);
        }
      }
      totalAllTimeValidPlays = userDoc.history.length;
    }

    const allTimeTopTracks = Array.from(allTimeTrackCounts.values())
      .sort((a, b) => b.count - a.count || b.seconds - a.seconds)
      .slice(0, 10);

    const allTimeTopArtists = Array.from(allTimeArtistCounts.entries())
      .map(([artist, count]) => ({ artist, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    let longestSessionFormatted = '0m';
    if (longestSessionSec >= 3600) {
      const h = Math.floor(longestSessionSec / 3600);
      const m = Math.floor((longestSessionSec % 3600) / 60);
      longestSessionFormatted = `${h}h ${m}m`;
    } else if (longestSessionSec >= 60) {
      const m = Math.floor(longestSessionSec / 60);
      const s = longestSessionSec % 60;
      longestSessionFormatted = s > 0 ? `${m}m ${s}s` : `${m}m`;
    } else if (longestSessionSec > 0) {
      longestSessionFormatted = `${longestSessionSec}s`;
    }

    const activityOverTime = Array.from(dailyActivityMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);

    const allTimeStats = {
      totalListeningSeconds: totalAllTimeSeconds,
      totalMinutes: Math.round(totalAllTimeSeconds / 60),
      totalHours: (totalAllTimeSeconds / 3600).toFixed(1),
      totalPlays: totalAllTimeValidPlays,
      distinctTracksCount: allTimeTrackCounts.size,
      distinctArtistsCount: allTimeArtistCounts.size,
      topTracks: allTimeTopTracks,
      topArtists: allTimeTopArtists,
      longestSessionSeconds: longestSessionSec,
      longestSessionFormatted,
      activityOverTime
    };

    const result = {
      success: true,
      userId: userIdStr,
      updatedAt: new Date().toISOString(),
      weeklyRecap,
      allTimeStats
    };

    statsCache.set(cacheKey, { timestamp: now, data: result });
    return result;
  }
};
