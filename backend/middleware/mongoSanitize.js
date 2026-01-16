const sanitize = (obj) => {
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      if (/^\$/.test(key) || key.includes('.')) {
        delete obj[key];
      } else {
        sanitize(obj[key]);
      }
    });
  }
  return obj;
};

const mongoSanitize = (req, res, next) => {
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  next();
};

module.exports = mongoSanitize;
