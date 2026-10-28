import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import SiteConfig from '../models/SiteConfig.js';
import { generateToken } from '../middleware/auth.js';
import { normalizeCmsConfig, applyThemeToDom, hexToRgb } from '../../frontend/src/services/cmsClient.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const HOST = 'localhost';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: HOST,
      port: PORT,
      ...options,
      headers: {
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(JSON.stringify(body)) } : {}),
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runThemeTests() {
  console.log('=== VERIFYING COMPLETE CMS THEME FLOW ===\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition, title) => {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}`);
      failed++;
    }
  };

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afterhours');

    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      admin = new User({
        username: 'test_theme_admin_' + Date.now(),
        password: 'admin_password_123',
        role: 'admin',
        status: 'active'
      });
      await admin.save();
    }
    const adminToken = generateToken(admin);

    // -------------------------------------------------------------
    // Test 1: Null / Undefined / Corrupted Theme Normalization Test
    // -------------------------------------------------------------
    const corruptedConfigs = [
      null,
      undefined,
      {},
      { theme: null },
      { theme: {} },
      { theme: { accentColor: null } },
      { theme: { glassmorphism: null, meshGradient: null, particles: null } }
    ];

    corruptedConfigs.forEach((cfg, idx) => {
      const norm = normalizeCmsConfig(cfg);
      assert(
        norm && norm.theme && typeof norm.theme.accentColor === 'string' &&
        typeof norm.theme.glassmorphism === 'boolean' &&
        typeof norm.theme.meshGradient === 'boolean' &&
        typeof norm.theme.particles === 'boolean',
        `Null/Corrupted Theme test #${idx + 1} resolves safely without throwing`
      );
    });

    // -------------------------------------------------------------
    // Test 2: Verify Each Preset Accent Color
    // -------------------------------------------------------------
    const presets = [
      { name: 'Amber Glow', color: '#f59e0b' },
      { name: 'Emerald Forest', color: '#10b981' },
      { name: 'Cyan Wave', color: '#06b6d4' },
      { name: 'Electric Violet', color: '#8b5cf6' },
      { name: 'Crimson Rose', color: '#f43f5e' },
      { name: 'Sunset Orange', color: '#f97316' },
      { name: 'Custom Hex', color: '#ec4899' }
    ];

    for (const preset of presets) {
      // 1. Save to draft
      const saveRes = await request({
        path: '/api/admin/cms/config/draft',
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }, {
        theme: {
          accentColor: preset.color,
          themeMode: 'dark',
          glassmorphism: true,
          meshGradient: true,
          particles: true
        }
      });
      assert(saveRes.status === 200, `Save Draft for preset "${preset.name}" (${preset.color}) returns 200 OK`);

      // Verify draft in database has the new color
      const draftDoc = await SiteConfig.findOne({ configType: 'draft' }).lean();
      assert(draftDoc?.theme?.accentColor === preset.color, `Draft in DB persists "${preset.name}" color`);

      // 2. Publish Live
      const pubRes = await request({
        path: '/api/admin/cms/config/publish',
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }, { summary: `Published preset ${preset.name}` });
      assert(pubRes.status === 200, `Publish Live for preset "${preset.name}" returns 200 OK`);

      // Verify published document in DB has the color
      const pubDoc = await SiteConfig.findOne({ configType: 'published' }).lean();
      assert(pubDoc?.theme?.accentColor === preset.color, `Published document in DB confirmed with "${preset.name}"`);

      // 3. Public API returns the published theme
      const publicRes = await request({ path: '/api/cms/public-config', method: 'GET' });
      assert(publicRes.status === 200 && publicRes.data?.theme?.accentColor === preset.color,
        `Public site /api/cms/public-config immediately loads "${preset.name}" (${preset.color})`
      );

      // 4. Repeated public request (simulating page reload) retains the theme
      const reloadRes = await request({ path: '/api/cms/public-config', method: 'GET' });
      assert(reloadRes.data?.theme?.accentColor === preset.color,
        `Public site reload retains published "${preset.name}" (${preset.color})`
      );
    }

    // -------------------------------------------------------------
    // Test 3: Verify Visual Toggles (Glassmorphism, 3D Mesh, Particles)
    // -------------------------------------------------------------
    const visualToggleTests = [
      { name: 'Disable Glassmorphism', theme: { accentColor: '#10b981', themeMode: 'dark', glassmorphism: false, meshGradient: true, particles: true } },
      { name: 'Enable Glassmorphism', theme: { accentColor: '#10b981', themeMode: 'dark', glassmorphism: true, meshGradient: true, particles: true } },
      { name: 'Disable 3D Dynamic Mesh', theme: { accentColor: '#06b6d4', themeMode: 'dark', glassmorphism: true, meshGradient: false, particles: true } },
      { name: 'Enable 3D Dynamic Mesh', theme: { accentColor: '#06b6d4', themeMode: 'dark', glassmorphism: true, meshGradient: true, particles: true } },
      { name: 'Disable Particle Stars', theme: { accentColor: '#f43f5e', themeMode: 'dark', glassmorphism: true, meshGradient: true, particles: false } },
      { name: 'Enable Particle Stars', theme: { accentColor: '#f43f5e', themeMode: 'dark', glassmorphism: true, meshGradient: true, particles: true } }
    ];

    for (const toggleTest of visualToggleTests) {
      const saveRes = await request({
        path: '/api/admin/cms/config/draft',
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }, { theme: toggleTest.theme });
      assert(saveRes.status === 200, `Draft saved for visual setting "${toggleTest.name}"`);

      const pubRes = await request({
        path: '/api/admin/cms/config/publish',
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }, { summary: `Published visual setting ${toggleTest.name}` });
      assert(pubRes.status === 200, `Publish confirmed for visual setting "${toggleTest.name}"`);

      const publicRes = await request({ path: '/api/cms/public-config', method: 'GET' });
      const pubTheme = publicRes.data?.theme;
      assert(
        pubTheme?.glassmorphism === toggleTest.theme.glassmorphism &&
        pubTheme?.meshGradient === toggleTest.theme.meshGradient &&
        pubTheme?.particles === toggleTest.theme.particles,
        `Public site reflects visual toggle "${toggleTest.name}" (glass: ${pubTheme?.glassmorphism}, mesh: ${pubTheme?.meshGradient}, particles: ${pubTheme?.particles})`
      );
    }

    console.log(`\n=== THEME VERIFICATION SUITE RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runThemeTests();

