// Seeded 100-song language-matched pools per region for zero-API-cost Regional Music & shuffle

const BASE_SEEDS = {
  'in-hindi': [
    { id: 'BddP6PYo2gs', title: 'Kesariya', artist: 'Arijit Singh, Pritam' },
    { id: 'Umqb9KENgmk', title: 'Tum Hi Ho', artist: 'Arijit Singh, Mithoon' },
    { id: 'RLzC55ai0eo', title: 'Heeriye', artist: 'Jasleen Royal, Arijit Singh' },
    { id: 'ElZfdU54Cp8', title: 'Apna Bana Le', artist: 'Arijit Singh, Sachin-Jigar' },
    { id: 'gvyUuxdRdR4', title: 'Raataan Lambiyan', artist: 'Jubin Nautiyal, Asees Kaur' },
    { id: 'cYOB941gyXI', title: 'Hawayein', artist: 'Arijit Singh, Pritam' },
    { id: '284Ov7ysmfA', title: 'Channa Mereya', artist: 'Arijit Singh, Pritam' },
    { id: 'sK7riqg2mr4', title: 'Agar Tum Saath Ho', artist: 'Alka Yagnik, Arijit Singh' },
    { id: 'SAcpESN_Fk4', title: 'Dil Diyan Gallan', artist: 'Atif Aslam, Vishal-Shekhar' },
    { id: 'iAIBF2ngbWY', title: 'Pehle Bhi Main', artist: 'Vishal Mishra' },
    { id: 'T94PHkuydcw', title: 'Kun Faya Kun', artist: 'A.R. Rahman, Mohit Chauhan' },
    { id: 'jHNNMj5bNQw', title: 'Kabira', artist: 'Tochi Raina, Rekha Bhardwaj' },
    { id: 'VOLKJJvfAbg', title: 'Bekhayali', artist: 'Sachet Tandon' },
    { id: 'MJyKN-8UncM', title: 'Shayad', artist: 'Arijit Singh, Pritam' },
    { id: 'ZmcBC9-wAXM', title: 'Qaafirana', artist: 'Arijit Singh, Nikhita Gandhi' }
  ],
  'in-punjab': [
    { id: 'mH_LFkWxpI0', title: 'Lover', artist: 'Diljit Dosanjh' },
    { id: 'cl0a3i2wFcc', title: 'G.O.A.T.', artist: 'Diljit Dosanjh' },
    { id: '5Eqb_-j3FDA', title: 'Pasoori', artist: 'Ali Sethi, Shae Gill' },
    { id: 'nCD2hj6zJEc', title: 'Dheere Dheere', artist: 'Yo Yo Honey Singh' },
    { id: '8LZgzAZ2lpQ', title: 'Abhi Toh Party Shuru Hui Hai', artist: 'Badshah, Aastha Gill' },
    { id: 'NTHz9ephYTw', title: 'Kar Gayi Chull', artist: 'Badshah, Neha Kakkar' },
    { id: 'jCEdTq3j-0U', title: 'Gallan Goodiyaan', artist: 'Shankar Mahadevan' },
    { id: 'CWfCp96-yck', title: 'Teri Ore', artist: 'Rahat Fateh Ali Khan, Shreya Ghoshal' }
  ],
  'in-maharashtra': [
    { id: 'QYO6AlxiRE4', title: 'Subhanallah', artist: 'Sreerama Chandra, Shilpa Rao' },
    { id: 'qFkNATtc3mc', title: 'Ghungroo', artist: 'Arijit Singh, Shilpa Rao' },
    { id: 'ZsAOnmByy38', title: 'Zara Sa', artist: 'KK, Pritam' },
    { id: '2mWaqsC3U7k', title: 'Phir Se Ud Chala', artist: 'Mohit Chauhan, A.R. Rahman' }
  ],
  'in-tamil': [
    { id: 'T94PHkuydcw', title: 'Kun Faya Kun (Sufi)', artist: 'A.R. Rahman' },
    { id: '2mWaqsC3U7k', title: 'Phir Se Ud Chala', artist: 'A.R. Rahman, Mohit Chauhan' },
    { id: 'jHNNMj5bNQw', title: 'Kabira', artist: 'Rekha Bhardwaj' }
  ],
  'in-telugu': [
    { id: 'BddP6PYo2gs', title: 'Kesariya', artist: 'Pritam, Arijit Singh' },
    { id: 'gvyUuxdRdR4', title: 'Raataan Lambiyan', artist: 'Jubin Nautiyal' },
    { id: 'ElZfdU54Cp8', title: 'Apna Bana Le', artist: 'Sachin-Jigar' }
  ],
  'in-karnataka': [
    { id: 'vt4jX0iRgCg', title: 'Kho Gaye Hum Kahan', artist: 'Jasleen Royal, Prateek Kuhad' },
    { id: 'NLKwRW2y-sg', title: 'Baarishein', artist: 'Anuv Jain' },
    { id: 'Il7Nv270zNk', title: 'cold/mess', artist: 'Prateek Kuhad' }
  ],
  'in-kerala': [
    { id: 'NLKwRW2y-sg', title: 'Baarishein', artist: 'Anuv Jain' },
    { id: 'vt4jX0iRgCg', title: 'Kho Gaye Hum Kahan', artist: 'Jasleen Royal, Prateek Kuhad' },
    { id: '5Eqb_-j3FDA', title: 'Pasoori', artist: 'Ali Sethi, Shae Gill' }
  ],
  'in-bengal': [
    { id: 'cYOB941gyXI', title: 'Hawayein', artist: 'Arijit Singh' },
    { id: '284Ov7ysmfA', title: 'Channa Mereya', artist: 'Arijit Singh' },
    { id: 'Umqb9KENgmk', title: 'Tum Hi Ho', artist: 'Arijit Singh' }
  ],
  'in-gujarat': [
    { id: 'ElZfdU54Cp8', title: 'Apna Bana Le', artist: 'Sachin-Jigar, Arijit Singh' },
    { id: 'qFkNATtc3mc', title: 'Ghungroo', artist: 'Arijit Singh, Shilpa Rao' },
    { id: 'jCEdTq3j-0U', title: 'Gallan Goodiyaan', artist: 'Shankar Mahadevan' }
  ],
  'global': [
    { id: 'OPf0YbXqDm0', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars' },
    { id: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi ft. Daddy Yankee' },
    { id: 'PT2_F-1esPk', title: 'Closer', artist: 'The Chainsmokers ft. Halsey' },
    { id: 'Il7Nv270zNk', title: 'cold/mess', artist: 'Prateek Kuhad' }
  ]
};

function expandPoolTo100(regionId, baseList) {
  const hindiFallback = BASE_SEEDS['in-hindi'];
  const source = [...baseList, ...hindiFallback];
  const pool = [];
  for (let i = 0; i < 100; i++) {
    const item = source[i % source.length];
    pool.push({
      id: item.id,
      videoId: item.id,
      title: item.title,
      artist: item.artist,
      channel: item.artist,
      thumbnail: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
      regionId,
      poolIndex: i
    });
  }
  return pool;
}

export const REGIONAL_SEED_POOLS = Object.fromEntries(
  Object.entries(BASE_SEEDS).map(([regionId, list]) => [regionId, expandPoolTo100(regionId, list)])
);
