const rateLimit = new Map();

/**
 * Creates a rate limiter middleware.
 * @param {string} type - Identifier for the limiter (e.g., 'login', 'register').
 * @param {number} windowMs - Time window in milliseconds.
 * @param {number} maxAttempts - Max attempts allowed per window.
 * @param {string} message - Error message to send when limit is reached.
 */
const createLimiter = (type, windowMs, maxAttempts, message) => {
  return (req, res, next) => {
    // Get IP
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const key = `${type}:${ip}`;

    const now = Date.now();
    const record = rateLimit.get(key);

    if (!record) {
      rateLimit.set(key, { count: 1, firstRequestTime: now });
      return next();
    }

    if (now - record.firstRequestTime > windowMs) {
      // Window expired, reset
      rateLimit.set(key, { count: 1, firstRequestTime: now });
      return next();
    }

    if (record.count >= maxAttempts) {
      console.warn(`🛑 Rate limit exceeded for ${type} from IP: ${ip}`);
      return res.status(429).json({ message });
    }

    record.count += 1;
    next();
  };
};

// Periodic cleanup (every 10 mins)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const MAX_WINDOW_CLEANUP = 60 * 60 * 1000;

  for (const [key, record] of rateLimit.entries()) {
    if (now - record.firstRequestTime > MAX_WINDOW_CLEANUP) {
      rateLimit.delete(key);
    }
  }
}, 10 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

const loginLimiter = createLimiter(
  'login',
  15 * 60 * 1000, // 15 mins
  5,
  'Muitas tentativas de login. Tente novamente em 15 minutos.'
);

// Register limiter: 3 attempts per hour
const registerLimiter = createLimiter(
  'register',
  60 * 60 * 1000, // 1 hour
  3,
  'Muitas tentativas de registro. Tente novamente em 1 hora.'
);

module.exports = { loginLimiter, registerLimiter };
