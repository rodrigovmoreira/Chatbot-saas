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

  test('should remove keys starting with $ in body', () => {
    req.body = {
      email: { $ne: null },
      password: 'password123'
    };

    const middleware = mongoSanitize();
    middleware(req, res, next);

    expect(req.body).toEqual({
      email: {},
      password: 'password123'
    });
    expect(next).toHaveBeenCalled();
  });

  test('should remove keys containing . in body', () => {
    req.body = {
      "user.name": "hacker"
    };

    const middleware = mongoSanitize();
    middleware(req, res, next);

    expect(req.body).toEqual({});
    expect(next).toHaveBeenCalled();
  });

  test('should sanitize nested objects', () => {
    req.body = {
      data: {
        filter: {
          $gt: 10
        }
      }
    };

    const middleware = mongoSanitize();
    middleware(req, res, next);

    expect(req.body).toEqual({
      data: {
        filter: {}
      }
    });
  });

  test('should not alter valid data', () => {
    req.body = {
      name: 'John Doe',
      age: 30,
      tags: ['user', 'admin']
    };

    const middleware = mongoSanitize();
    middleware(req, res, next);

    expect(req.body).toEqual({
      name: 'John Doe',
      age: 30,
      tags: ['user', 'admin']
    });
  });

  test('should sanitize query and params', () => {
    req.query = { $sort: 'asc' };
    req.params = { "id.hack": '123' };

    const middleware = mongoSanitize();
    middleware(req, res, next);

    expect(req.query).toEqual({});
    expect(req.params).toEqual({});
  });
});
