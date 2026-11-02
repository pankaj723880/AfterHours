import assert from 'node:assert';
import { websiteInteractionRegistry, STATIC_INTERACTION_REGISTRY } from '../../frontend/src/services/websiteInteractionRegistry.js';
import { parseCommandToAction, INTENT_CATEGORIES } from '../../frontend/src/services/commandActionEngine.js';

console.log('🚀 Running Loopra Complete AI Companion Intelligence & Registry Test Suite...\n');

// 1. Mandatory Saloon FM vs Time Machine Radio Isolation Test
console.log('--- TEST 1: SALOON FM VS TIME MACHINE REGRESSION GUARD ---');
const saloonQueries = [
  'Saloon FM kholo',
  'Saloon kholo',
  'Saloon open karo',
  'Saloon chalao',
  'salon fm',
  'Lune FM kholo',
  '90s saloon nostalgia'
];

for (const q of saloonQueries) {
  const match = websiteInteractionRegistry.findBestMatch(q);
  assert(match, `Expected registry match for query: "${q}"`);
  assert.strictEqual(match.id, 'barber', `Query "${q}" MUST resolve to "barber" (Saloon FM), got "${match.id}"!`);
  
  const action = parseCommandToAction(q);
  assert(action, `Expected parsed action for query: "${q}"`);
  assert.strictEqual(action.target, 'barber', `Action target for "${q}" MUST be "barber", got "${action.target}"!`);
  assert.notStrictEqual(action.target, 'timemachine', `CRITICAL REGRESSION: "${q}" must NEVER map to "timemachine"!`);
  console.log(`  ✅ Passed: "${q}" -> Saloon FM (barber) [Protected against Time Machine]`);
}

// 2. Evaluation of 15 Mandated Acceptance Scenarios
console.log('\n--- TEST 2: 15 MANDATED USER ACCEPTANCE SCENARIOS ---');
const testCases = [
  { query: 'Saloon FM kholo.', expectedIntent: INTENT_CATEGORIES.OPEN_PAGE, expectedTarget: 'barber' },
  { query: 'Horn Ok Please kholo.', expectedIntent: INTENT_CATEGORIES.OPEN_PAGE, expectedTarget: 'truck' },
  { query: 'Theka Session open karo.', expectedIntent: INTENT_CATEGORIES.OPEN_PAGE, expectedTarget: 'pauwa' },
  { query: 'Time Machine Radio kholo.', expectedIntent: INTENT_CATEGORIES.OPEN_PAGE, expectedTarget: 'timemachine' },
  { query: 'Indian Live Radio kholo.', expectedIntent: INTENT_CATEGORIES.OPEN_PAGE, expectedTarget: 'radio' },
  { query: 'Home page par jao.', expectedIntent: INTENT_CATEGORIES.OPEN_PAGE, expectedTarget: 'home' },
  { query: 'Library dikhao.', expectedIntent: INTENT_CATEGORIES.OPEN_PAGE, expectedTarget: 'library' },
  { query: 'Mere liked songs kholo.', expectedIntent: INTENT_CATEGORIES.OPEN_PAGE, expectedTarget: 'library' },
  { query: 'Trending songs dikhao.', expectedIntent: INTENT_CATEGORIES.OPEN_SECTION, expectedTarget: 'trending_section' },
  { query: 'Arijit Singh ke five songs search karo.', expectedIntent: INTENT_CATEGORIES.SEARCH_SONG, expectedQuery: 'Arijit Singh' },
  { query: 'Pehla song play karo.', expectedIntent: INTENT_CATEGORIES.PLAY_SEARCH_RESULT },
  { query: 'Pause karo.', expectedIntent: INTENT_CATEGORIES.PAUSE_PLAYBACK },
  { query: 'Next song chalao.', expectedIntent: INTENT_CATEGORIES.NEXT_TRACK },
  { query: 'Volume kam karo.', expectedIntent: INTENT_CATEGORIES.CHANGE_VOLUME, expectedAction: 'volume_down' },
  { query: 'Discover and Search kholo.', expectedIntent: INTENT_CATEGORIES.OPEN_PAGE, expectedTarget: 'discover' }
];

let passedCount = 0;
for (const tc of testCases) {
  const result = parseCommandToAction(tc.query);
  assert(result, `Failed to parse command: "${tc.query}"`);
  assert.strictEqual(result.intent, tc.expectedIntent, `Intent mismatch for "${tc.query}": expected ${tc.expectedIntent}, got ${result.intent}`);
  
  if (tc.expectedTarget) {
    assert.strictEqual(result.target, tc.expectedTarget, `Target mismatch for "${tc.query}": expected ${tc.expectedTarget}, got ${result.target}`);
  }
  if (tc.expectedAction) {
    assert.strictEqual(result.action, tc.expectedAction, `Action mismatch for "${tc.query}": expected ${tc.expectedAction}, got ${result.action}`);
  }
  if (tc.expectedIntent === INTENT_CATEGORIES.SEARCH_SONG) {
    assert.notStrictEqual(result.intent, INTENT_CATEGORIES.PLAY_SONG, `Safety Gate Violated: Search query "${tc.query}" must NOT trigger playback!`);
  }
  console.log(`  ✅ Case ${++passedCount}/15 Passed: "${tc.query}" -> ${result.intent} (${result.target || result.action || result.query})`);
}

// 3. Static Registry Completeness Check
console.log('\n--- TEST 3: STATIC REGISTRY COMPLETENESS AUDIT ---');
const requiredIds = ['barber', 'truck', 'pauwa', 'timemachine', 'radio', 'home', 'discover', 'swipe', 'for-you', 'library', 'history', 'playlists', 'activity'];
for (const id of requiredIds) {
  const entry = STATIC_INTERACTION_REGISTRY.find(e => e.id === id);
  assert(entry, `Missing required route entry in registry: "${id}"`);
  assert(entry.aliases.length >= 3, `Entry "${id}" should have at least 3 aliases for robust fuzzy matching`);
}
console.log(`  ✅ All ${requiredIds.length} core website destinations verified in interaction registry with complete aliases.`);

console.log('\n🎉 ALL AI COMPANION INTELLIGENCE & NAVIGATION BENCHMARK TESTS PASSED (100% SUCCESS)!\n');

