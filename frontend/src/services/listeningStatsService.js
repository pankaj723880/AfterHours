/**
 * Loopra Listening Statistics & Recap Service
 * Records meaningful playback events (> 20s duration threshold)
 * Computes lifetime metrics, top tracks, top artists, and 7-day weekly recaps.
 */

const STORAGE_KEY_STATS = 'afterhours_listening_stats';

function getStoredStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATS);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    totalListeningSeconds: 0,
    playEvents: [], // { trackId, title, artist, timestamp, seconds }
    trackPlayCounts: {}, // trackId -> { title, artist, count, lastPlayed }
    artistPlayCounts: {}, // artist -> count
    dailySeconds: {}, // 'YYYY-MM-DD' -> seconds
  };
}

function saveStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
  } catch (e) {}
}

export const listeningStatsService = {
  // Record a completed meaningful play count once threshold (30s) is reached
  recordPlay(track, durationSeconds = 30) {
    if (!track || (!track.id && !track.videoId)) return;

    const stats = getStoredStats();
    const now = new Date();
    const trackId = track.id || track.videoId;
    const title = track.title || 'Unknown Track';
    const artist = track.artist || track.channel || 'Unknown Artist';

    // Track play counts
    if (!stats.trackPlayCounts[trackId]) {
      stats.trackPlayCounts[trackId] = { title, artist, count: 0, lastPlayed: now.toISOString() };
    }
    stats.trackPlayCounts[trackId].count += 1;
    stats.trackPlayCounts[trackId].lastPlayed = now.toISOString();

    // Artist play counts
    if (artist && artist !== 'Unknown Artist') {
      stats.artistPlayCounts[artist] = (stats.artistPlayCounts[artist] || 0) + 1;
    }

    // Keep last 150 raw events for recap slicing
    stats.playEvents = [
      { trackId, title, artist, timestamp: now.toISOString(), seconds: Math.round(durationSeconds) },
      ...(stats.playEvents || []).slice(0, 149)
    ];

    saveStats(stats);
  },

  // Record cumulative listening seconds incrementally
  recordListeningTime(seconds = 1) {
    if (seconds <= 0) return;
    const stats = getStoredStats();
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);

    stats.totalListeningSeconds = (stats.totalListeningSeconds || 0) + Math.round(seconds);
    stats.dailySeconds[dateKey] = (stats.dailySeconds[dateKey] || 0) + Math.round(seconds);

    saveStats(stats);
  },

  // Backward compatible record session
  recordListeningSession(track, durationSeconds = 30) {
    this.recordListeningTime(durationSeconds);
    this.recordPlay(track, durationSeconds);
  },

  // Get aggregated overview
  getOverview() {
    const stats = getStoredStats();
    const totalSecs = stats.totalListeningSeconds || 0;
    const totalMinutes = Math.round(totalSecs / 60);
    const totalHours = (totalSecs / 3600).toFixed(1);

    // Sort top tracks
    const topTracks = Object.entries(stats.trackPlayCounts || {})
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Sort top artists
    const topArtists = Object.entries(stats.artistPlayCounts || {})
      .map(([artist, count]) => ({ artist, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      totalListeningSeconds: totalSecs,
      totalMinutes,
      totalHours,
      totalPlays: Object.values(stats.trackPlayCounts || {}).reduce((acc, t) => acc + (t.count || 0), 0),
      distinctTracksCount: Object.keys(stats.trackPlayCounts || {}).length,
      topTracks,
      topArtists,
      dailySeconds: stats.dailySeconds || {}
    };
  },

  // Compute 7-day Weekly Recap
  getWeeklyRecap() {
    const stats = getStoredStats();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentEvents = (stats.playEvents || []).filter(e => new Date(e.timestamp).getTime() >= sevenDaysAgo);

    if (recentEvents.length === 0) {
      return null;
    }

    let weeklySeconds = 0;
    const trackCounts = {};
    const artistCounts = {};
    const dayCounts = {};

    recentEvents.forEach(e => {
      weeklySeconds += e.seconds || 0;

      trackCounts[e.trackId] = trackCounts[e.trackId] || { title: e.title, artist: e.artist, count: 0 };
      trackCounts[e.trackId].count += 1;

      if (e.artist && e.artist !== 'Unknown Artist') {
        artistCounts[e.artist] = (artistCounts[e.artist] || 0) + 1;
      }

      const dayName = new Date(e.timestamp).toLocaleDateString('en-US', { weekday: 'short' });
      dayCounts[dayName] = (dayCounts[dayName] || 0) + (e.seconds || 0);
    });

    const topTracks = Object.entries(trackCounts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topArtists = Object.entries(artistCounts)
      .map(([artist, count]) => ({ artist, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Most active day
    const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      periodLabel: 'Past 7 Days',
      totalListeningMinutes: Math.round(weeklySeconds / 60),
      totalHours: (weeklySeconds / 3600).toFixed(1),
      distinctTracksCount: Object.keys(trackCounts).length,
      totalPlays: recentEvents.length,
      topTracks,
      topArtists,
      peakDay
    };
  },

  clearStats() {
    try {
      localStorage.removeItem(STORAGE_KEY_STATS);
    } catch (e) {}
  }
};
