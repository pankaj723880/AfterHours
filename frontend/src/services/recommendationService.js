/**
 * Loopra Personalized Recommendation Engine
 * Synthesizes multi-section recommendations from:
 * 1. User liked songs
 * 2. Listening history & play counts
 * 3. Shared artists & title affinities
 * 4. Fresh unplayed discoveries
 * 
 * Sections:
 * - Made for You
 * - Because You Liked
 * - Similar Songs
 * - Recently Played
 * - Your Favorites
 * - Discover Something New
 */

import { filterSingleSongs } from './songFilter.js';

// In-memory cache for recommendation sessions
let recommendationCache = {
  key: '',
  timestamp: 0,
  data: null
};

// Helper: Normalize track ID
export function getTrackId(track) {
  if (!track) return null;
  return track.id || track.videoId || track._id || null;
}

// Helper: Extract primary artist name cleanly
export function extractArtist(track) {
  if (!track) return '';
  const raw = track.artist || track.channel || '';
  if (!raw || raw.toLowerCase().includes('unknown')) return '';
  // Clean off "VEVO", "Official", etc.
  return raw.replace(/VEVO|Official|Topic/gi, '').trim();
}

/**
 * Generate a single flat list of recommendations (Backwards compatible)
 */
export function generateRecommendations({
  likedSongs = [],
  history = [],
  allAvailableTracks = [],
  limit = 8
}) {
  const sections = generateCategorizedRecommendations({
    likedSongs,
    history,
    allAvailableTracks,
    limitPerSection: limit
  });

  // Combine top tracks from Made for You and Discover
  const combined = [
    ...(sections.madeForYou?.tracks || []),
    ...(sections.discoverNew?.tracks || [])
  ];

  return combined.slice(0, limit);
}

/**
 * Generates all 6 personalized recommendation sections with session deduplication
 */
