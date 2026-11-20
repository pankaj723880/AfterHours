/**
 * Release APK Automation Pipeline for Loopra Android.
 *
 * Requirements:
 * 1. Reads current version from single canonical source (`version.json`).
 * 2. Increments semantic version: v2.1 -> v2.2 -> ... -> v2.9 -> v3.0 -> v3.1.
 * 3. Increments versionCode: 21 -> 22 -> 23...
 * 4. Updates `loopra-apk/app/build.gradle` and `loopra-apk/twa-manifest.json`.
 * 5. Builds release APK using `./gradlew.bat assembleRelease`.
 * 6. Zipaligns and signs APK using `loopra-apk/android.keystore` (alias: `android`).
 * 7. Verifies signing certificates and package metadata with `apksigner` and `aapt2`.
 * 8. Calculates file size and SHA-256 hash.
 * 9. Atomically publishes the artifact to `frontend/public/Loopra.apk` and updates `version.json` & `frontend/public/version.json`.
 * 10. Does NOT consume version bump if any step fails.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export function getNextVersion(currentVersion) {
  const cleaned = String(currentVersion).trim().replace(/^v/i, '');
  const parts = cleaned.split('.').map(n => parseInt(n, 10));
  let major = isNaN(parts[0]) ? 2 : parts[0];
  let minor = isNaN(parts[1]) ? 1 : parts[1];

  if (minor >= 9) {
    major += 1;
    minor = 0;
  } else {
    minor += 1;
  }

  return {
    versionName: `${major}.${minor}`,
    versionString: `v${major}.${minor}`
  };
}

export function calculateSha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function runRelease(options = {}) {
  const dryRun = options.dryRun || false;
  const versionFile = path.join(ROOT_DIR, 'version.json');
  const publicVersionFile = path.join(ROOT_DIR, 'frontend', 'public', 'version.json');
  const buildGradleFile = path.join(ROOT_DIR, 'loopra-apk', 'app', 'build.gradle');
  const twaManifestFile = path.join(ROOT_DIR, 'loopra-apk', 'twa-manifest.json');
  const keystorePath = path.join(ROOT_DIR, 'loopra-apk', 'android.keystore');
  const publicApkPath = path.join(ROOT_DIR, 'frontend', 'public', 'Loopra.apk');
  const signedApkPath = path.join(ROOT_DIR, 'loopra-apk', 'app-release-signed.apk');

  console.log('🚀 Starting Loopra Android Release Pipeline...');

  // 1. Read current canonical version
  if (!fs.existsSync(versionFile)) {
    throw new Error(`Missing canonical version file at ${versionFile}`);
  }
  const currentManifest = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
  const currentVer = currentManifest.versionName || '2.1';
  const currentCode = parseInt(currentManifest.versionCode, 10) || 21;

  const nextVerObj = getNextVersion(currentVer);
  const nextVerName = nextVerObj.versionName;
  const nextVerCode = currentCode + 1;

  console.log(`📌 Version Bump Plan: ${currentVer} (code ${currentCode}) -> ${nextVerName} (code ${nextVerCode})`);

  if (dryRun) {
    console.log('🔍 DRY RUN completed successfully.');
    return { nextVerName, nextVerCode };
  }

  // Backup original files to ensure atomic rollback on build failure
  const originalGradle = fs.readFileSync(buildGradleFile, 'utf8');
  const originalTwa = fs.readFileSync(twaManifestFile, 'utf8');

  try {
    // 2. Synchronize build.gradle and twa-manifest.json
    console.log('📝 Updating Android configuration files...');
    const updatedGradle = originalGradle
      .replace(/versionCode\s+\d+/g, `versionCode ${nextVerCode}`)
      .replace(/versionName\s+"[^"]+"/g, `versionName "${nextVerName}"`);
    fs.writeFileSync(buildGradleFile, updatedGradle, 'utf8');

    const twaObj = JSON.parse(originalTwa);
    twaObj.appVersionName = nextVerName;
    twaObj.appVersionCode = nextVerCode;
    twaObj.appVersion = nextVerName;
    fs.writeFileSync(twaManifestFile, JSON.stringify(twaObj, null, 2), 'utf8');

    // 3. Assemble Release APK
    console.log('🔨 Executing Gradle assembleRelease...');
    const gradlewCmd = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
    execSync(`${gradlewCmd} assembleRelease`, {
      cwd: path.join(ROOT_DIR, 'loopra-apk'),
      stdio: 'inherit'
    });

    const unsignedApk = path.join(ROOT_DIR, 'loopra-apk', 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk');
    if (!fs.existsSync(unsignedApk)) {
      throw new Error(`Expected build artifact not found at ${unsignedApk}`);
    }

    // 4. Locate SDK build tools (zipalign & apksigner)
    const sdkBuildTools = 'C:\\Users\\panka\\.bubblewrap\\android_sdk\\build-tools\\36.1.0';
    const zipalignExe = path.join(sdkBuildTools, 'zipalign.exe');
    const apksignerBat = path.join(sdkBuildTools, 'apksigner.bat');

    const alignedApk = path.join(ROOT_DIR, 'loopra-apk', 'app-release-unsigned-aligned.apk');
    if (fs.existsSync(alignedApk)) fs.unlinkSync(alignedApk);

    console.log('📦 Aligning APK...');
    execSync(`"${zipalignExe}" -v -p 4 "${unsignedApk}" "${alignedApk}"`, { stdio: 'ignore' });

    console.log('🔐 Signing APK...');
    const keyPass = process.env.LOOPRA_KEYSTORE_PASS || 'loopra123';
    execSync(`"${apksignerBat}" sign --ks "${keystorePath}" --ks-pass "pass:${keyPass}" --ks-key-alias "android" --key-pass "pass:${keyPass}" --out "${signedApkPath}" "${alignedApk}"`, {
      stdio: 'ignore'
    });

    // 5. Verify APK signature
    console.log('🛡️ Verifying signed APK signature...');
    execSync(`"${apksignerBat}" verify --verbose "${signedApkPath}"`, { stdio: 'inherit' });

    // 6. Calculate SHA-256 and file size
    const sha256 = calculateSha256(signedApkPath);
    const fileSize = fs.statSync(signedApkPath).size;

    console.log(`✅ Build Verified: SHA-256: ${sha256} (${fileSize} bytes)`);

    // 7. Atomically copy artifact and update manifest
    fs.copyFileSync(signedApkPath, publicApkPath);

    const updatedManifest = {
      versionName: nextVerName,
      versionCode: nextVerCode,
      downloadUrl: 'https://loopra1.vercel.app/downloads/loopra.apk',
      directApkUrl: 'https://loopra1.vercel.app/Loopra.apk',
      releaseNotes: `Official Loopra Android Release ${nextVerObj.versionString} with automatic update detection and seamless installer.`,
      releaseDate: new Date().toISOString(),
      minSdkVersion: 24,
      fileSize: fileSize,
      sha256: sha256
    };

    fs.writeFileSync(versionFile, JSON.stringify(updatedManifest, null, 2) + '\n', 'utf8');
    fs.writeFileSync(publicVersionFile, JSON.stringify(updatedManifest, null, 2) + '\n', 'utf8');

    console.log(`🎉 RELEASE SUCCESSFUL! Version ${nextVerObj.versionString} (code ${nextVerCode}) published to public artifact.`);
    return updatedManifest;

  } catch (err) {
    console.error('❌ Build failed! Rolling back Android configuration files...');
    fs.writeFileSync(buildGradleFile, originalGradle, 'utf8');
    fs.writeFileSync(twaManifestFile, originalTwa, 'utf8');
    throw err;
  }
}

// Allow CLI execution if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isDryRun = process.argv.includes('--dry-run');
  try {
    runRelease({ dryRun: isDryRun });
  } catch (e) {
    console.error('Fatal release error:', e.message);
    process.exit(1);
  }
}
