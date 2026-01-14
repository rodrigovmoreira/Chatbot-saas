/**
 * Middleware de Sanitização NoSQL
 * Remove chaves que começam com '$' ou contém '.' para prevenir injeção de operadores do MongoDB.
 * Baseado na memória do projeto: "compatibility with Express 5... removing keys starting with $ or containing ."
 */
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

const mongoSanitize = (req, res, next) => {
  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  next();
};

module.exports = mongoSanitize;
