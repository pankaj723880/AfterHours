import express from 'express';
import Review from '../models/Review.js';
import User from '../models/User.js';
import ConfiguredReviewsSettings from '../models/ConfiguredReviewsSettings.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * Sanitizes text by stripping HTML tags and trimming.
 */
const sanitizeText = (str = '') => {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>?/gm, '').trim();
};

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================

/**
 * GET /api/reviews/summary
 * Returns genuine summary statistics and separately configured editorial summary (if enabled).
 */
router.get('/summary', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const statsResult = await Review.aggregate([
      { $match: { source: 'user', status: 'published' } },
      {
        $group: {
          _id: null,
          totalRatings: { $sum: 1 },
          totalReviewsWithText: {
            $sum: {
              $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$reviewText', ''] } }, 0] }, 1, 0]
            }
          },
          sumRating: { $sum: '$rating' },
          count1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          count2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          count3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          count4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          count5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } }
        }
      }
    ]);

    const stat = statsResult[0] || {
      totalRatings: 0,
      totalReviewsWithText: 0,
      sumRating: 0,
      count1: 0,
      count2: 0,
      count3: 0,
      count4: 0,
      count5: 0
    };

    const averageRating = stat.totalRatings > 0 
      ? parseFloat((stat.sumRating / stat.totalRatings).toFixed(4)) 
      : 0.0;

    const genuineSummary = {
      averageRating,
      totalRatings: stat.totalRatings,
      totalReviews: stat.totalReviewsWithText,
      distribution: {
        1: stat.count1,
        2: stat.count2,
        3: stat.count3,
        4: stat.count4,
        5: stat.count5,
        count1: stat.count1,
        count2: stat.count2,
        count3: stat.count3,
        count4: stat.count4,
        count5: stat.count5
      }
    };

    // Load separate editorial/configured settings
    let editorialSummary = null;
    let mode = 'genuine';
    try {
      const configDoc = await ConfiguredReviewsSettings.findOne({ key: 'default_configured_reviews' }).lean();
      if (configDoc && configDoc.enabled) {
        mode = 'configured';
        const dist = configDoc.distribution || {};
        const c1 = Number(dist.count1 ?? dist['1'] ?? 0);
        const c2 = Number(dist.count2 ?? dist['2'] ?? 0);
        const c3 = Number(dist.count3 ?? dist['3'] ?? 0);
        const c4 = Number(dist.count4 ?? dist['4'] ?? 0);
        const c5 = Number(dist.count5 ?? dist['5'] ?? 0);
        const total = c1 + c2 + c3 + c4 + c5;
        const weightedSum = (1 * c1) + (2 * c2) + (3 * c3) + (4 * c4) + (5 * c5);
        const calculatedAvg = total > 0 ? parseFloat((weightedSum / total).toFixed(4)) : 0.0;
        const effectiveAvg = (configDoc.displayRating !== undefined && configDoc.displayRating > 0)
          ? configDoc.displayRating
          : calculatedAvg;
        const effectiveTotal = (configDoc.displayCount !== undefined && configDoc.displayCount > 0)
          ? configDoc.displayCount
          : total;

        editorialSummary = {
          enabled: true,
          displayRating: effectiveAvg,
          displayCount: effectiveTotal,
          editorialLabel: configDoc.editorialLabel || 'Curated Editorial Highlights',
          distribution: {
            1: c1,
            2: c2,
            3: c3,
            4: c4,
            5: c5,
            count1: c1,
            count2: c2,
            count3: c3,
            count4: c4,
            count5: c5
          }
        };
      }
    } catch (e) {}

    return res.json({
      mode,
      ...genuineSummary,
      editorialSummary
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve reviews summary: ' + err.message });
  }
});

/**
 * GET /api/reviews
 * Paginated reviews wall (5 reviews per page).
 */
