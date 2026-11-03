/**
 * Loopra Voice Agent Command Registry & Action Mapper
 * Hybrid Intent Understanding & Native Tool Mapper
 * 
 * Complies strictly with:
 * 1. STRICT PLAYBACK INTENT GATE: Never plays music unless explicit playback verb is present.
 * 2. Strict Administrative Isolation: Block any access to admin/database/rollout.
 * 3. Multi-lingual support: English, Hindi, and Hinglish.
 */

export function parseVoiceCommandLocally(rawText = '', context = {}) {
  if (!rawText || typeof rawText !== 'string') return null;
  let text = rawText.trim();
  let lower = text.toLowerCase().trim();
  const currentSong = context.currentSong || context.lastPlayedTrack || null;

  // Strip leading wake phrase if present (e.g. "hey loopra play kesariya" -> "play kesariya")
  const wakePrefixes = ['hey loopra, ', 'hey loopra ', 'ok loopra, ', 'ok loopra ', 'loopra, ', 'loopra '];
  for (const wp of wakePrefixes) {
    if (lower.startsWith(wp)) {
      text = text.slice(wp.length).trim();
      lower = text.toLowerCase().trim();
      break;
    }
  }

  // Pure wake phrase
  if (/^(hey loopra|ok loopra|hello loopra|loopra|namaste loopra)$/i.test(lower)) {
    return {
      type: 'wake_ping',
      action: 'wake_ping',
      speechResponse: 'Listening! Tell me what you want to play or open.',
      description: 'Listening for command...'
    };
  }

  // Deactivation / Stop Continuous Voice Session
  if (
    /^(done loopra|stop listening|bye loopra|alvida loopra|band karo voice|exit voice|close voice|sleep)$/i.test(lower) ||
    /\b(done loopra|stop listening|stop voice|close voice agent)\b/i.test(lower)
  ) {
    return {
      type: 'stop_continuous',
      action: 'stop_continuous',
      speechResponse: 'Stopping voice session. Call Hey Loopra anytime!',
      description: 'Session stopped'
    };
  }

  // -------------------------------------------------------------
  // SECURITY REQUIREMENT: STRICT ADMIN DASHBOARD ISOLATION
  // -------------------------------------------------------------
  if (
    /\b(admin|administrator|admin dashboard|cms|user management|audit logs?|system metrics|diagnostics|database|feature toggle|rollout|server logs)\b/i.test(lower)
  ) {
    return {
      type: 'security_blocked',
      action: 'security_blocked',
      speechResponse: 'Admin Dashboard and administrative operations are strictly isolated and not accessible via Voice Agent.',
      description: 'Action blocked: Administrative security isolation'
    };
  }

  // 0. NEGATIVE PLAY INTENT GUARD:
  // Catches phrases like: "don't play", "do not play", "mat chalao", "mat bajana", "without playing", "bina play kare"
  const hasNegativePlayModifier = (
    /\b(don'?t|do not|mat|na|bina|without|except|never)\s+(?:play|chalao|bajao|sunao|shuru)/i.test(lower) ||
    /\b(?:play|chalao|bajao|sunao)\s+(?:mat|na|nahi)\b/i.test(lower) ||
    /\b(?:don'?t|do not)\s+play\b/i.test(lower) ||
    /don'?t\s+play\s+them/i.test(lower)
  );

  // -------------------------------------------------------------
  // 1. PLAYBACK: PAUSE / STOP
  // -------------------------------------------------------------
  if (
    /^(pause|stop|hold on|ruk jao|rok do|gaana roko|gana roko|pause karo|chup ho jao|pause music|stop music)(?:\s+(?:bhai|yaar|abhi|karo|please))?$/i.test(lower) ||
    /\b(pause music|stop music|music roko|gaana roko|gana roko|pause the song)\b/i.test(lower)
  ) {
    return {
      type: 'playback',
      action: 'pause',
      speechResponse: 'Pausing music',
      description: 'Pause playback'
    };
  }

  // -------------------------------------------------------------
  // 2. PLAYBACK: RESUME / PLAY CURRENT
  // -------------------------------------------------------------
  if (
    /^(resume|play|continue|unpause|shuru karo|chalao|bajao|start playing|resume music|play music)$/i.test(lower) ||
    /\b(resume music|unpause song|play music|chalu karo)\b/i.test(lower)
  ) {
    return {
      type: 'playback',
      action: 'resume',
      speechResponse: 'Resuming playback',
      description: 'Resume playback'
    };
  }

  // -------------------------------------------------------------
  // 3. PLAYBACK: NEXT TRACK / SKIP
  // -------------------------------------------------------------
  if (
    /\b(next track|next song|play (?:the )?next (?:song|track)|skip song|skip track|agla gaana|agla song|agla track|agla chalao|aage badhao|change song)\b/i.test(lower) ||
    /^(next|skip|agla|agla chalao)(?:\s+(?:bhai|yaar|abhi|karo|please))?$/i.test(lower)
  ) {
    return {
      type: 'playback',
      action: 'next',
      speechResponse: 'Playing next track',
      description: 'Skip to next track'
    };
  }

  // -------------------------------------------------------------
  // 4. PLAYBACK: PREVIOUS TRACK
  // -------------------------------------------------------------
  if (
    /\b(previous track|previous song|prev song|pichla gaana|pichla track|pichla song|piche karo)\b/i.test(lower) ||
    /^(previous|prev|pichla)$/i.test(lower)
  ) {
    return {
      type: 'playback',
      action: 'previous',
      speechResponse: 'Playing previous track',
      description: 'Back to previous track'
    };
  }

  // -------------------------------------------------------------
  // 5. PLAYBACK: SHUFFLE
  // -------------------------------------------------------------
  if (
    /\b(shuffle|shuffle mode|random play|shuffle on|turn shuffle on|shuffle off|mix karo)\b/i.test(lower)
  ) {
    return {
      type: 'playback',
      action: 'shuffle',
      speechResponse: 'Toggling shuffle mode',
      description: 'Toggle shuffle mode'
    };
  }

  // -------------------------------------------------------------
  // 6. PLAYBACK: REPEAT / LOOP
  // -------------------------------------------------------------
  if (
    /\b(repeat|repeat mode|loop this|repeat this song|loop karo|baar baar bajao|set repeat)\b/i.test(lower)
  ) {
    return {
      type: 'playback',
      action: 'repeat',
      speechResponse: 'Toggling repeat mode',
      description: 'Toggle repeat mode'
    };
  }

  // -------------------------------------------------------------
  // 7. VOLUME: MUTE / UNMUTE
  // -------------------------------------------------------------
  if (/\b(mute|silent|awaaz band|chup karo)\b/i.test(lower)) {
    return {
      type: 'playback',
      action: 'mute',
      speechResponse: 'Audio muted',
      description: 'Mute volume'
    };
  }
  if (/\b(unmute|awaaz kholo|awaaz on)\b/i.test(lower)) {
    return {
      type: 'playback',
      action: 'unmute',
      speechResponse: 'Audio unmuted',
      description: 'Unmute volume'
    };
  }

  // -------------------------------------------------------------
  // 8. VOLUME: UP / DOWN / SET
  // -------------------------------------------------------------
  const volumeMatch = lower.match(/(?:set\s+)?volume\s+(?:to\s+)?(\d{1,3})/i) ||
                      lower.match(/awaaz\s+(\d{1,3})/i) ||
                      lower.match(/volume\s+(\d{1,3})\s+karo/i);
  if (volumeMatch && volumeMatch[1]) {
    const val = Math.min(100, Math.max(0, parseInt(volumeMatch[1], 10)));
    return {
      type: 'playback',
      action: 'set_volume',
      value: val,
      speechResponse: `Setting volume to ${val} percent`,
      description: `Set volume to ${val}%`
    };
  }
  if (/\b(volume up|increase volume|louder|awaaz badhao|thoda tej karo|awaaz tej|volume tej|awaaz thoda tej|thoda tej)\b/i.test(lower)) {
    return {
      type: 'playback',
      action: 'volume_up',
      speechResponse: 'Increasing volume',
      description: 'Volume up (+15%)'
    };
  }
  if (/\b(volume down|decrease volume|lower volume|softer|awaaz kam karo|thoda dheere karo|awaaz dheere karo|awaaz dheere|dheere karo)\b/i.test(lower)) {
    return {
      type: 'playback',
      action: 'volume_down',
      speechResponse: 'Decreasing volume',
      description: 'Volume down (-15%)'
    };
  }

  // -------------------------------------------------------------
  // 9. LIBRARY: LIKE / UNLIKE CURRENT SONG
  // -------------------------------------------------------------
  if (
    /\b(like this song|like this track|like it|add to favourites|add to favorites|add to liked|add that song to my favorites|dil de do|pasand aaya|favourite karo|usko like karo)\b/i.test(lower) ||
    /^(like|favourite|favorite)$/i.test(lower)
  ) {
    return {
      type: 'library',
      action: 'like_current',
      target: currentSong,
      speechResponse: currentSong ? `Added ${currentSong.title || 'track'} to your Liked Songs` : 'Adding to Liked Songs',
      description: `Like "${currentSong?.title || 'Current Song'}"`
    };
  }

  if (
    /\b(unlike|remove (?:this song )?from (?:favorites|favourites|liked)|delete from (?:favorites|favourites|liked)|dislike|favourite se hatao|favorites se hatao|liked se hatao|liked songs se hatao|is gaane ko hatao|is gaane ko delete karo|hata do|hatao isko|nikal do|remove this song|unlike this song|unlike song)\b/i.test(lower) ||
    /^(unlike|dislike|remove|hatao|hata do)$/i.test(lower)
  ) {
    return {
      type: 'library',
      action: 'unlike_current',
      target: currentSong,
      speechResponse: currentSong ? `Removed "${currentSong.title || 'song'}" from your Liked Songs` : 'Removed from your Liked Songs',
      description: `Unlike current track`
    };
  }

  // -------------------------------------------------------------
  // 9b. AVATAR INTERACTIVE ACTIONS (Wave, Wink, Dance, Jump, Pose)
  // -------------------------------------------------------------
  if (/\b(wave karo|hath hilao|wave|say hi|hi bolo)\b/i.test(lower)) {
    return {
      type: 'avatar',
      action: 'avatar_action',
      gesture: 'wave',
      speechResponse: 'Loopra waves at you!',
      description: 'Trigger Loopra Wave'
    };
  }
  if (/\b(wink karo|aankh maro|wink)\b/i.test(lower)) {
    return {
      type: 'avatar',
      action: 'avatar_action',
      gesture: 'wink',
      speechResponse: 'Loopra winks!',
      description: 'Trigger Loopra Wink'
    };
  }
  if (/\b(dance karo|dance|nacho|groove karo)\b/i.test(lower)) {
    return {
      type: 'avatar',
      action: 'avatar_action',
      gesture: 'dance',
      speechResponse: 'Loopra is grooving!',
      description: 'Trigger Loopra Dance'
    };
  }
  if (/\b(jump karo|jump|koodo)\b/i.test(lower)) {
    return {
      type: 'avatar',
      action: 'avatar_action',
      gesture: 'jump',
      speechResponse: 'Loopra jumps with excitement!',
      description: 'Trigger Loopra Jump'
    };
  }
  if (/\b(pose karo|pose do|style dikhao|pose)\b/i.test(lower)) {
    return {
      type: 'avatar',
      action: 'avatar_action',
      gesture: 'pose',
      speechResponse: 'Loopra strikes a pose!',
      description: 'Trigger Loopra Pose'
    };
  }

  // -------------------------------------------------------------
  // 10. LIBRARY: ADD TO PLAYLIST
  // -------------------------------------------------------------
  if (/\b(add to playlist|playlist me daalo|add this to my playlist|add (.+?) to (?:my\s+)?playlist)\b/i.test(lower)) {
    const specificMatch = lower.match(/add\s+(.+?)\s+to\s+(?:my\s+)?playlist/i);
    const target = specificMatch && specificMatch[1] && !['this', 'it', 'song', 'track'].includes(specificMatch[1])
      ? { title: specificMatch[1].trim() }
      : currentSong;

    return {
      type: 'library',
      action: 'add_to_playlist',
      target,
      speechResponse: 'Opening playlist selector',
      description: `Add ${target?.title || 'track'} to playlist`
    };
  }

  // -------------------------------------------------------------
  // 11. NAVIGATION: QUEUE & NOW PLAYING
  // -------------------------------------------------------------
  if (
    /\b(open playback queue|playback queue|open queue|show queue|view queue|queue dikhao|up next songs|now playing queue|queue panel)\b/i.test(lower) ||
    /^(queue)$/i.test(lower)
  ) {
    return {
      type: 'navigation',
      action: 'open_queue',
      speechResponse: 'Opening playback queue',
      description: 'Open Queue panel'
    };
  }

  // -------------------------------------------------------------
  // 12. NAVIGATION: SYNCHRONIZED LYRICS
  // -------------------------------------------------------------
  if (
    /\b(open lyrics|show lyrics|view lyrics|lyrics kholo|lyrics dikhao|lyrics)\b/i.test(lower) ||
    /^(lyrics)$/i.test(lower)
  ) {
    return {
      type: 'navigation',
      action: 'open_lyrics',
      speechResponse: 'Opening synchronized lyrics',
      description: 'Open Lyrics modal'
    };
  }

  // -------------------------------------------------------------
  // 13. CONTEXT: OPEN CURRENT ARTIST'S PROFILE
  // -------------------------------------------------------------
  if (
    /\b(open this artist profile|open the artist profile|open its artist profile|open this artist|artist profile|who is the singer|artist ka profile|open artist|is artist ke saare songs)\b/i.test(lower)
  ) {
    const artistName = context.lastArtist || currentSong?.artist || currentSong?.channel || null;
    return {
      type: 'navigation',
      action: 'open_artist',
      target: artistName,
      speechResponse: artistName ? `Opening ${artistName}'s profile` : 'Opening artist profile',
      description: `Open profile of ${artistName || 'artist'}`
    };
  }

  // -------------------------------------------------------------
  // 14. CONTEXT: FOLLOW ARTIST
  // -------------------------------------------------------------
  if (/\b(follow artist|follow this artist|artist ko follow karo)\b/i.test(lower)) {
    const artistName = context.lastArtist || currentSong?.artist || currentSong?.channel || null;
    return {
      type: 'library',
      action: 'follow_artist',
      target: artistName,
      speechResponse: artistName ? `Following ${artistName}` : 'Following artist',
      description: `Follow ${artistName || 'artist'}`
    };
  }

  // -------------------------------------------------------------
  // 15. NAVIGATION: GO BACK
  // -------------------------------------------------------------
  if (/\b(go back|back jao|piche jao|previous page|wapas jao)\b/i.test(lower) || /^(back)$/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'go_back',
      speechResponse: 'Going back',
      description: 'Go to previous page'
    };
  }

  // -------------------------------------------------------------
  // 16. NAVIGATION: LISTENING INSIGHTS & RECAP
  // -------------------------------------------------------------
  if (/\b(recap and stats|recap & stats|my listening statistics|music summary|listening report|listening insights|weekly recap|my recap|stats|statistics|listening stats|mera recap|mera stats|insights kholo|insights|recap dikhao|stats dikhao)\b/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'open_insights',
      speechResponse: 'Opening your Listening Insights & Weekly Recap',
      description: 'Open Listening Insights & Recap'
    };
  }

  // -------------------------------------------------------------
  // 17. NAVIGATION: TOP-LEVEL PAGES & STATIONS
  // -------------------------------------------------------------
  if (/\b(go home|open home|home page|ghar jao|main page)\b/i.test(lower) || /^(home)$/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'navigate_page',
      target: 'home',
      speechResponse: 'Opening Home',
      description: 'Navigate to Home'
    };
  }

  // Station: Saloon FM / Lune FM / Barber
  if (/\b(saloon|salon|lune\s*fm|luna\s*fm|barber|saloon\s*fm|salon\s*fm|saloon\s*nostalgia|90s\s*saloon)\b/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'navigate_page',
      target: 'barber',
      speechResponse: 'Opening Saloon FM Station',
      description: 'Navigate to Saloon FM'
    };
  }

  // Station: Horn Ok Please / Dhaba
  if (/\b(horn\s*ok\s*please|truck\s*melodies|highway\s*truck|dhaba|highway)\b/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'navigate_page',
      target: 'truck',
      speechResponse: 'Opening Horn Ok Please Station',
      description: 'Navigate to Horn Ok Please'
    };
  }

  // Station: Desi Theka / Theka Session
  if (/\b(desi\s*theka|theka\s*session|theka|pauwa)\b/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'navigate_page',
      target: 'pauwa',
      speechResponse: 'Opening Desi Theka Station',
      description: 'Navigate to Desi Theka'
    };
  }

  // Station: Time Machine Radio
  if (/\b(time\s*machine|retro\s*era)\b/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'navigate_page',
      target: 'timemachine',
      speechResponse: 'Opening Time Machine Radio',
      description: 'Navigate to Time Machine'
    };
  }

  // Station: Mood to Music
  if (/\b(mood\s*to\s*music|mood\s*music)\b/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'navigate_page',
      target: 'mood',
      speechResponse: 'Opening Mood to Music',
      description: 'Navigate to Mood to Music'
    };
  }

  // Curated Just For You
  if (/\b(for\s*you|curated\s*for\s*you|curated\s*just\s*for\s*you)\b/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'navigate_page',
      target: 'for-you',
      speechResponse: 'Opening Curated For You',
      description: 'Navigate to Curated For You'
    };
  }

  if (/\b(open discover|go to discover|discover page|discover kholo|discover khojo|explore music|explore)\b/i.test(lower) || /^(discover|khojo)$/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'navigate_page',
      target: 'discover',
      speechResponse: 'Opening Discover & Search',
      description: 'Navigate to Discover'
    };
  }

  if (/\b(open radio|live radio|indian radio|radio stations?|fm sunao|radio)\b/i.test(lower) || /^(radio)$/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'navigate_page',
      target: 'radio',
      speechResponse: 'Opening Indian Live Radio',
      description: 'Navigate to Live Radio'
    };
  }

  if (/\b(liked songs|my liked songs|open liked|favourites?|pasandida gaane|mera liked songs kholo|meri liked songs|library)\b/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'navigate_page',
      target: 'library',
      speechResponse: 'Opening Liked Songs Collection',
      description: 'Navigate to Liked Songs'
    };
  }

  if (/\b(listening activity|activity kholo|activity page|recent activity)\b/i.test(lower) || /^(activity)$/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'navigate_page',
      target: 'activity',
      speechResponse: 'Opening Listening Activity',
      description: 'Navigate to Listening Activity'
    };
  }

  if (/\b(listening history|recently played|recent songs|history kholo|open listening history|history page|mera listening history)\b/i.test(lower) || /^(history)$/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'navigate_page',
      target: 'history',
      speechResponse: 'Opening Listening History',
      description: 'Navigate to History'
    };
  }

  if (/\b(open playlists|my playlists|playlists dekho|playlists)\b/i.test(lower) || /^(playlists)$/i.test(lower)) {
    return {
      type: 'navigation',
      action: 'navigate_page',
      target: 'playlists',
      speechResponse: 'Opening Playlists',
      description: 'Navigate to Playlists'
    };
  }

  // -------------------------------------------------------------
  // 18. NAVIGATION: ALBUM
  // -------------------------------------------------------------
  const albumMatch = lower.match(/^(?:open\s+)?album\s+(.+)$/i) || lower.match(/^open\s+(.+?)\s+album$/i);
  if (albumMatch && albumMatch[1]) {
    const albumName = albumMatch[1].trim();
    return {
      type: 'navigation',
      action: 'search',
      query: `${albumName} album`,
      speechResponse: `Opening album "${albumName}"`,
      description: `Open album "${albumName}"`
    };
  }

  // -------------------------------------------------------------
  // 19. NAVIGATION: SPECIFIC ARTIST BY NAME
  // -------------------------------------------------------------
  const artistMatch = lower.match(/(?:open|show|view)?\s*artist\s+([a-zA-Z0-9\s.]+)/i) ||
                      lower.match(/([a-zA-Z0-9\s.]+)\s+(?:ka\s+profile|ka\s+page)/i);
  if (artistMatch && artistMatch[1]) {
    const rawName = artistMatch[1].trim();
    if (rawName && !['profile', 'page', 'songs', 'queue', 'music'].includes(rawName)) {
      return {
        type: 'navigation',
        action: 'open_artist',
        target: rawName,
        speechResponse: `Opening ${rawName}'s profile`,
        description: `Open artist profile for "${rawName}"`
      };
    }
  }

  // -------------------------------------------------------------
  // 20. DISCOVERY: SHOW SONGS BY ARTIST (SEARCH / DISPLAY ONLY, NEVER AUTO-PLAY)
  // -------------------------------------------------------------
  // e.g. "Show songs by Arijit Singh", "Arijit Singh ke songs dikhao"
  const showSongsByMatch = lower.match(/^(?:show|display)\s+songs\s+(?:by|of)\s+(.+)$/i);
  if (showSongsByMatch && showSongsByMatch[1]) {
    const artist = text.slice(text.length - showSongsByMatch[1].length).trim();
    return {
      type: 'navigation',
      action: 'search',
      query: artist,
      speechResponse: `Displaying songs by ${artist}`,
      description: `Show songs by "${artist}"`
    };
  }

  const hindiShowSongs = lower.match(/^(.+?)\s+ke\s+(?:songs|gaane)\s+dikhao$/i);
  if (hindiShowSongs && hindiShowSongs[1]) {
    const artist = text.slice(0, hindiShowSongs[1].length).trim();
    return {
      type: 'navigation',
      action: 'search',
      query: artist,
      speechResponse: `Displaying songs by ${artist}`,
      description: `Show songs by "${artist}"`
    };
  }

  // Numbered or descriptive song listing: "5 songs of Arijit Singh", "songs by KK", "songs of Atif Aslam"
  const songListMatch = lower.match(/^(?:(?:\d+|top|best|popular)\s+)?songs?\s+(?:by|of|from)\s+(.+)$/i);
  if (songListMatch && songListMatch[1]) {
    const artist = text.slice(text.toLowerCase().indexOf(songListMatch[1])).trim();
    return {
      type: 'navigation',
      action: 'search',
      query: artist,
      speechResponse: `Showing songs by ${artist}`,
      description: `Show songs by "${artist}"`
    };
  }

  // -------------------------------------------------------------
  // 21. DISCOVERY: SEARCH ONLY (SEARCH CATALOG, NEVER AUTO-PLAY)
  // -------------------------------------------------------------
  // e.g. "Search Headlights", "Find Headlights", "Search for Coke Studio"
  const searchPrefixes = [
    'search for ',
    'search ',
    'find song ',
    'find track ',
    'find ',
    'look up ',
    'dhundo ',
    'dhoondho ',
    'khojo '
  ];
  for (const prefix of searchPrefixes) {
    if (lower.startsWith(prefix)) {
      let query = text.slice(prefix.length).trim();
      // Clean query of negative play instructions or count prefixes
      query = query
        .replace(/,\s*(?:don'?t\s+play\s+(?:them|it|songs?)?|mat\s+chalao|bina\s+play\s+kare|do\s+not\s+play\s+(?:them|it)?)/gi, '')
        .replace(/\b(don'?t\s+play\s+(?:them|it|songs?)?|mat\s+chalao|bina\s+play\s+kare|do\s+not\s+play\s+(?:them|it)?)\b/gi, '')
        .replace(/^(?:(?:\d+|five|four|three|two|one|paanch|top|best|popular)\s+)?songs?\s+(?:by|of|from)\s+/i, '')
        .trim();
      if (query) {
        return {
          type: 'navigation',
          action: 'search',
          query,
          speechResponse: `Searching for ${query}`,
          description: `Search for "${query}"`
        };
      }
    }
  }

  // Suffix search: "Arijit Singh search karo", "Headlights dhundo"
  const hindiSuffixSearch = lower.match(/^(.+?)\s+(?:search\s+karo|dhundo|dhoondho|khojo)$/i);
  if (hindiSuffixSearch && hindiSuffixSearch[1]) {
    let query = text.slice(0, hindiSuffixSearch[1].length).trim();
    query = query
      .replace(/\b(don'?t\s+play\s+(?:them|it|songs?)?|mat\s+chalao|bina\s+play\s+kare|do\s+not\s+play\s+(?:them|it)?)\b/gi, '')
      .replace(/^(?:(?:\d+|five|four|three|two|one|paanch|top|best|popular)\s+)?songs?\s+(?:by|of|from)\s+/i, '')
      .trim();
    if (query) {
      return {
        type: 'navigation',
        action: 'search',
        query,
        speechResponse: `Searching for ${query}`,
        description: `Search for "${query}"`
      };
    }
  }

  // If a negative play modifier is present ("don't play", "mat bajao"), NEVER proceed to play gates!
  if (hasNegativePlayModifier) {
    const cleanSearchQuery = text
      .replace(/^(?:find|search|show|dhoondho|dhundo|khojo)\s+/i, '')
      .replace(/,\s*(?:don'?t\s+play\s+(?:them|it|songs?)?|mat\s+chalao|bina\s+play\s+kare|do\s+not\s+play\s+(?:them|it)?)/gi, '')
      .replace(/\b(don'?t\s+play\s+(?:them|it|songs?)?|mat\s+chalao|bina\s+play\s+kare|do\s+not\s+play\s+(?:them|it)?)\b/gi, '')
      .replace(/^(?:(?:\d+|five|four|three|two|one|paanch|top|best|popular)\s+)?songs?\s+(?:by|of|from)\s+/i, '')
      .trim();
    return {
      type: 'navigation',
      action: 'search',
      query: cleanSearchQuery || 'songs',
      speechResponse: `Displaying songs for ${cleanSearchQuery || 'songs'}`,
      description: `Search for "${cleanSearchQuery || 'songs'}" (Search only)`
    };
  }

  // -------------------------------------------------------------
  // 22. PLAYBACK: EXPLICIT PLAY INTENT GATE ONLY
  // -------------------------------------------------------------
  // Prefix play: "play Headlights", "bajao Pasoori", "chalao Kesariya"
  const playPrefixes = [
    'play song ',
    'play track ',
    'play ',
    'bajao gaana ',
    'bajao ',
    'chalao song ',
    'chalao ',
    'sunao gaana ',
    'sunao ',
    'gana bajao ',
    'gaana bajao '
  ];
  for (const prefix of playPrefixes) {
    if (lower.startsWith(prefix)) {
      const query = text.slice(prefix.length).trim();
      if (query.toLowerCase() === 'this song' || query.toLowerCase() === 'this track') {
        return {
          type: 'playback',
          action: 'resume',
          speechResponse: 'Resuming current track',
          description: 'Play current song'
        };
      }
      if (query) {
        return {
          type: 'playback',
          action: 'play_search',
          query,
          speechResponse: `Searching and playing ${query}`,
          description: `Play "${query}"`
        };
      }
    }
  }

  // Suffix play: "Headlights play karo", "Headlights bajao", "Kesariya chalao"
  const hindiSuffixPlay = lower.match(/^(.+?)\s+(?:play\s+karo|bajao|chalao|sunao)$/i);
  if (hindiSuffixPlay && hindiSuffixPlay[1]) {
    const query = text.slice(0, hindiSuffixPlay[1].length).trim();
    if (query) {
      return {
        type: 'playback',
        action: 'play_search',
        query,
        speechResponse: `Playing "${query}"`,
        description: `Play "${query}"`
      };
    }
  }

  // -------------------------------------------------------------
  // 23. AMBIGUOUS "OPEN <ENTITY>" CLARIFICATION GATE (NEVER AUTO-PLAY)
  // -------------------------------------------------------------
  // e.g. "Open Headlights" -> Clarify whether user wants song, album, or search
  const openAmbiguous = lower.match(/^open\s+([a-zA-Z0-9\s]+)$/i);
  if (openAmbiguous && openAmbiguous[1]) {
    const entity = openAmbiguous[1].trim();
    if (!['discover', 'radio', 'history', 'home', 'playlists', 'queue', 'lyrics', 'insights', 'library'].includes(entity)) {
      return {
        type: 'clarify',
        action: 'clarify',
        speechResponse: `Would you like to play the song "${entity}", view the album, or search for it?`,
        description: `Clarify intent for "${entity}"`
      };
    }
  }

  // -------------------------------------------------------------
  // 24. STRICT DEFAULT GATE (UNKNOWN / AMBIGUOUS)
  // -------------------------------------------------------------
  // STRICT RULE: Never use playback as fallback!
  return {
    type: 'clarify',
    action: 'clarify',
    speechResponse: `I did not catch that command. What would you like to play or open?`,
    description: `Clarify command: "${text}"`
  };
}

export {
  splitVoiceInstructionIntoClauses,
  resolveStepReferences,
  parseMultiStepInstruction,
  executeTaskPipeline
} from './voiceTaskEngine.js';
