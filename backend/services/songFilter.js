import { isValidThumbnailUrlFormat } from './thumbnailValidationService.js';

/**
 * Loopra Single-Song Identification & Verification Engine
 * 
 * Enforces strict single-song filtering across all Loopra discovery surfaces:
 * - Loopra AI Music Companion & recommendations
 * - Search results (/api/youtube/search)
 * - Discover Swipe deck
 * - 100-song Shuffle pool
 * - Mood-to-Music AI recommendations
 * - Home & Categorized recommendations
 * - Nostalgia Radio & Playlists
 * 
 * Strict Exclusion criteria:
 * - Mashups
 * - Medleys
 * - Jukebox videos (audio & video)
 * - Non-stop song collections
 * - Multiple-song compilations & remix compilations
 * - Best-of collections & Top 10/20/50/100 song collections
 * - DJ mixes & continuous mixes
 * - Playlist videos containing multiple songs
 * - Multiple-track concert compilations
 * - Videos exceeding 15 minutes (900s) or containing multi-track timestamps
 * 
 * Strict Acceptance criteria:
 * - One individual song per recommendation
 * - Full official song versions
 * - Individual official music videos & audio releases
 * - Single-song remixes (where the video contains only that one song)
 * - Individual acoustic, unplugged or live versions of a single song
 */

// Explicit blacklist words that disqualify a video when found in title or description
// Note: Per user specification, 'unplugged' individual songs are legitimate singles,
// while multi-song unplugged compilations, jukeboxes, or mashups remain strictly rejected.
export const STRICT_BLACKLIST_WORDS = [
  'jukebox', 'mashup', 'best of', 'collection', 'non-stop',
  'hits of', 'top 50', 'latest hits',
  'audio jukebox', 'full album'
];

export const STRICT_BLACKLIST_REGEXES = STRICT_BLACKLIST_WORDS.map(word => {
  const escaped = word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`\\b${escaped}\\b`, 'i');
});

