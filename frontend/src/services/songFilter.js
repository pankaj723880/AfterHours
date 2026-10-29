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

// Regex for multi-song titles and collections
const MULTI_SONG_TITLE_REGEXES = [
  /\b(audio\s+jukebox|video\s+jukebox|jukebox)\b/i,
  /\b(full\s+album|complete\s+album|all\s+album\s+songs|album\s+jukebox)\b/i,
  /\b(all\s+songs|all\s+song|all\s+video\s+songs|songs\s+collection|song\s+collection|music\s+collection)\b/i,
  /\b(mashup|mash\s+up|mash-up)\b/i,
  /\b(medley|medly)\b/i,
  /\b(non[\s-]?stop|nonstop)\b/i,
  /\b(compilation|song\s+compilation)\b/i,
  /\b(top\s*\d{1,4}\s*(songs?|tracks?|hits?|romantic|bollywood|punjabi|retro|classics?)?)\b/i,
  /\b(best\s*\d{1,4}\s*(songs?|tracks?|hits?|romantic|bollywood|punjabi|retro|classics?)?)\b/i,
  /\b(greatest\s+hits\s+jukebox|golden\s+hits\s+collection|evergreen\s+hits\s+jukebox)\b/i,
  /\b(best\s+of\s+(?:19\d\d|20\d\d|90s|80s|70s|60s|2000s|2010s|2020s))\b/i,
  /\b(best\s+of\s+[a-z\s]+(jukebox|collection|songs|hits))\b/i,
  /\b(\d+\s*hours?|\d+\s*hrs?|\d+hr)\b/i,
  /\b(back\s*to\s*back|back\s*2\s*back|\bb2b\b)\b/i,
  /\b(party\s+mix|dj\s+mix|club\s+mix|megamix|mega\s+mix|remix\s+compilation)\b/i,
  /\b(continuous\s+music)\b/i,
  /\b(karaoke\s+collection|multiple\s+songs?\s+karaoke)\b/i,
  /\b(1\.\s+.*\b2\.\s+.*\b3\.\s+)/i // numbered multi-song track listing
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
  isValidYouTubeId,
  normalizeTrack,
  filterSingleSongs
};
