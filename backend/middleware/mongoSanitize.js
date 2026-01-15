const sanitize = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  for (const key in obj) {
    if (/^\$/.test(key) || key.includes('.')) {
      delete obj[key];
    } else {
      sanitize(obj[key]);
    }
  }
  return obj;
};

module.exports = (req, res, next) => {
  try {
    sanitize(req.body);
    sanitize(req.query);
    sanitize(req.params);
    next();
  } catch (error) {
    console.error('[Security] Sanitize Error:', error);
    res.status(400).json({ message: 'Bad Request: Malformed Input' });
  }
};
