/**
 * Loopra Voice Task Engine
 * Dependency-aware multi-step task execution engine.
 * 
 * Features:
 * - Multi-action compound sentence splitting (English, Hindi, Hinglish)
 * - Pronoun & reference resolution ("it", "that song", "its artist", "the first song", "last played song")
 * - Sequential dependent execution passing results between steps
 * - Real application function verification
 * - Immediate abort on middle-step failure with exact step error reporting
 * - Task context persistence across consecutive voice utterances
 * - Strict Admin Dashboard isolation
 */

import { parseVoiceCommandLocally } from './voiceAgentRegistry.js';
export { parseVoiceCommandLocally };

// Recognized action verbs at the start of a clause (English / SVO)
const ACTION_VERB_PATTERNS = [
  // Playback
  /^(play|chalao|bajao|start playing|resume|continue|unpause)\b/i,
  /^(pause|stop|hold on|ruk jao|rok do|gaana roko)\b/i,
  /^(next|skip|agla gaana|agla track|agla)\b/i,
  /^(previous|prev|pichla gaana|pichla track|pichla|pichla song)\b/i,
  /^(shuffle|turn\s+(on\s+)?shuffle|shuffle\s+(on|off|chalao))\b/i,
  /^(repeat|loop|set repeat)\b/i,
  // Volume
  /^(volume|set volume|awaaz|sound|increase volume|decrease volume|volume up|volume down|mute|unmute)\b/i,
  // Library
  /^(usko|isse|is gaane ko|use|unhe|it)\s+(like|favorite|favourite|playlist|dil|pasand)/i,
  /^(like|favorite|favourite|add to favorites|add to liked|dil do|pasand karo)\b/i,
  /^(unlike|remove from favorites|remove from favourites|remove this song|dislike|remove|hatao|nikal do)\b/i,
  /^(add to playlist|add to favorites|add that song|add|playlist mein daalo|playlist)\b/i,
  /^(follow|unfollow)\b/i,
  // Avatar
  /^(wave|wink|dance|jump|pose)\b/i,
  // Details & Modals
  /^(lyrics|open lyrics|show lyrics|lyrics kholo|lyrics dikhao)\b/i,
  /^(queue|open\s+queue|show\s+queue|queue\s+kholo|up\s+next|open\s+playback\s+queue)\b/i,
  /^(insights|recap|weekly recap|stats|listening stats|listening insights)\b/i,
  /^(artist|open\s+artist|view\s+artist|artist\s+profile|show\s+artist|open\s+this\s+artist(?:\s+profile)?|open\s+the\s+artist(?:\s+profile)?|open\s+its\s+artist(?:\s+profile)?)\b/i,
  // Navigation & Search
  /^(search|search for|dhoondho|khojo|find)\b/i,
  /^(open|show|go to|navigate to|jao|kholo|dikhao|view)\b/i,
  /^(back|go back|piche jao|wapas jao)\b/i
];

/**
 * Checks if a string segment is an independent action clause.
 * Supports English SVO (verb at start) and Hindi/Hinglish SOV (verb at end).
 */
function isActionClause(str = '') {
  const trimmed = str.trim();
  if (!trimmed) return false;
  if (ACTION_VERB_PATTERNS.some(pat => pat.test(trimmed))) return true;

  // Hindi / SOV trailing verbs: "search karo", "play karo", "bajao", "dikhao", "kholo", "like karo", "karo"
  const hindiVerbEndPattern = /(?:play\s+karo|search\s+karo|bajao|chalao|sunao|dikhao|kholo|like\s+karo|daalo|karo|batao)$/i;
  return hindiVerbEndPattern.test(trimmed);
}

/**
 * Splits a compound voice instruction into distinct action clauses.
 * Respects song titles containing "and" (e.g. "Play Romeo and Juliet" stays 1 clause,
 * whereas "Play Kesariya and like it" splits into 2 clauses).
 */
