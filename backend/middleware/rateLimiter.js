/**
 * Loopra In-Memory Sliding-Window Rate Limiter
 * Lightweight, zero-dependency, per-IP rate limiting to prevent credential stuffing,
 * brute force attacks, and API abuse without impacting normal streaming playback.
 */

const rateLimitBuckets = new Map();

// Periodic garbage collection for expired rate limit buckets (every 2 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (now - bucket.resetTime > 60000) {
      rateLimitBuckets.delete(key);
    }
  }
}, 120000);

export function createRateLimiter({
  windowMs = 60 * 1000, // 1 minute default
  max = 60, // 60 requests per window
  message = 'Too many requests. Please slow down and try again shortly.'
} = {}) {
  return (req, res, next) => {
    // Determine client IP
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
      .toString()
      .split(',')[0]
      .trim();

    const now = Date.now();
    const bucketKey = `${ip}_${req.baseUrl || ''}${req.path || ''}`;

    let bucket = rateLimitBuckets.get(bucketKey);

    if (!bucket || now > bucket.resetTime) {
      bucket = {
        count: 1,
        resetTime: now + windowMs
      };
      rateLimitBuckets.set(bucketKey, bucket);
    } else {
      bucket.count += 1;
    }

    // Set rate limit headers
    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetTime / 1000));

    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetTime - now) / 1000));
      return res.status(429).json({
        error: message,
        retryAfterSeconds: Math.ceil((bucket.resetTime - now) / 1000)
      });
    }

    next();
  };
}
