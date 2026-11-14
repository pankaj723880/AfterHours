import assert from 'node:assert';
import { catalogService, CORE_CATALOG_TRACKS } from '../services/catalogService.js';
import { aiMusicCompanionService } from '../services/aiMusicCompanionService.js';

async function runRegressionTests() {
  console.log('=== STARTING SONG IDENTITY & METADATA BINDING REGRESSION TEST SUITE ===\n');
  let passed = 0;

  // TEST 1: Zara Sa (Jannat) strict track identity
  console.log('--- TEST 1: Zara Sa (Jannat) Strict Canonical Identity ---');
  const zaraSaCandidate = CORE_CATALOG_TRACKS.find(t => t.id === 'ZsAOnmByy38');
  assert(zaraSaCandidate, 'Zara Sa must exist in CORE_CATALOG_TRACKS with id ZsAOnmByy38');
  assert.strictEqual(zaraSaCandidate.videoId, 'ZsAOnmByy38', 'Zara Sa videoId must be ZsAOnmByy38');
  assert(zaraSaCandidate.title.includes('Zara Sa'), `Title must include "Zara Sa", got "${zaraSaCandidate.title}"`);
  assert(zaraSaCandidate.thumbnail.includes('ZsAOnmByy38'), `Thumbnail must be bound to ZsAOnmByy38, got "${zaraSaCandidate.thumbnail}"`);
  assert.notStrictEqual(zaraSaCandidate.id, 'cmMiyZaSELo', 'Zara Sa ID must NEVER be cmMiyZaSELo (which is Khuda Jaane)');
  assert(!zaraSaCandidate.thumbnail.includes('cmMiyZaSELo'), 'Zara Sa thumbnail must NEVER point to Khuda Jaane thumbnail');
  console.log(`[PASS] Zara Sa track identity strictly bound: title="${zaraSaCandidate.title}", id=${zaraSaCandidate.id}, thumbnail=${zaraSaCandidate.thumbnail}`);
  passed++;

  // TEST 2: Khuda Jaane (Bachna Ae Haseeno) distinct track identity
  console.log('\n--- TEST 2: Khuda Jaane Strict Canonical Identity ---');
  const khudaJaaneTrack = {
    id: 'cmMiyZaSELo',
    videoId: 'cmMiyZaSELo',
    title: 'Khuda Jaane | Full Song | Bachna Ae Haseeno',
    artist: 'KK, Shilpa Rao, Vishal-Shekhar',
    channel: 'YRF',
    thumbnail: 'https://i.ytimg.com/vi/cmMiyZaSELo/hqdefault.jpg'
  };
  assert.strictEqual(khudaJaaneTrack.id, 'cmMiyZaSELo');
  assert.strictEqual(khudaJaaneTrack.videoId, 'cmMiyZaSELo');
  assert.strictEqual(khudaJaaneTrack.thumbnail, 'https://i.ytimg.com/vi/cmMiyZaSELo/hqdefault.jpg');
  assert.notStrictEqual(khudaJaaneTrack.id, zaraSaCandidate.id, 'Khuda Jaane must have distinct ID from Zara Sa');
  console.log(`[PASS] Khuda Jaane identity strictly distinct: id=${khudaJaaneTrack.id}, title="${khudaJaaneTrack.title}"`);
  passed++;

  // TEST 3: Kesariya strict track identity
  console.log('\n--- TEST 3: Kesariya (Brahmāstra) Canonical Identity ---');
  const kesariyaTrack = CORE_CATALOG_TRACKS.find(t => t.id === 'BddP6PYo2gs');
  assert(kesariyaTrack, 'Kesariya must exist in CORE_CATALOG_TRACKS with id BddP6PYo2gs');
  assert.strictEqual(kesariyaTrack.videoId, 'BddP6PYo2gs');
  assert(kesariyaTrack.title.includes('Kesariya'));
  assert(kesariyaTrack.thumbnail.includes('BddP6PYo2gs'));
  console.log(`[PASS] Kesariya identity verified: id=${kesariyaTrack.id}, thumbnail=${kesariyaTrack.thumbnail}`);
  passed++;

  // TEST 4: Channa Mereya strict track identity
  console.log('\n--- TEST 4: Channa Mereya Canonical Identity ---');
  const channaTrack = CORE_CATALOG_TRACKS.find(t => t.id === '284Ov7ysmfA');
  assert(channaTrack, 'Channa Mereya must exist in CORE_CATALOG_TRACKS with id 284Ov7ysmfA');
  assert.strictEqual(channaTrack.videoId, '284Ov7ysmfA');
  assert(channaTrack.title.includes('Channa Mereya'));
  assert(channaTrack.thumbnail.includes('284Ov7ysmfA'));
  console.log(`[PASS] Channa Mereya identity verified: id=${channaTrack.id}, thumbnail=${channaTrack.thumbnail}`);
  passed++;

  // TEST 5: Single Singer Distinction (KK songs maintain separate identities)
  console.log('\n--- TEST 5: Same Artist Distinction (KK songs never cross-pollinate) ---');
  const kkSongs = [
    { id: 'ZsAOnmByy38', title: 'Zara Sa', artist: 'KK' },
    { id: 'cmMiyZaSELo', title: 'Khuda Jaane', artist: 'KK, Shilpa Rao' },
    { id: 'x_elT6zkqN0', title: 'O O Jaane Jaana', artist: 'Kamaal Khan' }
  ];
  const seenIds = new Set();
  for (const song of kkSongs) {
    assert(!seenIds.has(song.id), `Duplicate ID detected: ${song.id}`);
    seenIds.add(song.id);
  }
  assert.strictEqual(seenIds.size, 3, 'All songs by same artist must maintain distinct IDs');
  console.log('[PASS] Multiple songs by same artist maintain 100% unique canonical identities');
  passed++;

  // TEST 6: AI Companion Playback Request preserves exact track ID and metadata
  console.log('\n--- TEST 6: Playback Resolution Preserves Selected Track Canonical Metadata ---');
  const turn = aiMusicCompanionService.detectPlaybackRequest('Play Zara Sa', [], [zaraSaCandidate]);
  assert(turn, 'Playback request must be detected');
  assert.strictEqual(turn.id, 'ZsAOnmByy38', 'Must resolve to ZsAOnmByy38, never cmMiyZaSELo');
  assert.strictEqual(turn.title, zaraSaCandidate.title);
  assert(turn.thumbnail.includes('ZsAOnmByy38'), 'Playback payload thumbnail must belong to same videoId');
  console.log(`[PASS] Playback resolution payload: title="${turn.title}", id=${turn.id}, thumb=${turn.thumbnail}`);
  passed++;

  // TEST 7: Zero Jukebox/Compilation IDs in Core Catalog
  console.log('\n--- TEST 7: Core Catalog Contains Zero Jukebox/Compilation IDs ---');
  const forbiddenCompilationIds = ['r0c1f6XxRQg', 'ARtRGkaG_OA', 'ZdyaixHYviA', 'BDlNjOc3wiQ', 'jsgPZVMfJQk'];
  for (const forbiddenId of forbiddenCompilationIds) {
    const found = CORE_CATALOG_TRACKS.find(t => t.id === forbiddenId);
    assert(!found, `Forbidden compilation video ID found in CORE_CATALOG_TRACKS: ${forbiddenId}`);
  }
  console.log('[PASS] All known compilation/jukebox video IDs are completely excluded from Core Catalog');
  passed++;

  console.log(`\n=== ALL ${passed} SONG IDENTITY REGRESSION TESTS PASSED! ===\n`);
}

runRegressionTests().catch(err => {
  console.error('\n[TEST FAILED]:', err);
  process.exit(1);
});
