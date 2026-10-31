// Frontend Universal Track Identity & Deduplication Engine
// Guarantees zero duplicate songs across all homepage sections and carousels

export const VERSION_KEYWORDS = [
  'acoustic',
  'unplugged',
  'live',
  'remix',
  'club mix',
  'dj mix',
  'cover',
  'reprise',
  'slowed',
  'reverb',
  'instrumental',
  'orchestral',
  'lofi',
  'lo-fi',
  'mashup',
  'female version',
  'male version',
  'duet'
];

export const KNOWN_RECORD_LABELS = new Set([
  'tseries',
  'tseriesapnapunjab',
  'tseriesregional',
  'zeemusiccompany',
  'zeemusic',
  'sonymusicindia',
  'sonymusic',
  'sonymusicindiavevo',
  'yrf',
  'venus',
  'tipsofficial',
  'tips',
  'speedrecords',
  'erosnow',
  'saregamamusic',
  'saregama',
  'universalmusicindia',
  'universalmusic',
  'dmdesirnr',
  'adityamusic',
  'geetmp3',
  'desimusicfactory',
  'whitehillmusic',
  'jjustmusic'
]);

/**
 * Extracts a version descriptor if the track is a distinct recording.
 */
export function getVersionDescriptor(str = '') {
  const lower = (str || '').toLowerCase();
  for (const v of VERSION_KEYWORDS) {
    if (lower.includes(v)) {
      return v.replace(/[^a-z0-9]/g, '');
    }
  }
  return '';
}

/**
 * Normalizes song title for canonical identification.
 */
export function cleanSongTitle(str = '') {
  if (!str) return '';
  let title = String(str).toLowerCase();

  // Strip anything after pipe | or // or • which YouTube channels use for actor/video credits
  if (title.includes('|')) {
    title = title.split('|')[0].trim();
  } else if (title.includes('//')) {
    title = title.split('//')[0].trim();
  } else if (title.includes('•')) {
    title = title.split('•')[0].trim();
  }

  // Remove parenthetical noise like (From "Movie"), (Official Video), [4K], etc.
  title = title.replace(/\((?!acoustic|live|remix|unplugged|cover|reprise|instrumental|lofi).*?\)/gi, '');
  title = title.replace(/\[(?!acoustic|live|remix|unplugged|cover|reprise|instrumental|lofi).*?\]/gi, '');

  // Strip common YouTube boilerplate words
  title = title.replace(/official video|official music video|music video|lyric video|lyrical video|full song|audio song|video song|hd|4k|4k uhd|1080p|original soundtrack|soundtrack|ost|lyrics|lyric|visualizer|full audio|jukebox|audio|video/gi, '');

  // If there's still a hyphen e.g. "Song - Movie"
  if (title.includes(' - ')) {
    const parts = title.split(' - ').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      title = parts[0];
    }
  }

  return title.replace(/[^a-z0-9]/g, '').trim();
}

/**
 * Extracts artist tokens from artist string, channel name, or title.
 */
export function extractArtistTokens(track = {}) {
  const raw = `${track.artist || ''} ${track.channel || ''}`.toLowerCase();
  const tokens = [];

  const parts = raw.split(/[,&/|+]|ft\.?|feat\.?|featuring|with/i);
  for (const part of parts) {
    const cleaned = part.replace(/vevo|official|channel|topic|records/gi, '').replace(/[^a-z0-9]/g, '').trim();
    if (cleaned.length >= 2 && !KNOWN_RECORD_LABELS.has(cleaned)) {
      tokens.push(cleaned);
    }
  }

  return tokens;
}

/**
 * Cleans primary artist name, avoiding mistaken record label names.
 */
