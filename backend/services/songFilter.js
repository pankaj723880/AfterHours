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

// Known official artist and record label channel indicators
const OFFICIAL_CHANNELS = [
  't-series', 'tseries', 'sony music', 'sonymusic', 'zee music', 'zeemusic',
  'yrf', 'yash raj films', 'tips official', 'tips music', 'saregama', 'saregamamusic',
  'universal music', 'warner music', 'speed records', 'white hill music',
  'eros now', 'venus', 'aditya music', 'lahari music', 'geet mp3',
  'times music', 'svf music', 't-series apna punjab', 'panj-aab records'
];

// Multi-song title patterns that MUST ALWAYS be rejected
const MULTI_SONG_TITLE_REGEXES = [
  // Jukeboxes
  /\b(audio\s+jukebox|video\s+jukebox|album\s+jukebox|radio\s+jukebox|jukebox)\b/i,
  // Mashups
  /\b(mashup|mash\s+up|mash-up)\b/i,
  // Medleys
  /\b(medley|medly)\b/i,
  // Non-stop collections
  /\b(non[\s-]?stop|nonstop)\b/i,
  // Compilations
  /\b(compilation|song\s+compilation|remix\s+compilation|video\s+compilation|hits\s+compilation|remixes\s+compilation)\b/i,
  // Albums and complete collections
  /\b(full\s+album|complete\s+album|all\s+album\s+songs|album\s+songs)\b/i,
  /\b(all\s+songs|all\s+song|all\s+video\s+songs|songs\s+collection|song\s+collection|music\s+collection|hits\s+collection)\b/i,
  /\b(multiple\s+songs?|songs?\s+combined|all\s+songs?\s+in\s+one\s+video)\b/i,
  // Top / Best-of collections
  /\b(top\s*\d{1,4}\b)/i,
  /\b(best\s*\d{1,4}\b)/i,
  /\b(top\s+songs|best\s+songs)\b/i,
  /\b(greatest\s+hits\s+jukebox|golden\s+hits\s+collection|evergreen\s+hits\s+jukebox)\b/i,
  /\b(best\s+of\s+(?:19\d\d|20\d\d|90s|80s|70s|60s|2000s|2010s|2020s))\b/i,
  /\b(best\s+of\s+[a-z\s]+(jukebox|collection|songs|hits))\b/i,
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
      !/\b(compilation|nonstop|full\s+concert)\b/i.test(lower)) {
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

  const thumbnail = raw.thumbnail ||
    raw.image ||
    raw.snippet?.thumbnails?.high?.url ||
    raw.snippet?.thumbnails?.medium?.url ||
    raw.snippet?.thumbnails?.default?.url ||
    `https://i.ytimg.com/vi/${trimmedId}/hqdefault.jpg`;

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
  verifySingleSong,
  isSingleSong,
  isValidYouTubeId,
  classifySongType,
  isOfficialChannel,
  normalizeTrack,
  filterSingleSongs
};
