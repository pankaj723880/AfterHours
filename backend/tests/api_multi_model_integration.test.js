/**
 * End-to-End API Integration Test for Loopra Multi-Model AI Endpoints
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import voiceAgentRoutes from '../routes/voiceAgent.js';
import chatRoutes from '../routes/chat.js';
import aiMusicRoutes from '../routes/aiMusic.js';

describe('Multi-Model AI API Integration Suite', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/voice-agent', voiceAgentRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/ai-music', aiMusicRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET /api/voice-agent/models returns registered models and capabilities', async () => {
    const res = await fetch(`${baseUrl}/api/voice-agent/models`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.models));
    assert.ok(data.discoveredCount >= 5);

    const modelIds = data.models.map(m => m.id);
    assert.ok(modelIds.includes('gemini-3.1-flash-lite'));
    assert.ok(modelIds.includes('gemini-3.8-flash'));
    assert.ok(modelIds.includes('gemini-3.5-transcribe'));
    assert.ok(modelIds.includes('gemini-4-argon'));
  });

  it('GET /api/voice-agent/quota-status returns UNVERIFIED quota tiers and local RPM tracking', async () => {
    const res = await fetch(`${baseUrl}/api/voice-agent/quota-status`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.models);
    assert.equal(data.models['gemini-3.1-flash-lite'].quotaLimits.rpdTier, 'UNVERIFIED');
    assert.equal(data.models['gemini-3.8-flash'].quotaLimits.isUnlimitedRpd, false);
    assert.ok(data.routingCascades);
    assert.ok(data.routingCascades.CASUAL_CHAT);
  });

  it('POST /api/voice-agent/translate handles translation request with caching and short-circuit', async () => {
    const res = await fetch(`${baseUrl}/api/voice-agent/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'गाना चलाओ दोस्त',
        targetLang: 'hi'
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.text, 'गाना चलाओ दोस्त');
    assert.equal(data.translated, false); // Short-circuited because already Hindi
  });

  it('POST /api/chat handles casual text and maps to chatBuddy response', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello Loopra, how are you today?',
        history: []
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.type === 'chat' || data.type === 'command');
    assert.ok(typeof data.reply === 'string');
  });

  it('POST /api/chat preserves 0ms local media controls for explicit commands', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'pause',
        history: []
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.type, 'command');
    assert.equal(data.action, 'pause');
  });

  it('GET /api/ai-music/context returns orchestrator cascades and diagnostics', async () => {
    const res = await fetch(`${baseUrl}/api/ai-music/context`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.geminiConfigured === 'boolean');
    assert.ok(data.routingCascades);
    assert.ok(data.quotaStatus);
    assert.ok(data.diagnostics);
  });
});

