import mongoose from 'mongoose';
import ActionMemory from '../models/ActionMemory.js';

class ChatBuddyLearningService {
  constructor() {
    this.memoryCache = new Map();
    this.userPreferences = new Map(); // userId -> { preferredVolume, topArtists: Set, language: 'hi'|'en' }
    this.recentExecutionBuffer = new Map(); // userId/clientKey -> { phrase, action, timestamp }
    this.isLoadedFromDb = false;
    this.initializeDefaultSeeds();
  }

  normalizePhrase(phrase = '') {
    return String(phrase)
      .toLowerCase()
      .trim()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  initializeDefaultSeeds() {
    const verifiedSeeds = [
      // Recap & Stats vs Activity vs History distinctions
      { phrase: 'recap and stats', intent: 'open_insights', actionType: 'OPEN_STATS', target: 'stats', handler: 'onOpenInsights' },
      { phrase: 'recap & stats', intent: 'open_insights', actionType: 'OPEN_STATS', target: 'stats', handler: 'onOpenInsights' },
      { phrase: 'recap', intent: 'open_insights', actionType: 'OPEN_STATS', target: 'stats', handler: 'onOpenInsights' },
      { phrase: 'stats', intent: 'open_insights', actionType: 'OPEN_STATS', target: 'stats', handler: 'onOpenInsights' },
      { phrase: 'listening stats', intent: 'open_insights', actionType: 'OPEN_STATS', target: 'stats', handler: 'onOpenInsights' },
      { phrase: 'stats dikhao', intent: 'open_insights', actionType: 'OPEN_STATS', target: 'stats', handler: 'onOpenInsights' },
      { phrase: 'recap kholo', intent: 'open_insights', actionType: 'OPEN_STATS', target: 'stats', handler: 'onOpenInsights' },
      { phrase: 'recap and stats kholo', intent: 'open_insights', actionType: 'OPEN_STATS', target: 'stats', handler: 'onOpenInsights' },
      { phrase: 'insights', intent: 'open_insights', actionType: 'OPEN_STATS', target: 'stats', handler: 'onOpenInsights' },
      { phrase: 'listening insights', intent: 'open_insights', actionType: 'OPEN_STATS', target: 'stats', handler: 'onOpenInsights' },

      // Dedicated Activity view
      { phrase: 'listening activity', intent: 'open_page', actionType: 'NAVIGATE', target: 'activity', handler: 'onNavigate' },
      { phrase: 'activity', intent: 'open_page', actionType: 'NAVIGATE', target: 'activity', handler: 'onNavigate' },
      { phrase: 'recently played', intent: 'open_page', actionType: 'NAVIGATE', target: 'activity', handler: 'onNavigate' },
      { phrase: 'recently played songs', intent: 'open_page', actionType: 'NAVIGATE', target: 'activity', handler: 'onNavigate' },
      { phrase: 'recently played songs dikha', intent: 'open_page', actionType: 'NAVIGATE', target: 'activity', handler: 'onNavigate' },
      { phrase: 'recently played dikha', intent: 'open_page', actionType: 'NAVIGATE', target: 'activity', handler: 'onNavigate' },
      { phrase: 'activity kholo', intent: 'open_page', actionType: 'NAVIGATE', target: 'activity', handler: 'onNavigate' },
      { phrase: 'listening activity kholo', intent: 'open_page', actionType: 'NAVIGATE', target: 'activity', handler: 'onNavigate' },

      // Dedicated History view
      { phrase: 'listening history', intent: 'open_page', actionType: 'NAVIGATE', target: 'history', handler: 'onNavigate' },
      { phrase: 'history', intent: 'open_page', actionType: 'NAVIGATE', target: 'history', handler: 'onNavigate' },
      { phrase: 'history kholo', intent: 'open_page', actionType: 'NAVIGATE', target: 'history', handler: 'onNavigate' },
      { phrase: 'purane songs', intent: 'open_page', actionType: 'NAVIGATE', target: 'history', handler: 'onNavigate' },

      // Library collections
      { phrase: 'liked songs', intent: 'open_page', actionType: 'NAVIGATE', target: 'favorites', handler: 'onNavigate' },
      { phrase: 'favorites', intent: 'open_page', actionType: 'NAVIGATE', target: 'favorites', handler: 'onNavigate' },
      { phrase: 'favorite songs', intent: 'open_page', actionType: 'NAVIGATE', target: 'favorites', handler: 'onNavigate' },
      { phrase: 'pasandida songs', intent: 'open_page', actionType: 'NAVIGATE', target: 'favorites', handler: 'onNavigate' },
      { phrase: 'playlists', intent: 'open_page', actionType: 'NAVIGATE', target: 'playlists', handler: 'onNavigate' },
      { phrase: 'my playlists', intent: 'open_page', actionType: 'NAVIGATE', target: 'playlists', handler: 'onNavigate' },

      // Radio & Explore
      { phrase: 'saloon fm', intent: 'open_page', actionType: 'NAVIGATE', target: 'saloon_fm', handler: 'onNavigate' },
      { phrase: 'horn ok please', intent: 'open_page', actionType: 'NAVIGATE', target: 'horn_ok_please', handler: 'onNavigate' },
      { phrase: 'theka', intent: 'open_page', actionType: 'NAVIGATE', target: 'theka', handler: 'onNavigate' },
      { phrase: 'trending', intent: 'open_section', actionType: 'NAVIGATE', target: 'trending', handler: 'onNavigate' },
      { phrase: 'trending songs', intent: 'open_section', actionType: 'NAVIGATE', target: 'trending', handler: 'onNavigate' }
    ];

    for (const seed of verifiedSeeds) {
      const norm = this.normalizePhrase(seed.phrase);
      this.memoryCache.set(`global:${norm}`, {
        userPhrase: seed.phrase,
        normalizedPhrase: norm,
        intent: seed.intent,
        actionType: seed.actionType,
        target: seed.target,
        query: seed.query || null,
        value: seed.value || null,
        handler: seed.handler,
        successCount: 10,
        failureCount: 0,
        confidenceScore: 0.99,
        verified: true,
        userId: 'global'
      });
    }
  }

  async loadFromDatabase() {
    if (this.isLoadedFromDb) return;
    try {
      const docs = await ActionMemory.find({ confidenceScore: { $gte: 0.75 } }).lean().limit(1000);
      for (const doc of docs) {
        const key = `${doc.userId || 'global'}:${doc.normalizedPhrase}`;
        this.memoryCache.set(key, doc);
      }
      this.isLoadedFromDb = true;
    } catch (e) {
      console.warn('[ChatBuddyLearning] DB load warning:', e.message);
    }
  }

  /**
   * 0ms in-memory Action Memory lookup.
   * If phrase matches a verified learned path with >= 0.85 confidence, returns the mapping immediately.
   */
  resolveFromMemory(phrase = '', userId = 'global') {
    const norm = this.normalizePhrase(phrase);
    if (!norm) return null;

    // Check user-specific memory first
    if (userId && userId !== 'global') {
      const userKey = `${userId}:${norm}`;
      const userMatch = this.memoryCache.get(userKey);
      if (userMatch && userMatch.confidenceScore >= 0.80 && userMatch.verified) {
        return userMatch;
      }
    }

    // Check global verified memory
    const globalKey = `global:${norm}`;
    const globalMatch = this.memoryCache.get(globalKey);
    if (globalMatch && globalMatch.confidenceScore >= 0.85 && globalMatch.verified) {
      return globalMatch;
    }

    // Fuzzy check for high-confidence substrings
    for (const [key, mem] of this.memoryCache.entries()) {
      if (mem.confidenceScore >= 0.90 && mem.verified) {
        if (norm === mem.normalizedPhrase || (norm.length > 5 && mem.normalizedPhrase.length > 5 && (norm.includes(mem.normalizedPhrase) || mem.normalizedPhrase.includes(norm)))) {
          // Guard against general conversations triggering substring matches
          if (mem.actionType !== 'NONE') {
            return mem;
          }
        }
      }
    }

    return null;
  }

  /**
   * Records execution of an action, boosting confidence on success and updating cache.
   */
  async recordExecution({
    userPhrase = '',
    intent = '',
    actionType = 'NONE',
    target = null,
    query = null,
    value = null,
    handler = null,
    success = true,
    userId = 'global'
  }) {
    const norm = this.normalizePhrase(userPhrase);
    if (!norm || norm.length < 2) return null;

    const key = `${userId}:${norm}`;
    let existing = this.memoryCache.get(key) || this.memoryCache.get(`global:${norm}`);

    let confidenceScore = existing ? existing.confidenceScore : 0.80;
    let successCount = existing ? existing.successCount : 0;
    let failureCount = existing ? existing.failureCount : 0;

    if (success) {
      successCount += 1;
      confidenceScore = Math.min(1.0, confidenceScore + 0.05);
    } else {
      failureCount += 1;
      confidenceScore = Math.max(0.1, confidenceScore - 0.20);
    }

    const verified = confidenceScore >= 0.80 && successCount >= 1;

    const memoryEntry = {
      userPhrase,
      normalizedPhrase: norm,
      intent,
      actionType,
      target,
      query,
      value,
      handler,
      successCount,
      failureCount,
      confidenceScore,
      verified,
      userId,
      lastExecutedAt: new Date()
    };

    // Fast in-memory cache update
    this.memoryCache.set(key, memoryEntry);
    this.recentExecutionBuffer.set(userId, { phrase: userPhrase, action: memoryEntry, timestamp: Date.now() });

    // Asynchronous background persistence to MongoDB if connected
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      ActionMemory.findOneAndUpdate(
        { normalizedPhrase: norm, userId },
        { $set: memoryEntry },
        { upsert: true, returnDocument: 'after' }
      ).catch(e => console.warn('[ChatBuddyLearning] Mongo upsert error:', e.message));
    }

    return memoryEntry;
  }

