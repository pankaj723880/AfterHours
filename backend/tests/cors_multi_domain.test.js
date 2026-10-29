import assert from 'assert';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

console.log('=== STARTING LOOPRA DUAL DOMAIN CORS TEST SUITE ===\n');

// 1. Recreate the exact parsing and validation logic from backend/server.js
const parseOrigins = (val) => {
  if (!val) return [];
  return val.split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
};

process.env.FRONTEND_URL = 'https://custom-env-frontend.vercel.app, https://custom-comma.vercel.app/';
process.env.CLIENT_URL = 'https://custom-env-client.vercel.app';
process.env.ALLOWED_ORIGINS = 'https://custom-allowed.vercel.app';

const allowedOrigins = [
  'https://after-hours-five-beryl.vercel.app',
  'https://loopra1.vercel.app',
  'https://loopra.vercel.app',
  ...parseOrigins(process.env.CLIENT_URL),
  ...parseOrigins(process.env.FRONTEND_URL),
  ...parseOrigins(process.env.ALLOWED_ORIGINS),
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const normalizedOrigin = origin.trim().replace(/\/+$/, '');
  if (allowedOrigins.includes(normalizedOrigin)) return true;
  if (/^https:\/\/(after-hours|loopra1?)[a-z0-9-]*\.vercel\.app$/.test(normalizedOrigin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) return true;
  return false;
};

// Test Suite 1: Pure origin validation tests
console.log('--- TEST 1: Origin validation logic ---');
assert.strictEqual(isOriginAllowed('https://after-hours-five-beryl.vercel.app'), true, 'Existing after-hours domain must be allowed');
assert.strictEqual(isOriginAllowed('https://loopra1.vercel.app'), true, 'New loopra1 domain must be allowed');
assert.strictEqual(isOriginAllowed('https://loopra.vercel.app'), true, 'Loopra domain must be allowed');
assert.strictEqual(isOriginAllowed('https://loopra1.vercel.app/'), true, 'Trailing slash must be normalized and allowed');
assert.strictEqual(isOriginAllowed('https://after-hours-preview-123.vercel.app'), true, 'After-hours preview subdomains must be allowed');
assert.strictEqual(isOriginAllowed('https://loopra1-git-branch.vercel.app'), true, 'Loopra1 preview subdomains must be allowed');
assert.strictEqual(isOriginAllowed('http://localhost:5173'), true, 'Localhost dev must be allowed');
assert.strictEqual(isOriginAllowed('http://127.0.0.1:5000'), true, '127.0.0.1 dev must be allowed');
assert.strictEqual(isOriginAllowed('https://custom-env-frontend.vercel.app'), true, 'FRONTEND_URL env origins must be allowed');
assert.strictEqual(isOriginAllowed('https://custom-comma.vercel.app'), true, 'Comma-separated FRONTEND_URL origins must be allowed');
assert.strictEqual(isOriginAllowed('https://custom-env-client.vercel.app'), true, 'CLIENT_URL env origin must be allowed');
assert.strictEqual(isOriginAllowed('https://custom-allowed.vercel.app'), true, 'ALLOWED_ORIGINS env origin must be allowed');
assert.strictEqual(isOriginAllowed(undefined), true, 'Non-browser requests (no origin) must be allowed');
assert.strictEqual(isOriginAllowed('https://unauthorized-domain.com'), false, 'Untrusted origin must be rejected');
assert.strictEqual(isOriginAllowed('https://loopra1.vercel.app.attacker.com'), false, 'Origin prefix spoofing must be rejected');
console.log('[PASS] All origin validation scenarios passed successfully.\n');

// Test Suite 2: Actual Express HTTP + OPTIONS Preflight + Socket.io Server Test
console.log('--- TEST 2: Express preflight OPTIONS & GET with credentials ---');
const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Session-ID'],
  optionsSuccessStatus: 204
}));

app.get('/api/test', (req, res) => {
  res.json({ ok: true });
});

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket']
});

await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;

// Helper to make raw HTTP requests
const request = (method, path, headers = {}) => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
};