router.get('/', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(10, Math.max(1, parseInt(req.query.limit, 10) || 5));
    const skip = (page - 1) * limit;

    const source = (req.query.source === 'editorial' || req.query.source === 'configured') ? 'editorial' : 'user';
    const filter = {
      source,
      status: 'published',
      reviewText: { $exists: true, $ne: '' }
    };

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('displayName username avatarUrl rating reviewText submittedAt userRole status')
        .lean(),
      Review.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.json({
      reviews: reviews.map(r => ({ ...r, id: r._id.toString() })),
      page,
      limit,
      totalPages,
      totalReviews: total
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve reviews: ' + err.message });
  }
});

/**
 * GET /api/reviews/user-status
 * Inspects whether authenticated user has already rated or dismissed the rating popup.
 */
router.get('/user-status', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ isAnonymous: true, hasRated: false, hasDismissed: false, isAdmin: false });
    }

    const token = authHeader.split(' ')[1];
    // Optional decoding without crashing on invalid token
    let decoded = null;
    try {
      const jwt = (await import('jsonwebtoken')).default;
      decoded = jwt.decode(token);
    } catch (e) {}

    if (!decoded || !decoded.userId) {
      return res.json({ isAnonymous: true, hasRated: false, hasDismissed: false, isAdmin: false });
    }

    const user = await User.findById(decoded.userId).select('role ratingPopupStatus').lean();
    if (!user) {
      return res.json({ isAnonymous: true, hasRated: false, hasDismissed: false, isAdmin: false });
    }

    if (user.role === 'admin') {
      return res.json({ isAnonymous: false, hasRated: true, hasDismissed: true, isAdmin: true, existingReview: null });
    }

    let existingReview = null;
    const rev = await Review.findOne({
      userId: user._id,
      campaign: 'general',
      source: 'user'
    }).lean();

    if (rev) {
      existingReview = {
        rating: rev.rating,
        reviewText: rev.reviewText || '',
        submittedAt: rev.submittedAt
      };
    }

    return res.json({
      isAnonymous: false,
      hasRated: Boolean(user.ratingPopupStatus?.hasRated || rev),
      hasDismissed: Boolean(user.ratingPopupStatus?.hasDismissed),
      isAdmin: false,
      existingReview
    });
  } catch (err) {
    return res.json({ isAnonymous: true, hasRated: false, hasDismissed: false, isAdmin: false });
  }
});

// ============================================================================
// AUTHENTICATED USER ENDPOINTS
// ============================================================================

/**
 * POST /api/reviews
 * Submits genuine user rating (1-5) and optional review text.
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userDoc = req.user;
    if (!userDoc || !userDoc._id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admins must NEVER submit ratings/reviews into genuine pool
    if (userDoc.role === 'admin') {
      return res.status(403).json({ error: 'Admin accounts cannot submit user reviews' });
    }

    const rawRating = req.body?.rating;
    const ratingNum = parseInt(rawRating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5 stars' });
    }

    const rawText = req.body?.reviewText || '';
    const cleanReviewText = sanitizeText(rawText).slice(0, 1000);
    const campaign = (req.body?.campaign || 'general').trim().toLowerCase().slice(0, 50);

    const displayName = (userDoc.displayName && userDoc.displayName.trim()) || userDoc.username || 'Music Lover';
    const avatarUrl = userDoc.avatarUrl || '';

    // Check for existing rating by this user in this campaign
    let review = await Review.findOne({
      userId: userDoc._id,
      campaign,
      source: 'user'
    });

    if (review) {
      // Update existing rating & review
      review.rating = ratingNum;
      review.reviewText = cleanReviewText;
      review.displayName = displayName;
      review.avatarUrl = avatarUrl;
      review.status = 'published';
      review.submittedAt = new Date();
      await review.save();
    } else {
      // Create new genuine review
      review = await Review.create({
        userId: userDoc._id,
        username: userDoc.username,
        displayName,
        avatarUrl,
        rating: ratingNum,
        reviewText: cleanReviewText,
        status: 'published',
        source: 'user',
        campaign,
        userRole: 'user',
        submittedAt: new Date()
      });
    }

    // Persist popup status to user model
    userDoc.ratingPopupStatus = {
      hasRated: true,
      hasDismissed: false,
      lastDismissedAt: null,
      ratedAt: new Date()
    };
    await userDoc.save();

    return res.status(201).json({
      success: true,
      message: 'Thank you for rating Loopra!',
      review: {
        id: review._id,
        rating: review.rating,
        reviewText: review.reviewText,
        displayName: review.displayName,
        submittedAt: review.submittedAt
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'You have already submitted a rating for this campaign' });
    }
    return res.status(500).json({ error: 'Failed to submit rating: ' + err.message });
  }
});

/**
 * POST /api/reviews/dismiss-popup
 * Persists dismissal ("Maybe Later") to user model in MongoDB.
 */