// Strict Track Sanitizer: Patterns for Shorts, ringtones, edits, dance/fitness clips, and junk
export const normalizeTextForFiltering = (str = '') => {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ' ')
    .replace(/[^a-z0-9#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const STRICT_TEXT_BLOCKLIST = [
  'shorts', 'short', '#shorts', 'yt shorts', 'youtube shorts', 'viralshort', 'reels', 'ig reel',
  'ringtone', 'ringtones', 'mobile ringtone', 'phone ringtone', 'love ringtone', 'new ringtone', 'caller tune',
  'whatsapp status', 'status video', 'edit', 'voice comparison', 'vs', 'song ideas',
  'dance cover', 'dance performance', 'couple dance', 'zumba', 'fitness dance', 'dancer',
  'karaoke', 'karoake', 'instrumental only', 'bhat geet', 'banni geet', 'beach', 'anniversary'
];

export const SPAM_CHANNEL_HANDLES = [
  /\brington(?:e|es|ix)\b/i,
  /\bsayyed\s+ismail\b/i,
  /\bzumba\b/i,
  /\bdancers?\b/i,
  /\bkar(?:a|o)ake\b/i,
  /\bfact\s+boy\b/i,
  /\bcinemix\b/i,
  /\bstatus\b/i,
  /\bedits?\b/i
];

export const STRICT_BLOCKLIST_REGEXES = STRICT_TEXT_BLOCKLIST.map(kw => {
  const isHash = kw.startsWith('#');
  const cleanKw = kw.replace(/^#/, '');
  const escaped = cleanKw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s+');
  if (isHash) {
    return new RegExp(`(?:#|\\b)${escaped}\\b`, 'i');
  }
  return new RegExp(`\\b${escaped}\\b`, 'i');
});

export const SHORTS_TAGS_AND_KEYWORDS = STRICT_BLOCKLIST_REGEXES;
export const RINGTONE_AND_EDIT_PATTERNS = STRICT_BLOCKLIST_REGEXES;
export const DANCE_FITNESS_CLIP_PATTERNS = SPAM_CHANNEL_HANDLES;

/**
 * Strict Track Sanitizer:
 * Validates whether a track is a clean genuine music track and NOT:
 * - Shorts (shorts, short, #shorts, yt shorts, youtube shorts, viralshort, reels, ig reel)
 * - Ringtones & edits (ringtone, ringtones, mobile ringtone, phone ringtone, love ringtone, new ringtone, caller tune, whatsapp status, status video, edit, voice comparison, vs, song ideas, anniversary, beach, karaoke, karoake, instrumental only, bhat geet, banni geet)
 * - Dance / fitness / clip channels or titles (dance cover, dance performance, couple dance, zumba, fitness dance, dancer, ringtonix, sayyed ismail, fact boy, cinemix, karaoke, karoake, generic status/edit handles)
 * - Short-form duration tracks (durationSec > 0 && durationSec <= 75)
 */
export function isCleanMusicTrack(track) {
  if (!track) return false;

  const rawTitle = (
    track.title ||
    track.snippet?.title ||
    track.name ||
    ''
  ).trim();

  if (!rawTitle) return false;

  const rawChannel = (
    track.channel ||
    track.artist ||
    track.author?.name ||
    track.snippet?.channelTitle ||
    ''
  ).trim();

  const rawDesc = (
    track.description ||
    track.snippet?.description ||
    ''
  ).trim();

  const rawTags = Array.isArray(track.tags)
    ? track.tags.join(' ')
    : (Array.isArray(track.snippet?.tags) ? track.snippet.tags.join(' ') : '');

  // 1. Normalized text check (lowercased, emojis/punctuation stripped, spaces collapsed)
  const normTitle = normalizeTextForFiltering(rawTitle);
  const normChannel = normalizeTextForFiltering(rawChannel);
  const normDesc = normalizeTextForFiltering(rawDesc);
  const normTags = normalizeTextForFiltering(rawTags);
  const combinedNorm = `${normTitle} ${normChannel} ${normDesc} ${normTags}`.trim();

  for (const regex of STRICT_BLOCKLIST_REGEXES) {
    if (regex.test(combinedNorm)) return false;
  }

  // 2. Creator / channel spam check (ringtonix, sayyed ismail, zumba, dancer, karaoke, fact boy, cinemix, status, edit handles)
  for (const channelRegex of SPAM_CHANNEL_HANDLES) {
    if (channelRegex.test(rawChannel) || channelRegex.test(normChannel)) return false;
  }

  // 3. Short-form duration check (durationSec > 0 && durationSec <= 75)
  let durationSec = null;
  const rawDuration = track.durationSec !== undefined
    ? track.durationSec
    : (track.duration?.seconds !== undefined
        ? track.duration.seconds
        : (track.seconds !== undefined
            ? track.seconds
            : (track.duration !== undefined ? track.duration : null)));

  if (typeof rawDuration === 'number' && !isNaN(rawDuration)) {
    durationSec = rawDuration;
  } else if (typeof rawDuration === 'string') {
    const str = rawDuration.trim();
    if (str.startsWith('PT')) {
      const h = (str.match(/(\d+)H/) || [])[1] || 0;
      const m = (str.match(/(\d+)M/) || [])[1] || 0;
      const s = (str.match(/(\d+)S/) || [])[1] || 0;
      durationSec = parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10);
    } else {
      const parts = str.split(':').map(p => parseInt(p, 10) || 0);
      if (parts.length === 3) {
        durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        durationSec = parts[0] * 60 + parts[1];
      }
    }
  }

  if (durationSec !== null && durationSec > 0 && durationSec <= 75) {
    return false;
  }

  return true;
}
const OFFICIAL_CHANNELS = [
  't-series', 'tseries', 'sony music', 'sonymusic', 'zee music', 'zeemusic',
  'yrf', 'yash raj films', 'tips official', 'tips music', 'saregama', 'saregamamusic',
  'universal music', 'warner music', 'speed records', 'white hill music',
  'eros now', 'venus', 'aditya music', 'lahari music', 'geet mp3',
  'times music', 'svf music', 't-series apna punjab', 'panj-aab records'
];

// Known verified mainstream artists (Hindi / Bollywood & top Indian music)
export const MAINSTREAM_VERIFIED_ARTISTS = [
  'arijit singh', 'atif aslam', 'shreya ghoshal', 'vishal mishra', 'jubin nautiyal',
  'sonu nigam', 'kk', 'mohit chauhan', 'neha kakkar', 'sunidhi chauhan', 'pritam',
  'sachin-jigar', 'rahat fateh ali khan', 'diljit dosanjh', 'armaan malik', 'darshan raval',
  'alka yagnik', 'kumar sanu', 'udit narayan', 'lata mangeshkar', 'kishore kumar',
  'mukesh', 'mohammed rafi', 'asha bhosle', 'badshah', 'guru randhawa', 'anuv jain',
  'prateek kuhad', 'b praak', 'sidhu moose wala', 'jasleen royal', 'shilpa rao',
  'sachet tandon', 'parampara', 'monali thakur', 'stebin ben', 'papon', 'neeti mohan',
  'amit trivedi', 'a.r. rahman', 'ar rahman', 'himesh reshammiya', 'mika singh',
  'shankar mahadevan', 'hariharan', 'lucky ali'
];

// Patterns for AI-generated songs, amateur covers, foreign drama clips, and junk
export const AI_JUNK_AND_COVER_PATTERNS = [
  // AI-generated music, AI covers, voice cloning, synthetic audio
  /\b(ai\s+generated|ai\s+cover|ai\s+song|ai\s+music|ai\s+version|suno(?:\.ai)?|udio(?:\.ai)?|voicify|ai\s+voice|covers\s+ai|generated\s+by\s+ai|artificial\s+intelligence\s+music|deepfake\s+music)\b/i,
  // Random unofficial amateur covers, bedroom covers, fan covers
  /\b((?:bedroom|acoustic|guitar|piano|ukulele|drum|flute|violin|fan(?:[\s-]made)?|amateur|random|garageband)\s+cover(?:\s+(?:by|with|version|song|tabs))?|cover\s+(?:by|version\s+by)\s+[a-z0-9_]{3,25})\b/i,
  // Foreign drama clips, drama edits, non-music serial/movie clips, status/reel clips
  /\b(kdrama\s+edit|k-drama|c-drama|drama\s+scene|chinese\s+drama|pakistani\s+drama|anime\s+edit|movie\s+scene|whatsapp\s+status\s+video|shorts\s+video|status\s+video|reel\s+edit|funny\s+clip|reaction\s+video)\b/i,
  // Challenges & Games
  /\b(try\s+not\s+to\s+(?:sing|laugh|dance)(?:\s+along)?(?:\s+challenge)?)\b/i,
  /\b(guess\s+the\s+(?:song|singer|music|track|artist|beat|lyrics?)(?:\s+(?:challenge|quiz|game))?)\b/i,
  /\b(music\s+quiz|song\s+quiz|name\s+the\s+song|finish\s+the\s+lyrics?|blind\s+karaoke)\b/i,
  // Reaction & Review videos
  /\b(reaction\s+video|reacts?\s+to|reacting\s+to|first\s+time\s+hearing|song\s+reaction|trailer\s+reaction)\b/i,
  // Gaming content
  /\b(gameplay|walkthrough|playthrough|let'?s\s+play|speedrun|stream\s+highlights|pro\s+gameplay)\b/i,
  /\b(minecraft|roblox|valorant|gta\s*[v5]|fortnite|pubg|bgmi|free\s*fire|apex\s+legends)\b/i,
  // Vlogs & Hauls
  /\b(daily\s+vlog|family\s+vlog|travel\s+vlog|vlog\s+\d+|day\s+in\s+my\s+life|mukbang|haul\s+video|shopping\s+haul)\b/i,
  // Tutorials & How-To
  /\b(tutorial|how\s+to|crash\s+course|full\s+course|lecture|masterclass|tips\s+and\s+tricks)\b/i,
  // News & Debates
  /\b(breaking\s+news|live\s+news|news\s+bulletin|prime\s+time\s+debate|press\s+conference)\b/i,
  // Comedy & Pranks
  /\b(stand[\s-]?up\s+comedy|comedy\s+scene|funny\s+video|prank\s+video|comedy\s+show)\b/i,
  // Videos using music only as background
  /\b(with\s+background\s+music|background\s+music\s+for\s+(?:gaming|study|vlog)|bgm\s+for\s+vlogs?)\b/i
];

// Generic "New Song" promotional title patterns
// Excludes clickbait titles like "New Song 2026", "Latest Hindi New Song", "New Song Official Video"
// Strictly preserves genuine song titles containing "New" (e.g. "New Rules", "New Divide", "Brand New Day", "Something New")
export const GENERIC_NEW_SONG_REGEXES = [
  /^\s*(?:latest\s+)?(?:hindi\s+|punjabi\s+|bhojpuri\s+|haryana\s+)?new\s+songs?(?:\s+20\d\d)?(?:\s*\|\s*.*|\s*[-–:]\s*.*|\s*official\s+video.*|\s*audio.*)?$/i,
  /\b(?:latest\s+)?(?:hindi\s+|punjabi\s+|bhojpuri\s+)?new\s+songs?\s+20\d\d\b/i,
  /\b(?:latest\s+hindi\s+new\s+song|latest\s+new\s+song|new\s+song\s+official\s+video)\b/i,
  /^\s*new\s+songs?\s*$/i
];

// Helper to verify if an artist or title belongs to a mainstream verified artist
export function isMainstreamArtist(artistOrTitle = '') {
  if (!artistOrTitle || typeof artistOrTitle !== 'string') return false;
  const lower = artistOrTitle.toLowerCase();
  return MAINSTREAM_VERIFIED_ARTISTS.some(a => lower.includes(a));
}

// Multi-song title patterns that MUST ALWAYS be rejected
// Strictly bans generic compilation playlists, mashups, and multi-song albums per user specification:
// ['jukebox', 'mashup', 'best of', 'collection', 'non-stop', 'hits of', 'top 50', 'latest hits', 'audio jukebox', 'full album']
// Legit individual unplugged versions are preserved, while multi-song unplugged/year compilations are blocked.
const MULTI_SONG_TITLE_REGEXES = [
  // User Mandatory Blacklist Terms
  /\b(audio\s+jukebox|video\s+jukebox|album\s+jukebox|radio\s+jukebox|jukebox)\b/i,
  /(?:mega\s+mashup|non[\s-]?stop\s+mashup|mashup|mash\s+up|mash-up|\w*mashup)/i,
  /\b(best\s+of)\b/i,
  /\b(collections?|songs?\s+collections?|beats?\s+collections?|music\s+collections?|hits\s+collections?|tracks?\s+collections?|best\s+collection)\b/i,
  /\b(non[\s-]?stop|nonstop)\b/i,
  /\b(hits\s+of)\b/i,
  /\b(top\s*50\b|top\s*\d{1,4}\b)/i,
  /\b(latest\s+hits)\b/i,
  /\b(full\s+album|complete\s+album|all\s+album\s+songs|album\s+songs)\b/i,

  // Multi-song Unplugged & Year Compilations (e.g. "Unplugged Jukebox", "Unplugged Non-Stop", "2020 Hits Jukebox", "Top 50 2022")
  /\b(unplugged\s+(?:jukebox|mashup|collection|non[\s-]?stop|songs|hits)|(?:collection|jukebox|mashup|non[\s-]?stop|top|best)\s+.*unplugged)\b/i,
  /\b(?:2020|2021|2022|2023)\s+(?:jukebox|mashup|collection|non[\s-]?stop|hits|songs|compilation|playlist|full\s+album)\b/i,
  /\b(?:jukebox|mashup|collection|non[\s-]?stop|top\s*\d+|best\s+of|latest\s+hits|all\s+songs|compilation|full\s+album)\s+.*(?:2020|2021|2022|2023)\b/i,

  // Additional Compilation & Multi-song patterns
  /\b(mixtape|mix-tape|mix\s+tape)\b/i,
  /\b(medley|medly)\b/i,
  /\b(compilation|song\s+compilation|remix\s+compilation|video\s+compilation|hits\s+compilation|remixes\s+compilation)\b/i,
  /\b(all\s+songs|all\s+song|all\s+video\s+songs|songs\s+collection|song\s+collection|music\s+collection|hits\s+collection)\b/i,
  /\b(multiple\s+songs?|songs?\s+combined|all\s+songs?\s+in\s+one\s+video|multiple\s+tracks?)\b/i,
  /\b(best\s*\d{1,4}\b)/i,
  /\b(top\s+songs|best\s+songs|superhit\s+songs|greatest\s+hits)\b/i,
  /\b(greatest\s+hits\s+jukebox|golden\s+hits\s+collection|evergreen\s+hits\s+jukebox)\b/i,
  /\b(complete\s+discography|discography)\b/i,
  /\b([a-z0-9\s]+songs\s*\|\s*top\s+[a-z0-9\s]+songs?)\b/i,
  // Multi-song Lofi and Chill compilations (e.g. "Lofi Mix", "Chill Beats Mix", "Study Mix")
  /\b(lofi\s+mix|lo-fi\s+mix|chill\s+(?:beats\s+)?mix|study\s+mix|relaxing\s+mix|sleep\s+mix)\b/i,
  // Continuous & DJ multi-song mixes
  /\b(party\s+mix|dj\s+mix|dj\s+(nonstop|party)|megamix|mega\s+mix)\b/i,
  /\b(continuous\s+(music|mix|playback|stream))\b/i,
  /\b(back\s*to\s*back|back\s*2\s*back|\bb2b\b)\b/i,
  // Playlists as single videos
  /\b(full\s+playlist|youtube\s+playlist|songs\s+playlist|video\s+playlist)\b/i,
  // Concert multi-track collections
  /\b(concert\s+compilation|live\s+concert\s+all\s+songs|full\s+concert\s+songs)\b/i,
  // Durations in title (hours)
  /\b(\d+\s*hours?|\d+\s*hrs?|\d+hr)\b/i,
  // Karaoke multi-packs
  /\b(karaoke\s+collection|multiple\s+songs?\s+karaoke)\b/i,
  // Tracklist listings in title
  /\b1\.\s+.*\b2\.\s+.*\b3\.\s+/i
];

/**
 * Validates whether a track ID is a genuine, embeddable YouTube video ID
 */
export function isValidYouTubeId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[a-zA-Z0-9_-]{11}$/.test(id.trim());
}

/**
 * Classifies an individual song into its specific Loopra songType.
 * Preserves distinction between official release, single remix, acoustic/live, and general single song.
 */
export function classifySongType(title = '', channel = '') {
  const lower = `${title} ${channel}`.toLowerCase();

  // 1. Single-song remixes
  if (/\b(dance\s+remix|club\s+mix|lofi\s+remix|lo-fi\s+remix|chill\s+mix|lofi|remix|slowed(\s+and|\s*\+)?\s+reverb)\b/i.test(lower) &&
      !/\b(compilation|nonstop|megamix|jukebox)\b/i.test(lower)) {
    return 'single_song_remix';
  }

  // 2. Single-song acoustic / unplugged / live versions
  if (/\b(acoustic\s+(version|video)?|unplugged|live\s+performance|live\s+at|live\s+in|live\s+version|orchestral)\b/i.test(lower) &&
      !/\b(compilation|nonstop|full\s+concert|jukebox|mashup)\b/i.test(lower)) {
    return 'acoustic_unplugged';
  }

  // 3. Official singles & music videos
  if (/\b(official\s+video|official\s+music\s+video|official\s+audio|full\s+video\s+song|full\s+song|lyric\s+video|original\s+song)\b/i.test(lower)) {
    return 'official_release';
  }

  return 'individual_song';
}

/**
 * Checks if channel is an official label or artist channel.
 */
export function isOfficialChannel(channel = '') {
  if (!channel || typeof channel !== 'string') return false;
  const lower = channel.toLowerCase().trim();
  if (lower.endsWith('vevo') || lower.endsWith('official') || lower.includes('topic')) {
    return true;
  }
  return OFFICIAL_CHANNELS.some(c => lower.includes(c));
}

/**
 * Comprehensive verification of whether a video is strictly an individual song.
 * Evaluates Title, Description, Channel, and Duration.
 * 
 * Returns { isValid, reason, songType, verificationStatus, isOfficialChannel }
 */
export function verifySingleSong(track) {
  if (!track) {
    return {
      isValid: false,
      reason: 'Track is null or undefined',
      songType: 'invalid',
      verificationStatus: 'rejected'
    };
  }

  const trackObj = typeof track === 'string' ? { title: track } : track;
  const id = trackObj.id?.videoId || trackObj.id || trackObj.videoId;
  if (id && !isValidYouTubeId(id)) {
    return {
      isValid: false,
      reason: `Invalid YouTube video ID "${id}"`,
      songType: 'invalid',
      verificationStatus: 'rejected'
    };
  }

  const title = (
    trackObj.title ||
    trackObj.snippet?.title ||
    trackObj.name ||
    ''
  ).trim();

  if (!title) {
    return {
      isValid: false,
      reason: 'Empty title',
      songType: 'invalid',
      verificationStatus: 'rejected'
    };
  }

  const lowerTitle = title.toLowerCase();
  const lowerDesc = (
    trackObj.description ||
    trackObj.snippet?.description ||
    ''
  ).toLowerCase();
  const channel = (
    trackObj.channel ||
    trackObj.author?.name ||
    trackObj.snippet?.channelTitle ||
    ''
  ).trim();

  // 1. Duration Validation
  if (typeof trackObj.duration === 'number' && trackObj.duration > 0) {
    if (trackObj.duration > 900) { // > 15 minutes
      return {
        isValid: false,
        reason: `Duration (${trackObj.duration}s) exceeds 15 minutes compilation limit`,
        songType: 'compilation',
        verificationStatus: 'rejected_multi_song'
      };
    }
  }
  if (typeof trackObj.duration === 'string') {
    const colons = (trackObj.duration.match(/:/g) || []).length;
    if (colons >= 2) {
      return {
        isValid: false,
        reason: `Duration (${trackObj.duration}) is 1 hour or longer (compilation)`,
        songType: 'compilation',
        verificationStatus: 'rejected_multi_song'
      };
    }
    if (colons === 1) {
      const parts = trackObj.duration.split(':').map(p => parseInt(p, 10) || 0);
      if (parts[0] >= 15) {
        return {
          isValid: false,
          reason: `Duration (${trackObj.duration}) exceeds 15 minutes limit`,
          songType: 'compilation',
          verificationStatus: 'rejected_multi_song'
        };
      }
    }
  }

  // 2. Pattern Matching against exclusion regexes in title
  for (const regex of MULTI_SONG_TITLE_REGEXES) {
    if (regex.test(lowerTitle)) {
      return {
        isValid: false,
        reason: `Title matches multi-song exclusion pattern: ${regex}`,
        songType: 'multi_song_compilation',
        verificationStatus: 'rejected_multi_song'
      };
    }
  }

  // 2a. User-mandated Strict Blacklist words filter on title & description:
  // ['jukebox', 'mashup', 'best of', 'collection', 'non-stop', 'unplugged', 'hits of', 'top 50', 'latest hits', '2020', '2021', '2022', '2023', 'audio jukebox', 'full album']
  for (const regex of STRICT_BLACKLIST_REGEXES) {
    if (regex.test(lowerTitle)) {
      return {
        isValid: false,
        reason: `Title contains blacklisted term (${regex})`,
        songType: 'blacklisted_compilation',
        verificationStatus: 'rejected_multi_song'
      };
    }
    if (lowerDesc && regex.test(lowerDesc)) {
      return {
        isValid: false,
        reason: `Description contains blacklisted term (${regex})`,
        songType: 'blacklisted_compilation',
        verificationStatus: 'rejected_multi_song'
      };
    }
  }

  // 2b. Rule 3: Strict Rejection of AI-generated music, amateur covers, foreign drama clips, and junk
  for (const regex of AI_JUNK_AND_COVER_PATTERNS) {
    if (regex.test(lowerTitle) || regex.test(channel.toLowerCase()) || regex.test(lowerDesc)) {
      return {
        isValid: false,
        reason: `Rejected: AI-generated music, random cover, or drama clip detected (${regex})`,
        songType: 'junk_or_ai',
        verificationStatus: 'rejected_junk_or_ai'
      };
    }
  }

  // 2c. Generic "New Song" promotional title rejection (preserves legitimate song titles containing "New")
  for (const regex of GENERIC_NEW_SONG_REGEXES) {
    if (regex.test(title)) {
      return {
        isValid: false,
        reason: `Rejected: Generic promotional "New Song" title format (${regex})`,
        songType: 'generic_new_song',
        verificationStatus: 'rejected_generic_title'
      };
    }
  }

  // 2d. Strict Track Sanitizer: Shorts, ringtones, edits, dance/fitness clips, and duration <= 75s
  if (!isCleanMusicTrack(trackObj)) {
    return {
      isValid: false,
      reason: 'Rejected by Strict Track Sanitizer (Shorts, ringtone, edit, dance/fitness clip, or <= 75s)',
      songType: 'sanitizer_disqualified',
      verificationStatus: 'rejected_junk_or_ai'
    };
  }

  // 3. Multi-track forward slash listing: "Song A / Song B / Song C / Song D"
  const slashParts = title.split(/\s*\/\s*/);
  if (slashParts.length >= 4) {
    const hasOfficialSongIndicator = lowerTitle.includes('official') || lowerTitle.includes('video song') || lowerTitle.includes('full song');
    if (!hasOfficialSongIndicator) {
      return {
        isValid: false,
        reason: 'Title contains multiple track slash separators',
        songType: 'multi_track_listing',
        verificationStatus: 'rejected_multi_song'
      };
    }
  }

  // 4. Description inspection for multi-song tracklists and timestamps
  if (lowerDesc) {
    if (/\b(audio jukebox|full album songs|track list:|tracklist:|songs in this video:|all tracks:)\b/i.test(lowerDesc)) {
      if (/\b(album|collection|hits|songs|jukebox|vol|volume)\b/i.test(lowerTitle)) {
        return {
          isValid: false,
          reason: 'Description contains explicit tracklist for collection',
          songType: 'multi_song_compilation',
          verificationStatus: 'rejected_multi_song'
        };
      }
    }

    // Detect multiple song timestamps in description (e.g. "0:00 Song1 \n 3:45 Song2")
    const timestampMatches = lowerDesc.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g) || [];
    if (timestampMatches.length >= 4 && !lowerTitle.includes('official video') && !lowerTitle.includes('full song')) {
      return {
        isValid: false,
        reason: `Description contains ${timestampMatches.length} timestamp markers indicative of multi-track video`,
        songType: 'multi_track_compilation',
        verificationStatus: 'rejected_multi_song'
      };
    }
  }

  // Classification & Official Channel Check
  const official = isOfficialChannel(channel);
  const songType = classifySongType(title, channel);
  const verificationStatus = official ? 'verified_official' : 'verified_single_song';

  return {
    isValid: true,
    songType,
    verificationStatus,
    isOfficialChannel: official
  };
}

