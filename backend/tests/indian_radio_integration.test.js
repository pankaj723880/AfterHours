import http from 'http';
import assert from 'assert';

const BASE_URL = 'http://localhost:5000';

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    }).on('error', reject);
  });
}

function getBinary(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      const chunks = [];
      let totalLength = 0;
      res.on('data', chunk => {
        chunks.push(chunk);
        totalLength += chunk.length;
        if (totalLength > 100000) {
          res.destroy();
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            totalBytes: totalLength
          });
        }
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          totalBytes: totalLength
        });
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- STARTING INDIAN RADIO INTEGRATION TEST SUITE ---\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}\n   Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Station Catalogue Endpoint
  await test('GET /api/radio/stations returns full verified Indian radio catalogue', async () => {
    const res = await get('/api/radio/stations');
    assert.strictEqual(res.statusCode, 200, 'Expected 200 OK');
    const json = JSON.parse(res.data);
    assert.strictEqual(json.success, true, 'Expected success: true');
    assert(Array.isArray(json.stations), 'Expected stations array');
    assert(json.stations.length >= 8, 'Expected at least 8 verified playable stations');
  });

  // 2. Priority Stations Exist
  await test('Catalogue contains all required priority Akashvani stations', async () => {
    const res = await get('/api/radio/stations');
    const json = JSON.parse(res.data);
    const stationIds = json.stations.map(s => s.id);
    
    assert(stationIds.includes('air-vividh-bharati'), 'Must contain Vividh Bharati');
    assert(stationIds.includes('air-fm-gold'), 'Must contain FM Gold');
    assert(stationIds.includes('air-fm-rainbow'), 'Must contain FM Rainbow');
    assert(stationIds.includes('air-raagam'), 'Must contain AIR Raagam');
    assert(stationIds.includes('air-national'), 'Must contain AIR National Channel');
  });

  // 3. Metadata Structure
  await test('Every station contains required verified metadata', async () => {
    const res = await get('/api/radio/stations');
    const json = JSON.parse(res.data);
    
    for (const station of json.stations) {
      assert(station.id, `Station must have id: ${JSON.stringify(station)}`);
      assert(station.name, `Station must have name: ${station.id}`);
      assert(station.genre, `Station must have genre: ${station.id}`);
      assert(station.language, `Station must have language: ${station.id}`);
      assert(station.category, `Station must have category: ${station.id}`);
      assert(station.officialSource, `Station must have officialSource: ${station.id}`);
      assert(station.officialWebsite?.startsWith('http'), `Station must have officialWebsite: ${station.id}`);
      assert(typeof station.isPlayable === 'boolean', `isPlayable must be boolean: ${station.id}`);
      assert.strictEqual(station.isPlayable, true, `All catalogue stations must be verified playable: ${station.id}`);
      assert(station.streamUrl, `All catalogue stations must have active streamUrl: ${station.id}`);
      assert(station.verificationStatus, `Station must have verificationStatus: ${station.id}`);
    }
  });

  // 4. Non-playable Stations Removal Verification
  await test('Non-working/unembeddable private stations are excluded from user-facing catalogue', async () => {
    const res = await get('/api/radio/stations');
    const json = JSON.parse(res.data);
    const excludedIds = ['radio-mirchi', 'red-fm', 'big-fm', 'fever-fm', 'radio-nasha', 'radiocity-hindi'];
    
    for (const id of excludedIds) {
      const station = json.stations.find(s => s.id === id);
      assert(!station, `Non-embeddable station ${id} must not be present in playable catalogue`);
    }
  });

  // 5. AIR Vividh Bharati Live Stream
  await test('AIR Vividh Bharati live HLS playlist returns 200 OK with CORS', async () => {
    const res = await get('/api/radio/stream/air-vividh-bharati/playlist.m3u8');
    assert.strictEqual(res.statusCode, 200, 'Expected 200 OK');
    assert(res.data.includes('#EXTM3U'), 'Expected m3u8 playlist format');
    assert.strictEqual(res.headers['access-control-allow-origin'], '*', 'Must have CORS header');
  });

  // 6. AIR FM Gold Live Stream
  await test('AIR FM Gold Delhi live HLS playlist returns 200 OK with CORS', async () => {
    const res = await get('/api/radio/stream/air-fm-gold/playlist.m3u8');
    assert.strictEqual(res.statusCode, 200, 'Expected 200 OK');
    assert(res.data.includes('#EXTM3U'), 'Expected m3u8 playlist format');
    assert.strictEqual(res.headers['access-control-allow-origin'], '*', 'Must have CORS header');
  });

  // 7. AIR FM Rainbow Live Stream
  await test('AIR FM Rainbow Delhi live HLS playlist returns 200 OK with CORS', async () => {
    const res = await get('/api/radio/stream/air-fm-rainbow/playlist.m3u8');
    assert.strictEqual(res.statusCode, 200, 'Expected 200 OK');
    assert(res.data.includes('#EXTM3U'), 'Expected m3u8 playlist format');
    assert.strictEqual(res.headers['access-control-allow-origin'], '*', 'Must have CORS header');
  });

  // 8. AIR Raagam Live Stream
  await test('AIR Raagam classical live HLS playlist returns 200 OK with CORS', async () => {
    const res = await get('/api/radio/stream/air-raagam/playlist.m3u8');
    assert.strictEqual(res.statusCode, 200, 'Expected 200 OK');
    assert(res.data.includes('#EXTM3U'), 'Expected m3u8 playlist format');
    assert.strictEqual(res.headers['access-control-allow-origin'], '*', 'Must have CORS header');
  });

  // 9. End-to-end Audio Chunks Verification
  await test('Live audio chunks (AAC) download successfully from station stream', async () => {
    const master = await get('/api/radio/stream/air-fm-gold/playlist.m3u8');
    const childPlaylistName = master.data.split('\n').find(l => l.endsWith('.m3u8'));
    assert(childPlaylistName, 'Expected child playlist reference in master');

    const child = await get(`/api/radio/stream/air-fm-gold/${childPlaylistName}`);
    assert.strictEqual(child.statusCode, 200, 'Child playlist must return 200 OK');

    const aacChunkName = child.data.split('\n').find(l => l.endsWith('.aac'));
    assert(aacChunkName, 'Expected AAC audio chunk in child playlist');

    const audioChunk = await getBinary(`/api/radio/stream/air-fm-gold/${aacChunkName}`);
    assert.strictEqual(audioChunk.statusCode, 200, 'Audio chunk must return 200 OK');
    assert(audioChunk.totalBytes > 1000, `Audio chunk must contain real bytes, got: ${audioChunk.totalBytes}`);
    assert.strictEqual(audioChunk.headers['access-control-allow-origin'], '*', 'Audio chunk must have CORS');
  });

  // 10. Security: Path Traversal Protection
  await test('Security: Path traversal attempt is rejected with 400 Bad Request', async () => {
    const res = await get('/api/radio/stream/air-fm-gold/..%2f..%2fserver.js');
    assert(res.statusCode === 400 || res.statusCode === 404, `Expected 400/404, got ${res.statusCode}`);
  });

  // 11. Security: Unknown Station Rejection
  await test('Security: Unknown station is rejected with 404 Not Found', async () => {
    const res = await get('/api/radio/stream/unknown-nonexistent-station/playlist.m3u8');
    assert.strictEqual(res.statusCode, 404, 'Expected 404 Not Found');
  });

  // 12. Security: Unplayable station stream attempt
  await test('Security: Stream request for unplayable station returns 404', async () => {
    const res = await get('/api/radio/stream/radio-mirchi/playlist.m3u8');
    assert.strictEqual(res.statusCode, 404, 'Expected 404 Not Found for non-embeddable station');
  });

  console.log(`\n--- TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
}

runTests();

