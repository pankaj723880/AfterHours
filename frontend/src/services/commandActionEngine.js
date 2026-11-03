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
  REMOVE_FROM_FAVOURITES: 'REMOVE_FROM_FAVOURITES',
  AVATAR_ACTION: 'AVATAR_ACTION',
  OPEN_PLAYLIST: 'OPEN_PLAYLIST',
  OPEN_RADIO: 'OPEN_RADIO',
  CHANGE_VOLUME: 'CHANGE_VOLUME',
  SCROLL_TO_ELEMENT: 'SCROLL_TO_ELEMENT',
  CLOSE_MODAL: 'CLOSE_MODAL',
  OPEN_INSIGHTS: 'OPEN_INSIGHTS',
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

  // 0. NEGATIVE PLAY INTENT GUARD:
  // Catches phrases like: "don't play", "do not play", "mat chalao", "mat bajana", "without playing", "bina play kare"
  const hasNegativePlayModifier = (
    /\b(don'?t|do not|mat|na|bina|without|except|never)\s+(?:play|chalao|bajao|sunao|shuru)/i.test(cleanLower) ||
    /\b(?:play|chalao|bajao|sunao)\s+(?:mat|na|nahi)\b/i.test(cleanLower) ||
    /\b(?:don'?t|do not)\s+play\b/i.test(cleanLower) ||
    /don'?t\s+play\s+them/i.test(cleanLower)
  );

  // 1. Playback: Next Track (Checked before generic play matching to prevent "play the next song" -> play search)
  if (
    /\b(next song|next track|agla gaana|skip song|aage badhao|next|agla|play (?:the )?next song|next song play karo|agla gaana chalao|agla track bajao)\b/i.test(cleanLower)
  ) {
    return {
      intent: INTENT_CATEGORIES.NEXT_TRACK,
      action: 'next',
      description: 'Next track'
    };
  }

  // 2. Playback: Previous Track
  if (
    /\b(previous song|prev song|pichla gaana|piche karo|previous track|prev|pichla|play (?:the )?previous song|pichla gaana chalao|pichla song bajao)\b/i.test(cleanLower)
  ) {
    return {
      intent: INTENT_CATEGORIES.PREVIOUS_TRACK,
      action: 'previous',
      description: 'Previous track'
    };
  }

  // 3. First Song / First Result Playback Command
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

  // 4. Playback: Pause / Stop
  if (/\b(pause|gaana roko|rok do|ruk jao|stop music|pause music|chup ho jao|music roko|gana roko)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.PAUSE_PLAYBACK,
      action: 'pause',
      description: 'Pause music'
    };
  }

  // 5. Playback: Resume / Continue
  if (/\b(resume|continue|unpause|gaana wapas chalu karo|wapas play karo|chalu karo|resume music)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.RESUME_PLAYBACK,
      action: 'resume',
      description: 'Resume music'
    };
  }

  // 6. Playback: Volume & Mute Controls
  const volMatch = cleanLower.match(/(?:set\s+)?volume\s+(?:to\s+)?(\d{1,3})/i) || cleanLower.match(/awaaz\s+(\d{1,3})/i);
  if (volMatch && volMatch[1]) {
    const val = Math.min(100, Math.max(0, parseInt(volMatch[1], 10)));
    return {
      intent: INTENT_CATEGORIES.CHANGE_VOLUME,
      action: 'set_volume',
      value: val,
      description: `Set volume to ${val}%`
    };
  }
  if (/\b(volume kam karo|awaaz kam karo|thoda dheere karo|lower volume|volume down|dheere karo|awaaz dheere)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.CHANGE_VOLUME,
      action: 'volume_down',
      description: 'Decrease volume'
    };
  }
  if (/\b(volume badhao|awaaz badhao|thoda tej karo|increase volume|volume up|tej karo|volume tej|awaaz tej)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.CHANGE_VOLUME,
      action: 'volume_up',
      description: 'Increase volume'
    };
  }
  if (/\b(mute|silent|awaaz band|awaaz mute)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.CHANGE_VOLUME,
      action: 'set_volume',
      value: 0,
      description: 'Mute volume'
    };
  }
  if (/\b(unmute|awaaz kholo|awaaz on|unmute karo)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.CHANGE_VOLUME,
      action: 'set_volume',
      value: 70,
      description: 'Unmute volume'
    };
  }

  // 7. Library: Remove / Unlike / Delete from Favourites
  // Evaluated BEFORE search to prevent "Remove this song from favourites" matching "song from <artist>"
  if (
    /\b(unlike|remove (?:this song )?from (?:favorites|favourites|liked)|delete from (?:favorites|favourites|liked)|dislike|favourite se hatao|favorites se hatao|liked se hatao|liked songs se hatao|is gaane ko hatao|is gaane ko delete karo|hata do|hatao isko|nikal do|remove this song|unlike this song|unlike song)\b/i.test(cleanLower) ||
    /^(unlike|dislike|remove|hatao|hata do)$/i.test(cleanLower)
  ) {
    return {
      intent: INTENT_CATEGORIES.REMOVE_FROM_FAVOURITES,
      action: 'unlike_current',
      target: context.currentSong || context.lastPlayedTrack || null,
      description: 'Remove from Liked Songs'
    };
  }

  // 8. Library: Add to favourites / Like
  if (/\b(like this song|add to favorites|add to favourites|add to liked|dil de do|pasand aaya|like karo|like it|favourite me daalo|favorites me daalo)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.ADD_TO_FAVOURITES,
      action: 'toggle_like',
      target: context.currentSong || context.lastPlayedTrack || null,
      description: 'Like current song'
    };
  }

  // 9. Interactive Avatar Actions (Wave, Wink, Dance, Jump, Pose)
  if (/\b(wave karo|hath hilao|wave|say hi|hi bolo)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.AVATAR_ACTION,
      action: 'avatar_action',
      gesture: 'wave',
      description: 'Loopra Wave'
    };
  }
  if (/\b(wink karo|aankh maro|wink)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.AVATAR_ACTION,
      action: 'avatar_action',
      gesture: 'wink',
      description: 'Loopra Wink'
    };
  }
  if (/\b(dance karo|dance|nacho|groove karo)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.AVATAR_ACTION,
      action: 'avatar_action',
      gesture: 'dance',
      description: 'Loopra Dance'
    };
  }
  if (/\b(jump karo|jump|koodo)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.AVATAR_ACTION,
      action: 'avatar_action',
      gesture: 'jump',
      description: 'Loopra Jump'
    };
  }
  if (/\b(pose karo|pose do|style dikhao|pose)\b/i.test(cleanLower)) {
    return {
      intent: INTENT_CATEGORIES.AVATAR_ACTION,
      action: 'avatar_action',
      gesture: 'pose',
      description: 'Loopra Pose'
    };
  }

  // 9B. Strict Recap & Stats (Insights Modal) vs Listening Activity Routing
  // Explicitly requesting Recap & Stats must NEVER route to activity!
  if (
    /\b(recap and stats|recap & stats|my listening statistics|music summary|listening report|listening insights|weekly recap|my recap|stats|statistics|listening stats|insights kholo|recap dikhao|stats dikhao)\b/i.test(cleanLower) ||
    /^(insights|recap|stats)$/i.test(cleanLower)
  ) {
    return {
      intent: INTENT_CATEGORIES.OPEN_INSIGHTS,
      action: 'open_insights',
      description: 'Open Recap & Stats'
    };
  }

  // Explicit Listening Activity Routing
  if (
    /\b(listening activity|listening history|recently played|recent songs|history kholo|open listening history|activity kholo|activity page|recent activity)\b/i.test(cleanLower) ||
    /^(activity|history)$/i.test(cleanLower)
  ) {
    return {
      intent: INTENT_CATEGORIES.OPEN_PAGE,
      action: 'navigate_page',
      target: 'activity',
      description: 'Open Listening Activity'
    };
  }

  // 10. Strict Priority Check via Interaction Registry (Pages, Stations, Sub-views, Modals)
  // Ensures "Saloon FM kholo" maps strictly to Saloon FM ('barber') and NEVER Time Machine
  const registryItem = websiteInteractionRegistry.findBestMatch(cleanLower);
  if (registryItem) {
    if (registryItem.type === 'modal' || registryItem.action === 'open_insights' || registryItem.id === 'recap_stats') {
      return {
        intent: INTENT_CATEGORIES.OPEN_INSIGHTS,
        action: 'open_insights',
        target: 'recap_stats',
        item: registryItem,
        description: 'Open Recap & Stats'
      };
    }
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

  // 11. Song Search vs Playback Gate:
  // ONLY if explicit playback verb is present AND NO negative play modifier exists
  const hasPlayVerb = !hasNegativePlayModifier && /\b(play|chalao|bajao|sunao|shuru karo)\b/i.test(cleanLower);

  // Clean trailing negative play modifiers or clauses (e.g. ", don't play them", "don't play")
  const searchInput = cleanLower
    .replace(/,\s*(?:don'?t|do not|mat|bina)\s+.*$/i, '')
    .replace(/\s+(?:don'?t|do not|mat|bina)\s+(?:play|chalao|bajao|sunao).*$/i, '')
    .trim();

  // Search pattern: "5 songs of Arijit Singh", "find 5 songs by Arijit Singh", "Arijit Singh ke gaane"
  const countRegex = '(?:\\d+|five|four|three|two|one|paanch|char|teen|do|ek|top|best|popular|hit)';
  const searchPattern = searchInput.match(new RegExp(`^(?:(?:search|dhoondh|find|show|dikhao)\\s+)?(?:(?:${countRegex}\\s+)?(?:songs?|gaane)\\s+(?:by|of|from)\\s+([a-zA-Z\\s]+))$`, 'i')) ||
                        searchInput.match(new RegExp(`^(?:(?:search|dhoondh|find|show|dikhao)\\s+)?([a-zA-Z\\s]+)\\s+ke\\s+(?:${countRegex}\\s+)?(?:songs?|gaane)(?:\\s+(?:search\\s+karo|dhoondho|dikhao|batao|sunao))?$`, 'i'));

  if (searchPattern) {
    const rawArtist = (searchPattern[2] || searchPattern[1] || '').trim();
    const artist = rawArtist
      .replace(/\b(search|karo|dhoondho|dikhao|batao|don'?t|play|them|mat|chalao|bina)\b/gi, '')
      .trim();

    // If negative play modifier was detected, it is GUARANTEED to be SEARCH ONLY!
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

  // Single Song Playback: e.g. "Play Kesariya" (ONLY if hasPlayVerb is explicitly true)
  if (hasPlayVerb) {
    const playTarget = cleanLower
      .replace(/\b(play|chalao|bajao|sunao|shuru karo|song|gaana)\b/gi, '')
      .trim();
    if (playTarget && playTarget !== 'them' && playTarget !== 'music') {
      return {
        intent: INTENT_CATEGORIES.PLAY_SONG,
        action: 'play_search',
        query: playTarget,
        description: `Play "${playTarget}"`
      };
    }
  }

  // General Search fallback: "Search Headlights", "Find songs by Arijit Singh"
  if (
    cleanLower.startsWith('search ') ||
    cleanLower.startsWith('dhoondho ') ||
    cleanLower.startsWith('dhundo ') ||
    cleanLower.startsWith('find ') ||
    cleanLower.startsWith('show ') ||
    hasNegativePlayModifier
  ) {
    const query = cleanLower
      .replace(/^(search for|search|dhoondho|dhundo|find|show)\s+/i, '')
      .replace(/\b(don'?t\s+play\s+(?:them|it|songs?)?|mat\s+chalao|bina\s+play\s+kare)\b/gi, '')
      .trim();
    return {
      intent: INTENT_CATEGORIES.SEARCH_SONG,
      action: 'search',
      query: query || 'songs',
      description: `Search for "${query || 'songs'}"`
    };
  }

  return {
    intent: INTENT_CATEGORIES.GENERAL_QUESTION,
    action: 'chat',
    text: rawInput,
    description: 'General inquiry'
  };
}
