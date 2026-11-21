/**
 * Loopra Single-Song Identification & Filtering Engine (Frontend)
 * 
 * Enforces strict single-song filtering across all Loopra discovery surfaces:
 * - Search results
 * - Discover Swipe deck
 * - 100-song Shuffle pool
 * - Mood-to-Music AI recommendations
 * - Home & Categorized recommendations
 * - Nostalgia Radio & Playlists
 * 
 * Exclusion criteria:
 * - Full albums, audio jukeboxes, video jukeboxes
 * - Mashups, medleys, non-stop mixes, mega mixes
 * - 1h/2h/3h+ compilations and continuous music
 * - "Top 10/20/50/100 Songs", "Best of [Artist/Year]" collections
 * - Multiple song karaoke packs
 * - Tracks exceeding 15 minutes (900 seconds)
 * 
 * Preservation criteria:
 * - Genuine single songs (Hindi, Bollywood, Punjabi, Retro, Ghazals, English, etc.)
 * - Official music videos, lyric videos, acoustic / unplugged singles
 * - Bollywood "Full Video Song" / "Full Song" singles (not full album)
 */

// Regex for multi-song titles, mashups, and non-original compilations
// Strictly excludes: ['jukebox', 'mashup', 'best of', 'collection', 'non-stop', 'hits of', 'top 50', 'latest hits', 'audio jukebox', 'full album']
// Preserves legitimate individual unplugged versions
const MULTI_SONG_TITLE_REGEXES = [
  /\b(audio\s+jukebox|video\s+jukebox|album\s+jukebox|radio\s+jukebox|jukebox)\b/i,
  /(?:mega\s+mashup|non[\s-]?stop\s+mashup|mashup|mash\s+up|mash-up|\w*mashup)/i,
  /\b(best\s+of)\b/i,
  /\b(collections?|songs?\s+collections?|beats?\s+collections?|music\s+collections?|hits\s+collections?|tracks?\s+collections?|best\s+collection)\b/i,
  /\b(non[\s-]?stop|nonstop)\b/i,
  /\b(hits\s+of)\b/i,
  /\b(top\s*50\b|top\s*\d{1,4}\b)/i,
  /\b(latest\s+hits)\b/i,
  /\b(full\s+album|complete\s+album|all\s+album\s+songs|album\s+songs|album\s+jukebox)\b/i,
  /\b(unplugged\s+(?:jukebox|mashup|collection|non[\s-]?stop|songs|hits)|(?:collection|jukebox|mashup|non[\s-]?stop|top|best)\s+.*unplugged)\b/i,
  /\b(?:2020|2021|2022|2023)\s+(?:jukebox|mashup|collection|non[\s-]?stop|hits|songs|compilation|playlist|full\s+album)\b/i,
  /\b(?:jukebox|mashup|collection|non[\s-]?stop|top\s*\d+|best\s+of|latest\s+hits|all\s+songs|compilation|full\s+album)\s+.*(?:2020|2021|2022|2023)\b/i,
  /\b(all\s+songs|all\s+song|all\s+video\s+songs|songs\s+collection|song\s+collection|music\s+collection|hits\s+collection)\b/i,
  /\b(multiple\s+songs?|songs?\s+combined|all\s+songs?\s+in\s+one\s+video|multiple\s+tracks?)\b/i,
  /\b(mixtape|mix-tape|mix\s+tape)\b/i,
  /\b(medley|medly)\b/i,
  /\b(compilation|song\s+compilation|remix\s+compilation|video\s+compilation|hits\s+compilation)\b/i,
  /\b(best\s*\d{1,4}\b)/i,
  /\b(top\s+songs|best\s+songs|superhit\s+songs|greatest\s+hits)\b/i,
  /\b(greatest\s+hits\s+jukebox|golden\s+hits\s+collection|evergreen\s+hits\s+jukebox)\b/i,
  /\b(complete\s+discography|discography)\b/i,
  /\b([a-z0-9\s]+songs\s*\|\s*top\s+[a-z0-9\s]+songs?)\b/i,
  // Multi-song Lofi and Chill compilations (e.g. "Lofi Mix", "Chill Beats Mix", "Study Mix")
  /\b(lofi\s+mix|lo-fi\s+mix|chill\s+(?:beats\s+)?mix|study\s+mix|relaxing\s+mix|sleep\s+mix)\b/i,
  /\b(\d+\s*hours?|\d+\s*hrs?|\d+hr)\b/i,
  /\b(back\s*to\s*back|back\s*2\s*back|\bb2b\b)\b/i,
  /\b(party\s+mix|dj\s+mix|club\s+mix|megamix|mega\s+mix|remix\s+compilation)\b/i,
  /\b(continuous\s+(music|mix|playback|stream))\b/i,
  /\b(karaoke\s+collection|multiple\s+songs?\s+karaoke)\b/i,
  /\b(mega\s*mix|megamix)\b/i,
  /\b(1\.\s+.*\b2\.\s+.*\b3\.\s+)/i // numbered multi-song track listing
];