router.post('/dismiss-popup', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const userId = user?._id || user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await User.findByIdAndUpdate(userId, {
      $set: {
        'ratingPopupStatus.hasDismissed': true,
        'ratingPopupStatus.lastDismissedAt': new Date()
      }
    });

    return res.json({ success: true, message: 'Rating prompt postponed' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to dismiss rating prompt: ' + err.message });
  }
});

// ============================================================================
// ADMIN MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/reviews/real OR /api/reviews/admin/real
 * Lists real user ratings and reviews with filters, search, and pagination.
 */
router.get(['/admin/real', '/real'], authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    const filter = { source: 'user' };

    if (req.query.rating && !isNaN(parseInt(req.query.rating, 10))) {
      filter.rating = parseInt(req.query.rating, 10);
    }

    if (req.query.status && ['published', 'hidden', 'flagged'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.search && typeof req.query.search === 'string') {
      const q = req.query.search.trim();
      if (q) {
        filter.$or = [
          { displayName: { $regex: q, $options: 'i' } },
          { username: { $regex: q, $options: 'i' } },
          { reviewText: { $regex: q, $options: 'i' } }
        ];
      }
    }

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter)
    ]);

    // Compute genuine summary
    const statsResult = await Review.aggregate([
      { $match: { source: 'user' } },
      {
        $group: {
          _id: null,
          totalRatings: { $sum: 1 },
          totalPublished: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
          totalHidden: { $sum: { $cond: [{ $eq: ['$status', 'hidden'] }, 1, 0] } },
          totalReviewsWithText: {
            $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$reviewText', ''] } }, 0] }, 1, 0] }
          },
          sumRating: { $sum: '$rating' },
          count1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          count2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          count3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          count4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          count5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } }
        }
      }
    ]);

    const stat = statsResult[0] || {
      totalRatings: 0,
      totalPublished: 0,
      totalHidden: 0,
      totalReviewsWithText: 0,
      sumRating: 0,
      count1: 0, count2: 0, count3: 0, count4: 0, count5: 0
    };

    const averageRating = stat.totalRatings > 0 
      ? parseFloat((stat.sumRating / stat.totalRatings).toFixed(1)) 
      : 0.0;

    return res.json({
      reviews,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      total,
      summary: {
        totalRatings: stat.totalRatings,
        totalPublished: stat.totalPublished,
        totalHidden: stat.totalHidden,
        totalReviewsWithText: stat.totalReviewsWithText,
        averageRating,
        distribution: {
          1: stat.count1,
          2: stat.count2,
          3: stat.count3,
          4: stat.count4,
          5: stat.count5
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch admin reviews: ' + err.message });
  }
});

/**
 * PATCH /api/admin/reviews/real/:id/status
 * Moderates real review visibility (publish/unpublish) without corrupting genuine rating metrics.
 */
router.patch(['/admin/real/:id/status', '/real/:id/status'], authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['published', 'hidden', 'flagged'].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Allowed: 'published', 'hidden', 'flagged'" });
    }

    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, source: 'user' },
      { $set: { status } },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    return res.json({ success: true, review });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update review status: ' + err.message });
  }
});

