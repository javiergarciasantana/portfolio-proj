import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly requestBuckets = new Map<string, RateLimitBucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly enabled: boolean;

  constructor() {
    this.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
    this.maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '60', 10);
    this.enabled = process.env.RATE_LIMIT_ENABLED !== 'false';

    // Purge expired buckets every window to prevent unbounded memory growth
    setInterval(() => this.cleanup(), this.windowMs);
  }

  use(request: Request, _response: Response, next: NextFunction) {
    if (!this.enabled) {
      next();
      return;
    }

    const clientIp = this.getClientIp(request);
    const now = Date.now();
    const current = this.requestBuckets.get(clientIp);

    if (!current || current.resetAt <= now) {
      this.requestBuckets.set(clientIp, { count: 1, resetAt: now + this.windowMs });
      next();
      return;
    }

    if (current.count >= this.maxRequests) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    current.count += 1;
    next();
  }

  private getClientIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      return forwardedFor.split(',')[0].trim();
    }

    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      return forwardedFor[0];
    }

    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, bucket] of this.requestBuckets) {
      if (bucket.resetAt <= now) {
        this.requestBuckets.delete(ip);
      }
    }
  }
}
