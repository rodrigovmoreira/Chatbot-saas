const mongoSanitize = require('../../middleware/mongoSanitize');

describe('Middleware: mongoSanitize', () => {
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
      name: 'John',
      $where: 'sleep(1000)',
      nested: {
        $gt: 10,
        valid: 'yes'
      }
    };

    mongoSanitize(req, res, next);

    expect(req.body).toEqual({
      name: 'John',
      nested: {
        valid: 'yes'
      }
    });
    expect(next).toHaveBeenCalled();
  });

  it('should remove keys containing . from req.body', () => {
    req.body = {
      'user.admin': true,
      valid: 'ok'
    };

    mongoSanitize(req, res, next);

    expect(req.body).toEqual({
      valid: 'ok'
    });
    expect(next).toHaveBeenCalled();
  });

  it('should sanitize req.query', () => {
    req.query = {
      $ne: 'null',
      page: 1
    };

    mongoSanitize(req, res, next);

    expect(req.query).toEqual({
      page: 1
    });
    expect(next).toHaveBeenCalled();
  });

  it('should sanitize req.params', () => {
    req.params = {
      id: '123',
      'bad.param': 'evil'
    };

    mongoSanitize(req, res, next);

    expect(req.params).toEqual({
      id: '123'
    });
    expect(next).toHaveBeenCalled();
  });

  it('should handle arrays in req.body', () => {
    req.body = {
      tags: ['a', 'b', { $bad: 'evil' }]
    };

    mongoSanitize(req, res, next);

    expect(req.body).toEqual({
      tags: ['a', 'b', {}]
    });
    expect(next).toHaveBeenCalled();
  });

  it('should handle array at root of req.body', () => {
     req.body = [{ $bad: 'evil' }, { good: 'ok' }];

     mongoSanitize(req, res, next);

     expect(req.body).toEqual([{}, { good: 'ok' }]);
  });
});
