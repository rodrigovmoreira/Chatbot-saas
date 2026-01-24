/**
 * MongoDB Sanitization Middleware
 * Prevents NoSQL Injection by removing keys starting with '$' or containing '.'
 *
 * Why: Attackers can use MongoDB operators (e.g., $gt, $ne) in JSON payloads
 * to alter query logic or bypass authentication.
 */

const sanitize = (obj) => {
  if (obj instanceof Object) {
    for (const key of Object.keys(obj)) {
      if (/^\$/.test(key) || /\./.test(key)) {
        delete obj[key];
      } else {
        sanitize(obj[key]);
      }
    }
  }
  return obj;
};

module.exports = (req, res, next) => {
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
};