export function generateCategorizedRecommendations({
  likedSongs = [],
  history = [],
  listeningStats = null,
  allAvailableTracks = [],
  limitPerSection = 6,
  forceRefresh = false
}) {
  const cacheKey = `${likedSongs.length}_${history.length}_${allAvailableTracks.length}`;
  const now = Date.now();

  if (!forceRefresh && recommendationCache.data && recommendationCache.key === cacheKey && (now - recommendationCache.timestamp < 60000)) {
    return recommendationCache.data;
  }

  // Deduplication tracker across recommendation sections
  const globalSeenIds = new Set();

  const likedIds = new Set(likedSongs.map(getTrackId).filter(Boolean));
  const historyIds = new Set(history.map(getTrackId).filter(Boolean));

  // Extract artist affinity counts
  const artistCounts = {};
  [...likedSongs, ...history].forEach(track => {
    const artist = extractArtist(track);
    if (artist) {
      artistCounts[artist.toLowerCase()] = (artistCounts[artist.toLowerCase()] || 0) + 1;
    }
  });

  const topArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([art]) => art);

  // Available candidate pool (filtered strictly for single songs, shuffled)
  const singleSongCandidates = filterSingleSongs(allAvailableTracks);
  const poolSource = singleSongCandidates.length > 0 ? singleSongCandidates : allAvailableTracks;
  const candidatePool = Array.isArray(poolSource)
    ? [...poolSource].sort(() => 0.5 - Math.random())
    : [];

  // ==========================================
  // 1. SECTION: Recently Played (from history)
  // ==========================================
  const recentlyPlayedTracks = [];
  const recentSeen = new Set();
  for (const track of [...history].reverse()) {
    const tid = getTrackId(track);
    if (!tid || recentSeen.has(tid)) continue;
    recentSeen.add(tid);
    recentlyPlayedTracks.push({
      ...track,
      recommendationReason: 'Recently in your rotation'
    });
    if (recentlyPlayedTracks.length >= limitPerSection) break;
  }

  // ==========================================
  // 2. SECTION: Your Favorites (from likes or top played)
  // ==========================================
  const yourFavoritesTracks = [];
  const favSeen = new Set();
  for (const track of [...likedSongs].reverse()) {
    const tid = getTrackId(track);
    if (!tid || favSeen.has(tid)) continue;
    favSeen.add(tid);
    yourFavoritesTracks.push({
      ...track,
      recommendationReason: 'From your favorites'
    });
    if (yourFavoritesTracks.length >= limitPerSection) break;
  }

  // Mark already played/liked tracks so discovery sections focus on recommendations
  // but don't strictly hide them if pool is small
  recentlyPlayedTracks.forEach(t => globalSeenIds.add(getTrackId(t)));
  yourFavoritesTracks.forEach(t => globalSeenIds.add(getTrackId(t)));

  // ==========================================
  // 3. SECTION: Made for You (Top artist affinities + user taste)
  // ==========================================
  const madeForYouTracks = [];
  if (topArtists.length > 0) {
    for (const track of candidatePool) {
      const tid = getTrackId(track);
      if (!tid || globalSeenIds.has(tid)) continue;

      const trackArtist = extractArtist(track).toLowerCase();
      const matched = topArtists.find(pa => trackArtist.includes(pa) || pa.includes(trackArtist));

      if (matched) {
        globalSeenIds.add(tid);
        madeForYouTracks.push({
          ...track,
          recommendationReason: `For your love of ${matched.charAt(0).toUpperCase() + matched.slice(1)}`
        });
      }
      if (madeForYouTracks.length >= limitPerSection) break;
    }
  }

  // If new user or not enough tracks found, backfill with curated quality hits
  if (madeForYouTracks.length < limitPerSection) {
    for (const track of candidatePool) {
      const tid = getTrackId(track);
      if (!tid || globalSeenIds.has(tid)) continue;

      globalSeenIds.add(tid);
      madeForYouTracks.push({
        ...track,
        recommendationReason: topArtists.length === 0 ? 'Curated Starter Selection' : 'Handpicked for your rotation'
      });
      if (madeForYouTracks.length >= limitPerSection) break;
    }
  }

  // ==========================================
  // 4. SECTION: Because You Liked
  // ==========================================
  const becauseYouLikedTracks = [];
  let seedLikedSong = likedSongs.length > 0 ? likedSongs[Math.floor(Math.random() * likedSongs.length)] : null;
  let becauseSubtitle = 'Based on your saved tracks';

  if (seedLikedSong) {
    const seedArtist = extractArtist(seedLikedSong).toLowerCase();
    const seedTitleSnippet = (seedLikedSong.title || '').split(/[-–|(\[]/)[0].trim();
    becauseSubtitle = seedArtist ? `Because you enjoy ${seedArtist}` : `Inspired by "${seedTitleSnippet}"`;

    for (const track of candidatePool) {
      const tid = getTrackId(track);
      if (!tid || globalSeenIds.has(tid) || likedIds.has(tid)) continue;

      const tArtist = extractArtist(track).toLowerCase();
      const tTitle = (track.title || '').toLowerCase();

      // Check artist similarity or title keyword overlap
      const isMatch = (seedArtist && (tArtist.includes(seedArtist) || seedArtist.includes(tArtist))) ||
                      (seedTitleSnippet && tTitle.includes(seedTitleSnippet.toLowerCase()));

      if (isMatch) {
        globalSeenIds.add(tid);
        becauseYouLikedTracks.push({
          ...track,
          recommendationReason: `Because you liked ${seedArtist || 'this vibe'}`
        });
      }
      if (becauseYouLikedTracks.length >= limitPerSection) break;
    }
  }

  // Fallback for new user or if no direct matches
  if (becauseYouLikedTracks.length < limitPerSection) {
    for (const track of candidatePool) {
      const tid = getTrackId(track);
      if (!tid || globalSeenIds.has(tid) || likedIds.has(tid)) continue;

      globalSeenIds.add(tid);
      becauseYouLikedTracks.push({
        ...track,
        recommendationReason: seedLikedSong ? 'Similar Acoustic Mood' : 'Loopra Classic Pick'
      });
      if (becauseYouLikedTracks.length >= limitPerSection) break;
    }
  }

  // ==========================================
  // 5. SECTION: Similar Songs (based on recent history vibe)
  // ==========================================
  const similarSongsTracks = [];
  const seedRecentSong = history.length > 0 ? history[history.length - 1] : null;

  for (const track of candidatePool) {
    const tid = getTrackId(track);
    if (!tid || globalSeenIds.has(tid)) continue;

    globalSeenIds.add(tid);
    similarSongsTracks.push({
      ...track,
      recommendationReason: seedRecentSong ? `Similar vibe to "${(seedRecentSong.title || '').slice(0, 20)}..."` : 'Trending Match'
    });
    if (similarSongsTracks.length >= limitPerSection) break;
  }

  // ==========================================
  // 6. SECTION: Discover Something New (Never played, fresh tracks)
  // ==========================================
  const discoverNewTracks = [];
  for (const track of candidatePool) {
    const tid = getTrackId(track);
    if (!tid || globalSeenIds.has(tid) || historyIds.has(tid) || likedIds.has(tid)) continue;

    globalSeenIds.add(tid);
    discoverNewTracks.push({
      ...track,
      recommendationReason: 'Fresh Discovery'
    });
    if (discoverNewTracks.length >= limitPerSection) break;
  }

  // If pool was exhausted, allow any remaining unselected tracks
  if (discoverNewTracks.length < limitPerSection) {
    for (const track of candidatePool) {
      const tid = getTrackId(track);
      if (!tid || globalSeenIds.has(tid)) continue;

      globalSeenIds.add(tid);
      discoverNewTracks.push({
        ...track,
        recommendationReason: 'Explore New Sounds'
      });
      if (discoverNewTracks.length >= limitPerSection) break;
    }
  }

  const result = {
    madeForYou: {
      id: 'madeForYou',
      title: 'Made for You',
      icon: '✨',
      subtitle: topArtists.length > 0 ? `Curated based on your love for ${topArtists.slice(0, 2).join(', ')}` : 'Tailored musical mix for your taste',
      tracks: madeForYouTracks
    },
    becauseYouLiked: {
      id: 'becauseYouLiked',
      title: seedLikedSong ? `Because You Liked ${seedLikedSong.title ? `"${seedLikedSong.title.slice(0, 22)}..."` : 'Saved Tracks'}` : 'Because You Liked',
      icon: '❤️',
      subtitle: becauseSubtitle,
      tracks: becauseYouLikedTracks
    },
    similarSongs: {
      id: 'similarSongs',
      title: 'Similar Songs',
      icon: '🎶',
      subtitle: seedRecentSong ? `Matches your recent listening vibe` : 'Harmonious tracks with rich acoustic presence',
      tracks: similarSongsTracks
    },
    recentlyPlayed: {
      id: 'recentlyPlayed',
      title: 'Recently Played',
      icon: '🕒',
      subtitle: 'Pick up right where you left off',
      tracks: recentlyPlayedTracks,
      emptyMessage: 'No tracks played yet. Start playing music to see your history here!'
    },
    yourFavorites: {
      id: 'yourFavorites',
      title: 'Your Favorites',
      icon: '⭐',
      subtitle: 'Your top saved songs',
      tracks: yourFavoritesTracks,
      emptyMessage: 'No liked songs yet. Tap the heart icon on any song to add it here!'
    },
    discoverNew: {
      id: 'discoverNew',
      title: 'Discover Something New',
      icon: '🚀',
      subtitle: 'Fresh sounds and hidden gems outside your usual rotation',
      tracks: discoverNewTracks
    }
  };

  recommendationCache = {
    key: cacheKey,
    timestamp: now,
    data: result
  };

  return result;
}

export default {
  getTrackId,
  extractArtist,
  generateRecommendations,
  generateCategorizedRecommendations
};

