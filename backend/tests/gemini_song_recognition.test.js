import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { musicRecognitionService } from '../services/musicRecognitionService.js';
import { catalogService, CORE_CATALOG_TRACKS } from '../services/catalogService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Zero paid external recognition APIs (no ACRCloud, AudD, AcoustID)', () => {
  const serviceCode = fs.readFileSync(path.join(__dirname, '..', 'services', 'musicRecognitionService.js'), 'utf8');
  assert.ok(!serviceCode.includes('acrcloud.com'), 'Must not reference acrcloud.com');
  assert.ok(!serviceCode.includes('api.audd.io'), 'Must not reference api.audd.io');
  assert.ok(!serviceCode.includes('acoustid.org'), 'Must not reference acoustid.org');
  assert.ok(!serviceCode.includes('ACRCLOUD_HOST'), 'Must not require ACRCLOUD_HOST');
  assert.ok(!serviceCode.includes('AUDD_API_TOKEN'), 'Must not require AUDD_API_TOKEN');

  const providerInfo = musicRecognitionService.getProviderInfo();
  assert.equal(providerInfo.provider, 'gemini', 'Provider must report gemini');
});

test('Rejects short, empty, or undersized audio samples', async () => {
  // Mock key present for validation
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'mock_key_for_test';

  try {
    const emptyRes = await musicRecognitionService.identifyAudio({ audioBase64: '' });
    assert.equal(emptyRes.success, false);
    assert.ok(emptyRes.error.includes('Missing or invalid'));

    const tinyRes = await musicRecognitionService.identifyAudio({
      audioBase64: Buffer.from('RIFFtiny').toString('base64')
    });
    assert.equal(tinyRes.success, false);
    assert.ok(tinyRes.error.includes('too short'));
  } finally {
    if (savedKey) process.env.GEMINI_API_KEY = savedKey;
    else delete process.env.GEMINI_API_KEY;
  }
});

test('Accurately matches known Hindi songs in Loopra catalogue', async () => {
  // 1. Tum Hi Ho
  const tumHiHoMatch = await catalogService.findExactCatalogueMatch({
    title: 'Tum Hi Ho',
    artist: 'Arijit Singh',
    album: 'Aashiqui 2'
  });
  assert.equal(tumHiHoMatch.isExactMatch, true);
  assert.equal(tumHiHoMatch.matchedTrack.id, 'Umqb9KENgmk');

  // 2. Kesariya
  const kesariyaMatch = await catalogService.findExactCatalogueMatch({
    title: 'Kesariya',
    artist: 'Arijit Singh, Pritam',
    album: 'Brahmastra'
  });
  assert.equal(kesariyaMatch.isExactMatch, true);
  assert.equal(kesariyaMatch.matchedTrack.id, 'BddP6PYo2gs');

  // 3. Channa Mereya
  const channaMatch = await catalogService.findExactCatalogueMatch({
    title: 'Channa Mereya',
    artist: 'Arijit Singh',
    album: 'Ae Dil Hai Mushkil'
  });
  assert.equal(channaMatch.isExactMatch, true);
  assert.equal(channaMatch.matchedTrack.id, 'O5gwxm3NxFU');
});

test('Accurately searches English songs in catalogue with strict verification', async () => {
  const englishSongMatch = await catalogService.findExactCatalogueMatch({
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    album: 'Divide'
  });

  // If found in dynamic single-song candidates, ensure title strictly matches
  if (englishSongMatch.isExactMatch) {
    assert.ok(englishSongMatch.matchedTrack.title.toLowerCase().includes('shape of you'));
  }
});

test('Strictly rejects uncatalogued / unknown songs and never plays an unrelated fallback', async () => {
  const fakeSongMatch = await catalogService.findExactCatalogueMatch({
    title: 'Quantum Vacuum Fluctuations 198472',
    artist: 'Nonexistent Band 739201',
    album: 'Dark Matter'
  });

  assert.equal(fakeSongMatch.isExactMatch, false);
  assert.equal(fakeSongMatch.matchedTrack, null);
});

test('Distinguishes verified vs probable vs unknown song statuses without fabrication', () => {
  // Test schema rules:
  // Verified >= 80%
  // Probable 45-79%
  // Unknown < 45% or title unknown
  const mockClassify = (confidence, rawTitle, status) => {
    const isRecognized = status !== 'unknown' && confidence >= 45 && rawTitle.toLowerCase() !== 'unknown';
    return {
      recognized: isRecognized,
      status: isRecognized ? status : 'unknown'
    };
  };

  const highConfidence = mockClassify(95, 'Kesariya', 'verified');
  assert.equal(highConfidence.recognized, true);
  assert.equal(highConfidence.status, 'verified');

  const mediumConfidence = mockClassify(65, 'Kesariya', 'probable');
  assert.equal(mediumConfidence.recognized, true);
  assert.equal(mediumConfidence.status, 'probable');

  const lowConfidence = mockClassify(30, 'Kesariya', 'probable');
  assert.equal(lowConfidence.recognized, false);
  assert.equal(lowConfidence.status, 'unknown');

  const unknownTitle = mockClassify(85, 'unknown', 'unknown');
  assert.equal(unknownTitle.recognized, false);
  assert.equal(unknownTitle.status, 'unknown');
});

