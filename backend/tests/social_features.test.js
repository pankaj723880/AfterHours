import assert from 'node:assert';
import http from 'node:http';

const BASE_URL = 'http://localhost:5000';

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runSocialFeaturesTest() {
  console.log('=== STARTING SOCIAL & COLLABORATIVE PLAYLIST TEST SUITE ===\n');
  const timestamp = Date.now();

  // 1. Register User A (Owner)
  const userAEmail = `owner_${timestamp}@test.com`;
  const resA = await makeRequest('POST', '/api/auth/register', {
    username: `Owner_${timestamp}`,
    email: userAEmail,
    password: 'Password123!'
  });
  assert.ok([200, 201].includes(resA.status), 'User A registered');
  const tokenA = resA.body.token;
  const userAId = resA.body.user.id || resA.body.user._id;

  // 2. Register User B (Collaborator)
  const userBEmail = `collab_${timestamp}@test.com`;
  const resB = await makeRequest('POST', '/api/auth/register', {
    username: `Collab_${timestamp}`,
    email: userBEmail,
    password: 'Password123!'
  });
  assert.ok([200, 201].includes(resB.status), 'User B registered');
  const tokenB = resB.body.token;
  const userBId = resB.body.user.id || resB.body.user._id;

  // 3. User A creates a playlist in their profile
  const playlistId = `pl_${timestamp}`;
  const updateRes = await makeRequest('POST', `/api/user/${userAId}/sync`, {
    playlists: [{
      id: playlistId,
      name: 'Retro Summer Jams',
      isPublic: true,
      songs: []
    }]
  }, tokenA);
  assert.strictEqual(updateRes.status, 200, 'User A saved playlist');
  console.log('[PASS] User A created playlist in library');

  // 4. User A generates an invite token
  const inviteRes = await makeRequest('POST', `/api/user/playlist/${playlistId}/invite`, {}, tokenA);
  assert.strictEqual(inviteRes.status, 200, 'Invite generated');
  assert.ok(inviteRes.body.inviteToken, 'Invite token exists');
  const inviteToken = inviteRes.body.inviteToken;
  console.log('[PASS] Generated collaboration invite token:', inviteToken.slice(0, 15) + '...');

  // 5. User B joins using the invite token
  const joinRes = await makeRequest('POST', '/api/user/playlist/collaborate/join', {
    inviteToken
  }, tokenB);
  assert.strictEqual(joinRes.status, 200, 'User B joined playlist');
  assert.strictEqual(joinRes.body.role, 'editor', 'User B granted editor role');
  console.log('[PASS] User B joined playlist as editor');

  // 6. User B adds a track to User A's collaborative playlist
  const trackData = {
    id: 'vid_collab_123',
    title: 'Collaborative Track',
    artist: 'Retro Star',
    thumbnail: 'https://example.com/art.jpg'
  };
  const addTrackRes = await makeRequest('POST', `/api/user/playlist/${playlistId}/tracks`, {
    track: trackData
  }, tokenB);
  assert.strictEqual(addTrackRes.status, 200, 'Track added by collaborator');
  assert.strictEqual(addTrackRes.body.songsCount, 1, 'Songs count incremented to 1');
  console.log('[PASS] Collaborator (User B) added track to playlist');

  // 7. Check playlist view returns accurate info and user role
  const getPlRes = await makeRequest('GET', `/api/user/playlist/${playlistId}`, null, tokenB);
  assert.strictEqual(getPlRes.status, 200, 'Get playlist succeeds');
  assert.strictEqual(getPlRes.body.userRole, 'editor', 'Role is editor for user B');
  assert.strictEqual(getPlRes.body.playlist.songs.length, 1, 'Playlist contains 1 track');
  console.log('[PASS] Playlist details fetched with permission metadata');

  // 8. User B removes the track
  const removeTrackRes = await makeRequest('DELETE', `/api/user/playlist/${playlistId}/tracks/vid_collab_123`, null, tokenB);
  assert.strictEqual(removeTrackRes.status, 200, 'Track removed by collaborator');
  assert.strictEqual(removeTrackRes.body.songsCount, 0, 'Songs count returned to 0');
  console.log('[PASS] Collaborator (User B) removed track');

  // 9. User A revokes User B's collaborator access
  const revokeRes = await makeRequest('DELETE', `/api/user/playlist/${playlistId}/collaborator/${userBId}`, null, tokenA);
  assert.strictEqual(revokeRes.status, 200, 'Collaborator removed');
  console.log('[PASS] Playlist owner successfully revoked collaborator permissions');

  // 10. User B attempts to add track after revocation (Expect 403 / 404)
  const unauthorizedAdd = await makeRequest('POST', `/api/user/playlist/${playlistId}/tracks`, {
    track: trackData
  }, tokenB);
  assert.ok([403, 404].includes(unauthorizedAdd.status), 'Revoked user denied track editing');
  console.log('[PASS] Revoked collaborator denied subsequent write operations (403/404)');

  console.log('\n=== SOCIAL & COLLABORATIVE PLAYLIST TESTS COMPLETED: ALL PASSED ===');
}

runSocialFeaturesTest().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
