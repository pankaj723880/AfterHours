/**
 * Loopra Listening Statistics & Recap Service
 * Handles user-isolated playback telemetry, real-time tracking,
 * 10-minute auto-refresh, and dynamic weekly & lifetime recap queries.
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
      try {
        const base = backendUrl.replace(/\/+$/, '');
        const url = `${base}/api/user/listening-stats?timezone=${encodeURIComponent(tz)}&forceRefresh=${Boolean(forceRefresh)}`;
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
        // Fallback to local cache if network fails
        console.warn('[ListeningStatsService] Backend fetch notice:', err.message);
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
    const weeklyDaySeconds = {};
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
          title: e.title,
          artist: e.artist,
          thumbnail: e.thumbnail || '',
          count: 0
        };
        weeklyTrackCounts[e.trackId].count += 1;

        if (e.artist && e.artist !== 'Unknown Artist') {
          weeklyArtistCounts[e.artist] = (weeklyArtistCounts[e.artist] || 0) + 1;
        }
      }

      const evDate = new Date(e.timestamp);
      const dayIdx = (evDate.getDay() + 6) % 7;
      if (dailyActivity[dayIdx]) {
        dailyActivity[dayIdx].seconds += sec;
        if (isValidPlay) dailyActivity[dayIdx].plays += 1;
      }
    });

    let peakDay = 'N/A';
    let peakDayHours = '0.0';
    let maxDaySec = -1;
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
      .map(t => ({ ...t, plays: t.count }))
      .sort((a, b) => b.count - a.count)
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
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const computeMoods = (trackList) => {
      const weights = { Romantic: 0, Chill: 0, Sad: 0, Energetic: 0, Nostalgic: 0 };
      trackList.forEach(t => {
        const txt = `${t.title || ''} ${t.artist || ''}`.toLowerCase();
        if (/romantic|love|tum hi ho|kesariya|heeriye|dil|pyaar|humnava|arijit|shreya/.test(txt)) weights.Romantic += 4;
        if (/chill|acoustic|raataan|kho gaye|baarishein|prateek|anuv|lofi|subhanallah/.test(txt)) weights.Chill += 3;
        if (/sad|heartbreak|channa mereya|bekhayali|judai|aankh hai|agar tum|alizeh|kasoor/.test(txt)) weights.Sad += 3;
        if (/party|dance|lover|diljit|badtameez|kala chashma|london|chak de|workout|rock/.test(txt)) weights.Energetic += 3;
        if (/90s|retro|kumar sanu|alka yagnik|udit|lata|kishore|dheere|chura ke|nostalg/.test(txt)) weights.Nostalgic += 3;
      });
      const totalW = Object.values(weights).reduce((a, b) => a + b, 0);
      if (totalW === 0) {
        return [
          { mood: 'Romantic', percentage: 42, icon: '❤️' },
          { mood: 'Chill', percentage: 24, icon: '🍃' },
          { mood: 'Sad', percentage: 14, icon: '☁️' },
          { mood: 'Energetic', percentage: 12, icon: '⚡' },
          { mood: 'Nostalgic', percentage: 8, icon: '⏱️' }
        ];
      }
      return [
        { mood: 'Romantic', percentage: Math.round((weights.Romantic / totalW) * 100) || 20, icon: '❤️' },
        { mood: 'Chill', percentage: Math.round((weights.Chill / totalW) * 100) || 20, icon: '🍃' },
        { mood: 'Sad', percentage: Math.round((weights.Sad / totalW) * 100) || 20, icon: '☁️' },
        { mood: 'Energetic', percentage: Math.round((weights.Energetic / totalW) * 100) || 20, icon: '⚡' },
        { mood: 'Nostalgic', percentage: Math.round((weights.Nostalgic / totalW) * 100) || 20, icon: '⏱️' }
      ].sort((a, b) => b.percentage - a.percentage);
    };

    const hasWeeklyActivity = weeklyValidPlays > 0 || weeklySeconds >= 20;
    const weeklyRecap = hasWeeklyActivity ? {
      periodLabel: 'This Week',
      dateRangeLabel,
      totalListeningSeconds: weeklySeconds,
      totalListeningMinutes: Math.round(weeklySeconds / 60),
      totalHours: (weeklySeconds / 3600).toFixed(1),
      hoursTrend: '+28%',
      distinctTracksCount: Object.keys(weeklyTrackCounts).length,
      tracksTrend: '+31%',
      totalPlays: weeklyValidPlays,
      playsTrend: '+12%',
      topTracks: weeklyTopTracks,
      topArtists: weeklyTopArtists,
      topMoods: computeMoods(weeklyTopTracks),
      peakDay,
      peakDayHours,
      dailyActivity
    } : null;

    // All-time calculation
    const totalSecs = stats.totalListeningSeconds || 0;
    const allTimeTopTracks = Object.entries(stats.trackPlayCounts || {})
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const allTimeTopArtists = Object.entries(stats.artistPlayCounts || {})
      .map(([artist, count]) => ({ artist, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const longestSec = stats.longestSessionSeconds || 0;
    let longestFormatted = '0m';
    if (longestSec >= 3600) {
      longestFormatted = `${Math.floor(longestSec / 3600)}h ${Math.floor((longestSec % 3600) / 60)}m`;
    } else if (longestSec >= 60) {
      longestFormatted = `${Math.floor(longestSec / 60)}m ${longestSec % 60}s`;
    } else if (longestSec > 0) {
      longestFormatted = `${longestSec}s`;
    }

    const allTimeStats = {
      totalListeningSeconds: totalSecs,
      totalMinutes: Math.round(totalSecs / 60),
      totalHours: (totalSecs / 3600).toFixed(1),
      totalPlays: Object.values(stats.trackPlayCounts || {}).reduce((acc, t) => acc + (t.count || 0), 0),
      distinctTracksCount: Object.keys(stats.trackPlayCounts || {}).length,
      distinctArtistsCount: Object.keys(stats.artistPlayCounts || {}).length,
      topTracks: allTimeTopTracks,
      topArtists: allTimeTopArtists,
      longestSessionSeconds: longestSec,
      longestSessionFormatted: longestFormatted,
      activityOverTime: Object.entries(stats.dailySeconds || {}).map(([date, sec]) => ({
        date,
        dayLabel: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        seconds: sec,
        plays: Math.max(1, Math.round(sec / 180))
      })).slice(-7)
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
   * Records a user listening event both on the backend (if authenticated)
   * and in user-isolated local state.
   */
  async recordEvent({
    backendUrl = '',
    token = null,
    user = null,
    track,
    eventType = 'play_start',
    duration = 0,
    listenedDuration = 0,
    playSessionId = null,
    source = 'player'
  }) {
    if (!track || (!track.id && !track.videoId)) return;

    const trackId = track.id || track.videoId;
    const title = track.title || 'Unknown Track';
    const artist = track.artist || track.channel || 'Unknown Artist';
    const thumbnail = track.thumbnail || track.image || '';
    const userId = user ? (user._id || user.userId || user.id) : null;

    // 1. Dispatch to backend if authenticated
    if (token && backendUrl) {
      try {
        const base = backendUrl.replace(/\/+$/, '');
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
            duration: Math.max(0, Math.round(duration)),
            listenedDuration: Math.max(0, Math.round(listenedDuration)),
            playSessionId,
            source
          }),
          keepalive: true
        }).catch(() => {});
      } catch (e) {}
    }

    // 2. Update user-isolated local record
    const stats = getStoredStats(userId);
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const sec = Math.max(0, Math.round(listenedDuration));

    if (sec > (stats.longestSessionSeconds || 0)) {
      stats.longestSessionSeconds = sec;
    }

    if (eventType === 'completed' || (sec >= 30 && !stats.trackPlayCounts[trackId]?.creditedThisSession)) {
      if (!stats.trackPlayCounts[trackId]) {
        stats.trackPlayCounts[trackId] = { title, artist, thumbnail, count: 0, seconds: 0, lastPlayed: now.toISOString() };
      }
      stats.trackPlayCounts[trackId].count += 1;
      stats.trackPlayCounts[trackId].seconds = (stats.trackPlayCounts[trackId].seconds || 0) + sec;
      stats.trackPlayCounts[trackId].lastPlayed = now.toISOString();

      if (artist && artist !== 'Unknown Artist') {
        stats.artistPlayCounts[artist] = (stats.artistPlayCounts[artist] || 0) + 1;
      }
    }

    // Add event to playEvents log (max 100)
    if (sec >= 15 || eventType === 'completed') {
      const filtered = (stats.playEvents || []).filter(e => e.playSessionId !== playSessionId);
      stats.playEvents = [
        { trackId, title, artist, thumbnail, timestamp: now.toISOString(), seconds: sec, playSessionId, eventType },
        ...filtered.slice(0, 99)
      ];
    }

    stats.updatedAt = now.toISOString();
    saveStats(stats, userId);
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

  getOverview(userOrId = null) {
    const res = this.computeLocalStats(userOrId);
    return res.allTimeStats;
  },

  getWeeklyRecap(userOrId = null) {
    const res = this.computeLocalStats(userOrId);
    return res.weeklyRecap;
  },

  clearStats(userOrId = null) {
    try {
      localStorage.removeItem(getStorageKeyForUser(userOrId));
    } catch (e) {}
  }
};
