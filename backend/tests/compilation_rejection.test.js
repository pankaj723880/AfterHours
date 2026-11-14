import assert from 'assert';
import musicValidationService from '../services/musicValidationService.js';
import { isSingleSong, verifySingleSong } from '../services/songFilter.js';

console.log('=== RUNNING COMPILATION & ARTIST COLLECTION REJECTION TEST SUITE ===\n');

async function runTests() {
  // 1. Compilation and Collection Candidates that MUST BE REJECTED
  const compilationCases = [
    { title: 'Best of KK', duration: '52:10' },
    { title: 'Best of Arijit Singh', duration: '1:12:00' },
    { title: 'KK Songs | Top Hindi Songs', duration: '44:18' },
    { title: 'Best Songs of KK', duration: '35:00' },
    { title: 'Top Songs of Arijit Singh', duration: '48:30' },
    { title: 'All Songs of KK', duration: '1:30:00' },
    { title: 'Lofi Song Collections', duration: '25:00' },
    { title: 'Chill Beats Collections', duration: '40:00' },
    { title: 'Bollywood Top Songs Collections', duration: '1:05:00' },
    { title: 'Lofi Mix', duration: '32:00' },
    { title: 'Chill Beats Mix', duration: '28:00' },
    { title: 'Greatest Hits of KK | Audio Jukebox', duration: '55:00' },
    { title: 'Arijit Singh Complete Discography | All Tracks', duration: '2:15:00' },
    { title: 'Non-Stop Romantic Hindi Songs 2024', duration: '45:00' },
    { title: 'Superhit Bollywood Songs Back to Back', duration: '38:00' }
  ];

  for (const item of compilationCases) {
    // 1a. Song Filter check
    const sfResult = verifySingleSong(item);
    assert.strictEqual(
      sfResult.isValid,
      false,
      `songFilter must reject compilation "${item.title}"`
    );

    // 1b. Central musicValidationService check
    const valResult = await musicValidationService.validateTrack({
      id: 'dQw4w9WgXcQ',
      title: item.title,
      channel: 'Compilation Channel',
      duration: item.duration
    }, { bypassCache: true });

    assert.strictEqual(
      valResult.eligible,
      false,
      `musicValidationService must reject compilation "${item.title}". Got eligible: true (category: ${valResult.category})`
    );

    console.log(`[PASS] Correctly Rejected Compilation: "${item.title}"`);
  }

  // 2. Genuine Individual Tracks that MUST BE ALLOWED
  const genuineCases = [
    { title: 'KK - Zara Sa | Jannat | Official Video', channel: 'SonyMusicIndiaVEVO', duration: '4:30' },
    { title: 'Zara Sa - KK (Lofi Flip)', channel: 'Chill Nation', duration: '3:15' },
    { title: 'Kesariya - Arijit Singh (Lofi Version)', channel: 'Indie Vibe', duration: '3:45' },
    { title: 'Arijit Singh - O Maahi (Official Audio)', channel: 'Zee Music Company', duration: '3:50' },
    { title: 'Tum Hi Ho | Aashiqui 2 | Arijit Singh', channel: 'T-Series', duration: '4:22' },
    { title: 'Lover - Diljit Dosanjh (Official Music Video)', channel: 'Diljit Dosanjh', duration: '3:12' },
    { title: 'Baarishein (Official Video) - Anuv Jain', channel: 'Anuv Jain', duration: '3:27' }
  ];

  for (const item of genuineCases) {
    // 2a. Song Filter check
    const sfResult = verifySingleSong(item);
    assert.strictEqual(
      sfResult.isValid,
      true,
      `songFilter must allow genuine single song "${item.title}"`
    );

    // 2b. Central musicValidationService check
    const valResult = await musicValidationService.validateTrack({
      id: 'kJQP7kiw5Fk',
      title: item.title,
      channel: item.channel,
      duration: item.duration
    }, { bypassCache: true });

    assert.strictEqual(
      valResult.eligible,
      true,
      `musicValidationService must allow genuine single song "${item.title}". Got eligible: false (reason: ${valResult.reason})`
    );

    console.log(`[PASS] Correctly Allowed Genuine Single: "${item.title}"`);
  }

  console.log('\n=== ALL COMPILATION & ARTIST COLLECTION TESTS PASSED WITH 100% SUCCESS! ===');
}

runTests().catch(err => {
  console.error('\n[FAIL] Test suite encountered an error:', err);
  process.exit(1);
});

