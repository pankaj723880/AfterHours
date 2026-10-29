/**
 * Loopra Lyrics Service
 * Fetches verified synchronized (.lrc) or plain lyrics from LRCLIB open public catalogue.
 * Automatically parses timestamped LRC lines [mm:ss.xx] for synchronized playback.
 */

const LYRICS_CACHE = new Map();

// Parse LRC format string "[00:12.34] lyric line"
export function parseLrc(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') return [];
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2}(?:\.\d+)?)\]/;

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const time = minutes * 60 + seconds;
      const text = line.replace(timeRegex, '').trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

// Clean title of YouTube suffixes like "(Official Video)", "Lyrical", "Full Song", etc.
export function cleanTitleForLyrics(rawTitle) {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/\s*[\(\[\{](?:official|audio|video|lyric|lyrics|full song|hd|4k|remix|lofi)[\)\]\}]/gi, '')
    .replace(/\|\s*.*$/g, '')
    .replace(/-?\s*by\s+.*$/gi, '')
    .trim();
}

export async function fetchLyrics(track) {
  if (!track || !track.title) return null;

  const trackName = cleanTitleForLyrics(track.title);
  const artistName = track.artist || track.channel || '';
  const cacheKey = `${trackName}_${artistName}`.toLowerCase();

  if (LYRICS_CACHE.has(cacheKey)) {
    return LYRICS_CACHE.get(cacheKey);
  }

  try {
    const params = new URLSearchParams({
      track_name: trackName,
    });
    if (artistName && artistName.length > 2 && !artistName.toLowerCase().includes('unknown')) {
      params.append('artist_name', artistName);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const hasSynced = Boolean(data.syncedLyrics);
      const lyricsPayload = {
        isSynced: hasSynced,
        plainLyrics: data.plainLyrics || null,
        syncedLines: hasSynced ? parseLrc(data.syncedLyrics) : [],
        trackName: data.trackName || trackName,
        artistName: data.artistName || artistName,
        source: 'LRCLIB'
      };
      LYRICS_CACHE.set(cacheKey, lyricsPayload);
      return lyricsPayload;
    }

    // Try search endpoint fallback if direct get didn't match exact title
    const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(trackName)}`);
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (Array.isArray(searchData) && searchData.length > 0) {
        const best = searchData[0];
        const hasSynced = Boolean(best.syncedLyrics);
        const lyricsPayload = {
          isSynced: hasSynced,
          plainLyrics: best.plainLyrics || null,
          syncedLines: hasSynced ? parseLrc(best.syncedLyrics) : [],
          trackName: best.trackName || trackName,
          artistName: best.artistName || artistName,
          source: 'LRCLIB'
        };
        LYRICS_CACHE.set(cacheKey, lyricsPayload);
        return lyricsPayload;
      }
    }
  } catch (err) {
    console.warn('[Lyrics Service] Fetch notice:', err.message);
  }

  return null;
}