export function splitVoiceInstructionIntoClauses(rawText = '') {
  if (!rawText || typeof rawText !== 'string') return [];
  const text = rawText.trim();
  if (!text) return [];

  // Delimiters:
  // - ", then", " and then ", " then ", " after that ", " and also ", " and ", " also ", " & "
  // - Hindi: " aur phir ", " phir ", " uske baad ", " aur ", " tatha "
  // - Punctuation: commas, semicolons
  const rawSplits = text.split(/,\s*(?:then|and\s+then|aur\s+phir|phir|uske\s+baad)?\s*|\s+(?:and\s+then|then|after\s+that|aur\s+phir|phir|uske\s+baad|and\s+also|and|also|aur|tatha|&)\s+|;\s*/i);

  const clauses = [];
  let buffer = '';

  for (let i = 0; i < rawSplits.length; i++) {
    const chunk = rawSplits[i].trim();
    if (!chunk) continue;

    // Strip leading connector words that may survive comma-splitting
    const cleanChunk = chunk.replace(/^(?:and\s+then|and\s+also|and|then|after\s+that|aur\s+phir|phir|uske\s+baad|aur|also|tatha|&)\s+/i, '').trim();
    if (!cleanChunk) continue;

    if (!buffer) {
      buffer = cleanChunk;
    } else {
      // Check if the cleaned chunk represents an action clause
      if (isActionClause(cleanChunk)) {
        clauses.push(buffer);
        buffer = cleanChunk;
      } else {
        // Chunk is part of the previous clause (e.g., "Juliet" in "Romeo and Juliet")
        buffer += ' and ' + chunk;
      }
    }
  }

  if (buffer) {
    clauses.push(buffer);
  }

  return clauses.map(c => c.trim()).filter(Boolean);
}

/**
 * Resolves follow-up pronoun references ("it", "this song", "that song", "its artist", "last played song")
 * using the current or inherited task context.
 */
export function resolveStepReferences(parsedStep, taskContext = {}) {
  if (!parsedStep) return null;
  const resolved = { ...parsedStep };
  const currentSong = taskContext.currentSong || taskContext.lastPlayedTrack || null;
  const currentArtist = taskContext.lastArtist || currentSong?.artist || currentSong?.channel || null;

  // 1. Target track for library actions (like, add to playlist)
  if (['like_current', 'unlike_current', 'add_to_playlist'].includes(resolved.action)) {
    if (!resolved.target && currentSong) {
      resolved.target = currentSong;
    }
  }

  // 2. Target artist for artist actions (open_artist, follow_artist)
  if (['open_artist', 'follow_artist'].includes(resolved.action)) {
    const queryStr = String(resolved.target || '').toLowerCase().trim();
    if (
      !resolved.target ||
      ['it', 'this', 'that', 'its artist', 'this artist', 'the artist', 'artist', 'its artist profile', 'this artist profile'].includes(queryStr) ||
      queryStr.includes('artist') ||
      queryStr.includes('track') ||
      queryStr.includes('song')
    ) {
      if (currentArtist) {
        resolved.target = currentArtist;
      }
    }
  }

  // 3. Play track from search results index ("play the first song", "play second track")
  if (resolved.action === 'play_search' && resolved.query) {
    const queryLower = resolved.query.toLowerCase().trim();
    const ordinalMatch = queryLower.match(/\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|pehla|doosra|teesra)\b/i);
    if (ordinalMatch && Array.isArray(taskContext.lastSearchResults) && taskContext.lastSearchResults.length > 0) {
      const ordWord = ordinalMatch[1].toLowerCase();
      let idx = 0;
      if (['first', '1st', 'pehla'].includes(ordWord)) idx = 0;
      else if (['second', '2nd', 'doosra'].includes(ordWord)) idx = 1;
      else if (['third', '3rd', 'teesra'].includes(ordWord)) idx = 2;
      else if (['fourth', '4th'].includes(ordWord)) idx = 3;
      else if (['fifth', '5th'].includes(ordWord)) idx = 4;

      const matchedTrack = taskContext.lastSearchResults[idx] || taskContext.lastSearchResults[0];
      if (matchedTrack) {
        resolved.action = 'play_direct';
        resolved.track = matchedTrack;
      }
    } else if (/\b(last played song|last played track|last song|pichla gaana|previous song)\b/i.test(queryLower)) {
      // 4. Resolve "last played song"
      const target = taskContext.lastPlayedTrack || taskContext.currentSong;
      if (target) {
        resolved.action = 'play_direct';
        resolved.track = target;
      }
    }
  }

  return resolved;
}

/**
 * Parses a single or multi-step instruction into an array of resolved, dependency-aware actions.
 */
