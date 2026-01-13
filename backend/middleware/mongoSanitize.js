const mongoSanitize = () => {
  return (req, res, next) => {
    const sanitize = (obj) => {
      if (obj instanceof Object) {
        for (const key in obj) {
          if (/^\$/.test(key) || /\./.test(key)) {
            delete obj[key];
          } else {
            sanitize(obj[key]);
          }
        }
      }
      return obj;
    };

    if (req.body) sanitize(req.body);
    if (req.params) sanitize(req.params);

    if (req.query) {
      const sanitizedQuery = sanitize(req.query);
      try {
        req.query = sanitizedQuery;
      } catch (err) {
        // Fallback for Express 5 read-only getter
        Object.defineProperty(req, 'query', {
          value: sanitizedQuery,
          writable: true,
          configurable: true
        });
      }
    }

    next();
  };
};

module.exports = mongoSanitize;
