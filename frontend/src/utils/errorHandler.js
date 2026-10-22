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

/**
 * Safely parses response JSON, avoiding SyntaxError on HTML or non-JSON payloads.
 * Returns { ok, status, data, error }
 */
export const safeParseJsonResponse = async (res, defaultErrorMessage = 'Request failed') => {
  if (!res) return { ok: false, status: 0, data: null, error: 'No response received' };

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    await res.text().catch(() => '');
  }

  if (!res.ok) {
    if (res.status === 502 || res.status === 503) {
      return { ok: false, status: res.status, data, error: 'Backend server is waking up. Please retry in a few seconds.' };
    }
    if (res.status === 404) {
      return { ok: false, status: res.status, data, error: 'Requested service endpoint was not found (HTTP 404).' };
    }
    const message = (data && (data.error || data.message)) || `${defaultErrorMessage} (HTTP ${res.status})`;
    return { ok: false, status: res.status, data, error: message };
  }

  if (data === null) {
    return { ok: false, status: res.status, data: null, error: 'Unexpected non-JSON response from server.' };
  }

  return { ok: true, status: res.status, data, error: null };
};