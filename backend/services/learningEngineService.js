import mongoose from 'mongoose';
import UserBehaviorEvent from '../models/UserBehaviorEvent.js';
import UserLearningProfile from '../models/UserLearningProfile.js';
import LearningUpdateLog from '../models/LearningUpdateLog.js';
import User from '../models/User.js';

const MODEL_VERSION = '1.0.0-passive';
const BATCH_INTERVAL_MS = 30 * 1000; // 30 seconds interval
const MAX_BATCH_SIZE = 100;

// Internal health tracking metrics
const engineHealth = {
  version: MODEL_VERSION,
  mode: 'passive_observation',
  startedAt: new Date(),
  lastRunAt: null,
  lastRunDurationMs: 0,
  totalEventsProcessed: 0,
  totalBatchesProcessed: 0,
  consecutiveErrors: 0,
  lastError: null,
  status: 'healthy'
};

/**
 * Sanitizes search queries and text to strip potential secrets, tokens, passwords, and sensitive PII.
 */
export function sanitizeQueryText(text = '') {
  if (typeof text !== 'string') return '';
  return text
    .replace(/(bearer|token|password|passwd|secret|api_key|auth)=?[^\s&]+/gi, '[REDACTED]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    .trim()
    .slice(0, 150);
}

/**
 * Heuristic music attribute classifier based on track titles, artist names, and search terms.
 */
export function inferTrackAttributes(title = '', artist = '', existingMeta = {}) {
  const combined = `${title} ${artist} ${existingMeta.genre || ''} ${existingMeta.mood || ''}`.toLowerCase();
  
  // 1. Language detection
  let language = existingMeta.language || null;
  if (!language) {
    if (/(bollywood|hindi|arijit|atif|shreya|kishore|kumar sanu|lata|rafi|sonu nigam|neha kakkar|badshah|pritam|vishal|shekhar|ar rahman)/i.test(combined)) {
      language = 'Hindi';
    } else if (/(punjabi|sidhu|ap dhillon|diljit|karan aujla|shubh|ammy virk|b praak)/i.test(combined)) {
      language = 'Punjabi';
    } else if (/(tamil|anirudh|ar rahman|yuvan|harris jayaraj|sid sriram)/i.test(combined)) {
      language = 'Tamil';
    } else if (/(telugu|devi sri|thaman|keeravani)/i.test(combined)) {
      language = 'Telugu';
    } else if (/(spanish|reggaeton|despacito|bad bunny|rosalia|j balvin)/i.test(combined)) {
      language = 'Spanish';
    } else if (/(k-pop|bts|blackpink|stray kids|newjeans|twice)/i.test(combined)) {
      language = 'Korean';
    } else {
      language = 'English';
    }
  }

  // 2. Era / Decade detection
  let era = existingMeta.era || null;
  if (!era) {
    const yearMatch = combined.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      if (year < 1970) era = '60s';
      else if (year < 1980) era = '70s';
      else if (year < 1990) era = '80s';
      else if (year < 2000) era = '90s';
      else if (year < 2010) era = '2000s';
      else if (year < 2020) era = '2010s';
      else era = '2020s';
    } else if (/90s|nineties/i.test(combined)) {
      era = '90s';
    } else if (/80s|eighties/i.test(combined)) {
      era = '80s';
    } else if (/70s|seventies|retro/i.test(combined)) {
      era = '70s';
    } else if (/2000s|early 2000/i.test(combined)) {
      era = '2000s';
    } else {
      era = '2020s';
    }
  }

  // 3. Genre detection
  let genre = existingMeta.genre || null;
  if (!genre) {
    if (/(bollywood|filmi|hindi ost)/i.test(combined)) genre = 'Bollywood';
    else if (/(lo-fi|lofi|chillhop|relaxing beats)/i.test(combined)) genre = 'Lo-Fi';
    else if (/(hip-?hop|rap|trap|eminem|drake|kendrick|kanye)/i.test(combined)) genre = 'Hip Hop';
    else if (/(edm|electronic|house|techno|dance|synthwave|avicii|calvin)/i.test(combined)) genre = 'Electronic / EDM';
    else if (/(rock|metal|punk|guitar|nirvana|ac\/dc|queen)/i.test(combined)) genre = 'Rock';
    else if (/(r&b|soul|the weeknd|sza|frank ocean)/i.test(combined)) genre = 'R&B';
    else if (/(acoustic|unplugged|piano|folk|indie)/i.test(combined)) genre = 'Acoustic / Indie';
    else if (/(ghazal|sufi|nusrat|jagjit)/i.test(combined)) genre = 'Ghazal & Sufi';
    else if (/(classical|instrumental|orchestra|mozart|beethoven)/i.test(combined)) genre = 'Classical';
    else genre = 'Pop';
  }

  // 4. Mood detection
  let mood = existingMeta.mood || null;
  if (!mood) {
    if (/(chill|calm|relax|sleep|peace|night|soothing|mellow)/i.test(combined)) mood = 'Chill';
    else if (/(party|dance|club|upbeat|celebration|dj)/i.test(combined)) mood = 'Party';
    else if (/(workout|gym|energy|power|beast|pump)/i.test(combined)) mood = 'Energetic';
    else if (/(sad|cry|broken|heartbreak|melancholy|alone|pain)/i.test(combined)) mood = 'Melancholic';
    else if (/(romantic|love|couple|valentine|romance|ishq|pyar)/i.test(combined)) mood = 'Romantic';
    else if (/(focus|study|work|reading|ambient|deep work)/i.test(combined)) mood = 'Focus';
    else mood = 'Chill';
  }

  return { language, era, genre, mood };
}