/**
 * DELETE /api/admin/reviews/real/:id
 * Removes a genuine review record after confirmation.
 */
router.delete(['/admin/real/:id', '/real/:id'], authenticateToken, requireAdmin, async (req, res) => {
  try {
    const review = await Review.findOneAndDelete({ _id: req.params.id, source: 'user' });
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    return res.json({ success: true, message: 'Review deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete review: ' + err.message });
  }
});

/**
 * GET /api/admin/reviews/configured
 * Retrieves configured/editorial reviews and settings.
 */
router.get(['/admin/configured', '/configured', '/admin/editorial', '/editorial'], authenticateToken, requireAdmin, async (req, res) => {
  try {
    let settings = await ConfiguredReviewsSettings.findOne({ key: 'default_configured_reviews' }).lean();
    if (!settings) {
      settings = {
        enabled: false,
        displayRating: 4.3,
        displayCount: 150,
        editorialLabel: 'Curated Editorial Highlights',
        distribution: { count1: 5, count2: 8, count3: 12, count4: 35, count5: 90 }
      };
    } else if (!settings.distribution) {
      settings.distribution = { count1: 0, count2: 0, count3: 0, count4: 0, count5: 0 };
    }

    const reviews = await Review.find({ source: 'editorial' }).sort({ submittedAt: -1 }).lean();

    return res.json({ settings, reviews: reviews.map(r => ({ ...r, id: r._id.toString() })) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch configured reviews: ' + err.message });
  }
});

/**
 * POST /api/admin/reviews/configured
 * Adds a new configured/editorial review.
 */
router.post(['/admin/configured', '/configured', '/admin/editorial', '/editorial'], authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { displayName, rating, reviewText, status = 'published' } = req.body;
    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    const review = await Review.create({
      userId: null,
      username: 'editorial',
      displayName: sanitizeText(displayName) || 'Verified Listener',
      avatarUrl: '',
      rating: ratingNum,
      reviewText: sanitizeText(reviewText).slice(0, 1000),
      status: ['published', 'hidden'].includes(status) ? status : 'published',
      source: 'editorial',
      campaign: 'editorial',
      userRole: 'user',
      submittedAt: new Date()
    });

    return res.status(201).json({ success: true, review });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create configured review: ' + err.message });
  }
});

/**
 * PUT /api/admin/reviews/configured/:id
 * Updates an editorial/configured review.
 */
router.put(['/admin/configured/:id', '/configured/:id', '/admin/editorial/:id', '/editorial/:id'], authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { displayName, rating, reviewText, status } = req.body;
    const updateData = {};

    if (displayName !== undefined) updateData.displayName = sanitizeText(displayName) || 'Verified Listener';
    if (rating !== undefined) {
      const r = parseInt(rating, 10);
      if (isNaN(r) || r < 1 || r > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }
      updateData.rating = r;
    }
    if (reviewText !== undefined) updateData.reviewText = sanitizeText(reviewText).slice(0, 1000);
    if (status && ['published', 'hidden'].includes(status)) updateData.status = status;

    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, source: 'editorial' },
      { $set: updateData },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ error: 'Configured review not found' });
    }

    return res.json({ success: true, review });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update configured review: ' + err.message });
  }
});

/**
 * PATCH /api/admin/reviews/configured/:id/status
 * Updates status of an editorial/configured review.
 */
router.patch(['/admin/configured/:id/status', '/configured/:id/status', '/admin/editorial/:id/status', '/editorial/:id/status'], authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['published', 'hidden'].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Allowed: 'published', 'hidden'" });
    }

    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, source: 'editorial' },
      { $set: { status } },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ error: 'Configured review not found' });
    }

    return res.json({ success: true, review });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update configured review status: ' + err.message });
  }
});

/**
 * DELETE /api/admin/reviews/configured/:id
 * Deletes an editorial/configured review.
 */
