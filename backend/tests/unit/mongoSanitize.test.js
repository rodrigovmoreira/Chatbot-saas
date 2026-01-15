const mongoSanitize = require('../../middleware/mongoSanitize');

describe('Mongo Sanitize Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, query: {}, params: {} };
    res = {};
    next = jest.fn();
  });

  test('should remove keys starting with $ from req.body', () => {
    req.body = { name: 'test', $gt: 10 };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({ name: 'test' });
    expect(next).toHaveBeenCalled();
  });

  test('should remove keys containing . from req.body', () => {
    req.body = { 'user.name': 'admin', valid: true };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({ valid: true });
    expect(next).toHaveBeenCalled();
  });

  test('should sanitize nested objects', () => {
    req.body = {
      filter: {
        $gt: 5,
        safe: 1
      },
      data: 'ok'
    };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({
      filter: { safe: 1 },
      data: 'ok'
    });
  });

  test('should sanitize arrays of objects', () => {
    req.body = {
      items: [
        { $ne: 1 },
        { id: 2 }
      ]
    };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({
      items: [
        {},
        { id: 2 }
      ]
    });
  });

  test('should handle req.query and req.params', () => {
    req.query = { $ne: 'admin' };
    req.params = { 'id.hack': '123' };
    mongoSanitize(req, res, next);
    expect(req.query).toEqual({});
    expect(req.params).toEqual({});
  });

  test('should handle null or undefined gracefully', () => {
      req.body = null;
      mongoSanitize(req, res, next);
      expect(req.body).toBeNull();
      expect(next).toHaveBeenCalled();
  });

  test('should return 400 if sanitization throws an error (e.g. circular ref)', () => {
    const circular = {};
    circular.self = circular;
    req.body = circular;

    res.status = jest.fn().mockReturnThis();
    res.json = jest.fn();

    mongoSanitize(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Bad Request: Malformed Input' });
    expect(next).not.toHaveBeenCalled();
  });
});
