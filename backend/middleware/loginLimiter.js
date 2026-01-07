const rateLimit = new Map();

const loginLimiter = (req, res, next) => {
  // Get IP (handle proxies if trust proxy is set, otherwise remoteAddress)
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_ATTEMPTS = 5;

  const now = Date.now();
  const record = rateLimit.get(ip);

  if (!record) {
    rateLimit.set(ip, { count: 1, firstRequestTime: now });
    return next();
  }

  if (now - record.firstRequestTime > WINDOW_MS) {
    // Window expired, reset
    rateLimit.set(ip, { count: 1, firstRequestTime: now });
    return next();
  }

  if (record.count >= MAX_ATTEMPTS) {
    console.warn(`🛑 Brute-force blocked for IP: ${ip}`);
    return res.status(429).json({
      message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
    });
  }

  record.count += 1;
  next();
};

// Periodic cleanup (every 10 mins) to prevent memory leaks
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000;
  for (const [ip, record] of rateLimit.entries()) {
    if (now - record.firstRequestTime > WINDOW_MS) {
      rateLimit.delete(ip);
    }
  }
}, 10 * 60 * 1000);

// Ensure this interval doesn't prevent the process from exiting (important for tests)
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

module.exports = loginLimiter;
