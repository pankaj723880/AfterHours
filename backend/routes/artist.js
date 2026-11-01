import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';
import { getArtistProfile, getArtistSongs, slugifyArtistName } from '../services/artistService.js';

const router = express.Router();

/**
 * 1. GET /api/artists/followed
 * Returns list of artists followed by the authenticated user
 */
router.get('/followed', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const user = await User.findById(userId).select('followedArtists').lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      success: true,
      followedArtists: user.followedArtists || []
    });
  } catch (err) {
    console.error('[Artist Followed GET Error]:', err.message);
    res.status(500).json({ error: 'Failed to fetch followed artists: ' + err.message });
  }
});

/**
 * 2. GET /api/artists/:id
 * Retrieves complete Spotify-inspired artist profile with initial 10 popular songs,
 * discography, and related artists.
 */
router.get('/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    if (!rawId || !rawId.trim()) {
      return res.status(400).json({ error: 'Artist identifier is required' });
    }

    const profile = await getArtistProfile(rawId);
    if (!profile) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    res.json({
      success: true,
      artist: profile
    });
  } catch (err) {
    console.error('[Artist Profile GET Error]:', err.message);
    res.status(500).json({ error: 'Failed to load artist profile: ' + err.message });
  }
});

/**
 * 3. GET /api/artists/:id/songs
 * Paginated popular songs loader for permanent "Load More" functionality.
 * Fetches exactly 10 additional songs per page.
 */
router.get('/:id/songs', async (req, res) => {
  try {
    const rawId = req.params.id;
    const pageToken = req.query.pageToken || null;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const excludeIds = (req.query.excludeIds || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    // Resolve artist name from profile or slug
    const profile = await getArtistProfile(rawId);
    const artistName = profile?.name || rawId.replace(/-/g, ' ');

    const songsResult = await getArtistSongs(artistName, {
      pageToken,
      limit,
      excludeIds
    });

    res.json({
      success: true,
      songs: songsResult.songs,
      nextPageToken: songsResult.nextPageToken,
      hasMore: songsResult.hasMore,
      totalCount: songsResult.totalCount
    });
  } catch (err) {
    console.error('[Artist Songs Paginated GET Error]:', err.message);
    res.status(500).json({ error: 'Failed to load artist songs: ' + err.message });
  }
});

/**
 * 4. POST /api/artists/:id/follow
 * Follows an artist for the authenticated user
 */
router.post('/:id/follow', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const rawId = req.params.id;
    const slug = slugifyArtistName(rawId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!Array.isArray(user.followedArtists)) {
      user.followedArtists = [];
    }

    if (!user.followedArtists.includes(slug)) {
      user.followedArtists.push(slug);
      await user.save();
    }

    res.json({
      success: true,
      isFollowing: true,
      artistId: slug,
      followedArtists: user.followedArtists
    });
  } catch (err) {
    console.error('[Artist Follow POST Error]:', err.message);
    res.status(500).json({ error: 'Failed to follow artist: ' + err.message });
  }
});

/**
 * 5. DELETE /api/artists/:id/follow
 * Unfollows an artist for the authenticated user
 */
router.delete('/:id/follow', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId || req.user.id;
    const rawId = req.params.id;
    const slug = slugifyArtistName(rawId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (Array.isArray(user.followedArtists)) {
      user.followedArtists = user.followedArtists.filter(id => id !== slug);
      await user.save();
    }

    res.json({
      success: true,
      isFollowing: false,
      artistId: slug,
      followedArtists: user.followedArtists || []
    });
  } catch (err) {
    console.error('[Artist Unfollow DELETE Error]:', err.message);
    res.status(500).json({ error: 'Failed to unfollow artist: ' + err.message });
  }
});

export default router;

