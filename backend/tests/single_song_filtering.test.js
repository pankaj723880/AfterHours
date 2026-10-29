import assert from 'assert';
import { isSingleSong, isValidYouTubeId, normalizeTrack, filterSingleSongs } from '../services/songFilter.js';

console.log('=== STARTING SINGLE SONG FILTERING VERIFICATION SUITE ===\n');

// 1. Multi-Song Compilations, Mashups, Albums, Medleys that MUST be excluded
const MULTI_SONG_CASES = [
  { title: 'Aashiqui 2 | All Best Songs Audio Jukebox', reason: 'Audio Jukebox' },
  { title: 'Yeh Jawaani Hai Deewani Full Songs Jukebox', reason: 'Full Songs Jukebox' },
  { title: 'Sanam Teri Kasam All Songs Jukebox', reason: 'All Songs Jukebox' },
  { title: 'FULL ALBUM: Kabir Singh | Audio Jukebox', reason: 'Full Album & Jukebox' },
  { title: 'Rockstar | Audio Jukebox | A.R. Rahman', reason: 'Audio Jukebox' },
  { title: 'ANIMAL (AUDIO JUKEBOX): Ranbir Kapoor', reason: 'Audio Jukebox' },
  { title: 'Best Of Arijit Singh 2024 Hits Radio Jukebox', reason: 'Best of & Radio Jukebox' },
  { title: 'Evergreen Hits of KK (Audio Jukebox)', reason: 'Audio Jukebox' },
  { title: 'Barsaat | All Trending Songs Mashup', reason: 'Mashup' },
  { title: 'Bollywood 90s Romantic Mashup | Non Stop', reason: 'Mashup & Non Stop' },
  { title: 'Top 50 Hindi Songs 2024 | Latest Bollywood Hits', reason: 'Top 50 songs' },
  { title: 'Top 10 Romantic Songs of Arijit Singh', reason: 'Top 10 songs' },
  { title: 'Best 20 Retro Classics Collection', reason: 'Best 20 & Collection' },
  { title: 'Non-Stop Bollywood Dance Songs 2025', reason: 'Non-Stop' },
  { title: 'Non Stop Punjabi Party Mix DJ Nonstop', reason: 'Non Stop & DJ Mix' },
  { title: 'Lata Mangeshkar Golden Hits Medley', reason: 'Medley' },
  { title: 'Best of 90s Bollywood Songs Collection', reason: 'Best of 90s & Collection' },
  { title: '1 Hour Relaxing Acoustic Bollywood Music', reason: '1 Hour compilation' },
  { title: '2 Hours Deep Sleep Lofi Beats Collection', reason: '2 Hours compilation' },
  { title: '3 Hours Continuous Music Chill Radio', reason: '3 Hours & Continuous Music' },
  { title: 'Superhit Bollywood Songs Back to Back', reason: 'Back to back' },
  { title: 'Kishore Kumar B2B Hits Collection', reason: 'B2B & Collection' },
  { title: 'Ultimate Party Megamix 2024', reason: 'Megamix' },
  { title: 'Mega Mix Bollywood Retro Dance', reason: 'Mega Mix' },
  { title: 'Karaoke Collection: 20 Hindi Hits with Lyrics', reason: 'Karaoke Collection' },
  { title: 'Multiple Songs Karaoke Pack Volume 1', reason: 'Multiple Songs Karaoke' },
  { title: 'Complete Album Songs - Dilwale Dulhania Le Jayenge', reason: 'Complete Album Songs' },
  { title: 'All Video Songs | Kal Ho Naa Ho | Shah Rukh Khan', reason: 'All Video Songs' },
  { title: '1. Tum Hi Ho 2. Chahun Main Ya Naa 3. Sunn Raha Hai', reason: 'Tracklist title' }
];

