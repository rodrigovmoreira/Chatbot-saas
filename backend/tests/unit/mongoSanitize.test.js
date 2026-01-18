const mongoSanitize = require('../../middleware/mongoSanitize');

describe('Mongo Sanitize Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, query: {}, params: {} };
    res = {};
    next = jest.fn();
  });

  it('should remove keys starting with $ from body', () => {
    req.body = {
      username: 'user',
      $gt: ''
    };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({ username: 'user' });
    expect(next).toHaveBeenCalled();
  });

  it('should remove keys containing . from body', () => {
    req.body = {
      'user.name': 'admin'
    };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({});
    expect(next).toHaveBeenCalled();
  });

  it('should sanitize nested objects', () => {
    req.body = {
      filter: {
        $gt: 10,
        safe: 'value'
      }
    };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({ filter: { safe: 'value' } });
  });

  it('should sanitize arrays', () => {
    req.body = {
      items: [
        { $gt: 1 },
        { safe: 'item' }
      ]
    };
    mongoSanitize(req, res, next);
    expect(req.body).toEqual({ items: [{}, { safe: 'item' }] });
  });

  it('should sanitize query and params', () => {
    req.query = { $ne: 'null' };
    req.params = { id: '123' };
    mongoSanitize(req, res, next);
    expect(req.query).toEqual({});
    expect(req.params).toEqual({ id: '123' });
  });
});
