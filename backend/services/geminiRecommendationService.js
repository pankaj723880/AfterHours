import { GoogleGenAI } from '@google/genai';
import { getCanonicalSongKey, TrackDeduplicator } from './recommendationHistoryService.js';

// In-memory diagnostics accumulator (No sensitive data)
export const geminiDiagnostics = {
  totalRequests: 0,
  successfulGenerations: 0,
  failedGenerations: 0,
  lastError: null,
  lastLatencyMs: 0,
  averageLatencyMs: 0,
  cacheHits: 0,
  cacheMisses: 0,
  fallbackGenerations: 0,
  modelName: 'gemini-3.8-flash'
};

export const geminiRecommendationService = {
  /**
   * Initializes GoogleGenAI client safely.
   */
  getClient() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return null;
    }
    return new GoogleGenAI({ apiKey: apiKey.trim() });
  },

  /**
   * Checks if Gemini API key is configured and available.
   */
  isConfigured() {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    return Boolean(key && typeof key === 'string' && key.trim().length > 10);
  },

  /**
   * Generates AI-personalized recommendations using Gemini Flash.
   * Constrained strictly to valid catalog candidate IDs.
   */
  async generateRecommendations(userProfile, candidates) {
    geminiDiagnostics.totalRequests += 1;
    const startTime = Date.now();

    const client = this.getClient();
    if (!client) {
      geminiDiagnostics.failedGenerations += 1;
      geminiDiagnostics.fallbackGenerations += 1;
      geminiDiagnostics.lastError = 'GEMINI_API_KEY not configured';
      return null; // Will trigger graceful catalog fallback
    }

    // Build Candidate Lookup Map to validate all AI responses
    const candidateMap = new Map();
    const compactCandidates = [];

    for (const c of candidates) {
      const id = c.id || c.videoId;
      if (!id) continue;
      candidateMap.set(id, c);
      compactCandidates.push({
        id,
        title: c.title,
        artist: c.artist || c.channel || 'Artist',
        genre: c.genre || 'Desi'
      });
    }

    // Prepare compact, privacy-safe user profile (Zero PII, Zero tokens, Zero emails)
    const compactProfile = {
      topArtists: (userProfile.topArtists || []).slice(0, 8).map(a => `${a.name} (Score: ${a.score})`),
      favoriteGenres: (userProfile.topGenres || []).slice(0, 4).map(g => g.name),
      favoriteMoods: (userProfile.topMoods || []).slice(0, 4).map(m => m.name),
      recentListenedTracks: (userProfile.recentTracks || []).slice(0, 6).map(t => `${t.title} - ${t.artist}`),
      skippedCount: userProfile.skippedTrackIds?.length || 0,
      totalCompletedListens: userProfile.totalCompletedListens || 0
    };

    const prompt = `
You are the expert Music Recommendation Engine for Loopra, a high-fidelity retro & modern desi/global streaming sanctuary.
Analyze the user's listening profile and select the most fitting songs strictly from the provided candidate catalogue.

### User Listening Profile:
${JSON.stringify(compactProfile, null, 2)}

### Candidate Song Catalogue (Available to Select From):
${JSON.stringify(compactCandidates.slice(0, 40), null, 2)}

### CRITICAL INSTRUCTIONS:
1. You MUST ONLY pick song IDs that exist verbatim in the "Candidate Song Catalogue" above.
2. DO NOT invent, hallucinate, or generate any new YouTube IDs, URLs, or tracks not in the list.
3. Organize the selected songs into the following structured sections:
   - "madeForYou": Top 5-8 songs tailored to their overall artist, mood, and genre affinity.
   - "dailyMix": 4-6 songs offering a cohesive, smooth listening blend of familiar favorites.
   - "discover": 3-5 high-quality tracks that broaden their musical horizon with novel artists or adjacent genres.
   * ABSOLUTE RULE ACROSS ALL SECTIONS: Every section ("madeForYou", "dailyMix", "discover", "moreLikeRecent") MUST BE COMPLETELY MUTUALLY DISJOINT. No song ID or song title may appear in more than one section.
   - "becauseYouListenedToReason": A brief 1-sentence explanation of who or what inspired this mix (e.g., "Because you enjoy romantic melodies by Arijit Singh").
   - "moreLikeRecent": 3-5 songs matching the vibe of their recent plays.
4. For each selected song, provide:
   - "id": the exact matching candidate ID
   - "reason": a concise, friendly reason (e.g., "Matches your love for soulful acoustic vocals")

Output strictly valid JSON complying with this structure.
`;

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    try {
      // Use Interactions API with structured response format
      const response = await client.interactions.create({
        model: modelName,
        input: prompt,
        response_format: {
          type: 'json_object'
        }
      });

      const latency = Date.now() - startTime;
      geminiDiagnostics.lastLatencyMs = latency;
      geminiDiagnostics.averageLatencyMs = geminiDiagnostics.averageLatencyMs === 0
        ? latency
        : Math.round((geminiDiagnostics.averageLatencyMs + latency) / 2);
      geminiDiagnostics.modelName = modelName;

      let rawOutput = response.output_text;
      if (!rawOutput && response.steps) {
        // Fallback for steps output
        for (const step of response.steps) {
          if (step.content) {
            for (const part of step.content) {
              if (part.text) rawOutput = part.text;
            }
          }
        }
      }

      if (!rawOutput) {
        throw new Error('Gemini returned empty response text');
      }

      // Parse JSON response safely
      let parsed;
      try {
        const cleanedJson = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleanedJson);
      } catch (parseErr) {
        throw new Error('Failed to parse Gemini JSON output: ' + parseErr.message);
      }

      // STRICT VALIDATION & CROSS-SECTION DEDUPLICATION
      const globalDeduplicator = new TrackDeduplicator();

      const validateAndHydrate = (items = [], sectionSource = 'gemini') => {
        if (!Array.isArray(items)) return [];
        const hydrated = [];

        for (const item of items) {
          const trackId = typeof item === 'string' ? item : item?.id;
          if (!trackId || !candidateMap.has(trackId)) continue;

          const fullTrack = candidateMap.get(trackId);
          if (globalDeduplicator.isDuplicate(fullTrack)) continue;

          globalDeduplicator.add(fullTrack);
          hydrated.push({
            ...fullTrack,
            reason: item?.reason || 'Recommended by Gemini AI',
            source: sectionSource
          });
        }
        return hydrated;
      };

      const hydratedMadeForYou = validateAndHydrate(parsed.madeForYou, 'gemini');
      let hydratedDailyMix = validateAndHydrate(parsed.dailyMix, 'gemini');

      // Backfill dailyMix if empty from candidates without violating deduplication
      if (hydratedDailyMix.length < 4) {
        for (const cand of candidates) {
          if (globalDeduplicator.isDuplicate(cand)) continue;
          globalDeduplicator.add(cand);
          hydratedDailyMix.push({
            ...cand,
            reason: 'Curated daily hit',
            source: 'gemini_supplemented'
          });
          if (hydratedDailyMix.length >= 5) break;
        }
      }

      let distinctDiscover = validateAndHydrate(parsed.discover, 'gemini');

      // Backfill discover from candidate pool if needed with novel tracks
      if (distinctDiscover.length < 4) {
        for (const cand of candidates) {
          if (globalDeduplicator.isDuplicate(cand)) continue;
          globalDeduplicator.add(cand);
          distinctDiscover.push({
            ...cand,
            reason: 'Broaden your taste with adjacent sounds',
            source: 'gemini_supplemented'
          });
          if (distinctDiscover.length >= 5) break;
        }
      }

      // Hydrate moreLikeRecent without violating deduplication
      let hydratedMoreLikeRecent = validateAndHydrate(parsed.moreLikeRecent, 'gemini');
      if (hydratedMoreLikeRecent.length < 3) {
        for (const cand of candidates) {
          if (globalDeduplicator.isDuplicate(cand)) continue;
          globalDeduplicator.add(cand);
          hydratedMoreLikeRecent.push({
            ...cand,
            reason: 'Vibes matching your recent listening',
            source: 'gemini_supplemented'
          });
          if (hydratedMoreLikeRecent.length >= 4) break;
        }
      }

      // Build becauseYouListenedTo with strictly disjoint tracks
      const recentTrack = userProfile.recentTracks?.[0] || null;
      let becauseRecs = [];
      if (recentTrack) {
        for (const cand of candidates) {
          if (globalDeduplicator.isDuplicate(cand)) continue;
          const art = (cand.artist || cand.channel || '').toLowerCase();
          const recentArt = (recentTrack.artist || '').toLowerCase();
          if (recentArt && (art.includes(recentArt) || recentArt.includes(art))) {
            globalDeduplicator.add(cand);
            becauseRecs.push({
              ...cand,
              reason: `Inspired by "${recentTrack.title}"`,
              source: 'gemini'
            });
            if (becauseRecs.length >= 4) break;
          }
        }
      }

      // Build favouriteArtists with strictly disjoint tracks
      const topArtistNames = (userProfile.topArtists || []).map(a => a.name.toLowerCase());
      const favArtistRecs = [];
      for (const cand of candidates) {
        if (globalDeduplicator.isDuplicate(cand)) continue;
        const art = (cand.artist || cand.channel || '').toLowerCase();
        if (topArtistNames.some(a => art.includes(a))) {
          globalDeduplicator.add(cand);
          favArtistRecs.push({
            ...cand,
            reason: `Because you love ${cand.artist}`,
            source: 'gemini'
          });
          if (favArtistRecs.length >= 6) break;
        }
      }

      geminiDiagnostics.successfulGenerations += 1;

      return {
        source: 'gemini',
        modelUsed: modelName,
        latencyMs: latency,
        insights: {
          dominantMood: compactProfile.favoriteMoods?.[0] || 'Soulful & Chill',
          topGenres: compactProfile.favoriteGenres || [],
          summary: parsed.becauseYouListenedToReason || `Curated for your unique taste in ${compactProfile.topArtists?.[0] || 'Bollywood Hits'}`
        },
        recommendations: {
          madeForYou: hydratedMadeForYou,
          dailyMix: hydratedDailyMix,
          discover: distinctDiscover,
          becauseYouListenedTo: recentTrack && becauseRecs.length > 0 ? {
            baseTrack: {
              id: recentTrack.trackId,
              videoId: recentTrack.trackId,
              title: recentTrack.title,
              artist: recentTrack.artist,
              thumbnail: recentTrack.thumbnail
            },
            recommendations: becauseRecs
          } : null,
          favouriteArtists: favArtistRecs,
          moreLikeRecent: hydratedMoreLikeRecent
        }
      };
    } catch (apiErr) {
      console.warn('[GeminiRecommendationService] Notice calling Gemini API:', apiErr.message);
      geminiDiagnostics.failedGenerations += 1;
      geminiDiagnostics.fallbackGenerations += 1;
      geminiDiagnostics.lastError = apiErr.message;
      return null; // Triggers catalog heuristic fallback
    }
  }
};

