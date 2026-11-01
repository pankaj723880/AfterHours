import assert from 'assert';
import { getArtistProfile, getArtistSongs, slugifyArtistName } from '../services/artistService.js';

console.log('🧪 Starting Loopra Artist System Tests...\n');

// Test 1: Slug generation
console.log('Test 1: Slug Generation');
assert.strictEqual(slugifyArtistName('Arijit Singh'), 'arijit-singh');
assert.strictEqual(slugifyArtistName('A.R. Rahman'), 'ar-rahman');
assert.strictEqual(slugifyArtistName('Shreya Ghoshal'), 'shreya-ghoshal');
assert.strictEqual(slugifyArtistName('Diljit Dosanjh'), 'diljit-dosanjh');
console.log('✅ Test 1 Passed: Slugs generated correctly\n');

// Test 2: Fetch Predefined Artist Profile
console.log('Test 2: Predefined Artist Profile Fetch (Arijit Singh)');
const arijit = await getArtistProfile('arijit-singh');
assert(arijit, 'Artist profile returned');
assert.strictEqual(arijit.name, 'Arijit Singh');
assert.strictEqual(arijit.verified, true);
assert(Array.isArray(arijit.popularSongs), 'popularSongs is array');
assert(arijit.popularSongs.length > 0, 'popularSongs contains tracks');
assert(arijit.popularSongs[0].title, 'First song has title');
assert(arijit.popularSongs[0].thumbnail, 'First song has valid thumbnail');
assert(Array.isArray(arijit.discography.albums), 'albums is array');
assert(Array.isArray(arijit.relatedArtists), 'relatedArtists is array');
assert(arijit.relatedArtists.length > 0, 'relatedArtists has items');
console.log(`✅ Test 2 Passed: Profile loaded with ${arijit.popularSongs.length} songs, ${arijit.discography.albums.length} albums, ${arijit.relatedArtists.length} related artists\n`);

// Test 3: Paginated Song Loading (Permanent Load More requirement)
console.log('Test 3: Paginated Song Loading (Load More)');
const page1 = await getArtistSongs('Arijit Singh', { limit: 10, pageToken: null });
assert.strictEqual(page1.songs.length, 10, 'Page 1 has exactly 10 songs');
assert(page1.nextPageToken, 'Page 1 returns nextPageToken');

const exclude = page1.songs.map(s => s.id);
const page2 = await getArtistSongs('Arijit Singh', { limit: 10, pageToken: page1.nextPageToken, excludeIds: exclude });
assert(page2.songs.length > 0, 'Page 2 loaded additional songs');
const page2Ids = new Set(page2.songs.map(s => s.id));
for (const id of exclude) {
  assert(!page2Ids.has(id), `Page 2 deduplication passed: ${id} not in page 2`);
}
console.log(`✅ Test 3 Passed: Loaded ${page1.songs.length} initially, then ${page2.songs.length} more with zero duplicates\n`);

// Test 4: Dynamic Artist Resolution (Unlisted artist fallback)
console.log('Test 4: Dynamic Artist Resolution');
const dynamicArtist = await getArtistProfile('Coldplay');
assert(dynamicArtist, 'Dynamic artist profile returned');
assert.strictEqual(dynamicArtist.name, 'Coldplay');
assert(Array.isArray(dynamicArtist.popularSongs), 'popularSongs array returned');
console.log(`✅ Test 4 Passed: Dynamic artist profile generated successfully\n`);

console.log('🎉 ALL Loopra Artist System Tests Passed Successfully!');

