const mongoSanitize = require('../../middleware/mongoSanitize');

describe('mongoSanitize Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {},
    };
    res = {};
    next = jest.fn();
  });

  it('should remove keys starting with $ from req.body', () => {
    req.body = {
      email: { $ne: null },
      password: 'password123'
    };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({
      email: {},
      password: 'password123'
    });
    expect(next).toHaveBeenCalled();
  });

  it('should remove keys starting with $ from req.query', () => {
    req.query = {
      user: { $gt: '' },
      page: 1
    };
    mongoSanitize(req, res, next);
    expect(req.query).toEqual({
      user: {},
      page: 1
    });
    expect(next).toHaveBeenCalled();
  });

  it('should remove keys containing . from req.body', () => {
    req.body = {
      "user.name": "admin",
      "valid": "data"
    };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({
      "valid": "data"
    });
    expect(next).toHaveBeenCalled();
  });

  it('should handle nested objects', () => {
    req.body = {
      data: {
        filter: {
          $gt: 10
        },
        valid: 'yes'
      }
    };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({
      data: {
        filter: {},
        valid: 'yes'
      }
    });
    expect(next).toHaveBeenCalled();
  });

  it('should handle arrays correctly', () => {
    req.body = {
      items: [
        { $bad: 'value' },
        { good: 'value' }
      ]
    };
    mongoSanitize(req, res, next);
    // Note: If array handling is implemented. Usually we iterate object keys.
    // If the middleware treats array as object (which it is in JS), it should work.
    expect(req.body).toEqual({
      items: [
        {},
        { good: 'value' }
      ]
    });
    expect(next).toHaveBeenCalled();
  });
});
