const mongoSanitize = require('../../middleware/mongoSanitize');

describe('MongoDB Sanitization Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, query: {}, params: {} };
    res = {};
    next = jest.fn();
  });

  test('should remove keys starting with $', () => {
    req.body = { username: 'user', $gt: '' };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({ username: 'user' });
    expect(next).toHaveBeenCalled();
  });

  test('should remove keys containing .', () => {
    req.body = { 'user.name': 'admin' };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({});
    expect(next).toHaveBeenCalled();
  });

  test('should recurse into nested objects', () => {
    req.body = {
      filter: {
        $ne: 'null',
        valid: 'yes'
      }
    };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({ filter: { valid: 'yes' } });
  });

  test('should handle arrays', () => {
    req.body = {
      items: [
        { name: 'good' },
        { $bad: 'evil' }
      ]
    };
    mongoSanitize(req, res, next);
    expect(req.body.items).toHaveLength(2);
    expect(req.body.items[0]).toEqual({ name: 'good' });
    expect(req.body.items[1]).toEqual({});
  });

  test('should sanitize query and params', () => {
      req.query = { $where: 'sleep(1000)' };
      req.params = { id: '123' }; // legit

      mongoSanitize(req, res, next);

      expect(req.query).toEqual({});
      expect(req.params).toEqual({ id: '123' });
  });
});
