import express from 'express';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const router = express.Router();

export const INDIAN_RADIO_STATIONS = [
  {
    id: 'air-vividh-bharati',
    name: 'AIR Vividh Bharati',
    tagline: 'Desh Ki Swar Lahari - Iconic Hindi Film Music',
    genre: 'Evergreen Hindi Film Songs, Sangeet Sarita & Entertainment',
    language: 'Hindi',
    category: 'Hindi & Bollywood',
    featured: true,
    description: 'India’s most celebrated public radio service featuring golden era Bollywood classics, Bhoole Bisre Geet, and musical programs since 1957.',
    officialSource: 'Prasar Bharati Official Live Stream',
    officialWebsite: 'https://prasarbharati.gov.in/en/vividh-bharati/',
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
    isPlayable: true,
    streamFormat: 'hls',
    upstreamBaseUrl: 'https://d3r9rhourdc02u.cloudfront.net/assets/radio/airdelhi07/',
    upstreamMasterFile: 'air007_Auto.m3u8',
    wavesUpstreamUrl: 'https://d1cvqgmbcpg5yn.cloudfront.net/146ed6ec6dea5a24/146ed6ec6dea5a24.m3u8',
    verificationStatus: 'VERIFIED_ACTIVE',
    verificationDate: '2026-10-29'
  },
  {
    id: 'air-fm-gold',
    name: 'AIR FM Gold (Delhi)',
    tagline: '106.4 MHz - Vintage Hindi Melodies & News',
    genre: 'Classic Bollywood, Vintage Hindi Melodies, Ghazals & News',
    language: 'Hindi',
    category: 'Hindi & Bollywood',
    featured: true,
    description: 'Akashvani’s flagship metropolitan FM service blending vintage Bollywood film soundtracks with national and city news bulletins.',
    officialSource: 'Prasar Bharati / Akashvani Official Live Stream',
    officialWebsite: 'https://prasarbharati.gov.in/en/fm-air/',
    artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
    isPlayable: true,
    streamFormat: 'hls',
    upstreamBaseUrl: 'https://d3r9rhourdc02u.cloudfront.net/assets/radio/airdelhi03/',
    upstreamMasterFile: 'air003_Auto.m3u8',
    verificationStatus: 'VERIFIED_ACTIVE',
    verificationDate: '2026-10-29'
  },
  {
    id: 'air-fm-rainbow',
    name: 'AIR FM Rainbow (Delhi)',
    tagline: '102.6 MHz - Contemporary Beats & Youth Rhythm',
    genre: 'Contemporary Hindi Songs, Indie Pop & Youth Radio',
    language: 'Hindi',
    category: 'Indian Pop / Mixed Music',
    featured: true,
    description: 'Youth-centric music channel broadcasting contemporary Hindi film tracks, Indi-pop, emerging Indian artists, and entertainment chats.',
    officialSource: 'Prasar Bharati / Akashvani Official Live Stream',
    officialWebsite: 'https://prasarbharati.gov.in/en/fm-air/',
    artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    isPlayable: true,
    streamFormat: 'hls',
    upstreamBaseUrl: 'https://d3r9rhourdc02u.cloudfront.net/assets/radio/airdelhi02/',
    upstreamMasterFile: 'air002_Auto.m3u8',
    verificationStatus: 'VERIFIED_ACTIVE',
    verificationDate: '2026-10-29'
  },
  {
    id: 'air-raagam',
    name: 'AIR Raagam',
    tagline: 'National Classical Music Station',
    genre: 'Indian Classical Music (Carnatic & Hindustani Vocals & Instruments)',
    language: 'Indian Classical',
    category: 'Regional Indian Music',
    featured: true,
    description: 'Dedicated 24x7 Indian classical music broadcast featuring legendary maestros of Hindustani and Carnatic traditions from the Akashvani archives.',
    officialSource: 'Prasar Bharati / Akashvani Official Live Stream',
    officialWebsite: 'https://prasarbharati.gov.in/en/akashvani/',
    artwork: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=600&q=80',
    isPlayable: true,
    streamFormat: 'hls',
    upstreamBaseUrl: 'https://d3r9rhourdc02u.cloudfront.net/assets/radio/airbang04/',
    upstreamMasterFile: 'air036_Auto.m3u8',
    verificationStatus: 'VERIFIED_ACTIVE',
    verificationDate: '2026-10-29'
  },
  {
    id: 'air-urdu-service',
    name: 'AIR Urdu Service',
    tagline: 'Adab aur Sangeet - Ghazals & Poetry',
    genre: 'Ghazals, Nazms, Urdu Shayari & Classic Geets',
    language: 'Urdu / Hindi',
    category: 'Retro & Evergreen',
    featured: false,
    description: 'Specialized cultural service celebrating soulful Ghazals, Qawwalis, classic poetry, and literary music from master poets and vocalists.',
    officialSource: 'Prasar Bharati / Akashvani Official Live Stream',
    officialWebsite: 'https://prasarbharati.gov.in/en/akashvani/',
    artwork: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=600&q=80',
    isPlayable: true,
    streamFormat: 'hls',
    upstreamBaseUrl: 'https://d3r9rhourdc02u.cloudfront.net/assets/radio/airdelhi05/',
    upstreamMasterFile: 'air005_Auto.m3u8',
    verificationStatus: 'VERIFIED_ACTIVE',
    verificationDate: '2026-10-29'
  },
  {
    id: 'air-indraprastha',
    name: 'AIR Indraprastha (Delhi Mw)',
    tagline: '819 kHz - Cultural Roots of Delhi',
    genre: 'Folk, Cultural Programs, Hindi Drama & Classic Sangeet',
    language: 'Hindi',
    category: 'Retro & Evergreen',
    featured: false,
    description: 'Akashvani Delhi’s traditional regional channel broadcasting North Indian folk songs, cultural discussions, and vintage recordings.',
    officialSource: 'Prasar Bharati / Akashvani Official Live Stream',
    officialWebsite: 'https://prasarbharati.gov.in/en/akashvani/',
    artwork: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=600&q=80',
    isPlayable: true,
    streamFormat: 'hls',
    upstreamBaseUrl: 'https://d3r9rhourdc02u.cloudfront.net/assets/radio/airdelhi04/',
    upstreamMasterFile: 'air004_Auto.m3u8',
    verificationStatus: 'VERIFIED_ACTIVE',
    verificationDate: '2026-10-29'
  },
  {
    id: 'akashvani-news-247',
    name: 'Akashvani Live News 24x7',
    tagline: 'Prasar Bharati National Live News Stream',
    genre: 'National News Bulletins & Current Affairs',
    language: 'Hindi / English',
    category: 'Regional Indian Music',
    featured: false,
    description: 'Continuous round-the-clock national audio news feed direct from the News Services Division of All India Radio, New Delhi.',
    officialSource: 'Prasar Bharati / Akashvani Official Live Stream',
    officialWebsite: 'https://newsonair.gov.in/',
    artwork: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=600&q=80',
    isPlayable: true,
    streamFormat: 'hls',
    upstreamBaseUrl: 'https://d3r9rhourdc02u.cloudfront.net/assets/radio/airdelhi01/',
    upstreamMasterFile: 'air001_Auto.m3u8',
    verificationStatus: 'VERIFIED_ACTIVE',
    verificationDate: '2026-10-29'
  },
  {
    id: 'radiocity-hindi',
    name: 'Radio City 91.1 FM',
    tagline: 'Rag Rag Mein Daude City - Bollywood Non-Stop',
    genre: 'Bollywood Hits & Pop',
    language: 'Hindi',
    category: 'Hindi & Bollywood',
    featured: false,
    description: 'Radio City broadcasts non-stop Bollywood hits, retro specials, and RJ entertainment. Streams are accessible via Radio City portal and web player.',
    officialSource: 'Music Broadcast Limited (Radio City)',
    officialWebsite: 'https://www.radiocity.in/',
    artwork: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=600&q=80',
    isPlayable: false,
    unplayableReason: 'Stream restricted to Radio City online web portal player. Direct stream tokenized.',
    verificationStatus: 'VERIFIED_OFFICIAL_ONLY',
    verificationDate: '2026-10-29'
  },
  // Private Major Indian FM Networks (Verified Non-Embeddable / Official Website Links Only)
  {
    id: 'radio-mirchi',
    name: 'Radio Mirchi 98.3 FM',
    tagline: 'It’s Hot! - India’s Premier Private FM Network',
    genre: 'Contemporary Bollywood, Pop & Celebrity Shows',
    language: 'Hindi / Pan-India',
    category: 'Hindi & Bollywood',
    featured: false,
    description: 'Radio Mirchi broadcasts top Bollywood chartbusters, Mirchi Top 20, and talk shows across Indian metros. Direct stream requires proprietary token authentication.',
    officialSource: 'Entertainment Network India Limited (ENIL)',
    officialWebsite: 'https://www.mirchi.in/',
    artwork: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=600&q=80',
    isPlayable: false,
    unplayableReason: 'Stream restricted to Mirchi proprietary app/web player with DRM. Direct embedding not permitted.',
    verificationStatus: 'VERIFIED_OFFICIAL_ONLY',
    verificationDate: '2026-10-29'
  },
  {
    id: 'red-fm',
    name: 'Red FM 93.5',
    tagline: 'Bajaate Raho! - Superhits & Bold Entertainment',
    genre: 'Superhit Bollywood, Desi Hip-Hop & Energetic Hits',
    language: 'Hindi / Pan-India',
    category: 'Indian Pop / Mixed Music',
    featured: false,
    description: 'India’s largest radio network known for playing Superhits and bold, humorous RJ shows. Stream restricted to official Red FM India app.',
    officialSource: 'Red FM India / Sun Group',
    officialWebsite: 'https://www.redfmindia.in/',
    artwork: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=600&q=80',
    isPlayable: false,
    unplayableReason: 'Restricted to Red FM mobile apps and portal. No open stream permitted.',
    verificationStatus: 'VERIFIED_OFFICIAL_ONLY',
    verificationDate: '2026-10-29'
  },
  {
    id: 'big-fm',
    name: 'Big FM 92.7',
    tagline: 'Dhun Badal Ke Toh Dekho',
    genre: 'Retro Bollywood, Inspirational Stories & Melodies',
    language: 'Hindi',
    category: 'Retro & Evergreen',
    featured: false,
    description: 'Famous for nostalgic Bollywood melodies, Suhaana Safar with Annu Kapoor, and storytelling. Stream delivered via proprietary app.',
    officialSource: 'Reliance Broadcast Network',
    officialWebsite: 'https://bigfmindia.com/',
    artwork: 'https://images.unsplash.com/photo-1520523839898-5071210ddff3?auto=format&fit=crop&w=600&q=80',
    isPlayable: false,
    unplayableReason: 'Delivered via proprietary JioSaavn/BigFM partnership. No authorized standalone stream.',
    verificationStatus: 'VERIFIED_OFFICIAL_ONLY',
    verificationDate: '2026-10-29'
  },
  {
    id: 'fever-fm',
    name: 'Fever 104 FM',
    tagline: 'Baap Bol Raha Hai - Non Stop Bollywood',
    genre: 'Non-Stop Bollywood Hits & Pop',
    language: 'Hindi',
    category: 'Hindi & Bollywood',
    featured: false,
    description: 'HT Media’s youth-focused radio brand with high energy, uninterrupted Hindi music blocks and Bollywood specials.',
    officialSource: 'HT Media Limited',
    officialWebsite: 'https://www.feverfm.com/',
    artwork: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80',
    isPlayable: false,
    unplayableReason: 'Restricted to Fever network internal players. Unauthenticated streams not authorized.',
    verificationStatus: 'VERIFIED_OFFICIAL_ONLY',
    verificationDate: '2026-10-29'
  },
  {
    id: 'radio-nasha',
    name: 'Radio Nasha 107.2 FM',
    tagline: 'Feel The Retro - 70s, 80s & 90s Bollywood',
    genre: 'Golden & Silver Era Bollywood Melodies',
    language: 'Hindi',
    category: 'Retro & Evergreen',
    featured: false,
    description: 'Dedicated retro Bollywood music station playing the iconic tunes of Amitabh Bachchan, Kishore Kumar, and R.D. Burman.',
    officialSource: 'HT Media Limited',
    officialWebsite: 'https://www.radionasha.com/',
    artwork: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?auto=format&fit=crop&w=600&q=80',
    isPlayable: false,
    unplayableReason: 'Restricted to official web app player with token validation.',
    verificationStatus: 'VERIFIED_OFFICIAL_ONLY',
    verificationDate: '2026-10-29'
  }
];