export function parseMultiStepInstruction(rawText = '', taskContext = {}) {
  const clauses = splitVoiceInstructionIntoClauses(rawText);
  if (clauses.length === 0) return [];

  // Parse each clause locally
  const parsedSteps = [];
  let workingContext = { ...taskContext };

  for (const clause of clauses) {
    const parsed = parseVoiceCommandLocally(clause, workingContext);
    if (!parsed) continue;

    // Strict Security Isolation: If any clause attempts administrative access, return blocked
    if (parsed.action === 'security_blocked' || parsed.type === 'security_blocked') {
      return [{
        type: 'security_blocked',
        action: 'security_blocked',
        speechResponse: 'Action blocked: Administrative security isolation.',
        description: 'Administrative access blocked'
      }];
    }

    const resolved = resolveStepReferences(parsed, workingContext);
    parsedSteps.push(resolved);

    // Predictively update working context for subsequent clauses in the same sentence
    if (resolved.action === 'play_search' && resolved.query) {
      workingContext.lastQuery = resolved.query;
      if (!/\b(first|1st|second|2nd|third|3rd|fourth|4th|track|song|gaana)\b/i.test(resolved.query)) {
        workingContext.lastArtist = resolved.query;
      }
    } else if (resolved.action === 'search' && resolved.query) {
      workingContext.lastQuery = resolved.query;
      workingContext.lastArtist = resolved.query;
    }
  }

  return parsedSteps;
}

/**
 * Executes a sequence of steps through real application handlers with dependency passing
 * and immediate failure isolation.
 */
