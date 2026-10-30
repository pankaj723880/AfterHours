import mongoose from 'mongoose';
import CuratedCollection from '../models/CuratedCollection.js';
import ytSearch from 'yt-search';
import { filterSingleSongs, isSingleSong, verifySingleSong } from './songFilter.js';

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

// Foundational verified catalog tracks for immediate instant retrieval across moods & eras
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

  // Sad / Heartbreak / Emotional
  { id: "SQWDGLnvxF4", videoId: "SQWDGLnvxF4", title: "Sanam Teri Kasam Title Track", artist: "Ankit Tiwari, Palak Muchhal", channel: "Eros Now", thumbnail: "https://i.ytimg.com/vi/SQWDGLnvxF4/hqdefault.jpg", genre: "Heartbreak", mood: "Sad" },
  { id: "BDlNjOc3wiQ", videoId: "BDlNjOc3wiQ", title: "Bekhayali - Kabir Singh", artist: "Sachet Tandon", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/BDlNjOc3wiQ/hqdefault.jpg", genre: "Rock", mood: "Heartbreak" },
  { id: "284Ov7ysmfA", videoId: "284Ov7ysmfA", title: "Channa Mereya", artist: "Arijit Singh, Pritam", channel: "Sony Music", thumbnail: "https://i.ytimg.com/vi/284Ov7ysmfA/hqdefault.jpg", genre: "Romantic", mood: "Emotional" },
  { id: "S6IW8Rj1WqQ", videoId: "S6IW8Rj1WqQ", title: "Aankh Hai Bhari Bhari", artist: "Kumar Sanu", channel: "Tips Official", thumbnail: "https://i.ytimg.com/vi/S6IW8Rj1WqQ/hqdefault.jpg", genre: "Sad Ghazal", mood: "Nostalgic" },
  { id: "sK7riqg2mr4", videoId: "sK7riqg2mr4", title: "Agar Tum Saath Ho - Tamasha", artist: "Alka Yagnik, Arijit Singh", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/sK7riqg2mr4/hqdefault.jpg", genre: "Heartbreak", mood: "Sad" },
  { id: "2mDC8bQ2r2E", videoId: "2mDC8bQ2r2E", title: "Tujhe Bhula Diya - Anjaana Anjaani", artist: "Mohit Chauhan, Shekhar Ravjiani", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/2mDC8bQ2r2E/hqdefault.jpg", genre: "Heartbreak", mood: "Sad" },

  // 90s Bollywood & Retro Classics
  { id: "Yqj1_V90KJo", videoId: "Yqj1_V90KJo", title: "Chura Ke Dil Mera", artist: "Kumar Sanu, Alka Yagnik", channel: "Venus", thumbnail: "https://i.ytimg.com/vi/Yqj1_V90KJo/hqdefault.jpg", genre: "90s Bollywood", mood: "Nostalgic" },
  { id: "KeyfUuXPOcY", videoId: "KeyfUuXPOcY", title: "Dheere Dheere Se Meri Zindagi", artist: "Kumar Sanu, Anuradha Paudwal", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/KeyfUuXPOcY/hqdefault.jpg", genre: "90s Bollywood", mood: "Romantic" },
  { id: "cNV5hLSa9H8", videoId: "cNV5hLSa9H8", title: "Tujhe Dekha Toh Yeh Jaana Sanam", artist: "Kumar Sanu, Lata Mangeshkar", channel: "YRF", thumbnail: "https://i.ytimg.com/vi/cNV5hLSa9H8/hqdefault.jpg", genre: "90s Bollywood", mood: "Romantic" },
  { id: "q_46zF7ZJqM", videoId: "q_46zF7ZJqM", title: "Pehla Nasha - Jo Jeeta Wohi Sikandar", artist: "Udit Narayan, Sadhana Sargam", channel: "Venus", thumbnail: "https://i.ytimg.com/vi/q_46zF7ZJqM/hqdefault.jpg", genre: "90s Bollywood", mood: "Romantic" },
  { id: "b0Z1_mHjW_E", videoId: "b0Z1_mHjW_E", title: "Tip Tip Barsa Paani - Mohra", artist: "Udit Narayan, Alka Yagnik", channel: "Venus", thumbnail: "https://i.ytimg.com/vi/b0Z1_mHjW_E/hqdefault.jpg", genre: "90s Bollywood", mood: "Nostalgic" },
  { id: "wJ8d4xIeR-c", videoId: "wJ8d4xIeR-c", title: "Baazigar O Baazigar", artist: "Kumar Sanu, Alka Yagnik", channel: "Venus", thumbnail: "https://i.ytimg.com/vi/wJ8d4xIeR-c/hqdefault.jpg", genre: "90s Bollywood", mood: "Nostalgic" },
  { id: "27y8t1WkYpk", videoId: "27y8t1WkYpk", title: "Dil Hai Ke Manta Nahin Title Track", artist: "Kumar Sanu, Anuradha Paudwal", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/27y8t1WkYpk/hqdefault.jpg", genre: "90s Bollywood", mood: "Romantic" },

  // Energetic / Workout / Motivation
  { id: "exv-pL9pC_0", videoId: "exv-pL9pC_0", title: "Kar Har Maidaan Fateh - Sanju", artist: "Sukhwinder Singh, Shreya Ghoshal", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/exv-pL9pC_0/hqdefault.jpg", genre: "Motivational", mood: "Workout" },
  { id: "wMPb6ZkWd1k", videoId: "wMPb6ZkWd1k", title: "Zinda - Bhaag Milkha Bhaag", artist: "Siddharth Mahadevan", channel: "Sony Music India", thumbnail: "https://i.ytimg.com/vi/wMPb6ZkWd1k/hqdefault.jpg", genre: "Rock Motivation", mood: "Workout" },
  { id: "9mQk7Evt6Dk", videoId: "9mQk7Evt6Dk", title: "Sultan Title Song", artist: "Sukhwinder Singh, Shadab Faridi", channel: "YRF", thumbnail: "https://i.ytimg.com/vi/9mQk7Evt6Dk/hqdefault.jpg", genre: "Workout", mood: "Energetic" },
  { id: "bL4j_Hq_o1k", videoId: "bL4j_Hq_o1k", title: "Brothers Anthem", artist: "Vishal Dadlani", channel: "Sony Music India", thumbnail: "https://i.ytimg.com/vi/bL4j_Hq_o1k/hqdefault.jpg", genre: "Workout", mood: "Energetic" },
  { id: "OQ1cbe_g5eM", videoId: "OQ1cbe_g5eM", title: "Chak De India Title Track", artist: "Sukhwinder Singh, Salim-Sulaiman", channel: "YRF", thumbnail: "https://i.ytimg.com/vi/OQ1cbe_g5eM/hqdefault.jpg", genre: "Energetic", mood: "Workout" },

  // Party / Upbeat Pop
  { id: "cIGd8gm_pYE", videoId: "cIGd8gm_pYE", title: "Lover (Official Music Video)", artist: "Diljit Dosanjh", channel: "Diljit Dosanjh", thumbnail: "https://i.ytimg.com/vi/cIGd8gm_pYE/hqdefault.jpg", genre: "Punjabi Pop", mood: "Party" },
  { id: "II2EO3NwUrQ", videoId: "II2EO3NwUrQ", title: "Badtameez Dil - Yeh Jawaani Hai Deewani", artist: "Benny Dayal, Pritam", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/II2EO3NwUrQ/hqdefault.jpg", genre: "Party Dance", mood: "Party" },
  { id: "k4yXQkGLeAk", videoId: "k4yXQkGLeAk", title: "Kala Chashma - Baar Baar Dekho", artist: "Amar Arshi, Badshah, Neha Kakkar", channel: "Zee Music Company", thumbnail: "https://i.ytimg.com/vi/k4yXQkGLeAk/hqdefault.jpg", genre: "Party Dance", mood: "Party" },
  { id: "dra3PCbxbDE", videoId: "dra3PCbxbDE", title: "London Thumakda - Queen", artist: "Labh Janjua, Sonu Kakkar, Neha Kakkar", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/dra3PCbxbDE/hqdefault.jpg", genre: "Party Dance", mood: "Party" },

  // Soulful / Sufi Rock
  { id: "cmMiyZaSELo", videoId: "cmMiyZaSELo", title: "Zara Sa (Official Video) - Jannat", artist: "KK, Pritam", channel: "Sony Music India", thumbnail: "https://i.ytimg.com/vi/cmMiyZaSELo/hqdefault.jpg", genre: "Pop Rock", mood: "Soulful" },
  { id: "T94PHkuydcw", videoId: "T94PHkuydcw", title: "Kun Faya Kun (Official Video) - Rockstar", artist: "A.R. Rahman, Javed Ali, Mohit Chauhan", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/T94PHkuydcw/hqdefault.jpg", genre: "Sufi Rock", mood: "Intense" },
  { id: "jHNNMj5bNQw", videoId: "jHNNMj5bNQw", title: "Kabira - Yeh Jawaani Hai Deewani", artist: "Tochi Raina, Rekha Bhardwaj", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/jHNNMj5bNQw/hqdefault.jpg", genre: "Sufi Folk", mood: "Soulful" },

  // Underrated & Indie Gems
  { id: "vt4jX0iRgCg", videoId: "vt4jX0iRgCg", title: "Kho Gaye Hum Kahan - Baar Baar Dekho", artist: "Jasleen Royal, Prateek Kuhad", channel: "Zee Music Company", thumbnail: "https://i.ytimg.com/vi/vt4jX0iRgCg/hqdefault.jpg", genre: "Indie Acoustic", mood: "Underrated" },
  { id: "dZ0fwJojhrs", videoId: "dZ0fwJojhrs", title: "Baarishein", artist: "Anuv Jain", channel: "Anuv Jain", thumbnail: "https://i.ytimg.com/vi/dZ0fwJojhrs/hqdefault.jpg", genre: "Indie Acoustic", mood: "Underrated" },
  { id: "bm34qK3Y3bU", videoId: "bm34qK3Y3bU", title: "Kasoor - Acoustic", artist: "Prateek Kuhad", channel: "Prateek Kuhad", thumbnail: "https://i.ytimg.com/vi/bm34qK3Y3bU/hqdefault.jpg", genre: "Indie Acoustic", mood: "Underrated" },
  { id: "YtDk_9pM-cM", videoId: "YtDk_9pM-cM", title: "Alizeh - Ae Dil Hai Mushkil", artist: "Arijit Singh, Ash King, Shashwat Singh", channel: "Sony Music India", thumbnail: "https://i.ytimg.com/vi/YtDk_9pM-cM/hqdefault.jpg", genre: "Romantic Melody", mood: "Underrated" },
  { id: "nBkWuYg5kG4", videoId: "nBkWuYg5kG4", title: "Rozana - Naam Shabana", artist: "Shreya Ghoshal, Rochak Kohli", channel: "T-Series", thumbnail: "https://i.ytimg.com/vi/nBkWuYg5kG4/hqdefault.jpg", genre: "Acoustic Melody", mood: "Underrated" }
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
        const verification = verifySingleSong(track);
        candidateMap.set(track.id, {
          id: track.id,
          videoId: track.videoId || track.id,
          title: track.title,
          artist: track.artist,
          channel: track.channel || track.artist,
          thumbnail: track.thumbnail,
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
                const verification = verifySingleSong(t);
                candidateMap.set(trackId, {
                  id: trackId,
                  videoId: trackId,
                  title: decodeHtml(t.title),
                  artist: decodeHtml(t.artist || 'Unknown Artist'),
                  channel: decodeHtml(t.channel || t.artist || 'Loopra Collection'),
                  thumbnail: t.thumbnail || `https://i.ytimg.com/vi/${trackId}/hqdefault.jpg`,
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

    return Array.from(candidateMap.values());
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

          seenIds.add(v.videoId);
          dynamicTracks.push({
            id: v.videoId,
            videoId: v.videoId,
            title: decodeHtml(v.title),
            artist: decodeHtml(v.artist || v.author?.name || 'Various Artists'),
            channel: decodeHtml(v.channel || v.author?.name || ''),
            thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
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

    return dynamicTracks;
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
            seenIds.add(v.videoId);
            freshTracks.push({
              id: v.videoId,
              videoId: v.videoId,
              title: decodeHtml(v.title),
              artist: decodeHtml(v.author?.name || 'Artist'),
              channel: decodeHtml(v.author?.name || ''),
              thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
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

    return freshTracks;
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

    // 1. Fetch dynamic candidates matching user intent
    if (intent.dynamicQueries && intent.dynamicQueries.length > 0) {
      try {
        const dynamicTracks = await this.fetchDynamicCandidates(intent.dynamicQueries, 5);
        for (const t of dynamicTracks) {
          const id = t.id || t.videoId;
          if (id && !candidateMap.has(id)) {
            candidateMap.set(id, t);
          }
        }
      } catch (e) {
        console.warn('[CatalogService] Dynamic candidate fetch notice:', e.message);
      }
    }

    // 2. Fetch curated tracks and score by relevance to user intent
    const curated = await this.getCuratedTracks();
    for (const track of curated) {
      const id = track.id || track.videoId;
      if (id && !candidateMap.has(id)) {
        candidateMap.set(id, track);
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

    // Convert map to array
    const allCandidates = Array.from(candidateMap.values());

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