/**
 * Determines whether a track represents a single song rather than a compilation or album.
 */
export function isSingleSong(track) {
  const result = verifySingleSong(track);
  return result.isValid;
}

/**
 * Normalizes metadata into Loopra standard track schema with structured verification fields
 */
export function normalizeTrack(raw) {
  if (!raw) return null;

  const id = raw.id?.videoId || raw.id || raw.videoId || raw._id;
  if (!id || typeof id !== 'string') return null;

  const trimmedId = id.trim();

  // Clean title & channel
  let title = (raw.title || raw.snippet?.title || '').trim();
  title = title
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  let artist = (raw.artist || raw.channel || raw.snippet?.channelTitle || 'Unknown Artist').trim();
  artist = artist
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/VEVO|Official|Topic/gi, '').trim();

  const channel = (raw.channel || raw.snippet?.channelTitle || raw.author?.name || artist || 'Loopra Channel').trim();

  const candidateThumbnail = raw.thumbnail ||
    raw.image ||
    raw.snippet?.thumbnails?.high?.url ||
    raw.snippet?.thumbnails?.medium?.url ||
    raw.snippet?.thumbnails?.default?.url ||
    `https://i.ytimg.com/vi/${trimmedId}/hqdefault.jpg`;

  const thumbnail = isValidThumbnailUrlFormat(candidateThumbnail) ? candidateThumbnail : '';

  const verification = verifySingleSong({
    id: trimmedId,
    title,
    channel,
    duration: raw.duration,
    description: raw.description || raw.snippet?.description
  });

  return {
    id: trimmedId,
    videoId: trimmedId,
    title,
    artist: artist || 'Loopra Artist',
    channel,
    thumbnail,
    image: thumbnail,
    duration: raw.duration || '3:30',
    songType: verification.songType || 'individual_song',
    verificationStatus: verification.verificationStatus || 'verified_single_song',
    query: `${title} ${artist}`.trim()
  };
}

/**
 * Filters an array of tracks using the Loopra strict single-song pipeline:
 * 1. candidate normalization
 * 2. embeddability validation (valid YouTube ID)
 * 3. deduplication by videoId
 * 4. single-song validation (rejects mashups, medleys, jukeboxes, non-stop compilations)
 * 5. strict thumbnail validation (rejects empty, broken, or placeholder thumbnails)
 */
export function filterSingleSongs(tracks = []) {
  if (!Array.isArray(tracks)) return [];
  const seenIds = new Set();
  const qualified = [];

  for (const raw of tracks) {
    const track = normalizeTrack(raw);
    if (!track) continue;

    if (!isValidYouTubeId(track.id)) continue;
    if (seenIds.has(track.id)) continue;
    if (!isValidThumbnailUrlFormat(track.thumbnail)) continue;
    if (!isSingleSong(track)) continue;

    seenIds.add(track.id);
    qualified.push(track);
  }

  return qualified;
}

export default {
  verifySingleSong,
  isSingleSong,
  isCleanMusicTrack,
  isValidYouTubeId,
  classifySongType,
  isOfficialChannel,
  normalizeTrack,
  filterSingleSongs
};
