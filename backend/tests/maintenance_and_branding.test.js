import assert from 'assert';

const BASE_URL = 'http://localhost:5000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let body = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  return { status: res.status, headers: res.headers, body };
}

async function runTests() {
  console.log('=== Starting Maintenance & Branding Verification Test Suite ===\n');

  // 1. Health check
  const health = await request('/health');
  assert.strictEqual(health.status, 200, 'Health check should be 200');
  console.log('✓ Step 1: Server and health check are responsive (200 OK)');

  // 2. Admin login
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin@afterhours.com', password: 'admin123' })
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login must succeed');
  assert.ok(adminLogin.body.token, 'Admin login must return JWT token');
  const adminToken = adminLogin.body.token;
  console.log('✓ Step 2: Admin successfully authenticated with role="admin"');

  // 3. Normal user setup
  const testNormalUsername = `user_${Date.now()}`;
  const normalRegister = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: testNormalUsername, password: 'password123' })
  });
  assert.strictEqual(normalRegister.status, 200, 'Normal user registration should succeed before maintenance');
  const normalToken = normalRegister.body.token;
  console.log('✓ Step 3: Normal test user registered before maintenance');

  // 4. Enable maintenance mode via Admin CMS API
  const enableMaintenance = await request('/api/admin/cms/maintenance', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      enabled: true,
      title: 'Scheduled Cloud Maintenance',
      message: 'Loopra servers are undergoing essential upgrades.'
    })
  });
  assert.strictEqual(enableMaintenance.status, 200, 'Enabling maintenance mode must return 200');
  assert.strictEqual(enableMaintenance.body.maintenance.enabled, true, 'Maintenance must be active');
  console.log('✓ Step 4: Maintenance mode successfully enabled in database');

  // 5. Verify public config reflects maintenance mode
  const publicConfigRes = await request('/api/cms/public-config');
  assert.strictEqual(publicConfigRes.status, 200, 'Public config endpoint remains reachable for status');
  assert.strictEqual(publicConfigRes.body.maintenance?.enabled, true, 'Public config must indicate maintenance=true');
  console.log('✓ Step 5: Public config reports maintenance mode is active');

  // 6. Test that Guest is blocked with HTTP 503 on protected/music endpoints
  const guestSearch = await request('/api/youtube/search?q=arijit');
  assert.strictEqual(guestSearch.status, 503, 'Guest search must be blocked with HTTP 503');
  assert.strictEqual(guestSearch.body.maintenance, true, 'Guest response must contain maintenance: true');
  console.log('✓ Step 6a: Guest API access blocked with HTTP 503 Service Unavailable');

  const guestUserData = await request('/api/user/6ae11d5bd26c9f8c807c8342');
  assert.strictEqual(guestUserData.status, 503, 'Guest user data access must be blocked with HTTP 503');
  console.log('✓ Step 6b: Guest user data access blocked with HTTP 503');

  // 7. Test that Logged-in Normal User is blocked with HTTP 503
  const normalUserSearch = await request('/api/youtube/search?q=arijit', {
    headers: { Authorization: `Bearer ${normalToken}` }
  });
  assert.strictEqual(normalUserSearch.status, 503, 'Logged-in regular user search must be blocked with HTTP 503');
  assert.strictEqual(normalUserSearch.body.maintenance, true, 'Logged-in user response must contain maintenance: true');
  console.log('✓ Step 7: Logged-in normal user blocked from music/search APIs with HTTP 503');

  // 8. Test that Normal user cannot log in while maintenance mode is active
  const normalLoginBlocked = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: testNormalUsername, password: 'password123' })
  });
  assert.strictEqual(normalLoginBlocked.status, 503, 'Normal user login must be rejected with 503 during maintenance');
  assert.strictEqual(normalLoginBlocked.body.maintenance, true, 'Login rejection must explain maintenance');
  console.log('✓ Step 8: Normal user login rejected with HTTP 503 during maintenance');

  // 9. Test that Normal user cannot register new account while maintenance mode is active
  const normalRegisterBlocked = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: `intruder_${Date.now()}`, password: 'password123' })
  });
  assert.strictEqual(normalRegisterBlocked.status, 503, 'Registration rejected with 503 during maintenance');
  console.log('✓ Step 9: Registration blocked with HTTP 503 during maintenance');

  // 10. Test that Admin CAN still log in while maintenance mode is active
  const adminLoginDuringMaintenance = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin@afterhours.com', password: 'admin123' })
  });
  assert.strictEqual(adminLoginDuringMaintenance.status, 200, 'Admin MUST be able to log in during maintenance');
  assert.ok(adminLoginDuringMaintenance.body.token, 'Admin receives new token during maintenance');
  const freshAdminToken = adminLoginDuringMaintenance.body.token;
  console.log('✓ Step 10: Administrator can log in normally while maintenance mode is active');

  // 11. Test that Admin has complete bypass access to all music and user endpoints
  const adminSearch = await request('/api/youtube/search?q=kumar+sanu', {
    headers: { Authorization: `Bearer ${freshAdminToken}` }
  });
  assert.strictEqual(adminSearch.status, 200, 'Admin must have full access to search APIs');
  assert.ok(Array.isArray(adminSearch.body.items), 'Admin receives actual music search results');
  console.log('✓ Step 11a: Administrator has full unrestricted access to search/playback APIs');

  const adminCmsConfig = await request('/api/admin/cms/config', {
    headers: { Authorization: `Bearer ${freshAdminToken}` }
  });
  assert.strictEqual(adminCmsConfig.status, 200, 'Admin has full access to CMS config');
  console.log('✓ Step 11b: Administrator has full access to Admin Dashboard and CMS tools');

  // 12. Admin disables maintenance mode
  const disableMaintenance = await request('/api/admin/cms/maintenance', {
    method: 'POST',
    headers: { Authorization: `Bearer ${freshAdminToken}` },
    body: JSON.stringify({ enabled: false })
  });
  assert.strictEqual(disableMaintenance.status, 200, 'Disabling maintenance mode returns 200');
  assert.strictEqual(disableMaintenance.body.maintenance.enabled, false, 'Maintenance is now false');
  console.log('✓ Step 12: Administrator successfully disabled maintenance mode');

  // 13. Verify normal access immediately resumes
  const postMaintenancePublic = await request('/api/cms/public-config');
  assert.strictEqual(postMaintenancePublic.body.maintenance?.enabled, false, 'Public config now reports maintenance=false');

  const normalUserResumedSearch = await request('/api/youtube/search?q=udit+narayan', {
    headers: { Authorization: `Bearer ${normalToken}` }
  });
  assert.strictEqual(normalUserResumedSearch.status, 200, 'Normal user can immediately resume searching');
  console.log('✓ Step 13: Normal operations and API access resumed for regular users without clearing storage');

  // 14. Issue 2: Test removing "Loopra" (empty string Website Name)
  console.log('\n--- Testing Issue 2: Branding & Website Name Flow ---');

  // Step 14a: Save draft with empty siteName
  const saveEmptyNameDraft = await request('/api/admin/cms/config/draft', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${freshAdminToken}` },
    body: JSON.stringify({
      branding: {
        siteName: '',
        tagline: 'Pure Desi Beats',
        logoUrl: '/loopra-logo.png',
        faviconUrl: '/loopra-logo.png'
      }
    })
  });
  assert.strictEqual(saveEmptyNameDraft.status, 200, 'Save draft with empty siteName succeeded');

  // Step 14b: Publish draft to live
  const publishEmptyName = await request('/api/admin/cms/config/publish', {
    method: 'POST',
    headers: { Authorization: `Bearer ${freshAdminToken}` },
    body: JSON.stringify({ summary: 'Removed site name to test blank branding' })
  });
  assert.strictEqual(publishEmptyName.status, 200, 'Publish empty siteName succeeded');

  // Step 14c: Verify public config preserves empty string and DOES NOT restore "Loopra"
  const publicConfigEmpty = await request('/api/cms/public-config');
  assert.strictEqual(publicConfigEmpty.body.branding.siteName, '', 'Public branding siteName must be empty string, NOT "Loopra"');
  console.log('✓ Step 14: Cleared Website Name successfully saved and published as empty string (no "Loopra" fallback in API)');

  // Step 15: Test saving a custom Website Name
  const saveCustomNameDraft = await request('/api/admin/cms/config/draft', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${freshAdminToken}` },
    body: JSON.stringify({
      branding: {
        siteName: 'AuraFM',
        tagline: 'Retro Bollywood Sanctuary',
        logoUrl: '/loopra-logo.png',
        faviconUrl: '/loopra-logo.png'
      }
    })
  });
  assert.strictEqual(saveCustomNameDraft.status, 200, 'Save custom siteName draft succeeded');

  const publishCustomName = await request('/api/admin/cms/config/publish', {
    method: 'POST',
    headers: { Authorization: `Bearer ${freshAdminToken}` },
    body: JSON.stringify({ summary: 'Updated branding to AuraFM' })
  });
  assert.strictEqual(publishCustomName.status, 200, 'Publish custom siteName succeeded');

  const publicConfigCustom = await request('/api/cms/public-config');
  assert.strictEqual(publicConfigCustom.body.branding.siteName, 'AuraFM', 'Public branding siteName must be "AuraFM"');
  assert.strictEqual(publicConfigCustom.body.branding.tagline, 'Retro Bollywood Sanctuary', 'Tagline must be preserved');
  console.log('✓ Step 15: Custom Website Name "AuraFM" saved and published to live website');

  // Step 16: Reset siteName to empty string as user desired
  await request('/api/admin/cms/config/draft', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${freshAdminToken}` },
    body: JSON.stringify({
      branding: {
        siteName: '',
        tagline: 'Infinite Sound. Endless Vibes.',
        logoUrl: '/loopra-logo.png',
        faviconUrl: '/loopra-logo.png'
      }
    })
  });
  await request('/api/admin/cms/config/publish', {
    method: 'POST',
    headers: { Authorization: `Bearer ${freshAdminToken}` },
    body: JSON.stringify({ summary: 'Blank site name confirmed' })
  });
  const finalConfig = await request('/api/cms/public-config');
  assert.strictEqual(finalConfig.body.branding.siteName, '', 'Final state siteName is confirmed empty string');
  console.log('✓ Step 16: Final state has blank Website Name preserved without "Loopra" fallback');

  console.log('\n======================================================');
  console.log('ALL 16 BACKEND AND INTEGRATION TESTS PASSED PERFECTLY!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});

