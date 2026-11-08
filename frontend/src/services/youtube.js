
const sanitizeApiKey = (key) => {
  if (typeof key !== 'string') return '';
  let clean = key.trim().replace(/^['"]|['"]$/g, '');
  if (clean.startsWith('AIzaSy') && clean.length > 39) {
    clean = clean.slice(0, 39);
  }
  return clean;
};

// Parse single or comma/newline/space-separated keys
const parseKeyList = (raw) => {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/[,\r\n\s]+/)
    .map(sanitizeApiKey)
    .filter(Boolean);
};

// Multi-key support: Comma-separated list in VITE_YOUTUBE_API_KEYS, or discrete VITE_YOUTUBE_KEY_1..10
const getEnvYouTubeKeys = () => {
  const env = import.meta.env || {};
  const listFromCombined = [
    ...parseKeyList(env.VITE_YOUTUBE_API_KEYS),
    ...parseKeyList(env.VITE_YOUTUBE_KEYS),
    ...parseKeyList(env.YOUTUBE_API_KEYS),
  ];

  const discreteKeys = [
    env.VITE_YOUTUBE_KEY_1,
    env.VITE_YOUTUBE_KEY_2,
    env.VITE_YOUTUBE_KEY_3,
    env.VITE_YOUTUBE_KEY_4,
    env.VITE_YOUTUBE_KEY_5,
    env.VITE_YOUTUBE_KEY_6,
    env.VITE_YOUTUBE_KEY_7,
    env.VITE_YOUTUBE_KEY_8,
    env.VITE_YOUTUBE_KEY_9,
    env.VITE_YOUTUBE_KEY_10,
    env.VITE_YOUTUBE_API_KEY,
    env.YOUTUBE_API_KEY,
  ].map(sanitizeApiKey).filter(Boolean);

  // Return unique keys preserving order
  const unique = [];
  const seen = new Set();
  for (const k of [...listFromCombined, ...discreteKeys]) {
    if (k && !seen.has(k)) {
      seen.add(k);
      unique.push(k);
    }
  }
  return unique;
};

const YOUTUBE_API_KEYS = getEnvYouTubeKeys();

let currentApiKeyIndex = parseInt(localStorage.getItem('yt_key_index') || '0', 10);

const getActiveApiKey = () => {
  if (YOUTUBE_API_KEYS.length === 0) return '';
  return YOUTUBE_API_KEYS[currentApiKeyIndex % YOUTUBE_API_KEYS.length];
};

const rotateApiKey = () => {
  if (YOUTUBE_API_KEYS.length === 0) return;
  currentApiKeyIndex = (currentApiKeyIndex + 1) % YOUTUBE_API_KEYS.length;
  localStorage.setItem('yt_key_index', currentApiKeyIndex.toString());
};

export const fetchWithKeyRotation = async (urlGenerator) => {
  if (YOUTUBE_API_KEYS.length === 0) {
    throw new Error("No YouTube API keys configured in environment variables.");
  }
  let attempts = 0;
  while (attempts < YOUTUBE_API_KEYS.length) {
    const apiKey = getActiveApiKey();
    const url = urlGenerator(apiKey);
    try {
      const res = await fetch(url);
      const ct = res.headers.get('content-type') || '';
      let data = null;
      if (ct.includes('application/json')) {
        data = await res.json().catch(() => null);
      }
      if (!res.ok || !data || data.error) {
        rotateApiKey();
        attempts++;
        continue;
      }
      return data;
    } catch (err) {
      rotateApiKey();
      attempts++;
    }
  }
  throw new Error("All YouTube API keys have exhausted daily quotas or failed.");
};

export const fetchCategoryVideos = async (query, maxResults = 25) => {
  const data = await fetchWithKeyRotation(apiKey =>
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${apiKey}`
  );

  return data.items ? data.items.map(item => {
    const videoId = item.id.videoId || item.id;
    return {
      id: videoId,
      title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
      channel: item.snippet.channelTitle,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }) : [];
};