// Explicit blacklist words that disqualify a video when found in title or description
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
export const SHORTS_TAGS_AND_KEYWORDS = [
  /#shorts?\b/i,
  /\b(?:yt\s*shorts?|youtube\s*shorts?|viralshorts?|shorts)\b/i,
  /\bshort\s+(?:video|clip|edit|ver|version)\b/i
];

export const RINGTONE_AND_EDIT_PATTERNS = [
  /\b(?:phone\s+|mobile\s+)?ringtones?\b/i,
  /\bcaller\s*tunes?\b/i,
  /\bwhatsapp\s+status\b/i,
  /\bstatus\s+videos?\b/i,
  /\big\s+reels?\b/i,
  /\breels?\b/i,
  /\bedits?\b/i,
  /\bvoice\s+comparison\b/i,
  /\bvs\b/i,
  /\bsong\s+ideas?\b/i,
  /\banniversary\b/i,
  /\bbeach\b/i,
  /\bkaraoke\b/i,
  /\binstrumental\s+only\b/i,
  /\bbhat\s+geet\b/i,
  /\bbanni\s+geet\b/i
];

export const DANCE_FITNESS_CLIP_PATTERNS = [
  /\bdance\s+cover\b/i,
  /\bdance\s+performance\b/i,
  /\bcouple\s+dance\b/i,
  /\bzumba\b/i,
  /\bfitness\s+dance\b/i,
  /\bdancers?\b/i,
  /\bringtonix\b/i,
  /\bsayyed\s+ismail\b/i,
  /\bfact\s+boy\b/i,
  /\bcinemix\b/i
];

/**
 * Strict Track Sanitizer:
 * Validates whether a track is a clean genuine music track and NOT:
 * - Shorts (#shorts, #short, yt shorts, youtube shorts, viralshort, shorts)
 * - Ringtones & edits (ringtone, phone ringtone, mobile ringtone, caller tune, whatsapp status, status video, ig reel, reels, edit, voice comparison, vs, song ideas, anniversary, beach, karaoke, instrumental only, bhat geet, banni geet)
 * - Dance / fitness / clip channels or titles (dance cover, dance performance, couple dance, zumba, fitness dance, dancer, ringtonix, sayyed ismail, fact boy, cinemix, karaoke)
 * - Short-form duration tracks (durationSec > 0 && durationSec <= 75)
 */