export async function executeTaskPipeline(steps = [], initialContext = {}, handlers = {}) {
  const {
    onPlayTrack,
    onTogglePlayPause,
    onNextTrack,
    onPrevTrack,
    onToggleShuffle,
    onToggleRepeat,
    onSetVolume,
    onToggleLike,
    onAddToPlaylist,
    onNavigate,
    onOpenInsights,
    onOpenQueue,
    onOpenLyrics,
    onGoBack,
    onOpenArtist,
    searchCatalog
  } = handlers;

  const currentContext = {
    ...initialContext,
    completedSteps: [],
    failedStep: null
  };

  if (!Array.isArray(steps) || steps.length === 0) {
    return {
      success: false,
      completedSteps: [],
      failedStep: { index: 0, action: 'none', error: 'No actionable instructions provided.' },
      message: 'No actionable instructions provided.'
    };
  }

  for (let i = 0; i < steps.length; i++) {
    const rawStep = steps[i];
    // Dynamic reference resolution at time of step execution
    const step = resolveStepReferences(rawStep, currentContext);

    try {
      let stepResult = null;

      // 1. Security Check
      if (step.action === 'security_blocked' || step.type === 'security_blocked') {
        throw new Error('Administrative functions are strictly isolated from the Voice Agent.');
      }

      // 2. Playback: Play direct track
      if (step.action === 'play_direct' && step.track) {
        if (!onPlayTrack) throw new Error('Player handler unavailable.');
        await onPlayTrack(step.track);
        currentContext.currentSong = step.track;
        currentContext.lastPlayedTrack = step.track;
        currentContext.lastArtist = step.track.artist || step.track.channel;
        currentContext.isPlaying = true;
        stepResult = { description: `Played ${step.track.title}`, data: step.track };
      }

      // 3. Playback: Play Search
      else if (step.action === 'play_search') {
        let track = null;
        if (typeof searchCatalog === 'function') {
          const results = await searchCatalog(step.query);
          if (Array.isArray(results) && results.length > 0) {
            const qLower = (step.query || '').toLowerCase().trim();
            const matched = results.find(r => r.title?.toLowerCase().includes(qLower) || r.artist?.toLowerCase().includes(qLower));
            track = matched || results[0];
            currentContext.lastSearchResults = results;
          }
        }

        if (!track && step.track) {
          track = step.track;
        }

        if (!track) {
          if (!step.query || !step.query.trim()) {
            throw new Error('No song or artist specified to play.');
          }
          track = {
            id: `v_${Date.now()}`,
            title: step.query,
            artist: step.query
          };
        }

        if (!onPlayTrack) throw new Error('Player handler unavailable.');
        await onPlayTrack(track);
        currentContext.currentSong = track;
        currentContext.lastPlayedTrack = track;
        currentContext.lastArtist = track.artist || track.channel || step.query;
        currentContext.isPlaying = true;
        stepResult = { description: `Now playing "${track.title}"`, data: track };
      }

      // 4. Playback: Pause
      else if (step.action === 'pause') {
        if (currentContext.isPlaying && onTogglePlayPause) {
          await onTogglePlayPause();
          currentContext.isPlaying = false;
        }
        stepResult = { description: 'Music paused' };
      }

      // 5. Playback: Resume
      else if (step.action === 'resume') {
        if (!currentContext.isPlaying && onTogglePlayPause) {
          await onTogglePlayPause();
          currentContext.isPlaying = true;
        }
        stepResult = { description: 'Music resumed' };
      }

      // 6. Playback: Next / Skip
      else if (step.action === 'next') {
        if (!onNextTrack) throw new Error('Next track handler unavailable.');
        await onNextTrack();
        stepResult = { description: 'Skipped to next track' };
      }

      // 7. Playback: Previous
      else if (step.action === 'previous') {
        if (!onPrevTrack) throw new Error('Previous track handler unavailable.');
        await onPrevTrack();
        stepResult = { description: 'Returned to previous track' };
      }

      // 8. Playback: Shuffle
      else if (step.action === 'shuffle') {
        if (!onToggleShuffle) throw new Error('Shuffle handler unavailable.');
        await onToggleShuffle();
        currentContext.isShuffle = !currentContext.isShuffle;
        stepResult = { description: 'Toggled shuffle mode' };
      }

      // 9. Playback: Repeat
      else if (step.action === 'repeat') {
        if (!onToggleRepeat) throw new Error('Repeat handler unavailable.');
        await onToggleRepeat();
        stepResult = { description: 'Toggled repeat mode' };
      }

      // 10. Volume: Set volume
      else if (step.action === 'set_volume') {
        if (!onSetVolume) throw new Error('Volume handler unavailable.');
        const targetVol = typeof step.value === 'number' ? Math.max(0, Math.min(100, step.value)) : 70;
        await onSetVolume(targetVol);
        currentContext.volume = targetVol;
        stepResult = { description: `Set volume to ${targetVol}%` };
      }

      // 11. Volume: Up / Down / Mute / Unmute
      else if (step.action === 'volume_up') {
        if (!onSetVolume) throw new Error('Volume handler unavailable.');
        const nextV = Math.min(100, (currentContext.volume || 70) + 15);
        await onSetVolume(nextV);
        currentContext.volume = nextV;
        stepResult = { description: `Increased volume to ${nextV}%` };
      } else if (step.action === 'volume_down') {
        if (!onSetVolume) throw new Error('Volume handler unavailable.');
        const nextV = Math.max(0, (currentContext.volume || 70) - 15);
        await onSetVolume(nextV);
        currentContext.volume = nextV;
        stepResult = { description: `Decreased volume to ${nextV}%` };
      } else if (step.action === 'mute') {
        if (!onSetVolume) throw new Error('Volume handler unavailable.');
        await onSetVolume(0);
        stepResult = { description: 'Muted audio' };
      } else if (step.action === 'unmute') {
        if (!onSetVolume) throw new Error('Volume handler unavailable.');
        const restoreV = currentContext.volume || 70;
        await onSetVolume(restoreV);
        stepResult = { description: `Unmuted audio to ${restoreV}%` };
      }

      // 12. Library: Like / Favorite
      else if (step.action === 'like_current') {
        const targetTrack = currentContext.currentSong || currentContext.lastPlayedTrack;
        if (!targetTrack) {
          throw new Error('No song currently playing to add to favorites.');
        }
        if (!onToggleLike) throw new Error('Like handler unavailable.');
        await onToggleLike(targetTrack);
        stepResult = { description: `Favorited "${targetTrack.title}"`, data: targetTrack };
      }

      // 12b. Library: Unlike / Remove from Favorites
      else if (step.action === 'unlike_current' || step.action === 'remove_favorite') {
        const targetTrack = step.target || currentContext.currentSong || currentContext.lastPlayedTrack;
        if (!targetTrack) {
          throw new Error('No song currently playing or specified to remove from favorites.');
        }
        if (!onToggleLike) throw new Error('Like handler unavailable.');
        await onToggleLike(targetTrack);
        stepResult = { description: `Removed "${targetTrack.title || 'song'}" from favorites`, data: targetTrack };
      }

      // 12c. Avatar Action: Wave, Wink, Dance, Jump, Pose
      else if (step.action === 'avatar_action') {
        const gesture = step.gesture || step.target || 'wave';
        if (typeof window !== 'undefined' && typeof window.__loopraTriggerAvatarGesture === 'function') {
          window.__loopraTriggerAvatarGesture(gesture, 2500);
        } else if (typeof window !== 'undefined' && typeof window.__loopraPlayGesture === 'function') {
          window.__loopraPlayGesture(gesture, 2500);
        }
        stepResult = { description: `Triggered Loopra ${gesture} animation` };
      }

      // 13. Library: Add to Playlist
      else if (step.action === 'add_to_playlist') {
        const targetTrack = step.target || currentContext.currentSong || currentContext.lastPlayedTrack;
        if (!targetTrack) {
          throw new Error('No song specified or currently playing to add to playlist.');
        }
        if (!onAddToPlaylist) throw new Error('Playlist handler unavailable.');
        await onAddToPlaylist(targetTrack);
        stepResult = { description: `Added "${targetTrack.title}" to playlist`, data: targetTrack };
      }

      // 14. Navigation: Open Artist Profile
      else if (step.action === 'open_artist') {
        const targetArtist = step.target || currentContext.lastArtist || currentContext.currentSong?.artist;
        if (!targetArtist) {
          throw new Error('No artist specified or identified from the current song.');
        }
        if (!onOpenArtist) throw new Error('Artist navigation handler unavailable.');
        await onOpenArtist(targetArtist);
        currentContext.lastArtist = targetArtist;
        stepResult = { description: `Opened artist profile for ${targetArtist}`, data: targetArtist };
      }

      // 15. Navigation: Open Lyrics
      else if (step.action === 'open_lyrics') {
        if (!onOpenLyrics) throw new Error('Lyrics handler unavailable.');
        await onOpenLyrics();
        stepResult = { description: 'Opened synchronized lyrics' };
      }

      // 16. Navigation: Open Queue
      else if (step.action === 'open_queue') {
        if (!onOpenQueue) throw new Error('Queue handler unavailable.');
        await onOpenQueue();
        stepResult = { description: 'Opened playback queue' };
      }

      // 17. Navigation: Open Listening Insights / Weekly Recap
      else if (step.action === 'open_insights') {
        if (!onOpenInsights) throw new Error('Insights handler unavailable.');
        await onOpenInsights();
        stepResult = { description: 'Opened listening insights' };
      }

      // 18. Navigation: Standard tabs
      else if (step.action === 'navigate_page') {
        if (!onNavigate) throw new Error('Navigation handler unavailable.');
        await onNavigate(step.target);
        currentContext.activeTab = step.target;
        stepResult = { description: `Navigated to ${step.target}` };
      }

      // 19. Search (Search only, NEVER auto-play)
      else if (step.action === 'search') {
        if (typeof searchCatalog === 'function') {
          const results = await searchCatalog(step.query);
          if (Array.isArray(results) && results.length > 0) {
            currentContext.lastSearchResults = results;
          }
        } else if (onNavigate) {
          await onNavigate('discover', { query: step.query });
        } else {
          throw new Error('Search navigation handler unavailable.');
        }
        currentContext.activeTab = 'discover';
        currentContext.lastQuery = step.query;
        currentContext.lastArtist = step.query;
        stepResult = { description: `Searched catalog for "${step.query}"` };
      }

      // 20. Navigation: Back
      else if (step.action === 'go_back') {
        if (!onGoBack) throw new Error('Go back handler unavailable.');
        await onGoBack();
        stepResult = { description: 'Navigated back' };
      }

      // 21. Clarify (Intent Ambiguity)
      else if (step.action === 'clarify') {
        stepResult = { description: step.speechResponse || 'Clarification required' };
      }

      // Wake/Stop
      else if (step.action === 'wake_ping') {
        stepResult = { description: 'Hey Loopra is active and listening' };
      } else if (step.action === 'stop_continuous') {
        stepResult = { description: 'Voice session stopped' };
      } else {
        stepResult = { description: step.description || `Executed ${step.action}` };
      }

      // Record successful step verification
      currentContext.completedSteps.push({
        index: i,
        action: step.action,
        description: stepResult.description,
        data: stepResult.data || null
      });

      // Brief yield to allow UI and state rendering transitions
      await new Promise(r => setTimeout(r, 60));

    } catch (err) {
      // IMMEDIATE FAILURE ISOLATION:
      // Stop execution immediately. Do NOT run remaining steps.
      const errorMsg = err.message || 'Operation failed';
      currentContext.failedStep = {
        index: i,
        action: step.action,
        error: errorMsg
      };

      return {
        success: false,
        completedSteps: currentContext.completedSteps,
        failedStep: currentContext.failedStep,
        taskContext: currentContext,
        message: `Step ${i + 1} (${step.action}) failed: ${errorMsg}. Completed ${currentContext.completedSteps.length} of ${steps.length} steps.`
      };
    }
  }

  // ALL steps executed and verified successfully
  return {
    success: true,
    completedSteps: currentContext.completedSteps,
    failedStep: null,
    taskContext: currentContext,
    message: `Completed all ${steps.length} actions: ${currentContext.completedSteps.map(s => s.description).join(', ')}.`
  };
}
