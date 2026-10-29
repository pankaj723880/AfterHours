import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Activity from '../models/Activity.js';
import OfflineTrackLicense from '../models/OfflineTrackLicense.js';
import { generateToken } from '../middleware/auth.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const HOST = 'localhost';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: HOST,
      port: PORT,
      ...options,
      headers: {
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(JSON.stringify(body)) } : {}),
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING ADMIN CRUD & WEBSITE MANAGEMENT AUDIT TESTS ===\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition, title) => {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}`);
      failed++;
    }
  };

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours');

    // 1. Setup Test Admin
    let admin = await User.findOne({ role: 'admin', status: 'active' });
    if (!admin) {
      admin = await User.create({
        username: 'crud_test_admin_' + Date.now(),
        password: 'hashedpassword123',
        role: 'admin',
        status: 'active'
      });
    }
    const adminToken = generateToken(admin);

    // 2. Setup Test Target User
    const targetUsername = 'test_crud_target_' + Date.now();
    const targetUser = await User.create({
      username: targetUsername,
      password: 'password123',
      role: 'user',
      status: 'active',
      displayName: 'Original Name',
      bio: 'Music enthusiast',
      playlists: [{ name: 'Retro Vibes', tracks: [{ id: 'track1' }] }]
    });
    const targetToken = generateToken(targetUser);

    // Create associated activity for cascade test
    const testActivity = await Activity.create({
      userId: targetUser._id,
      username: targetUser.username,
      displayName: targetUser.displayName,
      type: 'listen',
      track: { id: 'test_vid_123', title: 'Test Nostalgia Song', artist: 'Kumar Sanu' },
      isPublic: true
    });

    // TEST 1: Retrieve detailed user account & stats
    const getUserRes = await request({
      path: `/api/admin/users/${targetUser._id}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(getUserRes.status === 200, 'Admin retrieves detailed user profile with 200 OK');
    assert(getUserRes.data.displayName === 'Original Name', 'User details includes displayName');
    assert(Array.isArray(getUserRes.data.playlists) && getUserRes.data.playlists.length === 1, 'User details returns user playlists summary');

    // TEST 2: Admin edits user profile fields
    const updateProfileRes = await request({
      path: `/api/admin/users/${targetUser._id}/profile`,
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      displayName: 'Updated VIP Name',
      bio: 'Curated 90s specialist',
      avatarUrl: 'https://example.com/avatar.jpg',
      isPublic: true,
      shareListeningActivity: true
    });
    assert(updateProfileRes.status === 200, 'Admin updates user profile successfully with 200 OK');
    assert(updateProfileRes.data.user.displayName === 'Updated VIP Name', 'DisplayName persisted correctly');

    // TEST 3: Activity Feed Moderation List & Filter
    const activitiesListRes = await request({
      path: `/api/admin/activities?search=${encodeURIComponent('Test Nostalgia')}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(activitiesListRes.status === 200, 'Admin retrieves activity moderation feed with 200 OK');
    assert(Array.isArray(activitiesListRes.data.activities), 'Activities returned as array');
    assert(activitiesListRes.data.activities.some(a => a.id === testActivity._id.toString()), 'Target activity appears in moderation feed');

    // TEST 4: Activity Moderation Delete
    const deleteActRes = await request({
      path: `/api/admin/activities/${testActivity._id}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(deleteActRes.status === 200, 'Admin moderates/deletes activity item with 200 OK');
    const verifyActDeleted = await Activity.findById(testActivity._id);
    assert(!verifyActDeleted, 'Activity document removed from MongoDB');

    // TEST 5: Safeguard prevents self-deletion by administrator
    const selfDeleteRes = await request({
      path: `/api/admin/users/${admin._id}/permanent`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(selfDeleteRes.status === 400, 'Safeguard blocks administrator self-deletion with 400 Bad Request');

    // TEST 6: Permanent User Deletion with Cascade Cleanup
    const newActForCascade = await Activity.create({
      userId: targetUser._id,
      username: targetUser.username,
      type: 'like',
      track: { id: 'cascade_track', title: 'Cascade Check Song' },
      isPublic: true
    });
    const permDeleteRes = await request({
      path: `/api/admin/users/${targetUser._id}/permanent`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(permDeleteRes.status === 200, 'Admin permanently deletes user with 200 OK');
    const verifyUserDeleted = await User.findById(targetUser._id);
    assert(!verifyUserDeleted, 'Target user document completely removed from database');
    const verifyCascadeActivity = await Activity.findById(newActForCascade._id);
    assert(!verifyCascadeActivity, 'User activities cascaded and removed upon user permanent deletion');

    // TEST 7: Offline License CRUD (Create, Update, Delete)
    const testTrackId = 'lic_test_' + Date.now();
    const createLicRes = await request({
      path: '/api/offline/admin/licenses',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      trackId: testTrackId,
      title: 'Licensed Highway Melody',
      artist: 'Altaf Raja',
      offlineEligible: true,
      permissionScope: 'offline_download_permitted',
      licenseType: 'Direct-License',
      notes: 'Authorized offline demo'
    });
    assert(createLicRes.status === 201, 'Admin registers new offline license with 201 Created');

    const updateLicRes = await request({
      path: `/api/offline/admin/licenses/${testTrackId}`,
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      title: 'Licensed Highway Melody (Remastered)',
      notes: 'Updated terms'
    });
    assert(updateLicRes.status === 200, 'Admin updates offline license with 200 OK');
    assert(updateLicRes.data.license.title === 'Licensed Highway Melody (Remastered)', 'Updated license title persisted');

    const deleteLicRes = await request({
      path: `/api/offline/admin/licenses/${testTrackId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(deleteLicRes.status === 200, 'Admin revokes/deletes offline license with 200 OK');
    const verifyLicDeleted = await OfflineTrackLicense.findOne({ trackId: testTrackId });
    assert(!verifyLicDeleted, 'License record removed from database');

    // TEST 8: CMS Footer Info Pages in Draft Configuration
    const draftRes = await request({
      path: '/api/admin/cms/config',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(draftRes.status === 200, 'Admin retrieves CMS config with 200 OK');
    const currentDraft = draftRes.data.draft || {};
    const updatedFooter = {
      ...(currentDraft.footer || {}),
      infoPages: [
        { title: 'Terms of Use', slug: 'terms', content: '# Terms\nAll rights reserved.' },
        { title: 'Privacy Policy', slug: 'privacy', content: '# Privacy\nNo tracking.' }
      ]
    };
    const saveDraftRes = await request({
      path: '/api/admin/cms/config/draft',
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      ...currentDraft,
      footer: updatedFooter
    });
    assert(saveDraftRes.status === 200, 'Admin saves infoPages in CMS draft configuration with 200 OK');
    assert(saveDraftRes.data.draft.footer.infoPages.length === 2, 'Two custom info pages saved in footer draft');

    console.log(`\n=== TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED ===`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
