import type { Context, Next } from "hono";

import { extractBearerToken } from "../extract-bearer-token.js";

declare module "hono" {
  interface ContextVariableMap {
    userId?: string;
  }
}

export type AuthMiddlewareDependencies = Readonly<{
  verifyAccessToken: (token: string) => Promise<{ userId: string }>;
}>;

export function createAuthMiddleware(deps: AuthMiddlewareDependencies) {
  return async (c: Context, next: Next) => {
    const token = extractBearerToken(c.req.header("Authorization"));
    if (token === null) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let payload: { userId: string };
    try {
      payload = await deps.verifyAccessToken(token);
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("userId", payload.userId);
    await next();
  };
}
