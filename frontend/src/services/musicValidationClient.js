/**
 * Loopra Music-Only Validation Client
 * Layer 4 Playback Gate: Validates YouTube tracks immediately before player load.
 */

const FRONTEND_VALIDATION_CACHE = new Map();

/**
 * Validates whether a track is an eligible, genuine music track before playback.
 * 
 * @param {Object} track The track object to validate
 * @param {string} backendUrl Base URL of Loopra backend
 * @returns {Promise<Object>} { eligible: boolean, isMusic: boolean, confidence: number, category: string, reason: string }
 */
export async function validatePlaybackTrack(track, backendUrl = '') {
  if (!track) {
    return {
      eligible: false,
      isMusic: false,
      confidence: 0,
      category: 'invalid',
      reason: 'No track provided'
    };
  }

  // 1. Radio Streams and Internal Audio Tracks are inherently verified
  if (track.isRadio || track.streamUrl || track.isInternalAudio || track.licenseType === 'direct_license') {
    return {
      eligible: true,
      isMusic: true,
      confidence: 1.0,
      category: 'radio_stream',
      reason: 'Verified Loopra internal audio / live radio station'
    };
  }

  const videoId = track.videoId || track.id?.videoId || track.id;
  if (!videoId || typeof videoId !== 'string' || videoId.length !== 11) {
    return {
      eligible: false,
      isMusic: false,
      confidence: 0,
      category: 'invalid',
      reason: `Invalid YouTube video ID "${videoId}"`
    };
  }

  // 2. Check Session Cache
  if (FRONTEND_VALIDATION_CACHE.has(videoId)) {
    return FRONTEND_VALIDATION_CACHE.get(videoId);
  }

  // 3. Request Authoritative Backend Validation (Layer 1-3)
  try {
    const url = `${backendUrl || ''}/api/music/validate-playback`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        title: track.title,
        artist: track.artist || track.channel,
        channel: track.channel || track.artist,
        duration: track.duration
      })
    });

    if (res.ok) {
      const data = await res.json();
      FRONTEND_VALIDATION_CACHE.set(videoId, data);
      return data;
    }
  } catch (err) {
    console.warn('[MusicValidationClient] Network validation error, applying fail-safe check:', err);
  }

  // 4. Fail-Safe Client-Side Heuristic Gate (If backend network is temporarily unreachable)
  const fullText = `${track.title || ''} ${track.channel || ''}`.toLowerCase();
  const nonMusicPatterns = [
    /\b(gameplay|walkthrough|lets play|speedrun|minecraft|roblox|valorant|gta\s*[v5]|fortnite|pubg|bgmi)\b/i,
    /\b(daily vlog|mukbang|shopping haul|room tour|travel vlog|morning routine)\b/i,
    /\b(tutorial|how to|for beginners|crash course|full course|fl studio tutorial|beat making tutorial)\b/i,
    /\b(podcast|episode \d+|the ranveer show|joe rogan|talk show|full interview)\b/i,
    /\b(breaking news|daily news|news bulletin|debate live)\b/i,
    /\b(full movie|climax scene|comedy scene|fight scene|movie scene|official trailer)\b/i,
    /\b(reaction video|reacts to|reacting to|honest review|unboxing)\b/i,
    /\b(with background music|study with me background)\b/i
  ];

  const hasNonMusicPattern = nonMusicPatterns.some(regex => regex.test(fullText));
  if (hasNonMusicPattern) {
    const failDecision = {
      eligible: false,
      isMusic: false,
      confidence: 0.90,
      category: 'non_music_failsafe',
      reason: 'Detected non-music content traits during client validation'
    };
    FRONTEND_VALIDATION_CACHE.set(videoId, failDecision);
    return failDecision;
  }

  // If clean title and reasonable duration, allow with provisional status
  const safeDecision = {
    eligible: true,
    isMusic: true,
    confidence: 0.75,
    category: 'provisional_music',
    reason: 'Provisional client validation passed'
  };
  FRONTEND_VALIDATION_CACHE.set(videoId, safeDecision);
  return safeDecision;
}

/**
 * Clears the session validation cache
 */
export function clearValidationCache() {
  FRONTEND_VALIDATION_CACHE.clear();
}

export default {
  validatePlaybackTrack,
  clearValidationCache
};
