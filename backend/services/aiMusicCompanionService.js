import { GoogleGenAI } from '@google/genai';
import { catalogService } from './catalogService.js';
import { listeningEventService } from './listeningEventService.js';
import { verifySingleSong, isSingleSong } from './songFilter.js';
import { recommendationHistoryService, getCanonicalSongKey, cleanSongTitle } from './recommendationHistoryService.js';

export const aiCompanionDiagnostics = {
  totalChats: 0,
  successfulAiChats: 0,
  fallbackChats: 0,
  lastLatencyMs: 0,
  lastError: null
};

/**
 * Returns dynamic, server-authoritative date and time with timezone awareness.
 * Never hardcodes date or year.
 */
export function getCurrentDateTimeInfo() {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const formattedLocal = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone
  }).format(now);
  const formattedUTC = now.toUTCString();
  const year = now.getFullYear();

  return {
    iso: now.toISOString(),
    utc: formattedUTC,
    local: formattedLocal,
    timeZone,
    year
  };
}

/**
 * Detects whether a user message is specifically asking for today's date or the current year.
 */
export function isDirectDateQuery(text = '') {
  const lower = text.toLowerCase().trim();
  return /^(what('s| is)?\s+(today'?s?\s+date|the\s+date|the\s+current\s+date|the\s+year|the\s+current\s+year|today'?s\s+day)|what\s+date\s+is\s+it|what\s+day\s+is\s+it\s+today)$/i.test(lower) ||
         /\b(what('s| is)?\s+(today'?s?\s+date|the\s+current\s+date))\b/i.test(lower);
}

/**
 * Detects whether a user message is inquiring about unverified facts, chart positions, or streaming statistics.
 */
export function isUnverifiedFactQuery(text = '') {
  const lower = text.toLowerCase();
  return /\b(unverified|unconfirmed|rumou?r|chart\s+position|billboard|how\s+many\s+streams|exact\s+stream|sales\s+numbers|statistics)\b/i.test(lower);
}

/**
 * Detects whether a user message is inquiring about current date/time, trending releases, or live music news.
 */
export function isTimeSensitiveQuery(text = '') {
  const lower = text.toLowerCase();
  return /\b(today|today'?s?|now|current|current\s+date|latest|recent|new\s+release|new\s+song|fresh\s+release|trending|billboard|chart|grammy|hits?\s+of\s+\d{4}|this\s+year|this\s+month|this\s+week|202\d)\b/i.test(lower);
}

/**
 * Detects whether a message is asking about song credits or factual trivia.
 */
export function isSongDetailsInquiry(text = '') {
  const lower = text.toLowerCase();
  return /\b(who\s+(sang|sung|sing|is\s+singing|composed|wrote|directed|is\s+the\s+singer|is\s+the\s+composer|is\s+the\s+lyricist|is\s+the\s+music\s+director)|composer|singer|lyricist|music\s+director|written\s+by|what\s+album|what\s+movie|which\s+movie|release\s+year|original\s+or\s+remake|remake\s+of|cover\s+of|facts\s+about)\b/i.test(lower);
}

export const aiMusicCompanionService = {
  /**
   * Initializes GoogleGenAI safely.
   */
  getClient() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return null;
    }
    return new GoogleGenAI({ apiKey: apiKey.trim() });
  },

  isGeminiConfigured() {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    return Boolean(key && typeof key === 'string' && key.trim().length > 10);
  },

  /**
   * Builds an expansive, intent-matched candidate pool with strict single-song filtering.
   */
  async getCandidatePool(optionsOrProfile = null) {
    let userProfile = null;
    let message = '';
    let excludedKeys = new Set();
    let excludedIds = new Set();
    let excludedTitles = new Set();

    if (optionsOrProfile && typeof optionsOrProfile === 'object' && ('message' in optionsOrProfile || 'userProfile' in optionsOrProfile || 'excludedKeys' in optionsOrProfile)) {
      userProfile = optionsOrProfile.userProfile || null;
      message = optionsOrProfile.message || '';
      excludedKeys = optionsOrProfile.excludedKeys || new Set();
      excludedIds = optionsOrProfile.excludedIds || new Set();
      excludedTitles = optionsOrProfile.excludedTitles || new Set();
    } else {
      userProfile = optionsOrProfile;
    }

    try {
      const pool = await catalogService.buildCandidatePool({
        userPreferences: userProfile,
        message,
        excludedKeys,
        excludedIds,
        excludedTitles
      });
      return (pool || []).filter(t => isSingleSong(t));
    } catch (e) {
      const curated = await catalogService.getCuratedTracks();
      return (curated || []).filter(t => isSingleSong(t));
    }
  },

  /**
   * Detects if user requested to play a specific track from previous turn, e.g.
   * "play the 2nd one", "play the third song", "play number 1", "play Kesariya".
   */
  detectPlaybackRequest(message = '', history = [], candidatePool = []) {
    const lower = message.toLowerCase().trim();
    const playKeywords = ['play', 'start', 'listen to', 'put on', 'stream', 'resume'];
    const hasPlayIntent = playKeywords.some(kw => lower.includes(kw));

    if (!hasPlayIntent) return null;

    // Check if user is referencing an ordinal from the most recent assistant message
    const lastAssistantMsg = [...history].reverse().find(m => m.role === 'model' || m.role === 'assistant');
    const recentTracks = lastAssistantMsg?.tracks || [];

    // Ordinal rules (Checked in order of specificity to avoid 'one' colliding with 'second one')
    const ordinalRules = [
      { pattern: /\b(the\s+)?(second|2nd|number\s*2|track\s*2)\b/i, idx: 1 },
      { pattern: /\b(the\s+)?(third|3rd|number\s*3|track\s*3)\b/i, idx: 2 },
      { pattern: /\b(the\s+)?(fourth|4th|number\s*4|track\s*4)\b/i, idx: 3 },
      { pattern: /\b(the\s+)?(fifth|5th|number\s*5|track\s*5)\b/i, idx: 4 },
      { pattern: /\b(the\s+)?(last|final)\b/i, idx: recentTracks.length - 1 },
      { pattern: /\b(the\s+)?(first|1st|number\s*1|track\s*1)\b/i, idx: 0 }
    ];

    for (const rule of ordinalRules) {
      if (rule.pattern.test(lower) && recentTracks[rule.idx]) {
        return recentTracks[rule.idx];
      }
    }

    // Direct title matching against recent tracks
    for (const track of recentTracks) {
      if (!track.title) continue;
      const cleanTrackTitle = track.title.replace(/\(.*?\)|\[.*?\]|-.*$/g, '').trim().toLowerCase();
      if (lower.includes(track.title.toLowerCase()) || (cleanTrackTitle.length >= 3 && lower.includes(cleanTrackTitle))) {
        return track;
      }
    }

    // Direct title matching against candidate pool
    const querySubject = lower.replace(/^(play|start|listen to|put on|stream|resume)\s+/i, '').trim();
    for (const track of (candidatePool || []).slice(0, 35)) {
      if (!track.title) continue;
      const lowerTrackTitle = track.title.toLowerCase();
      const cleanTrackTitle = track.title.replace(/\(.*?\)|\[.*?\]|-.*$/g, '').trim().toLowerCase();
      if (
        lower.includes(lowerTrackTitle) ||
        (cleanTrackTitle.length >= 3 && lower.includes(cleanTrackTitle)) ||
        (querySubject.length >= 3 && (cleanTrackTitle.includes(querySubject) || lowerTrackTitle.includes(querySubject)))
      ) {
        return track;
      }
    }

    return null;
  },

  /**
   * Main conversational intelligence engine (Standard Fast Response).
   */
  async processChat({ user = null, userId = null, message = '', currentTrack = null, history = [], sessionKey = null }) {
    aiCompanionDiagnostics.totalChats += 1;
    const startTime = Date.now();
    const dateTimeInfo = getCurrentDateTimeInfo();

    const cleanMessage = (message || '').trim();
    if (!cleanMessage) {
      return {
        reply: `Hey there! I'm Loopra AI, your music companion. Today is ${dateTimeInfo.local}. Ask me about what's playing, request single-song recommendations, or explore fresh music releases!`,
        tracks: [],
        action: null
      };
    }

    const clientKey = userId || (user ? (user._id ? user._id.toString() : String(user.id || user)) : (sessionKey || 'guest'));

    // 1. FAST PATH: Check for direct playback intent FIRST ("play the 2nd one", "play Kesariya", etc.)
    const directTrackToPlay = this.detectPlaybackRequest(cleanMessage, history, []);
    if (directTrackToPlay) {
      return {
        reply: `🎵 Playing **"${directTrackToPlay.title}"** by ${directTrackToPlay.artist || 'Artist'} for you now. Enjoy the sound!`,
        tracks: [directTrackToPlay],
        action: {
          type: 'PLAY_TRACK',
          track: directTrackToPlay
        }
      };
    }

    // 2. Fetch user listening profile if authenticated
    let userProfile = null;
    if (user && user._id) {
      try {
        userProfile = await listeningEventService.getUserProfile(user._id);
      } catch (e) {
        console.warn('[AiCompanion] Profile fetch warning:', e.message);
      }
    }

    // 3. FAST PATH: Direct question about current date / year
    if (isDirectDateQuery(cleanMessage)) {
      return {
        reply: `Today is **${dateTimeInfo.local}** (${dateTimeInfo.timeZone}). What kind of music would you like to explore today?`,
        tracks: [],
        action: null
      };
    }

    // 4. FAST PATH: Query about currently playing song
    const lowerMsg = cleanMessage.toLowerCase();
    const isCurrentTrackInquiry = /what('s| is)?\s+(playing|this song)|who('s| is)?\s+(singing|the singer|artist)|tell me about this (song|track)|who composed|who wrote/i.test(lowerMsg);

    if (isCurrentTrackInquiry) {
      if (currentTrack && currentTrack.title) {
        if (this.isGeminiConfigured()) {
          try {
            const client = this.getClient();
            const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const prompt = `You are Loopra AI music companion. Today is ${dateTimeInfo.local}.
The user asks: "${cleanMessage}".
Current playing track: "${currentTrack.title}" by ${currentTrack.artist || 'Unknown'} (Album/Movie: ${currentTrack.album || 'Single'}).

Provide an accurate, concise 2-3 sentence answer about this song.
RULES:
1. Clearly distinguish between Singer (vocalist), Composer / Music Director, Lyricist, Album/Movie, and Release Year.
2. Never confuse the singer with the composer (e.g. Arijit Singh is a singer; Pritam is the composer).
3. Distinguish whether it is an original composition or a cover/remake.
4. If an exact credit is unverified, state that honestly rather than guessing.`;

            const aiRes = await client.models.generateContent({
              model: modelName,
              contents: prompt
            });
            const text = aiRes.text?.trim();
            if (text) {
              const verification = verifySingleSong(currentTrack);
              return {
                reply: text,
                tracks: [{
                  id: currentTrack.id || currentTrack.videoId,
                  videoId: currentTrack.videoId || currentTrack.id,
                  title: currentTrack.title,
                  artist: currentTrack.artist || 'Artist',
                  channel: currentTrack.channel || currentTrack.artist,
                  thumbnail: currentTrack.thumbnail,
                  duration: currentTrack.duration,
                  songType: verification.songType || 'individual_song',
                  verificationStatus: verification.verificationStatus || 'verified_single_song',
                  reason: 'Currently playing track'
                }],
                action: null
              };
            }
          } catch (e) {
            console.warn('[AiCompanion] Fast track inquiry AI notice:', e.message);
          }
        }

        const verification = verifySingleSong(currentTrack);
        return {
          reply: `You're currently listening to **"${currentTrack.title}"** by **${currentTrack.artist || 'Unknown Artist'}**! Would you like me to find songs with a similar vibe?`,
          tracks: [{
            id: currentTrack.id || currentTrack.videoId,
            videoId: currentTrack.videoId || currentTrack.id,
            title: currentTrack.title,
            artist: currentTrack.artist || 'Artist',
            channel: currentTrack.channel || currentTrack.artist,
            thumbnail: currentTrack.thumbnail,
            duration: currentTrack.duration,
            songType: verification.songType || 'individual_song',
            verificationStatus: verification.verificationStatus || 'verified_single_song',
            reason: 'Currently playing track'
          }],
          action: null
        };
      } else {
        return {
          reply: "There is no music currently playing in Loopra. Tap play on any song or ask me for a recommendation to get your session started!",
          tracks: [],
          action: null
        };
      }
    }

    // 5. Load persistent recommendation exclusion history for this user/session
    const { excludedIds, excludedKeys, excludedTitles, excludedList } =
      await recommendationHistoryService.getExclusionSets(clientKey, history);

    // If user explicitly asks for a previous song by name ("play Kesariya", "recommend Tum Hi Ho again", etc.)
    const explicitTrack = recommendationHistoryService.checkExplicitRequest(cleanMessage, excludedList);
    if (explicitTrack) {
      excludedIds.delete(explicitTrack.trackId);
      excludedIds.delete(explicitTrack.videoId);
      excludedKeys.delete(explicitTrack.canonicalKey);
      excludedTitles.delete(explicitTrack.cleanTitle);
    }

    // 6. Retrieve dynamic candidate pool tailored to user message intent & preferences
    let candidatePool = await this.getCandidatePool({
      userProfile,
      message: cleanMessage,
      excludedKeys,
      excludedIds,
      excludedTitles
    });

    // If this is a time-sensitive query (e.g. latest releases, trending 2026, new songs), retrieve fresh verified releases
    let freshReleases = [];
    if (isTimeSensitiveQuery(cleanMessage)) {
      try {
        freshReleases = await catalogService.fetchFreshVerifiedReleases(cleanMessage, dateTimeInfo.year);
        if (freshReleases.length > 0) {
          candidatePool = [...freshReleases, ...candidatePool];
        }
      } catch (err) {
        console.warn('[AiCompanion] Fresh release fetch notice:', err.message);
      }
    }

    // 7. Strict duplicate filtering & artist diversity enforcement
    const intent = catalogService.extractRecommendationIntent(cleanMessage);
    const seenIds = new Set();
    const seenKeys = new Set();
    const deduplicatedCandidates = [];
    const artistCounts = new Map();

    for (const track of candidatePool) {
      const id = track.id || track.videoId;
      if (!id || seenIds.has(id)) continue;

      const verification = verifySingleSong(track);
      if (!verification.isValid) continue;

      const canonicalKey = getCanonicalSongKey(track);
      if (seenKeys.has(canonicalKey)) continue;

      // Exclude if already recommended recently (unless explicitly requested)
      if (excludedIds.has(id) || excludedKeys.has(canonicalKey)) {
        continue;
      }
      const clTitle = cleanSongTitle(track.title);
      if (clTitle && clTitle.length >= 4 && excludedTitles.has(clTitle)) {
        continue;
      }

      // Exclude skipped tracks from user listening profile
      if (userProfile?.skippedTrackIds?.includes(id)) {
        continue;
      }

      // Artist diversity: max 2 tracks per artist unless specifically requested
      const artistKey = (track.artist || track.channel || '').toLowerCase();
      if (!intent.targetArtist || !artistKey.includes(intent.targetArtist.toLowerCase())) {
        const count = artistCounts.get(artistKey) || 0;
        if (count >= 2) continue;
        artistCounts.set(artistKey, count + 1);
      }

      seenIds.add(id);
      seenKeys.add(canonicalKey);
      deduplicatedCandidates.push({
        ...track,
        songType: verification.songType,
        verificationStatus: verification.verificationStatus
      });
    }

    // Check again if direct playback intent was for any candidate title
    const candidatePlayMatch = this.detectPlaybackRequest(cleanMessage, history, deduplicatedCandidates);
    if (candidatePlayMatch) {
      return {
        reply: `🎵 Playing **"${candidatePlayMatch.title}"** by ${candidatePlayMatch.artist || 'Artist'} for you now. Enjoy the sound!`,
        tracks: [candidatePlayMatch],
        action: {
          type: 'PLAY_TRACK',
          track: candidatePlayMatch
        }
      };
    }

    // 8. Check if Gemini API is configured
    const client = this.getClient();
    if (!client) {
      aiCompanionDiagnostics.fallbackChats += 1;
      return this.generateFallbackResponse({
        cleanMessage,
        currentTrack,
        candidatePool: deduplicatedCandidates,
        userProfile,
        dateTimeInfo,
        freshReleases,
        clientKey,
        intent,
        excludedIds,
        excludedKeys,
        excludedTitles,
        excludedList
      });
    }

    // 9. Build compact context for Gemini
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    let currentTrackContext = "NO TRACK CURRENTLY PLAYING IN LOOPRA";
    if (currentTrack && (currentTrack.title || currentTrack.id)) {
      currentTrackContext = `CURRENT PLAYING SONG: "${currentTrack.title}" by ${currentTrack.artist || 'Unknown'} (ID: ${currentTrack.videoId || currentTrack.id}, Playing: ${currentTrack.isPlaying ? 'Yes' : 'No'})`;
    }

    const candidateMap = new Map();
    const compactCandidates = [];
    for (const c of deduplicatedCandidates.slice(0, 35)) {
      const id = c.id || c.videoId;
      if (!id || candidateMap.has(id)) continue;
      candidateMap.set(id, c);
      compactCandidates.push({
        id,
        title: c.title,
        artist: c.artist || c.channel || 'Artist',
        genre: c.genre || 'Desi',
        songType: c.songType || 'individual_song',
        uploadedAt: c.uploadedAt || undefined
      });
    }

    const compactHistory = (history || []).slice(-4).map(h => ({
      role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
      content: h.text || h.content || ''
    }));

    const systemPrompt = `
You are Loopra AI, the cultured, witty, and deeply accurate personal music companion for Loopra streaming sanctuary.

SERVER TIME & DATE CONTEXT:
- Today's Date: ${dateTimeInfo.local}
- Current Year: ${dateTimeInfo.year}
- Timezone: ${dateTimeInfo.timeZone}
- Server UTC: ${dateTimeInfo.utc}

CURRENT PLAYER STATUS:
${currentTrackContext}

VERIFIED CANDIDATE PLAYABLE TRACKS (Intent Matched & Unrecommended):
${JSON.stringify(compactCandidates, null, 2)}

USER PREFERENCES:
- Top Artists: ${(userProfile?.topArtists || []).slice(0, 3).map(a => a.name).join(', ') || 'Eclectic'}
- Top Genres: ${(userProfile?.topGenres || []).slice(0, 2).map(g => g.name).join(', ') || 'Desi Hits'}

RECENT CONVERSATION HISTORY:
${JSON.stringify(compactHistory, null, 2)}

USER MESSAGE:
"${cleanMessage}"

CRITICAL INSTRUCTIONS & ACCURACY MANDATES:
1. NEVER REPEAT RECENT RECOMMENDATIONS:
   - Pick ONLY fresh tracks from the "VERIFIED CANDIDATE PLAYABLE TRACKS" list above.
   - Do not repeat tracks previously recommended in the conversation.
   - Do not return generic responses; align your recommendation directly with the user's specific request.

2. CURRENT-DATE AWARENESS:
   - Today's date is strictly ${dateTimeInfo.local}. Use this dynamic date context.
   - For questions about current music releases, trending songs, or events, state the relevant date context.
   - Do NOT treat pre-trained knowledge as live current information.
   - If current information or a specific fact cannot be verified, state honestly that it cannot be verified rather than fabricating release dates, chart positions, or credits.

3. STRICT INDIVIDUAL SINGLE SONGS ONLY:
   - Recommend ONLY individual, complete songs.
   - NEVER recommend mashups, medleys, jukeboxes, non-stop collections, compilations, best-of collections, top 10/20 song collections, DJ mixes, continuous mixes, or playlist videos.
   - Pick tracks STRICTLY from the "VERIFIED CANDIDATE PLAYABLE TRACKS" list above.
   - NEVER invent or hallucinate YouTube IDs. Only use IDs from the candidate list.

4. ACCURATE SONG CREDITS:
   - Distinguish strictly between:
     * Original Singer (vocalist)
     * Composer / Music Director (creator of melody and score)
     * Lyricist (writer of the poetry/lyrics)
     * Album / Movie
     * Release Year
     * Original vs Cover/Remake

OUTPUT FORMAT (Strict JSON):
{
  "reply": "Warm, concise conversational response with musical trivia and accurate credits (2-4 sentences max)",
  "selectedTrackIds": [
    { "id": "candidate_id", "reason": "Short 1-sentence reason for recommending this single song" }
  ]
}
`;

    try {
      const response = await client.models.generateContent({
        model: modelName,
        contents: systemPrompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const latency = Date.now() - startTime;
      aiCompanionDiagnostics.lastLatencyMs = latency;
      aiCompanionDiagnostics.successfulAiChats += 1;

      let rawText = response.text || '';
      if (!rawText && response.candidates?.[0]?.content?.parts?.[0]?.text) {
        rawText = response.candidates[0].content.parts[0].text;
      }

      const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      let parsed = JSON.parse(cleaned);

      // Hydrate selected tracks strictly from candidateMap with single-song verification
      const hydratedTracks = [];
      const seenSelectedIds = new Set();

      if (Array.isArray(parsed.selectedTrackIds)) {
        for (const item of parsed.selectedTrackIds) {
          const trackId = typeof item === 'string' ? item : item?.id;
          if (!trackId || seenSelectedIds.has(trackId) || !candidateMap.has(trackId)) continue;

          const fullTrack = candidateMap.get(trackId);
          const verification = verifySingleSong(fullTrack);
          if (!verification.isValid) continue;

          seenSelectedIds.add(trackId);
          hydratedTracks.push({
            id: fullTrack.id,
            videoId: fullTrack.videoId || fullTrack.id,
            title: fullTrack.title,
            artist: fullTrack.artist,
            channel: fullTrack.channel || fullTrack.artist,
            thumbnail: fullTrack.thumbnail,
            duration: fullTrack.duration || '3:30',
            songType: verification.songType || 'individual_song',
            verificationStatus: verification.verificationStatus || 'verified_single_song',
            reason: item?.reason || `Recommended for your vibe`
          });
        }
      }

      // If user asked for recommendations but none were returned by model, fallback to top unrecommended candidates
      if (hydratedTracks.length === 0 && (lowerMsg.includes('recommend') || lowerMsg.includes('suggest') || lowerMsg.includes('song') || lowerMsg.includes('music'))) {
        for (const c of compactCandidates.slice(0, 3)) {
          const full = candidateMap.get(c.id);
          if (full && !seenSelectedIds.has(full.id)) {
            const verification = verifySingleSong(full);
            if (verification.isValid) {
              seenSelectedIds.add(full.id);
              hydratedTracks.push({
                id: full.id,
                videoId: full.videoId || full.id,
                title: full.title,
                artist: full.artist,
                channel: full.channel || full.artist,
                thumbnail: full.thumbnail,
                duration: full.duration || '3:30',
                songType: verification.songType || 'individual_song',
                verificationStatus: verification.verificationStatus || 'verified_single_song',
                reason: 'Curated single song from Loopra'
              });
            }
          }
        }
      }

      // Record recommendation to persistent memory
      if (hydratedTracks.length > 0) {
        await recommendationHistoryService.recordRecommendations(clientKey, hydratedTracks, cleanMessage);
      }

      return {
        reply: parsed.reply || `Here are verified single songs handpicked for you as of ${dateTimeInfo.local}:`,
        tracks: hydratedTracks,
        action: null
      };
    } catch (err) {
      aiCompanionDiagnostics.lastError = err.message;
      aiCompanionDiagnostics.fallbackChats += 1;
      return this.generateFallbackResponse({
        cleanMessage,
        currentTrack,
        candidatePool: deduplicatedCandidates,
        userProfile,
        dateTimeInfo,
        freshReleases,
        clientKey,
        intent,
        excludedIds,
        excludedKeys,
        excludedTitles,
        excludedList,
        errorNote: err.message
      });
    }
  },

  /**
   * Deterministic fallback response when Gemini is unconfigured or rate limited.
   * Adheres strictly to single-song rules, dynamic date awareness, and zero fabrication.
   */
  async generateFallbackResponse({
    cleanMessage,
    currentTrack,
    candidatePool = [],
    userProfile = null,
    dateTimeInfo = getCurrentDateTimeInfo(),
    freshReleases = [],
    clientKey = null,
    intent = null,
    excludedIds = new Set(),
    excludedKeys = new Set(),
    excludedTitles = new Set(),
    excludedList = [],
    errorNote = null
  }) {
    const lower = cleanMessage.toLowerCase();

    // 1. Query asking for unverified facts / statistics / chart position
    if (isUnverifiedFactQuery(cleanMessage)) {
      return {
        reply: `As of ${dateTimeInfo.local}, I cannot independently verify live chart positions or streaming metrics without real-time data feeds. I avoid guessing or fabricating statistics to keep your music data accurate.`,
        tracks: [],
        action: null
      };
    }

    // 2. Direct current date or time-sensitive queries
    if (isDirectDateQuery(cleanMessage)) {
      return {
        reply: `Today is **${dateTimeInfo.local}** (${dateTimeInfo.timeZone}). What music would you like to explore today?`,
        tracks: [],
        action: null
      };
    }

    // 3. Current track inquiry
    if (lower.includes('what') && (lower.includes('playing') || lower.includes('song'))) {
      if (currentTrack && currentTrack.title) {
        const verification = verifySingleSong(currentTrack);
        return {
          reply: `You're currently listening to **"${currentTrack.title}"** by **${currentTrack.artist || 'Unknown Artist'}** (Soundtrack: ${currentTrack.album || 'Single'})! Let me know if you would like single-song recommendations matching this vibe.`,
          tracks: [{
            id: currentTrack.id || currentTrack.videoId,
            videoId: currentTrack.videoId || currentTrack.id,
            title: currentTrack.title,
            artist: currentTrack.artist || 'Artist',
            channel: currentTrack.channel || currentTrack.artist,
            thumbnail: currentTrack.thumbnail,
            duration: currentTrack.duration,
            songType: verification.songType || 'individual_song',
            verificationStatus: verification.verificationStatus || 'verified_single_song',
            reason: 'Currently playing track'
          }],
          action: null
        };
      }
      return {
        reply: `There is no music currently playing in Loopra. Here are verified single songs to kickstart your session:`,
        tracks: candidatePool.filter(t => isSingleSong(t)).slice(0, 3).map(t => {
          const v = verifySingleSong(t);
          return {
            id: t.id,
            videoId: t.videoId || t.id,
            title: t.title,
            artist: t.artist,
            channel: t.channel || t.artist,
            thumbnail: t.thumbnail,
            duration: t.duration || '3:30',
            songType: v.songType || 'individual_song',
            verificationStatus: v.verificationStatus || 'verified_single_song',
            reason: 'Handpicked verified single song'
          };
        }),
        action: null
      };
    }

    // 4. Question about singer/composer
    if (lower.includes('who') && (lower.includes('sing') || lower.includes('singing') || lower.includes('composed') || lower.includes('artist'))) {
      if (currentTrack && currentTrack.artist) {
        const verification = verifySingleSong(currentTrack);
        return {
          reply: `The artist performing **"${currentTrack.title}"** is **${currentTrack.artist}**. Would you like to explore other official single releases by them?`,
          tracks: candidatePool
            .filter(c => isSingleSong(c) && c.artist && c.artist.toLowerCase().includes(currentTrack.artist.toLowerCase()))
            .slice(0, 3)
            .map(t => {
              const v = verifySingleSong(t);
              return {
                id: t.id,
                videoId: t.videoId || t.id,
                title: t.title,
                artist: t.artist,
                channel: t.channel || t.artist,
                thumbnail: t.thumbnail,
                duration: t.duration || '3:30',
                songType: v.songType || 'individual_song',
                verificationStatus: v.verificationStatus || 'verified_single_song',
                reason: `Official single track by ${currentTrack.artist}`
              };
            }),
          action: null
        };
      }
    }

    // 5. Fresh releases query
    if (freshReleases.length > 0) {
      const selected = freshReleases.filter(t => isSingleSong(t)).slice(0, 4).map(t => {
        const v = verifySingleSong(t);
        return {
          id: t.id,
          videoId: t.videoId || t.id,
          title: t.title,
          artist: t.artist,
          channel: t.channel || t.artist,
          thumbnail: t.thumbnail,
          duration: t.duration || '3:30',
          songType: v.songType || 'individual_song',
          verificationStatus: v.verificationStatus || 'verified_single_song',
          reason: `Fresh official release (${dateTimeInfo.year})`
        };
      });

      if (clientKey && selected.length > 0) {
        await recommendationHistoryService.recordRecommendations(clientKey, selected, cleanMessage);
      }

      return {
        reply: `As of ${dateTimeInfo.local}, here are fresh verified individual releases from official music channels:`,
        tracks: selected,
        action: null
      };
    }

    // 6. Recommendation query - strictly non-repetitive single songs
    const currentIntent = intent || catalogService.extractRecommendationIntent(cleanMessage);
    const verifiedCandidates = candidatePool.filter(c => isSingleSong(c));

    // Filter out previously recommended tracks
    const unrecommendedCandidates = verifiedCandidates.filter(c => {
      const id = c.id || c.videoId;
      if (!id || excludedIds.has(id)) return false;
      const key = getCanonicalSongKey(c);
      if (excludedKeys.has(key)) return false;
      const clTitle = cleanSongTitle(c.title);
      if (clTitle && clTitle.length >= 4 && excludedTitles.has(clTitle)) return false;
      return true;
    });

    const poolToUse = unrecommendedCandidates.length >= 3 ? unrecommendedCandidates : verifiedCandidates;

    // Score relevance to intent
    const scored = poolToUse.map(track => {
      let score = 0;
      const combined = `${track.title} ${track.artist || ''} ${track.genre || ''} ${track.mood || ''}`.toLowerCase();

      if (currentIntent.mood && (combined.includes(currentIntent.mood) || (track.mood && track.mood.toLowerCase().includes(currentIntent.mood)))) {
        score += 15;
      }
      if (currentIntent.era && (combined.includes(currentIntent.era) || (track.genre && track.genre.toLowerCase().includes(currentIntent.era)))) {
        score += 15;
      }
      if (currentIntent.genre && (combined.includes(currentIntent.genre) || (track.genre && track.genre.toLowerCase().includes(currentIntent.genre)))) {
        score += 10;
      }
      if (currentIntent.curationType === 'underrated' && (combined.includes('underrated') || combined.includes('indie') || combined.includes('acoustic'))) {
        score += 15;
      }
      if (currentIntent.targetArtist && combined.includes(currentIntent.targetArtist.toLowerCase())) {
        score += 20;
      }

      // Query tokens match
      for (const term of lower.split(/\s+/)) {
        if (term.length > 3 && combined.includes(term)) {
          score += 5;
        }
      }

      return { track, score };
    });

    // Sort by score with random tie-breaker so subsequent turns differ
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Math.random() - 0.5;
    });

    // Select up to 4 diverse tracks ensuring artist diversity
    const selectedTracks = [];
    const artistSeen = new Set();

    for (const item of scored) {
      const t = item.track;
      const art = (t.artist || t.channel || '').toLowerCase();
      if (artistSeen.has(art) && scored.length > 4 && !currentIntent.targetArtist) continue;
      artistSeen.add(art);
      selectedTracks.push(t);
      if (selectedTracks.length >= 4) break;
    }

    const hydrated = selectedTracks.map(t => {
      const v = verifySingleSong(t);
      let reason = 'Curated individual song from Loopra';
      if (currentIntent.mood) reason = `${currentIntent.mood.charAt(0).toUpperCase() + currentIntent.mood.slice(1)} vibe track`;
      else if (currentIntent.era) reason = `${currentIntent.era.toUpperCase()} era classic`;
      else if (currentIntent.curationType === 'underrated') reason = 'Underrated musical gem';

      return {
        id: t.id,
        videoId: t.videoId || t.id,
        title: t.title,
        artist: t.artist,
        channel: t.channel || t.artist,
        thumbnail: t.thumbnail,
        duration: t.duration || '3:30',
        songType: v.songType || 'individual_song',
        verificationStatus: v.verificationStatus || 'verified_single_song',
        reason
      };
    });

    // Record chosen tracks into user recommendation history so next turn receives DIFFERENT songs
    if (clientKey && hydrated.length > 0) {
      await recommendationHistoryService.recordRecommendations(clientKey, hydrated, cleanMessage);
    }

    let replyPrefix = 'Here are verified single tracks from the Loopra sanctuary matching your vibe:';
    if (currentIntent.mood === 'romantic') replyPrefix = 'Here are soulful romantic single songs handpicked for your mood:';
    else if (currentIntent.mood === 'sad') replyPrefix = 'Here are heartfelt, emotional single tracks for your soulful session:';
    else if (currentIntent.mood === 'workout') replyPrefix = 'Here are high-energy motivational songs to power up your workout:';
    else if (currentIntent.era === '90s') replyPrefix = 'Here are timeless 90s Bollywood single songs that capture the golden era:';
    else if (currentIntent.curationType === 'underrated') replyPrefix = 'Here are underrated musical gems that deserve a special spot on your playlist:';

    return {
      reply: replyPrefix,
      tracks: hydrated,
      action: null
    };
  }
};
