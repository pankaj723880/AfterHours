/**
 * Loopra AI Voice Agent Service
 * High-accuracy hybrid semantic intent classifier, tool planner, and validation gate.
 * 
 * Complies strictly with:
 * 1. Strict Playback Intent Gate: Never plays without explicit playback intent.
 * 2. Multi-step execution planning with real parameter extraction.
 * 3. Administrative security isolation.
 * 4. Multi-lingual support: English, Hindi, and Hinglish.
 */

import { GoogleGenAI } from '@google/genai';

export const LOOPRA_TOOLS = [
  // Navigation
  {
    name: 'navigate_to_page',
    category: 'NAVIGATION',
    description: 'Navigate to a top-level page in Loopra',
    parameters: {
      page: {
        type: 'string',
        enum: ['home', 'discover', 'radio', 'library', 'history', 'playlists', 'downloads', 'mood', 'timemachine', 'activity']
      }
    }
  },
  {
    name: 'open_artist_profile',
    category: 'NAVIGATION',
    description: 'Open the artist profile page for a given singer or artist name',
    parameters: {
      artist: { type: 'string' }
    }
  },
  {
    name: 'open_album',
    category: 'NAVIGATION',
    description: 'Open an album by name in catalog view',
    parameters: {
      album: { type: 'string' }
    }
  },
  {
    name: 'open_playlist',
    category: 'NAVIGATION',
    description: 'Open user playlists collection or a specific playlist',
    parameters: {
      playlistName: { type: 'string' }
    }
  },
  {
    name: 'open_queue',
    category: 'NAVIGATION',
    description: 'Open playback queue / up next modal'
  },
  {
    name: 'open_lyrics',
    category: 'NAVIGATION',
    description: 'Open synchronized lyrics modal'
  },
  {
    name: 'open_insights',
    category: 'NAVIGATION',
    description: 'Open listening insights and weekly recap modal'
  },
  {
    name: 'go_back',
    category: 'NAVIGATION',
    description: 'Navigate back to the previous screen'
  },

  // Playback Control (Explicit only)
  {
    name: 'play_song',
    category: 'MUSIC',
    description: 'Start playing a song or artist. STRICT: ONLY call this if user explicitly commanded playback (play, bajao, chalao, sunao, start playing)',
    parameters: {
      query: { type: 'string' },
      index: { type: 'number' }
    }
  },
  {
    name: 'pause_song',
    category: 'MUSIC',
    description: 'Pause currently playing music'
  },
  {
    name: 'resume_song',
    category: 'MUSIC',
    description: 'Resume paused music without starting a new search'
  },
  {
    name: 'next_song',
    category: 'MUSIC',
    description: 'Skip to next song in queue'
  },
  {
    name: 'previous_song',
    category: 'MUSIC',
    description: 'Go to previous song in queue'
  },
  {
    name: 'set_volume',
    category: 'MUSIC',
    description: 'Set player volume to exact percentage (0-100)',
    parameters: {
      volume: { type: 'number' }
    }
  },
  {
    name: 'volume_up',
    category: 'MUSIC',
    description: 'Increase player volume (+15%)'
  },
  {
    name: 'volume_down',
    category: 'MUSIC',
    description: 'Decrease player volume (-15%)'
  },
  {
    name: 'mute',
    category: 'MUSIC',
    description: 'Mute player audio'
  },
  {
    name: 'unmute',
    category: 'MUSIC',
    description: 'Unmute player audio'
  },
  {
    name: 'shuffle',
    category: 'MUSIC',
    description: 'Toggle or set shuffle playback mode'
  },
  {
    name: 'repeat',
    category: 'MUSIC',
    description: 'Toggle or set repeat mode'
  },

  // Search & Discovery (Search only, NEVER auto-play)
  {
    name: 'search_songs',
    category: 'DISCOVERY',
    description: 'Search catalog for songs/artists and display search results WITHOUT auto-playing them',
    parameters: {
      query: { type: 'string' }
    }
  },
  {
    name: 'show_songs',
    category: 'DISCOVERY',
    description: 'Display or filter songs by an artist or genre without starting playback',
    parameters: {
      artist: { type: 'string' },
      query: { type: 'string' }
    }
  },
  {
    name: 'get_artist_details',
    category: 'DISCOVERY',
    description: 'Inquire information, facts, trivia, or bio about an artist/song without playing',
    parameters: {
      artist: { type: 'string' }
    }
  },

  // Library & Playlist
  {
    name: 'like_song',
    category: 'LIBRARY',
    description: 'Add currently playing song (or specified song) to Liked Songs'
  },
  {
    name: 'unlike_song',
    category: 'LIBRARY',
    description: 'Remove song from Liked Songs'
  },
  {
    name: 'add_song_to_playlist',
    category: 'PLAYLIST',
    description: 'Add current song or specified song to playlist',
    parameters: {
      songTitle: { type: 'string' },
      playlistName: { type: 'string' }
    }
  },
  {
    name: 'follow_artist',
    category: 'LIBRARY',
    description: 'Follow currently playing artist or specified artist',
    parameters: {
      artist: { type: 'string' }
    }
  },

  // Clarification & Safety
  {
    name: 'clarify',
    category: 'SYSTEM',
    description: 'Ask user a clarification question when ambiguous or intent is not sufficiently confident',
    parameters: {
      question: { type: 'string' }
    }
  },
  {
    name: 'security_blocked',
    category: 'SYSTEM',
    description: 'Strict security isolation: User attempted to access admin dashboard, server settings, or database',
    parameters: {
      reason: { type: 'string' }
    }
  }
];

