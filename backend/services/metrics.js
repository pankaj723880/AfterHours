// In-Memory Live Metrics & Diagnostics Service with Bounded Retention

class MetricsService {
  constructor() {
    this.startTime = Date.now();
    this.requestsTotal = 0;
    this.requestsByStatus = {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0
    };
    this.endpointHits = new Map(); // path -> count
    this.latencyHistory = []; // numbers, max 200
    this.requestTimestamps = []; // timestamps for RPM (last 60s)
    this.recentErrors = []; // max 50 sanitized errors
    this.slowRequests = []; // max 20 requests > 500ms
    
    // YouTube API & Scraper Metrics
    this.youtubeStats = {
      totalSearches: 0,
      apiHits: 0,
      scraperHits: 0,
      fallbackHits: 0,
      quotaErrors: 0,
      invalidKeyErrors: 0
    };

    // Music & Playback Analytics
    this.musicStats = {
      totalPlays: 0,
      playAttempts: 0,
      playErrors: 0,
      searchQueries: new Map() // query -> count
    };

    // Connection tracking
    this.activeSockets = 0;
    this.activeAuthenticatedUsers = new Set();
  }

  recordRequest({ method, path, status, duration, ip }) {
    // Ignore Render keepalive /health from skewing general traffic metrics
    const isHealthCheck = path === '/health' || path === '/';

    this.requestsTotal++;
    const now = Date.now();

    // Categorize status code
    if (status >= 200 && status < 300) this.requestsByStatus['2xx']++;
    else if (status >= 300 && status < 400) this.requestsByStatus['3xx']++;
    else if (status >= 400 && status < 500) this.requestsByStatus['4xx']++;
    else if (status >= 500) this.requestsByStatus['5xx']++;

    if (!isHealthCheck) {
      // Endpoint frequency (sanitize path to remove query strings or raw IDs)
      const sanitizedPath = path.split('?')[0].replace(/\/[0-9a-fA-F]{24}/g, '/:id');
      const currentCount = this.endpointHits.get(sanitizedPath) || 0;
      this.endpointHits.set(sanitizedPath, currentCount + 1);

      // Latency history (keep last 200)
      this.latencyHistory.push(duration);
      if (this.latencyHistory.length > 200) this.latencyHistory.shift();

      // Requests per minute tracking
      this.requestTimestamps.push(now);
      this.cleanupTimestamps(now);

      // Slow requests (> 500ms)
      if (duration > 500) {
        this.slowRequests.unshift({
          timestamp: new Date().toISOString(),
          method,
          path: sanitizedPath,
          status,
          duration
        });
        if (this.slowRequests.length > 20) this.slowRequests.pop();
      }
    }
  }

  cleanupTimestamps(now = Date.now()) {
    const oneMinuteAgo = now - 60000;
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < oneMinuteAgo) {
      this.requestTimestamps.shift();
    }
  }

  recordError({ method, path, status, message, ip }) {
    const sanitizedPath = path ? path.split('?')[0] : 'unknown';
    this.recentErrors.unshift({
      timestamp: new Date().toISOString(),
      method: method || 'GET',
      path: sanitizedPath,
      status: status || 500,
      message: (message || 'Unknown error').replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, '[REDACTED_URI]').slice(0, 200),
      ip: ip ? ip.replace(/:\d+$/, '') : 'unknown'
    });
    if (this.recentErrors.length > 50) this.recentErrors.pop();
  }

  recordYouTube(type) {
    this.youtubeStats.totalSearches++;
    if (type === 'api') this.youtubeStats.apiHits++;
    else if (type === 'scraper') this.youtubeStats.scraperHits++;
    else if (type === 'fallback') this.youtubeStats.fallbackHits++;
    else if (type === 'quota') this.youtubeStats.quotaErrors++;
    else if (type === 'invalid_key') this.youtubeStats.invalidKeyErrors++;
  }

  recordMusicEvent({ type, query, trackId, title }) {
    if (type === 'play_start') this.musicStats.totalPlays++;
    else if (type === 'play_attempt') this.musicStats.playAttempts++;
    else if (type === 'play_error') this.musicStats.playErrors++;
    else if (type === 'search' && query) {
      const cleanQ = query.trim().toLowerCase().slice(0, 50);
      const count = this.musicStats.searchQueries.get(cleanQ) || 0;
      this.musicStats.searchQueries.set(cleanQ, count + 1);
    }
  }

  updateSocketCount(activeSockets, authenticatedUserIds) {
    this.activeSockets = activeSockets;
    this.activeAuthenticatedUsers = new Set(authenticatedUserIds || []);
  }

  getSnapshot() {
    this.cleanupTimestamps();
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - this.startTime) / 1000);

    // Calculate average latency
    const avgLatency = this.latencyHistory.length > 0
      ? Math.round(this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length)
      : 0;

    // Top endpoints sorted by count
    const topEndpoints = Array.from(this.endpointHits.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));

    // Top search terms
    const topSearches = Array.from(this.musicStats.searchQueries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    // Error rate percentage
    const errorCount = this.requestsByStatus['4xx'] + this.requestsByStatus['5xx'];
    const errorRate = this.requestsTotal > 0
      ? ((errorCount / this.requestsTotal) * 100).toFixed(1)
      : '0.0';

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      activeVisitors: this.activeSockets,
      activeAuthenticatedUsers: this.activeAuthenticatedUsers.size,
      requestsTotal: this.requestsTotal,
      requestsPerMinute: this.requestTimestamps.length,
      avgLatencyMs: avgLatency,
      errorRatePercent: parseFloat(errorRate),
      requestsByStatus: { ...this.requestsByStatus },
      topEndpoints,
      slowRequests: this.slowRequests.slice(0, 10),
      recentErrors: this.recentErrors.slice(0, 15),
      youtubeStats: { ...this.youtubeStats },
      musicStats: {
        totalPlays: this.musicStats.totalPlays,
        playAttempts: this.musicStats.playAttempts,
        playErrors: this.musicStats.playErrors,
        topSearches
      }
    };
  }
}

export const metricsService = new MetricsService();
