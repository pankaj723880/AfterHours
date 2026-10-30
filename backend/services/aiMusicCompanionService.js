import { GoogleGenAI } from '@google/genai';
import { catalogService } from './catalogService.js';
import { listeningEventService } from './listeningEventService.js';

export const aiCompanionDiagnostics = {
  totalChats: 0,
  successfulAiChats: 0,
  fallbackChats: 0,
  lastLatencyMs: 0,
  lastError: null
};

// In-memory cache for candidate pools to avoid repeated slow network operations
let cachedCandidatePool = null;
let lastCandidatePoolTime = 0;
const CANDIDATE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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
   * Fast cached candidate pool fetcher.
   */
  async getCandidatePool(userProfile = null) {
    const now = Date.now();
    if (cachedCandidatePool && now - lastCandidatePoolTime < CANDIDATE_CACHE_TTL) {
      return [...cachedCandidatePool];
    }

    try {
      const pool = await catalogService.buildCandidatePool(userProfile);
      cachedCandidatePool = pool;
      lastCandidatePoolTime = now;
      return [...pool];
    } catch (e) {
      const curated = await catalogService.getCuratedTracks();
      cachedCandidatePool = curated;
      lastCandidatePoolTime = now;
      return [...curated];
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
      if (track.title && lower.includes(track.title.toLowerCase())) {
        return track;
      }
    }

    // Direct title matching against candidate pool
    for (const track of (candidatePool || []).slice(0, 25)) {
      if (track.title && lower.includes(track.title.toLowerCase())) {
        return track;
      }
    }

    return null;
  },

  /**
   * Main conversational intelligence engine (Standard Fast Response).
   */
  async processChat({ user = null, message = '', currentTrack = null, history = [] }) {
    aiCompanionDiagnostics.totalChats += 1;
    const startTime = Date.now();

    const cleanMessage = (message || '').trim();
    if (!cleanMessage) {
      return {
        reply: "Hey there! I'm Loopra AI, your music companion. Ask me anything about what's playing, request personalized vibes, or let me know what mood you're in!",
        tracks: [],
        action: null
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

    // 3. FAST PATH: Query about currently playing song
    const lowerMsg = cleanMessage.toLowerCase();
    const isCurrentTrackInquiry = /what('s| is)?\s+(playing|this song)|who('s| is)?\s+(singing|the singer|artist)|tell me about this (song|track)|who composed/i.test(lowerMsg);

    if (isCurrentTrackInquiry) {
      if (currentTrack && currentTrack.title) {
        // Quick factual reply without heavy catalog queries
        if (this.isGeminiConfigured()) {
          try {
            const client = this.getClient();
            const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const prompt = `You are Loopra AI music companion. The user asks: "${cleanMessage}". The current playing track is "${currentTrack.title}" by ${currentTrack.artist || 'Unknown'} (Album: ${currentTrack.album || 'Single'}). Provide a warm, 2-3 sentence answer with interesting musical or cultural trivia about this song/artist.`;
            const aiRes = await client.models.generateContent({
              model: modelName,
              contents: prompt
            });
            const text = aiRes.text?.trim();
            if (text) {
              return {
                reply: text,
                tracks: [currentTrack],
                action: null
              };
            }
          } catch (e) {}
        }

        return {
          reply: `You're currently listening to **"${currentTrack.title}"** by **${currentTrack.artist || 'Unknown Artist'}**! Would you like me to find songs with a similar vibe?`,
          tracks: [currentTrack],
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

    // 4. Retrieve candidate pool (Cached for speed)
    const candidatePool = await this.getCandidatePool(userProfile);

    // Check again if direct playback intent was for a candidate title
    const candidatePlayMatch = this.detectPlaybackRequest(cleanMessage, history, candidatePool);
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

    // 5. Check if Gemini API is configured
    const client = this.getClient();
    if (!client) {
      aiCompanionDiagnostics.fallbackChats += 1;
      return this.generateFallbackResponse({
        cleanMessage,
        currentTrack,
        candidatePool,
        userProfile
      });
    }

    // 6. Build compact context for Gemini
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    let currentTrackContext = "NO TRACK CURRENTLY PLAYING IN LOOPRA";
    if (currentTrack && (currentTrack.title || currentTrack.id)) {
      currentTrackContext = `CURRENT PLAYING SONG: "${currentTrack.title}" by ${currentTrack.artist || 'Unknown'} (ID: ${currentTrack.videoId || currentTrack.id}, Playing: ${currentTrack.isPlaying ? 'Yes' : 'No'})`;
    }

    const candidateMap = new Map();
    const compactCandidates = [];
    for (const c of candidatePool.slice(0, 30)) {
      const id = c.id || c.videoId;
      if (!id || candidateMap.has(id)) continue;
      candidateMap.set(id, c);
      compactCandidates.push({
        id,
        title: c.title,
        artist: c.artist || c.channel || 'Artist',
        genre: c.genre || 'Desi'
      });
    }

    const compactHistory = (history || []).slice(-4).map(h => ({
      role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
      content: h.text || h.content || ''
    }));

    const systemPrompt = `
You are Loopra AI, the cultured, witty, and knowledgeable personal music companion for Loopra streaming sanctuary.

CURRENT STATUS:
${currentTrackContext}

CANDIDATE PLAYABLE TRACKS:
${JSON.stringify(compactCandidates, null, 2)}

USER PREFERENCES:
- Top Artists: ${(userProfile?.topArtists || []).slice(0, 3).map(a => a.name).join(', ') || 'Eclectic'}

RECENT HISTORY:
${JSON.stringify(compactHistory, null, 2)}

USER MESSAGE:
"${cleanMessage}"

INSTRUCTIONS:
1. Answer warmly, knowledgeably, and concisely (2-4 sentences max).
2. If the user asks for song recommendations or vibes, pick 2 to 4 tracks STRICTLY from the "CANDIDATE PLAYABLE TRACKS" list above.
3. NEVER invent or hallucinate YouTube IDs. Only pick from candidate IDs.

OUTPUT FORMAT (Strict JSON):
{
  "reply": "Warm conversational commentary with musical trivia",
  "selectedTrackIds": [
    { "id": "candidate_id", "reason": "Short 1-sentence reason" }
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

      // Hydrate selected tracks strictly from candidateMap
      const hydratedTracks = [];
      const seenIds = new Set();

      if (Array.isArray(parsed.selectedTrackIds)) {
        for (const item of parsed.selectedTrackIds) {
          const trackId = typeof item === 'string' ? item : item?.id;
          if (!trackId || seenIds.has(trackId) || !candidateMap.has(trackId)) continue;
          seenIds.add(trackId);

          const fullTrack = candidateMap.get(trackId);
          hydratedTracks.push({
            id: fullTrack.id,
            videoId: fullTrack.videoId || fullTrack.id,
            title: fullTrack.title,
            artist: fullTrack.artist,
            channel: fullTrack.channel || fullTrack.artist,
            thumbnail: fullTrack.thumbnail,
            duration: fullTrack.duration,
            reason: item?.reason || `Recommended for your vibe`
          });
        }
      }

      return {
        reply: parsed.reply || "Here are some handpicked tracks for you:",
        tracks: hydratedTracks,
        action: null
      };
    } catch (err) {
      aiCompanionDiagnostics.lastError = err.message;
      aiCompanionDiagnostics.fallbackChats += 1;
      return this.generateFallbackResponse({
        cleanMessage,
        currentTrack,
        candidatePool,
        userProfile,
        errorNote: err.message
      });
    }
  },

  /**
   * Deterministic fallback response when Gemini is unconfigured or rate limited.
   */
  generateFallbackResponse({ cleanMessage, currentTrack, candidatePool = [], userProfile = null, errorNote = null }) {
    const lower = cleanMessage.toLowerCase();

    // Current track inquiry
    if (lower.includes('what') && (lower.includes('playing') || lower.includes('song'))) {
      if (currentTrack && currentTrack.title) {
        return {
          reply: `You're currently listening to **"${currentTrack.title}"** by **${currentTrack.artist || 'Unknown Artist'}**! Let me know if you want similar tracks or a playlist in this mood.`,
          tracks: [currentTrack],
          action: null
        };
      }
      return {
        reply: `There is no music currently playing in Loopra. Here are some top picks to start your session:`,
        tracks: candidatePool.slice(0, 3),
        action: null
      };
    }

    // Question about singer/composer
    if (lower.includes('who') && (lower.includes('sing') || lower.includes('singing') || lower.includes('artist'))) {
      if (currentTrack && currentTrack.artist) {
        return {
          reply: `The artist behind this track is **${currentTrack.artist}**! Would you like to hear more songs by them?`,
          tracks: candidatePool.filter(c => c.artist && c.artist.toLowerCase().includes(currentTrack.artist.toLowerCase())).slice(0, 3),
          action: null
        };
      }
    }

    // Similar songs or mood recommendation
    let matchingTracks = candidatePool.filter(c => {
      const matchText = `${c.title} ${c.artist} ${c.genre} ${c.mood}`.toLowerCase();
      return lower.split(/\s+/).some(term => term.length > 3 && matchText.includes(term));
    });

    if (matchingTracks.length === 0) {
      matchingTracks = candidatePool.slice(0, 4);
    } else {
      matchingTracks = matchingTracks.slice(0, 4);
    }

    return {
      reply: `Here are some handpicked tracks from Loopra matching your vibe:`,
      tracks: matchingTracks.map(t => ({
        id: t.id,
        videoId: t.videoId || t.id,
        title: t.title,
        artist: t.artist,
        thumbnail: t.thumbnail,
        duration: t.duration,
        reason: 'Curated recommendation from Loopra catalogue'
      })),
      action: null
    };
  }
};