export function isCleanMusicTrack(track) {
  if (!track) return false;

  const title = (
    track.title ||
    track.snippet?.title ||
    track.name ||
    ''
  ).trim();

  if (!title) return false;

  const channel = (
    track.channel ||
    track.artist ||
    track.author?.name ||
    track.snippet?.channelTitle ||
    ''
  ).trim();

  const desc = (
    track.description ||
    track.snippet?.description ||
    ''
  ).trim();

  const metadata = `${title} ${channel} ${desc}`;

  // 1. Shorts tags or keywords
  for (const regex of SHORTS_TAGS_AND_KEYWORDS) {
    if (regex.test(metadata)) return false;
  }

  // 2. Ringtones and edits
  for (const regex of RINGTONE_AND_EDIT_PATTERNS) {
    if (regex.test(metadata)) return false;
  }

  // 3. Dance / fitness / clip channels or titles
  for (const regex of DANCE_FITNESS_CLIP_PATTERNS) {
    if (regex.test(metadata)) return false;
  }

  // 4. Short-form duration check (durationSec > 0 && durationSec <= 75)
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

// Non-music and generic spam anti-patterns (Challenges, Quizzes, Gaming, Vlogs, Tutorials, News, Generic "New Song")
export const NON_MUSIC_DISQUALIFIERS = [
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
  /\b(with\s+background\s+music|background\s+music\s+for\s+(?:gaming|study|vlog)|bgm\s+for\s+vlogs?)\b/i,
  // AI-generated junk & synthetic voices
  /\b(ai\s+generated|ai\s+cover|ai\s+song|ai\s+music|ai\s+version|suno(?:\.ai)?|udio(?:\.ai)?|voicify|deepfake\s+music)\b/i,
  // Foreign drama clips & status edits
  /\b(kdrama\s+edit|k-drama|c-drama|drama\s+scene|chinese\s+drama|pakistani\s+drama|whatsapp\s+status\s+video|shorts\s+video|status\s+video|reel\s+edit)\b/i
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

/**
 * Validates whether a track ID is a genuine, embeddable YouTube video ID
 */
export function isValidYouTubeId(id) {
  if (!id || typeof id !== 'string') return false;
  // YouTube video IDs are exactly 11 characters (base64url: letters, digits, _, -)
  return /^[a-zA-Z0-9_-]{11}$/.test(id.trim());
}

/**
 * Determines whether a track represents a single song rather than a compilation or album
 */
export function isSingleSong(track) {
  if (!track) return false;

  const title = (
    track.title ||
    track.snippet?.title ||
    track.name ||
    ''
  ).trim();

  if (!title) return false;

  const lowerTitle = title.toLowerCase();
  const lowerDesc = (
    track.description ||
    track.snippet?.description ||
    ''
  ).toLowerCase();

  // 1. Duration validation
  if (typeof track.duration === 'number' && track.duration > 0) {
    if (track.duration > 900) return false; // > 15 mins
  }
  if (typeof track.duration === 'string') {
    const colons = (track.duration.match(/:/g) || []).length;
    if (colons >= 2) return false; // >= 1 hour
    if (colons === 1) {
      const parts = track.duration.split(':').map(p => parseInt(p, 10) || 0);
      if (parts[0] >= 15) return false; // >= 15 minutes
    }
  }

  // 2. Pattern Matching against exclusion regexes
  for (const regex of MULTI_SONG_TITLE_REGEXES) {
    if (regex.test(lowerTitle)) {
      return false;
    }
  }

  // 2a. Strict Blacklist words filter on title & description
  for (const regex of STRICT_BLACKLIST_REGEXES) {
    if (regex.test(lowerTitle)) return false;
    if (lowerDesc && regex.test(lowerDesc)) return false;
  }

  // 2b. Non-Music Disqualifiers (Challenges, Quizzes, Gaming, Vlogs, Tutorials, News, Background music)
  for (const regex of NON_MUSIC_DISQUALIFIERS) {
    if (regex.test(lowerTitle)) return false;
    if (lowerDesc && regex.test(lowerDesc)) return false;
  }

  // 2c. Generic "New Song" promotional title rejection (preserves legitimate song titles with "New")
  for (const regex of GENERIC_NEW_SONG_REGEXES) {
    if (regex.test(title)) return false;
  }

  // 2d. Strict Track Sanitizer: Shorts, ringtones, edits, dance/fitness clips, and duration <= 75s
  if (!isCleanMusicTrack(track)) {
    return false;
  }

  // 3. Multi-track listing checks in title
  // Forward slash separates multiple songs: "Song A / Song B / Song C / Song D"
  const slashParts = title.split(/\s*\/\s*/);
  if (slashParts.length >= 4) {
    const hasOfficialSongIndicator = lowerTitle.includes('official') || lowerTitle.includes('video song') || lowerTitle.includes('full song');
    if (!hasOfficialSongIndicator) {
      return false;
    }
  }

  // 4. Description checks for explicit tracklists
  if (lowerDesc) {
    if (/\b(audio jukebox|full album songs|track list:|tracklist:)\b/i.test(lowerDesc)) {
      if (/\b(album|collection|hits|songs|jukebox)\b/i.test(lowerTitle)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Normalizes metadata into Loopra standard track schema
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

  const thumbnail = raw.thumbnail ||
    raw.image ||
    raw.snippet?.thumbnails?.high?.url ||
    raw.snippet?.thumbnails?.medium?.url ||
    raw.snippet?.thumbnails?.default?.url ||
    `https://i.ytimg.com/vi/${trimmedId}/hqdefault.jpg`;

  return {
    id: trimmedId,
    videoId: trimmedId,
    title,
    artist: artist || 'Loopra Artist',
    channel: raw.channel || raw.snippet?.channelTitle || artist || 'Loopra Channel',
    thumbnail,
    image: thumbnail,
    duration: raw.duration,
    query: `${title} ${artist}`.trim()
  };
}

/**
 * Filters an array of tracks using the 7-step pipeline:
 * 1. candidate normalization
 * 2. embeddability validation (valid YouTube ID)
 * 3. deduplication by videoId
 * 4. single-song validation
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
    if (!isSingleSong(track)) continue;

    seenIds.add(track.id);
    qualified.push(track);
  }

  return qualified;
}

export default {
  isSingleSong,
  isCleanMusicTrack,
  isValidYouTubeId,
  normalizeTrack,
  filterSingleSongs
};
