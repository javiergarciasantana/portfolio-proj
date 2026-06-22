import { RateLimitMiddleware } from './rate-limit.middleware';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

const buildReq = (
  ip = '1.2.3.4',
  headers: Record<string, string | string[]> = {},
): Partial<Request> => ({
  ip,
  headers,
  socket: { remoteAddress: ip } as any,
});

const noop = {} as Response;

describe('RateLimitMiddleware', () => {
  let middleware: RateLimitMiddleware;

  beforeEach(() => {
    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.RATE_LIMIT_MAX_REQUESTS = '3';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    jest.useFakeTimers();
    middleware = new RateLimitMiddleware();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete process.env.RATE_LIMIT_ENABLED;
    delete process.env.RATE_LIMIT_MAX_REQUESTS;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it('allows the first request', () => {
    const next = jest.fn();
    middleware.use(buildReq() as Request, noop, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows requests up to maxRequests', () => {
    for (let i = 0; i < 3; i++) {
      const next = jest.fn();
      middleware.use(buildReq() as Request, noop, next);
      expect(next).toHaveBeenCalled();
    }
  });

  it('throws 429 on the request that exceeds maxRequests', () => {
    for (let i = 0; i < 3; i++) {
      middleware.use(buildReq() as Request, noop, jest.fn());
    }
    expect(() => middleware.use(buildReq() as Request, noop, jest.fn())).toThrow(
      new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS),
    );
  });

  it('tracks different IPs independently', () => {
    for (let i = 0; i < 3; i++) {
      middleware.use(buildReq('1.1.1.1') as Request, noop, jest.fn());
    }
    const next = jest.fn();
    middleware.use(buildReq('2.2.2.2') as Request, noop, next);
    expect(next).toHaveBeenCalled();
  });

  it('resets counter after window expires', () => {
    for (let i = 0; i < 3; i++) {
      middleware.use(buildReq() as Request, noop, jest.fn());
    }
    jest.advanceTimersByTime(61_000);
    const next = jest.fn();
    middleware.use(buildReq() as Request, noop, next);
    expect(next).toHaveBeenCalled();
  });

  it('continues to block within the same window', () => {
    for (let i = 0; i < 3; i++) {
      middleware.use(buildReq() as Request, noop, jest.fn());
    }
    jest.advanceTimersByTime(30_000); // halfway through window
    expect(() => middleware.use(buildReq() as Request, noop, jest.fn())).toThrow(HttpException);
  });

  it('passes all requests through when disabled', () => {
    process.env.RATE_LIMIT_ENABLED = 'false';
    const m = new RateLimitMiddleware();
    for (let i = 0; i < 100; i++) {
      const next = jest.fn();
      m.use(buildReq() as Request, noop, next);
      expect(next).toHaveBeenCalled();
    }
  });

  describe('getClientIp', () => {
    it('uses first IP from X-Forwarded-For string header', () => {
      const req = buildReq('127.0.0.1', { 'x-forwarded-for': '5.5.5.5, 10.0.0.1' });
      for (let i = 0; i < 3; i++) {
        middleware.use(req as Request, noop, jest.fn());
      }
      // 5.5.5.5 bucket is full; 127.0.0.1 bucket is untouched
      expect(() => middleware.use(req as Request, noop, jest.fn())).toThrow(HttpException);
      const fresh = jest.fn();
      middleware.use(buildReq('127.0.0.1') as Request, noop, fresh);
      expect(fresh).toHaveBeenCalled();
    });

    it('uses first element from X-Forwarded-For array header', () => {
      const req = buildReq('127.0.0.1', { 'x-forwarded-for': ['6.6.6.6', '10.0.0.1'] });
      const next = jest.fn();
      middleware.use(req as Request, noop, next);
      expect(next).toHaveBeenCalled();
    });

    it('falls back to request.ip when no forwarded header', () => {
      const req: Partial<Request> = { ip: '9.9.9.9', headers: {}, socket: {} as any };
      const next = jest.fn();
      middleware.use(req as Request, noop, next);
      expect(next).toHaveBeenCalled();
    });

    it('falls back to socket.remoteAddress when request.ip is absent', () => {
      const req: Partial<Request> = {
        ip: undefined,
        headers: {},
        socket: { remoteAddress: '8.8.8.8' } as any,
      };
      const next = jest.fn();
      middleware.use(req as Request, noop, next);
      expect(next).toHaveBeenCalled();
    });

    it('uses "unknown" key when no IP source available', () => {
      const req: Partial<Request> = {
        ip: undefined,
        headers: {},
        socket: { remoteAddress: undefined } as any,
      };
      const next = jest.fn();
      middleware.use(req as Request, noop, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
