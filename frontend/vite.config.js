import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Vite plugin to generate unique buildId, buildTimestamp, and write version.json on every build
function versionGeneratorPlugin() {
  return {
    name: 'version-generator-plugin',
    buildStart() {
      const now = new Date();
      const buildTimestamp = now.getTime();
      const isoDate = now.toISOString();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const buildId = `build_${now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}_${randomSuffix}`;

      // Read root version.json or fallback
      let baseVersion = '2.2';
      let versionCode = 22;
      let releaseNotes = 'Latest performance updates and feature improvements for Loopra.';
      let downloadUrl = `https://loopra1.vercel.app/Loopra.apk?v=${versionCode}`;
      let directApkUrl = downloadUrl;
      let sha256 = '';
      let fileSize = 5744624;

      const candidatePaths = [
        path.resolve(__dirname, 'public/version.json'),
        path.resolve(__dirname, '../version.json')
      ];

      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          try {
            const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
            if (raw.versionName) baseVersion = raw.versionName;
            if (raw.versionCode) versionCode = Number(raw.versionCode) || versionCode;
            if (raw.releaseNotes) releaseNotes = raw.releaseNotes;
            if (raw.downloadUrl) downloadUrl = raw.downloadUrl;
            if (raw.directApkUrl) directApkUrl = raw.directApkUrl;
            if (raw.sha256) sha256 = raw.sha256;
            if (raw.fileSize) fileSize = raw.fileSize;
            break;
          } catch (_) {}
        }
      }

      const versionManifest = {
        version: baseVersion,
        versionName: baseVersion,
        versionCode: versionCode,
        buildId,
        buildTimestamp,
        buildDate: isoDate,
        releaseNotes,
        whatsNew: releaseNotes,
        downloadUrl,
        directApkUrl,
        sha256,
        fileSize
      };

      // Write to public/version.json so it is included in Vite static assets & dev server
      const publicVersionPath = path.resolve(__dirname, 'public/version.json');
      fs.writeFileSync(publicVersionPath, JSON.stringify(versionManifest, null, 2) + '\n', 'utf8');

      // Also sync to root version.json if present
      const rootVersionPath = path.resolve(__dirname, '../version.json');
      if (fs.existsSync(rootVersionPath)) {
        try {
          fs.writeFileSync(rootVersionPath, JSON.stringify(versionManifest, null, 2) + '\n', 'utf8');
        } catch (_) {}
      }
    },
    generateBundle() {
      // Ensure dist/version.json is emitted directly into build output
      const publicVersionPath = path.resolve(__dirname, 'public/version.json');
      if (fs.existsSync(publicVersionPath)) {
        const content = fs.readFileSync(publicVersionPath, 'utf8');
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: content
        });
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  // Read current version and build metadata
  let buildId = `build_${Date.now()}`;
  let buildTimestamp = Date.now();
  let versionName = '2.2';
  let versionCode = 22;

  try {
    const publicVersionPath = path.resolve(__dirname, 'public/version.json');
    if (fs.existsSync(publicVersionPath)) {
      const data = JSON.parse(fs.readFileSync(publicVersionPath, 'utf8'));
      if (data.buildId) buildId = data.buildId;
      if (data.buildTimestamp) buildTimestamp = data.buildTimestamp;
      if (data.versionName) versionName = data.versionName;
      if (data.versionCode) versionCode = data.versionCode;
    }
  } catch (_) {}

  return {
    define: {
      __APP_VERSION__: JSON.stringify(versionName),
      __APP_VERSION_CODE__: JSON.stringify(versionCode),
      __APP_BUILD_ID__: JSON.stringify(buildId),
      __APP_BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp)
    },
    plugins: [versionGeneratorPlugin(), react(), tailwindcss()],
    optimizeDeps: {
      exclude: ['hls.js']
    },
    build: {
      target: 'esnext',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('three') || id.includes('@react-three')) {
                return 'vendor-three';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('framer-motion')) {
                return 'vendor-motion';
              }
              if (id.includes('hls.js')) {
                return 'vendor-hls';
              }
              if (id.includes('socket.io-client')) {
                return 'vendor-socket';
              }
              if (id.includes('@react-oauth')) {
                return 'vendor-oauth';
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'vendor-react';
              }
            }
          }
        }
      }
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      },
      proxy: {
        '/audio': {
          target: 'http://localhost:5000',
          changeOrigin: true
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true
        },
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true
        }
      }
    }
  };
});
