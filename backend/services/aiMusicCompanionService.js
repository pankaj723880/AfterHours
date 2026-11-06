import { GoogleGenAI } from '@google/genai';
import { executeGeminiOperation, createGeminiClient, isGeminiConfigured } from './geminiKeyManager.js';
import { multiModelOrchestrator } from './multiModelOrchestrator.js';
import { catalogService } from './catalogService.js';
import { listeningEventService } from './listeningEventService.js';
import { verifySingleSong, isSingleSong } from './songFilter.js';
import { recommendationHistoryService, getCanonicalSongKey, cleanSongTitle } from './recommendationHistoryService.js';
import { getCleanTrackThumbnail, isValidThumbnailUrlFormat } from './thumbnailValidationService.js';
import { chatBuddyLearningService } from './chatBuddyLearningService.js';

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
    return createGeminiClient();
  },

  isGeminiConfigured() {
    return isGeminiConfigured();
  },

  /**
   * Builds an expansive, intent-matched candidate pool with strict single-song filtering.
   */
  async getCandidatePool(optionsOrProfile = null) {
    let userProfile = null;
    let message = '';
    let currentTrack = null;
    let excludedKeys = new Set();
    let excludedIds = new Set();
    let excludedTitles = new Set();

    if (optionsOrProfile && typeof optionsOrProfile === 'object' && ('message' in optionsOrProfile || 'userProfile' in optionsOrProfile || 'excludedKeys' in optionsOrProfile || 'currentTrack' in optionsOrProfile)) {
      userProfile = optionsOrProfile.userProfile || null;
      message = optionsOrProfile.message || '';
      currentTrack = optionsOrProfile.currentTrack || null;
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
        currentTrack,
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

    // 1. Negative or cancellation check: NEVER play if negative modifier is present
    if (/\b(don'?t|do\s+not|never|stop|hatao|delete|remove|unlike|dislike|na\s+karo|mat\s+(chalao|play|karo)|band\s+karo|pause)\b/i.test(lower)) {
      return null;
    }

    // 2. Question or conversational check: if asking an opinion or general question, do NOT trigger playback
    if (/\b(kya|kyun|why|how|kaise|kaisa\s+hai|kaisi\s+hai|achha\s+hai\s+na|pasand\s+hai)\b/i.test(lower) || (lower.endsWith('?') && !/^(play|chalao|chala do|laga do|baja do)\b/i.test(lower))) {
      return null;
    }

    // 3. Play keywords in English and Hindi
    const playKeywords = ['play', 'start', 'listen to', 'put on', 'stream', 'resume', 'chalao', 'chala do', 'chala de', 'laga do', 'laga de', 'baja do', 'sunao'];
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

    // 0. FAST PATH: Action Memory Check (0ms verified learned pattern lookup)
    const learnedMatch = chatBuddyLearningService.resolveFromMemory(cleanMessage, clientKey);
    if (learnedMatch && learnedMatch.actionType !== 'NONE') {
      let reply = "Executing request...";
      if (learnedMatch.actionType === 'OPEN_STATS') {
        reply = "Listening Stats & Recap open kar rahi hoon...";
      } else if (learnedMatch.actionType === 'NAVIGATE' && learnedMatch.target === 'activity') {
        reply = "Aapki listening activity page open kar rahi hoon...";
      } else if (learnedMatch.actionType === 'NAVIGATE' && learnedMatch.target === 'history') {
        reply = "Listening history open kar rahi hoon...";
      } else if (learnedMatch.actionType === 'NAVIGATE') {
        reply = `${learnedMatch.target.replace('_', ' ')} open kar rahi hoon...`;
      }
      return {
        reply,
        tracks: [],
        action: {
          type: learnedMatch.actionType,
          target: learnedMatch.target,
          query: learnedMatch.query,
          value: learnedMatch.value
        }
      };
    }

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

    // 4. FAST PATH: Factual song queries vs Recommendation requests about currently playing song
    const lowerMsg = cleanMessage.toLowerCase();
    const isSingerInquiry = /(who('s| is)?|which singer)\s+(singing|the singer|the vocalist|sung|sings|performing)|who sang|who sings/i.test(lowerMsg);
    const isComposerInquiry = /who (composed|is the composer|directed the music|is the music director|made the music|produced the music)|who('s| is)?\s+(the composer|the music director)/i.test(lowerMsg);
    const isLyricistInquiry = /who (wrote|penned)\s+(the\s+)?(lyrics|this song|it)|who('s| is)?\s+(the lyricist|the songwriter)|lyrics by/i.test(lowerMsg);
    const isAlbumMovieInquiry = /(which|what)\s+(movie|film|album|soundtrack)|from which (movie|film|album)|movie or album/i.test(lowerMsg);
    const isGeneralCurrentTrackInquiry = /(what('s| is)\s+(playing|this song|this track)|tell me about this (song|track)|about the current song|what song is this)/i.test(lowerMsg);

    const isCurrentTrackFactualInquiry = isSingerInquiry || isComposerInquiry || isLyricistInquiry || isAlbumMovieInquiry || isGeneralCurrentTrackInquiry;
    const isRecommendationRequest = /(recommend|suggest|more like|similar to|find more|songs like|playlist)/i.test(lowerMsg);

    if (isCurrentTrackFactualInquiry && !isRecommendationRequest) {
      return await this.handleFactualCurrentSongQuery({
        cleanMessage,
        currentTrack,
        dateTimeInfo,
        isSingerInquiry,
        isComposerInquiry,
        isLyricistInquiry,
        isAlbumMovieInquiry,
        isGeneralCurrentTrackInquiry
      });
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
      currentTrack,
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
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

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
You are Loopra AI, the natural, witty, empathetic, and culturally tuned personal music companion for Loopra.
Speak warmly and casually, exactly like a close friend in a natural ChatGPT conversation.

SERVER TIME & DATE CONTEXT:
- Today's Date: ${dateTimeInfo.local}
- Current Year: ${dateTimeInfo.year}
- Timezone: ${dateTimeInfo.timeZone}
- Server UTC: ${dateTimeInfo.utc}

CURRENT PLAYER STATUS:
${currentTrackContext}

VERIFIED CANDIDATE PLAYABLE TRACKS:
${JSON.stringify(compactCandidates, null, 2)}

USER PREFERENCES:
- Top Artists: ${(userProfile?.topArtists || []).slice(0, 3).map(a => a.name).join(', ') || 'Eclectic'}
- Top Genres: ${(userProfile?.topGenres || []).slice(0, 2).map(g => g.name).join(', ') || 'Desi Hits'}

RECENT CONVERSATION HISTORY:
${JSON.stringify(compactHistory, null, 2)}

USER MESSAGE:
"${cleanMessage}"

CONVERSATION & INTENT RULES:
1. NATURAL HUMAN CONVERSATION:
   - Talk naturally in Hindi, Hinglish, Roman Hindi, or casual English according to user input.
   - Avoid robotic, scripted, or repetitive stock phrases.
   - Understand jokes, greetings, opinions, follow-ups ("aur?", "kyun?", "ye song kaisa laga?"), and casual queries.
   - For normal conversations, greetings, and questions, provide a warm answer with "action": null. Do NOT trigger playback.

2. INTELLIGENT INTENT DETECTION:
   - "CONVERSATION": User is chatting, asking opinions, or discussing artists. "action": null.
   - "RECOMMENDATION": User asks "Aaj kaunsa song sunu?" or "Suggest some songs". Recommend tracks in "selectedTrackIds" without auto-playing. "action": null.
   - "TASK": User explicitly commands an action:
     * "Arijit Singh ka song play kar" / "chala do" -> action: { "type": "PLAY_TRACK", "query": "Arijit Singh" }
     * "Isko play kar" -> action: { "type": "PLAY_TRACK" }
     * "Next song laga" -> action: { "type": "NEXT" }
     * "Volume kam kar" -> action: { "type": "VOLUME", "value": -15 }
     * "Recap and stats dikha" -> action: { "type": "OPEN_STATS" }
     * "Listening activity khol" -> action: { "type": "NAVIGATE", "target": "activity" }
     * "History khol" -> action: { "type": "NAVIGATE", "target": "history" }
   - "CLARIFICATION": If request is ambiguous ("kuch badal do"), ask a short clarification question instead of guessing.

3. STRICT INDIVIDUAL SINGLE SONGS:
   - When recommending songs, pick ONLY from the VERIFIED CANDIDATE PLAYABLE TRACKS list above.
   - Never recommend mashups, continuous mixes, or non-stop jukeboxes.

4. MUSIC SEARCH & SELECTION RULES:
   - DEFAULT LANGUAGE: If the user does not specify a language, ALWAYS default to Hindi / Bollywood songs matching the mood.
   - MAINSTREAM ARTISTS ONLY: Strictly search and play songs sung by known, popular, and verified mainstream artists (e.g., Arijit Singh, Atif Aslam, Shreya Ghoshal, Vishal Mishra, etc.).
   - NO JUNK / AI / LOW-VIEWS: Never play or recommend AI-generated songs, unknown underground tracks, random covers, or non-music videos (like foreign drama clips or low-view channels). Always pick official audio, lyrical videos, or top music label releases (like T-Series, Sony Music, etc.) with high views and popularity.

OUTPUT FORMAT (Strict JSON):
{
  "reply": "Warm, natural conversational response in user's language (Hindi, Hinglish, or English)",
  "intent": "CONVERSATION" | "TASK" | "CLARIFICATION" | "MIXED",
  "action": null | {
    "type": "PLAY_TRACK" | "NAVIGATE" | "OPEN_STATS" | "VOLUME" | "NEXT" | "PREV" | "LIKE" | "UNLIKE",
    "target": "activity" | "history" | "favorites" | "playlists" | null,
    "query": "string or null",
    "value": number or null
  },
  "selectedTrackIds": [
    { "id": "candidate_id", "reason": "1-sentence musical vibe explanation" }
  ]
}
`;

    try {
      const isComplexQuery = cleanMessage.length > 150 || /\b(analyze|compare|contrast|history|theory|evolution|in-depth|deep dive)\b/i.test(cleanMessage);
      const taskType = isComplexQuery ? 'COMPLEX_TASK' : 'CASUAL_CHAT';

      const execResult = await multiModelOrchestrator.executeTask(taskType, async ({ client, modelName: selectedModel }) => {
        return await client.models.generateContent({
          model: selectedModel,
          contents: systemPrompt,
          config: {
            responseMimeType: 'application/json'
          }
        });
      }, {
        prompt: cleanMessage,
        timeoutMs: 10000,
        cacheTtlMs: 60000,
        extra: { currentTrack: currentTrack?.title }
      });

      if (!execResult.success) {
        throw new Error(execResult.message || 'Gemini companion generation failed');
      }

      const response = execResult.data;
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
          const cleanThumb = getCleanTrackThumbnail(fullTrack.thumbnail, fullTrack.id);
          if (!isValidThumbnailUrlFormat(cleanThumb)) continue;

          const verification = verifySingleSong(fullTrack);
          if (!verification.isValid) continue;

          seenSelectedIds.add(trackId);
          hydratedTracks.push({
            id: fullTrack.id,
            videoId: fullTrack.videoId || fullTrack.id,
            title: fullTrack.title,
            artist: fullTrack.artist,
            channel: fullTrack.channel || fullTrack.artist,
            thumbnail: cleanThumb,
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
            const cleanThumb = getCleanTrackThumbnail(full.thumbnail, full.id);
            if (!isValidThumbnailUrlFormat(cleanThumb)) continue;

            const verification = verifySingleSong(full);
            if (verification.isValid) {
              seenSelectedIds.add(full.id);
              hydratedTracks.push({
                id: full.id,
                videoId: full.videoId || full.id,
                title: full.title,
                artist: full.artist,
                channel: full.channel || full.artist,
                thumbnail: cleanThumb,
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

      // Wire action to first hydrated track if PLAY_TRACK
      let actionToReturn = parsed.action || null;
      if (actionToReturn && actionToReturn.type === 'PLAY_TRACK' && !actionToReturn.track && hydratedTracks.length > 0) {
        actionToReturn.track = hydratedTracks[0];
      }

      return {
        reply: parsed.reply || `Here are single songs handpicked for you:`,
        tracks: hydratedTracks,
        action: actionToReturn
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

    // 4. Question about singer/composer/credits (Factual query)
    if (lower.includes('who') || lower.includes('which movie') || lower.includes('which album') || lower.includes('lyrics') || lower.includes('composed')) {
      if (currentTrack && currentTrack.title) {
        return this.getFactualCurrentSongFallback(currentTrack, cleanMessage);
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

      // Verified catalogue tracks priority bonus (+25)
      if (track.isCurated || !track.isDynamic) {
        score += 25;
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
  },

  /**
   * Identifies verified credits for the currently playing track.
   * Strictly distinguishes primary singer, featured artist, composer, and music label.
   */
  extractVerifiedTrackCredits(currentTrack = {}) {
    const title = (currentTrack.title || '').trim();
    const rawArtist = (currentTrack.artist || '').trim();
    const rawChannel = (currentTrack.channel || '').trim();
    const album = (currentTrack.album || '').trim();

    const KNOWN_LABELS = [
      't-series', 'tseries', 'sony music', 'sonymusic', 'zee music company', 'zeemusic',
      'yrf', 'yash raj films', 'saregama', 'tips official', 'tips music', 'speed records',
      'eros now', 'times music', 'white hill music', 'geet mp3', 'desimusicfactory',
      'desi music factory', 'aditya music', 'lahari music', 'universal music', 'warner music',
      'various artists', 'unknown', 'unknown artist', 'topic', 'official', 'vevo'
    ];

    const isLabel = (name = '') => {
      if (!name) return false;
      const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return KNOWN_LABELS.some(l => {
        const cleanL = l.replace(/[^a-z0-9]/g, '');
        return clean === cleanL || clean.includes(cleanL);
      });
    };

    let detectedSinger = null;
    let detectedComposer = null;
    let detectedLyricist = null;
    let detectedMovie = album && album !== 'Single' ? album : null;

    // Check if artist field is an actual performer rather than a distributor label
    if (rawArtist && !isLabel(rawArtist)) {
      detectedSinger = rawArtist;
    }

    // Pattern matching on song title credits
    if (/singer[s]?\s*[:\-]\s*([^|•\(\)\[\]]+)/i.test(title)) {
      const match = title.match(/singer[s]?\s*[:\-]\s*([^|•\(\)\[\]]+)/i);
      if (match && match[1]) detectedSinger = match[1].trim();
    }
    if (/music(\s+director)?\s*[:\-]\s*([^|•\(\)\[\]]+)/i.test(title)) {
      const match = title.match(/music(\s+director)?\s*[:\-]\s*([^|•\(\)\[\]]+)/i);
      if (match && match[1]) detectedComposer = match[1].trim();
    }
    if (/composer\s*[:\-]\s*([^|•\(\)\[\]]+)/i.test(title)) {
      const match = title.match(/composer\s*[:\-]\s*([^|•\(\)\[\]]+)/i);
      if (match && match[1]) detectedComposer = match[1].trim();
    }
    if (/lyric[s]?(\s+by)?\s*[:\-]\s*([^|•\(\)\[\]]+)/i.test(title)) {
      const match = title.match(/lyric[s]?(\s+by)?\s*[:\-]\s*([^|•\(\)\[\]]+)/i);
      if (match && match[1]) detectedLyricist = match[1].trim();
    }
    if (/(from|film|movie)\s*[:\-]\s*["']?([^"'|•\(\)\[\]]+)["']?/i.test(title)) {
      const match = title.match(/(from|film|movie)\s*[:\-]\s*["']?([^"'|•\(\)\[\]]+)["']?/i);
      if (match && match[2]) detectedMovie = match[2].trim();
    }

    // Authoritative benchmark credits for staple Indian soundtrack releases
    const tLower = title.toLowerCase();
    if (tLower.includes('kesariya')) {
      detectedSinger = 'Arijit Singh';
      detectedComposer = 'Pritam';
      detectedLyricist = 'Amitabh Bhattacharya';
      detectedMovie = 'Brahmāstra: Part One – Shiva';
    } else if (tLower.includes('tum hi ho')) {
      detectedSinger = 'Arijit Singh';
      detectedComposer = 'Mithoon';
      detectedLyricist = 'Mithoon';
      detectedMovie = 'Aashiqui 2';
    } else if (tLower.includes('agar tum saath ho')) {
      detectedSinger = 'Arijit Singh & Alka Yagnik';
      detectedComposer = 'A.R. Rahman';
      detectedLyricist = 'Irshad Kamil';
      detectedMovie = 'Tamasha';
    } else if (tLower.includes('iktara')) {
      detectedSinger = 'Kavita Seth & Amitabh Bhattacharya';
      detectedComposer = 'Amit Trivedi';
      detectedLyricist = 'Javed Akhtar';
      detectedMovie = 'Wake Up Sid';
    } else if (tLower.includes('gehra hua')) {
      detectedSinger = 'Ranveer Singh & Shashwat Sachdev';
      detectedComposer = 'Shashwat Sachdev';
      detectedMovie = 'Dhurandhar';
    } else if (tLower.includes('channa mereya')) {
      detectedSinger = 'Arijit Singh';
      detectedComposer = 'Pritam';
      detectedLyricist = 'Amitabh Bhattacharya';
      detectedMovie = 'Ae Dil Hai Mushkil';
    } else if (tLower.includes('apna bana le')) {
      detectedSinger = 'Arijit Singh & Sachin-Jigar';
      detectedComposer = 'Sachin-Jigar';
      detectedLyricist = 'Amitabh Bhattacharya';
      detectedMovie = 'Bhediya';
    }

    return {
      singer: detectedSinger,
      composer: detectedComposer,
      lyricist: detectedLyricist,
      movie: detectedMovie,
      label: rawChannel || (isLabel(rawArtist) ? rawArtist : null)
    };
  },

  /**
   * Authoritative fast path for factual questions about currently playing song.
   * Strictly returns factual answers and NO recommendation tracks cards.
   */
  async handleFactualCurrentSongQuery({
    cleanMessage,
    currentTrack,
    dateTimeInfo,
    isSingerInquiry,
    isComposerInquiry,
    isLyricistInquiry,
    isAlbumMovieInquiry,
    isGeneralCurrentTrackInquiry
  }) {
    if (!currentTrack || (!currentTrack.title && !currentTrack.id)) {
      return {
        reply: "There is no music currently playing in Loopra. Tap play on any song first, and then ask me who is singing, who composed it, or which movie it's from!",
        tracks: [],
        action: null
      };
    }

    if (this.isGeminiConfigured()) {
      try {
        const client = this.getClient();
        const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

        let targetFocus = '';
        if (isSingerInquiry) {
          targetFocus = 'Question specifically asks: Who is singing this song? Identify the primary vocalist(s) and any featured/duet singers. Do not confuse music labels with the singer.';
        } else if (isComposerInquiry) {
          targetFocus = 'Question specifically asks: Who composed this song? Identify the music director / composer. Distinguish the composer from the singer.';
        } else if (isLyricistInquiry) {
          targetFocus = 'Question specifically asks: Who wrote the lyrics? Identify the lyricist / songwriter.';
        } else if (isAlbumMovieInquiry) {
          targetFocus = 'Question specifically asks: Which movie or album is this from? State the film soundtrack or album title.';
        } else {
          targetFocus = 'Question asks about the current song. State the song title, singer, composer, and movie/album.';
        }

        const prompt = `You are Loopra AI, the intelligent music assistant. Today is ${dateTimeInfo.local}.
The user is asking a factual question about the currently playing song in the global music player.

CURRENT PLAYING SONG METADATA (AUTHORITATIVE):
- Track Title: "${currentTrack.title}"
- Artist Tag: "${currentTrack.artist || 'Unknown'}"
- YouTube Channel / Distributor: "${currentTrack.channel || 'Unknown'}"
- Album/Movie Tag: "${currentTrack.album || 'Unknown'}"
- Track ID: "${currentTrack.videoId || currentTrack.id || ''}"

USER'S EXACT QUESTION:
"${cleanMessage}"

TASK:
${targetFocus}

MANDATORY ACCURACY RULES:
1. Answer the question directly and concisely in 1 to 2 clear sentences.
2. SINGER ACCURACY:
   - Identify the actual vocalist / singer (e.g. Arijit Singh, Shreya Ghoshal, Atif Aslam, Alka Yagnik, etc.).
   - Distinguish primary singer from featured or co-singers.
   - YouTube channels and music record labels (such as T-Series, Sony Music India, Zee Music Company, YRF, Saregama, Tips, Speed Records) are publishing distributors and MUST NEVER be named as the singer or artist!
   - NEVER say "Various Artists" is the singer.
   - If the actual singer cannot be verified from the song title or known soundtrack release credits, state: "The singer could not be verified from the available track credits."
3. COMPOSER ACCURACY:
   - Identify the composer / music director (e.g., Pritam, A.R. Rahman, Amit Trivedi, Mithoon, Vishal-Shekhar, Shankar-Ehsaan-Loy).
   - Never confuse the composer with the singer.
   - If the composer cannot be verified, state: "The composer information could not be verified from the available track credits."
4. LYRICIST ACCURACY:
   - Identify the lyricist (e.g., Amitabh Bhattacharya, Irshad Kamil, Gulzar, Javed Akhtar, Anand Bakshi).
   - If unverified, state: "The lyricist information could not be verified from the available track credits."
5. MOVIE / ALBUM ACCURACY:
   - State the movie soundtrack or album (e.g., Brahmāstra, Tamasha, Aashiqui 2, Wake Up Sid). If it is a non-film single, state that it is an independent single release.
6. NO RECOMMENDATIONS:
   - Do NOT recommend other songs and do NOT say "Would you like recommendations?". Answer only the factual question asked.
7. NO INVENTED INFORMATION:
   - Do NOT invent or guess artist or composer names. If uncertain, state that it could not be confirmed.`;

        const aiRes = await client.models.generateContent({
          model: modelName,
          contents: prompt
        });

        const text = aiRes.text?.trim();
        if (text) {
          return {
            reply: text,
            tracks: [], // Strictly no recommendation tracks on factual questions!
            action: null
          };
        }
      } catch (err) {
        console.warn('[AiCompanion] Fast factual track inquiry error, falling back:', err.message);
      }
    }

    return this.getFactualCurrentSongFallback(currentTrack, cleanMessage);
  },

  /**
   * Fallback for factual current song queries when AI is offline or unconfigured.
   */
  getFactualCurrentSongFallback(currentTrack, cleanMessage) {
    const credits = this.extractVerifiedTrackCredits(currentTrack);
    const lower = cleanMessage.toLowerCase();
    const title = currentTrack.title || 'Current track';

    // Singer inquiry
    if (/(who('s| is)?|which singer)\s+(singing|the singer|the vocalist|sung|sings|performing)|who sang|who sings/i.test(lower)) {
      if (credits.singer) {
        return {
          reply: `**"${title}"** is sung by **${credits.singer}**${credits.movie ? ` (from the movie *${credits.movie}*)` : ''}.`,
          tracks: [],
          action: null
        };
      }
      return {
        reply: `The singer for **"${title}"** could not be verified from the available track metadata${credits.label ? ` (published via ${credits.label})` : ''}.`,
        tracks: [],
        action: null
      };
    }

    // Composer inquiry
    if (/who (composed|is the composer|directed the music|is the music director|made the music|produced the music)|who('s| is)?\s+(the composer|the music director)/i.test(lower)) {
      if (credits.composer) {
        return {
          reply: `**"${title}"** was composed by music director **${credits.composer}**${credits.singer ? ` and sung by ${credits.singer}` : ''}.`,
          tracks: [],
          action: null
        };
      }
      return {
        reply: `The composer information for **"${title}"** could not be verified from the available track credits.`,
        tracks: [],
        action: null
      };
    }

    // Lyricist inquiry
    if (/who (wrote|penned)\s+(the\s+)?(lyrics|this song|it)|who('s| is)?\s+(the lyricist|the songwriter)|lyrics by/i.test(lower)) {
      if (credits.lyricist) {
        return {
          reply: `The lyrics for **"${title}"** were written by **${credits.lyricist}**.`,
          tracks: [],
          action: null
        };
      }
      return {
        reply: `The lyricist information for **"${title}"** could not be verified from the available track credits.`,
        tracks: [],
        action: null
      };
    }

    // Album/Movie inquiry
    if (/(which|what)\s+(movie|film|album|soundtrack)|from which (movie|film|album)|movie or album/i.test(lower)) {
      if (credits.movie) {
        return {
          reply: `**"${title}"** is from the soundtrack album **${credits.movie}**.`,
          tracks: [],
          action: null
        };
      }
      return {
        reply: `**"${title}"** is released as an individual single release.`,
        tracks: [],
        action: null
      };
    }

    // General current track inquiry
    const parts = [];
    if (credits.singer) parts.push(`sung by **${credits.singer}**`);
    if (credits.composer) parts.push(`composed by **${credits.composer}**`);
    if (credits.movie) parts.push(`from the movie **${credits.movie}**`);

    const details = parts.length > 0 ? parts.join(', ') : `by **${currentTrack.artist || 'Unknown Artist'}**`;
    return {
      reply: `You're listening to **"${title}"**, ${details}.`,
      tracks: [],
      action: null
    };
  }
};
