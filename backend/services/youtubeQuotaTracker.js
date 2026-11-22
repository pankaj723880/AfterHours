import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import ApiKey from '../models/ApiKeyConfig.js';
import { maskApiKey } from '../utils/keyEncryption.js';
import { getEnvironmentFallbackKeys } from './keyResolverService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_FILE = path.join(__dirname, '..', '.storage', 'youtube_quota_usage.json');

const DEFAULT_DAILY_QUOTA = 10000;

// In-memory tracker map keyed by maskedKey:
// maskedKey -> { keyId, maskedKey, label, totalQuota, usedUnits, status, lastUsedAt, lastError, resetAt, source }
const quotaStore = new Map();

/**
 * Returns today's reset timestamp in UTC (next midnight UTC)
 */
export const getNextMidnightUTC = () => {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
};

/**
 * Returns current UTC date string YYYY-MM-DD
 */
const getTodayUTCString = () => {
  return new Date().toISOString().slice(0, 10);
};

let lastResetDay = getTodayUTCString();

/**
 * Ensure storage directory exists
 */
const ensureStorageDir = () => {
  try {
    const dir = path.dirname(STORAGE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    // Non-blocking
  }
};

/**
 * Load persisted quota state from disk
 */
const loadFromDisk = () => {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (data.lastResetDay) {
          lastResetDay = data.lastResetDay;
        }
        if (data.keys && typeof data.keys === 'object') {
          for (const [maskedKey, item] of Object.entries(data.keys)) {
            quotaStore.set(maskedKey, item);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[YouTubeQuotaTracker] Notice loading quota file:', err.message);
  }
};

/**
 * Persist quota state to disk atomically
 */
const saveToDisk = () => {
  try {
    ensureStorageDir();
    const payload = {
      lastResetDay,
      updatedAt: new Date().toISOString(),
      keys: Object.fromEntries(quotaStore.entries())
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    // Non-blocking disk persistence
  }
};

// Initialize from disk
loadFromDisk();

/**
 * Checks and triggers daily reset if midnight UTC has passed
 */
export const checkDailyReset = () => {
  const today = getTodayUTCString();
  if (today !== lastResetDay) {
    console.log(`[YouTubeQuotaTracker] Midnight UTC reached (${lastResetDay} -> ${today}). Performing daily quota reset.`);
    for (const [maskedKey, item] of quotaStore.entries()) {
      quotaStore.set(maskedKey, {
        ...item,
        usedUnits: 0,
        status: item.status === 'exhausted' ? 'active' : item.status,
        lastError: item.status === 'exhausted' ? null : item.lastError,
        resetAt: getNextMidnightUTC()
      });
    }
    lastResetDay = today;
    saveToDisk();

    // Also update MongoDB database keys if connected
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      ApiKey.updateMany(
        { service: 'youtube', isExhausted: true },
        { 
          $set: { 
            status: 'Active', 
            isExhausted: false, 
            cooldownUntil: null 
          } 
        }
      ).catch(() => {});
    }
  }
};

/**
 * Resolve or initialize tracker entry for a key
 */
const getOrCreateEntry = (keyInfo) => {
  checkDailyReset();
  const rawKey = keyInfo.key || '';
  const maskedKey = keyInfo.maskedKey || (rawKey ? maskApiKey(rawKey) : 'unknown');
  
  let entry = quotaStore.get(maskedKey);
  if (!entry) {
    entry = {
      keyId: keyInfo._id ? String(keyInfo._id) : null,
      maskedKey,
      label: keyInfo.label || (keyInfo.isDbKey ? 'Database Key' : 'Env Key'),
      totalQuota: DEFAULT_DAILY_QUOTA,
      usedUnits: 0,
      status: 'active', // 'active' | 'exhausted' | 'error'
      lastUsedAt: null,
      lastError: null,
      resetAt: getNextMidnightUTC(),
      source: keyInfo.isDbKey ? 'database' : 'environment'
    };
    quotaStore.set(maskedKey, entry);
    saveToDisk();
  } else {
    // Keep labels/ids fresh
    if (keyInfo.label && entry.label !== keyInfo.label) entry.label = keyInfo.label;
    if (keyInfo._id && !entry.keyId) entry.keyId = String(keyInfo._id);
  }
  return entry;
};

/**
 * Record usage units for an API key (e.g. 100 for search, 1 for videos.list)
 */
export const recordQuotaUsage = async (keyInfo, units = 100) => {
  if (!keyInfo) return;
  checkDailyReset();

  const entry = getOrCreateEntry(keyInfo);
  entry.usedUnits += units;
  entry.lastUsedAt = new Date().toISOString();

  if (entry.usedUnits >= entry.totalQuota && entry.status === 'active') {
    entry.status = 'exhausted';
  }

  saveToDisk();

  // If DB key and MongoDB is connected, also mirror to DB document
  if (keyInfo.isDbKey && keyInfo._id && mongoose.connection?.readyState === 1) {
    try {
      await ApiKey.updateOne(
        { _id: keyInfo._id },
        {
          $inc: { successCount: 1 },
          $set: {
            status: entry.status === 'exhausted' ? 'Exhausted' : 'Active',
            isExhausted: entry.status === 'exhausted',
            lastUsedAt: new Date()
          }
        }
      );
    } catch (_) {}
  }
};

/**
 * Mark a key as exhausted or error (e.g. on 403 quotaExceeded)
 */
export const recordQuotaError = async (keyInfo, errorDetails = {}) => {
  if (!keyInfo) return;
  checkDailyReset();

  const entry = getOrCreateEntry(keyInfo);
  const { status, reason, message } = errorDetails;
  const isQuota = status === 403 || reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || (message && String(message).toLowerCase().includes('quota'));

  entry.lastError = {
    statusCode: status || null,
    reason: reason || (isQuota ? 'quotaExceeded' : 'error'),
    message: String(message || 'Unknown API Error').slice(0, 300),
    timestamp: new Date().toISOString()
  };

  if (isQuota) {
    entry.status = 'exhausted';
    // Max out usedUnits if reported quota exhausted by upstream
    if (entry.usedUnits < entry.totalQuota) {
      entry.usedUnits = entry.totalQuota;
    }
  } else if (status === 400 || (message && String(message).toLowerCase().includes('api key not valid'))) {
    entry.status = 'error';
  }

  saveToDisk();
};

/**
 * Set total daily quota limit for a specific key (configurable)
 */
export const setKeyQuotaLimit = (maskedKey, totalQuota) => {
  checkDailyReset();
  const entry = quotaStore.get(maskedKey);
  if (entry) {
    entry.totalQuota = Math.max(1, parseInt(totalQuota, 10) || DEFAULT_DAILY_QUOTA);
    if (entry.usedUnits >= entry.totalQuota) {
      entry.status = 'exhausted';
    } else if (entry.status === 'exhausted') {
      entry.status = 'active';
    }
    saveToDisk();
    return entry;
  }
  return null;
};

/**
 * Manually reset quota for a specific key or all keys
 */
export const resetKeyQuota = async (maskedKey = null) => {
  checkDailyReset();
  if (maskedKey) {
    const entry = quotaStore.get(maskedKey);
    if (entry) {
      entry.usedUnits = 0;
      entry.status = 'active';
      entry.lastError = null;
      entry.resetAt = getNextMidnightUTC();
      saveToDisk();

      if (entry.keyId && mongoose.connection?.readyState === 1) {
        ApiKey.updateOne(
          { _id: entry.keyId },
          { $set: { status: 'Active', isExhausted: false, cooldownUntil: null } }
        ).catch(() => {});
      }
      return entry;
    }
    return null;
  }

  // Reset all
  for (const [mKey, item] of quotaStore.entries()) {
    quotaStore.set(mKey, {
      ...item,
      usedUnits: 0,
      status: 'active',
      lastError: null,
      resetAt: getNextMidnightUTC()
    });
  }
  saveToDisk();

  if (mongoose.connection?.readyState === 1) {
    ApiKey.updateMany(
      { service: 'youtube' },
      { $set: { status: 'Active', isExhausted: false, cooldownUntil: null } }
    ).catch(() => {});
  }

  return true;
};

/**
 * Get full per-key usage report and aggregated totals
 */
export const getQuotaReport = async () => {
  checkDailyReset();

  // Ensure all current environment and DB keys are in the store
  const envKeys = getEnvironmentFallbackKeys('youtube');
  for (const ek of envKeys) {
    getOrCreateEntry(ek);
  }

  if (mongoose.connection?.readyState === 1) {
    try {
      const dbDocs = await ApiKey.find({ service: 'youtube' }).lean();
      for (const doc of dbDocs) {
        const masked = doc.maskedKey || (doc.key ? maskApiKey(doc.key) : null);
        if (masked) {
          getOrCreateEntry({
            _id: doc._id,
            maskedKey: masked,
            label: doc.label || 'MongoDB Dynamic Key',
            isDbKey: true
          });
        }
      }
    } catch (_) {}
  }

  const items = Array.from(quotaStore.values()).map(item => {
    const totalQuota = item.totalQuota || DEFAULT_DAILY_QUOTA;
    const usedUnits = item.usedUnits || 0;
    const remainingUnits = Math.max(0, totalQuota - usedUnits);
    const usagePercent = Math.min(100, Math.round((usedUnits / totalQuota) * 100));

    return {
      keyId: item.keyId,
      maskedKey: item.maskedKey,
      label: item.label,
      source: item.source || 'environment',
      totalQuota,
      usedUnits,
      remainingUnits,
      usagePercent,
      status: item.status || 'active', // 'active' | 'exhausted' | 'error'
      lastUsedAt: item.lastUsedAt,
      lastError: item.lastError,
      resetAt: item.resetAt || getNextMidnightUTC()
    };
  });

  const totals = items.reduce(
    (acc, curr) => {
      acc.totalQuota += curr.totalQuota;
      acc.totalUsed += curr.usedUnits;
      acc.totalRemaining += curr.remainingUnits;
      if (curr.status === 'active') acc.activeKeys += 1;
      if (curr.status === 'exhausted') acc.exhaustedKeys += 1;
      if (curr.status === 'error') acc.errorKeys += 1;
      return acc;
    },
    {
      totalKeys: items.length,
      totalQuota: 0,
      totalUsed: 0,
      totalRemaining: 0,
      activeKeys: 0,
      exhaustedKeys: 0,
      errorKeys: 0,
      overallUsagePercent: 0
    }
  );

  if (totals.totalQuota > 0) {
    totals.overallUsagePercent = Math.min(100, Math.round((totals.totalUsed / totals.totalQuota) * 100));
  }

  return {
    success: true,
    totals,
    keys: items,
    nextResetAt: getNextMidnightUTC(),
    timestamp: new Date().toISOString()
  };
};

export default {
  recordQuotaUsage,
  recordQuotaError,
  setKeyQuotaLimit,
  resetKeyQuota,
  getQuotaReport,
  checkDailyReset
};
