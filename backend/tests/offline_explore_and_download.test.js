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
  } else if (contentType.includes('audio/')) {
    const arrayBuffer = await res.arrayBuffer();
    body = Buffer.from(arrayBuffer);
  } else {
    body = await res.text();
  }
  return { status: res.status, headers: res.headers, body };
}

async function runTests() {
  console.log('=== Starting Offline Explore & Download Test Suite ===\n');

  // Test 1: Fetch authorized offline-eligible catalog
  console.log('Test 1: Retrieving verified offline-eligible catalog...');
  const catRes = await request('/api/offline/authorized-tracks');
  assert.strictEqual(catRes.status, 200, 'Catalog endpoint should return 200 OK');
  assert.strictEqual(catRes.body.success, true, 'Catalog response should be success: true');
  assert.ok(Array.isArray(catRes.body.tracks), 'Response should include tracks array');
  assert.ok(catRes.body.tracks.length >= 2, 'Should return at least 2 seeded authorized tracks');
  assert.ok(catRes.body.totalEligibleInCatalog >= 2, 'totalEligibleInCatalog should be >= 2');

  for (const track of catRes.body.tracks) {
    assert.strictEqual(track.offlineEligible, true, 'Every catalog track must have offlineEligible: true');
    assert.strictEqual(track.license.permissionScope, 'offline_download_permitted', 'Permission must be offline_download_permitted');
    assert.ok(track.license.downloadEndpoint, 'Track must have an authorized download endpoint');
    assert.ok(track.title, 'Track must have a title');
    assert.ok(track.artist, 'Track must have an artist');
  }
  console.log(`✓ Test 1 Passed: Retrieved ${catRes.body.tracks.length} verified tracks with complete licensing metadata.`);

  // Test 2: Search filtering by Title
  console.log('\nTest 2: Search within verified catalog by title ("Mehfil")...');
  const searchTitle = await request('/api/offline/authorized-tracks?q=Mehfil');
  assert.strictEqual(searchTitle.status, 200);
  assert.strictEqual(searchTitle.body.success, true);
  assert.strictEqual(searchTitle.body.query, 'Mehfil');
  assert.ok(searchTitle.body.tracks.length >= 1, 'Search for "Mehfil" should match track');
  assert.ok(searchTitle.body.tracks.every(t => t.title.toLowerCase().includes('mehfil')), 'All returned tracks must match query');
  console.log(`✓ Test 2 Passed: Title search matched ${searchTitle.body.tracks.length} track(s) accurately.`);

  // Test 3: Case-insensitive search by Artist
  console.log('\nTest 3: Case-insensitive search by artist ("acoustic heritage")...');
  const searchArtist = await request('/api/offline/authorized-tracks?q=acoustic+heritage');
  assert.strictEqual(searchArtist.status, 200);
  assert.ok(searchArtist.body.tracks.length >= 1, 'Search for artist should match');
  assert.ok(searchArtist.body.tracks.some(t => t.artist.toLowerCase().includes('acoustic heritage')), 'Matched track artist');
  console.log(`✓ Test 3 Passed: Case-insensitive artist search matched accurately.`);

  // Test 4: Exclusion of unverified YouTube streams
  console.log('\nTest 4: Strict exclusion of standard YouTube streaming-only tracks from search...');
  const youtubeSearch = await request('/api/offline/authorized-tracks?q=taylor+swift+streaming_only_youtube_xyz');
  assert.strictEqual(youtubeSearch.status, 200);
  assert.strictEqual(youtubeSearch.body.tracks.length, 0, 'Must never return unverified YouTube tracks in offline catalog');
  assert.strictEqual(youtubeSearch.body.total, 0, 'Total matching should be 0');
  assert.ok(youtubeSearch.body.totalEligibleInCatalog > 0, 'Total eligible in catalog remains positive (no matches != empty catalog)');
  console.log('✓ Test 4 Passed: Unverified YouTube streams strictly excluded; distinction between 0 search matches and total catalogue verified.');

  // Test 5: Pagination support
  console.log('\nTest 5: Pagination support (page=1, limit=1)...');
  const pageRes = await request('/api/offline/authorized-tracks?page=1&limit=1');
  assert.strictEqual(pageRes.status, 200);
  assert.strictEqual(pageRes.body.tracks.length, 1, 'Limit 1 should return exactly 1 track');
  assert.strictEqual(pageRes.body.page, 1);
  assert.strictEqual(pageRes.body.limit, 1);
  assert.ok(pageRes.body.totalPages >= 2, 'Total pages should reflect limit=1');
  console.log(`✓ Test 5 Passed: Pagination verified (page 1 of ${pageRes.body.totalPages}).`);

  // Test 6: Download verified track audio bytes
  console.log('\nTest 6: Download authorized audio stream for eligible track...');
  const dlTrack = catRes.body.tracks[0];
  const dlRes = await request(`/api/offline/download/${encodeURIComponent(dlTrack.id)}`);
  assert.strictEqual(dlRes.status, 200, 'Download endpoint should return 200 for authorized track');
  const contentType = dlRes.headers.get('content-type');
  assert.ok(contentType.includes('audio/wav') || contentType.includes('audio/'), 'Content-Type should be audio');
  assert.ok(Buffer.isBuffer(dlRes.body), 'Response should be raw binary audio Buffer');
  assert.ok(dlRes.body.length > 500000, `Audio binary size should be substantial (got ${dlRes.body.length} bytes)`);
  // Verify RIFF WAV header
  const riffHeader = dlRes.body.slice(0, 4).toString('ascii');
  const waveHeader = dlRes.body.slice(8, 12).toString('ascii');
  assert.strictEqual(riffHeader, 'RIFF', 'Audio buffer must contain valid RIFF header');
  assert.strictEqual(waveHeader, 'WAVE', 'Audio buffer must contain valid WAVE format');
  console.log(`✓ Test 6 Passed: Downloaded genuine audio file (${dlRes.body.length} bytes, valid RIFF/WAVE PCM audio).`);

  // Test 7: Unauthorized track download rejection (403 Forbidden)
  console.log('\nTest 7: Attempting unauthorized download of unverified YouTube track...');
  const unauthRes = await request('/api/offline/download/dQw4w9WgXcQ_youtube_only');
  assert.strictEqual(unauthRes.status, 403, 'Unauthorized track download must return 403 Forbidden');
  const errText = typeof unauthRes.body === 'string' ? unauthRes.body : JSON.stringify(unauthRes.body || {});
  assert.ok(errText.includes('Forbidden') || errText.includes('streaming-only'), 'Must explain streaming-only policy');
  console.log('✓ Test 7 Passed: Unauthorized track download rejected with HTTP 403 Forbidden.');

  // Test 8: Batch eligibility verification API
  console.log('\nTest 8: Batch eligibility check endpoint...');
  const batchRes = await request('/api/offline/eligibility/batch', {
    method: 'POST',
    body: JSON.stringify({
      trackIds: [dlTrack.id, 'unauthorized_youtube_stream_99']
    })
  });
  assert.strictEqual(batchRes.status, 200);
  assert.strictEqual(batchRes.body.success, true);
  const eligibleItem = batchRes.body.results.find(r => r.trackId === dlTrack.id);
  const ineligibleItem = batchRes.body.results.find(r => r.trackId === 'unauthorized_youtube_stream_99');
  assert.strictEqual(eligibleItem.offlineEligible, true, 'Authorized track must be eligible');
  assert.strictEqual(ineligibleItem.offlineEligible, false, 'Unverified track must be ineligible');
  console.log('✓ Test 8 Passed: Batch eligibility correctly validates authorized vs streaming-only tracks.');

  console.log('\n=== All 8 Offline Explore & Download Tests Passed Successfully! ===');
}

runTests().catch(err => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
