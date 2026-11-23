import mongoose from 'mongoose';
import CachedSong from '../models/CachedSong.js';
import UserMusicPreference from '../models/UserMusicPreference.js';
import CuratedCollection from '../models/CuratedCollection.js';
import { CORE_CATALOG_TRACKS, cleanArtistAndTitle, catalogService } from './catalogService.js';
import { isCleanMusicTrack } from './songFilter.js';
import { getCleanTrackThumbnail } from './thumbnailValidationService.js';
import { getCanonicalSongKey } from './recommendationHistoryService.js';

/**
 * Helper to parse duration into seconds.
 */
export function parseDurationSec(rawDuration) {
  if (typeof rawDuration === 'number' && !isNaN(rawDuration)) {
    return Math.max(0, rawDuration);
  }
  if (!rawDuration) return 0;
  const str = String(rawDuration).trim();
  if (str.startsWith('PT')) {
    const h = (str.match(/(\d+)H/) || [])[1] || 0;
    const m = (str.match(/(\d+)M/) || [])[1] || 0;
    const s = (str.match(/(\d+)S/) || [])[1] || 0;
    return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10);
  }
  const parts = str.split(':').map(p => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/**
 * Detect language based on artist and text keywords.
 */
export function detectTrackLanguage(text = '', artist = '') {
  const combined = `${artist} ${text}`.toLowerCase();
  if (/bhojpuri|pawan singh|khesari|silpi raj|ritesh pandey|manoj tiwari|nirahua|neelkamal|arvind akela|kallu|pramod premi|sharda sinha/i.test(combined)) return 'bhojpuri';
  if (/punjabi|sidhu|diljit|ap dhillon|karan aujla|shubh|amrit|bhangra|dhol|jatt/i.test(combined)) return 'punjabi';
  if (/haryanvi|sapna choudhary|renuka panwar|gulzaar|masoom sharma|diler|sumit goswami/i.test(combined)) return 'haryanvi';
  if (/bengali|bangla|rabindra|anupam roy|somlata/i.test(combined)) return 'bengali';
  if (/marathi|lavani|ajay atul|swapnil|avdhoot/i.test(combined)) return 'marathi';
  if (/bhajan|aarti|chalisa|krishna|shiva|ram|hanuman|devotional|mantra/i.test(combined)) return 'devotional';
  if (/tamil|anirudh|ar rahman tamil|kollywood|sid sriram tamil|yuvan/i.test(combined)) return 'tamil';
  if (/telugu|dsp|thaman|tollywood|sid sriram telugu/i.test(combined)) return 'telugu';
  if (/english|pop|taylor|ed sheeran|billie|dualipa|weekend|drake|coldplay|rock/i.test(combined)) return 'english';
  return 'hindi';
}

/**
 * Service to manage cached catalog songs and build personalized home feeds.
 */
export const personalizedFeedService = {
  /**
   * Upsert a track into the CachedSong collection.
   * Strictly enforces durationSec >= 75 and clean music track criteria.
   */
  async upsertSong(trackData) {
    if (!trackData) return null;
    const videoId = trackData.videoId || trackData.id;
    if (!videoId || typeof videoId !== 'string' || videoId.length < 5) return null;

    const { title, artist, channel } = cleanArtistAndTitle({
      title: trackData.title || '',
      artist: trackData.artist || '',
      channel: trackData.channel || ''
    });

    const durSec = parseDurationSec(
      trackData.durationSec !== undefined ? trackData.durationSec : (trackData.duration || trackData.seconds)
    );

    // Strictly enforce durationSec >= 75 (and <= 900 for single tracks)
    if (durSec > 0 && (durSec < 75 || durSec > 900)) {
      return null;
    }

    const testTrack = { ...trackData, title, artist, channel, durationSec: durSec };
    if (!isCleanMusicTrack(testTrack)) {
      return null;
    }

    const cleanThumb = getCleanTrackThumbnail(trackData.thumbnail || trackData.image, videoId);
    const lang = trackData.language || detectTrackLanguage(title, artist);

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        return await CachedSong.findOneAndUpdate(
          { videoId },
          {
            $set: {
              title,
              artist,
              channel: channel || artist,
              thumbnail: cleanThumb,
              durationSec: durSec > 0 ? durSec : 210,
              durationStr: trackData.duration || `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, '0')}`,
              genre: trackData.genre || 'Bollywood',
              mood: trackData.mood || 'Melodic',
              language: lang,
              isCleanSingleSong: true,
              lastPlayedAt: new Date()
            },
            $inc: { playCount: 1 }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  /**
   * Bulk upsert tracks (e.g. from search results or curated collections).
   */
  async bulkUpsertSongs(tracks = []) {
    if (!Array.isArray(tracks) || tracks.length === 0) return 0;
    let saved = 0;
    for (const t of tracks) {
      const res = await this.upsertSong(t);
      if (res) saved++;
    }
    return saved;
  },

  /**
   * Seeds foundational core catalog tracks into CachedSong on first run.
   */
  async ensureCoreCatalogSeeded() {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
    try {
      const count = await CachedSong.countDocuments();
      if (count >= 15) return;

      for (const track of CORE_CATALOG_TRACKS) {
        await this.upsertSong({
          ...track,
          durationSec: 215,
          duration: '3:35',
          language: 'hindi'
        });
      }
    } catch (_) {}
  },

  /**
   * Generates a personalized home feed tailored to the user/guest while minimizing YouTube quota.
   */
  async getPersonalizedHomeFeed({ userId = null, guestId = null, limit = 12 } = {}) {
    await this.ensureCoreCatalogSeeded();

    let pref = null;
    const query = {};
    if (userId) {
      query.userId = userId;
    } else if (guestId) {
      query.guestId = guestId;
    }

    if (Object.keys(query).length > 0 && mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        pref = await UserMusicPreference.findOne(query).lean();
      } catch (_) {}
    }

    const topArtists = (pref?.topArtists || []).map(a => a.name).filter(Boolean);
    const topGenres = (pref?.topGenres || []).map(g => g.name).filter(Boolean);
    const preferredLangs = (pref?.preferredLanguages || []).map(l => l.name).filter(Boolean);
    const recentTrackIds = new Set((pref?.recentTracks || []).map(t => t.trackId));
    const dislikedTrackIds = new Set(pref?.dislikedTrackIds || []);

    const userAffinityLang = preferredLangs[0] || 'hindi';

    // 1. Fetch matching tracks from CachedSong (durationSec >= 75)
    let cachedCandidates = [];
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        cachedCandidates = await CachedSong.find({
          durationSec: { $gte: 75 },
          isCleanSingleSong: true
        })
        .sort({ playCount: -1, lastPlayedAt: -1 })
        .limit(80)
        .lean();
      } catch (_) {}
    }

    // 2. Also retrieve published curated collection tracks
    let curatedCandidates = [];
    try {
      const collections = await CuratedCollection.find({ isPublished: true }).lean();
      for (const col of collections) {
        if (Array.isArray(col.tracks)) {
          for (const t of col.tracks) {
            if (!t.isHidden) {
              curatedCandidates.push({
                id: t.id || t.videoId,
                videoId: t.videoId || t.id,
                title: t.title,
                artist: t.artist,
                thumbnail: t.thumbnail,
                durationSec: parseDurationSec(t.duration) || 210,
                duration: t.duration || '3:30',
                genre: col.category || 'Featured',
                language: 'hindi'
              });
            }
          }
        }
      }
    } catch (_) {}

    // Fall back to CORE_CATALOG_TRACKS if empty
    if (cachedCandidates.length === 0 && curatedCandidates.length === 0) {
      curatedCandidates = CORE_CATALOG_TRACKS.map(t => ({
        ...t,
        durationSec: 215,
        duration: '3:35',
        language: 'hindi'
      }));
    }

    // Merge and score candidate tracks
    const allPool = [...cachedCandidates, ...curatedCandidates];
    const scoredTracks = [];
    const seenIds = new Set();
    const seenKeys = new Set();

    for (const track of allPool) {
      const id = track.videoId || track.id;
      if (!id || seenIds.has(id)) continue;
      if (dislikedTrackIds.has(id)) continue;

      const dur = parseDurationSec(track.durationSec !== undefined ? track.durationSec : track.duration);
      if (dur > 0 && dur < 75) continue; // STRICT >= 75s

      const key = getCanonicalSongKey(track);
      if (key && seenKeys.has(key)) continue;

      let score = 5; // Base score

      // Score artist affinity
      const artistLower = (track.artist || '').toLowerCase();
      const artistMatch = topArtists.findIndex(a => artistLower.includes(a.toLowerCase()));
      if (artistMatch !== -1) {
        score += Math.max(10, 30 - artistMatch * 3);
      }

      // Score language affinity
      const trackLang = (track.language || detectTrackLanguage(track.title, track.artist)).toLowerCase();
      if (preferredLangs.length > 0) {
        if (preferredLangs.some(l => l.toLowerCase() === trackLang)) {
          score += 15;
        }
      } else if (trackLang === 'hindi') {
        score += 8;
      }

      // Penalize recently played to ensure fresh feeds
      if (recentTrackIds.has(id)) {
        score -= 15;
      }

      score += Math.min(10, (track.playCount || 0) * 2);

      seenIds.add(id);
      if (key) seenKeys.add(key);

      const cleanThumb = getCleanTrackThumbnail(track.thumbnail || track.image, id);
      scoredTracks.push({
        id,
        videoId: id,
        title: track.title,
        artist: track.artist || 'Loopra Artist',
        channel: track.channel || track.artist || 'Loopra Artist',
        image: cleanThumb,
        thumbnail: cleanThumb,
        duration: track.duration || track.durationStr || '3:30',
        durationSec: dur || 210,
        score
      });
    }

    scoredTracks.sort((a, b) => b.score - a.score);

    // Section 1: Trending Songs (Expand pool to at least 24 items and shuffle)
    let trendingPool = scoredTracks.slice(0, Math.max(limit * 2, 24));
    if (trendingPool.length < 6) {
      try {
        const topArtist = topArtists[0] || 'Arijit Singh';
        const freshYouTubeTracks = await catalogService.fetchDynamicCandidates(
          [`${topArtist} hit songs official video -shorts -#shorts -ringtone`],
          15
        );
        for (const ytTrack of freshYouTubeTracks) {
          const res = await this.upsertSong(ytTrack);
          if (res) {
            const cleanThumb = getCleanTrackThumbnail(res.thumbnail, res.videoId);
            trendingPool.push({
              id: res.videoId,
              videoId: res.videoId,
              title: res.title,
              artist: res.artist,
              channel: res.channel,
              image: cleanThumb,
              thumbnail: cleanThumb,
              duration: res.durationStr || '3:30',
              durationSec: res.durationSec || 210,
              score: 20
            });
          }
        }
      } catch (_) {}
    }

    // Shuffle helper (Fisher-Yates)
    const shuffleArray = (arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const trending = shuffleArray(trendingPool);

    // Section 2: Popular Albums (Bollywood / Melodic / Soundtracks) - Expand & Shuffle
    const albumsCandidates = scoredTracks.slice(limit, Math.max(limit * 3, 30));
    const albumsPool = albumsCandidates.length >= 4 ? albumsCandidates : scoredTracks.slice(0, Math.max(limit * 2, 20));
    const albums = shuffleArray(albumsPool);

    // Section 3: Popular Radio (Acoustic / Unplugged / Lofi) - Expand & Shuffle
    const radioCandidates = scoredTracks.slice(limit * 2, Math.max(limit * 4, 30));
    const radioPool = radioCandidates.length >= 4 ? radioCandidates : scoredTracks.slice(0, Math.max(limit * 2, 20));
    const radio = shuffleArray(radioPool);

    return {
      success: true,
      userType: userId ? 'authenticated' : (guestId ? 'guest' : 'anonymous'),
      hasPersonalization: Boolean(pref && (topArtists.length > 0 || (pref.recentTracks || []).length > 0)),
      trendingSongs: trending.slice(0, limit),
      popularAlbums: albums.slice(0, limit),
      popularRadio: radio.slice(0, limit),
      trendingPoolSize: trending.length,
      popularAlbumsPoolSize: albums.length
    };
  }
};