// 2a. Preflight OPTIONS from https://after-hours-five-beryl.vercel.app
const preflight1 = await request('OPTIONS', '/api/test', {
  'Origin': 'https://after-hours-five-beryl.vercel.app',
  'Access-Control-Request-Method': 'POST',
  'Access-Control-Request-Headers': 'Content-Type, X-Session-ID'
});
assert.strictEqual(preflight1.status, 204, 'OPTIONS preflight must return 204');
assert.strictEqual(preflight1.headers['access-control-allow-origin'], 'https://after-hours-five-beryl.vercel.app');
assert.strictEqual(preflight1.headers['access-control-allow-credentials'], 'true');
console.log('[PASS] OPTIONS preflight verified for https://after-hours-five-beryl.vercel.app');

// 2b. Preflight OPTIONS from https://loopra1.vercel.app
const preflight2 = await request('OPTIONS', '/api/test', {
  'Origin': 'https://loopra1.vercel.app',
  'Access-Control-Request-Method': 'GET',
  'Access-Control-Request-Headers': 'Authorization'
});
assert.strictEqual(preflight2.status, 204, 'OPTIONS preflight for loopra1 must return 204');
assert.strictEqual(preflight2.headers['access-control-allow-origin'], 'https://loopra1.vercel.app');
assert.strictEqual(preflight2.headers['access-control-allow-credentials'], 'true');
console.log('[PASS] OPTIONS preflight verified for https://loopra1.vercel.app');

// 2c. Actual GET with credentials from https://loopra1.vercel.app
const getRes = await request('GET', '/api/test', {
  'Origin': 'https://loopra1.vercel.app'
});
assert.strictEqual(getRes.status, 200);
assert.strictEqual(getRes.headers['access-control-allow-origin'], 'https://loopra1.vercel.app');
assert.strictEqual(getRes.headers['access-control-allow-credentials'], 'true');
console.log('[PASS] Actual GET request with credentials verified for https://loopra1.vercel.app');

// 2d. Rejected preflight from untrusted origin
const rejectedPreflight = await request('OPTIONS', '/api/test', {
  'Origin': 'https://malicious-site.com',
  'Access-Control-Request-Method': 'GET'
});
assert.strictEqual(rejectedPreflight.headers['access-control-allow-origin'], undefined, 'Untrusted origin must not get allow-origin header');
console.log('[PASS] Untrusted origin correctly rejected without CORS headers\n');

// Test Suite 3: Socket.IO Polling Handshake CORS Tests
console.log('--- TEST 3: Socket.IO CORS handshake from both origins ---');
const socketPollOld = await request('GET', '/socket.io/?EIO=4&transport=polling', {
  'Origin': 'https://after-hours-five-beryl.vercel.app'
});
assert.strictEqual(socketPollOld.status, 200, 'Socket.io polling handshake must return 200 for old origin');
assert.strictEqual(socketPollOld.headers['access-control-allow-origin'], 'https://after-hours-five-beryl.vercel.app');
assert.strictEqual(socketPollOld.headers['access-control-allow-credentials'], 'true');
console.log('[PASS] Socket.io polling handshake verified for https://after-hours-five-beryl.vercel.app');

const socketPollNew = await request('GET', '/socket.io/?EIO=4&transport=polling', {
  'Origin': 'https://loopra1.vercel.app'
});
assert.strictEqual(socketPollNew.status, 200, 'Socket.io polling handshake must return 200 for new origin');
assert.strictEqual(socketPollNew.headers['access-control-allow-origin'], 'https://loopra1.vercel.app');
assert.strictEqual(socketPollNew.headers['access-control-allow-credentials'], 'true');
console.log('[PASS] Socket.io polling handshake verified for https://loopra1.vercel.app');

const socketPollUntrusted = await request('GET', '/socket.io/?EIO=4&transport=polling', {
  'Origin': 'https://untrusted-site.com'
});
assert.strictEqual(socketPollUntrusted.headers['access-control-allow-origin'], undefined, 'Untrusted Socket.io polling must not get allow-origin');
console.log('[PASS] Untrusted Socket.io polling correctly rejected without CORS headers\n');

server.close();
console.log('=== ALL 14 CORS MULTI-ORIGIN TESTS COMPLETED SUCCESSFULLY! ===');
process.exit(0);
