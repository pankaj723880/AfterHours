const YOUTUBE_API_KEYS = [
  import.meta.env.VITE_YOUTUBE_KEY_1,
  import.meta.env.VITE_YOUTUBE_KEY_2,
  import.meta.env.VITE_YOUTUBE_KEY_3,
].filter(Boolean);

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
      const data = await res.json();
      
      if (data.error && (data.error.code === 403 || data.error.message?.includes('quota') || data.error.errors?.[0]?.reason === 'quotaExceeded')) {
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

  return data.items ? data.items.map(item => ({
    id: item.id.videoId || item.id,
    title: item.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"),
    channel: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
  })) : [];
};