import crypto from 'crypto';

// Use KEY_ENCRYPTION_SECRET, fallback to JWT_SECRET or a stable internal salt
const getSecretKey = () => {
  const secret = process.env.KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET || 'loopra-secure-fallback-encryption-salt-32b';
  return crypto.createHash('sha256').update(String(secret)).digest();
};

/**
 * Encrypts an API key using AES-256-GCM.
 * Returns an object with iv, encryptedData, and authTag (hex encoded).
 */
export function encryptApiKey(plainKey) {
  if (!plainKey || typeof plainKey !== 'string') {
    throw new Error('API key must be a non-empty string');
  }

  const key = getSecretKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainKey.trim(), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encryptedKey: encrypted,
    iv: iv.toString('hex'),
    authTag
  };
}

/**
 * Decrypts an encrypted key record using AES-256-GCM.
 * Accepts either an object { encryptedKey, iv, authTag } or plain string (for backward compatibility).
 */
export function decryptApiKey(record) {
  if (!record) return '';

  // Backward compatibility: If key is already in plaintext format
  if (typeof record === 'string') {
    return record.trim();
  }

  // If record has encrypted fields
  if (record.encryptedKey && record.iv && record.authTag) {
    try {
      const key = getSecretKey();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'hex'));
      decipher.setAuthTag(Buffer.from(record.authTag, 'hex'));

      let decrypted = decipher.update(record.encryptedKey, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted.trim();
    } catch (err) {
      console.warn('[KeyEncryption] Failed to decrypt API key:', err.message);
      return '';
    }
  }

  // Fallback to record.key if present (unencrypted legacy)
  if (record.key && typeof record.key === 'string') {
    return record.key.trim();
  }

  return '';
}

/**
 * Generates a standard masked key representation, e.g. "AIzaSy...9X2P".
 */
export function maskApiKey(rawKey = '') {
  if (!rawKey || typeof rawKey !== 'string') return '••••••••';
  const clean = rawKey.trim();
  if (clean.length <= 8) return '••••' + clean.slice(-2);
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