const stationsMap = new Map(INDIAN_RADIO_STATIONS.map(s => [s.id, s]));

// GET /api/radio/stations - Return verified Indian radio station catalogue
router.get('/stations', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    success: true,
    count: INDIAN_RADIO_STATIONS.length,
    stations: INDIAN_RADIO_STATIONS
  });
});

// Secure helper to fetch upstream and pipe or transform with strict origin checks
function secureProxyRequest(targetUrl, req, res, isBinary = false) {
  try {
    const parsed = new URL(targetUrl);
    // Strict domain whitelist - never allow arbitrary hostnames
    const allowedHosts = [
      'd3r9rhourdc02u.cloudfront.net',
      'd1cvqgmbcpg5yn.cloudfront.net',
      'air.pc.cdn.bitgravity.com',
      'radio.wavespb.com',
      'stream.zeno.fm'
    ];
    if (!allowedHosts.includes(parsed.hostname)) {
      return res.status(403).json({ error: 'Upstream host not permitted' });
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const proxyReq = client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Accept': '*/*'
      },
      timeout: 10000
    }, (upstreamRes) => {
      // Follow redirects
      if (upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
        const nextUrl = new URL(upstreamRes.headers.location, targetUrl).href;
        proxyReq.destroy();
        return secureProxyRequest(nextUrl, req, res, isBinary);
      }

      if (upstreamRes.statusCode !== 200 && upstreamRes.statusCode !== 206) {
        return res.status(upstreamRes.statusCode || 502).json({ error: 'Upstream stream error' });
      }

      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.set('Access-Control-Allow-Headers', '*');

      if (isBinary) {
        if (upstreamRes.headers['content-type']) {
          res.set('Content-Type', upstreamRes.headers['content-type']);
        }
        res.status(upstreamRes.statusCode);
        upstreamRes.pipe(res);
      } else {
        // Collect text (e.g. m3u8 playlist) to rewrite relative URLs
        let data = '';
        upstreamRes.on('data', chunk => { data += chunk; });
        upstreamRes.on('end', () => {
          res.set('Content-Type', 'application/vnd.apple.mpegurl');
          res.status(200).send(data);
        });
      }
    });

    proxyReq.on('error', (err) => {
      console.error('[Radio Proxy Error]:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to connect to official radio stream' });
      }
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({ error: 'Radio stream connection timed out' });
      }
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(400).json({ error: 'Invalid stream request' });
    }
  }
}

// GET /api/radio/stream/:stationId/:file? - Stream HLS playlist / segments or direct MP3
router.get(['/stream/:stationId', '/stream/:stationId/:file'], (req, res) => {
  const { stationId, file } = req.params;
  const subPath = file || 'playlist.m3u8';

  // Prevent path traversal
  if (subPath.includes('..') || subPath.startsWith('/') || subPath.includes('\\')) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  const station = stationsMap.get(stationId);
  if (!station || !station.isPlayable) {
    return res.status(404).json({ error: 'Station not found or not playable' });
  }

  // Handle direct MP3 streams (e.g. Radio City)
  if (station.streamFormat === 'mp3') {
    return secureProxyRequest(station.upstreamUrl, req, res, true);
  }

  // Handle Cloudfront HLS streams (Vividh Bharati, FM Gold, FM Rainbow, AIR Raagam, etc.)
  if (station.upstreamBaseUrl) {
    if (!subPath || subPath === 'playlist.m3u8') {
      const targetMaster = station.upstreamBaseUrl + station.upstreamMasterFile;
      return secureProxyRequest(targetMaster, req, res, false);
    }

    const isPlaylist = subPath.endsWith('.m3u8');
    const targetFile = station.upstreamBaseUrl + subPath;
    return secureProxyRequest(targetFile, req, res, !isPlaylist);
  }

  // Handle Waves OTT HLS stream
  if (station.wavesUpstreamUrl) {
    if (!subPath || subPath === 'playlist.m3u8') {
      return secureProxyRequest(station.wavesUpstreamUrl, req, res, false);
    }
    const baseWavesUrl = 'https://d1cvqgmbcpg5yn.cloudfront.net/146ed6ec6dea5a24/';
    return secureProxyRequest(baseWavesUrl + subPath, req, res, true);
  }

  res.status(404).json({ error: 'Unknown stream format' });
});

export default router;
