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

// Clean title of YouTube noise, feat tags, brackets, and common movie/single suffixes
export function cleanTitleForLyrics(rawTitle) {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/\s*[\(\[\{][^\)\]\}]*(?:official|audio|video|lyric|lyrics|full song|hd|4k|8k|remix|lofi|slowed|reverb|teaser|trailer|visualizer|short|mashup|jukebox|uhd|music video|feat|ft\.)[^\)\]\}]*[\)\]\}]/gi, '')
    .replace(/\s+(?:feat\.?|ft\.?)\s+.*$/gi, '')
    .replace(/\|.*$/g, '')
    .replace(/-?\s*by\s+.*$/gi, '')
    .replace(/from\s+["'][^"']+["']/gi, '')
    .replace(/\s*-\s*(?:official|audio|video|lyrics?|full song).*$/gi, '')
    .replace(/[^\w\s\u0900-\u097F'-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchLyrics(track, customQuery = null, forceRefresh = false) {
  if (!track || (!track.title && !customQuery)) return null;

  const trackName = customQuery ? customQuery.trim() : cleanTitleForLyrics(track.title);
  const artistName = track.artist || track.channel || '';
  const cleanArtist = artistName.replace(/vevo|official|channel|topic|records/gi, '').trim();
  const cacheKey = `${trackName}_${cleanArtist}`.toLowerCase();

  if (!forceRefresh && LYRICS_CACHE.has(cacheKey)) {
    return LYRICS_CACHE.get(cacheKey);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    // 1. Direct get attempt with track_name and artist_name
    if (!customQuery && cleanArtist.length > 2 && !cleanArtist.toLowerCase().includes('unknown')) {
      try {
        const params = new URLSearchParams({
          track_name: trackName,
          artist_name: cleanArtist
        });
        const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
          signal: controller.signal
        });
        if (res.ok) {
          clearTimeout(timeout);
          const data = await res.json();
          if (data && (data.syncedLyrics || data.plainLyrics)) {
            const hasSynced = Boolean(data.syncedLyrics);
            const lyricsPayload = {
              isSynced: hasSynced,
              plainLyrics: data.plainLyrics || null,
              syncedLines: hasSynced ? parseLrc(data.syncedLyrics) : [],
              trackName: data.trackName || trackName,
              artistName: data.artistName || cleanArtist,
              source: 'LRCLIB Verified'
            };
            LYRICS_CACHE.set(cacheKey, lyricsPayload);
            return lyricsPayload;
          }
        }
      } catch (e) {
        // Fall through to search query
      }
    }

    // 2. Search query fallback
    const searchQuery = customQuery || `${trackName} ${cleanArtist}`.trim();
    const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (Array.isArray(searchData) && searchData.length > 0) {
        // Pick best matching entry with synced lyrics if possible
        const best = searchData.find(item => item.syncedLyrics) || searchData[0];
        const hasSynced = Boolean(best.syncedLyrics);
        const lyricsPayload = {
          isSynced: hasSynced,
          plainLyrics: best.plainLyrics || null,
          syncedLines: hasSynced ? parseLrc(best.syncedLyrics) : [],
          trackName: best.trackName || trackName,
          artistName: best.artistName || cleanArtist,
          source: 'LRCLIB Public Catalogue'
        };
        LYRICS_CACHE.set(cacheKey, lyricsPayload);
        return lyricsPayload;
      }
    }

    // 3. Fallback search with trackName alone if artist was combined
    if (trackName.length > 2 && !customQuery) {
      const singleSearch = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(trackName)}`);
      if (singleSearch.ok) {
        const singleData = await singleSearch.json();
        if (Array.isArray(singleData) && singleData.length > 0) {
          const best = singleData.find(item => item.syncedLyrics) || singleData[0];
          const hasSynced = Boolean(best.syncedLyrics);
          const lyricsPayload = {
            isSynced: hasSynced,
            plainLyrics: best.plainLyrics || null,
            syncedLines: hasSynced ? parseLrc(best.syncedLyrics) : [],
            trackName: best.trackName || trackName,
            artistName: best.artistName || cleanArtist,
            source: 'LRCLIB Public Catalogue'
          };
          LYRICS_CACHE.set(cacheKey, lyricsPayload);
          return lyricsPayload;
        }
      }
    }
  } catch (err) {
    console.warn('[Lyrics Service] Fetch notice:', err.message);
  }

  return null;
}
