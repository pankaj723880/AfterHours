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

const RETRY_QUEUE_KEY = 'loopra_pending_analytics_queue';
const MAX_QUEUE_ITEMS = 50;
const MAX_RETRY_ATTEMPTS = 3;

function getRetryQueue() {
  try {
    const raw = localStorage.getItem(RETRY_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveRetryQueue(queue) {
  try {
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_ITEMS)));
  } catch (e) {}
}

function queueFailedPlaybackEvent(url, token, payload) {
  try {
    const queue = getRetryQueue();
    // Prevent unbounded duplication of same session
    const isDupe = queue.some(q => q.payload?.sessionId === payload?.sessionId && q.payload?.eventType === payload?.eventType);
    if (!isDupe) {
      queue.push({
        url,
        token,
        payload,
        attempts: 0,
        queuedAt: Date.now()
      });
      saveRetryQueue(queue);
    }
  } catch (e) {}
}

let isFlushingRetryQueue = false;
async function processRetryQueue() {
  if (isFlushingRetryQueue || typeof navigator === 'undefined' || !navigator.onLine) return;
  const queue = getRetryQueue();
  if (queue.length === 0) return;

  isFlushingRetryQueue = true;
  try {
    const remaining = [];
    for (const item of queue) {
      if (item.attempts >= MAX_RETRY_ATTEMPTS) continue;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(item.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${item.token}`
          },
          body: JSON.stringify(item.payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!res.ok && res.status >= 500) {
          item.attempts += 1;
          remaining.push(item);
        }
      } catch (err) {
        item.attempts += 1;
        remaining.push(item);
      }
    }
    saveRetryQueue(remaining);
  } finally {
    isFlushingRetryQueue = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => processRetryQueue());
  setInterval(() => processRetryQueue(), 60000);
}

export const listeningStatsService = {
  /**
   * Fetches genuine listening stats from backend for authenticated user,
   * with automatic fallback to guest stats or user-isolated local cache.
   */
  async fetchStats({ backendUrl = '', token = null, user = null, forceRefresh = false, timezone = null, month = null, year = null } = {}) {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const userId = user ? (user._id || user.userId || user.id) : null;

    if (token && userId && backendUrl) {
      const base = backendUrl.replace(/\/+$/, '');
      const mParam = (month !== null && month !== undefined) ? `&month=${encodeURIComponent(month)}` : '';
      const yParam = (year !== null && year !== undefined) ? `&year=${encodeURIComponent(year)}` : '';
      const endpoints = [
        `${base}/api/analytics/overview?timezone=${encodeURIComponent(tz)}&forceRefresh=${Boolean(forceRefresh)}${mParam}${yParam}`,
        `${base}/api/user/listening-stats?timezone=${encodeURIComponent(tz)}&forceRefresh=${Boolean(forceRefresh)}${mParam}${yParam}`,
        `${base}/api/listening-stats?timezone=${encodeURIComponent(tz)}&forceRefresh=${Boolean(forceRefresh)}${mParam}${yParam}`
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

    const monthNamesList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const curNow = new Date();
    const activityOverTime = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curNow.getFullYear(), curNow.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const yr = d.getFullYear();
      const mLabel = monthNamesList[mIdx];
      activityOverTime.push({
        dayIndex: 5 - i,
        dayLabel: mLabel,
        dayShort: `${mLabel} '${String(yr).slice(-2)}`,
        year: yr,
        month: mIdx,
        seconds: 0,
        hours: 0,
        plays: 0,
        isPeak: false
      });
    }

    const totalValidAllTimeArtistPlays = Object.values(stats.artistPlayCounts || {}).reduce((a, b) => a + b, 0) || 1;
    const formattedAllTimeTopArtists = Object.entries(stats.artistPlayCounts || {})
      .map(([artist, count]) => ({
        artist,
        name: artist,
        count,
        plays: count,
        percentage: Math.min(100, Math.round((count / totalValidAllTimeArtistPlays) * 100))
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const allTimeStats = {
      totalListeningSeconds: totalSecs,
      totalMinutes: Math.round(totalSecs / 60),
      totalHours: (totalSecs / 3600).toFixed(1),
      totalListeningHours: (totalSecs / 3600).toFixed(1),
      totalPlays: Object.values(stats.trackPlayCounts || {}).reduce((acc, t) => acc + (t.count || 0), 0),
      distinctTracksCount: Object.keys(stats.trackPlayCounts || {}).length,
      distinctArtistsCount: Object.keys(stats.artistPlayCounts || {}).length,
      topTracks: allTimeTopTracks,
      topSongs: allTimeTopTracks,
      topArtists: formattedAllTimeTopArtists,
      activityOverTime,
      totalActiveWebsiteSeconds: 0,
      totalActiveWebsiteHours: '0.0',
      totalSessions: 0,
      hasData: totalSecs > 0 || Object.keys(stats.trackPlayCounts || {}).length > 0,
      isVerified: false
    };

    // Monthly calculation
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyEvents = (stats.playEvents || []).filter(e => {
      return e.timestamp && e.timestamp.startsWith(currentMonthPrefix);
    });
    let monthlySeconds = 0;
    const monthlyTrackCounts = {};
    const monthlyArtistCounts = {};
    monthlyEvents.forEach(e => {
      const sec = Math.max(0, Number(e.seconds) || 0);
      monthlySeconds += sec;
      if (sec >= 30 || e.eventType === 'completed') {
        monthlyTrackCounts[e.trackId] = monthlyTrackCounts[e.trackId] || {
          id: e.trackId,
          videoId: e.trackId,
          title: e.title || 'Unknown Track',
          artist: e.artist || 'Unknown Artist',
          thumbnail: e.thumbnail || '',
          plays: 0,
          seconds: 0
        };
        monthlyTrackCounts[e.trackId].plays += 1;
        monthlyTrackCounts[e.trackId].seconds += sec;

        if (e.artist) {
          monthlyArtistCounts[e.artist] = (monthlyArtistCounts[e.artist] || 0) + 1;
        }
      }
    });

    const monthlyTopTracks = Object.values(monthlyTrackCounts)
      .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds)
      .slice(0, 5);

    const daysInCurMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthlyDailyActivity = [];
    for (let d = 1; d <= daysInCurMonth; d++) {
      monthlyDailyActivity.push({
        dayIndex: d - 1,
        dayNumber: d,
        dayLabel: String(d),
        dayShort: `${d} ${now.toLocaleString('en-US', { month: 'short' })}`,
        seconds: 0,
        hours: 0,
        plays: 0,
        isPeak: false
      });
    }

    let monthlyValidPlays = 0;
    monthlyEvents.forEach(e => {
      const sec = Math.max(0, Number(e.seconds) || 0);
      const isVal = sec >= 30 || e.eventType === 'completed';
      if (isVal) monthlyValidPlays++;
      const evD = new Date(e.timestamp);
      const dayNum = evD.getDate();
      if (monthlyDailyActivity[dayNum - 1]) {
        monthlyDailyActivity[dayNum - 1].seconds += sec;
        if (isVal) monthlyDailyActivity[dayNum - 1].plays += 1;
      }
    });

    let maxMDaysSec = 0;
    let peakMIdx = -1;
    let peakMDay = 'None';
    let peakMHours = '0.0';
    monthlyDailyActivity.forEach((day, idx) => {
      day.hours = parseFloat((day.seconds / 3600).toFixed(1));
      if (day.seconds > maxMDaysSec) {
        maxMDaysSec = day.seconds;
        peakMIdx = idx;
        peakMDay = day.dayShort;
        peakMHours = day.hours.toFixed(1);
      }
    });
    if (peakMIdx >= 0 && maxMDaysSec > 0) {
      monthlyDailyActivity[peakMIdx].isPeak = true;
    }

    const totalValidMonthArtistPlays = Object.values(monthlyArtistCounts).reduce((a, b) => a + b, 0) || 1;
    const monthlyTopArtists = Object.entries(monthlyArtistCounts)
      .map(([name, plays]) => {
        const sample = Object.values(monthlyTrackCounts).find(t => t.artist?.toLowerCase() === name.toLowerCase());
        return {
          artist: name,
          name,
          plays,
          count: plays,
          percentage: Math.min(100, Math.round((plays / totalValidMonthArtistPlays) * 100)),
          avatar: sample?.thumbnail || ''
        };
      })
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5);

    const monthLabelStr = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const monthlyRecap = {
      periodLabel: monthLabelStr,
      monthLabel: monthLabelStr,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      totalListeningSeconds: monthlySeconds,
      totalListeningMinutes: Math.round(monthlySeconds / 60),
      totalHours: (monthlySeconds / 3600).toFixed(1),
      totalListeningHours: (monthlySeconds / 3600).toFixed(1),
      totalPlays: monthlyValidPlays,
      distinctTracksCount: Object.keys(monthlyTrackCounts).length,
      distinctArtistsCount: Object.keys(monthlyArtistCounts).length,
      peakDay: peakMDay,
      peakDayHours: peakMHours,
      dailyActivity: monthlyDailyActivity,
      topTracks: monthlyTopTracks,
      topSongs: monthlyTopTracks,
      topArtists: monthlyTopArtists,
      hasData: monthlyValidPlays > 0 || monthlySeconds >= 10,
      isVerified: false
    };

    // Streaks calculation from dailySeconds
    const activeDays = Object.keys(stats.dailySeconds || {}).filter(d => (stats.dailySeconds[d] || 0) > 0).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const yestDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = `${yestDate.getFullYear()}-${String(yestDate.getMonth() + 1).padStart(2, '0')}-${String(yestDate.getDate()).padStart(2, '0')}`;

    const activeSet = new Set(activeDays);
    if (activeSet.has(todayStr) || activeSet.has(yesterdayStr)) {
      let d = activeSet.has(todayStr) ? new Date() : yestDate;
      while (true) {
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (activeSet.has(dStr)) {
          currentStreak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }
    }
    let tempStreak = 1;
    for (let i = 1; i < activeDays.length; i++) {
      const p = new Date(activeDays[i - 1]);
      const c = new Date(activeDays[i]);
      if (Math.round((c - p) / (1000 * 60 * 60 * 24)) === 1) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 1;
      }
    }
    if (currentStreak > longestStreak) longestStreak = currentStreak;

    const streaks = {
      currentStreak,
      longestStreak,
      totalActiveDays: activeSet.size,
      lastActiveDate: activeDays.length > 0 ? activeDays[activeDays.length - 1] : null
    };

    return {
      success: true,
      userId: userOrId ? (userOrId._id || userOrId.userId || userOrId.id || userOrId) : null,
      updatedAt: stats.updatedAt || new Date().toISOString(),
      weeklyRecap,
      monthlyRecap,
      allTimeStats,
      streaks,
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

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        fetch(`${base}/api/analytics/playback-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
          keepalive: true
        }).then(res => {
          clearTimeout(timeoutId);
          if (!res.ok && res.status >= 500) {
            queueFailedPlaybackEvent(`${base}/api/analytics/playback-event`, token, payload);
          }
        }).catch(() => {
          clearTimeout(timeoutId);
          // Controlled non-blocking fallback to legacy endpoint
          const fallbackCtrl = new AbortController();
          const fallbackTimeout = setTimeout(() => fallbackCtrl.abort(), 4000);
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
            signal: fallbackCtrl.signal,
            keepalive: true
          }).then(res => {
            clearTimeout(fallbackTimeout);
            if (!res.ok && res.status >= 500) {
              queueFailedPlaybackEvent(`${base}/api/analytics/playback-event`, token, payload);
            }
          }).catch(() => {
            clearTimeout(fallbackTimeout);
            queueFailedPlaybackEvent(`${base}/api/analytics/playback-event`, token, payload);
          });
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

    stats.playEvents = stats.playEvents || [];
    stats.playEvents.unshift({
      trackId,
      title,
      artist,
      thumbnail,
      timestamp: now.toISOString(),
      seconds: Math.round(durationSeconds),
      playSessionId: `local_${now.getTime()}`,
      eventType: 'completed'
    });
    if (stats.playEvents.length > 100) stats.playEvents = stats.playEvents.slice(0, 100);

    stats.updatedAt = now.toISOString();
    saveStats(stats, userOrId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('loopra_listening_stats_updated', {
        detail: { trackId, user: userOrId, timestamp: now.toISOString() }
      }));
    }
  },

  clearStats(userOrId = null) {
    try {
      localStorage.removeItem(getStorageKeyForUser(userOrId));
    } catch (e) {}
  },

  clearLocalStats(userOrId = null) {
    try {
      localStorage.removeItem(getStorageKeyForUser(userOrId));
      localStorage.removeItem(STORAGE_KEY_GUEST);
      localStorage.removeItem('loopra_cached_stats_data');
    } catch (e) {}
  }
};

export const computeLocalStats = (userOrId) => listeningStatsService.computeLocalStats(userOrId);
export const fetchStats = (opts) => listeningStatsService.fetchStats(opts);
export const recordEvent = (opts) => listeningStatsService.recordEvent(opts);
export const clearLocalStats = (userOrId) => listeningStatsService.clearLocalStats(userOrId);

export default listeningStatsService;
