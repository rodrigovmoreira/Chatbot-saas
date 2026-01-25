const mongoSanitize = require('../../middleware/mongoSanitize');

describe('Mongo Sanitize Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, query: {}, params: {} };
    res = {};
    next = jest.fn();
  });

  test('should remove keys starting with $ from body', () => {
    req.body = { username: 'test', $ne: 'admin' };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({ username: 'test' });
    expect(next).toHaveBeenCalled();
  });

  test('should remove keys containing . from query', () => {
    req.query = { 'user.name': 'admin' };
    mongoSanitize(req, res, next);
    expect(req.query).toEqual({});
    expect(next).toHaveBeenCalled();
  });

  test('should verify recursively', () => {
    req.body = {
      data: {
        $gt: 10,
        normal: 'value',
        nested: {
          'bad.key': true
        }
      }
    };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({
      data: {
        normal: 'value',
        nested: {}
      }
    });
  });

  test('should handle arrays', () => {
    req.body = {
      users: [
        { name: 'alice' },
        { $where: 'sleep(1000)' }
      ]
    };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({
      users: [
        { name: 'alice' },
        {}
      ]
    });
  });
});
