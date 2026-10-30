import http from 'http';

function makeRequest(options, postBody = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });
    req.on('error', reject);
    if (postBody) req.write(postBody);
    req.end();
  });
}

async function run() {
  console.log('--- STEP 1: Login as admin@afterhours.com to get valid admin token ---');
  const loginBody = JSON.stringify({
    username: 'admin@afterhours.com',
    password: 'admin123'
  });

  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginBody)
    }
  }, loginBody);

  console.log('Login Status:', loginRes.statusCode);
  console.log('Login Content-Type:', loginRes.headers['content-type']);
  const loginData = JSON.parse(loginRes.data);
  const token = loginData.token;
  if (!token) {
    throw new Error('Failed to obtain admin token: ' + loginRes.data);
  }
  console.log('Obtained Admin Token successfully!');

  console.log('\n--- STEP 2: GET /api/admin/live-users-config ---');
  const getRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/live-users-config',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  console.log('GET Status:', getRes.statusCode);
  console.log('GET Content-Type:', getRes.headers['content-type']);
  console.log('GET Body:', getRes.data);

  console.log('\n--- STEP 3: POST /api/admin/live-users-config (Save Mode B: Manual Range) ---');
  const manualPayload = JSON.stringify({
    mode: 'manual',
    minUsers: 400,
    maxUsers: 800
  });

  const postManualRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/live-users-config',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Content-Length': Buffer.byteLength(manualPayload)
    }
  }, manualPayload);

  console.log('POST Manual Status:', postManualRes.statusCode);
  console.log('POST Manual Content-Type:', postManualRes.headers['content-type']);
  console.log('POST Manual Body:', postManualRes.data);
  const manualConfig = JSON.parse(postManualRes.data);
  if (manualConfig.config.mode !== 'manual') {
    throw new Error('Manual mode not saved!');
  }

  console.log('\n--- STEP 4: POST /api/admin/live-users-config (Save Mode A: Real Live Users) ---');
  const realPayload = JSON.stringify({
    mode: 'real'
  });

  const postRealRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/live-users-config',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Content-Length': Buffer.byteLength(realPayload)
    }
  }, realPayload);

  console.log('POST Real Status:', postRealRes.statusCode);
  console.log('POST Real Content-Type:', postRealRes.headers['content-type']);
  console.log('POST Real Body:', postRealRes.data);
  const realConfig = JSON.parse(postRealRes.data);
  if (realConfig.config.mode !== 'real') {
    throw new Error('Real mode not saved!');
  }

  console.log('\n--- STEP 5: Final GET to verify Mode A persistence in MongoDB ---');
  const finalGetRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/live-users-config',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  console.log('Final GET Status:', finalGetRes.statusCode);
  console.log('Final GET Content-Type:', finalGetRes.headers['content-type']);
  console.log('Final GET Body:', finalGetRes.data);
  const finalConfig = JSON.parse(finalGetRes.data);
  if (finalConfig.mode !== 'real') {
    throw new Error('Mode A was not persisted in MongoDB!');
  }

  console.log('\n========================================');
  console.log('ALL API OPERATIONS PASSED WITH VALID JSON!');
  console.log('========================================');
  process.exit(0);
}

run().catch(err => {
  console.error('\nTEST FAILED:', err.message);
  process.exit(1);
});
