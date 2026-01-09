const { loginLimiter, registerLimiter } = require('../../middleware/rateLimiters');

// Mock Request and Response
const mockReq = (ip) => ({
  headers: { 'x-forwarded-for': ip },
  connection: { remoteAddress: ip }
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe('Rate Limiters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // We can't easily reset the internal Maps of the module without reloading it,
    // but for unit tests we can simulate by using different IPs.
  });

  test('should allow requests under the limit', () => {
    const req = mockReq('1.1.1.1');
    const res = mockRes();
    const next = mockNext;

    // Login limiter has max 5
    loginLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should block requests over the limit', () => {
    const ip = '2.2.2.2';
    const req = mockReq(ip);
    const res = mockRes();
    const next = mockNext;

    // Login limiter max is 5. Call 6 times.
    for (let i = 0; i < 5; i++) {
      loginLimiter(req, res, next);
    }

    // The 6th time should fail
    loginLimiter(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Muitas tentativas')
    }));
  });

  test('register limiter should have stricter limits', () => {
    const ip = '3.3.3.3';
    const req = mockReq(ip);
    const res = mockRes();
    const next = mockNext;

    // Register limiter max is 3.
    for (let i = 0; i < 3; i++) {
      registerLimiter(req, res, next);
    }

    // The 4th time should fail
    registerLimiter(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Muitos registros')
    }));
  });
});
