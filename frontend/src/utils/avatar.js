import { BACKEND_URL } from './apiUrl';

/**
 * Normalizes and resolves avatar URLs for consistent rendering:
 * 1. Accepts either a user object or a raw URL string.
 * 2. Resolves relative backend paths (/uploads/...) with BACKEND_URL.
 * 3. Supports Google OAuth, external CDNs, blob, and base64 data URLs.
 * 4. Strips malformed or empty URLs to prevent broken image renders.
 */
export const getAvatarUrl = (userOrUrl) => {
  if (!userOrUrl) return '';

  let rawUrl = '';
  if (typeof userOrUrl === 'string') {
    rawUrl = userOrUrl.trim();
  } else if (typeof userOrUrl === 'object') {
    rawUrl = (
      userOrUrl.avatarUrl ||
      userOrUrl.avatar ||
      userOrUrl.picture ||
      userOrUrl.photoURL ||
      userOrUrl.profilePicture ||
      ''
    ).trim();
  }

  if (!rawUrl) return '';

  // Base64 data and blob URLs
  if (rawUrl.startsWith('data:image/') || rawUrl.startsWith('blob:')) {
    return rawUrl;
  }

  // Relative backend upload paths: /uploads/... or uploads/...
  if (rawUrl.startsWith('/uploads/') || rawUrl.startsWith('uploads/')) {
    const cleanPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    return `${BACKEND_URL}${cleanPath}`;
  }

  // Any relative path
  if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
    return `${BACKEND_URL}${rawUrl}`;
  }

  // Protocol-relative URLs
  if (rawUrl.startsWith('//')) {
    return `https:${rawUrl}`;
  }

  // Standard absolute URLs (http, https)
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }

  return '';
};

/**
 * Safely extracts user initial letter for avatar fallback.
 */
export const getUserInitials = (userOrName, defaultInitial = 'U') => {
  if (!userOrName) return defaultInitial;

  let raw = '';
  if (typeof userOrName === 'string') {
    raw = userOrName.trim();
  } else if (typeof userOrName === 'object') {
    raw = (
      userOrName.displayName ||
      userOrName.username ||
      userOrName.name ||
      userOrName.email ||
      ''
    ).trim();
  }

  if (!raw) return defaultInitial;

  // If email, pick characters before '@'
  const clean = raw.includes('@') ? raw.split('@')[0] : raw;
  const match = clean.match(/[a-zA-Z0-9]/);
  return match ? match[0].toUpperCase() : (clean.charAt(0).toUpperCase() || defaultInitial);
};

