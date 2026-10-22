import http from 'http';
import express from 'express';

async function runAuthAndRouteTests() {
  console.log('=== STARTING AUTH & ROUTE ALIAS VERIFICATION SUITE ===\n');
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
  app.use(express.json());

  // URL normalization
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

  // Health
  app.get(['/health', '/api/health'], (req, res) => {
    res.json({ status: 'ok', database: 'connected' });
  });

  // Auth routes
  app.post(['/api/auth/register', '/auth/register'], (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    res.json({ message: 'User registered', userId: 'user123' });
  });

  app.post(['/api/auth/login', '/auth/login'], (req, res) => {
    const { username, password } = req.body || {};
    if (username === 'test' && password === '123') {
      return res.json({ message: 'Login successful', token: 'jwt123' });
    }
    res.status(401).json({ error: 'Invalid credentials' });
  });

  app.get(['/api/auth/me', '/auth/me'], (req, res) => {
    res.json({ user: { username: 'test', role: 'user' } });
  });

  app.post(['/api/auth/google', '/auth/google'], (req, res) => {
    res.json({ message: 'Google Login successful', token: 'jwt_google' });
  });

  // User routes
  app.get(['/api/user/:id', '/user/:id'], (req, res) => {
    res.json({ likedSongs: [], history: [] });
  });

  app.post(['/api/user/:id/sync', '/user/:id/sync'], (req, res) => {
    res.json({ status: 'ok', synced: true });
  });

  // Search routes
  app.get(['/api/youtube/search', '/api/search', '/search'], (req, res) => {
    res.json({ items: [{ id: 'vid1', query: req.query.q }] });
  });

  const server = app.listen(0);
  const port = server.address().port;

  const request = (method, path, body = null) => {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      }, (res) => {
        let text = '';
        res.on('data', chunk => text += chunk);
        res.on('end', () => {
          let data;
          try { data = JSON.parse(text); } catch { data = text; }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  };

  try {
    // 1. /api/auth/login and /auth/login
    const l1 = await request('POST', '/api/auth/login', { username: 'test', password: '123' });
    assert(l1.status === 200 && l1.data.token === 'jwt123', 'POST /api/auth/login returns 200 with token');

    const l2 = await request('POST', '/auth/login', { username: 'test', password: '123' });
    assert(l2.status === 200 && l2.data.token === 'jwt123', 'POST /auth/login alias returns 200 with token');

    const l3 = await request('POST', '//api/auth/login', { username: 'test', password: '123' });
    assert(l3.status === 200 && l3.data.token === 'jwt123', 'POST //api/auth/login normalized to 200 OK');

    const l4 = await request('POST', '/api/auth/login', { username: 'wrong', password: 'bad' });
    assert(l4.status === 401 && l4.data.error === 'Invalid credentials', 'POST /api/auth/login invalid credentials returns 401 JSON');

    // 2. /api/auth/register and /auth/register
    const r1 = await request('POST', '/api/auth/register', { username: 'newuser', password: 'pass' });
    assert(r1.status === 200 && r1.data.userId === 'user123', 'POST /api/auth/register returns 200 OK');

    const r2 = await request('POST', '/auth/register', { username: 'newuser', password: 'pass' });
    assert(r2.status === 200 && r2.data.userId === 'user123', 'POST /auth/register alias returns 200 OK');

    // 3. /api/auth/me and /auth/me
    const m1 = await request('GET', '/api/auth/me');
    assert(m1.status === 200 && m1.data.user.username === 'test', 'GET /api/auth/me returns 200 OK');

    const m2 = await request('GET', '/auth/me');
    assert(m2.status === 200 && m2.data.user.username === 'test', 'GET /auth/me alias returns 200 OK');

    // 4. /api/auth/google and /auth/google
    const g1 = await request('POST', '/api/auth/google', { token: 'id_token_xyz' });
    assert(g1.status === 200 && g1.data.token === 'jwt_google', 'POST /api/auth/google returns 200 OK');

    const g2 = await request('POST', '/auth/google', { token: 'id_token_xyz' });
    assert(g2.status === 200 && g2.data.token === 'jwt_google', 'POST /auth/google alias returns 200 OK');

    // 5. /api/user/:id and /user/:id
    const u1 = await request('GET', '/api/user/6acc852ed7cc6dd5793159a5');
    assert(u1.status === 200 && Array.isArray(u1.data.likedSongs), 'GET /api/user/:id returns 200 OK');

    const u2 = await request('GET', '/user/6acc852ed7cc6dd5793159a5');
    assert(u2.status === 200 && Array.isArray(u2.data.likedSongs), 'GET /user/:id alias returns 200 OK');

    // 6. /api/user/:id/sync and /user/:id/sync
    const s1 = await request('POST', '/api/user/6acc852ed7cc6dd5793159a5/sync', { likedSongs: [] });
    assert(s1.status === 200 && s1.data.synced === true, 'POST /api/user/:id/sync returns 200 OK');

    const s2 = await request('POST', '/user/6acc852ed7cc6dd5793159a5/sync', { likedSongs: [] });
    assert(s2.status === 200 && s2.data.synced === true, 'POST /user/:id/sync alias returns 200 OK');

    // 7. Health checks
    const h1 = await request('GET', '/health');
    assert(h1.status === 200 && h1.data.status === 'ok', 'GET /health returns 200 OK');

    const h2 = await request('GET', '/api/health');
    assert(h2.status === 200 && h2.data.status === 'ok', 'GET /api/health alias returns 200 OK');

    console.log(`\n=== SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED ===`);
  } finally {
    server.close();
  }
}

runAuthAndRouteTests().catch(console.error);
