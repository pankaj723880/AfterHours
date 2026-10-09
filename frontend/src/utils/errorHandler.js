/**
 * Sanitizes technical, HTTP, and API error payloads into user-safe UI messages.
 */
export const sanitizeErrorMessage = (error) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      message: 'Unable to load music. Check your connection and try again.',
      type: 'network',
      retryable: true,
    };
  }

  const rawMsg = typeof error === 'string' ? error : error?.message || '';
  const status = error?.status || error?.response?.status;

  // Mask YouTube API quota limits (403/429)
  if (status === 403 || status === 429 || rawMsg.includes('quotaExceeded')) {
    return {
      message: 'YouTube search limit reached. Please try again later.',
      type: 'quota',
      retryable: false,
    };
  }

  // Handle player playback restrictions (YouTube error codes 100, 101, 150)
  if (error?.code === 100 || error?.code === 101 || error?.code === 150) {
    return {
      message: 'This video is unavailable.',
      type: 'unplayable',
      retryable: false,
    };
  }

  return {
    message: 'Something went wrong while loading this station.',
    type: 'generic',
    retryable: true,
  };
};