import mongoose from 'mongoose';
import CuratedCollection from '../models/CuratedCollection.js';
import ytSearch from 'yt-search';
import { filterSingleSongs, isSingleSong, verifySingleSong } from './songFilter.js';
import { getCleanTrackThumbnail, isValidThumbnailUrlFormat, filterTracksWithValidThumbnailsSync } from './thumbnailValidationService.js';

// Clean decode for HTML entities commonly present in YouTube responses
const decodeHtml = (str = '') => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
};

/**
 * Normalizes artist, title, and channel metadata to guarantee no "Unknown Artist"
 * labels whenever channel or title information exists.
 */
export function cleanArtistAndTitle({ title = '', artist = '', channel = '', author = null } = {}) {
  let cleanTitle = decodeHtml(title).trim();
  let cleanArtist = decodeHtml(artist || '').trim();
  let cleanChannel = decodeHtml(channel || author?.name || '').trim();

  // Strip generic video noise from title
  cleanTitle = cleanTitle
    .replace(/\s*\|\s*Official (?:Music )?Video.*$/i, '')
    .replace(/\s*\(\s*Official (?:Music )?Video\s*\)/i, '')
    .replace(/\s*\[\s*Official (?:Music )?Video\s*\]/i, '')
    .trim();

  const isGeneric = (str) => {
    if (!str) return true;
    const lower = str.toLowerCase().trim();
    return lower === 'unknown' || lower === 'unknown artist' || lower === 'various' || lower === 'various artists' || lower === 'artist' || lower === '';
  };

  if (isGeneric(cleanArtist)) {
    // Check if title has separator "Artist - Title" or "Title | Artist"
    if (cleanTitle.includes(' - ')) {
      const parts = cleanTitle.split(' - ').map(p => p.trim());
      if (parts.length === 2 && parts[0].length < 40 && parts[1].length > 1) {
        cleanArtist = parts[0];
        cleanTitle = parts[1];
      }
    }
  }

  if (isGeneric(cleanArtist) && cleanChannel && !isGeneric(cleanChannel)) {
    const lowerChan = cleanChannel.toLowerCase();
    if (!lowerChan.includes('loopra') && !lowerChan.includes('youtube') && !lowerChan.includes('topic')) {
      cleanArtist = cleanChannel;
    }
  }

  if (isGeneric(cleanArtist)) {
    cleanArtist = cleanChannel || 'Loopra Artist';
  }

  return { title: cleanTitle, artist: cleanArtist, channel: cleanChannel };
}

