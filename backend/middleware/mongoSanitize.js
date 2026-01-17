/**
 * MongoDB NoSQL Injection Sanitization Middleware
 *
 * Recursively removes any keys starting with "$" or containing "."
 * from req.body, req.query, and req.params.
 *
 * This prevents users from sending objects like {"$gt": ""} which could
 * alter the logic of database queries.
 */

const sanitize = (obj) => {
  // If not an object or array, return as is
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Handle Arrays: return a new sanitized array
  if (Array.isArray(obj)) {
    return obj.map(i => sanitize(i));
  }

  // Handle Objects: modify in place
  for (const key in obj) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else {
      // Recursively sanitize and assign back (crucial for nested arrays)
      obj[key] = sanitize(obj[key]);
    }
  }

  return obj;
};

module.exports = (req, res, next) => {
  try {
    // req.body can be an array, so we must reassign it
    if (req.body) {
      req.body = sanitize(req.body);
    }

    // req.query and req.params are typically objects and might be getters
    // so we sanitize them in-place without reassigning the root property
    if (req.query) {
      sanitize(req.query);
    }

    if (req.params) {
      sanitize(req.params);
    }

    next();
  } catch (error) {
    console.error('MongoSanitize Error:', error);
    next(error);
  }
};
