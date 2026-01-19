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

  it('should remove keys starting with $ in req.body', () => {
    req.body = {
      name: 'test',
      $ne: 'bad',
      nested: {
        $gt: 10,
        ok: 'ok'
      }
    };

    mongoSanitize(req, res, next);

    expect(req.body).toEqual({
      name: 'test',
      nested: {
        ok: 'ok'
      }
    });
    expect(next).toHaveBeenCalled();
  });

  it('should remove keys containing . in req.body', () => {
    req.body = {
      'bad.key': 'value',
      nested: {
        'ok': 'ok'
      }
    };

    mongoSanitize(req, res, next);

    expect(req.body).toEqual({
      nested: {
        ok: 'ok'
      }
    });
  });

  it('should sanitize req.query and req.params', () => {
    req.query = { $where: '1==1' };
    req.params = { 'id.hack': '1' };

    mongoSanitize(req, res, next);

    expect(req.query).toEqual({});
    expect(req.params).toEqual({});
  });

  it('should handle arrays', () => {
    req.body = [
      { $bad: 1, good: 2 },
      'string'
    ];

    mongoSanitize(req, res, next);

    expect(req.body).toEqual([
      { good: 2 },
      'string'
    ]);
  });
});
