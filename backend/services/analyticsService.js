import mongoose from 'mongoose';
import UserPlaybackEvent from '../models/UserPlaybackEvent.js';
import UserListeningEvent from '../models/UserListeningEvent.js';
import UserListeningSession from '../models/UserListeningSession.js';
import WebsiteUsageSession from '../models/WebsiteUsageSession.js';
import UserMusicPreference from '../models/UserMusicPreference.js';
import User from '../models/User.js';

// In-memory cache for aggregated analytics responses (30 seconds TTL)
const analyticsCache = new Map();
const CACHE_TTL_MS = 30 * 1000;

// Anti-spam debounce cache for playback events
const recentPlaybackEvents = new Map();
const DEBOUNCE_WINDOW_MS = 2000;

// Website heartbeat tracking to prevent multiple tabs inflating user time
const userHeartbeatTracker = new Map(); // userId -> { lastHeartbeatMs, lastSessionId }

// Cleanup memory caches periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of analyticsCache.entries()) {
    if (now - v.timestamp > CACHE_TTL_MS * 2) analyticsCache.delete(k);
  }
  for (const [k, ts] of recentPlaybackEvents.entries()) {
    if (now - ts > DEBOUNCE_WINDOW_MS * 2) recentPlaybackEvents.delete(k);
  }
  for (const [uid, track] of userHeartbeatTracker.entries()) {
    if (now - track.lastHeartbeatMs > 10 * 60 * 1000) userHeartbeatTracker.delete(uid);
  }
}, 5 * 60 * 1000).unref();

/**
 * Calculates start of the current week (Monday 00:00:00 local time) in user's timezone.
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

/**
 * Validates whether an event qualifies as a valid music play.
 * Rule: At least 30 seconds of genuine listening, OR marked completed, OR listened to >= 50% of track.
 */
export function isValidMusicPlay(listenedSec = 0, totalDurSec = 0, completed = false) {
  if (completed) return true;
  if (listenedSec >= 30) return true;
  if (totalDurSec > 0 && listenedSec >= 15 && (listenedSec / totalDurSec) >= 0.5) return true;
  return false;
}

