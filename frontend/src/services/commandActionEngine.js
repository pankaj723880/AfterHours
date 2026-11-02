/**
 * Loopra Centralized Command-to-Action Engine
 * 
 * Pipeline:
 * User Input
 * → Language Normalization
 * → Intent Detection
 * → Website Registry Matching
 * → Action Validation & Playback Safety Check
 * → Structured Execution Plan
 */

import { websiteInteractionRegistry } from './websiteInteractionRegistry.js';

export const INTENT_CATEGORIES = {
  OPEN_PAGE: 'OPEN_PAGE',
  OPEN_SECTION: 'OPEN_SECTION',
  OPEN_CARD: 'OPEN_CARD',
  SEARCH_SONG: 'SEARCH_SONG',
  SEARCH_ARTIST: 'SEARCH_ARTIST',
  SEARCH_ALBUM: 'SEARCH_ALBUM',
  PLAY_SONG: 'PLAY_SONG',
  PLAY_SEARCH_RESULT: 'PLAY_SEARCH_RESULT',
  PAUSE_PLAYBACK: 'PAUSE_PLAYBACK',
  RESUME_PLAYBACK: 'RESUME_PLAYBACK',
  NEXT_TRACK: 'NEXT_TRACK',
  PREVIOUS_TRACK: 'PREVIOUS_TRACK',
  ADD_TO_FAVOURITES: 'ADD_TO_FAVOURITES',
  OPEN_PLAYLIST: 'OPEN_PLAYLIST',
  OPEN_RADIO: 'OPEN_RADIO',
  CHANGE_VOLUME: 'CHANGE_VOLUME',
  SCROLL_TO_ELEMENT: 'SCROLL_TO_ELEMENT',
  CLOSE_MODAL: 'CLOSE_MODAL',
  GENERAL_QUESTION: 'GENERAL_QUESTION'
};

