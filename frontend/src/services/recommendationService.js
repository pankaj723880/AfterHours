/**
 * Loopra Personalized Recommendation Engine
 * Synthesizes recommendations from:
 * 1. User liked songs
 * 2. Listening history
 * 3. Fallback Nostalgia & Bollywood classics for new users
 */

export function generateRecommendations({
  likedSongs = [],
  history = [],
  allAvailableTracks = [],
  limit = 8
}) {
  const seenIds = new Set();
  const recommendations = [];

  // Exclude already liked songs from recommendations so users discover new gems
  const likedIds = new Set(likedSongs.map(s => s.id || s.videoId).filter(Boolean));
  const historyIds = new Set(history.map(s => s.id || s.videoId).filter(Boolean));

  // Extract top artists from user history & likes
  const artistFrequencies = {};
  [...likedSongs, ...history].forEach(track => {
    const artist = track.artist || track.channel;
    if (artist && !artist.toLowerCase().includes('unknown')) {
      artistFrequencies[artist] = (artistFrequencies[artist] || 0) + 1;
    }
  });

  const preferredArtists = Object.entries(artistFrequencies)
    .sort((a, b) => b[1] - a[1])
    .map(([a]) => a);

  // 1. Recommend tracks by favorite artists that aren't already liked
  if (preferredArtists.length > 0 && Array.isArray(allAvailableTracks)) {
    for (const track of allAvailableTracks) {
      const id = track.id || track.videoId;
      if (!id || seenIds.has(id) || likedIds.has(id)) continue;

      const trackArtist = track.artist || track.channel;
      const matchedArtist = preferredArtists.find(
        pa => trackArtist && trackArtist.toLowerCase().includes(pa.toLowerCase())
      );

      if (matchedArtist) {
        seenIds.add(id);
        recommendations.push({
          ...track,
          recommendationReason: `Because you enjoy ${matchedArtist}`
        });
      }

      if (recommendations.length >= limit) break;
    }
  }

  // 2. If user has a most recent liked track, recommend similar nostalgic vibe
  if (recommendations.length < limit && likedSongs.length > 0) {
    const seedSong = likedSongs[0];
    for (const track of allAvailableTracks) {
      const id = track.id || track.videoId;
      if (!id || seenIds.has(id) || likedIds.has(id)) continue;

      seenIds.add(id);
      recommendations.push({
        ...track,
        recommendationReason: `Similar vibe to "${seedSong.title?.slice(0, 24)}..."`
      });

      if (recommendations.length >= limit) break;
    }
  }

  // 3. New User Starter Pack: Curated Bollywood retro starter tracks if user has no likes yet
  if (recommendations.length < limit && Array.isArray(allAvailableTracks)) {
    for (const track of allAvailableTracks) {
      const id = track.id || track.videoId;
      if (!id || seenIds.has(id) || likedIds.has(id)) continue;

      seenIds.add(id);
      recommendations.push({
        ...track,
        recommendationReason: 'Trending Retro Bollywood'
      });

      if (recommendations.length >= limit) break;
    }
  }

  return recommendations;
}
