/**
 * Loopra Listening Statistics & Recap Service
 * Handles user-isolated playback telemetry, real-time tracking,
 * 5-minute auto-reconciliation, and dynamic weekly & lifetime recap queries.
 */

const STORAGE_KEY_GUEST = 'loopra_guest_listening_stats';

function getStorageKeyForUser(userOrId) {
  if (!userOrId) return STORAGE_KEY_GUEST;
  const id = typeof userOrId === 'object' ? (userOrId._id || userOrId.userId || userOrId.id) : userOrId;
  return id ? `loopra_user_stats_${id}` : STORAGE_KEY_GUEST;
}

function getStoredStats(userOrId) {
  const key = getStorageKeyForUser(userOrId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    totalListeningSeconds: 0,
    playEvents: [], // { trackId, title, artist, thumbnail, timestamp, seconds, playSessionId }
    trackPlayCounts: {}, // trackId -> { title, artist, thumbnail, count, seconds, lastPlayed }
    artistPlayCounts: {}, // artist -> count
    dailySeconds: {}, // 'YYYY-MM-DD' -> seconds
    longestSessionSeconds: 0,
    updatedAt: new Date().toISOString()
  };
}

function saveStats(stats, userOrId) {
  const key = getStorageKeyForUser(userOrId);
  try {
    localStorage.setItem(key, JSON.stringify(stats));
  } catch (e) {}
}

