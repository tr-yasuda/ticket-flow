import { ApiErrorCode, createApiErrorResponse } from "@ticket-flow/shared";
import type { Context, Next } from "hono";

import { HttpStatus } from "./http-status.js";

export type RateLimitOptions = Readonly<{
  windowMs: number;
  maxRequests: number;
  keyGenerator: (c: Context) => string;
  message?: string;
}>;

type RateLimitState = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitState>();
const SWEEP_THRESHOLD = 1000;

export function sweepExpiredRateLimitEntries(now = Date.now()): void {
  for (const [key, state] of store) {
    if (state.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  return async function rateLimitMiddleware(
    c: Context,
    next: Next,
  ): Promise<Response | undefined> {
    const key = options.keyGenerator(c);
    const now = Date.now();

    if (store.size > SWEEP_THRESHOLD) {
      sweepExpiredRateLimitEntries(now);
    }

    const state = store.get(key);

    if (state !== undefined && state.resetAt > now) {
      if (state.count >= options.maxRequests) {
        return c.json(
          createApiErrorResponse(
            ApiErrorCode.RATE_LIMITED,
            options.message ??
              "リクエストが多すぎます。しばらく経ってからお試しください。",
          ),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      state.count++;
    } else {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
    }

    await next();
  };
}

export function resetRateLimit(): void {
  store.clear();
}
