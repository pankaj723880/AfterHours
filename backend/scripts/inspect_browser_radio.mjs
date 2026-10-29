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
  console.log('Launching Headless Chrome with DevTools on port 9222...');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--autoplay-policy=no-user-gesture-required',
    '--no-sandbox',
    '--disable-gpu',
    'http://localhost:5173/radio'
  ]);

  chromeProc.on('error', (err) => {
    console.error('Failed to spawn Chrome:', err);
  });

  // Wait for Chrome CDP to be ready
  let version = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      version = await getJson('http://127.0.0.1:9222/json/version');
      if (version) break;
    } catch (e) {}
  }

  if (!version) {
    console.error('Chrome DevTools port 9222 did not respond in time.');
    chromeProc.kill();
    return;
  }

  console.log('Chrome CDP ready! Browser:', version.Browser);

  const targets = await getJson('http://127.0.0.1:9222/json');
  console.log('Open targets count:', targets.length);
  const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('localhost:5173'));
  if (!pageTarget) {
    console.error('Could not find Loopra page target:', targets);
    chromeProc.kill();
    return;
  }

  console.log('Connecting to Page WebSocket:', pageTarget.webSocketDebuggerUrl);
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
    console.log('CDP Connected! Enabling Console, Runtime, and Network...');
    await send('Runtime.enable');
    await send('Console.enable');
    await send('Network.enable');

    console.log('Waiting 3 seconds for initial page render...');
    await sleep(3000);

    // Let's click on the first station's Play button
    console.log('\n--- EVALUATING PLAY CLICK ON FIRST STATION ---');
    const clickRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btnTexts = btns.map(b => b.innerText.trim()).filter(Boolean);
          const playBtn = btns.find(b => b.innerText.includes('Play Station') || b.title === 'Play Station');
          if (playBtn) {
            playBtn.click();
            return { found: true, text: playBtn.innerText };
          }
          return { found: false, totalButtons: btns.length, btnTexts };
        })()
      `,
      returnByValue: true
    });
    console.log('Play button click result:', JSON.stringify(clickRes.result?.result?.value || clickRes, null, 2));

    console.log('\nWaiting 4 seconds to observe audio playback and network requests...');
    await sleep(4000);

    // Inspect all <audio> elements on the page
    console.log('\n--- INSPECTING AUDIO ELEMENTS IN DOM ---');
    const audioState = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const audios = Array.from(document.querySelectorAll('audio'));
          return audios.map((a, i) => ({
            index: i,
            src: a.src,
            currentSrc: a.currentSrc,
            paused: a.paused,
            readyState: a.readyState,
            networkState: a.networkState,
            error: a.error ? { code: a.error.code, message: a.error.message } : null,
            volume: a.volume,
            muted: a.muted,
            currentTime: a.currentTime,
            duration: a.duration
          }));
        })()
      `,
      returnByValue: true
    });
    console.log('Audio elements state:', JSON.stringify(audioState.result?.result?.value || audioState, null, 2));

    // Also inspect window/App state if accessible
    const extraInfo = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const body = document.body.innerText;
          const isPlayingText = body.includes('Playing Live Stream');
          return { isPlayingText, bodyPreview: body.slice(0, 300) };
        })()
      `,
      returnByValue: true
    });
    console.log('UI indicates playing:', JSON.stringify(extraInfo.result?.result?.value || extraInfo, null, 2));

    await sleep(1000);
    ws.close();
    chromeProc.kill();
    console.log('\nDone with browser inspection!');
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
        console.log(`[BROWSER CONSOLE ${msg.params.type}]:`, text);
      } else if (msg.method === 'Network.responseReceived') {
        const res = msg.params.response;
        if (res.url.includes('/api/radio') || res.url.includes('.m3u8') || res.url.includes('.aac') || res.url.includes('.ts')) {
          console.log(`[NETWORK RESPONSE]: ${res.status} ${res.mimeType} -> ${res.url}`);
        }
      } else if (msg.method === 'Network.loadingFailed') {
        console.log(`[NETWORK FAILED]: ${msg.params.errorText} -> ${msg.params.type}`);
      }
    } catch (e) {
      console.error('Parse message error:', e);
    }
  });
}

run();
