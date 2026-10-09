import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWin = process.platform === 'win32';
const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
// On Linux, use yt-dlp_linux standalone executable (bundled Python runtime)
const downloadName = isWin ? 'yt-dlp.exe' : 'yt-dlp_linux';

const binDir = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin');
const binPath = path.join(binDir, binaryName);

const downloadBinary = (url, destPath) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBinary(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download binary: HTTP ${res.statusCode}`));
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => {
          if (!isWin) {
            try {
              fs.chmodSync(destPath, 0o755);
            } catch (e) {
              console.warn('Failed to chmod binary:', e.message);
            }
          }
          console.log(`yt-dlp binary installed successfully to ${destPath}`);
          resolve(destPath);
        });
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
};

export const ensureYtDlp = async () => {
  if (fs.existsSync(binPath)) {
    const stats = fs.statSync(binPath);
    // Standalone linux/win binaries are > 10MB
    if (stats.size > 10000000) {
      return binPath;
    }
    console.log(`Existing binary is only ${stats.size} bytes (possibly script, not standalone ELF). Re-downloading standalone...`);
  }

  console.log(`Downloading standalone yt-dlp binary (${downloadName}) for ${process.platform}...`);
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${downloadName}`;
  try {
    await downloadBinary(downloadUrl, binPath);
    return binPath;
  } catch (err) {
    console.error(`Failed to ensure yt-dlp binary:`, err.message);
  }
};

// Run if called directly
if (process.argv[1] === __filename) {
  ensureYtDlp();
}