  /**
   * User issued a correction (e.g. "no, not that", "maine recap bola tha", "stop that").
   * Penalizes the previous execution to prevent repeating the mistake.
   */
  async recordCorrection(userId = 'global', correctedPhrase = '') {
    const recent = this.recentExecutionBuffer.get(userId);
    if (recent && Date.now() - recent.timestamp < 15000) {
      const failedEntry = recent.action;
      if (failedEntry) {
        failedEntry.failureCount = (failedEntry.failureCount || 0) + 1;
        failedEntry.confidenceScore = Math.max(0.1, (failedEntry.confidenceScore || 0.8) - 0.35);
        failedEntry.verified = false;

        const key = `${userId}:${failedEntry.normalizedPhrase}`;
        this.memoryCache.set(key, failedEntry);

        ActionMemory.findOneAndUpdate(
          { normalizedPhrase: failedEntry.normalizedPhrase, userId },
          { $set: { failureCount: failedEntry.failureCount, confidenceScore: failedEntry.confidenceScore, verified: false } }
        ).catch(() => {});
      }
    }
  }

  /**
   * Tracks user preferences (volume, favorite artists).
   */
  recordUserPreference(userId = 'global', { volume, artist, language }) {
    let pref = this.userPreferences.get(userId) || { topArtists: new Set(), preferredVolume: 80, language: 'hi' };
    if (volume !== undefined) pref.preferredVolume = volume;
    if (artist) pref.topArtists.add(artist);
    if (language) pref.language = language;
    this.userPreferences.set(userId, pref);
  }

