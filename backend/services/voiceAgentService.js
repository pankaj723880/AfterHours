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
import { executeGeminiOperation, createGeminiClient, isGeminiConfigured, sanitizeLogMessage } from './geminiKeyManager.js';
import { multiModelOrchestrator } from './multiModelOrchestrator.js';

export const LOOPRA_TOOLS = [
  // Navigation
  {
    name: 'navigate_to_page',
    category: 'NAVIGATION',
    description: 'Navigate to a top-level page or station in Loopra. "barber" is Saloon FM, "truck" is Horn Ok Please, "pauwa" is Theka Session, "timemachine" is Time Machine Radio.',
    parameters: {
      page: {
        type: 'string',
        enum: ['home', 'discover', 'radio', 'library', 'history', 'playlists', 'downloads', 'mood', 'timemachine', 'activity', 'barber', 'truck', 'pauwa', 'swipe', 'for-you', 'dj-club']
      }
    }
  },
  {
    name: 'open_dj_club',
    category: 'NAVIGATION',
    description: 'Open Loopra DJ Club mixing console and procedural beat synthesizer'
  },
  {
    name: 'open_listening_rooms',
    category: 'NAVIGATION',
    description: 'Open Social Listening Rooms modal for synchronized group listening'
  },
  {
    name: 'open_similar_songs',
    category: 'NAVIGATION',
    description: 'Open Similar Songs recommendations modal for current or specified song',
    parameters: {
      songTitle: { type: 'string' }
    }
  },
  {
    name: 'open_player_settings',
    category: 'NAVIGATION',
    description: 'Open player settings and audio equalizer modal'
  },
  {
    name: 'open_sleep_timer',
    category: 'NAVIGATION',
    description: 'Open sleep timer modal'
  },
  {
    name: 'open_canvas',
    category: 'NAVIGATION',
    description: 'Open fullscreen reactive Loopra Canvas visualizer'
  },
  {
    name: 'open_profile',
    category: 'NAVIGATION',
    description: 'Open user profile and account modal'
  },
  {
    name: 'open_rating_modal',
    category: 'NAVIGATION',
    description: 'Open rate and review modal for song'
  },
  {
    name: 'dj_action',
    category: 'MUSIC',
    description: 'Execute DJ Club mixing action (start_beat, stop_beat, drop, sfx)',
    parameters: {
      action: { type: 'string' },
      sfx: { type: 'string' }
    }
  },
  {
    name: 'set_playback_speed',
    category: 'MUSIC',
    description: 'Set player playback speed (0.5 to 2.0)',
    parameters: {
      speed: { type: 'number' }
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

  // Avatar Animation Actions
  {
    name: 'avatar_action',
    category: 'AVATAR',
    description: 'Trigger a reactive visual animation or gesture for Loopra avatar (wave, wink, dance, jump, pose)',
    parameters: {
      gesture: { type: 'string', enum: ['wave', 'wink', 'dance', 'jump', 'pose'] }
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
    return createGeminiClient();
  },

  isGeminiConfigured() {
    return isGeminiConfigured();
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
    if (/\b(admin|administrator|admin dashboard|cms|user management|audit logs?|system metrics|server metrics|diagnostics|database|feature toggle|rollout|server logs)\b/i.test(lower)) {
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
    if (isGeminiConfigured()) {
      try {
        const execResult = await multiModelOrchestrator.executeTask('VOICE_INTENT', async ({ client, modelName: selectedModel }) => {
          return await this.queryGeminiIntent({
            client,
            modelName: selectedModel,
            utterance: cleanText,
            currentTrack,
            activeTab,
            history
          });
        }, {
          prompt: cleanText,
          timeoutMs: 8000,
          cacheTtlMs: 30000,
          extra: { activeTab, track: currentTrack?.title }
        });

        if (execResult.success && execResult.data && Array.isArray(execResult.data.steps) && execResult.data.steps.length > 0) {
          execResult.data.latencyMs = Date.now() - startTime;
          execResult.data.modelUsed = execResult.modelUsed;
          return execResult.data;
        }
      } catch (err) {
        console.warn('[VoiceAgentService] Gemini classification notice:', sanitizeLogMessage(err.message));
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

    // 0. NEGATIVE PLAY INTENT GUARD:
    // Catches phrases like: "don't play", "do not play", "mat chalao", "mat bajana", "without playing", "bina play kare"
    const hasNegativePlayModifier = (
      /\b(don'?t|do not|mat|na|bina|without|except|never)\s+(?:play|chalao|bajao|sunao|shuru)/i.test(lower) ||
      /\b(?:play|chalao|bajao|sunao)\s+(?:mat|na|nahi)\b/i.test(lower) ||
      /\b(?:don'?t|do not)\s+play\b/i.test(lower) ||
      /don'?t\s+play\s+them/i.test(lower)
    );

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

    if (/^(resume|play|continue|unpause|shuru karo|chalao|bajao|start playing|resume music|resume song|resume track|play music)$/i.test(lower)) {
      return {
        success: true,
        intent: 'resume_song',
        confidence: 1.0,
        speechResponse: 'Resuming playback',
        steps: [{ tool: 'resume_song', action: 'resume', description: 'Resume playback' }]
      };
    }

    if (/\b(next song|next track|play (?:the )?next (?:song|track)|skip song|agla gaana|agla track|skip track)\b/i.test(lower) || /^(next|skip|agla)$/i.test(lower)) {
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

    if (/\b(volume up|increase volume|louder|volume badhao|awaaz badhao|volume tej|volume badha do|awaaz badha do)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'volume_up',
        confidence: 1.0,
        speechResponse: 'Increasing volume',
        steps: [{ tool: 'volume_up', action: 'volume_up', description: 'Increase volume (+15%)' }]
      };
    }

    if (/\b(volume down|decrease volume|lower volume|softer|awaaz kam karo|volume kam karo|awaaz kam)\b/i.test(lower)) {
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

    // Library: Unlike / Remove (EVALUATED BEFORE NAVIGATION TO PREVENT REGRESSION)
    if (
      /\b(unlike|remove (?:this song )?from (?:favorites|favourites|liked)|delete from (?:favorites|favourites|liked)|dislike|favourite se hatao|favorites se hatao|liked se hatao|liked songs se hatao|is gaane ko hatao|is gaane ko delete karo|hata do|hatao isko|nikal do|remove this song|unlike this song|unlike song)\b/i.test(lower) ||
      /^(unlike|dislike|remove|hatao|hata do)$/i.test(lower)
    ) {
      return {
        success: true,
        intent: 'unlike_song',
        confidence: 1.0,
        speechResponse: currentTrack ? `Removing "${currentTrack.title || 'song'}" from Liked Songs` : 'Removing from Liked Songs',
        steps: [{ tool: 'unlike_song', action: 'unlike_current', target: currentTrack, description: `Unlike "${currentTrack?.title || 'Current Song'}"` }]
      };
    }

    // Library: Like / Favorite
    if (/\b(like this song|like this track|like it|add to favourites|add to favorites|add to liked|dil de do|pasand karo|usko like karo)\b/i.test(lower) || /^(like|favourite|favorite)$/i.test(lower)) {
      return {
        success: true,
        intent: 'like_song',
        confidence: 1.0,
        speechResponse: currentTrack ? `Adding "${currentTrack.title || 'song'}" to Liked Songs` : 'Adding to Liked Songs',
        steps: [{ tool: 'like_song', action: 'like_current', target: currentTrack, description: `Like "${currentTrack?.title || 'Current Song'}"` }]
      };
    }

    // Avatar Interactive Gestures
    if (/\b(wave karo|hath hilao|wave|say hi|hi bolo)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'avatar_action',
        confidence: 1.0,
        speechResponse: 'Loopra waves at you!',
        steps: [{ tool: 'avatar_action', action: 'avatar_action', gesture: 'wave', description: 'Loopra Wave' }]
      };
    }
    if (/\b(wink karo|aankh maro|wink)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'avatar_action',
        confidence: 1.0,
        speechResponse: 'Loopra winks!',
        steps: [{ tool: 'avatar_action', action: 'avatar_action', gesture: 'wink', description: 'Loopra Wink' }]
      };
    }
    if (/\b(dance karo|dance|nacho|groove karo)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'avatar_action',
        confidence: 1.0,
        speechResponse: 'Loopra starts dancing to the music!',
        steps: [{ tool: 'avatar_action', action: 'avatar_action', gesture: 'dance', description: 'Loopra Dance' }]
      };
    }
    if (/\b(jump karo|jump|koodo)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'avatar_action',
        confidence: 1.0,
        speechResponse: 'Loopra jumps with excitement!',
        steps: [{ tool: 'avatar_action', action: 'avatar_action', gesture: 'jump', description: 'Loopra Jump' }]
      };
    }
    if (/\b(pose karo|pose do|style dikhao|pose)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'avatar_action',
        confidence: 1.0,
        speechResponse: 'Loopra strikes a pose!',
        steps: [{ tool: 'avatar_action', action: 'avatar_action', gesture: 'pose', description: 'Loopra Pose' }]
      };
    }

    // Stations & Radio Channels (STRICT MAPPING)
    // "Saloon FM" MUST ALWAYS map to "barber"
    if (/\b(saloon|salon|barber|saloon\s*fm|salon\s*fm|lune\s*fm|luna\s*fm|saloon\s*nostalgia|90s\s*saloon)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'navigate_to_page',
        confidence: 1.0,
        speechResponse: 'Opening Saloon FM',
        steps: [{ tool: 'navigate_to_page', action: 'navigate_page', target: 'barber', parameters: { page: 'barber' }, description: 'Open Saloon FM' }]
      };
    }

    // "Horn Ok Please" maps to "truck"
    if (/\b(horn\s*ok\s*please|truck\s*melodies|highway\s*truck|dhaba|highway)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'navigate_to_page',
        confidence: 1.0,
        speechResponse: 'Opening Horn Ok Please',
        steps: [{ tool: 'navigate_to_page', action: 'navigate_page', target: 'truck', parameters: { page: 'truck' }, description: 'Open Horn Ok Please' }]
      };
    }

    // "Theka Session" maps to "pauwa"
    if (/\b(desi\s*theka|theka\s*session|theka|pauwa)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'navigate_to_page',
        confidence: 1.0,
        speechResponse: 'Opening Desi Theka Session',
        steps: [{ tool: 'navigate_to_page', action: 'navigate_page', target: 'pauwa', parameters: { page: 'pauwa' }, description: 'Open Desi Theka' }]
      };
    }

    // "Time Machine Radio" maps to "timemachine"
    if (/\b(time\s*machine|retro\s*era|purana\s*radio)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'navigate_to_page',
        confidence: 1.0,
        speechResponse: 'Opening Time Machine Radio',
        steps: [{ tool: 'navigate_to_page', action: 'navigate_page', target: 'timemachine', parameters: { page: 'timemachine' }, description: 'Open Time Machine Radio' }]
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

    if (/\b(go to liked songs|open liked songs|my liked songs|liked songs|open liked|open favourites|open favorites|liked playlist|pasandida gaane|mera liked songs kholo|meri liked songs)\b/i.test(lower) || /^(liked|favourites|favorites|liked songs)$/i.test(lower)) {
      return {
        success: true,
        intent: 'navigate_to_page',
        confidence: 1.0,
        speechResponse: 'Opening Liked Songs Collection',
        steps: [{ tool: 'navigate_to_page', action: 'navigate_page', target: 'library', parameters: { page: 'library' }, description: 'Open Liked Songs' }]
      };
    }

    // Listening Activity (Explicitly routes to 'activity' page)
    if (/\b(listening activity|listening history|recently played|recent songs|history kholo|open listening history|mera listening history|activity kholo|activity page|recent activity)\b/i.test(lower) || /^(activity|history)$/i.test(lower)) {
      return {
        success: true,
        intent: 'navigate_to_page',
        confidence: 1.0,
        speechResponse: 'Opening Listening Activity',
        steps: [{ tool: 'navigate_to_page', action: 'navigate_page', target: 'activity', parameters: { page: 'activity' }, description: 'Open Listening Activity' }]
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

    // Recap and Stats (STRICTLY opens Insights Modal, NEVER routes to activity)
    if (/\b(recap and stats|recap & stats|my listening statistics|music summary|listening report|listening insights|weekly recap|my recap|stats|statistics|listening stats|insights kholo|listening report)\b/i.test(lower) || /^(insights|recap|stats)$/i.test(lower)) {
      return {
        success: true,
        intent: 'open_insights',
        confidence: 1.0,
        speechResponse: 'Opening Recap & Stats',
        steps: [{ tool: 'open_insights', action: 'open_insights', description: 'Open Recap & Stats' }]
      };
    }

    // Advanced Modals
    if (/\b(listening rooms|listening room|social rooms|group listening|listen together|friends room|dosto ke sath suno|party room)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'open_listening_rooms',
        confidence: 1.0,
        speechResponse: 'Opening Social Listening Rooms',
        steps: [{ tool: 'open_listening_rooms', action: 'open_listening_rooms', description: 'Open Listening Rooms' }]
      };
    }

    if (/\b(similar songs|recommend similar|find similar songs|iske jaise gaane|similar music|aise hi gaane sunao|similar songs modal|related songs)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'open_similar_songs',
        confidence: 1.0,
        speechResponse: 'Opening similar songs recommendations',
        steps: [{ tool: 'open_similar_songs', action: 'open_similar_songs', target: currentTrack, description: 'Open Similar Songs' }]
      };
    }

    if (/\b(player settings|open equalizer|equalizer|audio settings|equalizer kholo|sound settings|playback settings|bass treble settings|audio quality)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'open_player_settings',
        confidence: 1.0,
        speechResponse: 'Opening player settings and equalizer',
        steps: [{ tool: 'open_player_settings', action: 'open_player_settings', description: 'Open Player Settings & Equalizer' }]
      };
    }

    if (/\b(sleep timer|open sleep timer|sleep timer kholo|timer lagao|off timer|auto off timer|music timer|sone ka timer)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'open_sleep_timer',
        confidence: 1.0,
        speechResponse: 'Opening Sleep Timer',
        steps: [{ tool: 'open_sleep_timer', action: 'open_sleep_timer', description: 'Open Sleep Timer' }]
      };
    }

    if (/\b(open canvas|canvas mode|visualizer|fullscreen visualizer|music canvas|canvas kholo|audio visualizer|loopra canvas|visualizer chalao)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'open_canvas',
        confidence: 1.0,
        speechResponse: 'Opening Loopra Canvas visualizer',
        steps: [{ tool: 'open_canvas', action: 'open_canvas', description: 'Open Canvas' }]
      };
    }

    if (/\b(user profile|open profile|my profile|profile kholo|mera profile|account settings|user account|profile dikhao)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'open_profile',
        confidence: 1.0,
        speechResponse: 'Opening your profile',
        steps: [{ tool: 'open_profile', action: 'open_profile', description: 'Open User Profile' }]
      };
    }

    if (/\b(rate song|rate this song|review song|give review|rating do|review likho|rate karo|review modal|song feedback)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'open_rating_modal',
        confidence: 1.0,
        speechResponse: 'Opening rating and review modal',
        steps: [{ tool: 'open_rating_modal', action: 'open_rating_modal', description: 'Open Rate & Review' }]
      };
    }

    // Loopra DJ Club Navigation & Controls
    if (/\b(dj club|dj mode|loopra dj club|dj mixing|dj studio|dj session|club mode|dj kholo|dj chalao|dj lagao)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'open_dj_club',
        confidence: 1.0,
        speechResponse: 'Opening Loopra DJ Club',
        steps: [{ tool: 'navigate_to_page', action: 'navigate_page', target: 'dj-club', parameters: { page: 'dj-club' }, description: 'Open DJ Club' }]
      };
    }

    if (/\b(beat drop|drop the beat|bass drop|drop the bass|beat drop karo|bass drop karo|heavy drop)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'dj_action',
        confidence: 1.0,
        speechResponse: 'Dropping the beat!',
        steps: [{ tool: 'dj_action', action: 'dj_drop', parameters: { action: 'drop' }, description: 'Trigger DJ Beat Drop' }]
      };
    }

    if (/\b(start beat|play dj beat|dj beat chalao|start dj beat|beat bajao|beat start karo|start dj)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'dj_action',
        confidence: 1.0,
        speechResponse: 'Starting DJ beat rhythm',
        steps: [{ tool: 'dj_action', action: 'dj_start_beat', parameters: { action: 'start_beat' }, description: 'Start DJ Beat' }]
      };
    }

    if (/\b(stop beat|pause dj beat|stop dj beat|dj beat roko|beat band karo|stop dj|dj band karo)\b/i.test(lower)) {
      return {
        success: true,
        intent: 'dj_action',
        confidence: 1.0,
        speechResponse: 'Stopping DJ beat',
        steps: [{ tool: 'dj_action', action: 'dj_stop_beat', parameters: { action: 'stop_beat' }, description: 'Stop DJ Beat' }]
      };
    }

    if (/\b(air horn|dj horn|horn bajao|scratch|dj scratch|laser sound|laser sfx|sub drop|crowd hype|crowd cheer)\b/i.test(lower)) {
      const sfx = lower.includes('scratch') ? 'scratch' : (lower.includes('laser') ? 'laser' : 'air_horn');
      return {
        success: true,
        intent: 'dj_action',
        confidence: 1.0,
        speechResponse: 'Playing DJ sound effect',
        steps: [{ tool: 'dj_action', action: 'dj_trigger_sfx', parameters: { action: 'sfx', sfx }, description: `Trigger DJ ${sfx}` }]
      };
    }

    const speedMatch = lower.match(/\b(?:set\s+)?(?:playback\s+)?speed\s+(?:to\s+)?(2(?:\.0)?|1\.75|1\.5|1\.25|1(?:\.0)?|0\.75|0\.5)(?:x)?\b/i);
    if (speedMatch && speedMatch[1]) {
      const spd = parseFloat(speedMatch[1]);
      return {
        success: true,
        intent: 'set_playback_speed',
        confidence: 1.0,
        speechResponse: `Setting playback speed to ${spd}x`,
        steps: [{ tool: 'set_playback_speed', action: 'set_playback_speed', parameters: { speed: spd }, value: spd, description: `Set playback speed to ${spd}x` }]
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
    // ONLY executed if NO negative play modifier is present!
    if (!hasNegativePlayModifier) {
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
    }

    // STRICT SEARCH ONLY (NEVER PLAY)
    const searchPattern = /^(?:search\s+for|search|find\s+song|find|look\s+up|dhundo|khojo)\s+(.+)$/i;
    const searchMatch = lower.match(searchPattern);
    if (searchMatch && searchMatch[1]) {
      let q = text.slice(text.length - searchMatch[1].length).trim();
      q = q
        .replace(/,\s*(?:don'?t\s+play\s+(?:them|it|songs?)?|mat\s+chalao|bina\s+play\s+kare|do\s+not\s+play\s+(?:them|it)?)/gi, '')
        .replace(/\b(don'?t\s+play\s+(?:them|it|songs?)?|mat\s+chalao|bina\s+play\s+kare|do\s+not\s+play\s+(?:them|it)?)\b/gi, '')
        .replace(/^(?:(?:\d+|five|four|three|two|one|paanch|top|best|popular)\s+)?songs?\s+(?:by|of|from)\s+/i, '')
        .trim();
      return {
        success: true,
        intent: 'search_songs',
        confidence: 0.98,
        speechResponse: `Searching catalog for "${q}"`,
        steps: [{ tool: 'search_songs', action: 'search', query: q, parameters: { query: q }, description: `Search for "${q}"` }]
      };
    }

    // Negative play fallback: e.g. "five songs by Arijit Singh, don't play them"
    if (hasNegativePlayModifier) {
      let q = text
        .replace(/^(?:search\s+for|search|find\s+song|find|look\s+up|dhundo|khojo|show|display)\s+/i, '')
        .replace(/,\s*(?:don'?t\s+play\s+(?:them|it|songs?)?|mat\s+chalao|bina\s+play\s+kare|do\s+not\s+play\s+(?:them|it)?)/gi, '')
        .replace(/\b(don'?t\s+play\s+(?:them|it|songs?)?|mat\s+chalao|bina\s+play\s+kare|do\s+not\s+play\s+(?:them|it)?)\b/gi, '')
        .replace(/^(?:(?:\d+|five|four|three|two|one|paanch|top|best|popular)\s+)?songs?\s+(?:by|of|from)\s+/i, '')
        .trim();
      return {
        success: true,
        intent: 'search_songs',
        confidence: 0.98,
        speechResponse: `Displaying songs for "${q || 'songs'}"`,
        steps: [{ tool: 'search_songs', action: 'search', query: q || 'songs', parameters: { query: q || 'songs' }, description: `Search for "${q || 'songs'}"` }]
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
- navigate_to_page(page: "home" | "discover" | "radio" | "library" | "history" | "playlists" | "downloads" | "mood" | "timemachine" | "activity" | "barber" | "truck" | "pauwa" | "swipe" | "for-you")
  * NOTE: "Saloon FM" / "Saloon" MUST ALWAYS map to page: "barber". NEVER map Saloon FM to timemachine!
  * "Horn Ok Please" / "Truck" maps to page: "truck".
  * "Theka Session" / "Desi Theka" maps to page: "pauwa".
  * "Time Machine Radio" maps to page: "timemachine".
  * "Indian Live Radio" maps to page: "radio".
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
- avatar_action(gesture: "wave" | "wink" | "dance" | "jump" | "pose")
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
   - "Find five songs by Arijit Singh, don't play them" -> tool: 'show_songs', artist: 'Arijit Singh'. NEVER 'play_song'!
   - "Remove this song from favourites" -> tool: 'unlike_song'. NEVER 'play_song'!
   - "Play the next song" -> tool: 'next_song'. NEVER 'play_song'!
   - "Open Headlights album" -> tool: 'open_album', album: 'Headlights'. NEVER 'play_song'!
   - "Show songs by Arijit Singh" -> tool: 'show_songs', artist: 'Arijit Singh'. NEVER 'play_song'!
   - "Arijit Singh ke songs dikhao" -> tool: 'show_songs', artist: 'Arijit Singh'. NEVER 'play_song'!
   - "Open Listening History" -> tool: 'navigate_to_page', page: 'history'. NEVER 'play_song'!
   - "Tell me about Arijit Singh" -> tool: 'get_artist_details', artist: 'Arijit Singh'. NEVER 'play_song'!
   - "Open Headlights" -> ambiguous! Emit tool: 'clarify', question: "Would you like to play the song 'Headlights', view the album, or search for it?"
2. MULTI-STEP COMMANDS:
   - "Open liked songs and remove this song" -> 2 steps: [navigate_to_page('library'), unlike_song()]
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
  },

  /**
   * Gemini Multimodal Native Audio Speech Recognition & Intent Comprehension
   * Accepts raw base64 microphone audio buffer.
   * Transcribes first, then classifies intent and returns structured execution plan.
   */
  async recognizeAndParseAudio({ audioData, mimeType = 'audio/webm', currentTrack = null, activeTab = 'home', history = [] }) {
    const startTime = Date.now();
    const client = this.getClient();

    if (!client) {
      return {
        success: false,
        error: 'GEMINI_NOT_CONFIGURED',
        transcript: '',
        language: 'en',
        intent: 'clarify',
        confidence: 0,
        clarification_required: true,
        clarification_question: 'Gemini API key is not configured for native audio recognition.',
        speechResponse: 'Gemini API key is not configured. Please enter your API key in settings.',
        steps: [],
        latencyMs: Date.now() - startTime
      };
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const currentTrackSummary = currentTrack
      ? `CURRENT TRACK: "${currentTrack.title}" by ${currentTrack.artist || 'Unknown'} (Status: ${currentTrack.isPlaying ? 'Playing' : 'Paused'})`
      : 'NO TRACK CURRENTLY PLAYING';

    const systemPrompt = `
You are Loopra's Native Audio Speech Recognizer and Command Intent Parser.
You receive direct raw microphone audio from a user speaking in Hindi, Hinglish, Roman Hindi, or Indian English.

TASKS:
1. SPEECH RECOGNITION (TRANSCRIBE FIRST):
   - Listen to the audio and provide the exact transcript in "transcript".
   - Accurately preserve Indian artist names (e.g., "Arijit Singh", "Shreya Ghoshal", "Diljit Dosanjh", "Pritam", "Sidhu Moose Wala", "AP Dhillon"), Hindi words ("chalao", "bajao", "roko", "agla", "pichla", "kholo", "hatao", "saloon fm", "desi theka"), and song titles.
   - Set "language" to "hi", "en", or "hinglish".

2. CONVERSATION UNDERSTANDING:
   - Understand casual speech, Indian slang, incomplete sentences, and contextual follow-ups ("play this", "remove this", "next one", "open that", "isse like karo", "hata do").
   - Multi-turn conversation history: ${JSON.stringify(history.slice(-4))}
   - Active Tab: "${activeTab}"
   - ${currentTrackSummary}

3. RELIABLE LOOPRA INTENT MAPPING:
   - "navigate_to_page":
       "activity" for "Listening Activity", "listening history", "recently played", "recent activity".
       "barber" for "Saloon FM".
       "truck" for "Horn Ok Please".
       "pauwa" for "Desi Theka" / "Theka Session".
       "timemachine" for "Time Machine Radio".
       "radio" for "Indian Live Radio".
       "library" for "Liked Songs" / "Library".
       "playlists" for "Playlists".
       "discover" for "Discover".
       "home" for "Home".
   - "open_insights": STRICTLY for "Recap and Stats", "my listening statistics", "music summary", "listening report", "weekly recap", "recap", "stats", "statistics", "listening stats", "listening insights". NOTE: Explicitly requesting Recap & Stats must NEVER navigate to activity or history!
   - "play_song": STRICT PLAYBACK INTENT GATE! ONLY call if user EXPLICITLY commanded playback ("play", "bajao", "chalao", "sunao"). Query must be cleaned song title or artist.
   - "search_songs": For searching/finding songs without playing ("search Headlights", "find five songs by Arijit Singh, don't play them", "Arijit Singh ke gaane dikhao").
   - "pause_song": "pause", "stop", "ruk jao", "rok do", "gaana roko".
   - "resume_song": "resume", "continue", "wapas play karo".
   - "next_song": "next", "agla gaana", "skip", "play next song".
   - "previous_song": "previous", "prev", "pichla gaana".
   - "set_volume": volume 0..100.
   - "volume_up" / "volume_down" / "mute" / "unmute".
   - "like_song": "like this song", "add to favourites".
   - "unlike_song": "remove from favourites", "unlike", "favourite se hatao", "hata do".
   - "avatar_action": "wave" | "wink" | "dance" | "jump" | "pose".
   - "clarify": When user intent is genuinely ambiguous (e.g. user just said "Headlights" alone).

4. SHORT SPOKEN CONFIRMATION:
   - Provide a short, natural Indian conversational response in "speechResponse" (e.g., "Playing Kesariya", "Opening Recap & Stats", "Removed from favourites", "Paused").

STRICT JSON OUTPUT FORMAT:
{
  "transcript": "exact transcription",
  "language": "hi" | "en" | "hinglish",
  "intent": "navigate_to_page" | "open_insights" | "play_song" | "search_songs" | "pause_song" | "resume_song" | "next_song" | "previous_song" | "set_volume" | "volume_up" | "volume_down" | "mute" | "unmute" | "like_song" | "unlike_song" | "avatar_action" | "clarify",
  "target": "target string or null",
  "parameters": { ... },
  "clarification_required": boolean,
  "clarification_question": "string or null",
  "speechResponse": "short confirmation",
  "steps": [
    {
      "tool": "tool_name",
      "action": "action_name",
      "target": "target",
      "parameters": { ... },
      "description": "description"
    }
  ]
}
`;

    try {
      let cleanBase64 = audioData;
      if (cleanBase64.includes(';base64,')) {
        cleanBase64 = cleanBase64.split(';base64,')[1];
      }

      const execResult = await multiModelOrchestrator.executeTask('SPEECH_TO_TEXT', async ({ client, modelName }) => {
        return await client.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType || 'audio/webm',
                    data: cleanBase64
                  }
                },
                {
                  text: systemPrompt
                }
              ]
            }
          ],
          config: {
            responseMimeType: 'application/json'
          }
        });
      }, {
        timeoutMs: 12000,
        skipCache: true
      });

      if (!execResult.success) {
        throw new Error(execResult.message || 'Speech recognition failed');
      }

      const response = execResult.data;
      const raw = response.text?.trim() || '{}';
      let parsed = {};
      try {
        parsed = JSON.parse(raw);
      } catch (jsonErr) {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      }

      const verifiedPlan = this.validateAndNormalizePlan({
        transcript: parsed.transcript || '',
        language: parsed.language || 'en',
        intent: parsed.intent || 'unknown',
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        speechResponse: parsed.speechResponse || '',
        clarification_required: Boolean(parsed.clarification_required),
        clarification_question: parsed.clarification_question || null,
        target: parsed.target || null,
        parameters: parsed.parameters || {},
        currentTrack
      });

      verifiedPlan.latencyMs = Date.now() - startTime;
      verifiedPlan.modelUsed = execResult.modelUsed;
      return verifiedPlan;
    } catch (err) {
      console.warn('[VoiceAgentService] Native audio recognition error:', err.message);
      return {
        success: false,
        error: err.message,
        transcript: '',
        intent: 'error',
        speechResponse: 'Could not recognize audio. Please try again.',
        steps: [],
        latencyMs: Date.now() - startTime
      };
    }
  },

  /**
   * Dedicated Multilingual Translation
   */
  async translateText({ text = '', targetLang = 'hi', sourceLang = 'auto' }) {
    return await multiModelOrchestrator.translateText({ text, targetLang, sourceLang });
  },

  /**
   * Validates and normalizes parsed audio/text plans to enforce all Loopra strict safety rules.
   */
  validateAndNormalizePlan({
    transcript = '',
    language = 'en',
    intent = 'unknown',
    steps = [],
    speechResponse = '',
    clarification_required = false,
    clarification_question = null,
    target = null,
    parameters = {},
    currentTrack = null
  }) {
    const lowerTranscript = (transcript || '').toLowerCase().trim();

    // 1. ADMINISTRATIVE ISOLATION RULE
    if (/\b(admin|administrator|admin dashboard|cms|user management|audit logs?|system metrics|diagnostics|database|feature toggle|server logs)\b/i.test(lowerTranscript)) {
      return {
        success: true,
        transcript,
        language,
        intent: 'security_blocked',
        confidence: 1.0,
        speechResponse: 'Admin operations are strictly isolated from the Voice Agent.',
        steps: [{
          tool: 'security_blocked',
          action: 'security_blocked',
          parameters: { reason: 'Administrative functions isolated' },
          description: 'Administrative access blocked'
        }],
        clarification_required: false,
        clarification_question: null
      };
    }

    // 2. NEGATIVE PLAY INTENT GUARD:
    // If transcript contains "don't play", "do not play", "mat chalao", "without playing",
    // never execute play_song! Convert to search_songs.
    const hasNegativePlay = (
      /\b(don'?t|do not|mat|na|bina|without|except|never)\s+(?:play|chalao|bajao|sunao|shuru)/i.test(lowerTranscript) ||
      /\b(?:play|chalao|bajao|sunao)\s+(?:mat|na|nahi)\b/i.test(lowerTranscript) ||
      /\b(?:don'?t|do not)\s+play\b/i.test(lowerTranscript)
    );

    // 3. NAVIGATION ENFORCEMENT:
    // Recap & Stats must NEVER navigate to activity!
    const isExplicitRecapStats = /\b(recap and stats|recap & stats|my listening statistics|music summary|listening report|listening insights|weekly recap|my recap|stats|statistics|listening stats|insights kholo)\b/i.test(lowerTranscript);
    const isExplicitActivity = /\b(listening activity|listening history|recently played|recent songs|history kholo|open listening history|activity kholo|activity page|recent activity)\b/i.test(lowerTranscript);

    let normalizedIntent = intent;
    let normalizedSpeech = speechResponse;

    if (isExplicitRecapStats) {
      normalizedIntent = 'open_insights';
      if (!normalizedSpeech) normalizedSpeech = 'Opening Recap & Stats';
      steps = [{
        tool: 'open_insights',
        action: 'open_insights',
        description: 'Open Recap & Stats'
      }];
    } else if (isExplicitActivity) {
      normalizedIntent = 'navigate_to_page';
      if (!normalizedSpeech) normalizedSpeech = 'Opening Listening Activity';
      steps = [{
        tool: 'navigate_to_page',
        action: 'navigate_page',
        target: 'activity',
        parameters: { page: 'activity' },
        description: 'Open Listening Activity'
      }];
    }

    // 4. MAP AND VALIDATE EACH STEP
    const validatedSteps = (steps.length > 0 ? steps : []).map(s => {
      let action = s.action || s.tool;
      let stepTarget = s.target || s.parameters?.page || s.parameters?.artist || s.parameters?.album || s.parameters?.playlistName;
      let query = s.parameters?.query || s.parameters?.artist || s.parameters?.songTitle || s.query;

      if (s.tool === 'navigate_to_page') {
        action = 'navigate_page';
        stepTarget = s.parameters?.page || s.target;
      } else if (s.tool === 'open_insights') {
        action = 'open_insights';
      } else if (s.tool === 'play_song') {
        if (hasNegativePlay) {
          action = 'search';
        } else {
          action = 'play_search';
        }
      } else if (s.tool === 'search_songs' || s.tool === 'show_songs') {
        action = 'search';
      } else if (s.tool === 'pause_song') {
        action = 'pause';
      } else if (s.tool === 'resume_song') {
        action = 'resume';
      } else if (s.tool === 'next_song') {
        action = 'next';
      } else if (s.tool === 'previous_song') {
        action = 'previous';
      } else if (s.tool === 'like_song') {
        action = 'like_current';
        stepTarget = currentTrack;
      } else if (s.tool === 'unlike_song') {
        action = 'unlike_current';
        stepTarget = currentTrack;
      } else if (s.tool === 'avatar_action') {
        action = 'avatar_action';
      }

      return {
        tool: s.tool || action,
        action,
        target: stepTarget,
        query,
        parameters: s.parameters || {},
        description: s.description || `Execute ${action}`
      };
    });

    // If steps array is empty, generate from intent
    if (validatedSteps.length === 0 && normalizedIntent && normalizedIntent !== 'unknown') {
      if (normalizedIntent === 'open_insights') {
        validatedSteps.push({ tool: 'open_insights', action: 'open_insights', description: 'Open Recap & Stats' });
      } else if (normalizedIntent === 'navigate_to_page') {
        validatedSteps.push({ tool: 'navigate_to_page', action: 'navigate_page', target: target || 'home', description: `Open ${target || 'page'}` });
      } else if (normalizedIntent === 'unlike_song') {
        validatedSteps.push({ tool: 'unlike_song', action: 'unlike_current', target: currentTrack, description: 'Remove from Liked Songs' });
      } else if (normalizedIntent === 'like_song') {
        validatedSteps.push({ tool: 'like_song', action: 'like_current', target: currentTrack, description: 'Add to Liked Songs' });
      } else if (normalizedIntent === 'pause_song') {
        validatedSteps.push({ tool: 'pause_song', action: 'pause', description: 'Pause playback' });
      } else if (normalizedIntent === 'resume_song') {
        validatedSteps.push({ tool: 'resume_song', action: 'resume', description: 'Resume playback' });
      } else if (normalizedIntent === 'next_song') {
        validatedSteps.push({ tool: 'next_song', action: 'next', description: 'Next track' });
      } else if (normalizedIntent === 'previous_song') {
        validatedSteps.push({ tool: 'previous_song', action: 'previous', description: 'Previous track' });
      } else if (normalizedIntent === 'search_songs') {
        validatedSteps.push({ tool: 'search_songs', action: 'search', query: target || parameters?.query || transcript, description: 'Search catalog' });
      } else if (normalizedIntent === 'play_song' && !hasNegativePlay) {
        validatedSteps.push({ tool: 'play_song', action: 'play_search', query: target || parameters?.query || transcript, description: 'Play track' });
      }
    }

    return {
      success: true,
      transcript,
      language,
      intent: normalizedIntent,
      target,
      parameters,
      clarification_required: Boolean(clarification_required),
      clarification_question,
      speechResponse: normalizedSpeech || 'Done dost! Command execute ho gaya.',
      steps: validatedSteps
    };
  }
};

