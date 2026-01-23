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

  it('should remove keys starting with $ from req.body', () => {
    req.body = {
      username: 'user',
      $where: '1=1',
      nested: {
        $ne: 1
      }
    };

    mongoSanitize(req, res, next);

    expect(req.body).toEqual({
      username: 'user',
      nested: {}
    });
    expect(next).toHaveBeenCalled();
  });

  it('should remove keys containing . from req.query', () => {
    req.query = {
      'user.admin': true,
      valid: 'true'
    };

    mongoSanitize(req, res, next);

    expect(req.query).toEqual({
      valid: 'true'
    });
    expect(next).toHaveBeenCalled();
  });

  it('should handle nested objects recursively', () => {
    req.body = {
      a: {
        b: {
          $c: 'bad'
        },
        d: 'good'
      }
    };

    mongoSanitize(req, res, next);

    expect(req.body).toEqual({
      a: {
        b: {},
        d: 'good'
      }
    });
  });

  it('should not affect safe data', () => {
    const safeData = {
      name: 'John',
      age: 30,
      roles: ['admin', 'user']
    };
    req.body = { ...safeData };

    mongoSanitize(req, res, next);

    expect(req.body).toEqual(safeData);
  });
});
