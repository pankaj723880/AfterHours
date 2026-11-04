/**
 * Loopra Centralized Music-Only Validation Service
 * 
 * Strict Four-Layer Validation Architecture:
 * - LAYER 1: YouTube Category & Stream Validation (Category 10 Music, Duration, Live status)
 * - LAYER 2: Metadata-Based Validation (Channel signals, Topic channels, Official audio/video,
 *            Song title delimiters, Regional music forms, Anti-patterns, Background music detection)
 * - LAYER 3: AI Content Classification (Semantic classification: Allowed music vs Blocked content,
 *            Confidence-based eligibility: High confidence music eligible, Uncertain/Non-music rejected)
 * - LAYER 4: Playback-Level Validation (Authoritative gate immediately before video loading)
 */

import { GoogleGenAI } from '@google/genai';
import { isValidYouTubeId } from './songFilter.js';
import { executeGeminiOperation, isGeminiConfigured } from './geminiKeyManager.js';

// In-memory LRU/TTL cache for validation decisions (keyed by YouTube videoId)
const VALIDATION_CACHE = new Map();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days TTL
const MAX_CACHE_SIZE = 10000;

// Known verified record labels and distribution partners
const VERIFIED_RECORD_LABELS = [
  't-series', 'tseries', 'sony music', 'sonymusic', 'zee music', 'zeemusic',
  'yrf', 'yash raj films', 'tips official', 'tips music', 'saregama', 'saregamamusic',
  'universal music', 'warner music', 'speed records', 'white hill music',
  'eros now', 'venus', 'aditya music', 'lahari music', 'geet mp3',
  'times music', 'svf music', 't-series apna punjab', 'panj-aab records',
  'columbia records', 'def jam', 'atlantic records', 'republic records',
  'rca records', 'spinnin\' records', 'monstercat', 'ultra records',
  'anjunabeats', 'armada music', 'nocopyrightsounds', 'coke studio'
];

// Indian regional and classical music terms that indicate genuine music
const REGIONAL_AND_CLASSICAL_MUSIC_TERMS = [
  'gaana', 'gana', 'geet', 'song', 'bhajan', 'aarti', 'qawwali', 'ghazal',
  'kirtan', 'naat', 'lokgeet', 'bhojpuri', 'punjabi', 'haryanvi', 'bengali',
  'tamil', 'telugu', 'malayalam', 'kannada', 'marathi', 'gujarati', 'odia',
  'raga', 'raag', 'ragini', 'bandish', 'tarana', 'thumri', 'khayal', 'dhrupad',
  'sitar', 'sarod', 'tabla', 'shehnai', 'bansuri', 'flute', 'santoor',
  'veena', 'mridangam', 'symphony', 'sonata', 'concerto', 'nocturne', 'prelude',
  'acoustic version', 'unplugged', 'live performance', 'coke studio'
];