router.delete(['/admin/configured/:id', '/configured/:id', '/admin/editorial/:id', '/editorial/:id'], authenticateToken, requireAdmin, async (req, res) => {
  try {
    const review = await Review.findOneAndDelete({ _id: req.params.id, source: 'editorial' });
    if (!review) {
      return res.status(404).json({ error: 'Configured review not found' });
    }
    return res.json({ success: true, message: 'Configured review deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete configured review: ' + err.message });
  }
});

/**
 * POST /api/admin/reviews/configured-settings
 * Updates configured display rating, count, distribution, and enabled state.
 */
router.post(['/admin/configured-settings', '/configured-settings', '/admin/configured/settings', '/configured/settings'], authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { distribution, displayRating, displayCount, enabled, editorialLabel } = req.body;

    let c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0;
    let hasDistribution = false;

    if (distribution && typeof distribution === 'object') {
      c1 = parseInt(distribution.count1 ?? distribution['1'] ?? 0, 10);
      c2 = parseInt(distribution.count2 ?? distribution['2'] ?? 0, 10);
      c3 = parseInt(distribution.count3 ?? distribution['3'] ?? 0, 10);
      c4 = parseInt(distribution.count4 ?? distribution['4'] ?? 0, 10);
      c5 = parseInt(distribution.count5 ?? distribution['5'] ?? 0, 10);

      if (isNaN(c1) || c1 < 0 || isNaN(c2) || c2 < 0 || isNaN(c3) || c3 < 0 || isNaN(c4) || c4 < 0 || isNaN(c5) || c5 < 0) {
        return res.status(400).json({ error: 'Distribution counts must be non-negative integers' });
      }
      hasDistribution = true;
    }

    const updateDoc = {
      updatedBy: req.user?.username || 'admin'
    };

    if (hasDistribution) {
      const calculatedTotal = c1 + c2 + c3 + c4 + c5;
      const weightedSum = (1 * c1) + (2 * c2) + (3 * c3) + (4 * c4) + (5 * c5);
      const calculatedAvg = calculatedTotal > 0 ? parseFloat((weightedSum / calculatedTotal).toFixed(4)) : 0.0;
      updateDoc.distribution = {
        count1: c1,
        count2: c2,
        count3: c3,
        count4: c4,
        count5: c5
      };
      updateDoc.displayCount = calculatedTotal;
      updateDoc.displayRating = calculatedAvg;
    } else {
      if (displayCount !== undefined) {
        const parsedCount = parseInt(displayCount, 10);
        if (isNaN(parsedCount) || parsedCount < 0) {
          return res.status(400).json({ error: 'Display count must be a non-negative integer' });
        }
        updateDoc.displayCount = parsedCount;
      }
      if (displayRating !== undefined) {
        const parsedRating = parseFloat(parseFloat(displayRating).toFixed(4));
        if (isNaN(parsedRating) || parsedRating < 0 || parsedRating > 5) {
          return res.status(400).json({ error: 'Display rating must be between 0.0 and 5.0' });
        }
        updateDoc.displayRating = parsedRating;
      }
    }

    if (enabled !== undefined) {
      updateDoc.enabled = Boolean(enabled);
    }
    if (editorialLabel !== undefined) {
      updateDoc.editorialLabel = sanitizeText(editorialLabel) || 'Curated Editorial Highlights';
    }

    const existingDoc = await ConfiguredReviewsSettings.findOne({ key: 'default_configured_reviews' }).lean();
    if (!existingDoc && updateDoc.displayCount === undefined) {
      updateDoc.displayCount = 0;
      updateDoc.displayRating = 0.0;
      updateDoc.distribution = { count1: 0, count2: 0, count3: 0, count4: 0, count5: 0 };
    }

    const settings = await ConfiguredReviewsSettings.findOneAndUpdate(
      { key: 'default_configured_reviews' },
      { $set: updateDoc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, settings });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save configured settings: ' + err.message });
  }
});

export default router;
