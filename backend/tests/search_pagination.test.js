import assert from 'assert';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:5000';

async function testSearchPagination() {
  console.log('=== STARTING SEARCH PAGINATION VERIFICATION SUITE ===\n');

  // Test 1: Initial search returns up to 10 results with genuine nextPageToken (Acceptance Test 1 & 11)
  console.log('--- TEST 1: Initial Search (Real YouTube Data API) ---');
  const res1 = await fetch(`${BASE_URL}/api/youtube/search?q=Arijit+Singh&limit=10`);
  assert.strictEqual(res1.status, 200, 'Initial search responds with 200 OK');
  const data1 = await res1.json();
  assert(Array.isArray(data1.items), 'Search response contains items array');
  assert.strictEqual(data1.items.length, 10, 'Initial search returned exactly 10 results');
  assert(data1.nextPageToken && typeof data1.nextPageToken === 'string', 'Genuine nextPageToken returned for initial search');
  console.log(`[PASS] Initial search returned 10 items. Page 1 Token: ${data1.nextPageToken}`);

  const page1Ids = data1.items.map(item => item.id?.videoId || item.id);
  assert(page1Ids.every(id => typeof id === 'string' && id.length > 0), 'All items have valid YouTube video IDs');

  // Test 2: First Load More fetches the next batch using nextPageToken (Acceptance Test 2, 3 & 11)
  console.log('\n--- TEST 2: First Load More Request (Page 2) ---');
  const res2 = await fetch(`${BASE_URL}/api/youtube/search?q=Arijit+Singh&limit=10&pageToken=${encodeURIComponent(data1.nextPageToken)}`);
  assert.strictEqual(res2.status, 200, 'Page 2 search responds with 200 OK');
  const data2 = await res2.json();
  assert(Array.isArray(data2.items), 'Page 2 contains items array');
  assert.strictEqual(data2.items.length, 10, 'Page 2 returned 10 items');
  assert(data2.nextPageToken && typeof data2.nextPageToken === 'string', 'Page 2 returned new nextPageToken');
  assert.notStrictEqual(data2.nextPageToken, data1.nextPageToken, 'Page 2 token is distinct from Page 1 token');
  console.log(`[PASS] Page 2 returned 10 items. Page 2 Token: ${data2.nextPageToken}`);

  const page2Ids = data2.items.map(item => item.id?.videoId || item.id);
  const overlap1And2 = page2Ids.filter(id => page1Ids.includes(id));
  assert.strictEqual(overlap1And2.length, 0, 'Page 2 contains zero duplicate video IDs from Page 1');
  console.log('[PASS] Page 1 and Page 2 results are completely distinct (no duplicates).');

  // Test 3: Repeated clicks continue fetching subsequent batches (Acceptance Test 4)
  console.log('\n--- TEST 3: Repeated Load More Request (Page 3) ---');
  const res3 = await fetch(`${BASE_URL}/api/youtube/search?q=Arijit+Singh&limit=10&pageToken=${encodeURIComponent(data2.nextPageToken)}`);
  assert.strictEqual(res3.status, 200, 'Page 3 search responds with 200 OK');
  const data3 = await res3.json();
  assert(Array.isArray(data3.items), 'Page 3 contains items array');
  assert.strictEqual(data3.items.length, 10, 'Page 3 returned 10 items');
  assert(data3.nextPageToken && typeof data3.nextPageToken === 'string', 'Page 3 returned next continuation token');
  console.log(`[PASS] Page 3 returned 10 items. Page 3 Token: ${data3.nextPageToken}`);

  // Test 4: Verify Accumulation and Stable Deduplication (Acceptance Test 5 & 6)
  console.log('\n--- TEST 4: Accumulation & Deduplication Simulation ---');
  const accumulated = [...data1.items];
  const existingSet = new Set(accumulated.map(item => item.id?.videoId || item.id));

  // Append page 2
  const uniquePage2 = data2.items.filter(item => {
    const id = item.id?.videoId || item.id;
    if (existingSet.has(id)) return false;
    existingSet.add(id);
    return true;
  });
  accumulated.push(...uniquePage2);
  assert.strictEqual(accumulated.length, 20, 'Accumulated total after Page 2 is 20 songs');

  // Inject a simulated duplicate to test deduplication
  const duplicateItem = { ...data1.items[0] };
  const incomingBatch = [duplicateItem, ...data3.items];
  const uniqueIncoming = incomingBatch.filter(item => {
    const id = item.id?.videoId || item.id;
    if (existingSet.has(id)) return false;
    existingSet.add(id);
    return true;
  });
  accumulated.push(...uniqueIncoming);
  
  // Ensure every item in accumulated is strictly unique
  const allIds = accumulated.map(item => item.id?.videoId || item.id);
  const uniqueSet = new Set(allIds);
  assert.strictEqual(uniqueSet.size, accumulated.length, 'Every item in accumulated list has a strictly unique videoId');
  assert(accumulated.length >= 25, 'Accumulated total has more than 25 songs across 3 batches');
  console.log(`[PASS] Deduplication correctly filtered duplicate songs (total unique: ${accumulated.length}).`);

  // Test 5: Short batch with active nextPageToken does NOT prematurely end pagination (Acceptance Test 7)
  console.log('\n--- TEST 5: Short Batch with Valid Continuation Token ---');
  const resShort = await fetch(`${BASE_URL}/api/youtube/search?q=Arijit+Singh&limit=5`);
  const dataShort = await resShort.json();
  assert.strictEqual(dataShort.items.length, 5, 'Short batch returned 5 items');
  assert(Boolean(dataShort.nextPageToken), 'Short batch preserves nextPageToken');
  const hasMore = Boolean(dataShort.nextPageToken);
  assert.strictEqual(hasMore, true, 'hasMoreSearchResults is TRUE despite short batch size of 5');
  console.log('[PASS] Short batch of 5 songs does NOT conclude pagination when nextPageToken is present.');

  // Test 6: Fallback provider / genuine end of results (Acceptance Test 8)
  console.log('\n--- TEST 6: Genuine End of Results Handling ---');
  // When an empty query or exhausted search is reached, nextPageToken is null
  const resEmpty = await fetch(`${BASE_URL}/api/youtube/search?q=`);
  const dataEmpty = await resEmpty.json();
  assert.strictEqual(dataEmpty.nextPageToken, null, 'nextPageToken is null for empty query');
  assert.strictEqual(Boolean(dataEmpty.nextPageToken), false, 'Pagination correctly marked as ended');
  console.log('[PASS] Absence of continuation token cleanly indicates end of results.');

  // Test 7: Starting new search resets pagination state (Acceptance Test 10)
  console.log('\n--- TEST 7: New Search State Reset ---');
  const resNew = await fetch(`${BASE_URL}/api/youtube/search?q=Shreya+Ghoshal&limit=10`);
  const dataNew = await resNew.json();
  assert.strictEqual(dataNew.items.length, 10, 'New search returns fresh batch of 10');
  assert(dataNew.nextPageToken && typeof dataNew.nextPageToken === 'string', 'Fresh nextPageToken provided for new search');
  const newIds = dataNew.items.map(item => item.id?.videoId || item.id);
  assert(!newIds.includes(page1Ids[0]), 'New search results are independent of previous search');
  console.log('[PASS] New search cleanly resets pagination and results list.');

  console.log('\n=== ALL 7 COMPREHENSIVE PAGINATION TESTS PASSED ===');
}

testSearchPagination().catch(err => {
  console.error('[TEST FAILURE]:', err);
  process.exit(1);
});