export const analyticsService = {
  /**
   * Clears cached analytics for a user (called when new playback or session events are recorded)
   */
  invalidateUserCache(userId) {
    if (!userId) return;
    const uidStr = userId.toString();
    for (const key of analyticsCache.keys()) {
      if (key.startsWith(uidStr)) {
        analyticsCache.delete(key);
      }
    }
  },

  /**
   * Records genuine playback events into UserPlaybackEvent, UserListeningSession, and legacy UserListeningEvent.
   */
  async recordPlaybackEvent(userId, eventData = {}) {
    if (!userId) {
      throw new Error('Authenticated user ID is required to record playback event');
    }

    const {
      sessionId,
      trackId,
      videoId,
      songTitle,
      title,
      artistName,
      artist,
      albumName,
      album,
      artworkUrl,
      thumbnail,
      source = 'player',
      eventType = 'play_start',
      durationSeconds = 0,
      duration = 0,
      listenedDurationSeconds = 0,
      listenedDuration = 0,
      playbackPositionSeconds = 0,
      completionPercent = 0,
      completed = false,
      deviceType = 'desktop',
      platform = 'web'
    } = eventData;

    const cleanTrackId = (trackId || videoId || '').trim();
    const cleanTitle = (songTitle || title || '').trim();
    if (!cleanTrackId || !cleanTitle) {
      throw new Error('trackId and song title are required');
    }

    const cleanArtist = (artistName || artist || 'Unknown Artist').trim();
    const cleanAlbum = (albumName || album || '').trim();
    const cleanArtwork = (artworkUrl || thumbnail || '').trim();
    const cleanVideoId = (videoId || cleanTrackId).trim();
    const cleanSessionId = (sessionId || `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`).trim();

    const durSec = Math.max(0, Number(durationSeconds || duration) || 0);
    const listenedSec = Math.max(0, Number(listenedDurationSeconds || listenedDuration) || 0);
    const posSec = Math.max(0, Number(playbackPositionSeconds) || 0);

    let compPct = Math.max(0, Math.min(100, Number(completionPercent) || 0));
    if (compPct === 0 && durSec > 0 && listenedSec > 0) {
      compPct = Math.min(100, Math.round((listenedSec / durSec) * 100));
    }

    const isCompleted = completed === true || compPct >= 95 || eventType === 'completed';
    const now = new Date();

    // Debounce rapid duplicate events (ignore exact same event within window unless listened duration advanced)
    const dedupeKey = `${userId.toString()}_${cleanSessionId}_${eventType}`;
    const lastRecord = recentPlaybackEvents.get(dedupeKey);
    if (lastRecord && (now.getTime() - lastRecord.timestamp) < 1000 && eventType !== 'completed') {
      if (Math.abs(lastRecord.listenedSec - listenedSec) < 2) {
        return { recorded: false, deduplicated: true, sessionId: cleanSessionId };
      }
    }
    recentPlaybackEvents.set(dedupeKey, { timestamp: now.getTime(), listenedSec });

    const userObjectId = new mongoose.Types.ObjectId(userId.toString());

    // Invalidate analytics cache
    this.invalidateUserCache(userObjectId);

    let playbackDoc = null;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      // 1. Upsert into UserPlaybackEvent by (userId, sessionId)
      let existingEvent = await UserPlaybackEvent.findOne({ userId: userObjectId, sessionId: cleanSessionId });

      if (existingEvent) {
        existingEvent.listenedDurationSeconds = Math.max(existingEvent.listenedDurationSeconds || 0, listenedSec);
        if (durSec > 0) existingEvent.durationSeconds = Math.max(existingEvent.durationSeconds || 0, durSec);
        if (posSec > 0) existingEvent.playbackPositionSeconds = posSec;
        if (compPct > 0) existingEvent.completionPercent = Math.max(existingEvent.completionPercent || 0, compPct);
        if (cleanArtwork && !existingEvent.artworkUrl) existingEvent.artworkUrl = cleanArtwork;

        if (isCompleted) {
          existingEvent.completed = true;
          existingEvent.eventType = 'completed';
          existingEvent.endedAt = now;
        } else if (eventType === 'pause') {
          existingEvent.pausedAt = now;
          if (existingEvent.eventType !== 'completed') existingEvent.eventType = 'pause';
        } else if (eventType === 'resume') {
          existingEvent.resumedAt = now;
          if (existingEvent.eventType !== 'completed') existingEvent.eventType = 'resume';
        } else if (eventType === 'skip' || eventType === 'stop') {
          existingEvent.endedAt = now;
          if (existingEvent.eventType !== 'completed') existingEvent.eventType = eventType;
        } else if (existingEvent.eventType !== 'completed' && eventType === 'progress') {
          existingEvent.eventType = 'progress';
        }

        await existingEvent.save();
        playbackDoc = existingEvent;
      } else {
        playbackDoc = new UserPlaybackEvent({
          userId: userObjectId,
          sessionId: cleanSessionId,
          trackId: cleanTrackId,
          videoId: cleanVideoId,
          songTitle: cleanTitle.slice(0, 250),
          artistName: cleanArtist.slice(0, 200),
          albumName: cleanAlbum.slice(0, 200),
          artworkUrl: cleanArtwork,
          source: (source || 'player').slice(0, 60),
          eventType,
          startedAt: now,
          pausedAt: eventType === 'pause' ? now : undefined,
          resumedAt: eventType === 'resume' ? now : undefined,
          endedAt: isCompleted || eventType === 'skip' || eventType === 'stop' ? now : undefined,
          listenedDurationSeconds: listenedSec,
          playbackPositionSeconds: posSec,
          durationSeconds: durSec,
          completionPercent: compPct,
          completed: isCompleted,
          deviceType,
          platform
        });
        await playbackDoc.save();
      }

      // 2. Sync to legacy UserListeningEvent for backward compatibility
      try {
        let legacy = await UserListeningEvent.findOne({ userId: userObjectId, playSessionId: cleanSessionId });
        if (legacy) {
          legacy.listenedDuration = Math.max(legacy.listenedDuration || 0, listenedSec);
          if (durSec > 0) legacy.duration = Math.max(legacy.duration || 0, durSec);
          if (compPct > 0) legacy.completionPercent = Math.max(legacy.completionPercent || 0, compPct);
          if (isCompleted) legacy.eventType = 'completed';
          await legacy.save();
        } else {
          legacy = new UserListeningEvent({
            userId: userObjectId,
            playSessionId: cleanSessionId,
            trackId: cleanTrackId,
            title: cleanTitle.slice(0, 200),
            artist: cleanArtist.slice(0, 150),
            channel: cleanArtist.slice(0, 150),
            thumbnail: cleanArtwork,
            eventType: isCompleted ? 'completed' : eventType,
            duration: durSec,
            listenedDuration: listenedSec,
            completionPercent: compPct,
            source: (source || 'player').slice(0, 50),
            timestamp: now
          });
          await legacy.save();
        }
      } catch (e) {
        // Non-blocking
      }

      // 3. Update UserListeningSession
      try {
        let session = await UserListeningSession.findOne({ userId: userObjectId, sessionId: cleanSessionId });
        const validPlay = isValidMusicPlay(listenedSec, durSec, isCompleted);

        if (session) {
          session.lastActiveAt = now;
          session.activeListeningDurationSeconds = Math.max(session.activeListeningDurationSeconds || 0, listenedSec);
          if (isCompleted) {
            session.status = 'completed';
            session.endedAt = now;
          } else if (eventType === 'pause') {
            session.status = 'paused';
          } else {
            session.status = 'active';
          }
          if (validPlay && session.songsPlayed === 0) {
            session.songsPlayed = 1;
          }
          await session.save();
        } else {
          session = new UserListeningSession({
            userId: userObjectId,
            sessionId: cleanSessionId,
            startedAt: now,
            lastActiveAt: now,
            activeListeningDurationSeconds: listenedSec,
            songsPlayed: validPlay ? 1 : 0,
            tracks: [{
              trackId: cleanTrackId,
              videoId: cleanVideoId,
              title: cleanTitle,
              artist: cleanArtist,
              artworkUrl: cleanArtwork,
              listenedSeconds: listenedSec,
              completed: isCompleted
            }],
            deviceType,
            platform,
            status: isCompleted ? 'completed' : 'active'
          });
          await session.save();
        }
      } catch (e) {
        // Non-blocking
      }

      // 4. Update UserMusicPreference if significant listen
      if (isValidMusicPlay(listenedSec, durSec, isCompleted)) {
        try {
          await this.updateUserPreference(userObjectId, {
            trackId: cleanTrackId,
            title: cleanTitle,
            artist: cleanArtist,
            thumbnail: cleanArtwork,
            completed: isCompleted
          });
        } catch (e) {}
      }
    }

    return {
      recorded: true,
      sessionId: cleanSessionId,
      listenedDurationSeconds: listenedSec,
      completed: isCompleted,
      isValidPlay: isValidMusicPlay(listenedSec, durSec, isCompleted)
    };
  },

  /**
   * Tracks user active website presence with idle detection and cross-tab deduplication.
   */
  async recordWebsiteHeartbeat(userId, {
    sessionId = null,
    activeSecondsDelta = 30,
    page = '/',
    deviceType = 'desktop',
    userAgent = '',
    isIdle = false
  } = {}) {
    if (!userId) throw new Error('Authenticated user ID is required');

    const userObjectId = new mongoose.Types.ObjectId(userId.toString());
    const cleanSessionId = (sessionId || `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`).trim();
    const now = Date.now();

    // Cross-tab deduplication: If user sends heartbeats from 2 tabs within 15s, throttle active time addition
    const tracker = userHeartbeatTracker.get(userObjectId.toString());
    let allowedDelta = Math.min(60, Math.max(0, Number(activeSecondsDelta) || 0));

    if (tracker) {
      const elapsedSinceLast = (now - tracker.lastHeartbeatMs) / 1000;
      if (elapsedSinceLast < 10 && tracker.lastSessionId !== cleanSessionId) {
        // Concurrent tab heartbeat, avoid double counting
        allowedDelta = 0;
      }
    }
    userHeartbeatTracker.set(userObjectId.toString(), {
      lastHeartbeatMs: now,
      lastSessionId: cleanSessionId
    });

    if (isIdle) {
      allowedDelta = 0;
    }

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      let session = await WebsiteUsageSession.findOne({ userId: userObjectId, sessionId: cleanSessionId });
      const nowDate = new Date(now);

      if (session) {
        session.lastActiveAt = nowDate;
        session.sessionStatus = isIdle ? 'idle' : 'active';
        if (allowedDelta > 0) {
          session.activeDurationSeconds = (session.activeDurationSeconds || 0) + allowedDelta;
        }
        if (page && !session.pagesVisited.includes(page)) {
          session.pagesVisited.push(page.slice(0, 100));
        }
        await session.save();
      } else {
        session = new WebsiteUsageSession({
          userId: userObjectId,
          sessionId: cleanSessionId,
          loginAt: nowDate,
          lastActiveAt: nowDate,
          activeDurationSeconds: allowedDelta,
          pagesVisited: page ? [page.slice(0, 100)] : [],
          deviceType: deviceType.slice(0, 50),
          userAgent: userAgent.slice(0, 250),
          sessionStatus: isIdle ? 'idle' : 'active'
        });
        await session.save();
      }

      this.invalidateUserCache(userObjectId);

      return {
        success: true,
        sessionId: cleanSessionId,
        activeDurationSeconds: session.activeDurationSeconds,
        sessionStatus: session.sessionStatus
      };
    }

    return { success: true, sessionId: cleanSessionId, activeDurationSeconds: 0 };
  },

  /**
   * Closes a website usage session (on logout or tab close).
   */
  async closeWebsiteSession(userId, sessionId) {
    if (!userId || !sessionId) return;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await WebsiteUsageSession.updateOne(
        { userId: new mongoose.Types.ObjectId(userId.toString()), sessionId },
        { $set: { sessionStatus: 'closed', logoutAt: new Date() } }
      ).catch(() => {});
    }
  },

  /**
   * Updates user listening preferences with real interaction data.
   */
  async updateUserPreference(userId, { trackId, title, artist, thumbnail, completed }) {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
    const cleanArtist = (artist || '').trim();
    if (!cleanArtist || cleanArtist === 'Unknown Artist') return;

    let pref = await UserMusicPreference.findOne({ userId });
    if (!pref) {
      pref = new UserMusicPreference({
        userId,
        topArtists: [],
        topGenres: [],
        favouriteTrackIds: [],
        recentTracks: [],
        totalPlays: 0,
        totalCompletedListens: 0
      });
    }

    const existingArtist = pref.topArtists.find(a => a.name.toLowerCase() === cleanArtist.toLowerCase());
    if (existingArtist) {
      existingArtist.playCount = (existingArtist.playCount || 0) + 1;
      if (completed) existingArtist.completedCount = (existingArtist.completedCount || 0) + 1;
      existingArtist.score = (existingArtist.score || 0) + (completed ? 3 : 1);
    } else {
      pref.topArtists.push({
        name: cleanArtist,
        playCount: 1,
        completedCount: completed ? 1 : 0,
        score: completed ? 3 : 1
      });
    }

    pref.topArtists.sort((a, b) => b.score - a.score);
    pref.topArtists = pref.topArtists.slice(0, 30);
    pref.totalPlays = (pref.totalPlays || 0) + 1;
    if (completed) pref.totalCompletedListens = (pref.totalCompletedListens || 0) + 1;

    // Recent tracks
    pref.recentTracks = pref.recentTracks.filter(t => t.trackId !== trackId);
    pref.recentTracks.unshift({
      trackId,
      title,
      artist: cleanArtist,
      thumbnail: thumbnail || '',
      listenedAt: new Date(),
      completed: Boolean(completed)
    });
    pref.recentTracks = pref.recentTracks.slice(0, 30);
    pref.lastCalculatedAt = new Date();

    await pref.save();
  },

  /**
   * Authoritative Weekly Recap calculation.
   * Returns: totalListeningSeconds, totalHours, totalPlays, distinctTracksCount, peakDay, dailyActivity, topTracks, topArtists, moods, trends.
   */
  async getWeeklyRecap(userId, { timezone = 'UTC', forceRefresh = false } = {}) {
    if (!userId) throw new Error('Authenticated user ID is required');

    const userObjectId = new mongoose.Types.ObjectId(userId.toString());
    const cacheKey = `${userObjectId.toString()}_weekly_${timezone}`;
    const now = Date.now();

    if (!forceRefresh && analyticsCache.has(cacheKey)) {
      const cached = analyticsCache.get(cacheKey);
      if (now - cached.timestamp < CACHE_TTL_MS) return cached.data;
    }

    const startOfWeek = getWeekStartInTimezone(timezone);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

    const emptyDailyActivity = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek.getTime() + i * 24 * 60 * 60 * 1000);
      let dayShort = '';
      try {
        dayShort = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', timeZone: timezone }).format(d);
      } catch {
        dayShort = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
      }
      emptyDailyActivity.push({
        dayIndex: i,
        dayLabel: dayNames[i],
        dayShort,
        seconds: 0,
        hours: 0,
        plays: 0,
        isPeak: false
      });
    }

    let dateRangeLabel = 'This Week';
    try {
      const startFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: '2-digit', month: 'short', timeZone: timezone }).format(startOfWeek);
      const endFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: timezone }).format(endOfWeek);
      dateRangeLabel = `${startFmt} – ${endFmt}`;
    } catch {}

    const emptyResult = {
      periodLabel: 'This Week',
      dateRangeLabel,
      totalListeningSeconds: 0,
      totalListeningMinutes: 0,
      totalHours: '0.0',
      totalListeningHours: '0.0',
      totalPlays: 0,
      distinctTracksCount: 0,
      distinctArtistsCount: 0,
      peakDay: 'None',
      peakDayHours: '0.0',
      dailyActivity: emptyDailyActivity,
      topTracks: [],
      topSongs: [],
      topArtists: [],
      topMoods: [],
      hoursTrend: null,
      playsTrend: null,
      tracksTrend: null,
      hasData: false
    };

    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return emptyResult;
    }

    // Query events from both UserPlaybackEvent and UserListeningEvent (deduplicated by sessionId/trackId)
    const [playbackEvents, legacyEvents] = await Promise.all([
      UserPlaybackEvent.find({
        userId: userObjectId,
        startedAt: { $gte: startOfWeek, $lte: endOfWeek }
      }).lean().maxTimeMS(6000),
      UserListeningEvent.find({
        userId: userObjectId,
        timestamp: { $gte: startOfWeek, $lte: endOfWeek }
      }).lean().maxTimeMS(6000)
    ]);

    // Unified deduplication by sessionId or trackId+timestamp
    const unifiedMap = new Map();

    for (const ev of playbackEvents) {
      const key = ev.sessionId || `${ev.trackId}_${new Date(ev.startedAt).getTime()}`;
      unifiedMap.set(key, {
        trackId: ev.trackId,
        videoId: ev.videoId || ev.trackId,
        title: ev.songTitle,
        artist: ev.artistName,
        thumbnail: ev.artworkUrl,
        listenedSec: Math.max(0, Number(ev.listenedDurationSeconds) || 0),
        durationSec: Math.max(0, Number(ev.durationSeconds) || 0),
        completed: Boolean(ev.completed),
        timestamp: new Date(ev.startedAt)
      });
    }

    for (const ev of legacyEvents) {
      const key = ev.playSessionId || `${ev.trackId}_${new Date(ev.timestamp).getTime()}`;
      if (!unifiedMap.has(key)) {
        unifiedMap.set(key, {
          trackId: ev.trackId,
          videoId: ev.trackId,
          title: ev.title,
          artist: ev.artist || ev.channel || 'Unknown Artist',
          thumbnail: ev.thumbnail || '',
          listenedSec: Math.max(0, Number(ev.listenedDuration) || 0),
          durationSec: Math.max(0, Number(ev.duration) || 0),
          completed: ev.eventType === 'completed',
          timestamp: new Date(ev.timestamp)
        });
      } else {
        // Merge max listened duration
        const existing = unifiedMap.get(key);
        existing.listenedSec = Math.max(existing.listenedSec, Number(ev.listenedDuration) || 0);
        if (ev.eventType === 'completed') existing.completed = true;
      }
    }

    const events = Array.from(unifiedMap.values());
    if (events.length === 0) {
      analyticsCache.set(cacheKey, { timestamp: now, data: emptyResult });
      return emptyResult;
    }

    let weeklyTotalSeconds = 0;
    let weeklyValidPlays = 0;
    const trackAggregation = new Map();
    const artistAggregation = new Map();
    const dailyActivity = emptyDailyActivity.map(d => ({ ...d }));

    for (const ev of events) {
      const sec = ev.listenedSec;
      weeklyTotalSeconds += sec;

      const isValid = isValidMusicPlay(sec, ev.durationSec, ev.completed);
      if (isValid) {
        weeklyValidPlays += 1;

        // Track stats
        const tId = ev.trackId;
        const currentTrack = trackAggregation.get(tId) || {
          id: tId,
          videoId: ev.videoId || tId,
          title: ev.title || 'Unknown Track',
          artist: ev.artist || 'Unknown Artist',
          thumbnail: ev.thumbnail || '',
          plays: 0,
          seconds: 0
        };
        currentTrack.plays += 1;
        currentTrack.seconds += sec;
        if (ev.thumbnail && !currentTrack.thumbnail) currentTrack.thumbnail = ev.thumbnail;
        trackAggregation.set(tId, currentTrack);

        // Artist stats
        const cleanArt = (ev.artist || '').trim();
        if (cleanArt && cleanArt !== 'Unknown Artist' && cleanArt !== 'Various Artists') {
          const artEntry = artistAggregation.get(cleanArt) || {
            artist: cleanArt,
            plays: 0,
            seconds: 0,
            avatar: ev.thumbnail || ''
          };
          artEntry.plays += 1;
          artEntry.seconds += sec;
          if (ev.thumbnail && !artEntry.avatar) artEntry.avatar = ev.thumbnail;
          artistAggregation.set(cleanArt, artEntry);
        }
      }

      // Daily breakdown
      if (sec > 0 || isValid) {
        let dayIdx = 0;
        try {
          const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).formatToParts(ev.timestamp);
          const wkd = parts.find(p => p.type === 'weekday')?.value || 'Mon';
          const mapW = { 'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6 };
          dayIdx = mapW[wkd] ?? 0;
        } catch {
          dayIdx = (ev.timestamp.getDay() + 6) % 7;
        }

        if (dailyActivity[dayIdx]) {
          dailyActivity[dayIdx].seconds += sec;
          if (isValid) dailyActivity[dayIdx].plays += 1;
        }
      }
    }

    // Determine peak day strictly from actual daily seconds
    let peakDay = 'None';
    let peakDayHours = '0.0';
    let maxDaySec = 0;
    let peakIdx = -1;

    dailyActivity.forEach((day, idx) => {
      day.hours = parseFloat((day.seconds / 3600).toFixed(1));
      if (day.seconds > maxDaySec) {
        maxDaySec = day.seconds;
        peakDay = day.dayLabel;
        peakDayHours = day.hours.toFixed(1);
        peakIdx = idx;
      }
    });

    if (peakIdx >= 0 && maxDaySec > 0) {
      dailyActivity[peakIdx].isPeak = true;
    }

    // Top Songs
    const topTracks = Array.from(trackAggregation.values())
      .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds)
      .slice(0, 10);

    // Top Artists
    const totalValidArtistPlays = Array.from(artistAggregation.values()).reduce((a, b) => a + b.plays, 0) || 1;
    const topArtists = Array.from(artistAggregation.values())
      .map(a => ({
        artist: a.artist,
        plays: a.plays,
        count: a.plays,
        percentage: Math.min(100, Math.round((a.plays / totalValidArtistPlays) * 100)),
        avatar: a.avatar || ''
      }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5);

    // Dynamic Moods (only if genuine tracks exist)
    const topMoods = [];
    if (topTracks.length > 0) {
      const weights = { Romantic: 0, Chill: 0, Sad: 0, Energetic: 0, Nostalgic: 0 };
      topTracks.forEach(t => {
        const txt = `${t.title || ''} ${t.artist || ''}`.toLowerCase();
        if (/romantic|love|tum hi ho|kesariya|heeriye|dil|pyaar|humnava|arijit|shreya/.test(txt)) weights.Romantic += 4;
        if (/chill|acoustic|raataan|kho gaye|baarishein|prateek|anuv|lofi|subhanallah/.test(txt)) weights.Chill += 3;
        if (/sad|heartbreak|channa mereya|bekhayali|judai|aankh hai|agar tum|alizeh|kasoor/.test(txt)) weights.Sad += 3;
        if (/party|dance|lover|diljit|badtameez|kala chashma|london|chak de|workout|rock/.test(txt)) weights.Energetic += 3;
        if (/90s|retro|kumar sanu|alka yagnik|udit|lata|kishore|dheere|chura ke|nostalg/.test(txt)) weights.Nostalgic += 3;
      });

      const totalW = Object.values(weights).reduce((a, b) => a + b, 0);
      if (totalW > 0) {
        const moodIcons = { Romantic: '❤️', Chill: '🍃', Sad: '☁️', Energetic: '⚡', Nostalgic: '⏱️' };
        for (const [mood, w] of Object.entries(weights)) {
          if (w > 0) {
            topMoods.push({
              mood,
              percentage: Math.round((w / totalW) * 100),
              icon: moodIcons[mood] || '🎵'
            });
          }
        }
        topMoods.sort((a, b) => b.percentage - a.percentage);
      }
    }

    // Previous week comparison for trends
    const prevWeekStart = new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevWeekEvents = await UserPlaybackEvent.find({
      userId: userObjectId,
      startedAt: { $gte: prevWeekStart, $lt: startOfWeek }
    }).lean().maxTimeMS(3000);

    let prevWeekSec = 0;
    let prevWeekPlays = 0;
    const prevWeekTracks = new Set();
    prevWeekEvents.forEach(e => {
      const s = Number(e.listenedDurationSeconds) || 0;
      prevWeekSec += s;
      if (isValidMusicPlay(s, e.durationSeconds, e.completed)) {
        prevWeekPlays += 1;
        if (e.trackId) prevWeekTracks.add(e.trackId);
      }
    });

    // Only compute trend if previous week actually had data! If no previous week data, return null.
    const computeTrendOrNull = (current, prev) => {
      if (prev > 0) {
        const diff = Math.round(((current - prev) / prev) * 100);
        return diff >= 0 ? `+${diff}%` : `${diff}%`;
      }
      return null; // Do NOT fabricate +28% or +100% when there is no prior data
    };

    const hasData = weeklyTotalSeconds >= 10 || weeklyValidPlays > 0;

    const result = {
      periodLabel: 'This Week',
      dateRangeLabel,
      totalListeningSeconds: weeklyTotalSeconds,
      totalListeningMinutes: Math.round(weeklyTotalSeconds / 60),
      totalHours: (weeklyTotalSeconds / 3600).toFixed(1),
      totalListeningHours: (weeklyTotalSeconds / 3600).toFixed(1),
      totalPlays: weeklyValidPlays,
      distinctTracksCount: trackAggregation.size,
      distinctArtistsCount: artistAggregation.size,
      peakDay,
      peakDayHours,
      dailyActivity,
      topTracks,
      topSongs: topTracks,
      topArtists,
      topMoods,
      hoursTrend: computeTrendOrNull(weeklyTotalSeconds, prevWeekSec),
      playsTrend: computeTrendOrNull(weeklyValidPlays, prevWeekPlays),
      tracksTrend: computeTrendOrNull(trackAggregation.size, prevWeekTracks.size),
      hasData
    };

    analyticsCache.set(cacheKey, { timestamp: now, data: result });
    return result;
  },

  /**
   * Authoritative All-Time Statistics calculation.
   * Returns: lifetime listening seconds/hours, lifetime valid plays, unique tracks, unique artists, top tracks, top artists, website usage.
   */
  async getAllTimeStats(userId, { timezone = 'UTC', forceRefresh = false } = {}) {
    if (!userId) throw new Error('Authenticated user ID is required');

    const userObjectId = new mongoose.Types.ObjectId(userId.toString());
    const cacheKey = `${userObjectId.toString()}_alltime_${timezone}`;
    const now = Date.now();

    if (!forceRefresh && analyticsCache.has(cacheKey)) {
      const cached = analyticsCache.get(cacheKey);
      if (now - cached.timestamp < CACHE_TTL_MS) return cached.data;
    }

    const emptyResult = {
      totalListeningSeconds: 0,
      totalMinutes: 0,
      totalHours: '0.0',
      totalListeningHours: '0.0',
      totalPlays: 0,
      distinctTracksCount: 0,
      uniqueTracks: 0,
      distinctArtistsCount: 0,
      uniqueArtists: 0,
      topTracks: [],
      topSongs: [],
      topArtists: [],
      totalActiveWebsiteSeconds: 0,
      totalActiveWebsiteHours: '0.0',
      totalSessions: 0,
      longestSessionSeconds: 0,
      longestSessionFormatted: '0m 0s',
      activityOverTime: [],
      hasData: false
    };

    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return emptyResult;
    }

    // Query all lifetime events and website sessions
    const [playbackEvents, legacyEvents, websiteSessions] = await Promise.all([
      UserPlaybackEvent.find({ userId: userObjectId }).lean().maxTimeMS(8000),
      UserListeningEvent.find({ userId: userObjectId }).lean().maxTimeMS(8000),
      WebsiteUsageSession.find({ userId: userObjectId }).lean().maxTimeMS(4000)
    ]);

    // Unified map
    const unifiedMap = new Map();
    for (const ev of playbackEvents) {
      const key = ev.sessionId || `${ev.trackId}_${new Date(ev.startedAt).getTime()}`;
      unifiedMap.set(key, {
        trackId: ev.trackId,
        videoId: ev.videoId || ev.trackId,
        title: ev.songTitle,
        artist: ev.artistName,
        thumbnail: ev.artworkUrl,
        listenedSec: Math.max(0, Number(ev.listenedDurationSeconds) || 0),
        durationSec: Math.max(0, Number(ev.durationSeconds) || 0),
        completed: Boolean(ev.completed)
      });
    }

    for (const ev of legacyEvents) {
      const key = ev.playSessionId || `${ev.trackId}_${new Date(ev.timestamp).getTime()}`;
      if (!unifiedMap.has(key)) {
        unifiedMap.set(key, {
          trackId: ev.trackId,
          videoId: ev.trackId,
          title: ev.title,
          artist: ev.artist || ev.channel || 'Unknown Artist',
          thumbnail: ev.thumbnail || '',
          listenedSec: Math.max(0, Number(ev.listenedDuration) || 0),
          durationSec: Math.max(0, Number(ev.duration) || 0),
          completed: ev.eventType === 'completed'
        });
      } else {
        const existing = unifiedMap.get(key);
        existing.listenedSec = Math.max(existing.listenedSec, Number(ev.listenedDuration) || 0);
        if (ev.eventType === 'completed') existing.completed = true;
      }
    }

    const allEvents = Array.from(unifiedMap.values());

    let lifetimeSeconds = 0;
    let lifetimeValidPlays = 0;
    let longestSessionSec = 0;
    const trackAggregation = new Map();
    const artistAggregation = new Map();

    for (const ev of allEvents) {
      const sec = ev.listenedSec;
      lifetimeSeconds += sec;
      if (sec > longestSessionSec) {
        longestSessionSec = sec;
      }

      const isValid = isValidMusicPlay(sec, ev.durationSec, ev.completed);
      if (isValid) {
        lifetimeValidPlays += 1;

        const tId = ev.trackId;
        const currentTrack = trackAggregation.get(tId) || {
          id: tId,
          videoId: ev.videoId || tId,
          title: ev.title || 'Unknown Track',
          artist: ev.artist || 'Unknown Artist',
          thumbnail: ev.thumbnail || '',
          plays: 0,
          seconds: 0
        };
        currentTrack.plays += 1;
        currentTrack.seconds += sec;
        if (ev.thumbnail && !currentTrack.thumbnail) currentTrack.thumbnail = ev.thumbnail;
        trackAggregation.set(tId, currentTrack);

        const cleanArt = (ev.artist || '').trim();
        if (cleanArt && cleanArt !== 'Unknown Artist' && cleanArt !== 'Various Artists') {
          const artEntry = artistAggregation.get(cleanArt) || {
            artist: cleanArt,
            plays: 0,
            seconds: 0,
            avatar: ev.thumbnail || ''
          };
          artEntry.plays += 1;
          artEntry.seconds += sec;
          if (ev.thumbnail && !artEntry.avatar) artEntry.avatar = ev.thumbnail;
          artistAggregation.set(cleanArt, artEntry);
        }
      }
    }

    const topTracks = Array.from(trackAggregation.values())
      .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds)
      .slice(0, 15);

    const totalValidArtistPlays = Array.from(artistAggregation.values()).reduce((a, b) => a + b.plays, 0) || 1;
    const topArtists = Array.from(artistAggregation.values())
      .map(a => ({
        artist: a.artist,
        plays: a.plays,
        count: a.plays,
        percentage: Math.min(100, Math.round((a.plays / totalValidArtistPlays) * 100)),
        avatar: a.avatar || ''
      }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10);

    // Website usage calculations
    let totalWebsiteSeconds = 0;
    for (const s of websiteSessions) {
      totalWebsiteSeconds += Math.max(0, Number(s.activeDurationSeconds) || 0);
    }

    const hasData = lifetimeSeconds >= 10 || lifetimeValidPlays > 0 || totalWebsiteSeconds > 0;

    const result = {
      totalListeningSeconds: lifetimeSeconds,
      totalMinutes: Math.round(lifetimeSeconds / 60),
      totalHours: (lifetimeSeconds / 3600).toFixed(1),
      totalListeningHours: (lifetimeSeconds / 3600).toFixed(1),
      totalPlays: lifetimeValidPlays,
      distinctTracksCount: trackAggregation.size,
      uniqueTracks: trackAggregation.size,
      distinctArtistsCount: artistAggregation.size,
      uniqueArtists: artistAggregation.size,
      topTracks,
      topSongs: topTracks,
      topArtists,
      longestSessionSeconds: longestSessionSec,
      longestSessionFormatted: `${Math.floor(longestSessionSec / 60)}m ${longestSessionSec % 60}s`,
      activityOverTime: [],
      totalActiveWebsiteSeconds: totalWebsiteSeconds,
      totalActiveWebsiteHours: (totalWebsiteSeconds / 3600).toFixed(1),
      totalSessions: websiteSessions.length,
      hasData
    };

    analyticsCache.set(cacheKey, { timestamp: now, data: result });
    return result;
  },

  /**
   * Unified Overview endpoint providing single source of truth for both weekly and all-time recap.
   */
  async getUnifiedOverview(userId, options = {}) {
    const [weeklyRecap, allTimeStats] = await Promise.all([
      this.getWeeklyRecap(userId, options),
      this.getAllTimeStats(userId, options)
    ]);

    return {
      success: true,
      userId: userId ? userId.toString() : null,
      updatedAt: new Date().toISOString(),
      weeklyRecap,
      allTimeStats
    };
  }
};
