import assert from 'assert';
import musicValidationService from '../services/musicValidationService.js';
import { isSingleSong, verifySingleSong, STRICT_BLACKLIST_WORDS } from '../services/songFilter.js';

console.log('=== RUNNING COMPILATION & ARTIST COLLECTION REJECTION TEST SUITE ===\n');

async function runTests() {
  // 1. Mandatory User-Specified Blacklist Words:
  // ['jukebox', 'mashup', 'best of', 'collection', 'non-stop', 'unplugged', 'hits of', 'top 50', 'latest hits', '2020', '2021', '2022', '2023', 'audio jukebox', 'full album']
  console.log('--- Testing Explicit Blacklist Terms ---');
  const blacklistWordCases = [
    { title: 'Arijit Singh Audio Jukebox', term: 'audio jukebox' },
    { title: 'Bollywood Romantic Jukebox', term: 'jukebox' },
    { title: 'Mega Mashup 2024', term: 'mashup' },
    { title: 'Best of Arijit Singh', term: 'best of' },
    { title: 'Romantic Songs Collection', term: 'collection' },
    { title: 'Non-stop Party Hits', term: 'non-stop' },
    { title: 'Pawan Singh Unplugged', term: 'unplugged' },
    { title: 'Hits of Kishore Kumar', term: 'hits of' },
    { title: 'Top 50 Hindi Songs', term: 'top 50' },
    { title: 'Latest Hits 2025', term: 'latest hits' },
    { title: 'Best Bollywood Songs 2020', term: '2020' },
    { title: 'Superhit Hindi Songs 2021', term: '2021' },
    { title: 'Punjabi Hits 2022', term: '2022' },
    { title: 'Bhojpuri Hit Songs 2023', term: '2023' },
    { title: 'Aashiqui 2 Full Album Songs', term: 'full album' },
    // Description matching test
    { title: 'Romantic Melody Video', description: 'Listen to this non-stop collection audio jukebox', term: 'desc match' }
  ];

  for (const item of blacklistWordCases) {
    const sfResult = verifySingleSong(item);
    assert.strictEqual(
      sfResult.isValid,
      false,
      `songFilter must reject blacklisted phrase "${item.term}" in "${item.title}"`
    );

    const valResult = await musicValidationService.validateTrack({
      id: 'dQw4w9WgXcQ',
      title: item.title,
      description: item.description || '',
      channel: 'Music Channel'
    }, { bypassCache: true });

    assert.strictEqual(
      valResult.eligible,
      false,
      `musicValidationService must reject blacklisted item "${item.title}". Got eligible: true`
    );
    console.log(`[PASS] Correctly Rejected Blacklisted Term "${item.term}": "${item.title}"`);
  }

  // 2. Compilation and Collection Candidates that MUST BE REJECTED
  console.log('\n--- Testing General Compilation Cases ---');
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
    // 2a. Song Filter check
    const sfResult = verifySingleSong(item);
    assert.strictEqual(
      sfResult.isValid,
      false,
      `songFilter must reject compilation "${item.title}"`
    );

    // 2b. Central musicValidationService check
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

  // 3. Genuine Individual Tracks that MUST BE ALLOWED
  console.log('\n--- Testing Genuine Individual Single Tracks ---');
  const genuineCases = [
    { title: 'KK - Zara Sa | Jannat | Official Video', channel: 'SonyMusicIndiaVEVO', duration: '4:30' },
    { title: 'Zara Sa - KK (Lofi Flip)', channel: 'Chill Nation', duration: '3:15' },
    { title: 'Kesariya - Arijit Singh (Lofi Version)', channel: 'Indie Vibe', duration: '3:45' },
    { title: 'Arijit Singh - O Maahi (Official Audio)', channel: 'Zee Music Company', duration: '3:50' },
    { title: 'Tum Hi Ho | Aashiqui 2 | Arijit Singh', channel: 'T-Series', duration: '4:22' },
    { title: 'Lover - Diljit Dosanjh (Official Music Video)', channel: 'Diljit Dosanjh', duration: '3:12' },
    { title: 'Baarishein (Official Video) - Anuv Jain', channel: 'Anuv Jain', duration: '3:27' },
    { title: 'Pawan Singh - Lollypop Lagelu (Official Song)', channel: 'Wave Music', duration: '4:15' },
    { title: 'Khesari Lal Yadav - Saj Ke Sawar Ke (Official Video)', channel: 'Yashi Films', duration: '3:40' }
  ];

  for (const item of genuineCases) {
    // 3a. Song Filter check
    const sfResult = verifySingleSong(item);
    assert.strictEqual(
      sfResult.isValid,
      true,
      `songFilter must allow genuine single song "${item.title}"`
    );

    // 3b. Central musicValidationService check
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

