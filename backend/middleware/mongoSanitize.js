const sanitize = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  for (const key in obj) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else {
      sanitize(obj[key]);
    }
  }
};

const mongoSanitize = () => {
  return (req, res, next) => {
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    next();
  };
};

module.exports = mongoSanitize;
