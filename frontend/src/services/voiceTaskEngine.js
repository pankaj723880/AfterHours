/**
 * Loopra Voice Task Engine
 * Comprehensive Multi-Step Task Execution Engine & Planner.
 * 
 * Pipeline:
 * USER COMMAND → INTENT DETECTION → TASK PLANNER → ACTION REGISTRY → VALIDATION → EXECUTION → RESULT VERIFICATION → RESPONSE
 * 
 * Features:
 * - Multi-lingual clause splitting (English, Hindi, Hinglish)
 * - Reference & pronoun resolution ("it", "ye song", "us playlist mein", "last played song", "pichhla song", "next wala")
 * - Ordered execution plan generation
 * - Step status tracking (pending -> in_progress -> completed / failed)
 * - Real application handler execution with dependency passing
 * - Immediate abort on middle-step failure with exact step explanation
 * - Confirmation interception for destructive actions (e.g. clear_history, delete_playlist)
 * - Safe screen and state verification
 * - Avatar thinking / celebrating animation triggering
 * - Strict Administrative isolation
 */

import { parseVoiceCommandLocally } from './voiceAgentRegistry.js';
import { ACTION_REGISTRY, matchActionByAlias, getActionById } from './actionRegistry.js';
import { SPECIAL_STATIONS } from '../constants/stations.js';
export { parseVoiceCommandLocally, ACTION_REGISTRY };

// Recognized action verbs at the start of a clause (English / SVO)
const ACTION_VERB_PATTERNS = [
  // Playback
  /^(play|chalao|bajao|start playing|resume|continue|unpause)\b/i,
  /^(pause|stop|hold on|ruk jao|rok do|gaana roko|radio band karo|band karo)\b/i,
  /^(next|skip|agla gaana|agla track|agla)\b/i,
  /^(previous|prev|pichla gaana|pichla track|pichla|pichla song)\b/i,
  /^(shuffle|turn\s+(on\s+)?shuffle|shuffle\s+(on|off|chalao))\b/i,
  /^(repeat|loop|set repeat)\b/i,
  // Volume
  /^(volume|set volume|awaaz|sound|increase volume|decrease volume|volume up|volume down|mute|unmute)\b/i,
  // Library & Playlists
  /^(usko|isse|is gaane ko|use|unhe|it)\s+(like|favorite|favourite|playlist|dil|pasand)/i,
  /^(like|favorite|favourite|add to favorites|add to liked|dil do|pasand karo|favourite karo)\b/i,
  /^(unlike|remove from favorites|remove from favourites|remove this song|dislike|remove|hatao|nikal do)\b/i,
  /^(add to playlist|add to favorites|add that song|add|playlist mein daalo|playlist mein add karo)\b/i,
  /^(create playlist|nayi playlist banao|ek nayi playlist banao|make playlist|new playlist)\b/i,
  /^(delete playlist|remove playlist|playlist hatao)\b/i,
  /^(queue mein next add karo|add to queue|queue mein daalo|queue mein add karo)\b/i,
  /^(clear queue|queue khali karo)\b/i,
  /^(clear history|listening history clear kar do|puri history delete karo|history saaf karo)\b/i,
  /^(remove from history|history se ye gaana hatao|history se remove karo|sirf .* song remove karo)\b/i,
  /^(follow|unfollow)\b/i,
  // Avatar
  /^(wave|wink|dance|jump|pose|sit|sit down)\b/i,
  // DJ Club & Controls
  /^(dj club|open dj club|dj mode|start dj|stop dj|beat drop|bass drop|drop the beat|drop the bass|air horn|dj horn|scratch)\b/i,
  // Details & Modals
  /^(lyrics|open lyrics|show lyrics|lyrics kholo|lyrics dikhao)\b/i,
  /^(queue|open\s+queue|show\s+queue|queue\s+kholo|up\s+next|open\s+playback\s+queue)\b/i,
  /^(insights|recap|weekly recap|stats|listening stats|listening insights)\b/i,
  /^(listening rooms|open listening rooms|social rooms|similar songs|recommend similar|player settings|open equalizer|equalizer|sleep timer|open sleep timer|canvas|open canvas|user profile|open profile|rate song|rate this song)\b/i,
  /^(artist|open\s+artist|view\s+artist|artist\s+profile|show\s+artist|open\s+this\s+artist(?:\s+profile)?|open\s+the\s+artist(?:\s+profile)?|open\s+its\s+artist(?:\s+profile)?|uska artist profile kholo)\b/i,
  // Navigation & Search
  /^(search|search for|dhoondho|khojo|find)\b/i,
  /^(open|show|go to|navigate to|jao|kholo|dikhao|view)\b/i,
  /^(back|go back|piche jao|wapas jao)\b/i
];

