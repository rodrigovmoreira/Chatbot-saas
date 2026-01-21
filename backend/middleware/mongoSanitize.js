// Middleware to sanitize inputs against NoSQL Injection
// Recursively removes keys starting with '$' or containing '.'

const sanitize = (obj) => {
  if (obj instanceof Object) {
    for (const key in obj) {
      if (/^\$|\./.test(key)) {
        // console.warn(`🛡️ Sanitizer: Removing dangerous key '${key}'`);
        delete obj[key];
      } else {
        sanitize(obj[key]);
      }
    }
  }
  return obj;
};

const mongoSanitize = (req, res, next) => {
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);
  next();
};

module.exports = mongoSanitize;
