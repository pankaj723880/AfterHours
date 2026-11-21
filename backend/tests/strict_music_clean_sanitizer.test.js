import assert from 'assert';
import { isCleanMusicTrack } from '../services/songFilter.js';
import { TrackDeduplicator } from '../services/recommendationHistoryService.js';

console.log('🚀 Running Strict Music Clean Sanitizer & Deduplication Verification...');

// 1. Rejection of Shorts tags & keywords
const shortsSamples = [
  { title: 'Kesariya Song #shorts', channel: 'Music Lover' },
  { title: 'Apna Bana Le #short video', channel: 'Reels Channel' },
  { title: 'Tum Hi Ho yt shorts trending', channel: 'Shorts Factory' },
  { title: 'Viral song youtube shorts', channel: 'YT Official' },
  { title: 'Chaleya viralshort edit', channel: 'Dance King' },
  { title: 'Best Hook Step | Shorts', channel: 'Choreography' },
  { title: 'Viral song reels', channel: 'Reels Hub' },
  { title: 'Trending IG Reel Audio', channel: 'Reel King' }
];

for (const sample of shortsSamples) {
  assert.strictEqual(isCleanMusicTrack(sample), false, `Should reject shorts track: ${sample.title}`);
}
console.log('✅ [PASS] Rejection of Shorts tags & keywords');

// 2. Rejection of Ringtones, Status, and Edits
const ringtoneAndEditSamples = [
  { title: 'Tum Hi Ho Ringtone download', channel: 'Ringtone Hub' },
  { title: 'Kesariya phone ringtone', channel: 'Best Ringtones' },
  { title: 'Mobile ringtone 2024 instrumental', channel: 'Sound lab' },
  { title: 'Love ringtone romantic', channel: 'Ringtone World' },
  { title: 'New ringtone 2026', channel: 'Ringtones Pro' },
  { title: 'Jawan BGM caller tune', channel: 'Caller Tunes HD' },
  { title: 'Sad Song Whatsapp Status full screen', channel: 'Status King' },
  { title: 'Status video 4k status', channel: 'Heartbreak Status' },
  { title: 'Trending IG Reel Audio', channel: 'Insta Audios' },
  { title: 'Love reels sound', channel: 'Reels Hub' },
  { title: 'Arijit Singh vs Atif Aslam voice comparison', channel: 'Music Battles' },
  { title: 'Top 10 song ideas for wedding', channel: 'Event Planners' },
  { title: 'Anniversary special song track', channel: 'Wedding Bells' },
  { title: 'Chaleya Karaoke with lyrics', channel: 'Sing Along' },
  { title: 'Kal Ho Naa Ho Karoake version', channel: 'Sing Karaoke' },
  { title: 'Kal Ho Naa Ho instrumental only piano', channel: 'Piano Beats' },
  { title: 'Traditional Bhat Geet', channel: 'Folk Channel' },
  { title: 'Shaadi Banni Geet', channel: 'Desi Traditions' },
  { title: 'Lover Slowed + Reverb Edit', channel: 'Vibe Edits' },
  { title: 'Beach vibes sunset track', channel: 'Relax Vibes' }
];

for (const sample of ringtoneAndEditSamples) {
  assert.strictEqual(isCleanMusicTrack(sample), false, `Should reject ringtone/edit: ${sample.title}`);
}
console.log('✅ [PASS] Rejection of Ringtones, Status videos, and Edits');

// 3. Rejection of Dance / Fitness / Non-music channels
const danceAndClipSamples = [
  { title: 'Kesariya Dance Cover easy choreography', channel: 'Dance Academy' },
  { title: 'Couple dance performance at sangeet', channel: 'Wedding Choreography' },
  { title: 'Zumba workout on Bollywood hits', channel: 'Fitness Club' },
  { title: 'Fitness dance cardio routine', channel: 'Gym Beats' },
  { title: 'Trending Bollywood Dance', channel: 'Rahul Dancer' },
  { title: 'Best songs', channel: 'Ringtonix' },
  { title: 'New viral hit', channel: 'Sayyed Ismail' },
  { title: 'Unknown song', channel: 'Fact Boy' },
  { title: 'Chaleya remix', channel: 'Cinemix' }
];

for (const sample of danceAndClipSamples) {
  assert.strictEqual(isCleanMusicTrack(sample), false, `Should reject dance/fitness/clip: ${sample.title} (${sample.channel})`);
}
console.log('✅ [PASS] Rejection of Dance / Fitness / Non-music channels');

// 4. Rejection of short-form duration (<= 75s)
const shortDurationSamples = [
  { title: 'Tum Hi Ho Official Audio', channel: 'T-Series', durationSec: 45 },
  { title: 'Kesariya', channel: 'Sony Music India', duration: '1:10' }, // 70s
  { title: 'Heeriye', channel: 'Jasleen Royal', seconds: 60 }
];

for (const sample of shortDurationSamples) {
  assert.strictEqual(isCleanMusicTrack(sample), false, `Should reject short-duration track: ${sample.title}`);
}
console.log('✅ [PASS] Rejection of short-form duration (<= 75s)');

// 5. Acceptance of clean legitimate music tracks
const cleanSamples = [
  { title: 'Tum Hi Ho | Aashiqui 2 | Arijit Singh', channel: 'T-Series', durationSec: 262 },
  { title: 'Kesariya - Brahmāstra | Ranbir | Alia | Pritam | Arijit Singh | Amitabh B', channel: 'Sony Music India', duration: '4:28' },
  { title: 'Taylor Swift - Lover (Official Music Video)', channel: 'TaylorSwiftVEVO', durationSec: 235 },
  { title: 'Chaleya (Official Audio) | Jawan | Shah Rukh Khan | Nayanthara | Anirudh | Arijit', channel: 'T-Series', duration: '3:20' },
  { title: 'Pehle Bhi Main (Lyrical) | ANIMAL | Ranbir Kapoor | Tripti Dimri | Vishal Mishra', channel: 'T-Series', durationSec: 250 },
  { title: 'Agar Tum Saath Ho | Tamasha | Deepika Padukone, Ranbir Kapoor | Alka Yagnik, Arijit Singh', channel: 'T-Series', duration: '5:41' }
];

for (const sample of cleanSamples) {
  assert.strictEqual(isCleanMusicTrack(sample), true, `Should accept authentic music track: ${sample.title}`);
}
console.log('✅ [PASS] Acceptance of clean legitimate music tracks');

// 6. Deduplication by videoId and canonical key
const deduplicator = new TrackDeduplicator();
const duplicateSet = [
  { id: 'vid1', title: 'Kesariya (Official Video)', artist: 'Arijit Singh' },
  { id: 'vid1', title: 'Kesariya Official Audio', artist: 'Pritam' }, // duplicate id
  { id: 'vid2', title: 'Kesariya (Official Audio)', artist: 'Arijit Singh' }, // canonical duplicate of Kesariya by Arijit Singh
  { id: 'vid3', title: 'Tum Hi Ho', artist: 'Arijit Singh' }
];

const deduped = deduplicator.filterUnique(duplicateSet);

assert.strictEqual(deduped.length, 2, 'Should deduplicate down to 2 unique tracks');
assert.strictEqual(deduped[0].id, 'vid1');
assert.strictEqual(deduped[1].id, 'vid3');
console.log('✅ [PASS] TrackDeduplicator canonical key and videoId deduplication');

console.log('\n🎉 ALL STRICT MUSIC CLEAN SANITIZER & DEDUPLICATION TESTS PASSED!');
