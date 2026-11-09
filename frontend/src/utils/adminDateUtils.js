/**
 * Shared Uptime & Timestamp Utilities for Admin Dashboard and Telemetry
 */

/**
 * Formats seconds into a human-readable uptime string (e.g., "2d 4h 15m" or "4h 15m 30s")
 */
export function formatUptime(sec = 0) {
  const numericSec = Math.max(0, Math.floor(Number(sec) || 0));
  const d = Math.floor(numericSec / 86400);
  const h = Math.floor((numericSec % 86400) / 3600);
  const m = Math.floor((numericSec % 3600) / 60);
  const s = Math.floor(numericSec % 60);

  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Safely parses any date/timestamp representation (epoch ms, ISO string, or object)
 * into a formatted date/time string.
 */
export function formatAdminTimestamp(val, options = {}) {
  if (!val) return '—';

  let timestamp = val;
  // If an object was passed (e.g. { timestamp, seconds } or Mongo ISODate wrapper)
  if (typeof val === 'object') {
    timestamp = val.timestamp || val.date || val.$date || (val.seconds ? val.seconds * 1000 : null);
  }

  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '—';

    if (options.timeOnly) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', ...options });
    }
    if (options.dateOnly) {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', ...options });
    }
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      ...options
    });
  } catch (_) {
    return '—';
  }
}

