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

async function run() {
  console.log('Connecting to MongoDB for test user setup...');
  await mongoose.connect(MONGODB_URI);

  // Setup Admin user
  let admin = await User.findOne({ username: 'admin@afterhours.com' });
  if (!admin) {
    admin = await User.create({ username: 'admin@afterhours.com', password: 'password123', role: 'admin' });
  }
  const adminToken = generateToken(admin);

  // Setup Test User 1
  let user1 = await User.findOne({ username: 'testuser1_reviews' });
  if (!user1) {
    user1 = await User.create({ username: 'testuser1_reviews', password: 'password123', role: 'user', displayName: 'Aria Melody' });
  }
  const user1Token = generateToken(user1);

  // Setup Test User 2
  let user2 = await User.findOne({ username: 'testuser2_reviews' });
  if (!user2) {
    user2 = await User.create({ username: 'testuser2_reviews', password: 'password123', role: 'user', displayName: 'Rohan Beats' });
  }
  const user2Token = generateToken(user2);

  console.log('Testing Reviews API on port 5000...');

  // 1. GET /api/reviews/summary
  console.log('\n--- TEST 1: GET /api/reviews/summary ---');
  const sumRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/reviews/summary',
    method: 'GET'
  });
  console.log('Summary response status:', sumRes.status);
  assert.strictEqual(sumRes.status, 200);
  assert(typeof sumRes.data.averageRating === 'number', 'averageRating is numeric');
  assert(typeof sumRes.data.totalRatings === 'number', 'totalRatings is numeric');
  assert(sumRes.data.distribution !== undefined, 'distribution is present');
  console.log('[PASS] GET /api/reviews/summary returns valid structure:', sumRes.data);

  // 2. GET /api/reviews
  console.log('\n--- TEST 2: GET /api/reviews ---');
  const revRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/reviews?page=1&limit=5',
    method: 'GET'
  });
  console.log('Reviews response status:', revRes.status);
  assert.strictEqual(revRes.status, 200);
  assert(Array.isArray(revRes.data.reviews), 'reviews is an array');
  assert.strictEqual(revRes.data.limit, 5, 'limit is exactly 5');
  console.log('[PASS] GET /api/reviews returned paginated response');

  // 3. User submits star-only rating (no text)
  console.log('\n--- TEST 3: User submits star-only rating (no text) ---');
  const postStarRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/reviews',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user1Token}`
    }
  }, { rating: 5 });
  console.log('Star-only submit status:', postStarRes.status);
  assert.strictEqual(postStarRes.status, 201, 'Star-only rating accepted');
  console.log('[PASS] Star-only rating submission succeeded');

  // 4. Admin cannot submit review into genuine pool
  console.log('\n--- TEST 4: Admin cannot submit genuine review ---');
  const adminPostRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/reviews',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, { rating: 5, reviewText: 'Admin trying to review' });
  console.log('Admin post status:', adminPostRes.status);
  assert.strictEqual(adminPostRes.status, 403, 'Admin submission rejected with 403');
  console.log('[PASS] Admin correctly excluded from genuine reviews');

  // 5. User submits full review with text
  console.log('\n--- TEST 5: User submits rating with review text ---');
  const userPostRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/reviews',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user2Token}`
    }
  }, { rating: 5, reviewText: 'Loopra audio player and retro radio stations are absolutely stunning!' });
  console.log('User full review status:', userPostRes.status);
  assert([200, 201].includes(userPostRes.status), 'Full review submission accepted');
  console.log('[PASS] Full review submission succeeded');

  // 6. Check summary again: genuine ratings should now reflect user1 and user2
  console.log('\n--- TEST 6: Check Updated Summary ---');
  const sumRes2 = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/reviews/summary',
    method: 'GET'
  });
  console.log('Updated summary:', sumRes2.data);
  assert(sumRes2.data.totalRatings >= 2, 'Total genuine ratings increased');
  assert.strictEqual(sumRes2.data.averageRating, 5.0, 'Average rating is 5.0');
  console.log('[PASS] Genuine summary accurately recalculated');

  // 7. Admin Real Reviews view
  console.log('\n--- TEST 7: GET /api/admin/reviews/real ---');
  const adminRealRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/admin/reviews/real',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('Admin real reviews status:', adminRealRes.status);
  assert.strictEqual(adminRealRes.status, 200);
  assert(adminRealRes.data.summary !== undefined);
  assert(adminRealRes.data.summary.totalRatings >= 2);
  console.log('[PASS] Admin real reviews view succeeded, total ratings:', adminRealRes.data.summary.totalRatings);

  // 8. Admin Configured Reviews & Settings
  console.log('\n--- TEST 8: POST /api/admin/reviews/configured-settings ---');
  const configSetRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/admin/reviews/configured-settings',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, { displayRating: 4.9, displayCount: 2500, enabled: true, editorialLabel: 'Featured Community Highlights' });
  console.log('Configured settings status:', configSetRes.status);
  assert.strictEqual(configSetRes.status, 200);
  console.log('[PASS] Admin configured settings updated');

  // 9. Admin adds configured editorial review
  console.log('\n--- TEST 9: POST /api/admin/reviews/configured (Add editorial review) ---');
  const addEdRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/admin/reviews/configured',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    displayName: 'Music Critic Daily',
    rating: 5,
    reviewText: 'Loopra offers an unprecedented sonic sanctuary for retro Indian melodies.'
  });
  console.log('Add editorial status:', addEdRes.status);
  assert.strictEqual(addEdRes.status, 201);
  console.log('[PASS] Editorial configured review created');

  console.log('\n=== ALL REVIEWS API TESTS PASSED SUCCESSFULLY! ===');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
