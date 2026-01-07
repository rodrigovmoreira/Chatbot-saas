const rateLimit = new Map();

/**
 * Custom In-Memory Rate Limiter for Login
 * Limits: 5 attempts per 15 minutes per IP
 */
const loginLimiter = (req, res, next) => {
  // Get IP (handles Proxy/Railway)
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || req.connection.remoteAddress;

  const WINDOW_SIZE_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_ATTEMPTS = 5;
  const now = Date.now();

  // Initialize or get record
  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, { count: 1, resetTime: now + WINDOW_SIZE_MS });
    return next();
  }

  const data = rateLimit.get(ip);

  // Check if window expired
  if (now > data.resetTime) {
    // Reset window
    rateLimit.set(ip, { count: 1, resetTime: now + WINDOW_SIZE_MS });
    return next();
  }

  // Check limit
  if (data.count >= MAX_ATTEMPTS) {
    console.warn(`🛑 Bloqueio de Login: ${ip} excedeu o limite de tentativas.`);
    return res.status(429).json({
      message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
    });
  }

  // Increment
  data.count++;
  next();
};

// Cleanup interval (run every hour to remove expired entries)
// unref() ensures this timer doesn't prevent the app from exiting (e.g. in tests)
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimit.entries()) {
    if (now > data.resetTime) {
      rateLimit.delete(ip);
    }
  }
}, 60 * 60 * 1000).unref();

module.exports = loginLimiter;
