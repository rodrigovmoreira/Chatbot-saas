const mongoSanitize = require('../../middleware/mongoSanitize');

describe('mongoSanitize Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {}
    };
    res = {};
    next = jest.fn();
  });

  test('should verify valid data is preserved', () => {
    req.body = { name: 'John', age: 30 };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({ name: 'John', age: 30 });
    expect(next).toHaveBeenCalled();
  });

  test('should remove keys starting with $ from req.body', () => {
    req.body = { username: 'user', $where: '1=1' };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({ username: 'user' });
  });

  test('should remove keys containing . from req.body', () => {
    req.body = { 'user.name': 'admin' };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({});
  });

  test('should sanitize nested objects', () => {
    req.body = {
      user: {
        name: 'John',
        $password: 'hacker'
      }
    };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({ user: { name: 'John' } });
  });

  test('should sanitize arrays of objects', () => {
    req.body = {
      users: [
        { name: 'Alice', $admin: true },
        { name: 'Bob' }
      ]
    };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({
      users: [
        { name: 'Alice' },
        { name: 'Bob' }
      ]
    });
  });

  test('should sanitize req.query', () => {
    req.query = { id: { $ne: null } };
    mongoSanitize(req, res, next);
    expect(req.query).toEqual({ id: {} });
  });

  test('should sanitize req.params', () => {
    req.params = { id: '$illegal' };
    // Wait, params values are strings. The middleware sanitizes KEYS of the object.
    // If req.params = { id: '$illegal' }, the key is 'id', value is '$illegal'.
    // The middleware does NOT sanitize values, only keys.
    // Let's test that keys are sanitized.
    // But express req.params usually doesn't have keys with $ unless defined in route, which is unlikely to be user controlled.
    // However, if someone manages to pollute it...

    // Let's test object values in params if that's even possible (usually not in express default, but good for coverage)
    req.params = { '$hack': 'value' };
    mongoSanitize(req, res, next);
    expect(req.params).toEqual({});
  });

  test('should handle non-object bodies (e.g. null/undefined)', () => {
    req.body = null;
    mongoSanitize(req, res, next);
    expect(req.body).toBeNull();
    expect(next).toHaveBeenCalled();
  });
});
