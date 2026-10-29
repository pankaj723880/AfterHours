import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

// Imports done dynamically inside test blocks to prevent module resolution differences

describe('Loopra 3 Upgraded Features Verification Suite', () => {

  describe('FEATURE 1: Smart Music Recommendations', () => {
    let recService;

    it('1. Loads recommendationService dynamically', async () => {
      recService = await import('../../frontend/src/services/recommendationService.js');
      assert.ok(recService.generateCategorizedRecommendations, 'generateCategorizedRecommendations must exist');
      assert.ok(recService.generateRecommendations, 'generateRecommendations must exist');
    });

    it('2. Generates all 6 personalized recommendation sections', () => {
      const mockLikes = [
        { id: 'song1', title: 'Kesariya (Official Audio)', artist: 'Arijit Singh' },
        { id: 'song2', title: 'Apna Bana Le', artist: 'Arijit Singh' }
      ];
      const mockHistory = [
        { id: 'song3', title: 'Raataan Lambiyan', artist: 'Jubin Nautiyal' }
      ];
      const mockPool = [
        { id: 'pool1', title: 'Tum Hi Ho', artist: 'Arijit Singh' },
        { id: 'pool2', title: 'Chaleya', artist: 'Arijit Singh' },
        { id: 'pool3', title: 'Lut Gaye', artist: 'Jubin Nautiyal' },
        { id: 'pool4', title: 'Dil Diyan Gallan', artist: 'Atif Aslam' },
        { id: 'pool5', title: 'Pee Loon', artist: 'Mohit Chauhan' },
        { id: 'pool6', title: 'Shayad', artist: 'Arijit Singh' },
        { id: 'pool7', title: 'Agar Tum Saath Ho', artist: 'Alka Yagnik' },
        { id: 'pool8', title: 'Pal', artist: 'Arijit Singh' },
        { id: 'pool9', title: 'Ghungroo', artist: 'Arijit Singh' }
      ];

      const sections = recService.generateCategorizedRecommendations({
        likedSongs: mockLikes,
        history: mockHistory,
        allAvailableTracks: mockPool,
        limitPerSection: 3,
        forceRefresh: true
      });

      assert.ok(sections.madeForYou, 'madeForYou section must be present');
      assert.ok(sections.becauseYouLiked, 'becauseYouLiked section must be present');
      assert.ok(sections.similarSongs, 'similarSongs section must be present');
      assert.ok(sections.recentlyPlayed, 'recentlyPlayed section must be present');
      assert.ok(sections.yourFavorites, 'yourFavorites section must be present');
      assert.ok(sections.discoverNew, 'discoverNew section must be present');

      assert.strictEqual(sections.madeForYou.title, 'Made for You');
      assert.ok(sections.madeForYou.tracks.length > 0, 'madeForYou should have tracks');
      assert.ok(sections.recentlyPlayed.tracks.length > 0, 'recentlyPlayed should have tracks');
      assert.ok(sections.yourFavorites.tracks.length > 0, 'yourFavorites should have tracks');
    });

    it('3. Enforces session deduplication across recommendation discovery blocks', () => {
      const mockPool = [
        { id: 'p1', title: 'Track 1', artist: 'Artist A' },
        { id: 'p2', title: 'Track 2', artist: 'Artist B' },
        { id: 'p3', title: 'Track 3', artist: 'Artist C' },
        { id: 'p4', title: 'Track 4', artist: 'Artist D' },
        { id: 'p5', title: 'Track 5', artist: 'Artist E' }
      ];

      const sections = recService.generateCategorizedRecommendations({
        likedSongs: [],
        history: [],
        allAvailableTracks: mockPool,
        limitPerSection: 2,
        forceRefresh: true
      });

      const madeForYouIds = new Set(sections.madeForYou.tracks.map(t => t.id));
      const discoverIds = new Set(sections.discoverNew.tracks.map(t => t.id));

      // Check overlap between madeForYou and discoverNew
      let overlapCount = 0;
      for (const id of discoverIds) {
        if (madeForYouIds.has(id)) overlapCount++;
      }

      // If pool is large enough (>= limitPerSection * 2), overlap should be 0
      assert.strictEqual(overlapCount, 0, 'Discovery sections should not duplicate identical tracks');
    });

    it('4. Provides clean fallback starter state for brand new users', () => {
      const mockPool = [
        { id: 'starter1', title: 'Bollywood Gold 1', artist: 'Kishore Kumar' },
        { id: 'starter2', title: 'Bollywood Gold 2', artist: 'Lata Mangeshkar' }
      ];

      const sections = recService.generateCategorizedRecommendations({
        likedSongs: [],
        history: [],
        allAvailableTracks: mockPool,
        limitPerSection: 2,
        forceRefresh: true
      });

      assert.ok(sections.madeForYou.tracks.length > 0, 'Made for you must contain starter tracks');
      assert.strictEqual(sections.recentlyPlayed.tracks.length, 0, 'Recently played must be empty for new users');
      assert.ok(sections.recentlyPlayed.emptyMessage, 'Must have friendly empty state message');
      assert.strictEqual(sections.yourFavorites.tracks.length, 0, 'Your favorites must be empty for new users');
      assert.ok(sections.yourFavorites.emptyMessage, 'Must have friendly empty state message');
    });
  });

  describe('FEATURE 2: Live Synchronized Lyrics', () => {
    let lyricsService;

    it('1. Loads lyricsService dynamically', async () => {
      lyricsService = await import('../../frontend/src/services/lyricsService.js');
      assert.ok(lyricsService.cleanTitleForLyrics, 'cleanTitleForLyrics must exist');
      assert.ok(lyricsService.parseLrc, 'parseLrc must exist');
      assert.ok(lyricsService.fetchLyrics, 'fetchLyrics must exist');
    });

    it('2. Cleans YouTube video title suffixes, brackets and promo noise', () => {
      const dirty1 = 'Kesariya - Brahmāstra | Ranbir | Alia | Pritam | Arijit Singh | Amitabh B (Official Video)';
      const clean1 = lyricsService.cleanTitleForLyrics(dirty1);
      assert.strictEqual(clean1.includes('Official Video'), false, 'Should strip Official Video');
      assert.strictEqual(clean1.includes('|'), false, 'Should strip pipe suffixes');

      const dirty2 = 'Heeriye (Official Music Video) [4K UHD] feat. Arijit Singh';
      const clean2 = lyricsService.cleanTitleForLyrics(dirty2);
      assert.strictEqual(clean2.includes('Official Music Video'), false);
      assert.strictEqual(clean2.includes('4K UHD'), false);
      assert.strictEqual(clean2.includes('feat'), false);
      assert.strictEqual(clean2.trim(), 'Heeriye');
    });

    it('3. Parses timestamped LRC lines into sorted seconds with text', () => {
      const lrcSample = `
[00:04.20] Mujhko barsaat bana lo
[00:08.50] Ek lambi raat bana lo
[00:15.10] Apne jazbaat bana lo
      `.trim();

      const parsed = lyricsService.parseLrc(lrcSample);
      assert.strictEqual(parsed.length, 3);
      assert.strictEqual(parsed[0].time, 4.2);
      assert.strictEqual(parsed[0].text, 'Mujhko barsaat bana lo');
      assert.strictEqual(parsed[1].time, 8.5);
      assert.strictEqual(parsed[1].text, 'Ek lambi raat bana lo');
      assert.strictEqual(parsed[2].time, 15.1);
      assert.strictEqual(parsed[2].text, 'Apne jazbaat bana lo');
    });
  });

  describe('FEATURE 3: Advanced Player Controls & Architecture', () => {
    const appPath = path.join(rootDir, 'frontend', 'src', 'App.jsx');
    const appContent = fs.readFileSync(appPath, 'utf8');

    it('1. Verifies PlayerSettingsModal is imported and wired in App.jsx', () => {
      assert.ok(appContent.includes("import PlayerSettingsModal from './components/Player/PlayerSettingsModal';"));
      assert.ok(appContent.includes('<PlayerSettingsModal'));
      assert.ok(appContent.includes('isPlayerSettingsOpen'));
      assert.ok(appContent.includes('setIsPlayerSettingsOpen'));
    });

    it('2. Verifies Crossfade state and storage key are registered', () => {
      assert.ok(appContent.includes('crossfadeDuration'));
      assert.ok(appContent.includes('setCrossfadeDuration'));
      assert.ok(appContent.includes('STORAGE_KEYS.CROSSFADE_DURATION'));
    });

    it('3. Verifies Gapless playback state and storage key are registered', () => {
      assert.ok(appContent.includes('isGaplessEnabled'));
      assert.ok(appContent.includes('setIsGaplessEnabled'));
      assert.ok(appContent.includes('STORAGE_KEYS.GAPLESS_ENABLED'));
    });

    it('4. Verifies technical distinction between YouTube iframe and offline audio', () => {
      const settingsModalPath = path.join(rootDir, 'frontend', 'src', 'components', 'Player', 'PlayerSettingsModal.jsx');
      const settingsContent = fs.readFileSync(settingsModalPath, 'utf8');

      // Check offline audio volume fading logic in App.jsx
      assert.ok(appContent.includes('audio.ontimeupdate'));
      assert.ok(appContent.includes('remaining <= crossfadeDuration'));

      // Check explicit indicator in PlayerSettingsModal for YouTube sandbox policy
      assert.ok(settingsContent.includes('cross-origin'));
      assert.ok(settingsContent.includes('isOfflineSource'));
    });

    it('5. Strictly verifies NO Equalizer UI or service was reintroduced', () => {
      assert.strictEqual(/EqualizerModal/i.test(appContent), false, 'No EqualizerModal in App.jsx');
      assert.strictEqual(/audioEqualizerService/i.test(appContent), false, 'No audioEqualizerService in App.jsx');
      assert.strictEqual(/isEqualizerOpen/i.test(appContent), false, 'No isEqualizerOpen in App.jsx');
    });
  });
});