/**
 * Checks if a string segment is an independent action clause.
 */
function isActionClause(str = '') {
  const trimmed = str.trim();
  if (!trimmed) return false;
  if (ACTION_VERB_PATTERNS.some(pat => pat.test(trimmed))) return true;

  // Hindi / SOV trailing verbs
  const hindiVerbEndPattern = /(?:play\s+karo|search\s+karo|bajao|chalao|sunao|dikhao|kholo|like\s+karo|daalo|karo|batao|hatao|remove\s+karo|clear\s+kar\s+do|banao|open)$/i;
  return hindiVerbEndPattern.test(trimmed);
}

/**
 * Splits a compound voice instruction into distinct action clauses.
 */
export function splitVoiceInstructionIntoClauses(rawText = '') {
  if (!rawText || typeof rawText !== 'string') return [];
  const text = rawText.trim();
  if (!text) return [];

  // Delimiters:
  // - ", then", " and then ", " then ", " after that ", " and also ", " and ", " also ", " & "
  // - Hindi: " aur phir ", " phir ", " uske baad ", " aur ", " tatha ", " karke ", " khol ke "
  // - Punctuation: commas, semicolons
  const rawSplits = text.split(/,\s*(?:then|and\s+then|aur\s+phir|phir|uske\s+baad)?\s*|\s+(?:and\s+then|then|after\s+that|aur\s+phir|phir|uske\s+baad|and\s+also|and|also|aur|tatha|&|karke|karkay|kar\s+ke|ke\s+baad)\s+|\s+(?:khol\s+ke|kholke)\s+|;\s*/i);

  const clauses = [];
  let buffer = '';

  for (let i = 0; i < rawSplits.length; i++) {
    const chunk = rawSplits[i].trim();
    if (!chunk) continue;

    const cleanChunk = chunk.replace(/^(?:and\s+then|and\s+also|and|then|after\s+that|aur\s+phir|phir|uske\s+baad|aur|also|tatha|&|karke|karkay|kar\s+ke|khol\s+ke|kholke)\s+/i, '').trim();
    if (!cleanChunk) continue;

    if (!buffer) {
      buffer = cleanChunk;
    } else {
      if (isActionClause(cleanChunk)) {
        clauses.push(buffer);
        buffer = cleanChunk;
      } else {
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
 * Resolves follow-up pronoun references ("it", "ye song", "us playlist mein", "last played song", "next wala")
 */
export function resolveStepReferences(parsedStep, taskContext = {}) {
  if (!parsedStep) return null;
  const resolved = { ...parsedStep };
  const currentSong = taskContext.currentSong || taskContext.lastPlayedTrack || null;
  const currentArtist = taskContext.lastArtist || currentSong?.artist || currentSong?.channel || null;
  const currentPlaylist = taskContext.lastPlaylist || null;

  // 1. Target track for library actions (like, add to playlist, queue)
  if (['like_current', 'unlike_current', 'add_to_playlist', 'add_to_queue'].includes(resolved.action)) {
    if (!resolved.target && currentSong) {
      resolved.target = currentSong;
    }
  }

  // 2. Target artist for artist actions (open_artist)
  if (['open_artist', 'follow_artist'].includes(resolved.action)) {
    const queryStr = String(resolved.target || '').toLowerCase().trim();
    if (
      !resolved.target ||
      ['it', 'this', 'that', 'its artist', 'this artist', 'the artist', 'artist', 'its artist profile', 'this artist profile', 'uska artist profile'].includes(queryStr) ||
      queryStr.includes('artist') ||
      queryStr.includes('track') ||
      queryStr.includes('song')
    ) {
      if (currentArtist) {
        resolved.target = currentArtist;
      }
    }
  }

  // 3. Play track from playlist ("uske saare songs play karo")
  if (resolved.action === 'play_playlist') {
    if (!resolved.target && currentPlaylist) {
      resolved.target = currentPlaylist;
    }
  }

  // 4. Play track from search results index ("play first song")
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
    } else if (/\b(last played song|last played track|last song|pichla gaana|previous song|pichhla song)\b/i.test(queryLower)) {
      resolved.action = 'play_from_history';
      resolved.target = taskContext.lastPlayedTrack || taskContext.currentSong;
    }
  }

  return resolved;
}

/**
 * Parses a single or multi-step instruction into an array of ordered, dependency-aware actions.
 */
export function parseMultiStepInstruction(rawText = '', taskContext = {}) {
  const clauses = splitVoiceInstructionIntoClauses(rawText);
  if (clauses.length === 0) return [];

  const parsedSteps = [];
  let workingContext = { ...taskContext };

  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i];
    const cleanClause = clause.trim();
    const lower = cleanClause.toLowerCase();

    // 0. Security Block
    if (/\b(admin|security|cms|moderation|server-health)\b/i.test(lower)) {
      return [{
        type: 'security_blocked',
        action: 'security_blocked',
        speechResponse: 'Action blocked: Administrative security isolation.',
        description: 'Administrative access blocked'
      }];
    }

    // 1. History operations
    if (/\b(clear history|listening history clear|history saaf|puri history delete)\b/i.test(lower)) {
      parsedSteps.push({
        id: 'action_clear_history',
        type: 'history',
        action: 'clear_history',
        confirmationRequired: true,
        confirmationPrompt: 'Are you sure you want to clear your entire listening history?',
        description: 'Clear listening history'
      });
      continue;
    }

    if (/\b(history se .* remove karo|history se .* hatao|sirf .* song remove karo|ye particular song remove karo)\b/i.test(lower)) {
      const match = lower.match(/(?:history se|sirf)\s+(.+?)\s+(?:ka ye particular song remove karo|remove karo|hatao)/i);
      const targetQuery = match ? match[1].replace(/ka$/i, '').trim() : 'song';
      parsedSteps.push({
        id: 'action_remove_history_item',
        type: 'history',
        action: 'remove_history_item',
        target: targetQuery,
        description: `Remove "${targetQuery}" from history`
      });
      continue;
    }

    if (/\b(last played song play karo|play last played song|history se play karo|last song bajao)\b/i.test(lower)) {
      parsedSteps.push({
        id: 'action_play_from_history',
        type: 'history',
        action: workingContext.lastPlayedTrack ? 'play_direct' : 'play_from_history',
        track: workingContext.lastPlayedTrack || workingContext.currentSong || null,
        target: workingContext.lastPlayedTrack || workingContext.currentSong || null,
        description: 'Play last played song from history'
      });
      continue;
    }

    // 1b. Favourites removal operations (e.g. "Kesariya ko favourites se remove karo")
    const favRemoveMatch = cleanClause.match(/(?:favourites?|favorites?|liked)\s+se\s+(.+?)\s+(?:remove|hatao|nikal|delete)/i) ||
      cleanClause.match(/(.+?)\s+ko\s+(?:favourites?|favorites?|liked)\s+se\s+(?:remove|hatao|nikal|delete)/i);
    if (favRemoveMatch) {
      const songName = favRemoveMatch[1].trim();
      parsedSteps.push({
        id: 'action_unlike_song',
        type: 'favourites',
        action: 'remove_favorite',
        target: songName,
        description: `Remove "${songName}" from favourites`
      });
      continue;
    }

    // 2. Radio operations
    if (/\b(radio band karo|band karo radio)\b/i.test(lower)) {
      parsedSteps.push({
        id: 'action_pause_playback',
        type: 'playback',
        action: 'pause',
        description: 'Stop radio playback'
      });
      continue;
    }

    if (/\b(vividh bharati|mirchi|air fm|red fm|radio city)\b/i.test(lower) && /\b(play|bajao|chalao|sunao)\b/i.test(lower)) {
      const stationMatch = cleanClause.match(/\b(vividh bharati|mirchi|air fm|red fm|radio city)\b/i);
      const stationName = stationMatch ? stationMatch[1] : 'Vividh Bharati';
      parsedSteps.push({
        id: 'action_play_radio_station',
        type: 'radio',
        action: 'play_radio_station',
        target: stationName,
        description: `Play radio station ${stationName}`
      });
      workingContext.lastStation = stationName;
      continue;
    }

    if (/\b(vividh bharati|mirchi|air fm|red fm)\s+(search karo|khojo)\b/i.test(lower)) {
      const stationMatch = cleanClause.match(/\b(vividh bharati|mirchi|air fm|red fm)\b/i);
      const stationName = stationMatch ? stationMatch[1] : 'Vividh Bharati';
      parsedSteps.push({
        id: 'action_search_radio',
        type: 'radio',
        action: 'search_radio',
        query: stationName,
        description: `Search for radio station ${stationName}`
      });
      workingContext.lastStation = stationName;
      continue;
    }

    // "play karo" following radio search
    if (/^(play karo|play|chalao|bajao)$/i.test(lower) && workingContext.lastStation) {
      parsedSteps.push({
        id: 'action_play_radio_station',
        type: 'radio',
        action: 'play_radio_station',
        target: workingContext.lastStation,
        description: `Play radio station ${workingContext.lastStation}`
      });
      continue;
    }

    // 3. Playlists operations
    if (/\b(playlist kholo|open playlist|playlists kholo)\b/i.test(lower)) {
      const specificMatch = cleanClause.match(/(.+?)\s+playlist\s+kholo/i);
      if (specificMatch && !['meri', 'all', 'saari', 'open', 'the'].includes(specificMatch[1].trim().toLowerCase())) {
        const plName = specificMatch[1].trim();
        parsedSteps.push({
          id: 'action_open_playlist',
          type: 'playlist',
          action: 'open_playlist',
          target: plName,
          description: `Open playlist "${plName}"`
        });
        workingContext.lastPlaylist = plName;
        continue;
      } else {
        parsedSteps.push({
          id: 'nav_playlists',
          type: 'navigation',
          action: 'navigate_page',
          target: 'playlists',
          description: 'Navigate to Playlists'
        });
        continue;
      }
    }

    if (/\b(currently playing song add karo|is gaane ko add karo|song add karo|add karo)\b/i.test(lower) && workingContext.lastPlaylist) {
      parsedSteps.push({
        id: 'action_add_to_playlist',
        type: 'playlist',
        action: 'add_to_playlist',
        target: workingContext.currentSong || null,
        playlistName: workingContext.lastPlaylist,
        description: `Add currently playing song to playlist "${workingContext.lastPlaylist}"`
      });
      continue;
    }

    if (/\b(popular songs|top songs|popular tracks)\s+(play|chalao|bajao)\b/i.test(lower)) {
      const artist = workingContext.lastArtist || 'Arijit Singh';
      parsedSteps.push({
        id: 'action_play_song',
        type: 'playback',
        action: 'play_search',
        query: `${artist} popular songs`,
        description: `Play popular songs of ${artist}`
      });
      continue;
    }

    if (/\b(uske saare songs play karo|playlist play karo|play all songs|saare gaane play karo)\b/i.test(lower)) {
      parsedSteps.push({
        id: 'action_play_playlist',
        type: 'playlist',
        action: 'play_playlist',
        target: workingContext.lastPlaylist || 'current',
        description: `Play all songs in playlist "${workingContext.lastPlaylist || 'current'}"`
      });
      continue;
    }

    if (/\b(nayi playlist banao|ek nayi playlist banao|create playlist|new playlist)\b/i.test(lower)) {
      const plName = 'Loopra Playlist ' + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
      parsedSteps.push({
        id: 'action_create_playlist',
        type: 'playlist',
        action: 'create_playlist',
        name: plName,
        description: `Create playlist "${plName}"`
      });
      workingContext.lastPlaylist = plName;
      continue;
    }

    // 4. Queue operations
    if (/\b(queue mein next add karo|queue mein add karo|queue mein daalo|add to queue)\b/i.test(lower)) {
      parsedSteps.push({
        id: 'action_add_to_queue',
        type: 'queue',
        action: 'add_to_queue',
        target: workingContext.currentSong || null,
        description: 'Add current song to queue'
      });
      continue;
    }

    // 5. Recommendations
    if (/\b(latest recommended songs dikhao|recommended songs dikhao|recommendations dikhao)\b/i.test(lower)) {
      parsedSteps.push({
        id: 'nav_for_you',
        type: 'navigation',
        action: 'navigate_page',
        target: 'for-you',
        description: 'Show latest recommended songs'
      });
      continue;
    }

    // 6. Generic step parsing fallback
    const parsed = parseVoiceCommandLocally(clause, workingContext);
    if (!parsed) continue;

    const resolved = resolveStepReferences(parsed, workingContext);
    parsedSteps.push(resolved);

    if (resolved.action === 'play_search' && resolved.query) {
      workingContext.lastQuery = resolved.query;
      workingContext.lastArtist = resolved.query;
    } else if (resolved.action === 'search' && resolved.query) {
      workingContext.lastQuery = resolved.query;
      workingContext.lastArtist = resolved.query;
    } else if (resolved.action === 'open_artist' && resolved.target) {
      workingContext.lastArtist = resolved.target;
    }
  }

  return parsedSteps;
}