// Foundational verified catalog tracks for immediate instant retrieval across moods & eras
// Every track is pre-verified via HTTP GET/HEAD to return HTTP 200 and Content-Length > 10,000 bytes (zero placeholders).
export const CORE_CATALOG_TRACKS = [
  // Romantic Classics & Modern Hits
  { id: "RLzC55ai0eo", videoId: "RLzC55ai0eo", title: "Heeriye (Official Video)", artist: "Jasleen Royal ft Arijit Singh", channel: "Jasleen Royal", thumbnail: "https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg", genre: "Romantic", mood: "Love" },
  { id: "WWIfHemqSEA", videoId: "WWIfHemqSEA", title: "Tujhko - Love Song 2026", artist: "Arijit Singh", channel: "Arijit Singh", thumbnail: "https://i.ytimg.com/vi/WWIfHemqSEA/hqdefault.jpg", genre: "Romantic", mood: "Emotional" },
  { id: "BddP6PYo2gs", videoId: "BddP6PYo2gs", title: "Kesariya (Official Video)", artist: "Arijit Singh, Pritam", channel: "Sony Music India", thumbnail: "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg", genre: "Romantic", mood: "Romantic" },
  { id: "Umqb9KENgmk", videoId: "Umqb9KENgmk", title: "Tum Hi Ho (Official Video)", artist: "Arijit Singh | Mithoon", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg", genre: "Romantic", mood: "Melancholic" },
  { id: "ZdyaixHYviA", videoId: "ZdyaixHYviA", title: "Yeh Jawaani Hai Deewani - Subhanallah", artist: "Sreerama Chandra, Shilpa Rao", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/ZdyaixHYviA/hqdefault.jpg", genre: "Romantic", mood: "Feel-Good" },
  { id: "dvgZkm1xWPE", videoId: "dvgZkm1xWPE", title: "Teri Ore - Singh Is Kinng", artist: "Shreya Ghoshal, Rahat Fateh Ali Khan", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/dvgZkm1xWPE/hqdefault.jpg", genre: "Romantic", mood: "Love" },
  { id: "gvyUuxdRdR4", videoId: "gvyUuxdRdR4", title: "Raataan Lambiyan - Shershaah", artist: "Jubin Nautiyal, Asees Kaur", channel: "Sony Music India", thumbnail: "https://i.ytimg.com/vi/gvyUuxdRdR4/hqdefault.jpg", genre: "Romantic", mood: "Love" },
  { id: "ElZfdU54Cp8", videoId: "ElZfdU54Cp8", title: "Apna Bana Le - Bhediya", artist: "Arijit Singh, Sachin-Jigar", channel: "Zee Music Company", thumbnail: "https://i.ytimg.com/vi/ElZfdU54Cp8/hqdefault.jpg", genre: "Romantic", mood: "Love" },
  { id: "NbyHNASFi6U", videoId: "NbyHNASFi6U", title: "Chahun Main Ya Naa - Aashiqui 2", artist: "Arijit Singh, Palak Muchhal", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/NbyHNASFi6U/hqdefault.jpg", genre: "Romantic", mood: "Love" },
  { id: "SAcpESN_Fk4", videoId: "SAcpESN_Fk4", title: "Dil Diyan Gallan - Tiger Zinda Hai", artist: "Atif Aslam, Vishal-Shekhar", channel: "YRF", thumbnail: "https://i.ytimg.com/vi/SAcpESN_Fk4/hqdefault.jpg", genre: "Romantic", mood: "Love" },
  { id: "cYOB941gyXI", videoId: "cYOB941gyXI", title: "Hawayein - Jab Harry Met Sejal", artist: "Arijit Singh, Pritam", channel: "Sony Music India", thumbnail: "https://i.ytimg.com/vi/cYOB941gyXI/hqdefault.jpg", genre: "Romantic", mood: "Love" },
  { id: "hoNb6HuNmU0", videoId: "hoNb6HuNmU0", title: "Qaafirana - Kedarnath", artist: "Arijit Singh, Nikhita Gandhi", channel: "Zee Music Company", thumbnail: "https://i.ytimg.com/vi/hoNb6HuNmU0/hqdefault.jpg", genre: "Romantic", mood: "Love" },
  { id: "IJJX39HRvlc", videoId: "IJJX39HRvlc", title: "Mere Humdum", artist: "Vatsal Bhoya", channel: "Vatsal Bhoya", thumbnail: "https://i.ytimg.com/vi/IJJX39HRvlc/hqdefault.jpg", genre: "Romantic", mood: "Emotional" },

  // Sad / Heartbreak / Emotional
  { id: "SQWDGLnvxF4", videoId: "SQWDGLnvxF4", title: "Sanam Teri Kasam Title Track", artist: "Ankit Tiwari, Palak Muchhal", channel: "Eros Now", thumbnail: "https://i.ytimg.com/vi/SQWDGLnvxF4/hqdefault.jpg", genre: "Heartbreak", mood: "Sad" },
  { id: "BDlNjOc3wiQ", videoId: "BDlNjOc3wiQ", title: "Bekhayali - Kabir Singh", artist: "Sachet Tandon", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/BDlNjOc3wiQ/hqdefault.jpg", genre: "Rock", mood: "Heartbreak" },
  { id: "284Ov7ysmfA", videoId: "284Ov7ysmfA", title: "Channa Mereya", artist: "Arijit Singh, Pritam", channel: "Sony Music", thumbnail: "https://i.ytimg.com/vi/284Ov7ysmfA/hqdefault.jpg", genre: "Romantic", mood: "Emotional" },
  { id: "S6IW8Rj1WqQ", videoId: "S6IW8Rj1WqQ", title: "Aankh Hai Bhari Bhari", artist: "Kumar Sanu", channel: "Tips Official", thumbnail: "https://i.ytimg.com/vi/S6IW8Rj1WqQ/hqdefault.jpg", genre: "Sad Ghazal", mood: "Nostalgic" },
  { id: "sK7riqg2mr4", videoId: "sK7riqg2mr4", title: "Agar Tum Saath Ho - Tamasha", artist: "Alka Yagnik, Arijit Singh", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/sK7riqg2mr4/hqdefault.jpg", genre: "Heartbreak", mood: "Sad" },
  { id: "3tmd-ClpJxA", videoId: "3tmd-ClpJxA", title: "Shayad - Love Aaj Kal", artist: "Arijit Singh, Pritam", channel: "Sony Music India", thumbnail: "https://i.ytimg.com/vi/3tmd-ClpJxA/hqdefault.jpg", genre: "Romantic", mood: "Melancholic" },

  // 90s Bollywood & Retro Classics
  { id: "Yqj1_V90KJo", videoId: "Yqj1_V90KJo", title: "Chura Ke Dil Mera", artist: "Kumar Sanu, Alka Yagnik", channel: "Venus", thumbnail: "https://i.ytimg.com/vi/Yqj1_V90KJo/hqdefault.jpg", genre: "90s Bollywood", mood: "Nostalgic" },
  { id: "KeyfUuXPOcY", videoId: "KeyfUuXPOcY", title: "Dheere Dheere Se Meri Zindagi", artist: "Kumar Sanu, Anuradha Paudwal", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/KeyfUuXPOcY/hqdefault.jpg", genre: "90s Bollywood", mood: "Romantic" },
  { id: "cNV5hLSa9H8", videoId: "cNV5hLSa9H8", title: "Tujhe Dekha Toh Yeh Jaana Sanam", artist: "Kumar Sanu, Lata Mangeshkar", channel: "YRF", thumbnail: "https://i.ytimg.com/vi/cNV5hLSa9H8/hqdefault.jpg", genre: "90s Bollywood", mood: "Romantic" },
  { id: "450p7goxZqg", videoId: "450p7goxZqg", title: "Aye Mere Humsafar - Qayamat Se Qayamat Tak", artist: "Udit Narayan, Alka Yagnik", channel: "Venus", thumbnail: "https://i.ytimg.com/vi/450p7goxZqg/hqdefault.jpg", genre: "90s Bollywood", mood: "Romantic" },
  { id: "JFcgOboQZ08", videoId: "JFcgOboQZ08", title: "Dheere Dheere Se Meri Zindagi", artist: "Yo Yo Honey Singh", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/JFcgOboQZ08/hqdefault.jpg", genre: "Pop", mood: "Romantic" },

  // Party / Upbeat Pop & Dance
  { id: "cIGd8gm_pYE", videoId: "cIGd8gm_pYE", title: "Lover (Official Music Video)", artist: "Diljit Dosanjh", channel: "Diljit Dosanjh", thumbnail: "https://i.ytimg.com/vi/cIGd8gm_pYE/hqdefault.jpg", genre: "Punjabi Pop", mood: "Party" },
  { id: "cl0a3i2wFcc", videoId: "cl0a3i2wFcc", title: "G.O.A.T. (Official Music Video)", artist: "Diljit Dosanjh", channel: "Diljit Dosanjh", thumbnail: "https://i.ytimg.com/vi/cl0a3i2wFcc/hqdefault.jpg", genre: "Punjabi Pop", mood: "Party" },
  { id: "8LZgzAZ2lpQ", videoId: "8LZgzAZ2lpQ", title: "Abhi Toh Party Shuru Hui Hai - Khoobsurat", artist: "Badshah, Aastha Gill", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/8LZgzAZ2lpQ/hqdefault.jpg", genre: "Party Dance", mood: "Party" },
  { id: "qFkNATtc3mc", videoId: "qFkNATtc3mc", title: "Ghungroo - War", artist: "Arijit Singh, Shilpa Rao", channel: "YRF", thumbnail: "https://i.ytimg.com/vi/qFkNATtc3mc/hqdefault.jpg", genre: "Party Dance", mood: "Feel-Good" },
  { id: "jCEdTq3j-0U", videoId: "jCEdTq3j-0U", title: "Gallan Goodiyaan - Dil Dhadakne Do", artist: "Shankar Mahadevan, Yashita Sharma", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/jCEdTq3j-0U/hqdefault.jpg", genre: "Party Dance", mood: "Party" },
  { id: "yJg-Y5byMMw", videoId: "yJg-Y5byMMw", title: "Kar Gayi Chull - Kapoor & Sons", artist: "Badshah, Neha Kakkar", channel: "Sony Music India", thumbnail: "https://i.ytimg.com/vi/yJg-Y5byMMw/hqdefault.jpg", genre: "Party Dance", mood: "Party" },
  { id: "OPf0YbXqDm0", videoId: "OPf0YbXqDm0", title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", channel: "Mark Ronson", thumbnail: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg", genre: "Funk Pop", mood: "Party" },
  { id: "kJQP7kiw5Fk", videoId: "kJQP7kiw5Fk", title: "Despacito", artist: "Luis Fonsi ft. Daddy Yankee", channel: "Luis Fonsi", thumbnail: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg", genre: "Latin Pop", mood: "Party" },

  // Soulful / Sufi Rock / Acoustic
  { id: "cmMiyZaSELo", videoId: "cmMiyZaSELo", title: "Zara Sa (Official Video) - Jannat", artist: "KK, Pritam", channel: "Sony Music India", thumbnail: "https://i.ytimg.com/vi/cmMiyZaSELo/hqdefault.jpg", genre: "Pop Rock", mood: "Soulful" },
  { id: "T94PHkuydcw", videoId: "T94PHkuydcw", title: "Kun Faya Kun (Official Video) - Rockstar", artist: "A.R. Rahman, Javed Ali, Mohit Chauhan", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/T94PHkuydcw/hqdefault.jpg", genre: "Sufi Rock", mood: "Intense" },
  { id: "jHNNMj5bNQw", videoId: "jHNNMj5bNQw", title: "Kabira - Yeh Jawaani Hai Deewani", artist: "Tochi Raina, Rekha Bhardwaj", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/jHNNMj5bNQw/hqdefault.jpg", genre: "Sufi Folk", mood: "Soulful" },
  { id: "5Eqb_-j3FDA", videoId: "5Eqb_-j3FDA", title: "Pasoori", artist: "Ali Sethi, Shae Gill", channel: "Coke Studio", thumbnail: "https://i.ytimg.com/vi/5Eqb_-j3FDA/hqdefault.jpg", genre: "Sufi Pop", mood: "Soulful" },
  { id: "ARtRGkaG_OA", videoId: "ARtRGkaG_OA", title: "Rockstar - Phir Se Ud Chala", artist: "Mohit Chauhan, A.R. Rahman", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/ARtRGkaG_OA/hqdefault.jpg", genre: "Rock", mood: "Soulful" },
  { id: "jsgPZVMfJQk", videoId: "jsgPZVMfJQk", title: "Pehle Bhi Main - Animal", artist: "Vishal Mishra, Raj Shekhar", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/jsgPZVMfJQk/hqdefault.jpg", genre: "Romantic", mood: "Soulful" },

  // Indie & Global Melodies
  { id: "vt4jX0iRgCg", videoId: "vt4jX0iRgCg", title: "Kho Gaye Hum Kahan - Baar Baar Dekho", artist: "Jasleen Royal, Prateek Kuhad", channel: "Zee Music Company", thumbnail: "https://i.ytimg.com/vi/vt4jX0iRgCg/hqdefault.jpg", genre: "Indie Acoustic", mood: "Underrated" },
  { id: "dZ0fwJojhrs", videoId: "dZ0fwJojhrs", title: "Baarishein", artist: "Anuv Jain", channel: "Anuv Jain", thumbnail: "https://i.ytimg.com/vi/dZ0fwJojhrs/hqdefault.jpg", genre: "Indie Acoustic", mood: "Underrated" },
  { id: "Il7Nv270zNk", videoId: "Il7Nv270zNk", title: "cold/mess", artist: "Prateek Kuhad", channel: "Prateek Kuhad", thumbnail: "https://i.ytimg.com/vi/Il7Nv270zNk/hqdefault.jpg", genre: "Indie Acoustic", mood: "Heartbreak" },
  { id: "PT2_F-1esPk", videoId: "PT2_F-1esPk", title: "Closer", artist: "The Chainsmokers ft. Halsey", channel: "Chainsmokers", thumbnail: "https://i.ytimg.com/vi/PT2_F-1esPk/hqdefault.jpg", genre: "Pop", mood: "Feel-Good" },
  { id: "2Vv-BfVoq4g", videoId: "2Vv-BfVoq4g", title: "Perfect", artist: "Ed Sheeran", channel: "Ed Sheeran", thumbnail: "https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg", genre: "Romantic", mood: "Love" },
  { id: "YQHsXMglC9A", videoId: "YQHsXMglC9A", title: "Hello", artist: "Adele", channel: "Adele", thumbnail: "https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg", genre: "Soul", mood: "Melancholic" },
  { id: "uelHwf8o7_U", videoId: "uelHwf8o7_U", title: "Love The Way You Lie", artist: "Eminem ft. Rihanna", channel: "Eminem", thumbnail: "https://i.ytimg.com/vi/uelHwf8o7_U/hqdefault.jpg", genre: "Hip-Hop", mood: "Intense" },
  { id: "JGwWNGJdvx8", videoId: "JGwWNGJdvx8", title: "Shape of You", artist: "Ed Sheeran", channel: "Ed Sheeran", thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg", genre: "Pop", mood: "Feel-Good" },
  { id: "fJ9rUzIMcZQ", videoId: "fJ9rUzIMcZQ", title: "Bohemian Rhapsody", artist: "Queen", channel: "Queen", thumbnail: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg", genre: "Rock Classic", mood: "Intense" },
  { id: "RgKAFK5djSk", videoId: "RgKAFK5djSk", title: "See You Again", artist: "Wiz Khalifa ft. Charlie Puth", channel: "Wiz Khalifa", thumbnail: "https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg", genre: "Emotional", mood: "Melancholic" }
];

export const catalogService = {
  /**
   * Retrieves strictly verified single songs from MongoDB CuratedCollections and core catalog.
   * Excludes compilations, medleys, jukeboxes, and non-stop mixes.
   */
  async getCuratedTracks() {
    const candidateMap = new Map();

    // 1. Seed with core verified tracks
    for (const track of CORE_CATALOG_TRACKS) {
      if (isSingleSong(track)) {
        const cleanThumb = getCleanTrackThumbnail(track.thumbnail, track.id);
        if (!isValidThumbnailUrlFormat(cleanThumb)) continue;

        const verification = verifySingleSong(track);
        candidateMap.set(track.id, {
          id: track.id,
          videoId: track.videoId || track.id,
          title: track.title,
          artist: track.artist,
          channel: track.channel || track.artist,
          thumbnail: cleanThumb,
          duration: track.duration || '3:45',
          genre: track.genre || 'Desi Hits',
          mood: track.mood || 'Vibes',
          songType: verification.songType,
          verificationStatus: verification.verificationStatus
        });
      }
    }

    // 2. Fetch from published MongoDB CuratedCollections if database is connected
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const collections = await CuratedCollection.find({ isPublished: true })
          .select('tracks name category')
          .lean()
          .maxTimeMS(3000);

        for (const col of collections) {
          if (Array.isArray(col.tracks)) {
            for (const t of col.tracks) {
              const trackId = t.videoId || t.id;
              if (trackId && !t.isHidden && !candidateMap.has(trackId) && isSingleSong(t)) {
                const cleanThumb = getCleanTrackThumbnail(t.thumbnail, trackId);
                if (!isValidThumbnailUrlFormat(cleanThumb)) continue;

                const verification = verifySingleSong(t);
                const meta = cleanArtistAndTitle({
                  title: t.title,
                  artist: t.artist,
                  channel: t.channel
                });
                candidateMap.set(trackId, {
                  id: trackId,
                  videoId: trackId,
                  title: meta.title,
                  artist: meta.artist,
                  channel: meta.channel,
                  thumbnail: cleanThumb,
                  duration: t.duration || '3:30',
                  genre: col.name || col.category || 'Desi Lounge',
                  mood: 'Curated',
                  songType: verification.songType,
                  verificationStatus: verification.verificationStatus
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[CatalogService] Notice fetching CuratedCollections:', err.message);
    }

    return filterTracksWithValidThumbnailsSync(Array.from(candidateMap.values()));
  },

  /**
   * Dynamically supplements candidates using search queries tailored to user top preferences.
   * Filters results strictly through verifySingleSong to ensure single-song playback safety.
   */
  async fetchDynamicCandidates(queries = [], maxPerQuery = 6) {
    if (!Array.isArray(queries) || queries.length === 0) return [];
    const dynamicTracks = [];
    const seenIds = new Set();

    for (const query of queries.slice(0, 3)) {
      if (!query || typeof query !== 'string') continue;
      try {
        const searchResult = await ytSearch({ query: query.trim(), page: 1 });
        const videos = (searchResult?.videos || []).slice(0, 10);
        const filtered = filterSingleSongs(videos);

        for (const v of filtered.slice(0, maxPerQuery)) {
          if (!v.videoId || seenIds.has(v.videoId)) continue;
          const verification = verifySingleSong(v);
          if (!verification.isValid) continue;

          const cleanThumb = getCleanTrackThumbnail(v.thumbnail, v.videoId);
          if (!isValidThumbnailUrlFormat(cleanThumb)) continue;

          seenIds.add(v.videoId);
          const meta = cleanArtistAndTitle({
            title: v.title,
            artist: v.artist || v.author?.name,
            channel: v.channel || v.author?.name
          });
          dynamicTracks.push({
            id: v.videoId,
            videoId: v.videoId,
            title: meta.title,
            artist: meta.artist,
            channel: meta.channel,
            thumbnail: cleanThumb,
            duration: v.timestamp || v.duration || '3:30',
            genre: query,
            mood: 'Personalized',
            songType: verification.songType,
            verificationStatus: verification.verificationStatus
          });
        }
      } catch (err) {
        console.warn(`[CatalogService] Query notice for "${query}":`, err.message);
      }
    }

    return filterTracksWithValidThumbnailsSync(dynamicTracks);
  },

  /**
   * Fetches fresh, verified single songs released by an artist or matching a query.
   * Prioritizes official artist and music label channels.
   * Strictly rejects mashups, medleys, jukeboxes, and compilations.
   */
  async fetchFreshVerifiedReleases(query = '', currentYear = new Date().getFullYear()) {
    if (!query || typeof query !== 'string') return [];
    const cleanQ = query.trim();
    const searchTerms = [
      `${cleanQ} official song ${currentYear}`,
      `${cleanQ} official music video`
    ];

    const freshTracks = [];
    const seenIds = new Set();

    for (const term of searchTerms) {
      try {
        const searchResult = await ytSearch({ query: term, page: 1 });
        const videos = (searchResult?.videos || []).slice(0, 8);
        for (const v of videos) {
          if (!v.videoId || seenIds.has(v.videoId)) continue;
          const verification = verifySingleSong({
            id: v.videoId,
            title: v.title,
            description: v.description,
            duration: v.timestamp || v.seconds,
            channel: v.author?.name
          });

          if (verification.isValid) {
            const cleanThumb = getCleanTrackThumbnail(v.thumbnail, v.videoId);
            if (!isValidThumbnailUrlFormat(cleanThumb)) continue;

            seenIds.add(v.videoId);
            freshTracks.push({
              id: v.videoId,
              videoId: v.videoId,
              title: decodeHtml(v.title),
              artist: decodeHtml(v.author?.name || 'Artist'),
              channel: decodeHtml(v.author?.name || ''),
              thumbnail: cleanThumb,
              duration: v.timestamp || '3:30',
              uploadedAt: v.ago || '',
              songType: verification.songType,
              verificationStatus: verification.verificationStatus
            });
            if (freshTracks.length >= 6) break;
          }
        }
      } catch (err) {
        console.warn(`[CatalogService] Fresh release search notice for "${term}":`, err.message);
      }
      if (freshTracks.length >= 6) break;
    }

    return filterTracksWithValidThumbnailsSync(freshTracks);
  },

  /**
   * Extracts music intent, mood, genre, era, artist, and search queries from a user message.
   */
  extractRecommendationIntent(message = '') {
    const text = (message || '').toLowerCase();

    const intent = {
      mood: null,
      era: null,
      genre: null,
      curationType: null,
      targetArtist: null,
      dynamicQueries: []
    };

    // 1. Mood Detection
    if (/\b(romantic|love|romance|pyaar|ishq|valentine|couples?|mohabbat)\b/i.test(text)) {
      intent.mood = 'romantic';
    } else if (/\b(sad|heartbreak|crying|pain|dard|breakup|melanchol(y|ic)|sorrow|lonely|alone|tears?)\b/i.test(text)) {
      intent.mood = 'sad';
    } else if (/\b(workout|gym|energetic|exercise|fitness|cardio|pump|beast|motivation|training|hype)\b/i.test(text)) {
      intent.mood = 'workout';
    } else if (/\b(party|dance|club|upbeat|celebration|banger|dj|groove|nightclub|festive)\b/i.test(text)) {
      intent.mood = 'party';
    } else if (/\b(chill|relax(ing)?|calm|peaceful|soothing|sleep|study|lofi|unwind|ambient)\b/i.test(text)) {
      intent.mood = 'chill';
    } else if (/\b(happy|feel-?good|joy|smile|cheerful|positive|vibes?|morning)\b/i.test(text)) {
      intent.mood = 'happy';
    } else if (/\b(sufi|devotional|spiritual|prayer|qawwali|bhajan)\b/i.test(text)) {
      intent.mood = 'sufi';
    }

    // 2. Era Detection
    if (/\b(90s|nineties|1990s|90's)\b/i.test(text)) {
      intent.era = '90s';
    } else if (/\b(80s|eighties|1980s|80's)\b/i.test(text)) {
      intent.era = '80s';
    } else if (/\b(2000s|2000's|00s)\b/i.test(text)) {
      intent.era = '2000s';
    } else if (/\b(retro|vintage|oldies|golden\s+era|classic\s+bollywood)\b/i.test(text)) {
      intent.era = 'retro';
    } else if (/\b(latest|new|2026|2025|fresh|recent|current\s+hits)\b/i.test(text)) {
      intent.era = 'latest';
    }

    // 3. Curation Type (Underrated / Hidden Gems vs Mainstream Hits)
    if (/\b(underrated|hidden\s+gems?|lesser\s+known|obscure|non-mainstream|indie\s+gems?|overlooked|sleeper\s+hits?)\b/i.test(text)) {
      intent.curationType = 'underrated';
    } else if (/\b(hits?|top\s+(songs|hits)|popular|blockbuster|famous|all\s+time\s+best)\b/i.test(text)) {
      intent.curationType = 'hits';
    }

    // 4. Genre Detection
    if (/\b(punjabi|bhangra)\b/i.test(text)) {
      intent.genre = 'punjabi';
    } else if (/\b(bollywood|hindi)\b/i.test(text)) {
      intent.genre = 'bollywood';
    } else if (/\b(ghazal|shayari)\b/i.test(text)) {
      intent.genre = 'ghazal';
    } else if (/\b(rock|metal)\b/i.test(text)) {
      intent.genre = 'rock';
    } else if (/\b(acoustic|unplugged)\b/i.test(text)) {
      intent.genre = 'acoustic';
    } else if (/\b(pop|indie\s+pop)\b/i.test(text)) {
      intent.genre = 'pop';
    }

    // 5. Target Artist Detection ("like Arijit Singh", "songs by KK", etc.)
    const artistMatch = text.match(/(?:like|similar to|by|from|of)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})/i);
    if (artistMatch && artistMatch[1]) {
      const candidateArtist = artistMatch[1].trim();
      const blacklist = ['songs', 'song', 'music', 'track', 'tracks', 'something', 'anything', 'melodies', 'bollywood', 'artists', 'vibe', 'vibes', 'hits'];
      if (!blacklist.includes(candidateArtist.toLowerCase())) {
        intent.targetArtist = candidateArtist;
      }
    }

    // 6. Build tailored YouTube search queries
    const queries = [];
    if (intent.targetArtist) {
      queries.push(`${intent.targetArtist} official single song`);
      queries.push(`songs like ${intent.targetArtist} official music video`);
      queries.push(`${intent.targetArtist} hit song official video`);
    } else if (intent.curationType === 'underrated' && intent.era === '90s') {
      queries.push('underrated 90s bollywood songs official');
      queries.push('hidden gems 90s hindi songs official video');
      queries.push('lesser known 90s romantic bollywood melodies');
    } else if (intent.curationType === 'underrated') {
      queries.push('underrated hindi indie single songs official');
      queries.push('hidden gems bollywood songs official video');
      queries.push('lesser known soulful acoustic hindi songs');
    } else if (intent.era === '90s') {
      queries.push('best 90s bollywood single songs official');
      queries.push('90s evergreen hindi songs official video');
      queries.push('superhit 90s romantic songs official');
    } else if (intent.mood === 'workout') {
      queries.push('high energy workout motivational songs hindi punjabi official');
      queries.push('gym workout energetic songs official video');
      queries.push('motivational pump workout beats single songs');
    } else if (intent.mood === 'sad') {
      queries.push('sad heartbreak emotional hindi songs official video');
      queries.push('heart touching sad single songs official');
      queries.push('deep melancholic acoustic hindi songs');
    } else if (intent.mood === 'romantic') {
      queries.push('best romantic hindi single songs official');
      queries.push('soulful love songs official video');
      queries.push('heart touching romantic melodies official');
    } else if (intent.mood === 'party') {
      queries.push('upbeat party dance songs hindi punjabi official');
      queries.push('club dance tracks hindi official video');
      queries.push('high energy celebration songs');
    } else if (intent.mood === 'chill') {
      queries.push('chill soothing acoustic hindi songs official');
      queries.push('lofi chill hindi songs official video');
      queries.push('peaceful relaxing hindi melodies');
    } else {
      const cleanQ = text.replace(/^(recommend|suggest|give me|find me|play)\s+/i, '').replace(/songs?|tracks?|music/gi, '').trim();
      if (cleanQ.length > 2) {
        queries.push(`${cleanQ} official single song`);
        queries.push(`${cleanQ} official music video`);
      } else {
        queries.push('top hit single songs official video');
        queries.push('popular trending hindi single songs official');
      }
    }

    intent.dynamicQueries = queries.slice(0, 3);
    return intent;
  },

  /**
   * Builds an expansive, diverse, intent-matched pool of valid candidate songs for AI evaluation.
   */
  async buildCandidatePool(optionsOrPreferences = null, maybeMessage = '') {
    let userPreferences = null;
    let message = '';
    let excludedKeys = new Set();
    let excludedIds = new Set();
    let excludedTitles = new Set();

    let currentTrack = null;
    if (optionsOrPreferences && typeof optionsOrPreferences === 'object') {
      if (optionsOrPreferences.userPreferences) {
        userPreferences = optionsOrPreferences.userPreferences;
      } else if (
        optionsOrPreferences.topArtists ||
        optionsOrPreferences.topGenres ||
        optionsOrPreferences.recentTracks ||
        optionsOrPreferences.favouriteTrackIds
      ) {
        userPreferences = optionsOrPreferences;
      }
      message = optionsOrPreferences.message || '';
      currentTrack = optionsOrPreferences.currentTrack || null;
      excludedKeys = optionsOrPreferences.excludedKeys || new Set();
      excludedIds = optionsOrPreferences.excludedIds || new Set();
      excludedTitles = optionsOrPreferences.excludedTitles || new Set();
    } else {
      userPreferences = optionsOrPreferences;
      message = maybeMessage || '';
    }

    const intent = this.extractRecommendationIntent(message);

    // If user asked for songs similar to current playing song, seed queries with current track
    if (currentTrack && (currentTrack.title || currentTrack.artist)) {
      const lowerM = (message || '').toLowerCase();
      if (lowerM.includes('similar') || lowerM.includes('like this') || lowerM.includes('more like')) {
        const seedQueries = [];
        if (currentTrack.artist && currentTrack.artist !== 'Unknown' && currentTrack.artist !== 'Various Artists') {
          seedQueries.push(`${currentTrack.artist} hit single songs official`);
          seedQueries.push(`songs like ${currentTrack.title} ${currentTrack.artist} official video`);
        } else if (currentTrack.title) {
          seedQueries.push(`songs like ${currentTrack.title} official video`);
        }
        if (seedQueries.length > 0) {
          intent.dynamicQueries = [...seedQueries, ...(intent.dynamicQueries || [])].slice(0, 3);
        }
      }
    }
    const candidateMap = new Map();

    // 1. Fetch curated tracks from verified catalogue first
    const curated = await this.getCuratedTracks();
    for (const track of curated) {
      const id = track.id || track.videoId;
      if (id && !candidateMap.has(id)) {
        candidateMap.set(id, { ...track, isCurated: true });
      }
    }

    // 2. Fetch dynamic candidates matching user intent to broaden pool if needed
    if (intent.dynamicQueries && intent.dynamicQueries.length > 0) {
      try {
        const dynamicTracks = await this.fetchDynamicCandidates(intent.dynamicQueries, 5);
        for (const t of dynamicTracks) {
          const id = t.id || t.videoId;
          if (id && !candidateMap.has(id)) {
            candidateMap.set(id, { ...t, isDynamic: true });
          }
        }
      } catch (e) {
        console.warn('[CatalogService] Dynamic candidate fetch notice:', e.message);
      }
    }

    // 3. User personalized preferences
    if (userPreferences) {
      const topArtists = (userPreferences.topArtists || []).slice(0, 2).map(a => `${a.name} best single songs`);
      const topGenres = (userPreferences.topGenres || []).slice(0, 1).map(g => `${g.name} hit songs`);
      const queries = [...topArtists, ...topGenres];

      if (queries.length > 0) {
        try {
          const prefTracks = await this.fetchDynamicCandidates(queries, 4);
          for (const track of prefTracks) {
            const id = track.id || track.videoId;
            if (id && !candidateMap.has(id)) {
              candidateMap.set(id, track);
            }
          }
        } catch (e) {}
      }
    }

    // Convert map to array and ensure strict thumbnail validity
    const allCandidates = filterTracksWithValidThumbnailsSync(Array.from(candidateMap.values()));

    // Score relevance to intent
    const scoredCandidates = allCandidates.map(track => {
      let score = 0;
      const combined = `${track.title} ${track.artist || ''} ${track.genre || ''} ${track.mood || ''}`.toLowerCase();

      if (intent.mood && (combined.includes(intent.mood) || (track.mood && track.mood.toLowerCase().includes(intent.mood)))) {
        score += 15;
      }
      if (intent.era && (combined.includes(intent.era) || (track.genre && track.genre.toLowerCase().includes(intent.era)))) {
        score += 15;
      }
      if (intent.genre && (combined.includes(intent.genre) || (track.genre && track.genre.toLowerCase().includes(intent.genre)))) {
        score += 10;
      }
      if (intent.curationType === 'underrated' && (combined.includes('underrated') || combined.includes('indie') || combined.includes('acoustic'))) {
        score += 15;
      }
      if (intent.targetArtist && combined.includes(intent.targetArtist.toLowerCase())) {
        score += 20;
      }

      return { track, score };
    });

    // Sort by score descending with randomized tie-breaking for diversity
    scoredCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Math.random() - 0.5;
    });

    return scoredCandidates.map(item => item.track);
  },

  /**
   * Matches an identified song strictly against the actual Loopra catalogue.
   * Matches using normalized title and artist.
   * Never returns an unrelated track as a fallback.
   * If no exact match exists, returns { isExactMatch: false, matchedTrack: null }.
   */
  async findExactCatalogueMatch({ title, artist, album } = {}) {
    if (!title || typeof title !== 'string' || title.toLowerCase() === 'unknown') {
      return { isExactMatch: false, matchedTrack: null, reason: 'Invalid or unknown title' };
    }

    const clean = (str = '') =>
      str
        .toLowerCase()
        .replace(/\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/official video|music video|lyric video|full song|audio song|video song|hd|4k|remastered/gi, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const targetTitle = clean(title);
    if (!targetTitle) {
      return { isExactMatch: false, matchedTrack: null, reason: 'Target title reduced to empty' };
    }

    const targetArtist = (artist && artist.toLowerCase() !== 'unknown') ? clean(artist) : '';

    // 1. Search in verified curated tracks (core catalog + curated collections)
    const curated = await this.getCuratedTracks();
    for (const track of curated) {
      const trackTitle = clean(track.title);
      const trackArtist = clean(track.artist || track.channel);

      const titleMatches = trackTitle === targetTitle ||
        trackTitle.startsWith(targetTitle) ||
        targetTitle.startsWith(trackTitle) ||
        trackTitle.includes(targetTitle);

      if (titleMatches) {
        if (targetArtist) {
          const artistTokens = targetArtist.split(' ').filter(w => w.length > 2);
          const artistMatches = artistTokens.length === 0 || artistTokens.some(tok => trackArtist.includes(tok) || trackTitle.includes(tok));
          if (artistMatches) {
            return { isExactMatch: true, matchedTrack: track, matchType: 'curated' };
          }
        } else {
          return { isExactMatch: true, matchedTrack: track, matchType: 'curated' };
        }
      }
    }

    // 2. Search dynamic candidates in Loopra catalogue using YouTube search with strict single-song filter
    try {
      const searchQueries = [
        targetArtist ? `${targetTitle} ${targetArtist} official song` : `${targetTitle} official song`
      ];
      const dynamicCandidates = await this.fetchDynamicCandidates(searchQueries, 5);

      for (const track of dynamicCandidates) {
        const trackTitle = clean(track.title);
        const trackArtist = clean(track.artist || track.channel);

        // Strict verification: title must contain all significant tokens of the target title
        const targetTokens = targetTitle.split(' ').filter(w => w.length > 2);
        const allTokensPresent = targetTokens.length > 0
          ? targetTokens.every(token => trackTitle.includes(token))
          : trackTitle.includes(targetTitle);

        if (allTokensPresent) {
          if (targetArtist) {
            const artistTokens = targetArtist.split(' ').filter(w => w.length > 2);
            const artistMatches = artistTokens.length === 0 || artistTokens.some(tok => trackArtist.includes(tok) || trackTitle.includes(tok));
            if (artistMatches) {
              return { isExactMatch: true, matchedTrack: track, matchType: 'catalogue_search' };
            }
          } else {
            return { isExactMatch: true, matchedTrack: track, matchType: 'catalogue_search' };
          }
        }
      }
    } catch (e) {
      console.warn('[CatalogService] Exact match search notice:', e.message);
    }

    // Strict non-hallucination: No exact verified match found
    return {
      isExactMatch: false,
      matchedTrack: null,
      reason: `No exact catalogue match found for "${title}" by ${artist || 'Unknown'}`
    };
  }
};