export const listeningStatsService = {
  /**
   * Fetches genuine listening stats from backend for authenticated user,
   * with automatic fallback to guest stats or user-isolated local cache.
   */
  async fetchStats({ backendUrl = '', token = null, user = null, forceRefresh = false, timezone = null } = {}) {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const userId = user ? (user._id || user.userId || user.id) : null;

    if (token && userId && backendUrl) {
      const base = backendUrl.replace(/\/+$/, '');
      const endpoints = [
        `${base}/api/analytics/overview?timezone=${encodeURIComponent(tz)}&forceRefresh=${Boolean(forceRefresh)}`,
        `${base}/api/user/listening-stats?timezone=${encodeURIComponent(tz)}&forceRefresh=${Boolean(forceRefresh)}`,
        `${base}/api/listening-stats?timezone=${encodeURIComponent(tz)}&forceRefresh=${Boolean(forceRefresh)}`
      ];

      for (const url of endpoints) {
        try {
          const res = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (res.ok) {
            const data = await res.json();
            if (data && data.success) {
              // Cache user stats for offline/instant-open resilience
              try {
                localStorage.setItem(`loopra_user_server_stats_${userId}`, JSON.stringify({
                  ...data,
                  cachedAt: Date.now()
                }));
              } catch (e) {}
              return data;
            }
          }
        } catch (err) {
          // Try next endpoint
        }
      }

      // Check cached server data for this user
      try {
        const cachedRaw = localStorage.getItem(`loopra_user_server_stats_${userId}`);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          return { ...parsed, isOfflineCache: true };
        }
      } catch (e) {}
    }

    // Guest / Local User fallback
    return this.computeLocalStats(userId);
  },

  /**
   * Computes Weekly Recap and All-Time stats locally for guest or offline mode.
   * STRICT: Absolutely no fake or hardcoded numbers.
   */
  computeLocalStats(userOrId) {
    const stats = getStoredStats(userOrId);
    const now = new Date();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const recentEvents = (stats.playEvents || []).filter(e => {
      const t = new Date(e.timestamp).getTime();
      return !isNaN(t) && t >= sevenDaysAgo;
    });

    let weeklySeconds = 0;
    const weeklyTrackCounts = {};
    const weeklyArtistCounts = {};
    let weeklyValidPlays = 0;

    const daysNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dailyActivity = [];
    const mondayOffset = (now.getDay() + 6) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset, 0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek.getTime() + i * 24 * 60 * 60 * 1000);
      const dayShort = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
      dailyActivity.push({
        dayIndex: i,
        dayLabel: daysNames[i],
        dayShort,
        seconds: 0,
        hours: 0,
        plays: 0,
        isPeak: false
      });
    }

    recentEvents.forEach(e => {
      const sec = Math.max(0, Number(e.seconds) || 0);
      weeklySeconds += sec;

      const isValidPlay = sec >= 30 || e.eventType === 'completed';
      if (isValidPlay) {
        weeklyValidPlays += 1;

        weeklyTrackCounts[e.trackId] = weeklyTrackCounts[e.trackId] || {
          id: e.trackId,
          videoId: e.trackId,
          title: e.title || 'Unknown Track',
          artist: e.artist || 'Unknown Artist',
          thumbnail: e.thumbnail || '',
          count: 0,
          plays: 0,
          seconds: 0
        };
        weeklyTrackCounts[e.trackId].count += 1;
        weeklyTrackCounts[e.trackId].plays += 1;
        weeklyTrackCounts[e.trackId].seconds += sec;

        const cleanArt = (e.artist || '').trim();
        if (cleanArt && cleanArt !== 'Unknown Artist' && cleanArt !== 'Various Artists') {
          weeklyArtistCounts[cleanArt] = (weeklyArtistCounts[cleanArt] || 0) + 1;
        }
      }

      const evDate = new Date(e.timestamp);
      const dayIdx = (evDate.getDay() + 6) % 7;
      if (dailyActivity[dayIdx]) {
        dailyActivity[dayIdx].seconds += sec;
        if (isValidPlay) dailyActivity[dayIdx].plays += 1;
      }
    });

    let peakDay = 'None';
    let peakDayHours = '0.0';
    let maxDaySec = 0;
    let peakIndex = -1;
    dailyActivity.forEach((day, idx) => {
      day.hours = parseFloat((day.seconds / 3600).toFixed(1));
      if (day.seconds > maxDaySec) {
        maxDaySec = day.seconds;
        peakDay = day.dayLabel;
        peakDayHours = day.hours.toFixed(1);
        peakIndex = idx;
      }
    });

    if (peakIndex >= 0 && maxDaySec > 0) {
      dailyActivity[peakIndex].isPeak = true;
    }

    const endOfWeek = new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
    const dateRangeLabel = `${daysNames[0]}, ${startOfWeek.getDate()} ${startOfWeek.toLocaleString('en-US', { month: 'short' })} – ${daysNames[6]}, ${endOfWeek.getDate()} ${endOfWeek.toLocaleString('en-US', { month: 'short' })}`;

    const weeklyTopTracks = Object.values(weeklyTrackCounts)
      .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds)
      .slice(0, 5);

    const totalArtistPlays = Object.values(weeklyArtistCounts).reduce((a, b) => a + b, 0) || 1;
    const weeklyTopArtists = Object.entries(weeklyArtistCounts)
      .map(([artist, count]) => {
        const sampleTrack = Object.values(weeklyTrackCounts).find(t => t.artist?.toLowerCase() === artist.toLowerCase());
        return {
          artist,
          count,
          plays: count,
          percentage: Math.min(100, Math.round((count / totalArtistPlays) * 100)),
          avatar: sampleTrack?.thumbnail || ''
        };
      })
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5);

    const hasWeeklyActivity = weeklyValidPlays > 0 || weeklySeconds >= 10;
    const weeklyRecap = {
      periodLabel: 'This Week',
      dateRangeLabel,
      totalListeningSeconds: weeklySeconds,
      totalListeningMinutes: Math.round(weeklySeconds / 60),
      totalHours: (weeklySeconds / 3600).toFixed(1),
      hoursTrend: null,
      distinctTracksCount: Object.keys(weeklyTrackCounts).length,
      tracksTrend: null,
      totalPlays: weeklyValidPlays,
      playsTrend: null,
      topTracks: weeklyTopTracks,
      topArtists: weeklyTopArtists,
      topMoods: [],
      peakDay,
      peakDayHours,
      dailyActivity,
      hasData: hasWeeklyActivity
    };

    // All-time calculation
    const totalSecs = stats.totalListeningSeconds || 0;
    const allTimeTopTracks = Object.entries(stats.trackPlayCounts || {})
      .map(([id, data]) => ({ id, videoId: id, plays: data.count || 0, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const allTimeTopArtists = Object.entries(stats.artistPlayCounts || {})
      .map(([artist, count]) => ({ artist, count, plays: count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const allTimeStats = {
      totalListeningSeconds: totalSecs,
      totalMinutes: Math.round(totalSecs / 60),
      totalHours: (totalSecs / 3600).toFixed(1),
      totalPlays: Object.values(stats.trackPlayCounts || {}).reduce((acc, t) => acc + (t.count || 0), 0),
      distinctTracksCount: Object.keys(stats.trackPlayCounts || {}).length,
      distinctArtistsCount: Object.keys(stats.artistPlayCounts || {}).length,
      topTracks: allTimeTopTracks,
      topArtists: allTimeTopArtists,
      totalActiveWebsiteSeconds: 0,
      totalActiveWebsiteHours: '0.0',
      totalSessions: 0,
      hasData: totalSecs > 0 || Object.keys(stats.trackPlayCounts || {}).length > 0
    };

    return {
      success: true,
      userId: userOrId ? (userOrId._id || userOrId.userId || userOrId.id || userOrId) : null,
      updatedAt: stats.updatedAt || new Date().toISOString(),
      weeklyRecap,
      allTimeStats,
      isLocal: true
    };
  },

  /**
   * Records a genuine playback event to backend /api/analytics/playback-event
   * and syncs local storage.
   */
  async recordEvent({
    backendUrl = '',
    token = null,
    user = null,
    track,
    eventType = 'play_start',
    duration = 0,
    listenedDuration = 0,
    playbackPosition = 0,
    playSessionId = null,
    source = 'player',
    completed = false
  }) {
    if (!track || (!track.id && !track.videoId)) return;

    const trackId = track.id || track.videoId;
    const title = track.title || 'Unknown Track';
    const artist = track.artist || track.channel || 'Unknown Artist';
    const thumbnail = track.thumbnail || track.image || '';
    const userId = user ? (user._id || user.userId || user.id) : null;
    const durSec = Math.max(0, Math.round(duration));
    const listenedSec = Math.max(0, Math.round(listenedDuration));

    // 1. Dispatch to backend if authenticated
    if (token && backendUrl) {
      try {
        const base = backendUrl.replace(/\/+$/, '');
        const payload = {
          sessionId: playSessionId,
          trackId,
          videoId: track.videoId || trackId,
          songTitle: title,
          artistName: artist,
          artworkUrl: thumbnail,
          eventType,
          durationSeconds: durSec,
          listenedDurationSeconds: listenedSec,
          playbackPositionSeconds: Math.max(0, Math.round(playbackPosition)),
          completionPercent: durSec > 0 ? Math.min(100, Math.round((listenedSec / durSec) * 100)) : (completed ? 100 : 0),
          completed,
          source
        };

        fetch(`${base}/api/analytics/playback-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {
          // Fallback to legacy endpoint if router not matched
          fetch(`${base}/api/listening-events`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              trackId,
              title,
              artist,
              thumbnail,
              eventType,
              duration: durSec,
              listenedDuration: listenedSec,
              playSessionId,
              source
            }),
            keepalive: true
          }).catch(() => {});
        });
      } catch (e) {}
    }

    // 2. Update user-isolated local record
    const stats = getStoredStats(userId);
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);

    if (listenedSec > (stats.longestSessionSeconds || 0)) {
      stats.longestSessionSeconds = listenedSec;
    }

    if (completed || (listenedSec >= 30 && !stats.trackPlayCounts[trackId]?.creditedThisSession)) {
      if (!stats.trackPlayCounts[trackId]) {
        stats.trackPlayCounts[trackId] = { title, artist, thumbnail, count: 0, seconds: 0, lastPlayed: now.toISOString() };
      }
      stats.trackPlayCounts[trackId].count += 1;
      stats.trackPlayCounts[trackId].seconds = (stats.trackPlayCounts[trackId].seconds || 0) + listenedSec;
      stats.trackPlayCounts[trackId].lastPlayed = now.toISOString();

      if (artist && artist !== 'Unknown Artist') {
        stats.artistPlayCounts[artist] = (stats.artistPlayCounts[artist] || 0) + 1;
      }
    }

    // Add event to playEvents log (max 100)
    if (listenedSec >= 15 || completed) {
      const filtered = (stats.playEvents || []).filter(e => e.playSessionId !== playSessionId);
      stats.playEvents = [
        { trackId, title, artist, thumbnail, timestamp: now.toISOString(), seconds: listenedSec, playSessionId, eventType },
        ...filtered.slice(0, 99)
      ];
    }

    stats.updatedAt = now.toISOString();
    saveStats(stats, userId);
  },

  /**
   * Sends website activity heartbeat to backend.
   */
  async sendWebsiteHeartbeat({
    backendUrl = '',
    token = null,
    sessionId = null,
    activeSecondsDelta = 30,
    page = '/',
    deviceType = 'desktop',
    isIdle = false
  }) {
    if (!token || !backendUrl) return;
    try {
      const base = backendUrl.replace(/\/+$/, '');
      await fetch(`${base}/api/analytics/website-heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          activeSecondsDelta,
          page,
          deviceType,
          isIdle
        }),
        keepalive: true
      });
    } catch (e) {}
  },

  /**
   * Concludes a website usage session.
   */
  async closeWebsiteSession({ backendUrl = '', token = null, sessionId = null }) {
    if (!token || !backendUrl || !sessionId) return;
    try {
      const base = backendUrl.replace(/\/+$/, '');
      const url = `${base}/api/analytics/website-session-end`;
      const data = JSON.stringify({ sessionId });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, data);
      } else {
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: data,
          keepalive: true
        }).catch(() => {});
      }
    } catch (e) {}
  },

  /**
   * Increment cumulative listening seconds incrementally.
   */
  recordListeningTime(seconds = 1, userOrId = null) {
    if (seconds <= 0) return;
    const stats = getStoredStats(userOrId);
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);

    stats.totalListeningSeconds = (stats.totalListeningSeconds || 0) + Math.round(seconds);
    stats.dailySeconds[dateKey] = (stats.dailySeconds[dateKey] || 0) + Math.round(seconds);
    stats.updatedAt = now.toISOString();

    saveStats(stats, userOrId);
  },

  /**
   * Backward-compatible recordPlay method.
   */
  recordPlay(track, durationSeconds = 30, userOrId = null) {
    if (!track) return;
    const stats = getStoredStats(userOrId);
    const now = new Date();
    const trackId = track.id || track.videoId;
    const title = track.title || 'Unknown Track';
    const artist = track.artist || track.channel || 'Unknown Artist';
    const thumbnail = track.thumbnail || track.image || '';

    if (!stats.trackPlayCounts[trackId]) {
      stats.trackPlayCounts[trackId] = { title, artist, thumbnail, count: 0, seconds: 0, lastPlayed: now.toISOString() };
    }
    stats.trackPlayCounts[trackId].count += 1;
    stats.trackPlayCounts[trackId].seconds = (stats.trackPlayCounts[trackId].seconds || 0) + Math.round(durationSeconds);

    if (artist && artist !== 'Unknown Artist') {
      stats.artistPlayCounts[artist] = (stats.artistPlayCounts[artist] || 0) + 1;
    }

    stats.updatedAt = now.toISOString();
    saveStats(stats, userOrId);
  },

  clearStats(userOrId = null) {
    try {
      localStorage.removeItem(getStorageKeyForUser(userOrId));
    } catch (e) {}
  }
};