// 2. Genuine Individual Single Songs that MUST be preserved
const GENUINE_SINGLE_CASES = [
  { title: 'Tum Hi Ho | Aashiqui 2 | Arijit Singh | Mithoon', artist: 'T-Series' },
  { title: 'Pehla Nasha (Official Video) - Jo Jeeta Wohi Sikandar', artist: 'Venus Movies' },
  { title: 'Chura Ke Dil Mera | Main Khiladi Tu Anari | Akshay, Shilpa', artist: 'Venus' },
  { title: 'Kesariya - Brahmāstra | Ranbir | Alia | Pritam | Arijit Singh', artist: 'Sony Music India' },
  { title: 'Chaleya (Video) - Jawan | Shah Rukh Khan | Nayanthara | Anirudh', artist: 'T-Series' },
  { title: 'Apna Bana Le - Bhediya | Varun Dhawan, Kriti Sanon | Sachin-Jigar', artist: 'Zee Music Company' },
  { title: 'Heeriye (Official Video) Jasleen Royal ft Arijit Singh | Dulquer', artist: 'Jasleen Royal' },
  { title: 'Dil Diyan Gallan Song | Tiger Zinda Hai | Salman Khan, Katrina Kaif', artist: 'YRF' },
  { title: 'ANIMAL: SATRANGA (Full Video Song) | Ranbir Kapoor, Rashmika | Arijit Singh', artist: 'T-Series' },
  { title: 'Kabir Singh: Bekhayali (Official Video) | Shahid Kapoor, Kiara Advani', artist: 'T-Series' },
  { title: 'Lover - Diljit Dosanjh (Official Music Video)', artist: 'Diljit Dosanjh' },
  { title: 'Pal Pal Dil Ke Paas - Title Track | Arijit Singh | Parampara', artist: 'Zee Music Company' },
  { title: 'Agar Tum Saath Ho Full Song | Tamasha | Ranbir Kapoor, Deepika Padukone', artist: 'T-Series' },
  { title: 'Tujhe Dekha Toh Yeh Jaana Sanam (Full Song) DDLJ', artist: 'YRF' },
  { title: 'Ghungroo Song | WAR | Hrithik Roshan, Vaani Kapoor | Arijit, Shilpa', artist: 'YRF' },
  { title: 'Shayad - Love Aaj Kal | Kartik, Sara | Pritam | Arijit Singh', artist: 'Sony Music India' },
  { title: 'Pee Loon (Lyrical Video) | Once Upon A Time In Mumbaai | Emraan Hashmi', artist: 'T-Series' },
  { title: 'Raataan Lambiyan - Shershaah | Sidharth, Kiara | Tanishk Bagchi | Jubin Nautiyal', artist: 'Sony Music India' },
  { title: 'Baarishein (Official Video) - Anuv Jain', artist: 'Anuv Jain' },
  { title: 'cold/mess - Prateek Kuhad (Official Music Video)', artist: 'Prateek Kuhad' },
  { title: 'Ilahi (Full Video Song) | Yeh Jawaani Hai Deewani | Ranbir Kapoor', artist: 'T-Series' },
  { title: 'Hawayein - Jab Harry Met Sejal | Shah Rukh Khan, Anushka | Arijit Singh', artist: 'Sony Music India' }
];

console.log('--- TEST 1: Exclude Multi-Song Compilations, Mashups, Albums ---');
for (const testCase of MULTI_SONG_CASES) {
  const result = isSingleSong({ title: testCase.title });
  assert.strictEqual(result, false, `Failed to exclude multi-song track: "${testCase.title}" (${testCase.reason})`);
}
console.log(`[PASS] Correctly excluded all ${MULTI_SONG_CASES.length} multi-song titles.\n`);

console.log('--- TEST 2: Preserve Genuine Individual Single Songs ---');
for (const testCase of GENUINE_SINGLE_CASES) {
  const result = isSingleSong({ title: testCase.title, artist: testCase.artist });
  assert.strictEqual(result, true, `Accidentally excluded genuine single song: "${testCase.title}"`);
}
console.log(`[PASS] Correctly preserved all ${GENUINE_SINGLE_CASES.length} genuine single songs.\n`);

console.log('--- TEST 3: Duration Boundary Checks ---');
assert.strictEqual(isSingleSong({ title: 'Acoustic Melody', duration: 240 }), true, '4-minute song should be accepted');
assert.strictEqual(isSingleSong({ title: 'Classical Raga Solo', duration: 720 }), true, '12-minute track should be accepted');
assert.strictEqual(isSingleSong({ title: 'Romantic Songs Marathon', duration: 1800 }), false, '30-minute track must be rejected');
assert.strictEqual(isSingleSong({ title: 'Lofi Study Session', duration: '1:45:00' }), false, '1hr 45min track must be rejected');
assert.strictEqual(isSingleSong({ title: 'Desi Single Track', duration: '4:15' }), true, '4m 15s track string must be accepted');
console.log('[PASS] Duration boundaries verified.\n');

console.log('--- TEST 4: YouTube ID Validation ---');
assert.strictEqual(isValidYouTubeId('RLzC55ai0eo'), true);
assert.strictEqual(isValidYouTubeId('Yvl6m9x5ZR0'), true);
assert.strictEqual(isValidYouTubeId('short_id'), false);
assert.strictEqual(isValidYouTubeId('this_id_is_way_too_long_for_youtube'), false);
assert.strictEqual(isValidYouTubeId('invalid@chars!'), false);
console.log('[PASS] YouTube ID validator verified.\n');

console.log('--- TEST 5: Pipeline Normalization and Deduplication ---');
const rawCandidates = [
  { id: { videoId: 'RLzC55ai0eo' }, snippet: { title: 'Heeriye &quot;Official Video&quot;', channelTitle: 'Jasleen Royal VEVO' } },
  { id: 'RLzC55ai0eo', title: 'Heeriye (Duplicate)', artist: 'Jasleen Royal' },
  { id: 'B61fSzdCzzs', title: 'Aashiqui 2 | All Best Songs Audio Jukebox', artist: 'T-Series' },
  { id: 'WWIfHemqSEA', title: 'Tujhko - Love Song', artist: 'Arijit Singh' },
  { id: 'invalid_id_format', title: 'Some Song', artist: 'Artist' }
];

const filtered = filterSingleSongs(rawCandidates);
assert.strictEqual(filtered.length, 2, 'Pipeline should yield exactly 2 unique single songs');
assert.strictEqual(filtered[0].id, 'RLzC55ai0eo');
assert.strictEqual(filtered[0].title, 'Heeriye "Official Video"');
assert.strictEqual(filtered[0].artist, 'Jasleen Royal');
assert.strictEqual(filtered[1].id, 'WWIfHemqSEA');
console.log('[PASS] Full pipeline normalization, deduplication and filtering verified.\n');

console.log('=== ALL SINGLE SONG FILTERING TESTS PASSED! ===');