export function cleanArtistName(str = '', title = '') {
  let raw = (str || '').toLowerCase();

  const rawCleaned = raw.replace(/[^a-z0-9]/g, '');
  if (!raw || KNOWN_RECORD_LABELS.has(rawCleaned) || raw.includes('unknown') || raw.includes('various')) {
    const titleLower = (title || '').toLowerCase();
    const commonSingers = [
      'arijit singh', 'shreya ghoshal', 'pritam', 'ar rahman', 'a r rahman',
      'diljit dosanjh', 'kumar sanu', 'alka yagnik', 'udit narayan',
      'sonu nigam', 'kishore kumar', 'lata mangeshkar', 'badshah',
      'neha kakkar', 'jubin nautiyal', 'sachet tandon', 'jasleen royal',
      'ankit tiwari', 'mohit chauhan', 'anuv jain', 'prateek kuhad', 'kk'
    ];
    for (const singer of commonSingers) {
      if (titleLower.includes(singer)) {
        return singer.replace(/[^a-z0-9]/g, '');
      }
    }
  }

  return raw
    .split(/[,&|/+]|ft\.?|feat\.?|featuring/i)[0]
    .replace(/vevo|official|channel|topic|records/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Returns a stable, deterministic canonical song key.
 */
export function getCanonicalSongKey(track) {
  if (!track) return '';
  const titleStr = track.title || '';
  const artistStr = track.artist || track.channel || '';

  const version = getVersionDescriptor(`${titleStr} ${artistStr}`);
  const title = cleanSongTitle(titleStr);
  const artist = cleanArtistName(artistStr, titleStr);

  return `${title}__${artist}__${version}`;
}

/**
 * Rigorous identity check between two tracks.
 * Returns true if both represent the exact same recording.
 * Preserves genuine remixes, acoustic versions, and live performances.
 */
export function areTracksSame(trackA, trackB) {
  if (!trackA || !trackB) return false;

  const idA = trackA.id || trackA.videoId;
  const idB = trackB.id || trackB.videoId;
  if (idA && idB && idA === idB) return true;

  const titleA = trackA.title || '';
  const titleB = trackB.title || '';
  const verA = getVersionDescriptor(`${titleA} ${trackA.artist || ''}`);
  const verB = getVersionDescriptor(`${titleB} ${trackB.artist || ''}`);
  if (verA !== verB) {
    return false;
  }

  const keyA = getCanonicalSongKey(trackA);
  const keyB = getCanonicalSongKey(trackB);
  if (keyA && keyB && keyA === keyB) return true;

  const cleanA = cleanSongTitle(titleA);
  const cleanB = cleanSongTitle(titleB);

  if (cleanA && cleanB && cleanA === cleanB) {
    const tokensA = extractArtistTokens(trackA);
    const tokensB = extractArtistTokens(trackB);

    if (tokensA.length === 0 || tokensB.length === 0) {
      return cleanA.length >= 5;
    }

    const hasOverlap = tokensA.some(t => tokensB.includes(t)) ||
      tokensA.some(t => titleB.toLowerCase().includes(t)) ||
      tokensB.some(t => titleA.toLowerCase().includes(t));

    if (hasOverlap) return true;

    if (cleanA.length >= 7) return true;
  }

  return false;
}

/**
 * Universal TrackDeduplicator class for frontend coordination.
 */
export class TrackDeduplicator {
  constructor(initialTracks = []) {
    this.seenIds = new Set();
    this.seenKeys = new Set();
    this.seenTracks = [];

    if (Array.isArray(initialTracks)) {
      this.addAll(initialTracks);
    }
  }

  isDuplicate(track) {
    if (!track) return true;

    const id = track.id || track.videoId;
    if (id && this.seenIds.has(id)) return true;

    const key = getCanonicalSongKey(track);
    if (key && this.seenKeys.has(key)) return true;

    for (const seen of this.seenTracks) {
      if (areTracksSame(track, seen)) {
        return true;
      }
    }

    return false;
  }

  add(track) {
    if (!track) return false;

    const id = track.id || track.videoId;
    if (id) this.seenIds.add(id);

    const key = getCanonicalSongKey(track);
    if (key) this.seenKeys.add(key);

    this.seenTracks.push(track);
    return true;
  }

  addAll(tracks = []) {
    if (!Array.isArray(tracks)) return;
    for (const t of tracks) {
      this.add(t);
    }
  }

  filterUnique(tracks = []) {
    if (!Array.isArray(tracks)) return [];
    const unique = [];
    for (const track of tracks) {
      if (!this.isDuplicate(track)) {
        this.add(track);
        unique.push(track);
      }
    }
    return unique;
  }

  size() {
    return this.seenTracks.length;
  }

  getAllKeys() {
    return Array.from(this.seenKeys);
  }

  getAllIds() {
    return Array.from(this.seenIds);
  }
}

