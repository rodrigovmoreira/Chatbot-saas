/**
 * Middleware de Sanitização MongoDB (NoSQL Injection Protection)
 *
 * Remove chaves que começam com "$" ou contêm "." em req.body, req.query e req.params.
 * Isso previne que atacantes enviem objetos de comando MongoDB (como $gt, $ne)
 * onde strings são esperadas.
 */

const sanitize = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitize(item));
  }

  const newObj = {};
  for (const key in obj) {
    // Pula chaves perigosas
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }

    // Recursividade
    newObj[key] = sanitize(obj[key]);
  }
  return newObj;
};

const mongoSanitize = (req, res, next) => {
  try {
    // req.body é geralmente sobrescrevível (criado por body-parser)
    req.body = sanitize(req.body);

    // req.query e req.params podem ser apenas getter no Express 5
    // Precisamos modificar in-place
    if (req.query) {
      const sanitizedQuery = sanitize(req.query);
      for (const key in req.query) {
        delete req.query[key];
      }
      Object.assign(req.query, sanitizedQuery);
    }

    if (req.params) {
      const sanitizedParams = sanitize(req.params);
      for (const key in req.params) {
        delete req.params[key];
      }
      Object.assign(req.params, sanitizedParams);
    }

    next();
  } catch (err) {
    console.error('Erro no middleware mongoSanitize:', err);
    next(err);
  }
};

module.exports = mongoSanitize;
