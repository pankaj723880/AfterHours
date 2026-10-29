import https from 'https';
import http from 'http';
import { URL } from 'url';

const candidateStreams = [
  // Prasar Bharati / Akashvani Official CDNs
  {
    name: 'AIR FM Gold (Delhi)',
    source: 'Prasar Bharati / Akashvani Official',
    url: 'https://d3r9rhourdc02u.cloudfront.net/assets/radio/airdelhi03/air003_Auto.m3u8',
    genre: 'Classic Hindi Film Songs, News & Talks',
    language: 'Hindi'
  },
  {
    name: 'AIR FM Rainbow (Delhi)',
    source: 'Prasar Bharati / Akashvani Official',
    url: 'https://d3r9rhourdc02u.cloudfront.net/assets/radio/airdelhi02/air002_Auto.m3u8',
    genre: 'Contemporary Hindi Songs, Indie Pop',
    language: 'Hindi'
  },
  {
    name: 'AIR Raagam',
    source: 'Prasar Bharati / Akashvani Official',
    url: 'https://d3r9rhourdc02u.cloudfront.net/assets/radio/airbang04/air036_Auto.m3u8',
    genre: 'Indian Classical Music (Carnatic & Hindustani)',
    language: 'Indian Classical'
  },
  {
    name: 'Akashvani Live News 24x7',
    source: 'Prasar Bharati / Akashvani Official',
    url: 'https://d3r9rhourdc02u.cloudfront.net/assets/radio/airdelhi01/air001_Auto.m3u8',
    genre: 'National News & Current Affairs',
    language: 'Hindi / English'
  },
  {
    name: 'AIR Vividh Bharati (Bitgravity CDN)',
    source: 'Prasar Bharati Official CDN',
    url: 'http://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8',
    genre: 'Evergreen Hindi Film Music & Entertainment',
    language: 'Hindi'
  },
  {
    name: 'AIR Vividh Bharati (Cloudfront 007)',
    source: 'Prasar Bharati Official Cloudfront',
    url: 'https://d3r9rhourdc02u.cloudfront.net/assets/radio/airmumbai01/air007_Auto.m3u8',
    genre: 'Evergreen Bollywood & Hindi Music',
    language: 'Hindi'
  },
  {
    name: 'AIR Vividh Bharati (Waves OTT)',
    source: 'Prasar Bharati Waves Platform',
    url: 'https://radio.wavespb.com/live/146ed6ec6dea5a24/146ed6ec6dea5a24.m3u8',
    genre: 'Evergreen Bollywood & Hindi Music',
    language: 'Hindi'
  },
  {
    name: 'AIR Vividh Bharati (Alternative Cloudfront)',
    source: 'Prasar Bharati Cloudfront',
    url: 'https://d3r9rhourdc02u.cloudfront.net/assets/radio/airdelhi07/air007_Auto.m3u8',
    genre: 'Evergreen Bollywood & Hindi Music',
    language: 'Hindi'
  },
  {
    name: 'AIR Vividh Bharati (pbaudio001 secure)',
    source: 'Prasar Bharati CDN',
    url: 'https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8',
    genre: 'Evergreen Bollywood & Hindi Music',
    language: 'Hindi'
  },
  {
    name: 'AIR Vividh Bharati (Akashvani Delhi Main)',
    source: 'Prasar Bharati Cloudfront',
    url: 'https://d3r9rhourdc02u.cloudfront.net/assets/radio/airdelhi04/air004_Auto.m3u8',
    genre: 'Hindi Music & Culture',
    language: 'Hindi'
  },
  // Other verified Indian / Hindi community and internet streams
  {
    name: 'Radio City Hindi',
    source: 'Radio City Official Online Web Stream',
    url: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
    genre: 'Bollywood Hits & Pop',
    language: 'Hindi'
  },
  {
    name: 'Radio City Smaran',
    source: 'Radio City Official Online Web Stream',
    url: 'https://stream.zeno.fm/4w90w1u102quv',
    genre: 'Devotional & Bhakti Sangeet',
    language: 'Hindi'
  },
  {
    name: 'Bollywood Gaane Purane',
    source: 'Indian Classic Music Stream',
    url: 'https://stream.zeno.fm/cvmfe4b4m0hvv',
    genre: 'Golden Era Retro Bollywood (50s-70s)',
    language: 'Hindi'
  },
  {
    name: 'Sayaji FM Hindi',
    source: 'Indian Community FM Broadcast',
    url: 'https://stream.zeno.fm/k22efywb9reuv',
    genre: 'Indian Bollywood & Local Entertainment',
    language: 'Hindi'
  }
];

function fetchHeadOrGet(streamUrl) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(streamUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(streamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*'
        },
        timeout: 8000
      }, (res) => {
        let chunks = [];
        let totalBytes = 0;
        
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, streamUrl).href;
          req.destroy();
          fetchHeadOrGet(redirectUrl).then(resolve);
          return;
        }

        res.on('data', (chunk) => {
          chunks.push(chunk);
          totalBytes += chunk.length;
          // For audio stream or m3u8 playlist, 10KB - 50KB is plenty to verify
          if (totalBytes > 65536) {
            req.destroy();
            resolve({
              statusCode: res.statusCode,
              contentType: res.headers['content-type'],
              cors: res.headers['access-control-allow-origin'],
              bytesReceived: totalBytes,
              preview: Buffer.concat(chunks).toString('utf-8', 0, Math.min(500, totalBytes)),
              finalUrl: streamUrl
            });
          }
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            contentType: res.headers['content-type'],
            cors: res.headers['access-control-allow-origin'],
            bytesReceived: totalBytes,
            preview: Buffer.concat(chunks).toString('utf-8', 0, Math.min(500, totalBytes)),
            finalUrl: streamUrl
          });
        });
      });

      req.on('error', (err) => {
        resolve({ error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ error: 'Connection timed out (8s)' });
      });
    } catch (e) {
      resolve({ error: e.message });
    }
  });
}

async function run() {
  console.log(`Starting verification of ${candidateStreams.length} Indian candidate radio streams...\n`);
  const results = [];

  for (const item of candidateStreams) {
    process.stdout.write(`Testing: ${item.name}... `);
    const result = await fetchHeadOrGet(item.url);
    if (result.error) {
      console.log(`❌ Failed: ${result.error}`);
      results.push({ ...item, status: 'FAILED', detail: result.error });
    } else if (result.statusCode >= 200 && result.statusCode < 300) {
      console.log(`✅ OK (${result.statusCode}) [${result.contentType}] ${result.bytesReceived} bytes, CORS: ${result.cors || 'none'}`);
      results.push({
        ...item,
        status: 'SUCCESS',
        statusCode: result.statusCode,
        contentType: result.contentType,
        cors: result.cors,
        bytesReceived: result.bytesReceived,
        preview: result.preview.slice(0, 150).replace(/\r?\n/g, ' ')
      });
    } else {
      console.log(`⚠️ Status: ${result.statusCode}`);
      results.push({ ...item, status: `HTTP_${result.statusCode}` });
    }
  }

  console.log('\n--- VERIFICATION SUMMARY ---');
  console.log(JSON.stringify(results, null, 2));
}

run();

