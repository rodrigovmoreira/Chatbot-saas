const sanitize = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Handle Arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitize(item));
  }

  // Handle Objects
  const newObj = {};
  for (const key in obj) {
    // Skip keys that start with $ or contain .
    if (/^\$/.test(key) || /\./.test(key)) {
      continue;
    }
    newObj[key] = sanitize(obj[key]);
  }
  return newObj;
};

const mongoSanitize = (req, res, next) => {
  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    // req.query might be a getter-only property in some Express envs
    // so we modify it in place
    const sanitized = sanitize(req.query);
    // Remove all keys from original
    for (const key in req.query) {
      delete req.query[key];
    }
    // Copy sanitized keys back
    Object.assign(req.query, sanitized);
  }
  if (req.params) {
    // Same for req.params
    const sanitized = sanitize(req.params);
    for (const key in req.params) {
      delete req.params[key];
    }
    Object.assign(req.params, sanitized);
  }
  next();
};

module.exports = mongoSanitize;
