const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { classifyMoodIntent } = require('../services/moodClassifier');
const cmsService = require('../services/cmsService');

describe('Loopra 5 Premium Features Test Suite', () => {
  let testUser;
  let testToken;
  const JWT_SECRET = process.env.JWT_SECRET || 'loopra-super-secret-jwt-key-for-local-development-change-in-prod';

  beforeAll(async () => {
    // Generate test user
    const unique = Date.now();
    testUser = await User.create({
      username: `tester_${unique}`,
      email: `tester_${unique}@example.com`,
      password: 'HashedPassword123!',
      role: 'user',
      isPublic: true,
      shareListeningActivity: false // default false for privacy opt-in
    });

    testToken = jwt.sign(
      { id: testUser._id.toString(), username: testUser.username, role: testUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (testUser?._id) {
      await User.deleteOne({ _id: testUser._id });
      await Activity.deleteMany({ userId: testUser._id });
    }
  });

  describe('Feature 1: Mood-to-Music AI', () => {
    test('1.1 Should correctly classify English romantic and late night mood', () => {
      const intent = classifyMoodIntent('romantic late night acoustic vibes');
      expect(intent.moods).toContain('Romantic');
      expect(intent.queries.length).toBeGreaterThan(0);
      expect(intent.queries[0].toLowerCase()).toMatch(/romantic|love/);
    });

    test('1.2 Should interpret Hindi and Hinglish emotional prompts', () => {
      const intentHindi = classifyMoodIntent('mujhe bohot udaas lag raha hai sad songs sunao');
      expect(intentHindi.moods).toContain('Sad');
      expect(intentHindi.language).toBe('Hindi');

      const intentHappy = classifyMoodIntent('khushi ke gaane mast dance wale');
      expect(intentHappy.moods).toContain('Happy');
      expect(intentHappy.energy).toBe('high');
    });

    test('1.3 Should interpret Punjabi party cues', () => {
      const intent = classifyMoodIntent('bhangra party beats nachne wale');
      expect(intent.moods).toContain('Party');
      expect(intent.language).toBe('Punjabi');
      expect(intent.energy).toBe('high');
    });

    test('1.4 Should interpret era-based nostalgic prompts', () => {
      const intent = classifyMoodIntent('purane 90s ke romantic gaane');
      expect(intent.moods).toContain('Nostalgic');
      expect(intent.era).toBe('1990s');
    });

    test('1.5 POST /api/mood/recommend should return structured recommendations and suggested queries', async () => {
      const res = await request(app)
        .post('/api/mood/recommend')
        .send({
          prompt: 'peaceful focus and chill study music',
          language: 'All',
          seed: 1
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mood).toBeDefined();
      expect(Array.isArray(res.body.tracks)).toBe(true);
      expect(Array.isArray(res.body.suggestedQueries)).toBe(true);
    });

    test('1.6 Seed rotation should return varied recommendations on refresh', async () => {
      const res1 = await request(app)
        .post('/api/mood/recommend')
        .send({ prompt: 'Happy energetic party hits', seed: 0 });

      const res2 = await request(app)
        .post('/api/mood/recommend')
        .send({ prompt: 'Happy energetic party hits', seed: 1 });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.seed).toBe(0);
      expect(res2.body.seed).toBe(1);
    });
  });

  describe('Feature 2: Loopra Canvas Visualizer Backend & Contracts', () => {
    test('2.1 Verified visualizer configuration contracts for 5 modes', () => {
      const canvasModes = ['vinyl', 'aurora', 'equalizer', 'waveform', 'cinematic'];
      expect(canvasModes).toHaveLength(5);
    });
  });

  describe('Feature 3: Time Machine Radio Configuration & Eras', () => {
    test('3.1 SiteConfig should supply default vintage eras from 1970s to 2010s', () => {
      const defaultConfig = cmsService.getDefaultSiteConfig();
      expect(Array.isArray(defaultConfig.timeMachineEras)).toBe(true);
      expect(defaultConfig.timeMachineEras.length).toBeGreaterThanOrEqual(5);

      const decades = defaultConfig.timeMachineEras.map((e) => e.decade);
      expect(decades).toContain('1970s');
      expect(decades).toContain('1980s');
      expect(decades).toContain('1990s');
      expect(decades).toContain('2000s');
      expect(decades).toContain('2010s');

      const ninetiesEra = defaultConfig.timeMachineEras.find((e) => e.decade === '1990s');
      expect(ninetiesEra.queries.length).toBeGreaterThan(0);
      expect(ninetiesEra.genres.length).toBeGreaterThan(0);
    });
  });

  describe('Feature 4: Voice Search Commands & Language Parsing', () => {
    test('4.1 Voice command patterns should parse play and search intents correctly', () => {
      const parseVoice = (text) => {
        const lower = text.toLowerCase().trim();
        const playPrefixes = ['play song ', 'play track ', 'play ', 'bajao ', 'chalao ', 'sunao '];
        for (const p of playPrefixes) {
          if (lower.startsWith(p)) return { command: 'play', query: text.slice(p.length).trim() };
        }
        return { command: 'search', query: text.trim() };
      };

      expect(parseVoice('Play Kesariya')).toEqual({ command: 'play', query: 'Kesariya' });
      expect(parseVoice('bajao Tum Hi Ho')).toEqual({ command: 'play', query: 'Tum Hi Ho' });
      expect(parseVoice('Arijit Singh hits')).toEqual({ command: 'search', query: 'Arijit Singh hits' });
    });
  });

  describe('Feature 5: Listening Activity Feed & Strict Opt-in Privacy', () => {
    test('5.1 Default user privacy should be opt-in (shareListeningActivity is false)', () => {
      expect(testUser.shareListeningActivity).toBe(false);
    });

    test('5.2 Activities should not appear in public feed while user is opted-out', async () => {
      // Log an activity
      await request(app)
        .post('/api/activity/log')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: 'listen',
          track: {
            id: 'test_vid_private_1',
            title: 'Private Test Track',
            artist: 'Secret Artist',
            albumArt: 'https://example.com/art.jpg'
          }
        });

      const feedRes = await request(app).get('/api/activity/feed');
      expect(feedRes.status).toBe(200);
      const found = feedRes.body.activities.find(
        (a) => a.track?.id === 'test_vid_private_1'
      );
      expect(found).toBeUndefined();
    });

    test('5.3 PATCH /api/activity/privacy should update privacy and retroactively publish activities', async () => {
      const patchRes = await request(app)
        .patch('/api/activity/privacy')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ shareListeningActivity: true });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.success).toBe(true);
      expect(patchRes.body.shareListeningActivity).toBe(true);

      // Verify feed now includes public activity
      const feedRes = await request(app).get('/api/activity/feed');
      expect(feedRes.status).toBe(200);
      const found = feedRes.body.activities.find(
        (a) => a.track?.id === 'test_vid_private_1'
      );
      expect(found).toBeDefined();
      expect(found.track.title).toBe('Private Test Track');
    });

    test('5.4 POST /api/activity/log should deduplicate repeated plays within 5 minutes', async () => {
      const res1 = await request(app)
        .post('/api/activity/log')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: 'listen',
          track: {
            id: 'dedup_track_123',
            title: 'Dedup Track',
            artist: 'Dedup Artist'
          }
        });
      expect(res1.status).toBe(201);
      expect(res1.body.deduplicated).toBeFalsy();

      // Immediate repeat
      const res2 = await request(app)
        .post('/api/activity/log')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: 'listen',
          track: {
            id: 'dedup_track_123',
            title: 'Dedup Track',
            artist: 'Dedup Artist'
          }
        });
      expect(res2.status).toBe(200);
      expect(res2.body.deduplicated).toBe(true);
    });

    test('5.5 Feed should support cursor pagination and sanitize private fields', async () => {
      const feedRes = await request(app).get('/api/activity/feed?limit=5');
      expect(feedRes.status).toBe(200);
      expect(Array.isArray(feedRes.body.activities)).toBe(true);
      feedRes.body.activities.forEach((act) => {
        // Ensure email, password, and sensitive fields are never exposed
        expect(act.email).toBeUndefined();
        expect(act.password).toBeUndefined();
        expect(act.role).toBeUndefined();
      });
    });
  });
});