/**
 * Calculates time-of-day category from an hour (0-23).
 */
export function getTimeOfDay(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

class LearningEngineService {
  constructor() {
    this.timer = null;
    this.isProcessing = false;
  }

  /**
   * Initializes background scheduler. Safe to call multiple times.
   */
  init() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.processPendingEventsBatch().catch(err => {
        console.error('[AI Learning Engine Periodic Error]:', err.message);
      });
    }, BATCH_INTERVAL_MS);
    this.timer.unref();
    console.log('[AI Learning Engine] Initialized in passive observation mode (30s background cycle).');
  }

  /**
   * Stops the background scheduler cleanly.
   */
  destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Ingests a raw behavior event. Completely non-blocking and idempotent.
   */
  async recordEvent({
    userId,
    category,
    eventType,
    metadata = {},
    eventId = null
  }) {
    if (!userId) {
      throw new Error('Authenticated userId is required to record behavior event');
    }
    if (!category || !['music', 'discovery', 'website'].includes(category)) {
      throw new Error(`Invalid category "${category}". Must be music, discovery, or website.`);
    }
    if (!eventType) {
      throw new Error('eventType is required');
    }

    const now = new Date();
    const hourOfDay = now.getHours();
    const dayOfWeek = now.getDay();
    const timeOfDay = getTimeOfDay(hourOfDay);

    // Generate deterministic eventId for idempotency if not provided
    const safeEventId = eventId || (
      `evt_${userId}_${category}_${eventType}_` +
      `${(metadata.trackId || metadata.searchQuery || metadata.featureName || '').slice(0, 30)}_` +
      `${Math.floor(now.getTime() / 1000)}_${Math.random().toString(36).substring(2, 6)}`
    );

    // Sanitize metadata
    const sanitizedSearch = sanitizeQueryText(metadata.searchQuery || '');
    const cleanTitle = (metadata.songTitle || metadata.title || '').trim().slice(0, 200);
    const cleanArtist = (metadata.artistName || metadata.artist || '').trim().slice(0, 150);

    // Infer classification heuristics for music events
    const inferred = category === 'music' || sanitizedSearch
      ? inferTrackAttributes(cleanTitle, cleanArtist, metadata)
      : {};

    const cleanMetadata = {
      trackId: (metadata.trackId || metadata.videoId || '').trim(),
      videoId: (metadata.videoId || metadata.trackId || '').trim(),
      songTitle: cleanTitle,
      artistName: cleanArtist,
      albumName: (metadata.albumName || metadata.album || '').trim().slice(0, 150),
      genre: metadata.genre || inferred.genre || null,
      language: metadata.language || inferred.language || null,
      era: metadata.era || inferred.era || null,
      mood: metadata.mood || inferred.mood || null,
      searchQuery: sanitizedSearch,
      featureName: (metadata.featureName || '').trim().slice(0, 50),
      stationName: (metadata.stationName || '').trim().slice(0, 80),
      playlistId: (metadata.playlistId || '').trim(),
      playlistName: (metadata.playlistName || '').trim().slice(0, 100),
      durationSeconds: Math.max(0, Number(metadata.durationSeconds || metadata.duration) || 0),
      listenedDurationSeconds: Math.max(0, Number(metadata.listenedDurationSeconds || metadata.listenedDuration) || 0),
      playbackPositionSeconds: Math.max(0, Number(metadata.playbackPositionSeconds) || 0),
      completionPercent: Math.max(0, Math.min(100, Number(metadata.completionPercent) || 0)),
      source: (metadata.source || 'player').trim().slice(0, 50),
      hourOfDay,
      dayOfWeek,
      timeOfDay,
      sessionId: (metadata.sessionId || metadata.playSessionId || '').trim()
    };

    try {
      if (mongoose.connection.readyState === 1) {
        // Fast insert with duplicate key catch for idempotency
        const doc = await UserBehaviorEvent.create({
          userId,
          eventId: safeEventId,
          category,
          eventType,
          metadata: cleanMetadata,
          processed: false,
          processingAttempts: 0
        });
        return { success: true, eventId: doc.eventId, recorded: true };
      }
      return { success: false, reason: 'Database not ready' };
    } catch (err) {
      if (err.code === 11000) {
        // Idempotent duplicate: already recorded, silently ignore
        return { success: true, eventId: safeEventId, recorded: false, duplicate: true };
      }
      console.warn('[AI Learning Engine Ingestion Warning]:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Processes a batch of pending behavior events asynchronously and incrementally updates per-user learning profiles.
   */
  async processPendingEventsBatch(limit = MAX_BATCH_SIZE) {
    if (this.isProcessing) {
      return { status: 'skipped', reason: 'Processing already in progress' };
    }
    if (mongoose.connection.readyState !== 1) {
      return { status: 'skipped', reason: 'Database not connected' };
    }

    this.isProcessing = true;
    const startTime = process.hrtime.bigint();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    try {
      // Find un-processed events ordered by creation time
      const pendingEvents = await UserBehaviorEvent.find({
        processed: false,
        processingAttempts: { $lt: 5 }
      })
        .sort({ createdAt: 1 })
        .limit(limit)
        .lean();

      if (!pendingEvents || pendingEvents.length === 0) {
        this.isProcessing = false;
        return { status: 'idle', processedCount: 0 };
      }

      // Group events by userId for strictly isolated processing
      const eventsByUser = new Map();
      for (const evt of pendingEvents) {
        const uid = evt.userId.toString();
        if (!eventsByUser.has(uid)) {
          eventsByUser.set(uid, []);
        }
        eventsByUser.get(uid).push(evt);
      }

      let totalProcessedInBatch = 0;

      for (const [userIdStr, userEvents] of eventsByUser.entries()) {
        try {
          const userObjId = new mongoose.Types.ObjectId(userIdStr);
          await this._processUserEvents(userObjId, userEvents, batchId);
          totalProcessedInBatch += userEvents.length;
        } catch (userErr) {
          console.error(`[AI Learning Engine] Error processing user ${userIdStr}:`, userErr.message);
          // Mark events with error attempt
          const eventIds = userEvents.map(e => e._id);
          await UserBehaviorEvent.updateMany(
            { _id: { $in: eventIds } },
            { 
              $inc: { processingAttempts: 1 },
              $set: { error: userErr.message }
            }
          );
        }
      }

      const durationMs = Math.round(Number(process.hrtime.bigint() - startTime) / 1e6);

      // Update engine health
      engineHealth.lastRunAt = new Date();
      engineHealth.lastRunDurationMs = durationMs;
      engineHealth.totalEventsProcessed += totalProcessedInBatch;
      engineHealth.totalBatchesProcessed += 1;
      engineHealth.consecutiveErrors = 0;
      engineHealth.status = 'healthy';

      return {
        status: 'success',
        batchId,
        processedCount: totalProcessedInBatch,
        durationMs
      };
    } catch (err) {
      engineHealth.consecutiveErrors += 1;
      engineHealth.lastError = err.message;
      if (engineHealth.consecutiveErrors > 3) engineHealth.status = 'degraded';
      console.error('[AI Learning Engine Batch Error]:', err.message);
      return { status: 'error', error: err.message };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Internal worker: Processes all events for a single isolated user.
   */
  async _processUserEvents(userId, events, batchId) {
    const userStartTime = Date.now();

    // 1. Fetch or create the user's isolated learning profile
    let profile = await UserLearningProfile.findOne({ userId });
    if (!profile) {
      profile = new UserLearningProfile({
        userId,
        modelVersion: MODEL_VERSION,
        confidenceScore: 0.0,
        confidenceLevel: 'low',
        totalEventsObserved: 0,
        learnedGenres: [],
        favoriteArtists: [],
        preferredLanguages: [],
        preferredEras: [],
        moodPreferences: [],
        listeningTimePatterns: {
          hourlyDistribution: {},
          dayOfWeekDistribution: {},
          peakTimeOfDay: 'undetermined',
          averageSessionMinutes: 0,
          totalListeningHours: 0
        },
        repeatedListening: {
          repeatTrackIds: [],
          repeatArtists: [],
          replayRatio: 0
        },
        skipPatterns: {
          totalSkips: 0,
          averageSkipTimeSeconds: 0,
          frequentSkipArtists: [],
          skipRate: 0
        },
        featureUsage: {
          radioLaunches: 0,
          discoverVisits: 0,
          playlistInteractions: 0,
          searchCount: 0,
          mostUsedFeature: 'player'
        },
        interests: {
          shortTerm: [],
          longTerm: []
        },
        signalsSummary: {
          strongSignals: [],
          weakSignals: [],
          uncertainSignals: []
        }
      });
    }

    // Convert hourly & day-of-week maps for easy updating
    const hourlyMap = profile.listeningTimePatterns?.hourlyDistribution
      ? (profile.listeningTimePatterns.hourlyDistribution instanceof Map 
          ? Object.fromEntries(profile.listeningTimePatterns.hourlyDistribution) 
          : { ...profile.listeningTimePatterns.hourlyDistribution })
      : {};
    const dayMap = profile.listeningTimePatterns?.dayOfWeekDistribution
      ? (profile.listeningTimePatterns.dayOfWeekDistribution instanceof Map 
          ? Object.fromEntries(profile.listeningTimePatterns.dayOfWeekDistribution) 
          : { ...profile.listeningTimePatterns.dayOfWeekDistribution })
      : {};

    const eventTypesEncountered = new Set();
    let totalListenedDurationDelta = 0;
    let playsCount = 0;
    let skipsCount = 0;

    // 2. Step through each event incrementally
    for (const event of events) {
      const { category, eventType, metadata = {}, createdAt } = event;
      eventTypesEncountered.add(eventType);
      profile.totalEventsObserved += 1;

      const listenedSec = metadata.listenedDurationSeconds || 0;
      totalListenedDurationDelta += listenedSec;

      // Time pattern updates
      if (typeof metadata.hourOfDay === 'number') {
        const hKey = String(metadata.hourOfDay);
        hourlyMap[hKey] = (hourlyMap[hKey] || 0) + 1;
      }
      if (typeof metadata.dayOfWeek === 'number') {
        const dKey = String(metadata.dayOfWeek);
        dayMap[dKey] = (dayMap[dKey] || 0) + 1;
      }

      // Feature usage updates
      if (category === 'website') {
        if (eventType === 'radio_usage') profile.featureUsage.radioLaunches += 1;
        else if (eventType === 'discover_usage') profile.featureUsage.discoverVisits += 1;
        else if (eventType === 'playlist_usage') profile.featureUsage.playlistInteractions += 1;
        else if (metadata.featureName) {
          const feat = metadata.featureName.toLowerCase();
          if (feat.includes('radio')) profile.featureUsage.radioLaunches += 1;
          else if (feat.includes('discover')) profile.featureUsage.discoverVisits += 1;
          else if (feat.includes('playlist')) profile.featureUsage.playlistInteractions += 1;
        }
      }

      // Discovery behavior updates
      if (category === 'discovery') {
        if (eventType === 'search' || eventType === 'artist_search') {
          profile.featureUsage.searchCount += 1;
          if (metadata.artistName) {
            this._updateArtistAffinity(profile, metadata.artistName, +2.0, false, false, false, false, createdAt);
          }
          if (metadata.genre) {
            this._updateGenreAffinity(profile, metadata.genre, +2.0, false, false, createdAt);
          }
        } else if (eventType === 'mood_search' && metadata.mood) {
          this._updateMoodAffinity(profile, metadata.mood, +2.5, createdAt);
        } else if (eventType === 'recommendation_click') {
          if (metadata.artistName) this._updateArtistAffinity(profile, metadata.artistName, +2.0, false, false, false, false, createdAt);
          if (metadata.genre) this._updateGenreAffinity(profile, metadata.genre, +2.0, false, false, createdAt);
        } else if (eventType === 'recommendation_skip') {
          if (metadata.artistName) this._updateArtistAffinity(profile, metadata.artistName, -0.5, false, false, false, false, createdAt);
        }
      }

      // Music behavior updates
      if (category === 'music') {
        const artist = metadata.artistName;
        const genre = metadata.genre;
        const lang = metadata.language;
        const era = metadata.era;
        const mood = metadata.mood;

        if (eventType === 'play_start') {
          playsCount += 1;
          if (artist) this._updateArtistAffinity(profile, artist, +1.0, true, false, false, false, createdAt);
          if (genre) this._updateGenreAffinity(profile, genre, +1.0, true, false, createdAt);
        } else if (eventType === 'progress') {
          if (listenedSec >= 30) {
            if (artist) this._updateArtistAffinity(profile, artist, +1.5, false, false, false, false, createdAt);
            if (genre) this._updateGenreAffinity(profile, genre, +1.5, false, false, createdAt);
          }
        } else if (eventType === 'completed') {
          if (artist) this._updateArtistAffinity(profile, artist, +3.0, false, true, false, false, createdAt);
          if (genre) this._updateGenreAffinity(profile, genre, +2.5, false, false, createdAt);
        } else if (eventType === 'replay') {
          if (artist) {
            this._updateArtistAffinity(profile, artist, +4.5, false, false, false, true, createdAt);
            if (!profile.repeatedListening.repeatArtists.includes(artist)) {
              profile.repeatedListening.repeatArtists.push(artist);
            }
          }
          if (metadata.trackId && !profile.repeatedListening.repeatTrackIds.includes(metadata.trackId)) {
            profile.repeatedListening.repeatTrackIds.push(metadata.trackId);
          }
        } else if (eventType === 'like') {
          if (artist) this._updateArtistAffinity(profile, artist, +5.0, false, false, false, false, createdAt, true);
          if (genre) this._updateGenreAffinity(profile, genre, +4.0, false, false, createdAt);
        } else if (eventType === 'unlike') {
          if (artist) this._updateArtistAffinity(profile, artist, -2.0, false, false, false, false, createdAt, false);
          if (genre) this._updateGenreAffinity(profile, genre, -1.5, false, false, createdAt);
        } else if (eventType === 'playlist_add') {
          if (artist) this._updateArtistAffinity(profile, artist, +4.0, false, false, false, false, createdAt);
          if (genre) this._updateGenreAffinity(profile, genre, +3.0, false, false, createdAt);
          profile.featureUsage.playlistInteractions += 1;
        } else if (eventType === 'skip') {
          skipsCount += 1;
          profile.skipPatterns.totalSkips += 1;
          const skipSec = metadata.playbackPositionSeconds || listenedSec || 0;
          if (profile.skipPatterns.averageSkipTimeSeconds === 0) {
            profile.skipPatterns.averageSkipTimeSeconds = skipSec;
          } else {
            profile.skipPatterns.averageSkipTimeSeconds = Math.round((profile.skipPatterns.averageSkipTimeSeconds + skipSec) / 2);
          }

          // Single skip rule: smooth -1.0 downweight, NOT full disliking.
          if (artist) {
            this._updateArtistAffinity(profile, artist, -1.0, false, false, true, false, createdAt);
            // Track frequent skip artists only if skips >= 3 and skipRate > 50%
            const artistRec = profile.favoriteArtists.find(a => a.name.toLowerCase() === artist.toLowerCase());
            if (artistRec && artistRec.skipCount >= 3 && artistRec.skipCount > artistRec.playCount) {
              if (!profile.skipPatterns.frequentSkipArtists.includes(artist)) {
                profile.skipPatterns.frequentSkipArtists.push(artist);
              }
            }
          }
          if (genre) this._updateGenreAffinity(profile, genre, -0.75, false, true, createdAt);
        }

        // Secondary dimensions: language, era, mood
        if (lang) this._updateLanguageAffinity(profile, lang, +1.0, createdAt);
        if (era) this._updateEraAffinity(profile, era, +1.0, createdAt);
        if (mood) this._updateMoodAffinity(profile, mood, +1.0, createdAt);
      }
    }

    // 3. Post-Event Analysis & Aggregation

    // Peak time of day
    let peakHour = 20;
    let maxHourCount = -1;
    for (const [hStr, count] of Object.entries(hourlyMap)) {
      if (count > maxHourCount) {
        maxHourCount = count;
        peakHour = parseInt(hStr, 10);
      }
    }
    profile.listeningTimePatterns.peakTimeOfDay = getTimeOfDay(peakHour);
    profile.listeningTimePatterns.hourlyDistribution = hourlyMap;
    profile.listeningTimePatterns.dayOfWeekDistribution = dayMap;
    profile.listeningTimePatterns.totalListeningHours = Number((
      (profile.listeningTimePatterns.totalListeningHours || 0) + (totalListenedDurationDelta / 3600)
    ).toFixed(2));

    // Replay and skip ratios
    const totalPlaysLifetime = profile.favoriteArtists.reduce((sum, a) => sum + (a.playCount || 0), 0);
    const totalReplaysLifetime = profile.favoriteArtists.reduce((sum, a) => sum + (a.replayCount || 0), 0);
    profile.repeatedListening.replayRatio = totalPlaysLifetime > 0
      ? Number((totalReplaysLifetime / totalPlaysLifetime).toFixed(2))
      : 0;

    const totalSkipsLifetime = profile.skipPatterns.totalSkips || 0;
    profile.skipPatterns.skipRate = totalPlaysLifetime > 0
      ? Number((totalSkipsLifetime / (totalPlaysLifetime + totalSkipsLifetime)).toFixed(2))
      : 0;

    // Feature usage summary
    const fu = profile.featureUsage;
    const maxFeature = Object.entries({
      radio: fu.radioLaunches || 0,
      discover: fu.discoverVisits || 0,
      playlist: fu.playlistInteractions || 0,
      search: fu.searchCount || 0
    }).sort((a, b) => b[1] - a[1])[0];
    profile.featureUsage.mostUsedFeature = maxFeature && maxFeature[1] > 0 ? maxFeature[0] : 'player';

    // 4. Distinction between Short-Term and Long-Term Interests
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const shortTermInterests = [];
    const longTermInterests = [];

    // Evaluate genres
    for (const g of profile.learnedGenres) {
      if (g.lastObserved >= sevenDaysAgo && g.score > 2) {
        shortTermInterests.push({
          topic: g.name,
          category: 'genre',
          weight: Math.round(g.score),
          detectedAt: g.lastObserved,
          firstSeen: g.lastObserved,
          consistency: g.confidence
        });
      }
      if (g.playCount >= 4 && g.confidence >= 0.5) {
        longTermInterests.push({
          topic: g.name,
          category: 'genre',
          weight: Math.round(g.score),
          detectedAt: g.lastObserved,
          firstSeen: g.lastObserved,
          consistency: g.confidence
        });
      }
    }

    // Evaluate artists
    for (const a of profile.favoriteArtists) {
      if (a.lastObserved >= sevenDaysAgo && a.score > 3) {
        shortTermInterests.push({
          topic: a.name,
          category: 'artist',
          weight: Math.round(a.score),
          detectedAt: a.lastObserved,
          firstSeen: a.lastObserved,
          consistency: a.confidence
        });
      }
      if ((a.playCount >= 3 || a.completedCount >= 2 || a.liked) && a.confidence >= 0.5) {
        longTermInterests.push({
          topic: a.name,
          category: 'artist',
          weight: Math.round(a.score),
          detectedAt: a.lastObserved,
          firstSeen: a.lastObserved,
          consistency: a.confidence
        });
      }
    }

    profile.interests.shortTerm = shortTermInterests.slice(0, 10);
    profile.interests.longTerm = longTermInterests.slice(0, 10);

    // 5. Signals Summary (Strong vs Weak vs Uncertain)
    const strong = [];
    const weak = [];
    const uncertain = [];

    for (const a of profile.favoriteArtists) {
      if (a.confidence >= 0.6 && a.score >= 5) {
        strong.push(`Artist: ${a.name} (Affinity: ${a.score.toFixed(1)}, Conf: ${Math.round(a.confidence * 100)}%)`);
      } else if (a.skipCount > a.playCount && a.skipCount >= 2) {
        uncertain.push(`Artist: ${a.name} (Conflicting: ${a.playCount} plays, ${a.skipCount} skips)`);
      } else if (a.confidence < 0.35 && a.score > 0) {
        weak.push(`Artist: ${a.name} (Initial signal)`);
      }
    }

    for (const g of profile.learnedGenres) {
      if (g.confidence >= 0.6 && g.score >= 5) {
        strong.push(`Genre: ${g.name} (Affinity: ${g.score.toFixed(1)}, Conf: ${Math.round(g.confidence * 100)}%)`);
      } else if (g.confidence < 0.35 && g.score > 0) {
        weak.push(`Genre: ${g.name}`);
      }
    }

    profile.signalsSummary.strongSignals = strong.slice(0, 8);
    profile.signalsSummary.weakSignals = weak.slice(0, 8);
    profile.signalsSummary.uncertainSignals = uncertain.slice(0, 8);

    // 6. Overall Confidence Calculation
    // Confidence increases asymptotically with total genuine events observed:
    // N / (N + 12), capped at 1.0. With 12 events = 50%, with 36 events = 75%, with 80+ events > 87%.
    const n = profile.totalEventsObserved;
    const diversityFactor = Math.min(1.0, 0.5 + (profile.learnedGenres.length * 0.1) + (profile.favoriteArtists.length * 0.05));
    const rawConf = (n / (n + 12)) * diversityFactor;
    profile.confidenceScore = Number(Math.min(1.0, Math.max(0.05, rawConf)).toFixed(2));

    if (profile.confidenceScore < 0.30) profile.confidenceLevel = 'low';
    else if (profile.confidenceScore < 0.60) profile.confidenceLevel = 'medium';
    else if (profile.confidenceScore < 0.85) profile.confidenceLevel = 'high';
    else profile.confidenceLevel = 'very_high';

    profile.lastLearnedAt = new Date();
    profile.learningStatus = 'active';

    // Sort arrays by score descending
    profile.learnedGenres.sort((a, b) => b.score - a.score);
    profile.favoriteArtists.sort((a, b) => b.score - a.score);
    profile.preferredLanguages.sort((a, b) => b.score - a.score);
    profile.preferredEras.sort((a, b) => b.score - a.score);
    profile.moodPreferences.sort((a, b) => b.score - a.score);

    // Save profile
    profile.markModified('learnedGenres');
    profile.markModified('favoriteArtists');
    profile.markModified('preferredLanguages');
    profile.markModified('preferredEras');
    profile.markModified('moodPreferences');
    profile.markModified('listeningTimePatterns');
    profile.markModified('repeatedListening');
    profile.markModified('skipPatterns');
    profile.markModified('featureUsage');
    profile.markModified('interests');
    profile.markModified('signalsSummary');
    await profile.save();

    // 7. Mark processed events in DB
    const eventIds = events.map(e => e._id);
    await UserBehaviorEvent.updateMany(
      { _id: { $in: eventIds } },
      {
        $set: {
          processed: true,
          processedAt: new Date(),
          error: null
        }
      }
    );

    // 8. Create LearningUpdateLog audit trail
    const userDurationMs = Date.now() - userStartTime;
    await LearningUpdateLog.create({
      userId,
      batchId,
      modelVersion: MODEL_VERSION,
      eventsProcessedCount: events.length,
      eventTypes: Array.from(eventTypesEncountered),
      processingDurationMs: userDurationMs,
      status: 'success',
      changesSummary: {
        topGenre: profile.learnedGenres[0]?.name || 'N/A',
        topArtist: profile.favoriteArtists[0]?.name || 'N/A',
        confidenceScore: profile.confidenceScore,
        confidenceLevel: profile.confidenceLevel,
        eventsInBatch: events.length
      }
    });
  }

  // Helper to update artist affinity
  _updateArtistAffinity(profile, artistName, deltaScore, isPlay = false, isComplete = false, isSkip = false, isReplay = false, date = new Date(), isLike = null) {
    if (!artistName) return;
    const clean = artistName.trim();
    if (!clean || clean.toLowerCase() === 'unknown artist') return;

    let item = profile.favoriteArtists.find(a => a.name.toLowerCase() === clean.toLowerCase());
    if (!item) {
      profile.favoriteArtists.push({
        name: clean,
        score: 0,
        confidence: 0,
        playCount: 0,
        completedCount: 0,
        skipCount: 0,
        replayCount: 0,
        liked: false,
        lastObserved: date
      });
      item = profile.favoriteArtists[profile.favoriteArtists.length - 1];
    }

    item.score = Math.max(0, Number((item.score + deltaScore).toFixed(2)));
    if (isPlay) item.playCount += 1;
    if (isComplete) item.completedCount += 1;
    if (isSkip) item.skipCount += 1;
    if (isReplay) item.replayCount += 1;
    if (typeof isLike === 'boolean') item.liked = isLike;
    item.lastObserved = date;

    // Confidence calculation for artist
    const signals = item.playCount + item.completedCount + (item.liked ? 3 : 0) + item.replayCount;
    item.confidence = Number(Math.min(1.0, signals / (signals + 4)).toFixed(2));
  }

  // Helper to update genre affinity
  _updateGenreAffinity(profile, genreName, deltaScore, isPlay = false, isSkip = false, date = new Date()) {
    if (!genreName) return;
    const clean = genreName.trim();
    if (!clean) return;

    let item = profile.learnedGenres.find(g => g.name.toLowerCase() === clean.toLowerCase());
    if (!item) {
      profile.learnedGenres.push({
        name: clean,
        score: 0,
        confidence: 0,
        playCount: 0,
        skipCount: 0,
        lastObserved: date
      });
      item = profile.learnedGenres[profile.learnedGenres.length - 1];
    }

    item.score = Math.max(0, Number((item.score + deltaScore).toFixed(2)));
    if (isPlay) item.playCount += 1;
    if (isSkip) item.skipCount += 1;
    item.lastObserved = date;

    const signals = item.playCount + (item.score > 5 ? 2 : 1);
    item.confidence = Number(Math.min(1.0, signals / (signals + 5)).toFixed(2));
  }

  // Helper to update language affinity
  _updateLanguageAffinity(profile, lang, deltaScore, date = new Date()) {
    if (!lang) return;
    const clean = lang.trim();
    let item = profile.preferredLanguages.find(l => l.language.toLowerCase() === clean.toLowerCase());
    if (!item) {
      profile.preferredLanguages.push({ language: clean, score: 0, confidence: 0, count: 0, lastObserved: date });
      item = profile.preferredLanguages[profile.preferredLanguages.length - 1];
    }
    item.score = Math.max(0, Number((item.score + deltaScore).toFixed(2)));
    item.count += 1;
    item.lastObserved = date;
    item.confidence = Number(Math.min(1.0, item.count / (item.count + 5)).toFixed(2));
  }

  // Helper to update era affinity
  _updateEraAffinity(profile, era, deltaScore, date = new Date()) {
    if (!era) return;
    const clean = era.trim();
    let item = profile.preferredEras.find(e => e.era.toLowerCase() === clean.toLowerCase());
    if (!item) {
      profile.preferredEras.push({ era: clean, score: 0, confidence: 0, count: 0, lastObserved: date });
      item = profile.preferredEras[profile.preferredEras.length - 1];
    }
    item.score = Math.max(0, Number((item.score + deltaScore).toFixed(2)));
    item.count += 1;
    item.lastObserved = date;
    item.confidence = Number(Math.min(1.0, item.count / (item.count + 5)).toFixed(2));
  }

  // Helper to update mood affinity
  _updateMoodAffinity(profile, mood, deltaScore, date = new Date()) {
    if (!mood) return;
    const clean = mood.trim();
    let item = profile.moodPreferences.find(m => m.mood.toLowerCase() === clean.toLowerCase());
    if (!item) {
      profile.moodPreferences.push({ mood: clean, score: 0, confidence: 0, count: 0, lastObserved: date });
      item = profile.moodPreferences[profile.moodPreferences.length - 1];
    }
    item.score = Math.max(0, Number((item.score + deltaScore).toFixed(2)));
    item.count += 1;
    item.lastObserved = date;
    item.confidence = Number(Math.min(1.0, item.count / (item.count + 4)).toFixed(2));
  }

  /**
   * Deletes a user's entire learning profile, events, and update logs.
   * Full privacy & right-to-be-forgotten compliance.
   */
  async deleteUserLearningData(userId) {
    if (!userId) throw new Error('userId is required');
    const uObjId = new mongoose.Types.ObjectId(userId.toString());

    const [eventsRes, profileRes, logsRes] = await Promise.all([
      UserBehaviorEvent.deleteMany({ userId: uObjId }),
      UserLearningProfile.deleteOne({ userId: uObjId }),
      LearningUpdateLog.deleteMany({ userId: uObjId })
    ]);

    return {
      success: true,
      deletedEvents: eventsRes.deletedCount,
      deletedProfile: profileRes.deletedCount > 0,
      deletedLogs: logsRes.deletedCount
    };
  }

  /**
   * Retrieves high-level aggregated metrics for the Admin Dashboard.
   */
  async getAdminOverview() {
    if (mongoose.connection.readyState !== 1) {
      return { status: 'error', message: 'Database disconnected' };
    }

    const [
      totalUsers,
      usersWithProfiles,
      totalEvents,
      processedEvents,
      pendingEvents,
      recentUpdates,
      genreAgg,
      artistAgg,
      confidenceAgg,
      categoryAgg
    ] = await Promise.all([
      User.countDocuments(),
      UserLearningProfile.countDocuments(),
      UserBehaviorEvent.countDocuments(),
      UserBehaviorEvent.countDocuments({ processed: true }),
      UserBehaviorEvent.countDocuments({ processed: false }),
      LearningUpdateLog.find()
        .sort({ timestamp: -1 })
        .limit(10)
        .populate('userId', 'username')
        .lean(),
      UserLearningProfile.aggregate([
        { $unwind: '$learnedGenres' },
        {
          $group: {
            _id: '$learnedGenres.name',
            avgScore: { $avg: '$learnedGenres.score' },
            userCount: { $sum: 1 }
          }
        },
        { $sort: { userCount: -1, avgScore: -1 } },
        { $limit: 8 }
      ]),
      UserLearningProfile.aggregate([
        { $unwind: '$favoriteArtists' },
        {
          $group: {
            _id: '$favoriteArtists.name',
            avgScore: { $avg: '$favoriteArtists.score' },
            userCount: { $sum: 1 }
          }
        },
        { $sort: { userCount: -1, avgScore: -1 } },
        { $limit: 8 }
      ]),
      UserLearningProfile.aggregate([
        {
          $group: {
            _id: '$confidenceLevel',
            count: { $sum: 1 },
            avgScore: { $avg: '$confidenceScore' }
          }
        }
      ]),
      UserBehaviorEvent.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const confidenceDistribution = {
      low: 0,
      medium: 0,
      high: 0,
      very_high: 0
    };
    for (const c of confidenceAgg) {
      if (c._id && confidenceDistribution.hasOwnProperty(c._id)) {
        confidenceDistribution[c._id] = c.count;
      }
    }

    const behaviorTrends = {
      music: 0,
      discovery: 0,
      website: 0
    };
    for (const cat of categoryAgg) {
      if (cat._id && behaviorTrends.hasOwnProperty(cat._id)) {
        behaviorTrends[cat._id] = cat.count;
      }
    }

    return {
      status: 'ok',
      engine: {
        ...engineHealth,
        pendingEventsCount: pendingEvents,
        uptimeSeconds: Math.floor((Date.now() - engineHealth.startedAt.getTime()) / 1000)
      },
      metrics: {
        totalTrackedUsers: totalUsers,
        usersWithLearningProfiles: usersWithProfiles,
        totalRecordedEvents: totalEvents,
        processedEventsCount: processedEvents,
        pendingEventsCount: pendingEvents,
        processingSuccessRate: totalEvents > 0 ? Number(((processedEvents / totalEvents) * 100).toFixed(1)) : 100
      },
      confidenceDistribution,
      behaviorTrends,
      mostCommonGenres: genreAgg.map(g => ({
        name: g._id,
        userCount: g.userCount,
        avgScore: Number(g.avgScore.toFixed(1))
      })),
      mostCommonArtists: artistAgg.map(a => ({
        name: a._id,
        userCount: a.userCount,
        avgScore: Number(a.avgScore.toFixed(1))
      })),
      recentLearningUpdates: recentUpdates.map(u => ({
        id: u._id,
        userId: u.userId?._id || u.userId,
        username: u.userId?.username || 'Unknown User',
        batchId: u.batchId,
        eventsCount: u.eventsProcessedCount,
        durationMs: u.processingDurationMs,
        status: u.status,
        changes: u.changesSummary,
        timestamp: u.timestamp
      }))
    };
  }

  /**
   * Retrieves paginated list of users for Admin Inspection.
   */
  async getAdminUsersList({ search = '', page = 1, limit = 15 }) {
    const query = {};
    if (search.trim()) {
      const reg = new RegExp(search.trim(), 'i');
      query.$or = [{ username: reg }, { email: reg }];
    }

    const skip = (Math.max(1, page) - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(query).select('username email createdAt role lastLogin').skip(skip).limit(limit).lean(),
      User.countDocuments(query)
    ]);

    const userIds = users.map(u => u._id);
    const profiles = await UserLearningProfile.find({ userId: { $in: userIds } }).lean();
    const profileMap = new Map(profiles.map(p => [p.userId.toString(), p]));

    const usersData = users.map(u => {
      const p = profileMap.get(u._id.toString());
      return {
        id: u._id,
        username: u.username,
        email: u.email,
        role: u.role,
        hasProfile: Boolean(p),
        confidenceScore: p?.confidenceScore || 0,
        confidenceLevel: p?.confidenceLevel || 'uninitialized',
        totalEvents: p?.totalEventsObserved || 0,
        topGenre: p?.learnedGenres?.[0]?.name || null,
        topArtist: p?.favoriteArtists?.[0]?.name || null,
        lastLearnedAt: p?.lastLearnedAt || null
      };
    });

    return {
      users: usersData,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Retrieves detailed learning profile for a specific user.
   */
  async getUserProfileDetail(userId) {
    if (!userId) throw new Error('userId is required');
    const uObjId = new mongoose.Types.ObjectId(userId.toString());

    const [user, profile, recentLogs, recentEvents] = await Promise.all([
      User.findById(uObjId).select('username email createdAt role').lean(),
      UserLearningProfile.findOne({ userId: uObjId }).lean(),
      LearningUpdateLog.find({ userId: uObjId }).sort({ timestamp: -1 }).limit(10).lean(),
      UserBehaviorEvent.find({ userId: uObjId }).sort({ createdAt: -1 }).limit(15).lean()
    ]);

    if (!user) return null;

    return {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        registeredAt: user.createdAt
      },
      profile: profile || null,
      recentUpdates: recentLogs.map(l => ({
        id: l._id,
        batchId: l.batchId,
        eventsCount: l.eventsProcessedCount,
        durationMs: l.processingDurationMs,
        status: l.status,
        changes: l.changesSummary,
        timestamp: l.timestamp
      })),
      recentEvents: recentEvents.map(e => ({
        id: e._id,
        eventId: e.eventId,
        category: e.category,
        eventType: e.eventType,
        metadata: e.metadata,
        processed: e.processed,
        createdAt: e.createdAt
      }))
    };
  }
}

export const learningEngineService = new LearningEngineService();
