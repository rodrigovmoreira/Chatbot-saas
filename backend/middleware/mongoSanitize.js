// Middleware to sanitize inputs against NoSQL Injection
// Removes keys starting with '$' or containing '.'

const sanitize = (obj) => {
  if (!obj) return obj;

  if (Array.isArray(obj)) {
    return obj.map(i => sanitize(i));
  }

  if (typeof obj === 'object') {
    for (const key in obj) {
      if (/^\$/.test(key) || /\./.test(key)) {
        delete obj[key];
      } else {
        obj[key] = sanitize(obj[key]);
      }
    }
  }
  return obj;
};

module.exports = (req, res, next) => {
  try {
    req.body = sanitize(req.body);
    sanitize(req.query);
    sanitize(req.params);
    next();
  } catch (err) {
    console.error('MongoSanitize Error:', err);
    next(err);
  }
};
