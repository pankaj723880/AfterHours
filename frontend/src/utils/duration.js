/**
 * Central duration formatting helper for Loopra tracks & playback.
 * Safely handles strings ('3:45'), numbers (seconds), null/undefined,
 * and objects with { seconds, timestamp, duration } fields to prevent React child rendering crashes.
 */

export function formatTrackDuration(trackOrDuration) {
  if (trackOrDuration === null || trackOrDuration === undefined) {
    return '3:30';
  }

  // If already a plain string
  if (typeof trackOrDuration === 'string') {
    const trimmed = trackOrDuration.trim();
    if (!trimmed) return '3:30';
    // If it contains ':', it's already a formatted timestamp (e.g. "3:45", "1:20:10")
    if (trimmed.includes(':')) {
      return trimmed;
    }
    // If numeric string
    const parsedNum = parseFloat(trimmed);
    if (!isNaN(parsedNum)) {
      return formatSeconds(parsedNum);
    }
    return trimmed;
  }

  // If numeric seconds
  if (typeof trackOrDuration === 'number') {
    return formatSeconds(trackOrDuration);
  }

  // If an object was passed (e.g., track object or { seconds, timestamp, duration })
  if (typeof trackOrDuration === 'object') {
    // If it has duration property
    if (trackOrDuration.duration !== undefined && trackOrDuration.duration !== null) {
      return formatTrackDuration(trackOrDuration.duration);
    }
    // If it has seconds property
    if (trackOrDuration.seconds !== undefined && trackOrDuration.seconds !== null) {
      return formatTrackDuration(trackOrDuration.seconds);
    }
    // If it has timestamp property
    if (trackOrDuration.timestamp !== undefined && trackOrDuration.timestamp !== null) {
      return formatTrackDuration(trackOrDuration.timestamp);
    }
    return '3:30';
  }

  return '3:30';
}

function formatSeconds(secs) {
  if (isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default formatTrackDuration;