// Non-music anti-patterns (Disqualifiers that strictly indicate non-music content)
const NON_MUSIC_PATTERNS = {
  gaming: [
    /\b(gameplay|walkthrough|playthrough|lets play|let's play|speedrun|stream highlights|pro gameplay|funny moments|glitch|mod|boss fight)\b/i,
    /\b(minecraft|roblox|valorant|gta\s*[v5]|fortnite|pubg|bgmi|call of duty|warzone|apex legends|genshin impact|elden ring|fifa\s*\d{2}|free fire|cs:?go|cs2)\b/i
  ],
  vlog: [
    /\b(daily vlog|family vlog|my day in the life|day in my life|morning routine|night routine|what i eat in a day|mukbang|shopping haul|clothing haul|room tour|house tour|travel vlog|couple vlog|vlog \d+)\b/i
  ],
  tutorial: [
    /\b(tutorial|how to|how-to|step by step|for beginners|crash course|full course|lecture|masterclass|learn [a-z]+ in \d+|complete guide|tips and tricks)\b/i,
    // Note: music production / mixing tutorials are explicitly blocked non-music per specification
    /\b(fl studio tutorial|ableton tutorial|logic pro tutorial|beat making tutorial|mixing tutorial|mastering tutorial|music production tutorial|how to make a beat|how to sing)\b/i,
    /\b(coding tutorial|python tutorial|react tutorial|javascript tutorial|excel tutorial)\b/i
  ],
  podcast: [
    /\b(podcast|full podcast|podcast episode|ep\.?\s*\d+|the ranveer show|joe rogan|talk show|roundtable discussion|panel discussion|interview with|full interview|in conversation with)\b/i
  ],
  news: [
    /\b(breaking news|live news|press conference|daily news|headline news|news bulletin|debate live|political debate|speech live|prime time debate)\b/i
  ],
  movie_tv: [
    /\b(full movie|complete movie|hindi dubbed movie|south movie|full episode|episode \d+|ep \d+|web series|climax scene|comedy scene|fight scene|deleted scene|movie scene|teaser|official teaser|trailer|official trailer)\b/i
  ],
  reaction_review: [
    /\b(reaction video|reacts to|reacting to|song reaction|trailer reaction|first time hearing|honest review|movie review|unboxing|tech review|gadget review|camera test)\b/i
  ],
  background_music_only: [
    /\b(with background music|relaxing background music for study|study with me background|ambient background for gaming|gameplay with phonk|tiktok edit with music|satisfying video with music)\b/i
  ]
};

class MusicValidationService {
  constructor() {
    this.geminiClient = null;
    this.initGeminiClient();
  }

  initGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (apiKey && apiKey.trim()) {
      try {
        this.geminiClient = new GoogleGenAI({ apiKey: apiKey.trim() });
      } catch (err) {
        console.warn('[MusicValidationService] Gemini client initialization notice:', err.message);
      }
    }
  }

  getCache(videoId) {
    if (!videoId) return null;
    const entry = VALIDATION_CACHE.get(videoId);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      VALIDATION_CACHE.delete(videoId);
      return null;
    }
    return entry;
  }

  setCache(videoId, result) {
    if (!videoId) return;
    if (VALIDATION_CACHE.size >= MAX_CACHE_SIZE) {
      const oldestKey = VALIDATION_CACHE.keys().next().value;
      VALIDATION_CACHE.delete(oldestKey);
    }
    VALIDATION_CACHE.set(videoId, {
      ...result,
      timestamp: Date.now()
    });
  }

  /**
   * Parse ISO 8601 duration (e.g. PT3M45S) or standard colon format (e.g. 3:45) into seconds.
   */
  parseDurationToSeconds(duration) {
    if (!duration) return null;
    if (typeof duration === 'number') return duration;
    if (typeof duration !== 'string') return null;

    // ISO 8601 duration (PT#M#S)
    if (duration.startsWith('PT')) {
      const hours = (duration.match(/(\d+)H/) || [])[1] || 0;
      const minutes = (duration.match(/(\d+)M/) || [])[1] || 0;
      const seconds = (duration.match(/(\d+)S/) || [])[1] || 0;
      return parseInt(hours, 10) * 3600 + parseInt(minutes, 10) * 60 + parseInt(seconds, 10);
    }

    // Colon format (HH:MM:SS or MM:SS)
    const parts = duration.split(':').map(p => parseInt(p, 10) || 0);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return null;
  }

  // =========================================================================
  // LAYER 1: YOUTUBE CATEGORY & STREAM VALIDATION
  // =========================================================================
  evaluateLayer1Category(meta = {}) {
    const categoryId = meta.categoryId !== undefined ? String(meta.categoryId) : null;
    const durationSec = this.parseDurationToSeconds(meta.duration);
    const isLive = Boolean(meta.liveBroadcastContent && meta.liveBroadcastContent !== 'none');

    let score = 0.5; // neutral starting baseline
    let isMusicCategory = false;
    const notes = [];

    // Category Check
    if (categoryId === '10') {
      isMusicCategory = true;
      score += 0.35;
      notes.push('Category 10: Official YouTube Music category');
    } else if (categoryId) {
      // Known non-music categories
      const nonMusicCatMap = {
        '20': 'Gaming',
        '25': 'News & Politics',
        '26': 'Howto & Style',
        '27': 'Education',
        '28': 'Science & Technology',
        '17': 'Sports',
        '23': 'Comedy',
        '22': 'People & Blogs',
        '24': 'Entertainment',
        '1': 'Film & Animation'
      };
      if (['20', '25', '26', '27', '28', '17'].includes(categoryId)) {
        score -= 0.60;
        notes.push(`Non-music category: ${nonMusicCatMap[categoryId] || categoryId}`);
      } else if (['22', '23', '24', '1'].includes(categoryId)) {
        score -= 0.20;
        notes.push(`Ambiguous entertainment/blog category: ${nonMusicCatMap[categoryId] || categoryId}`);
      }
    } else {
      notes.push('Category ID omitted or unprovided');
    }

    // Duration Check (Typical song duration: 90s to 600s)
    if (durationSec !== null) {
      if (durationSec >= 90 && durationSec <= 480) {
        score += 0.15;
        notes.push(`Standard song duration: ${durationSec}s`);
      } else if (durationSec > 900) { // > 15 minutes
        score -= 0.50;
        notes.push(`Duration exceeds 15 minutes (${durationSec}s)`);
      } else if (durationSec < 45) { // < 45s (Shorts/teasers)
        score -= 0.35;
        notes.push(`Duration under 45s (${durationSec}s)`);
      }
    }

    // Live Stream Check
    if (isLive) {
      score -= 0.40;
      notes.push('Active live broadcast without pre-verified concert audio');
    }

    score = Math.max(0.0, Math.min(1.0, score));
    return {
      passed: score >= 0.40,
      score,
      categoryId,
      isMusicCategory,
      durationSec,
      isLive,
      notes: notes.join('; ')
    };
  }

  // =========================================================================
  // LAYER 2: METADATA-BASED VALIDATION
  // =========================================================================
  evaluateLayer2Metadata(meta = {}) {
    const title = (meta.title || '').trim();
    const channel = (meta.channel || meta.channelTitle || '').trim();
    const description = (meta.description || '').trim();
    const fullText = `${title} ${channel} ${description}`.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const lowerChannel = channel.toLowerCase();

    const positiveSignals = [];
    const negativeSignals = [];
    let score = 0.5;

    // 1. Topic Channel Check (Highest confidence music signal on YouTube)
    const isTopicChannel = lowerChannel.endsWith('- topic') || lowerChannel.includes('topic');
    if (isTopicChannel) {
      positiveSignals.push('Official YouTube Music Topic Channel');
      score += 0.45;
    }

    // 2. Official Record Label or VEVO Channel
    const isOfficialLabel = VERIFIED_RECORD_LABELS.some(label => lowerChannel.includes(label)) ||
                            lowerChannel.endsWith('vevo') ||
                            lowerChannel.includes('official artist channel');
    if (isOfficialLabel) {
      positiveSignals.push(`Verified Record Label / OAC: ${channel}`);
      score += 0.40;
    }

    // 2b. Performing Artist Self-Upload (Channel name in title, or title starts with channel)
    if (lowerChannel && lowerChannel.length >= 3 && (lowerTitle.startsWith(lowerChannel) || lowerTitle.includes(lowerChannel))) {
      positiveSignals.push(`Channel name matches performing artist in title: "${channel}"`);
      score += 0.25;
    }

    // 2c. Music Collaboration Indicator (&, x, feat., ft., prod., with)
    if (/\b(&|x|feat\.?|ft\.?|prod\.?|featuring|with)\b/i.test(lowerTitle)) {
      positiveSignals.push('Artist collaboration indicator in title');
      score += 0.15;
    }

    // 3. Audio & Music Video Indicators in Title
    if (/\b(official\s+(music\s+)?video|official\s+audio|full\s+(video\s+)?song|lyric\s+video|lyrics|audio\s+track|original\s+song|visualizer)\b/i.test(lowerTitle)) {
      positiveSignals.push('Explicit official song/video indicator in title');
      score += 0.30;
    }

    // 4. Standard Song Delimiter Structure ("Artist - Song Title", feat./ft.)
    const hasArtistTrackDelimiter = /^[^-–|:]+[-–|:][^-–|:]+$/.test(title) ||
                                    /\b(feat\.?|ft\.?|prod\.?|produced by)\b/i.test(lowerTitle);
    if (hasArtistTrackDelimiter) {
      positiveSignals.push('Standard Artist - Title or collaborator delimiter');
      score += 0.20;
    }

    // 5. Regional, Folk & Classical Music Terms
    for (const term of REGIONAL_AND_CLASSICAL_MUSIC_TERMS) {
      if (fullText.includes(term)) {
        positiveSignals.push(`Music form indicator: "${term}"`);
        score += 0.20;
        break;
      }
    }

    // 6. Music Publishing Credits in Description
    if (/\b(provided to youtube by|released on:|isrc|composer:|lyricist:|music director:|℗|©|auto-generated by youtube)\b/i.test(description)) {
      positiveSignals.push('Digital music distributor / ISRC publishing metadata in description');
      score += 0.35;
    }

    // 7. Check for Non-Music Disqualifiers (Negative Signals)
    for (const [category, regexList] of Object.entries(NON_MUSIC_PATTERNS)) {
      for (const regex of regexList) {
        if (regex.test(lowerTitle)) {
          negativeSignals.push(`Disqualifier (${category}) in title: matches ${regex}`);
          score -= 0.60;
          break;
        } else if (regex.test(fullText) && !isTopicChannel && !isOfficialLabel) {
          negativeSignals.push(`Disqualifier (${category}) in metadata: matches ${regex}`);
          score -= 0.40;
          break;
        }
      }
    }

    score = Math.max(0.0, Math.min(1.0, score));

    // A track fails Layer 2 if strong negative signals exist without overriding official topic/label verification
    const passed = negativeSignals.length === 0 && score >= 0.45;

    return {
      passed,
      score,
      isTopicChannel,
      isOfficialLabel,
      positiveSignals,
      negativeSignals
    };
  }

  // =========================================================================
  // LAYER 3: AI CONTENT CLASSIFICATION
  // =========================================================================
  async evaluateLayer3AI(meta = {}, layer1Result = {}, layer2Result = {}) {
    // If YouTube CategoryId is missing from search snippet, rely primarily on Layer 2 metadata (90%)
    const hasCategoryInfo = layer1Result.categoryId !== null && layer1Result.categoryId !== 'null';
    const layer1Weight = hasCategoryInfo ? 0.35 : 0.10;
    const layer2Weight = 1.0 - layer1Weight;
    const combinedScore = (layer1Result.score * layer1Weight) + (layer2Result.score * layer2Weight);

    const hasDisqualifiers = layer2Result.negativeSignals.length > 0;
    const isTopicOrLabel = layer2Result.isTopicChannel || layer2Result.isOfficialLabel;
    const hasArtistTrackDelimiter = layer2Result.positiveSignals.some(s => s.includes('delimiter') || s.includes('artist in title') || s.includes('collaboration'));

    // TIER 1: HIGH-CONFIDENCE OBVIOUS CASES (0ms Latency Fast-Path)
    // A. Obvious Disqualification: clear non-music markers without official distributor proof
    if (hasDisqualifiers && !isTopicOrLabel) {
      const topDisqualifier = layer2Result.negativeSignals[0];
      let blockedCat = 'other_non_music';
      if (topDisqualifier.includes('gaming')) blockedCat = 'gaming';
      else if (topDisqualifier.includes('vlog')) blockedCat = 'vlog';
      else if (topDisqualifier.includes('tutorial')) blockedCat = 'tutorial';
      else if (topDisqualifier.includes('podcast')) blockedCat = 'podcast';
      else if (topDisqualifier.includes('news')) blockedCat = 'news';
      else if (topDisqualifier.includes('movie_tv')) blockedCat = 'movie_tv';
      else if (topDisqualifier.includes('reaction')) blockedCat = 'reaction';
      else if (topDisqualifier.includes('background_music')) blockedCat = 'background_music_only';

      return {
        passed: false,
        isMusic: false,
        confidence: 0.95,
        category: blockedCat,
        model: 'deterministic-rules-tier1',
        reason: `Identified as non-music (${blockedCat}): ${topDisqualifier}`
      };
    }

    // B. Obvious Music: Topic channel, verified label, or high-confidence score with no disqualifiers
    if ((isTopicOrLabel || combinedScore >= 0.75 || (hasArtistTrackDelimiter && combinedScore >= 0.65)) && !hasDisqualifiers) {
      let musicCat = 'official_song';
      if (layer2Result.positiveSignals.some(s => s.includes('classical') || s.includes('raga') || s.includes('sitar'))) {
        musicCat = 'classical';
      } else if (layer2Result.positiveSignals.some(s => s.includes('bhajan') || s.includes('aarti') || s.includes('qawwali'))) {
        musicCat = 'devotional';
      } else if (layer2Result.positiveSignals.some(s => s.includes('bhojpuri') || s.includes('punjabi') || s.includes('regional'))) {
        musicCat = 'regional_folk';
      } else if (layer2Result.isTopicChannel) {
        musicCat = 'licensed_music';
      }

      return {
        passed: true,
        isMusic: true,
        confidence: 0.96,
        category: musicCat,
        model: 'deterministic-rules-tier1',
        reason: `Verified genuine music track: ${layer2Result.positiveSignals.slice(0, 2).join(', ')}`
      };
    }

    // TIER 2: AMBIGUOUS OR BORDERLINE CASES (Semantic AI Classification via Dual-Key Manager)
    if (isGeminiConfigured()) {
      try {
        const aiDecision = await this.queryGeminiClassifier(meta);
        if (aiDecision && typeof aiDecision.isMusic === 'boolean') {
          return {
            passed: aiDecision.isMusic && aiDecision.confidence >= 0.65,
            isMusic: aiDecision.isMusic,
            confidence: aiDecision.confidence,
            category: aiDecision.category || (aiDecision.isMusic ? 'independent_music' : 'other_non_music'),
            model: 'gemini-key-manager',
            reason: aiDecision.reason || 'Gemini semantic classification'
          };
        }
      } catch (err) {
        console.warn('[MusicValidationService] Gemini semantic query notice:', err.message);
      }
    }

    // TIER 3: SAFE HEURISTIC FALLBACK (Fail-Safe: Allow clean songs, reject non-music)
    const isCleanTrack = hasArtistTrackDelimiter && !hasDisqualifiers && (layer2Result.score >= 0.60 || combinedScore >= 0.55);
    const isMarginalMusic = (combinedScore >= 0.60 || isCleanTrack) && !hasDisqualifiers;

    return {
      passed: isMarginalMusic,
      isMusic: isMarginalMusic,
      confidence: parseFloat(combinedScore.toFixed(2)),
      category: isMarginalMusic ? 'independent_music' : 'uncertain',
      model: 'heuristic-tier3',
      reason: isMarginalMusic
        ? 'Accepted under music metadata heuristics'
        : 'Content classification confidence insufficient to confirm genuine music track'
    };
  }

  /**
   * Queries Gemini 3.8 Flash (with automatic secondary failover) to classify ambiguous candidates.
   */
  async queryGeminiClassifier(meta = {}) {
    if (!isGeminiConfigured()) return null;

    const prompt = `You are the Loopra Music Streaming Platform Content Classifier.
Your job is to determine whether a YouTube video is genuinely an individual MUSIC TRACK (song, instrumental, bhajan, classical, regional folk, rap, etc.) or NON-MUSIC (gaming, vlog, tutorial, podcast, interview, news, movie scene, reaction, or video merely containing background music).

VIDEO METADATA TO EVALUATE:
- Title: "${meta.title || ''}"
- Channel: "${meta.channel || ''}"
- Category ID: "${meta.categoryId || ''}"
- Duration: "${meta.duration || ''}"
- Description snippet: "${(meta.description || '').slice(0, 300)}"

ALLOWED MUSIC CATEGORIES:
- official_song
- licensed_music
- independent_music
- regional_folk
- devotional
- classical
- instrumental
- rap_hiphop
- live_performance

BLOCKED NON-MUSIC CATEGORIES:
- gaming
- vlog
- tutorial
- podcast
- interview
- news
- movie_tv
- reaction
- background_music_only
- other_non_music

OUTPUT RULES:
Return strictly a JSON object with:
{
  "isMusic": true or false,
  "confidence": number between 0.0 and 1.0,
  "category": string matching one of the categories above,
  "reason": short explanation (max 15 words)
}`;

    const opResult = await executeGeminiOperation(async ({ client, modelName }) => {
      const response = await client.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });
      const text = response?.text?.trim() || '';
      return JSON.parse(text);
    }, {
      modelName: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      timeoutMs: 6000,
      operationName: 'MusicValidationClassifier'
    });

    if (opResult.success && opResult.data) {
      return opResult.data;
    }
    return null;
  }

  // =========================================================================
  // LAYER 4: PLAYBACK-LEVEL VALIDATION GATE
  // =========================================================================
  /**
   * Authoritative validation gate for any playback request or search filtering.
   * Evaluates Layers 1, 2, and 3, applies strict confidence threshold, and caches the result.
   */
  async validateTrack(rawTrack, options = {}) {
    const startTime = Date.now();
    if (!rawTrack) {
      return {
        eligible: false,
        isMusic: false,
        confidence: 0.0,
        category: 'invalid',
        reason: 'Track object is null or undefined',
        latencyMs: 0
      };
    }

    const videoId = rawTrack.videoId || rawTrack.id?.videoId || rawTrack.id;
    if (!isValidYouTubeId(videoId)) {
      return {
        eligible: false,
        isMusic: false,
        confidence: 0.0,
        category: 'invalid',
        reason: `Invalid YouTube video ID "${videoId}"`,
        layerResults: {
          layer1_category: { passed: false, score: 0, notes: 'Invalid video ID format' },
          layer2_metadata: { passed: false, score: 0, positiveSignals: [], negativeSignals: ['Invalid video ID'] },
          layer3_ai: { passed: false, isMusic: false, confidence: 0, category: 'invalid', reason: 'Invalid video ID format' },
          layer4_playback: { eligible: false, timestamp: Date.now() }
        },
        latencyMs: 0
      };
    }

    // Check Cache
    if (!options.bypassCache) {
      const cached = this.getCache(videoId);
      if (cached) {
        return {
          ...cached,
          fromCache: true,
          latencyMs: Date.now() - startTime
        };
      }
    }

    const title = (rawTrack.title || rawTrack.snippet?.title || rawTrack.name || '').trim();
    const channel = (rawTrack.channel || rawTrack.snippet?.channelTitle || rawTrack.artist || '').trim();
    const description = (rawTrack.description || rawTrack.snippet?.description || '').trim();
    const categoryId = rawTrack.categoryId || rawTrack.snippet?.categoryId || null;
    const duration = rawTrack.duration || rawTrack.contentDetails?.duration || null;
    const liveBroadcastContent = rawTrack.liveBroadcastContent || rawTrack.snippet?.liveBroadcastContent || null;

    const meta = {
      videoId,
      title,
      channel,
      description,
      categoryId,
      duration,
      liveBroadcastContent
    };

    // Execute Layers 1, 2, and 3
    const layer1 = this.evaluateLayer1Category(meta);
    const layer2 = this.evaluateLayer2Metadata(meta);
    const layer3 = await this.evaluateLayer3AI(meta, layer1, layer2);

    // Strict Eligibility Rule:
    // A video is eligible for playback IF AND ONLY IF:
    // 1. Layer 2 has no disqualifiers
    // 2. Layer 3 AI classifier confirms isMusic === true
    // 3. Layer 3 confidence >= 0.70 (High confidence music)
    const isEligible = layer2.negativeSignals.length === 0 &&
                       layer3.isMusic === true &&
                       layer3.confidence >= 0.70;

    const result = {
      eligible: isEligible,
      isMusic: layer3.isMusic,
      confidence: layer3.confidence,
      category: layer3.category,
      reason: isEligible
        ? (layer3.reason || 'Verified genuine music track')
        : (layer2.negativeSignals[0] || layer3.reason || 'Content could not be verified as genuine music track'),
      layerResults: {
        layer1_category: layer1,
        layer2_metadata: layer2,
        layer3_ai: layer3,
        layer4_playback: {
          eligible: isEligible,
          timestamp: Date.now()
        }
      },
      track: {
        videoId,
        title,
        artist: channel,
        channel,
        duration: duration || '3:30'
      },
      latencyMs: Date.now() - startTime
    };

    // Cache the verified decision
    this.setCache(videoId, result);
    return result;
  }

  /**
   * Batch validate an array of tracks (e.g. for search results or playlists)
   */
  async batchValidateTracks(tracks = []) {
    if (!Array.isArray(tracks)) return [];
    const results = [];
    for (const track of tracks) {
      const res = await this.validateTrack(track);
      results.push(res);
    }
    return results;
  }
}

export const musicValidationService = new MusicValidationService();
export default musicValidationService;
