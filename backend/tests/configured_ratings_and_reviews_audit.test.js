import assert from 'assert';
import mongoose from 'mongoose';
import http from 'http';
import User from '../models/User.js';
import Review from '../models/Review.js';
import ConfiguredReviewsSettings from '../models/ConfiguredReviewsSettings.js';
import { generateToken } from '../middleware/auth.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours';

const request = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, text: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
};

async function runTests() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  // Setup admin
  let admin = await User.findOne({ username: 'admin@afterhours.com' });
  if (!admin) {
    admin = await User.create({ username: 'admin@afterhours.com', password: 'password123', role: 'admin' });
  }
  const adminToken = generateToken(admin);

  console.log('\n======================================================');
  console.log('STARTING 10 MANDATORY CONFIGURED RATINGS & REVIEWS TESTS');
  console.log('======================================================\n');

  // Clean previous configured test reviews
  await Review.deleteMany({ source: 'editorial', reviewText: { $regex: /^\[TestConfigReview\]/ } });

  // TEST 1: Save configured counts (1: 5, 2: 8, 3: 12, 4: 35, 5: 90)
  console.log('--- TEST 1: Save configured counts (1:5, 2:8, 3:12, 4:35, 5:90) ---');
  const distCounts = {
    count1: 5,
    count2: 8,
    count3: 12,
    count4: 35,
    count5: 90
  };

  const saveRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/admin/reviews/configured-settings',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    enabled: true,
    editorialLabel: 'Curated Listener Highlights',
    distribution: distCounts
  });

  assert.strictEqual(saveRes.status, 200, 'POST /configured-settings should return 200');
  console.log('✓ TEST 1 PASSED: Configured ratings successfully saved');

  // TEST 2: Verify total = 150 and weighted average = 4.3133 approx
  console.log('\n--- TEST 2: Verify total = 150 and weighted average = 4.3133 ---');
  const settings = saveRes.data.settings;
  assert.strictEqual(settings.displayCount, 150, 'displayCount must be exactly 150');
  assert.strictEqual(Math.round(settings.displayRating * 10000) / 10000, 4.3133, 'displayRating must be 4.3133');
  console.log(`✓ TEST 2 PASSED: total = ${settings.displayCount}, displayRating = ${settings.displayRating}`);

  // TEST 3: Verify GET /api/reviews/summary returns configured summary with exact distribution & average
  console.log('\n--- TEST 3: GET /api/reviews/summary in Configured Mode ---');
  const summaryRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/reviews/summary',
    method: 'GET'
  });

  assert.strictEqual(summaryRes.status, 200);
  assert.strictEqual(summaryRes.data.mode, 'configured');
  assert(summaryRes.data.editorialSummary !== null, 'editorialSummary must not be null');
  assert.strictEqual(summaryRes.data.editorialSummary.enabled, true);
  assert.strictEqual(summaryRes.data.editorialSummary.displayCount, 150);
  assert.strictEqual(Math.round(summaryRes.data.editorialSummary.displayRating * 10000) / 10000, 4.3133);
  assert.strictEqual(summaryRes.data.editorialSummary.distribution[5], 90);
  assert.strictEqual(summaryRes.data.editorialSummary.distribution[4], 35);
  assert.strictEqual(summaryRes.data.editorialSummary.distribution[3], 12);
  assert.strictEqual(summaryRes.data.editorialSummary.distribution[2], 8);
  assert.strictEqual(summaryRes.data.editorialSummary.distribution[1], 5);
  // Verify Cache-Control headers
  assert(summaryRes.headers['cache-control'].includes('no-store'), 'Must include no-store header');
  console.log('✓ TEST 3 PASSED: Public summary accurately reflects configured ratings with no-store cache headers');

  // TEST 4: Add 6 configured reviews with status: 'published'
  console.log('\n--- TEST 4: Add 6 configured reviews (published) ---');
  const createdReviewIds = [];
  for (let i = 1; i <= 6; i++) {
    const postRevRes = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/admin/reviews/editorial',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      displayName: `Critic ${i}`,
      rating: 5,
      reviewText: `[TestConfigReview] Editorial review sample number ${i} for Loopra`,
      status: 'published'
    });
    assert.strictEqual(postRevRes.status, 201, `Review ${i} creation failed`);
    createdReviewIds.push(postRevRes.data.review._id || postRevRes.data.review.id);
  }
  console.log(`✓ TEST 4 PASSED: Created 6 published editorial reviews`);

  // TEST 5: Verify GET /api/reviews?page=1&limit=5&source=editorial returns exactly 5 reviews
  console.log('\n--- TEST 5: GET /api/reviews Page 1 (limit 5) ---');
  const page1Res = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/reviews?page=1&limit=5&source=editorial',
    method: 'GET'
  });
  assert.strictEqual(page1Res.status, 200);
  assert.strictEqual(page1Res.data.reviews.length, 5, 'Page 1 must contain exactly 5 reviews');
  assert.strictEqual(page1Res.data.page, 1);
  assert(page1Res.data.totalPages >= 2, 'Total pages must be at least 2');
  console.log('✓ TEST 5 PASSED: Page 1 returned exactly 5 configured reviews');

  // TEST 6: Verify GET /api/reviews?page=2&limit=5&source=editorial returns the 6th review
  console.log('\n--- TEST 6: GET /api/reviews Page 2 ---');
  const page2Res = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/reviews?page=2&limit=5&source=editorial',
    method: 'GET'
  });
  assert.strictEqual(page2Res.status, 200);
  assert.strictEqual(page2Res.data.page, 2);
  assert(page2Res.data.reviews.length >= 1, 'Page 2 must have at least 1 review');
  console.log(`✓ TEST 6 PASSED: Page 2 returned the remaining configured reviews (count: ${page2Res.data.reviews.length})`);

  // TEST 7: Unpublish one configured review (status: 'hidden') and verify it disappears from public reviews
  console.log('\n--- TEST 7: Unpublish one review & verify public list updates ---');
  const targetId = createdReviewIds[createdReviewIds.length - 1];
  const patchRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/admin/reviews/editorial/${targetId}/status`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, { status: 'hidden' });
  assert.strictEqual(patchRes.status, 200);

  // Check public reviews count now
  const countRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/reviews?page=1&limit=10&source=editorial',
    method: 'GET'
  });
  const foundTarget = countRes.data.reviews.find(r => r._id === targetId || r.id === targetId);
  assert(!foundTarget, 'Hidden review must not appear in public reviews');
  console.log('✓ TEST 7 PASSED: Unpublished review is cleanly excluded from public homepage reviews');

  // TEST 8: Switch to genuine mode (enabled: false) and verify genuine summary returned
  console.log('\n--- TEST 8: Switch to Genuine Mode (enabled: false) ---');
  const toggleOffRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/admin/reviews/configured-settings',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    enabled: false,
    distribution: distCounts
  });
  assert.strictEqual(toggleOffRes.status, 200);

  const genuineSumRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/reviews/summary',
    method: 'GET'
  });
  assert.strictEqual(genuineSumRes.status, 200);
  assert.strictEqual(genuineSumRes.data.mode, 'genuine');
  assert.strictEqual(genuineSumRes.data.editorialSummary, null, 'editorialSummary must be null when disabled');
  console.log('✓ TEST 8 PASSED: In genuine mode, editorialSummary is null and only genuine user stats are returned');

  // TEST 9: Switch back to configured mode (enabled: true) and verify saved data reappears
  console.log('\n--- TEST 9: Switch back to Configured Mode (enabled: true) ---');
  const toggleOnRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/admin/reviews/configured-settings',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    enabled: true
  });
  assert.strictEqual(toggleOnRes.status, 200);

  const reappearedSumRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/reviews/summary',
    method: 'GET'
  });
  assert.strictEqual(reappearedSumRes.data.mode, 'configured');
  assert.strictEqual(reappearedSumRes.data.editorialSummary.displayCount, 150);
  assert.strictEqual(Math.round(reappearedSumRes.data.editorialSummary.displayRating * 10000) / 10000, 4.3133);
  console.log('✓ TEST 9 PASSED: Configured ratings reappeared immediately upon re-enabling');

  // TEST 10: Verify persistence directly in MongoDB
  console.log('\n--- TEST 10: Persistence in Database ---');
  const savedDoc = await ConfiguredReviewsSettings.findOne({ key: 'default_configured_reviews' }).lean();
  assert(savedDoc !== null, 'Document must exist in MongoDB');
  assert.strictEqual(savedDoc.enabled, true);
  assert.strictEqual(savedDoc.displayCount, 150);
  assert.strictEqual(Math.round(savedDoc.displayRating * 10000) / 10000, 4.3133);
  assert.strictEqual(savedDoc.distribution.count5, 90);
  console.log('✓ TEST 10 PASSED: Verified permanent persistence of configured ratings and reviews in MongoDB');

  // Cleanup test reviews
  await Review.deleteMany({ _id: { $in: createdReviewIds } });
  console.log('\nCleaned up test review documents.');

  console.log('\n======================================================');
  console.log('ALL 10 MANDATORY CONFIGURED RATINGS & REVIEWS TESTS PASSED!');
  console.log('======================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});