  getUserPreferences(userId = 'global') {
    const pref = this.userPreferences.get(userId);
    if (!pref) return { preferredVolume: 80, topArtists: [], language: 'hi' };
    return {
      preferredVolume: pref.preferredVolume,
      topArtists: Array.from(pref.topArtists || []),
      language: pref.language
    };
  }

  /**
   * Diagnostic inspection stats for dev and admin review.
   */
  getStats() {
    let totalLearned = this.memoryCache.size;
    let verifiedCount = 0;
    for (const mem of this.memoryCache.values()) {
      if (mem.verified) verifiedCount++;
    }
    return {
      totalLearnedPatterns: totalLearned,
      verifiedPatterns: verifiedCount,
      activeUserPreferences: this.userPreferences.size
    };
  }

  /**
   * Safe autonomous reset or user-directed memory wipe.
   */
  async clearMemories(userId = null) {
    if (userId) {
      for (const [key, mem] of this.memoryCache.entries()) {
        if (mem.userId === userId) {
          this.memoryCache.delete(key);
        }
      }
      this.userPreferences.delete(userId);
      await ActionMemory.deleteMany({ userId }).catch(() => {});
    } else {
      this.memoryCache.clear();
      this.userPreferences.clear();
      this.initializeDefaultSeeds();
      await ActionMemory.deleteMany({ userId: { $ne: 'global' } }).catch(() => {});
    }
    return { success: true, message: 'Action memory cleared successfully' };
  }
}

export const chatBuddyLearningService = new ChatBuddyLearningService();