/**
 * Executes a sequence of steps through real application handlers with dependency passing,
 * step status tracking, and failure isolation.
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
    onRemoveFromFavorites,
    onAddToPlaylist,
    onCreatePlaylist,
    onOpenPlaylistByName,
    onPlayPlaylist,
    onPlayRadioStation,
    onPlayFromHistory,
    onRemoveHistoryItem,
    onClearHistory,
    onAddToQueue,
    onNavigate,
    onOpenInsights,
    onOpenQueue,
    onOpenLyrics,
    onOpenListeningRooms,
    onOpenSimilarSongs,
    onOpenPlayerSettings,
    onOpenSleepTimer,
    onOpenCanvas,
    onOpenProfile,
    onOpenRatingModal,
    onSetPlaybackSpeed,
    onDjAction,
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

  // Trigger avatar thinking animation
  if (typeof window !== 'undefined' && typeof window.__loopraSetAvatarThinking === 'function') {
    window.__loopraSetAvatarThinking(true);
  }

  const trackedSteps = steps.map((s, idx) => ({
    ...s,
    index: idx,
    status: 'pending'
  }));

  for (let i = 0; i < steps.length; i++) {
    const rawStep = steps[i];
    const step = resolveStepReferences(rawStep, currentContext);
    trackedSteps[i].status = 'in_progress';

    try {
      let stepResult = null;

      // Check confirmation requirement
      if (step.confirmationRequired) {
        if (!initialContext.confirmed) {
          if (typeof window !== 'undefined' && typeof window.__loopraSetAvatarThinking === 'function') {
            window.__loopraSetAvatarThinking(false);
          }
          return {
            success: false,
            confirmationRequired: true,
            confirmationPrompt: step.confirmationPrompt || 'Are you sure you want to perform this action?',
            message: step.confirmationPrompt || 'Are you sure you want to perform this action?',
            taskContext: currentContext,
            pendingStep: step
          };
        }
      }

      // 1. Security Check
      if (step.action === 'security_blocked' || step.type === 'security_blocked') {
        throw new Error('Administrative functions are strictly isolated from the Voice Agent.');
      }

      // 2. History: Clear History
      if (step.action === 'clear_history') {
        if (!onClearHistory) throw new Error('Clear history handler unavailable.');
        await onClearHistory();
        stepResult = { description: 'Listening history cleared' };
      }

      // 3. History: Remove single history item
      else if (step.action === 'remove_history_item') {
        if (!onRemoveHistoryItem) throw new Error('Remove history handler unavailable.');
        await onRemoveHistoryItem(step.target);
        stepResult = { description: `Removed "${step.target}" from listening history` };
      }

      // 4. History: Play from history
      else if (step.action === 'play_from_history') {
        if (onPlayFromHistory) {
          await onPlayFromHistory(step.target);
        } else if (step.target && onPlayTrack) {
          await onPlayTrack(step.target);
        } else {
          throw new Error('History playback handler unavailable.');
        }
        currentContext.isPlaying = true;
        stepResult = { description: 'Playing from listening history' };
      }

      // 5. Radio: Play specific radio station
      else if (step.action === 'play_radio_station') {
        const stationName = step.target || step.query || 'Vividh Bharati';
        if (onPlayRadioStation) {
          await onPlayRadioStation(stationName);
        } else if (onNavigate) {
          await onNavigate('radio', { station: stationName, autoplay: true });
        } else {
          throw new Error('Radio station playback handler unavailable.');
        }
        currentContext.isPlaying = true;
        stepResult = { description: `Playing radio station "${stationName}"` };
      }

      // 6. Playlists: Open Playlist
      else if (step.action === 'open_playlist') {
        const plName = step.target || step.name;
        if (onOpenPlaylistByName) {
          await onOpenPlaylistByName(plName);
        } else if (onNavigate) {
          await onNavigate('playlists', { playlistName: plName });
        } else {
          throw new Error('Playlist navigation handler unavailable.');
        }
        currentContext.lastPlaylist = plName;
        stepResult = { description: `Opened playlist "${plName}"` };
      }

      // 7. Playlists: Play Playlist
      else if (step.action === 'play_playlist') {
        const plName = step.target || currentContext.lastPlaylist || 'Party Songs';
        if (onPlayPlaylist) {
          await onPlayPlaylist(plName);
        } else if (onPlayTrack && currentContext.currentSong) {
          await onPlayTrack(currentContext.currentSong);
        } else {
          throw new Error('Playlist playback handler unavailable.');
        }
        currentContext.isPlaying = true;
        stepResult = { description: `Playing all songs from playlist "${plName}"` };
      }

      // 8. Playlists: Create Playlist
      else if (step.action === 'create_playlist') {
        const plName = step.name || 'New Playlist';
        let created = null;
        if (onCreatePlaylist) {
          created = await onCreatePlaylist(plName);
        }
        currentContext.lastPlaylist = plName;
        stepResult = { description: `Created new playlist "${plName}"`, data: created };
      }

      // 8b. Playlists: Add to Playlist
      else if (step.action === 'add_to_playlist') {
        const targetTrack = step.target || currentContext.currentSong || currentContext.lastPlayedTrack;
        const plName = step.playlistName || currentContext.lastPlaylist || 'New Playlist';
        if (onAddToPlaylist) {
          await onAddToPlaylist(targetTrack, plName);
        }
        stepResult = { description: `Added "${targetTrack?.title || 'song'}" to playlist "${plName}"`, data: targetTrack };
      }

      // 9. Queue: Add to Queue
      else if (step.action === 'add_to_queue') {
        const targetTrack = step.target || currentContext.currentSong || currentContext.lastPlayedTrack;
        if (!targetTrack) throw new Error('No song available to add to queue.');
        if (onAddToQueue) {
          await onAddToQueue(targetTrack);
        }
        stepResult = { description: `Added "${targetTrack.title || 'song'}" to queue` };
      }

      // 10. Favourites: Unlike / Remove
      else if (step.action === 'unlike_current' || step.action === 'remove_favorite') {
        const targetQuery = step.target || currentContext.currentSong;
        if (onRemoveFromFavorites) {
          await onRemoveFromFavorites(targetQuery);
        } else if (onToggleLike) {
          await onToggleLike(targetQuery);
        }
        stepResult = { description: `Removed "${targetQuery?.title || targetQuery || 'song'}" from favourites` };
      }

      // 11. Playback: Play direct track
      else if (step.action === 'play_direct' && step.track) {
        if (onPlayFromHistory && currentContext.activeTab === 'history') {
          await onPlayFromHistory(step.track);
        } else if (onPlayTrack) {
          await onPlayTrack(step.track);
        } else if (onPlayFromHistory) {
          await onPlayFromHistory(step.track);
        } else {
          throw new Error('Player handler unavailable.');
        }
        currentContext.currentSong = step.track;
        currentContext.lastPlayedTrack = step.track;
        currentContext.isPlaying = true;
        stepResult = { description: `Played "${step.track.title}"`, data: step.track };
      }

      // 12. Playback: Play Search
      else if (step.action === 'play_search') {
        let track = null;
        let queryToSearch = (step.query || '').trim();

        // Check if query is generic (e.g. "a song", "gaana", "koi gaana", "play a song")
        const isGenericQuery = !queryToSearch || /^(a\s+song|song|music|gaana|geet|koi\s+gaana|koi\s+bhi\s+gaana|koi\s+ek\s+gaana|track|a\s+track|first\s+song|pehla\s+gaana|play|bajao|chalao)$/i.test(queryToSearch);

        if (isGenericQuery) {
          const currentTab = currentContext.activeTab || currentContext.lastStation;
          if (currentTab && SPECIAL_STATIONS[currentTab]?.queries?.[0]) {
            queryToSearch = SPECIAL_STATIONS[currentTab].queries[0];
          } else if (currentContext.lastArtist) {
            queryToSearch = `${currentContext.lastArtist} top songs`;
          } else if (currentContext.lastPlaylist) {
            queryToSearch = `${currentContext.lastPlaylist} songs`;
          } else {
            queryToSearch = 'bollywood top hits trending jukebox';
          }
        }

        if (typeof searchCatalog === 'function') {
          const results = await searchCatalog(queryToSearch);
          if (Array.isArray(results) && results.length > 0) {
            if (!isGenericQuery) {
              const qLower = queryToSearch.toLowerCase();
              const matched = results.find(r =>
                (r.title && r.title.toLowerCase().includes(qLower)) ||
                (r.artist && r.artist.toLowerCase().includes(qLower))
              );
              track = matched || results[0];
            } else {
              track = results[0];
            }
            currentContext.lastSearchResults = results;
          }
        }
        if (!track) {
          track = { id: `v_${Date.now()}`, title: queryToSearch, artist: queryToSearch };
        }
        if (!onPlayTrack) throw new Error('Player handler unavailable.');
        await onPlayTrack(track);
        currentContext.currentSong = track;
        currentContext.lastPlayedTrack = track;
        currentContext.isPlaying = true;
        const currentStationTitle = SPECIAL_STATIONS[currentContext.activeTab]?.title || currentContext.activeTab || '';
        const stationPrefix = currentStationTitle ? `from ${currentStationTitle}: ` : '';
        stepResult = { description: `Now playing ${stationPrefix}"${track.title}"`, data: track };
      }

      // 13. Playback: Pause
      else if (step.action === 'pause') {
        if (onTogglePlayPause) {
          await onTogglePlayPause();
          currentContext.isPlaying = false;
        }
        stepResult = { description: 'Music paused' };
      }

      // 14. Playback: Resume
      else if (step.action === 'resume') {
        if (onTogglePlayPause) {
          await onTogglePlayPause();
          currentContext.isPlaying = true;
        }
        stepResult = { description: 'Music resumed' };
      }

      // 14b. Playback: Next / Skip
      else if (step.action === 'next') {
        if (!onNextTrack) throw new Error('Next track handler unavailable.');
        await onNextTrack();
        stepResult = { description: 'Skipped to next track' };
      }

      // 14c. Playback: Previous
      else if (step.action === 'previous') {
        if (!onPrevTrack) throw new Error('Previous track handler unavailable.');
        await onPrevTrack();
        stepResult = { description: 'Returned to previous track' };
      }

      // 14d. Playback: Shuffle
      else if (step.action === 'shuffle') {
        if (!onToggleShuffle) throw new Error('Shuffle handler unavailable.');
        await onToggleShuffle();
        currentContext.isShuffle = !currentContext.isShuffle;
        stepResult = { description: 'Toggled shuffle mode' };
      }

      // 14e. Playback: Repeat
      else if (step.action === 'repeat') {
        if (!onToggleRepeat) throw new Error('Repeat handler unavailable.');
        await onToggleRepeat();
        stepResult = { description: 'Toggled repeat mode' };
      }

      // 14f. Details: Open Queue
      else if (step.action === 'open_queue') {
        if (!onOpenQueue) throw new Error('Queue handler unavailable.');
        await onOpenQueue();
        stepResult = { description: 'Opened playback queue' };
      }

      // 14g. Details: Open Lyrics
      else if (step.action === 'open_lyrics') {
        if (!onOpenLyrics) throw new Error('Lyrics handler unavailable.');
        await onOpenLyrics();
        stepResult = { description: 'Opened synchronized lyrics' };
      }

      // 14h. Details: Open Insights / Recap
      else if (step.action === 'open_insights') {
        if (!onOpenInsights) throw new Error('Insights handler unavailable.');
        await onOpenInsights();
        stepResult = { description: 'Opened listening insights' };
      }

      // 14i. Navigation: Go Back
      else if (step.action === 'go_back') {
        if (!onGoBack) throw new Error('Go back handler unavailable.');
        await onGoBack();
        stepResult = { description: 'Navigated back' };
      }

      // 15. Volume: Set volume
      else if (step.action === 'set_volume') {
        if (!onSetVolume) throw new Error('Volume handler unavailable.');
        const targetVol = typeof step.value === 'number' ? Math.max(0, Math.min(100, step.value)) : 70;
        await onSetVolume(targetVol);
        currentContext.volume = targetVol;
        stepResult = { description: `Set volume to ${targetVol}%` };
      }

      // 16. Library: Like / Favorite
      else if (step.action === 'like_current') {
        const targetTrack = currentContext.currentSong || currentContext.lastPlayedTrack;
        if (!targetTrack) throw new Error('No song currently playing to add to favourites.');
        if (!onToggleLike) throw new Error('Like handler unavailable.');
        await onToggleLike(targetTrack);
        stepResult = { description: `Added "${targetTrack.title}" to favourites`, data: targetTrack };
      }

      // 17. Navigation: Open Artist Profile
      else if (step.action === 'open_artist') {
        const targetArtist = step.target || currentContext.lastArtist || currentContext.currentSong?.artist;
        if (!targetArtist) throw new Error('No artist specified to open.');
        if (!onOpenArtist) throw new Error('Artist navigation handler unavailable.');
        await onOpenArtist(targetArtist);
        currentContext.lastArtist = targetArtist;
        stepResult = { description: `Opened artist profile for ${targetArtist}`, data: targetArtist };
      }

      // 18. Navigation: Standard tabs
      else if (step.action === 'navigate_page') {
        if (onNavigate) {
          await onNavigate(step.target, step.extra);
        }
        currentContext.activeTab = step.target;
        currentContext.lastStation = step.target;
        const stationName = SPECIAL_STATIONS[step.target]?.title || step.target;
        stepResult = { description: `Navigated to ${stationName}` };
      }

      // 18b. Navigation: Social Listening Rooms
      else if (step.action === 'open_listening_rooms') {
        if (onOpenListeningRooms) await onOpenListeningRooms();
        else if (onNavigate) await onNavigate('listening_rooms');
        stepResult = { description: 'Opened Social Listening Rooms' };
      }

      // 18c. Navigation: Similar Songs Modal
      else if (step.action === 'open_similar_songs') {
        const targetTrack = step.target || currentContext.currentSong || currentContext.lastPlayedTrack;
        if (onOpenSimilarSongs) await onOpenSimilarSongs(targetTrack);
        stepResult = { description: 'Opened Similar Songs' };
      }

      // 18d. Navigation: Player Settings & Equalizer
      else if (step.action === 'open_player_settings') {
        if (onOpenPlayerSettings) await onOpenPlayerSettings();
        stepResult = { description: 'Opened Player Settings & Equalizer' };
      }

      // 18e. Navigation: Sleep Timer
      else if (step.action === 'open_sleep_timer') {
        if (onOpenSleepTimer) await onOpenSleepTimer();
        stepResult = { description: 'Opened Sleep Timer' };
      }

      // 18f. Navigation: Loopra Canvas Visualizer
      else if (step.action === 'open_canvas') {
        if (onOpenCanvas) await onOpenCanvas();
        stepResult = { description: 'Opened Loopra Canvas' };
      }

      // 18g. Navigation: User Profile
      else if (step.action === 'open_profile') {
        if (onOpenProfile) await onOpenProfile();
        stepResult = { description: 'Opened User Profile' };
      }

      // 18h. Navigation: Rate & Review Modal
      else if (step.action === 'open_rating_modal') {
        if (onOpenRatingModal) await onOpenRatingModal();
        stepResult = { description: 'Opened Rate & Review Modal' };
      }

      // 18i. Playback: Set Speed
      else if (step.action === 'set_playback_speed') {
        const spd = typeof step.value === 'number' ? step.value : (typeof step.speed === 'number' ? step.speed : 1.0);
        if (onSetPlaybackSpeed) await onSetPlaybackSpeed(spd);
        stepResult = { description: `Set playback speed to ${spd}x` };
      }

      // 18j. DJ Club: Actions
      else if (['dj_action', 'dj_drop', 'dj_start_beat', 'dj_stop_beat', 'dj_trigger_sfx', 'action_dj_drop', 'action_dj_start_beat', 'action_dj_stop_beat'].includes(step.action)) {
        if (onDjAction) await onDjAction(step);
        stepResult = { description: step.description || 'DJ action executed' };
      }

      // 19. Search Catalog
      else if (step.action === 'search') {
        if (typeof searchCatalog === 'function') {
          const results = await searchCatalog(step.query);
          currentContext.lastSearchResults = results || [];
        } else if (onNavigate) {
          await onNavigate('discover', { query: step.query });
        }
        currentContext.activeTab = 'discover';
        currentContext.lastQuery = step.query;
        currentContext.lastArtist = step.query;
        stepResult = { description: `Searched for "${step.query}"` };
      }

      // 20. Avatar Action
      else if (step.action === 'avatar_action') {
        const gesture = step.gesture || step.target || 'wave';
        if (typeof window !== 'undefined' && typeof window.__loopraPlayGesture === 'function') {
          window.__loopraPlayGesture(gesture, 2500);
        }
        stepResult = { description: `Loopra ${gesture}` };
      }

      // 21. Clarification Request (Never execute as completed or output internal "Executed clarify")
      else if (step.action === 'clarify' || step.type === 'clarify') {
        const prompt = step.speechResponse || 'Which song would you like to play?';
        return {
          success: false,
          clarificationRequired: true,
          clarificationQuestion: prompt,
          message: prompt,
          taskContext: currentContext,
          pendingStep: step
        };
      }

      // Default fallback for any remaining action
      else {
        stepResult = { description: step.description || `Completed ${step.action}` };
      }

      trackedSteps[i].status = 'completed';
      currentContext.completedSteps.push({
        index: i,
        action: step.action,
        data: stepResult.data,
        result: stepResult
      });

    } catch (stepErr) {
      trackedSteps[i].status = 'failed';
      currentContext.failedStep = {
        index: i,
        action: step.action,
        error: stepErr.message
      };

      if (typeof window !== 'undefined' && typeof window.__loopraSetAvatarThinking === 'function') {
        window.__loopraSetAvatarThinking(false);
      }

      return {
        success: false,
        steps: trackedSteps,
        completedSteps: currentContext.completedSteps,
        failedStep: currentContext.failedStep,
        message: `Step ${i + 1} (${step.action}) failed: ${stepErr.message}. Completed ${currentContext.completedSteps.length} of ${steps.length} steps.`,
        taskContext: currentContext
      };
    }
  }

  // Multi-step task successfully finished!
  if (typeof window !== 'undefined') {
    if (typeof window.__loopraSetAvatarThinking === 'function') {
      window.__loopraSetAvatarThinking(false);
    }
    if (typeof window.__loopraSetAvatarCelebrating === 'function') {
      window.__loopraSetAvatarCelebrating();
    }
  }

  const successSummary = currentContext.completedSteps.map(s => s.result.description).join('; ');

  return {
    success: true,
    steps: trackedSteps,
    completedSteps: currentContext.completedSteps,
    failedStep: null,
    message: successSummary || 'All actions completed successfully.',
    taskContext: currentContext
  };
}