export function parseCommandToAction(rawInput = '', context = {}) {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const text = rawInput.trim();
  const lower = text.toLowerCase()
    .replace(/[?!,.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading wake phrases if spoken
  const cleanLower = lower.replace(/^(hey loopra|ok loopra|loopra|hello loopra)\s+/i, '');

  // 1. First Song / First Result Playback Command
  if (
    /\b(pehla gaana chalao|pehla song play karo|play first song|first song chalao|play first result|start first song|pehla track)\b/i.test(cleanLower)
  ) {
    return {
      intent: INTENT_CATEGORIES.PLAY_SEARCH_RESULT,
      action: 'play_index',
      index: 0,
      description: 'Play first song in list'
    };
  }

  // 2. Playback: Pause / Stop
  if (/\b(pause|gaana roko|rok do|ruk jao|stop music|pause music)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.PAUSE_PLAYBACK,
      action: 'pause',
      description: 'Pause music'
    };
  }

  // 3. Playback: Resume / Continue
  if (/\b(resume|continue|unpause|gaana wapas chalu karo|wapas play karo)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.RESUME_PLAYBACK,
      action: 'resume',
      description: 'Resume music'
    };
  }

  // 4. Playback: Next
  if (/\b(next song|next track|agla gaana|skip song|aage badhao|next)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.NEXT_TRACK,
      action: 'next',
      description: 'Next track'
    };
  }

  // 5. Playback: Previous
  if (/\b(previous song|prev song|pichla gaana|piche karo|previous track|prev)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.PREVIOUS_TRACK,
      action: 'previous',
      description: 'Previous track'
    };
  }

  // 6. Playback: Volume
  const volMatch = cleanLower.match(/(?:volume|awaaz)\s+(\d{1,3})/i);
  if (volMatch && volMatch[1]) {
    const val = Math.min(100, Math.max(0, parseInt(volMatch[1], 10)));
    return {
      intent: INTENT_CATEGORIES.CHANGE_VOLUME,
      action: 'set_volume',
      value: val,
      description: `Set volume to ${val}%`
    };
  }
  if (/\b(volume kam karo|awaaz kam karo|thoda dheere karo|lower volume|volume down)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.CHANGE_VOLUME,
      action: 'volume_down',
      description: 'Decrease volume'
    };
  }
  if (/\b(volume badhao|awaaz badhao|thoda tej karo|increase volume|volume up)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.CHANGE_VOLUME,
      action: 'volume_up',
      description: 'Increase volume'
    };
  }

  // 7. Library: Add to favourites / Like
  if (/\b(like this song|add to favorites|add to liked|dil de do|pasand aaya|like karo|like it)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.ADD_TO_FAVOURITES,
      action: 'toggle_like',
      description: 'Like current song'
    };
  }

  // 8. Strict Priority Check via Interaction Registry (Pages, Stations, Sub-views)
  // Ensures "Saloon FM kholo" maps strictly to Saloon FM ('barber') and NEVER Time Machine
  const registryItem = websiteInteractionRegistry.findBestMatch(cleanLower);
  if (registryItem) {
    if (registryItem.type === 'station' || registryItem.type === 'page') {
      return {
        intent: INTENT_CATEGORIES.OPEN_PAGE,
        action: 'navigate_page',
        target: registryItem.id,
        item: registryItem,
        description: `Open ${registryItem.name}`
      };
    }
    if (registryItem.type === 'section') {
      return {
        intent: INTENT_CATEGORIES.OPEN_SECTION,
        action: 'navigate_section',
        target: registryItem.id,
        item: registryItem,
        description: `Open ${registryItem.name}`
      };
    }
  }

  // 9. Song Search vs Playback Gate:
  // ONLY if explicit playback verb is present ("play", "chalao", "bajao", "sunao") do we trigger PLAY_SONG.
  const hasPlayVerb = /\b(play|chalao|bajao|sunao|shuru karo)\b/i.test(cleanLower);

  // Search pattern: "5 songs of Arijit Singh", "Arijit Singh ke five songs search karo", "Arijit Singh ke gaane"
  const countPattern = '(?:\\d+|five|four|three|two|one|paanch|char|teen|do|ek|top|best|popular|hit)';
  const searchPattern = cleanLower.match(new RegExp(`(?:(?:search|dhoondh|find|show|dikhao)\\s+)?(?:(?:${countPattern}\\s+)?(?:songs?|gaane)\\s+(?:by|of|from)\\s+([a-zA-Z\\s]+))`, 'i')) ||
                        cleanLower.match(new RegExp(`(?:(?:search|dhoondh|find|show|dikhao)\\s+)?([a-zA-Z\\s]+)\\s+ke\\s+(?:${countPattern}\\s+)?(?:songs?|gaane)(?:\\s+(?:search\\s+karo|dhoondho|dikhao|batao|sunao))?`, 'i'));

  if (searchPattern) {
    const rawArtist = (searchPattern[2] || searchPattern[1] || '').trim();
    const artist = rawArtist.replace(/\b(search|karo|dhoondho|dikhao|batao)\b/gi, '').trim();
    if (!hasPlayVerb) {
      return {
        intent: INTENT_CATEGORIES.SEARCH_SONG,
        action: 'search',
        query: artist || 'top songs',
        description: `Search songs of ${artist}`
      };
    } else {
      return {
        intent: INTENT_CATEGORIES.PLAY_SONG,
        action: 'play_search',
        query: artist || 'popular song',
        description: `Play songs of ${artist}`
      };
    }
  }

  // Single Song Playback: e.g. "Play Kesariya"
  if (hasPlayVerb) {
    const playTarget = cleanLower
      .replace(/\b(play|chalao|bajao|sunao|shuru karo|song|gaana)\b/gi, '')
      .trim();
    if (playTarget) {
      return {
        intent: INTENT_CATEGORIES.PLAY_SONG,
        action: 'play_search',
        query: playTarget,
        description: `Play "${playTarget}"`
      };
    }
  }

  // General Search fallback: "Search Headlights"
  if (cleanLower.startsWith('search ') || cleanLower.startsWith('dhoondho ') || cleanLower.startsWith('find ')) {
    const query = cleanLower.replace(/^(search|dhoondho|find)\s+/i, '').trim();
    return {
      intent: INTENT_CATEGORIES.SEARCH_SONG,
      action: 'search',
      query,
      description: `Search for "${query}"`
    };
  }

  return {
    intent: INTENT_CATEGORIES.GENERAL_QUESTION,
    action: 'chat',
    text: rawInput,
    description: 'General inquiry'
  };
}
