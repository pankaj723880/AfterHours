import { spawn } from 'child_process';
import http from 'http';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Checking Chrome on port 9222...');
  let version = null;
  try {
    version = await getJson('http://127.0.0.1:9222/json/version');
  } catch (e) {}

  if (!version) {
    console.log('Spawning Chrome on port 9222...');
    spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox',
      'http://localhost:5173/radio'
    ]);
    for (let i = 0; i < 15; i++) {
      await sleep(500);
      try {
        version = await getJson('http://127.0.0.1:9222/json/version');
        if (version) break;
      } catch (e) {}
    }
  }

  console.log('Chrome CDP ready! Browser:', version?.Browser);
  const targets = await getJson('http://127.0.0.1:9222/json');
  const pageTarget = targets.find(t => t.type === 'page');
  
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.addEventListener('open', async () => {
    console.log('CDP connected to tab! Waiting 3s for page load...');
    await send('Runtime.enable');
    await send('Console.enable');
    await sleep(3000);

    // Test playing HLS in the browser context with Hls.js
    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          // Check if Hls is available on window or in modules
          const logs = [];
          const log = (msg) => { console.log('[TEST]', msg); logs.push(msg); };

          log('Creating audio element...');
          const audio = document.createElement('audio');
          audio.controls = true;
          document.body.appendChild(audio);

          const streamUrl = 'http://localhost:5000/api/radio/stream/air-fm-gold/playlist.m3u8';
          log('Stream URL: ' + streamUrl);

          // Test fetch of playlist
          try {
            const f = await fetch(streamUrl);
            const text = await f.text();
            log('Fetch playlist status: ' + f.status + ', length: ' + text.length);
          } catch (e) {
            log('Fetch playlist failed: ' + e.message);
          }

          // Test with Hls.js from npm/vite
          // Since Vite has Hls loaded in App.jsx or node_modules
          let HlsClass = window.Hls;
          if (!HlsClass) {
            try {
              const mod = await import('/node_modules/.vite/deps/hls__js.js?v=test');
              HlsClass = mod.default || mod;
              log('Loaded Hls from Vite deps!');
            } catch (e) {
              log('Could not import Hls directly: ' + e.message);
            }
          }

          if (HlsClass && HlsClass.isSupported()) {
            log('Hls is supported! Creating Hls instance...');
            const hls = new HlsClass({
              enableWorker: false, // simpler for debugging
              debug: true
            });
            window.__testHls = hls;
            window.__testAudio = audio;

            hls.on(HlsClass.Events.ERROR, (evt, data) => {
              log('HLS ERROR: ' + data.type + ' / ' + data.details + ' (fatal: ' + data.fatal + ')');
            });

            hls.on(HlsClass.Events.MANIFEST_PARSED, (evt, data) => {
              log('HLS MANIFEST PARSED! Levels: ' + data.levels.length);
              audio.play().then(() => {
                log('audio.play() resolved successfully!');
              }).catch(err => {
                log('audio.play() rejected: ' + err.message);
              });
            });

            hls.on(HlsClass.Events.FRAG_LOADED, (evt, data) => {
              log('FRAG LOADED: ' + data.frag.relurl + ' (' + data.payload.byteLength + ' bytes)');
            });

            hls.loadSource(streamUrl);
            hls.attachMedia(audio);
          } else {
            log('Native audio test (Safari style)');
            audio.src = streamUrl;
            audio.play().catch(e => log('Native play error: ' + e.message));
          }

          return logs;
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Test evaluation logs:', evalRes.result?.result?.value);

    console.log('Observing playback for 6 seconds...');
    for (let i = 1; i <= 6; i++) {
      await sleep(1000);
      const state = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const a = window.__testAudio;
            if (!a) return null;
            return {
              currentTime: a.currentTime,
              paused: a.paused,
              readyState: a.readyState,
              networkState: a.networkState,
              volume: a.volume,
              muted: a.muted,
              buffered: a.buffered.length > 0 ? a.buffered.end(0) : 0,
              error: a.error ? a.error.message : null
            };
          })()
        `,
        returnByValue: true
      });
      console.log(`[Second ${i}] Audio State:`, JSON.stringify(state.result?.result?.value));
    }

    ws.close();
    process.exit(0);
  });

  ws.addEventListener('message', (evt) => {
    try {
      const msg = JSON.parse(evt.data.toString());
      if (msg.id && pending.has(msg.id)) {
        const resolve = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        console.log(`[CONSOLE]:`, text);
      }
    } catch (e) {}
  });
}

run();