export const voiceAgentService = {
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
   * High-accuracy semantic intent classification and execution planner
   */
  async parseIntent({ utterance = '', currentTrack = null, activeTab = 'home', history = [] }) {
    const startTime = Date.now();
    const cleanText = (utterance || '').trim();
    if (!cleanText) {
      return {
        success: false,
        intent: 'unknown_command',
        confidence: 0,
        speechResponse: 'I did not catch that. What would you like to do?',
        steps: [],
        latencyMs: 0
      };
    }

    const lower = cleanText.toLowerCase();

    // 1. STRICT ADMINISTRATIVE ISOLATION CHECK
    if (/\b(admin|administrator|admin dashboard|cms|user management|audit logs?|system metrics|diagnostics|database|feature toggle|rollout|server logs)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'security_blocked',
        confidence: 1.0,
        speechResponse: 'Admin Dashboard and administrative operations are strictly isolated from the Voice Agent.',
        steps: [{
          tool: 'security_blocked',
          action: 'security_blocked',
          parameters: { reason: 'Administrative functions isolated' },
          description: 'Administrative access blocked'
        }],
        latencyMs: Date.now() - startTime
      };
    }

    // 2. FAST DETERMINISTIC PATH FOR HIGH-FREQUENCY SYSTEM CONTROLS
    const fastPlan = this.evaluateDeterministicRules(cleanText, currentTrack);
    if (fastPlan && fastPlan.confidence >= 0.95) {
      fastPlan.latencyMs = Date.now() - startTime;
      return fastPlan;
    }

    // 3. GEMINI AI SEMANTIC INTENT CLASSIFICATION & PLANNER
    const client = this.getClient();
    if (client) {
      try {
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const aiPlan = await this.queryGeminiIntent({
          client,
          modelName,
          utterance: cleanText,
          currentTrack,
          activeTab,
          history
        });

        if (aiPlan && Array.isArray(aiPlan.steps) && aiPlan.steps.length > 0) {
          aiPlan.latencyMs = Date.now() - startTime;
          return aiPlan;
        }
      } catch (err) {
        console.warn('[VoiceAgentService] Gemini classification notice:', err.message);
      }
    }

    // 4. FALLBACK SEMANTIC RESOLUTION IF LLM UNAVAILABLE
    const fallbackPlan = fastPlan || this.evaluateHeuristicIntent(cleanText, currentTrack);
    fallbackPlan.latencyMs = Date.now() - startTime;
    return fallbackPlan;
  },

  /**
   * Deterministic intent rules with 0ms latency for common explicit commands
   */
  evaluateDeterministicRules(text = '', currentTrack = null) {
    const lower = text.toLowerCase().trim();

    // A. Playback Controls
    if (/^(pause|stop|hold on|ruk jao|rok do|gaana roko|pause karo|pause music|stop music)$/i.test(lower)) {
      return {
        success: true,
        intent: 'pause_song',
        confidence: 1.0,
        speechResponse: 'Pausing music',
        steps: [{ tool: 'pause_song', action: 'pause', description: 'Pause playback' }]
      };
    }

    if (/^(resume|play|continue|unpause|shuru karo|chalao|bajao|start playing|resume music|play music)$/i.test(lower)) {
      return {
        success: true,
        intent: 'resume_song',
        confidence: 1.0,
        speechResponse: 'Resuming playback',
        steps: [{ tool: 'resume_song', action: 'resume', description: 'Resume playback' }]
      };
    }

    if (/\b(next song|next track|skip song|agla gaana|agla track|skip track)\b/i.test(lower) || /^(next|skip|agla)$/i.test(lower)) {
      return {
        success: true,
        intent: 'next_song',
        confidence: 1.0,
        speechResponse: 'Skipping to next track',
        steps: [{ tool: 'next_song', action: 'next', description: 'Skip to next track' }]
      };
    }

    if (/\b(previous track|previous song|prev song|pichla gaana|pichla track|pichla song|piche karo)\b/i.test(lower) || /^(previous|prev|pichla)$/i.test(lower)) {
      return {
        success: true,
        intent: 'previous_song',
        confidence: 1.0,
        speechResponse: 'Returning to previous track',
        steps: [{ tool: 'previous_song', action: 'previous', description: 'Back to previous track' }]
      };
    }

    // Volume
    const volMatch = lower.match(/(?:set\s+)?volume\s+(?:to\s+)?(\d{1,3})/i) || lower.match(/awaaz\s+(\d{1,3})/i) || lower.match(/volume\s+(\d{1,3})\s+karo/i);
    if (volMatch && volMatch[1]) {
      const val = Math.min(100, Math.max(0, parseInt(volMatch[1], 10)));
      return {
        success: true,
        intent: 'set_volume',
        confidence: 1.0,
        speechResponse: `Setting volume to ${val} percent`,
        steps: [{ tool: 'set_volume', action: 'set_volume', parameters: { volume: val }, value: val, description: `Set volume to ${val}%` }]
      };
    }

    if (/\b(volume up|increase volume|louder|awaaz badhao|volume tej)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'volume_up',
        confidence: 1.0,
        speechResponse: 'Increasing volume',
        steps: [{ tool: 'volume_up', action: 'volume_up', description: 'Increase volume (+15%)' }]
      };
    }

    if (/\b(volume down|decrease volume|lower volume|softer|awaaz kam karo)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'volume_down',
        confidence: 1.0,
        speechResponse: 'Decreasing volume',
        steps: [{ tool: 'volume_down', action: 'volume_down', description: 'Decrease volume (-15%)' }]
      };
    }

    if (/\b(mute|silent|awaaz band)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'mute',
        confidence: 1.0,
        speechResponse: 'Muting audio',
        steps: [{ tool: 'mute', action: 'mute', description: 'Mute volume' }]
      };
    }

    if (/\b(unmute|awaaz kholo|awaaz on)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'unmute',
        confidence: 1.0,
        speechResponse: 'Unmuting audio',
        steps: [{ tool: 'unmute', action: 'unmute', description: 'Unmute volume' }]
      };
    }

    // Shuffle & Repeat
    if (/\b(shuffle on|turn shuffle on|shuffle mode|random play|mix karo)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'shuffle',
        confidence: 1.0,
        speechResponse: 'Toggling shuffle mode',
        steps: [{ tool: 'shuffle', action: 'shuffle', description: 'Toggle shuffle mode' }]
      };
    }

    if (/\b(set repeat|loop this|repeat this song|repeat mode|loop karo)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'repeat',
        confidence: 1.0,
        speechResponse: 'Toggling repeat mode',
        steps: [{ tool: 'repeat', action: 'repeat', description: 'Toggle repeat mode' }]
      };
    }

    // Navigation Pages
    if (/\b(go home|open home|home page|ghar jao|main page)\b/i.test(lower) || /^(home)$/i.test(lower)) {
      return {
        success: true,
        intent: 'navigate_to_page',
        confidence: 1.0,
        speechResponse: 'Opening Home',
        steps: [{ tool: 'navigate_to_page', action: 'navigate_page', target: 'home', parameters: { page: 'home' }, description: 'Open Home page' }]
      };
    }

    if (/\b(open discover|go to discover|discover page|discover par chalo|discover kholo|explore music|explore)\b/i.test(lower) || /^(discover)$/i.test(lower)) {
      return {
        success: true,
        intent: 'navigate_to_page',
        confidence: 1.0,
        speechResponse: 'Opening Discover',
        steps: [{ tool: 'navigate_to_page', action: 'navigate_page', target: 'discover', parameters: { page: 'discover' }, description: 'Open Discover page' }]
      };
    }

    if (/\b(open radio|live radio|indian radio|radio stations?|fm sunao|radio)\b/i.test(lower) || /^(radio)$/i.test(lower)) {
      return {
        success: true,
        intent: 'navigate_to_page',
        confidence: 1.0,
        speechResponse: 'Opening Indian Live Radio',
        steps: [{ tool: 'navigate_to_page', action: 'navigate_page', target: 'radio', parameters: { page: 'radio' }, description: 'Open Live Radio' }]
      };
    }

    if (/\b(liked songs|my liked songs|open liked|favourites?|pasandida gaane|mera liked songs kholo|meri liked songs)\b/i.test(lower) || /^(liked|favourites|favorites)$/i.test(lower)) {
      return {
        success: true,
        intent: 'navigate_to_page',
        confidence: 1.0,
        speechResponse: 'Opening Liked Songs Collection',
        steps: [{ tool: 'navigate_to_page', action: 'navigate_page', target: 'library', parameters: { page: 'library' }, description: 'Open Liked Songs' }]
      };
    }

    if (/\b(listening history|recently played|recent songs|history kholo|open listening history|mera listening history)\b/i.test(lower) || /^(history)$/i.test(lower)) {
      return {
        success: true,
        intent: 'navigate_to_page',
        confidence: 1.0,
        speechResponse: 'Opening Listening History',
        steps: [{ tool: 'navigate_to_page', action: 'navigate_page', target: 'history', parameters: { page: 'history' }, description: 'Open Listening History' }]
      };
    }

    if (/\b(open playlists|my playlists|playlists dekho|playlists)\b/i.test(lower) || /^(playlists)$/i.test(lower)) {
      return {
        success: true,
        intent: 'navigate_to_page',
        confidence: 1.0,
        speechResponse: 'Opening Playlists',
        steps: [{ tool: 'navigate_to_page', action: 'navigate_page', target: 'playlists', parameters: { page: 'playlists' }, description: 'Open Playlists' }]
      };
    }

    // Modals
    if (/\b(open playback queue|playback queue|open queue|show queue|view queue|queue dikhao)\b/i.test(lower) || /^(queue)$/i.test(lower)) {
      return {
        success: true,
        intent: 'open_queue',
        confidence: 1.0,
        speechResponse: 'Opening playback queue',
        steps: [{ tool: 'open_queue', action: 'open_queue', description: 'Open Queue panel' }]
      };
    }

    if (/\b(open lyrics|show lyrics|view lyrics|lyrics kholo|lyrics dikhao)\b/i.test(lower) || /^(lyrics)$/i.test(lower)) {
      return {
        success: true,
        intent: 'open_lyrics',
        confidence: 1.0,
        speechResponse: 'Opening synchronized lyrics',
        steps: [{ tool: 'open_lyrics', action: 'open_lyrics', description: 'Open Lyrics modal' }]
      };
    }

    if (/\b(listening insights|weekly recap|my recap|stats|statistics|listening stats|insights kholo)\b/i.test(lower) || /^(insights|recap|stats)$/i.test(lower)) {
      return {
        success: true,
        intent: 'open_insights',
        confidence: 1.0,
        speechResponse: 'Opening Listening Insights',
        steps: [{ tool: 'open_insights', action: 'open_insights', description: 'Open Insights & Recap' }]
      };
    }

    if (/\b(go back|back jao|piche jao|previous page|wapas jao)\b/i.test(lower) || /^(back)$/i.test(lower)) {
      return {
        success: true,
        intent: 'go_back',
        confidence: 1.0,
        speechResponse: 'Going back',
        steps: [{ tool: 'go_back', action: 'go_back', description: 'Navigate back' }]
      };
    }

    // Library
    if (/\b(like this song|like this track|like it|add to favourites|add to favorites|add to liked|dil de do|pasand karo|usko like karo)\b/i.test(lower) || /^(like|favourite|favorite)$/i.test(lower)) {
      return {
        success: true,
        intent: 'like_song',
        confidence: 1.0,
        speechResponse: currentTrack ? `Adding "${currentTrack.title || 'song'}" to Liked Songs` : 'Adding to Liked Songs',
        steps: [{ tool: 'like_song', action: 'like_current', target: currentTrack, description: `Like "${currentTrack?.title || 'Current Song'}"` }]
      };
    }

    if (/\b(add to playlist|playlist me daalo|add this to my playlist|add that song to my favorites)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'add_song_to_playlist',
        confidence: 0.95,
        speechResponse: 'Opening playlist selector',
        steps: [{ tool: 'add_song_to_playlist', action: 'add_to_playlist', target: currentTrack, description: 'Add to playlist' }]
      };
    }

    // STRICT PLAYBACK INTENT GATE (PLAY COMMANDS ONLY)
    // Matches explicit play commands: "play X", "bajao X", "chalao X", "X play karo", "X bajao"
    const explicitPlayPattern = /^(?:play\s+song|play\s+track|play|bajao\s+gaana|bajao|chalao\s+song|chalao|sunao\s+gaana|sunao|gaana\s+bajao)\s+(.+)$/i;
    const playMatch = lower.match(explicitPlayPattern);
    if (playMatch && playMatch[1]) {
      const q = text.slice(text.length - playMatch[1].length).trim();
      return {
        success: true,
        intent: 'play_song',
        confidence: 0.98,
        speechResponse: `Playing "${q}"`,
        steps: [{ tool: 'play_song', action: 'play_search', query: q, parameters: { query: q }, description: `Play "${q}"` }]
      };
    }

    // Hindi suffix play: "Headlights play karo", "Headlights bajao"
    const hindiSuffixPlay = lower.match(/^(.+?)\s+(?:play\s+karo|bajao|chalao)$/i);
    if (hindiSuffixPlay && hindiSuffixPlay[1]) {
      const q = text.slice(0, hindiSuffixPlay[1].length).trim();
      return {
        success: true,
        intent: 'play_song',
        confidence: 0.98,
        speechResponse: `Playing "${q}"`,
        steps: [{ tool: 'play_song', action: 'play_search', query: q, parameters: { query: q }, description: `Play "${q}"` }]
      };
    }

    // STRICT SEARCH ONLY (NEVER PLAY)
    const searchPattern = /^(?:search\s+for|search|find\s+song|find|look\s+up|dhundo|khojo)\s+(.+)$/i;
    const searchMatch = lower.match(searchPattern);
    if (searchMatch && searchMatch[1]) {
      const q = text.slice(text.length - searchMatch[1].length).trim();
      return {
        success: true,
        intent: 'search_songs',
        confidence: 0.98,
        speechResponse: `Searching catalog for "${q}"`,
        steps: [{ tool: 'search_songs', action: 'search', query: q, parameters: { query: q }, description: `Search for "${q}"` }]
      };
    }

    // SHOW SONGS / DISPLAY ONLY (NEVER PLAY)
    // e.g. "Show songs by Arijit Singh", "Arijit Singh ke songs dikhao"
    const showSongsByMatch = lower.match(/^(?:show|display)\s+songs\s+(?:by|of)\s+(.+)$/i);
    if (showSongsByMatch && showSongsByMatch[1]) {
      const artist = text.slice(text.length - showSongsByMatch[1].length).trim();
      return {
        success: true,
        intent: 'show_songs',
        confidence: 0.98,
        speechResponse: `Displaying songs by ${artist}`,
        steps: [{ tool: 'show_songs', action: 'search', query: artist, parameters: { artist, query: artist }, description: `Show songs by "${artist}"` }]
      };
    }

    const hindiShowSongs = lower.match(/^(.+?)\s+ke\s+(?:songs|gaane)\s+dikhao$/i);
    if (hindiShowSongs && hindiShowSongs[1]) {
      const artist = text.slice(0, hindiShowSongs[1].length).trim();
      return {
        success: true,
        intent: 'show_songs',
        confidence: 0.98,
        speechResponse: `Displaying songs by ${artist}`,
        steps: [{ tool: 'show_songs', action: 'search', query: artist, parameters: { artist, query: artist }, description: `Show songs by "${artist}"` }]
      };
    }

    // OPEN ALBUM
    const albumMatch = lower.match(/^(?:open\s+)?album\s+(.+)$/i) || lower.match(/^open\s+(.+?)\s+album$/i);
    if (albumMatch && albumMatch[1]) {
      const albumName = albumMatch[1].trim();
      return {
        success: true,
        intent: 'open_album',
        confidence: 0.95,
        speechResponse: `Opening album "${albumName}"`,
        steps: [{ tool: 'open_album', action: 'search', query: `${albumName} album`, parameters: { album: albumName }, description: `Open album "${albumName}"` }]
      };
    }

    // OPEN ARTIST PROFILE
    const artistMatch = lower.match(/(?:open|show|view)?\s*artist\s+([a-zA-Z0-9\s.]+)/i) || lower.match(/([a-zA-Z0-9\s.]+)\s+(?:ka\s+profile|ka\s+page)/i);
    if (artistMatch && artistMatch[1]) {
      const artistName = artistMatch[1].trim();
      if (artistName && !['profile', 'page', 'songs', 'queue', 'music'].includes(artistName)) {
        return {
          success: true,
          intent: 'open_artist_profile',
          confidence: 0.95,
          speechResponse: `Opening ${artistName}'s profile`,
          steps: [{ tool: 'open_artist_profile', action: 'open_artist', target: artistName, parameters: { artist: artistName }, description: `Open artist profile for "${artistName}"` }]
        };
      }
    }

    // INFO / TRIVIA (NEVER PLAY)
    if (/\b(tell me about|who is|who sang|who is the singer of|who composed)\b/i.test(lower)) {
      const targetEntity = text.replace(/^(?:tell me about|who is|who sang|who is the singer of|who composed)\s+/i, '').trim();
      return {
        success: true,
        intent: 'get_artist_details',
        confidence: 0.95,
        speechResponse: `Here is what I found about ${targetEntity}`,
        steps: [{ tool: 'get_artist_details', action: 'open_artist', target: targetEntity, parameters: { artist: targetEntity }, description: `Show info for "${targetEntity}"` }]
      };
    }

    // AMBIGUOUS "OPEN <ENTITY>" COMMAND (e.g. "Open Headlights")
    // User did not specify whether it is a song, album, or artist!
    const openAmbiguous = lower.match(/^open\s+([a-zA-Z0-9\s]+)$/i);
    if (openAmbiguous && openAmbiguous[1]) {
      const entity = openAmbiguous[1].trim();
      if (!['discover', 'radio', 'history', 'home', 'playlists', 'queue', 'lyrics', 'insights'].includes(entity)) {
        return {
          success: true,
          intent: 'clarify',
          confidence: 0.90,
          requiresClarification: true,
          clarificationQuestion: `Would you like to play the song "${entity}", view the album, or search for it?`,
          speechResponse: `Would you like to play the song "${entity}", view the album, or search for it?`,
          steps: [{
            tool: 'clarify',
            action: 'clarify',
            parameters: { question: `Would you like to play "${entity}" or search for it?` },
            description: `Clarify intent for "${entity}"`
          }]
        };
      }
    }

    return null;
  },

  /**
   * Gemini Semantic Intent Understanding Engine
   */
  async queryGeminiIntent({ client, modelName, utterance, currentTrack, activeTab, history }) {
    const currentTrackSummary = currentTrack
      ? `CURRENT TRACK: "${currentTrack.title}" by ${currentTrack.artist || 'Unknown'} (Status: ${currentTrack.isPlaying ? 'Playing' : 'Paused'})`
      : 'NO TRACK CURRENTLY PLAYING';

    const systemPrompt = `
You are Loopra's Voice Command Intent Parser and Planner.
Analyze this voice command (in English, Hindi, or Hinglish) and map it into real Loopra tool actions.

SERVER CONTEXT:
- Active UI Tab: "${activeTab}"
- ${currentTrackSummary}

AVAILABLE LOOPRA TOOLS:
- navigate_to_page(page: "home" | "discover" | "radio" | "library" | "history" | "playlists" | "downloads" | "mood" | "timemachine" | "activity")
- open_artist_profile(artist: string)
- open_album(album: string)
- open_playlist(playlistName?: string)
- open_queue()
- open_lyrics()
- open_insights()
- go_back()
- play_song(query: string, index?: number)
- pause_song()
- resume_song()
- next_song()
- previous_song()
- set_volume(volume: number 0..100)
- volume_up()
- volume_down()
- mute()
- unmute()
- shuffle()
- repeat()
- search_songs(query: string)
- show_songs(artist?: string, query?: string)
- get_artist_details(artist: string)
- like_song()
- unlike_song()
- add_song_to_playlist(songTitle?: string, playlistName?: string)
- follow_artist(artist?: string)
- clarify(question: string)
- security_blocked(reason: string)

CRITICAL RULES:
1. STRICT PLAYBACK INTENT GATE:
   - A song name alone is NEVER permission to play!
   - ONLY emit 'play_song' if the user EXPLICITLY commanded playback ("play", "bajao", "chalao", "sunao", "play karo").
   - "Search Headlights" -> tool: 'search_songs', query: 'Headlights'. NEVER 'play_song'!
   - "Find Headlights" -> tool: 'search_songs', query: 'Headlights'. NEVER 'play_song'!
   - "Open Headlights album" -> tool: 'open_album', album: 'Headlights'. NEVER 'play_song'!
   - "Show songs by Arijit Singh" -> tool: 'show_songs', artist: 'Arijit Singh'. NEVER 'play_song'!
   - "Arijit Singh ke songs dikhao" -> tool: 'show_songs', artist: 'Arijit Singh'. NEVER 'play_song'!
   - "Open Listening History" -> tool: 'navigate_to_page', page: 'history'. NEVER 'play_song'!
   - "Tell me about Arijit Singh" -> tool: 'get_artist_details', artist: 'Arijit Singh'. NEVER 'play_song'!
   - "Open Headlights" -> ambiguous! Emit tool: 'clarify', question: "Would you like to play the song 'Headlights', view the album, or search for it?"
2. MULTI-STEP COMMANDS:
   - "Discover kholo aur Arijit Singh search karo" -> 2 steps: [navigate_to_page('discover'), search_songs('Arijit Singh')]
   - "Listening History kholo aur last played song play karo" -> 2 steps: [navigate_to_page('history'), play_song('last played song')]
3. SECURITY ISOLATION:
   - Any mention of admin, database, audit log, server logs, user management -> emit 'security_blocked'.

OUTPUT JSON SCHEMA:
{
  "intent": "primary_tool_name",
  "confidence": 0.95,
  "speechResponse": "Concise conversational feedback",
  "steps": [
    {
      "tool": "tool_name",
      "parameters": { ... },
      "description": "Short explanation"
    }
  ],
  "requiresClarification": false,
  "clarificationQuestion": null
}
`;

    const userContent = `VOICE COMMAND: "${utterance}"`;

    const response = await client.models.generateContent({
      model: modelName,
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userContent}` }] }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const raw = response.text?.trim() || '{}';
    const parsed = JSON.parse(raw);

    // Map tools to legacy action handlers for client execution
    const mappedSteps = (parsed.steps || []).map(s => {
      let action = s.tool;
      let target = s.parameters?.page || s.parameters?.artist || s.parameters?.album || s.parameters?.playlistName;
      let query = s.parameters?.query || s.parameters?.artist || s.parameters?.songTitle;

      if (s.tool === 'navigate_to_page') action = 'navigate_page';
      else if (s.tool === 'open_artist_profile') action = 'open_artist';
      else if (s.tool === 'play_song') action = 'play_search';
      else if (s.tool === 'search_songs' || s.tool === 'show_songs' || s.tool === 'open_album') action = 'search';
      else if (s.tool === 'pause_song') action = 'pause';
      else if (s.tool === 'resume_song') action = 'resume';
      else if (s.tool === 'next_song') action = 'next';
      else if (s.tool === 'previous_song') action = 'previous';
      else if (s.tool === 'like_song') action = 'like_current';
      else if (s.tool === 'unlike_song') action = 'unlike_current';

      return {
        ...s,
        action,
        target,
        query,
        value: s.parameters?.volume
      };
    });

    return {
      success: true,
      intent: parsed.intent || 'unknown',
      confidence: parsed.confidence || 0.9,
      speechResponse: parsed.speechResponse || 'Command processed',
      steps: mappedSteps,
      requiresClarification: Boolean(parsed.requiresClarification),
      clarificationQuestion: parsed.clarificationQuestion || null
    };
  },

  /**
   * Safe heuristic resolution when both deterministic rules and LLM are unavailable
   */
  evaluateHeuristicIntent(text = '', currentTrack = null) {
    const lower = text.toLowerCase();
    
    // If text has "play" or "chalao" or "bajao"
    if (/\b(play|chalao|bajao|sunao)\b/i.test(lower)) {
      const q = text.replace(/\b(play song|play track|play karo|play|bajao|chalao|sunao)\b/gi, '').trim();
      return {
        success: true,
        intent: 'play_song',
        confidence: 0.85,
        speechResponse: `Playing "${q || 'music'}"`,
        steps: [{ tool: 'play_song', action: 'play_search', query: q || 'music', description: `Play "${q}"` }]
      };
    }

    // Default to search only (NEVER auto-play!)
    return {
      success: true,
      intent: 'search_songs',
      confidence: 0.70,
      speechResponse: `Searching catalog for "${text}"`,
      steps: [{ tool: 'search_songs', action: 'search', query: text, description: `Search catalog for "${text}"` }]
    };
  }
};

