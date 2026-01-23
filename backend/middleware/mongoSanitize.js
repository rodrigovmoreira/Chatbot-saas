const sanitize = (obj) => {
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach((key) => {
      if (/^\$|\./.test(key)) {
        delete obj[key];
      } else {
        sanitize(obj[key]);
      }
    });
  }
  return obj;
};

const mongoSanitize = (req, res, next) => {
  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);

  next();
};

module.exports = mongoSanitize;
