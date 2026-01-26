const mongoSanitize = (req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    // Handle Arrays (iterate over them but don't delete keys like '0', '1')
    if (Array.isArray(obj)) {
      obj.forEach((item) => sanitize(item));
      return obj;
    }

    // Handle Objects
    for (const key in obj) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else {
        sanitize(obj[key]);
      }
    }
    return obj;
  };

  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);

  next();
};

module.exports = mongoSanitize;
