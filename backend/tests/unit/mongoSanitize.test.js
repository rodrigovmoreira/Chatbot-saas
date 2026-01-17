const mongoSanitize = require('../../middleware/mongoSanitize');

describe('Mongo Sanitize Middleware', () => {
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

  test('should remove keys starting with $', () => {
    req.body = {
      username: 'user',
      $where: '1=1',
      nested: {
        $gt: 10
      }
    };

    mongoSanitize(req, res, next);

    expect(req.body.username).toBe('user');
    expect(req.body.$where).toBeUndefined();
    expect(req.body.nested).toBeDefined();
    expect(req.body.nested.$gt).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test('should remove keys containing .', () => {
    req.query = {
      'user.name': 'admin',
      valid: 'true'
    };

    mongoSanitize(req, res, next);

    expect(req.query['user.name']).toBeUndefined();
    expect(req.query.valid).toBe('true');
    expect(next).toHaveBeenCalled();
  });

  test('should handle arrays', () => {
    req.body = {
      users: [
        { name: 'alice', $role: 'admin' },
        { name: 'bob' }
      ]
    };

    mongoSanitize(req, res, next);

    expect(req.body.users[0].name).toBe('alice');
    expect(req.body.users[0].$role).toBeUndefined();
    expect(req.body.users[1].name).toBe('bob');
    expect(next).toHaveBeenCalled();
  });

  test('should handle nested arrays and objects', () => {
    req.body = {
      data: {
        list: [
          {
            $bad: 'value',
            good: {
              'bad.key': 'val'
            }
          }
        ]
      }
    };

    mongoSanitize(req, res, next);

    expect(req.body.data.list[0].$bad).toBeUndefined();
    expect(req.body.data.list[0].good).toBeDefined();
    expect(req.body.data.list[0].good['bad.key']).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test('should ignore non-object values', () => {
    req.body = 'string';
    req.query = null;
    req.params = 123;

    mongoSanitize(req, res, next);

    expect(req.body).toBe('string');
    expect(req.query).toBeNull();
    expect(req.params).toBe(123);
    expect(next).toHaveBeenCalled();
  });
});
