import express from 'express';
import axios from 'axios';
import { interpretMoodPrompt } from '../services/moodClassifier.js';
import ytSearch from 'yt-search';
import { filterSingleSongs } from '../services/songFilter.js';

const router = express.Router();

const decodeHtml = (str = '') => {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
};

// Quick in-memory cache for mood recommendations (TTL 15 mins)
const moodCache = new Map();
const MOOD_CACHE_TTL = 15 * 60 * 1000;

router.post('/recommend', async (req, res) => {
  try {
    const { prompt = '', mood, language, genre, era, energy, seed = 0 } = req.body;

    const interpreted = interpretMoodPrompt(prompt, { mood, language, genre, era, energy });

    // Rotate queries based on seed to ensure refresh provides fresh recommendations
    const queries = interpreted.suggestedQueries;
    const selectedQueryIndex = Math.abs(parseInt(seed, 10) || 0) % queries.length;
    const primaryQuery = queries[selectedQueryIndex] || queries[0] || 'bollywood lofi chill hits';

    const cacheKey = `${primaryQuery}_${seed}`;
    const cached = moodCache.get(cacheKey);
    if (cached && Date.now() - cached.time < MOOD_CACHE_TTL) {
      return res.json({
        ...cached.data,
        cached: true
      });
    }

    // Attempt catalog search using local server search endpoint or direct query
    const port = process.env.PORT || 5000;
    let rawItems = [];

    try {
      const response = await axios.get(`http://127.0.0.1:${port}/api/youtube/search`, {
        params: { q: primaryQuery, limit: 15 },
        timeout: 6000
      });
      if (response.data && Array.isArray(response.data.items)) {
        rawItems = response.data.items;
      }
    } catch (localSearchErr) {
      // Fallback directly to yt-search if local internal request fails
      try {
        const searchResult = await ytSearch({ query: primaryQuery, page: 1 });
        const videos = searchResult?.videos || [];
        rawItems = videos.slice(0, 15).map(v => ({
          id: { videoId: v.videoId },
          snippet: {
            title: decodeHtml(v.title || ''),
            channelTitle: decodeHtml(v.author?.name || 'Unknown Artist'),
            thumbnails: {
              high: { url: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` },
              medium: { url: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg` },
              default: { url: `https://i.ytimg.com/vi/${v.videoId}/default.jpg` }
            }
          }
        }));
      } catch (ytErr) {
        console.warn('[Mood Recommendation Fallback Warning]:', ytErr.message);
      }
    }

    // Filter and format single-song tracks only
    const singleSongs = filterSingleSongs(rawItems);
    const chosenItems = singleSongs.length > 0 ? singleSongs : rawItems;

    const seenIds = new Set();
    const tracks = [];

    for (const item of chosenItems) {
      const videoId = item.id?.videoId || item.id || item.videoId;
      if (!videoId || seenIds.has(videoId)) continue;
      seenIds.add(videoId);

      tracks.push({
        id: videoId,
        videoId,
        title: decodeHtml(item.title || item.snippet?.title || 'Unknown Title'),
        channel: decodeHtml(item.channel || item.snippet?.channelTitle || 'Unknown Artist'),
        artist: decodeHtml(item.artist || item.snippet?.channelTitle || 'Unknown Artist'),
        thumbnail: item.thumbnail ||
                   item.snippet?.thumbnails?.high?.url ||
                   item.snippet?.thumbnails?.medium?.url ||
                   item.snippet?.thumbnails?.default?.url ||
                   `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: 'Stream'
      });
    }

    const result = {
      analysis: {
        detectedMood: interpreted.mood,
        confidence: interpreted.confidence,
        detectedLanguage: interpreted.language,
        detectedEra: interpreted.era,
        detectedEnergy: interpreted.energy,
        isRuleBased: interpreted.isRuleBased,
        queryUsed: primaryQuery
      },
      tracks: tracks.slice(0, 12),
      totalFound: tracks.length
    };

    moodCache.set(cacheKey, { data: result, time: Date.now() });
    res.json(result);
  } catch (err) {
    console.error('[Mood Recommend Error]:', err.message);
    res.status(500).json({ error: 'Failed to generate recommendations', tracks: [] });
  }
});

export default router;
