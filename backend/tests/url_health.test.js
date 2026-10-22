import http from 'http';
import express from 'express';

// Test URL normalization middleware and health endpoint in isolation
async function runUrlHealthTests() {
  console.log('=== STARTING URL NORMALIZATION & HEALTH SUITE ===\n');
  let passed = 0;
  let failed = 0;

  const assert = (cond, msg) => {
    if (cond) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  };

  const app = express();

  // Same middleware as server.js
  app.use((req, res, next) => {
    const normalize = (urlStr) => {
      if (!urlStr) return urlStr;
      const queryIndex = urlStr.indexOf('?');
      const path = queryIndex !== -1 ? urlStr.slice(0, queryIndex) : urlStr;
      const search = queryIndex !== -1 ? urlStr.slice(queryIndex) : '';
      return path.replace(/\/+/g, '/') + search;
    };
    if (req.url && req.url.includes('//')) req.url = normalize(req.url);
    if (req.originalUrl && req.originalUrl.includes('//')) req.originalUrl = normalize(req.originalUrl);
    next();
  });

  app.get(['/health', '/api/health'], (req, res) => {
    res.json({
      status: 'ok',
      database: 'connected',
      path: req.path,
      url: req.url,
      orig: req.originalUrl
    });
  });

  app.get(['/api/youtube/search', '/api/search', '/search'], (req, res) => {
    res.json({
      items: [{ id: 'test12345', query: req.query.q }]
    });
  });

  const server = app.listen(0);
  const port = server.address().port;

  const makeReq = (path) => {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          let data;
          try { data = JSON.parse(body); } catch (e) { data = body; }
          resolve({ status: res.statusCode, data });
        });
      }).on('error', reject);
    });
  };

  try {
    // 1. Standard /health
    const r1 = await makeReq('/health');
    assert(r1.status === 200, 'Standard /health responds with 200 OK');
    assert(r1.data.status === 'ok', '/health status is ok');

    // 2. Double slash //health
    const r2 = await makeReq('//health');
    assert(r2.status === 200, 'Double slash //health normalized to /health (200 OK)');
    assert(r2.data.path === '/health', 'Express req.path resolved to /health');

    // 3. Multi slash ////health
    const r3 = await makeReq('////health');
    assert(r3.status === 200, 'Multiple slashes ////health normalized (200 OK)');

    // 4. /api/health alias
    const r4 = await makeReq('/api/health');
    assert(r4.status === 200, '/api/health responds with 200 OK');

    // 5. Double slash //api/youtube/search?q=test
    const r5 = await makeReq('//api/youtube/search?q=latest+hindi+songs');
    assert(r5.status === 200, 'Double slash search route normalized (200 OK)');
    assert(r5.data.items?.[0]?.query === 'latest hindi songs', 'Query parameters preserved accurately');

    // 6. Direct /search?q=test alias
    const r6 = await makeReq('/search?q=arijit');
    assert(r6.status === 200, 'Direct /search?q= responds with 200 OK');
    assert(r6.data.items?.[0]?.query === 'arijit', '/search query parameter extracted');

    // 7. Double slash //search?q=test alias
    const r7 = await makeReq('//search?q=arijit');
    assert(r7.status === 200, 'Double slash //search?q= normalized to 200 OK');

    // 8. /api/search?q=test alias
    const r8 = await makeReq('/api/search?q=trending');
    assert(r8.status === 200, '/api/search?q= responds with 200 OK');

    // 9. Query string with slashes preserved
    const r9 = await makeReq('//api/youtube/search?q=ac/dc//live');
    assert(r9.status === 200, 'Query string containing slashes preserved (200 OK)');
    assert(r9.data.items?.[0]?.query === 'ac/dc//live', 'Slashes inside query params not modified');

    console.log(`\n=== URL HEALTH TESTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  } finally {
    server.close();
  }

  if (failed > 0) process.exit(1);
}

runUrlHealthTests();
