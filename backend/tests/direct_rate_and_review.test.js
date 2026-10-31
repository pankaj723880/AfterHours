import assert from 'assert';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Review from '../models/Review.js';
import { generateToken } from '../middleware/auth.js';

const BACKEND_URL = 'http://localhost:5000';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours';

async function runTests() {
  console.log('=== RUNNING TESTS: DIRECT RATE & REVIEW SUBMISSION & PERSISTENCE ===');

  await mongoose.connect(MONGODB_URI);

  const testUser = await User.findOneAndUpdate(
    { username: 'direct_reviewer_tester@loopra.test' },
    {
      username: 'direct_reviewer_tester@loopra.test',
      email: 'direct_reviewer_tester@loopra.test',
      displayName: 'Direct Reviewer Test',
      password: 'dummy_hash_pass',
      role: 'user',
      status: 'active'
    },
    { upsert: true, new: true }
  );

  const adminUser = await User.findOneAndUpdate(
    { username: 'admin_test_reviewer@loopra.test' },
    {
      username: 'admin_test_reviewer@loopra.test',
      email: 'admin_test_reviewer@loopra.test',
      password: 'dummy_hash_pass',
      role: 'admin',
      status: 'active'
    },
    { upsert: true, new: true }
  );

  const userToken = generateToken(testUser);
  const adminToken = generateToken(adminUser);

  // Clean any previous reviews from this test user
  await Review.deleteMany({ userId: testUser._id });

  try {
    console.log('\n--- Test 1: Submit Rating Only (No Review Text) ---');
    const res1 = await fetch(`${BACKEND_URL}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({ rating: 5 })
    });

    const data1 = await res1.json();
    assert.strictEqual(res1.status, 201, `Expected 201 Created, got ${res1.status}`);
    assert.strictEqual(data1.success, true);
    assert.strictEqual(data1.review.rating, 5);
    assert.strictEqual(data1.review.reviewText, '');

    const savedInDb1 = await Review.findOne({ userId: testUser._id });
    assert.ok(savedInDb1, 'Review must exist in MongoDB');
    assert.strictEqual(savedInDb1.rating, 5);
    assert.strictEqual(savedInDb1.reviewText, '');
    console.log('✓ Rating submitted without review text and verified in MongoDB!');

    console.log('\n--- Test 2: Verify /api/reviews/user-status Returns Existing Review ---');
    const statusRes = await fetch(`${BACKEND_URL}/api/reviews/user-status`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    const statusData = await statusRes.json();
    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusData.hasRated, true);
    assert.ok(statusData.existingReview, 'existingReview object must be present');
    assert.strictEqual(statusData.existingReview.rating, 5);
    console.log('✓ /api/reviews/user-status returned existing rating (5 stars)!');

    console.log('\n--- Test 3: Update Existing Rating & Add Review Text (No Duplicate Records) ---');
    const res2 = await fetch(`${BACKEND_URL}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({
        rating: 4,
        reviewText: 'Loopra retro radio player is mesmerizing!'
      })
    });
    const data2 = await res2.json();
    assert.strictEqual(res2.status, 201);
    assert.strictEqual(data2.review.rating, 4);
    assert.strictEqual(data2.review.reviewText, 'Loopra retro radio player is mesmerizing!');

    const countInDb = await Review.countDocuments({ userId: testUser._id });
    assert.strictEqual(countInDb, 1, `Must have exactly 1 record (no duplicates), found: ${countInDb}`);

    const updatedInDb = await Review.findOne({ userId: testUser._id });
    assert.strictEqual(updatedInDb.rating, 4);
    assert.strictEqual(updatedInDb.reviewText, 'Loopra retro radio player is mesmerizing!');
    console.log('✓ Existing review successfully updated in MongoDB with zero duplicate records!');

    console.log('\n--- Test 4: Verify Admin Accounts are Blocked from Genuine Pool ---');
    const adminRes = await fetch(`${BACKEND_URL}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ rating: 5, reviewText: 'Admin test' })
    });
    assert.strictEqual(adminRes.status, 403, `Admins must be rejected with 403, got ${adminRes.status}`);
    console.log('✓ Admin accounts strictly prevented from contaminating genuine user ratings pool!');

    console.log('\n--- Test 5: Reject Invalid Ratings (< 1 or > 5) ---');
    const invalidRes = await fetch(`${BACKEND_URL}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify({ rating: 7 })
    });
    assert.strictEqual(invalidRes.status, 400);
    console.log('✓ Invalid ratings (rating > 5) safely rejected with 400 Bad Request!');

    console.log('\n======================================================');
    console.log('ALL DIRECT RATE & REVIEW BACKEND TESTS PASSED 100%!');
    console.log('======================================================\n');
  } finally {
    await Review.deleteMany({ userId: testUser._id });
    await User.deleteMany({ _id: { $in: [testUser._id, adminUser._id] } });
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

